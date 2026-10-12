<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Config\Repository as ConfigRepository;
use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Contracts\Routing\UrlGenerator as UrlGeneratorContract;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\RouteCollection;
use Illuminate\Routing\UrlGenerator;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackRuntimeRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\DocumentStorageCodec;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\EmptyStructureDocument;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\PublicationCommitException;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminDocumentController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PublicationRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\RevisionRecord;
use Modules\Jiwonpapa\PageBuilder\Providers\PageBuilderServiceProvider;
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
        $application = new Application(dirname(__DIR__, 3));
        $application->instance('config', new ConfigRepository(['app' => ['locale' => 'ko']]));
        $this->database = new Capsule($application);
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

    private function publicationService(): PageBuilderService
    {
        $container = $this->database->getContainer();
        (new PageBuilderServiceProvider($container))->register();
        $container->bind(BlockPackRuntimeRegistry::class, static function () {
            throw new \RuntimeException('An optional legacy block runtime is unavailable.');
        });

        return $container->make(PageBuilderService::class);
    }

    public function test_provider_compiles_previews_publishes_and_restores_v3_without_loading_a_block_catalog(): void
    {
        $pages = $this->publicationService();
        foreach (['none', 'builder', 'template'] as $mode) {
            $empty = $pages->create('일반 요소 문서', 'publish-'.$mode, 'ko', null, $mode, 'g7-page-builder/v3');
            $id = $empty->document->documentId;
            $source = $this->source($empty);
            $source->shell_mode = $mode;
            $saved = $pages->saveDraftJson($id, $this->json($source), 1, null);
            $preview = $pages->renderPreview($pages->preview($id, $saved->lockVersion, null)->token);
            self::assertNotNull($preview);
            self::assertSame($mode, $preview->shellMode);
            $prepared = $pages->preparePublication($id, $saved->lockVersion, null);
            self::assertNull($pages->findPublished($source->slug));
            $published = $pages->commitPublication($prepared->token);
            self::assertSame($preview->artifact, $published->artifact);
            self::assertSame($preview->artifactSha256, $published->artifactSha256);
            self::assertSame('1.0.0', PublicationRecord::query()->where('document_id', $id)->where('status', 'active')->first()->compiler_version);
            self::assertSame($published->artifact, $pages->findPublished($source->slug)->artifact);

            $source->blocks[0]->slots->content[0]->props->runs[0]->text = '새로 저장했지만 아직 공개하지 않은 문구';
            $edited = $pages->saveDraftJson($id, $this->json($source), $saved->lockVersion, null);
            self::assertSame($published->artifact, $pages->findPublished($source->slug)->artifact);
            $newPreview = $pages->renderPreview($pages->preview($id, $edited->lockVersion, null)->token);
            self::assertStringContainsString('아직 공개하지 않은', $newPreview->artifact);
            $replacement = $pages->preparePublication($id, $edited->lockVersion, null);
            $republished = $pages->commitPublication($replacement->token);
            self::assertNotSame($published->artifactSha256, $republished->artifactSha256);
            $restored = $pages->restoreRevision($id, $saved->revision, $edited->lockVersion, null);
            self::assertSame($republished->artifact, $pages->findPublished($source->slug)->artifact);
            $original = $pages->commitPublication($pages->preparePublication($id, $restored->lockVersion, null)->token);
            self::assertSame($published->artifact, $original->artifact);
        }
    }

    public function test_stale_publication_and_archive_keep_last_good_v3_artifact_without_compiling_public_reads(): void
    {
        $pages = $this->publicationService();
        $empty = $pages->create('발행 보호', 'v3-publication-guard', 'ko', null, 'none', 'g7-page-builder/v3');
        $id = $empty->document->documentId;
        $saved = $pages->saveDraftJson($id, $this->json($this->source($empty)), 1, null);
        $published = $pages->commitPublication($pages->preparePublication($id, 2, null)->token);
        $candidate = $pages->preparePublication($id, 2, null);
        $source = $this->source($saved);
        $source->blocks[0]->slots->content[0]->props->runs[0]->text = '변경';
        $pages->saveDraftJson($id, $this->json($source), 2, null);
        try {
            $pages->commitPublication($candidate->token);
            self::fail('A stale publication replaced the active artifact.');
        } catch (LockConflictException $error) {
            self::assertSame(3, $error->currentLockVersion);
        }
        self::assertSame($published->artifact, $pages->findPublished($source->slug)->artifact);
        RevisionRecord::query()->where('document_id', $id)->update(['document_json' => '{unreadable historical source']);
        // This original service deliberately throws on any compiler resolution.
        self::assertSame($published->artifact, $this->pages->findPublished($source->slug)->artifact);
        RevisionRecord::query()->where('document_id', $id)->update(['document_json' => $this->json($source)]);
        $archived = $pages->archive($id, 3, null);
        self::assertNull($pages->findPublished($source->slug));
        self::assertSame(0, PublicationRecord::query()->where('document_id', $id)->where('status', 'active')->count());
        self::assertSame($published->artifact, PublicationRecord::query()->where('document_id', $id)->where('status', 'superseded')->first()->artifact);
        $this->expectException(PublicationCommitException::class);
        $pages->preparePublication($id, $archived->lockVersion, null);
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
