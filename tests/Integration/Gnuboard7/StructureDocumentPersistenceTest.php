<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Contracts\Routing\UrlGenerator as UrlGeneratorContract;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\RouteCollection;
use Illuminate\Routing\UrlGenerator;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\DocumentStorageCodec;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\EmptyStructureDocument;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminDocumentController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\RevisionRecord;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use stdClass;

final class StructureDocumentPersistenceTest extends TestCase
{
    private Capsule $database;

    private DocumentStorageCodec $codec;

    private PageBuilderService $pages;

    protected function setUp(): void
    {
        $this->database = new Capsule;
        $this->database->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'foreign_key_constraints' => true]);
        $this->database->setAsGlobal();
        $this->database->bootEloquent();
        $container = $this->database->getContainer();
        $container->instance('db', $this->database->getDatabaseManager());
        $container->instance('db.schema', $this->database->getConnection()->getSchemaBuilder());
        $container->instance('log', new NullLogger);
        $container->instance(UrlGeneratorContract::class, new UrlGenerator(new RouteCollection, Request::create('https://g7pb.test')));
        $responses = $this->createStub(ResponseFactory::class);
        $responses->method('json')->willReturnCallback(static fn (mixed $data = [], int $status = 200, array $headers = [], int $options = 0): JsonResponse => new JsonResponse($data, $status, $headers, $options));
        $container->instance(ResponseFactory::class, $responses);
        $container->instance('validator', new ValidationFactory(new Translator(new ArrayLoader, 'ko'), $container));
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $file) {
            (require $file)->up();
        }

        $policy = json_decode(file_get_contents(dirname(__DIR__, 3).'/schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR);
        $validator = new Validator(json_decode(file_get_contents(dirname(__DIR__, 3).'/schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR), $policy);
        $this->codec = new DocumentStorageCodec($validator);
        $this->pages = new PageBuilderService(new EloquentPageBuilderRepository($this->codec),
            static function (): DocumentCompilerPort {
                throw new \LogicException('Storage must not resolve the legacy compiler or block registry.');
            },
            $this->codec, new EmptyStructureDocument($validator), $policy['default_tokens']);
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->database->getDatabaseManager()->disconnect();
    }

    private function empty(string $slug = 'structure'): DocumentSnapshot
    {
        return $this->pages->create('정밀 문서', $slug, 'ko', null, 'none', 'g7-page-builder/v3');
    }

    private function source(DocumentSnapshot $snapshot): stdClass
    {
        $source = json_decode(file_get_contents(dirname(__DIR__, 2).'/Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $source->document_id = $snapshot->document->documentId;
        $source->slug = $snapshot->document->slug;
        $source->shell_mode = 'none';
        $source->blocks[0]->name = '서버에 등록하지 않은 구성';

        return $source;
    }

    private function json(mixed $source): string
    {
        return json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function test_real_repository_preserves_structure_metadata_revisions_copy_and_explicit_restore(): void
    {
        $empty = $this->empty();
        self::assertSame(0, $empty->document->rootCount());
        self::assertSame('g7-page-builder/v3', $empty->document->schemaVersion);
        $source = $this->source($empty);
        $saved = $this->pages->saveDraftJson($empty->document->documentId, $this->json($source), 1, null);
        self::assertSame(2, $saved->lockVersion);
        $reopened = (new EloquentPageBuilderRepository($this->codec))->find($empty->document->documentId);
        self::assertEquals($source, json_decode($this->json($reopened->document->toArray())));
        self::assertInstanceOf(stdClass::class, $reopened->document->toArray()['blocks'][0]->slots->content[0]->slots);
        self::assertFalse($reopened->document->toArray()['blocks'][0]->slots->content[0]->responsive->mobile->hidden);

        $metadata = $this->pages->updateMetadata($empty->document->documentId, '정보 변경', 'structure-renamed', 'en', 2, null, 'builder',
            ['title' => 'SEO 유지', 'description' => '설명', 'og_image_url' => '/storage/cover.webp', 'robots' => 'noindex']);
        self::assertEquals($source->blocks, $metadata->document->toArray()['blocks']);
        self::assertEquals($source->assets, $metadata->document->toArray()['assets']);
        $withoutSeo = $metadata->document->toArray();
        unset($withoutSeo['seo']);
        $after = $this->pages->saveDraftJson($empty->document->documentId, $this->json($withoutSeo), 3, null);
        self::assertSame('SEO 유지', $after->document->seo->title);
        self::assertSame(4, $after->revision);
        $copy = $this->pages->duplicate($empty->document->documentId, '복사', 'structure-copy', 4, null);
        self::assertNotSame($after->document->documentId, $copy->document->documentId);
        self::assertSame(1, $copy->revision);
        self::assertEquals($after->document->toArray()['blocks'], $copy->document->toArray()['blocks']);
        self::assertSame('SEO 유지', $copy->document->seo->title);

        $restored = $this->pages->restoreRevision($empty->document->documentId, 2, 4, null);
        self::assertSame(5, $restored->revision);
        self::assertEquals($source, json_decode($this->json($restored->document->toArray())));
        self::assertCount(5, $this->pages->revisions($empty->document->documentId));
        self::assertSame('SEO 유지', $this->pages->revision($empty->document->documentId, 4)->document->seo->title);
    }

    public function test_stale_writes_and_cross_generation_saves_do_not_add_revisions(): void
    {
        $empty = $this->empty();
        $source = $this->source($empty);
        $this->pages->saveDraftJson($empty->document->documentId, $this->json($source), 1, null);
        try {
            $this->pages->saveDraftJson($empty->document->documentId, $this->json($source), 1, null);
            self::fail('Stale save was accepted.');
        } catch (LockConflictException $error) {
            self::assertSame(2, $error->currentLockVersion);
        }
        $legacy = $this->pages->create('기존', 'legacy', 'ko', null);
        $promoted = clone $source;
        $promoted->document_id = $legacy->document->documentId;
        $promoted->slug = 'legacy';
        foreach ([[$empty, $legacy->document->toArray(), 2], [$legacy, get_object_vars($promoted), 1]] as [$target, $data, $lock]) {
            $data['document_id'] = $target->document->documentId;
            $data['slug'] = $target->document->slug;
            try {
                $this->pages->saveDraftJson($target->document->documentId, $this->json($data), $lock, null);
                self::fail('Implicit migration was accepted.');
            } catch (\InvalidArgumentException $error) {
                self::assertStringContainsString('explicit migration', $error->getMessage());
            }
        }
        self::assertSame(3, RevisionRecord::query()->count());
        self::assertSame('g7-page-builder/v1', $this->pages->get($legacy->document->documentId)->document->schemaVersion);
    }

    public function test_controller_keeps_raw_json_objects_and_rejects_identity_map_and_lock_errors(): void
    {
        $controller = new AdminDocumentController($this->pages);
        $created = $controller->store(Request::create('/documents', 'POST', ['title' => 'API', 'slug' => 'api-structure', 'schema_version' => 'g7-page-builder/v3']));
        self::assertSame(201, $created->getStatusCode());
        $id = $created->getData()->data->document->document_id;
        $source = $this->source($this->pages->get($id));
        $save = function (stdClass $value, int $lock) use ($controller, $id): JsonResponse {
            return $controller->saveDraft(Request::create('/documents/'.$id.'/draft', 'PUT', server: ['CONTENT_TYPE' => 'application/json'],
                content: $this->json(['document' => $value, 'expected_lock_version' => $lock])), $id);
        };
        self::assertSame(200, $save($source, 1)->getStatusCode());
        $read = $controller->show(Request::create('/documents/'.$id), $id);
        self::assertEquals($source, $read->getData()->data->document);
        self::assertSame(409, $save($source, 1)->getStatusCode());
        $wrongId = clone $source;
        $wrongId->document_id = '00000000-0000-4000-8000-000000000888';
        self::assertSame(400, $save($wrongId, 2)->getStatusCode());
        $badShape = json_decode($this->json($source));
        $badShape->blocks[0]->slots->content[0]->slots = [];
        self::assertSame(400, $save($badShape, 2)->getStatusCode());
        self::assertSame(2, RevisionRecord::query()->count());
        self::assertEquals($source, json_decode($this->json($this->pages->get($id)->document->toArray())));
    }
}
