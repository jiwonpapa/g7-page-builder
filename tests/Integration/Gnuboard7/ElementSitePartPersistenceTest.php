<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Config\Repository as ConfigRepository;
use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\SitePartStorageCodec;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartArtifactUpgrade;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartArtifactPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSetSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSitePartController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSitePartSetController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\PublicSiteShellController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Providers\PageBuilderServiceProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use stdClass;

final class ElementSitePartPersistenceTest extends TestCase
{
    private Capsule $database;

    private SitePartService $service;

    private SitePartStorageCodec $codec;

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
        $container->instance('validator', new ValidationFactory(new Translator(new ArrayLoader, 'ko'), $container));
        $responses = $this->createStub(ResponseFactory::class);
        $responses->method('json')->willReturnCallback(static fn (mixed $data = [], int $status = 200, array $headers = [], int $options = 0): JsonResponse => new JsonResponse($data, $status, $headers, $options));
        $container->instance(ResponseFactory::class, $responses);
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $path) {
            (require $path)->up();
        }
        (new PageBuilderServiceProvider($container))->register();
        $this->service = $container->make(SitePartService::class);
        $this->codec = $container->make(SitePartStorageCodec::class);
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->database->getDatabaseManager()->disconnect();
        parent::tearDown();
    }

    private function request(array $body): Request
    {
        return Request::create('/', 'POST', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode($body, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
    }

    private function set(string $title = 'Elements'): SitePartSetSnapshot
    {
        return $this->service->createSet($title, 'ko', SiteShell::defaults('ko'), null, 'g7-page-builder/site-part/v2');
    }

    private function candidate(SitePartSnapshot $snapshot): stdClass
    {
        $source = json_decode(file_get_contents(__DIR__.'/../../Contract/site-part-v2.fixture.json'), flags: JSON_THROW_ON_ERROR)->source;
        $source->kind = $snapshot->document->kind;
        $source->content->document_id = $snapshot->document->sitePartId;
        $source->content->locale = $snapshot->document->locale;
        self::assertInstanceOf(ElementSitePartDocument::class, $snapshot->document);
        $source->content->slug = $snapshot->document->content->slug;

        return $source;
    }

    private function editorInput(SitePartSetSnapshot $set): array
    {
        return [
            'locale' => 'ko',
            'header' => ['title' => 'Header', 'document' => $this->candidate($set->header), 'expected_lock_version' => $set->header->lockVersion],
            'footer' => ['title' => 'Footer', 'document' => $this->candidate($set->footer), 'expected_lock_version' => $set->footer->lockVersion],
        ];
    }

    private function sets(): AdminSitePartSetController
    {
        return new AdminSitePartSetController($this->service, $this->database->getContainer()->make(SiteShellService::class));
    }

    private function parts(): AdminSitePartController
    {
        return new AdminSitePartController($this->service, $this->database->getContainer()->make(SiteShellService::class));
    }

    private function filledSet(): SitePartSetSnapshot
    {
        $set = $this->set();
        $response = $this->sets()->saveDraft($this->request($this->editorInput($set)), $set->id);
        self::assertSame(200, $response->getStatusCode(), $response->getContent());

        return $this->service->listSets('ko')[0];
    }

    private function publishedSet(): SitePartSetSnapshot
    {
        $set = $this->filledSet();
        $published = $this->service->publishSet($set->id, 'ko', $set->header->lockVersion, $set->footer->lockVersion, null);

        return $this->service->activateSet($published->id, 'ko', null);
    }

    public function test_api_explicitly_creates_empty_element_set_without_changing_legacy_default(): void
    {
        $response = $this->sets()->store($this->request(['title' => 'New elements', 'locale' => 'ko', 'schema_version' => 'g7-page-builder/site-part/v2']));
        self::assertSame(201, $response->getStatusCode(), $response->getContent());
        $set = $this->service->listSets('ko')[0];
        self::assertFalse($set->isActive);
        self::assertFalse($set->isReady());
        foreach ([$set->header, $set->footer] as $part) {
            self::assertInstanceOf(ElementSitePartDocument::class, $part->document);
            self::assertSame(0, $part->document->content->rootCount());
            self::assertSame('none', $part->document->content->shellMode);
        }
        $legacy = $this->service->createSet('Legacy', 'ko', SiteShell::defaults('ko'), null);
        self::assertInstanceOf(SitePartDocument::class, $legacy->header->document);
        self::assertTrue($legacy->isActive);
        self::assertNull($this->service->publishedSet('ko')?->header);
    }

    public function test_single_draft_api_round_trip_keeps_shapes_values_and_revision_source(): void
    {
        $set = $this->set();
        $source = $this->candidate($set->header);
        $body = ['locale' => 'ko', 'set_id' => $set->id, 'title' => 'Edited', 'expected_lock_version' => 1, 'document' => $source];
        $saved = $this->parts()->saveDraft($this->request($body), 'header');
        self::assertSame(200, $saved->getStatusCode(), $saved->getContent());
        self::assertEquals($source, $saved->getData()->data->document);
        $read = $this->parts()->show(Request::create('/?locale=ko&set_id='.$set->id), 'header');
        self::assertEquals($source, $read->getData()->data->document);
        $revisions = $this->service->revisions('header', 'ko', setId: $set->id);
        self::assertCount(2, $revisions);
        self::assertEquals($source, (object) $revisions[0]->document->toArray());
        self::assertSame([], $revisions[1]->document->toArray()['content']->blocks);
        self::assertSame(409, $this->parts()->saveDraft($this->request($body), 'header')->getStatusCode());
        self::assertCount(2, $this->service->revisions('header', 'ko', setId: $set->id));
    }

    public function test_set_draft_conflict_rolls_back_both_parts_and_pair_publication_is_required(): void
    {
        $set = $this->set();
        $body = $this->editorInput($set);
        $body['footer']['expected_lock_version'] = 7;
        self::assertSame(409, $this->sets()->saveDraft($this->request($body), $set->id)->getStatusCode());
        self::assertSame(1, $this->service->get('header', 'ko', $set->id)->revision);
        self::assertSame(1, $this->service->get('footer', 'ko', $set->id)->revision);
        self::assertSame(200, $this->sets()->saveDraft($this->request($this->editorInput($set)), $set->id)->getStatusCode());
        $single = $this->parts()->publish($this->request(['locale' => 'ko', 'set_id' => $set->id, 'expected_lock_version' => 2]), 'header');
        self::assertSame(422, $single->getStatusCode());
        self::assertNull($this->service->get('header', 'ko', $set->id)->activeRevision);
        $result = $this->sets()->publish($this->request(['locale' => 'ko', 'header_expected_lock_version' => 2, 'footer_expected_lock_version' => 2]), $set->id);
        self::assertSame(200, $result->getStatusCode(), $result->getContent());
        self::assertSame(2, $result->getData()->data->header->active_revision);
        self::assertSame(2, $result->getData()->data->footer->active_revision);
        self::assertFalse($result->getData()->data->set->is_active);
        self::assertSame(200, $this->sets()->activate($this->request(['locale' => 'ko']), $set->id)->getStatusCode());
        self::assertTrue($this->service->listSets('ko')[0]->isActive);
    }

    public function test_invalid_element_requests_leave_source_and_last_publication_unchanged(): void
    {
        $set = $this->publishedSet();
        $before = $this->service->publishedSet('ko');
        foreach (['identity', 'kind', 'locale', 'slug', 'shape', 'shell', 'unknown', 'legacy'] as $case) {
            $source = $this->candidate($set->header);
            match ($case) {
                'identity' => $source->content->document_id = $set->footer->document->sitePartId,
                'kind' => $source->kind = 'footer',
                'locale' => $source->content->locale = 'en',
                'slug' => $source->content->slug = 'other',
                'shape' => $source->content->blocks[0]->style = [],
                'shell' => $source->content->shell_mode = 'builder',
                'unknown' => $source->content->script = 'ignored?',
                'legacy' => $source = (object) (new SitePartDocument($set->header->document->sitePartId, 'header', 'ko', [], []))->toArray(),
            };
            $result = $this->parts()->saveDraft($this->request(['locale' => 'ko', 'set_id' => $set->id, 'title' => 'Rejected', 'expected_lock_version' => $set->header->lockVersion, 'document' => $source]), 'header');
            self::assertSame(400, $result->getStatusCode(), $case.': '.$result->getContent());
            self::assertSame(2, $this->service->get('header', 'ko', $set->id)->revision);
            self::assertEquals($before, $this->service->publishedSet('ko'));
        }
    }

    public function test_legacy_cannot_be_converted_by_single_or_set_save(): void
    {
        $legacy = $this->service->createSet('Old', 'ko', SiteShell::defaults('ko'), null);
        $element = $this->candidate($this->set('New')->header);
        $element->content->document_id = $legacy->header->document->sitePartId;
        $single = $this->parts()->saveDraft($this->request(['locale' => 'ko', 'set_id' => $legacy->id, 'title' => 'Convert?', 'expected_lock_version' => 1, 'document' => $element]), 'header');
        self::assertSame(400, $single->getStatusCode());
        $pair = $this->sets()->saveDraft($this->request([
            'locale' => 'ko',
            'header' => ['title' => 'Convert?', 'expected_lock_version' => 1, 'document' => $element],
            'footer' => ['title' => 'Old', 'expected_lock_version' => 1, 'document' => $legacy->footer->document->toArray()],
        ]), $legacy->id);
        self::assertSame(400, $pair->getStatusCode());
        self::assertSame($legacy->header->document->toArray(), $this->service->get('header', 'ko', $legacy->id)->document->toArray());
        self::assertCount(1, $this->service->revisions('header', 'ko', setId: $legacy->id));
    }

    public function test_repository_rejects_foreign_set_documents_before_any_revision_write(): void
    {
        $first = $this->set('First');
        $other = $this->set('Other');
        $repository = $this->database->getContainer()->make(SitePartRepository::class);
        try {
            $repository->saveSetDraft($first->id, 'Foreign', $other->header->document, 1, 'Foreign', $other->footer->document, 1, null);
            self::fail('Foreign set documents were accepted.');
        } catch (\InvalidArgumentException $error) {
            self::assertStringContainsString('requested set', $error->getMessage());
        }
        self::assertSame(4, $this->database->getConnection()->table('g7pb_site_part_revisions')->count());
        self::assertSame(1, $this->service->get('header', 'ko', $other->id)->revision);
    }

    public function test_second_artifact_failure_rolls_back_both_active_revisions_and_artifacts(): void
    {
        $set = $this->publishedSet();
        $before = $this->service->publishedSet('ko');
        $body = $this->editorInput($set);
        self::assertSame(200, $this->sets()->saveDraft($this->request($body), $set->id)->getStatusCode());
        $container = $this->database->getContainer();
        $store = $container->make(SitePartArtifactPort::class);
        $port = $this->createMock(SitePartArtifactPort::class);
        $calls = 0;
        $port->expects(self::exactly(2))->method('store')->willReturnCallback(function (string $id, SitePartArtifact $artifact) use ($store, &$calls): void {
            if (++$calls === 2) {
                throw new \RuntimeException('Second artifact failed');
            }
            $store->store($id, $artifact);
        });
        $service = new SitePartService(new EloquentSitePartRepository($port, $this->codec), $container->make(SitePartHtmlCompiler::class), $this->codec);
        try {
            $service->publishSet($set->id, 'ko', $set->header->lockVersion + 1, $set->footer->lockVersion + 1, null);
            self::fail('Failed pair was published.');
        } catch (\RuntimeException $error) {
            self::assertSame('Second artifact failed', $error->getMessage());
        }
        self::assertEquals($before, $this->service->publishedSet('ko'));
        self::assertSame(2, $this->database->getConnection()->table('g7pb_site_part_artifacts')->count());
        self::assertSame(3, $this->service->get('header', 'ko', $set->id)->revision);
        self::assertSame(2, $this->service->get('header', 'ko', $set->id)->activeRevision);
    }

    public function test_stale_pair_publication_keeps_the_last_normal_output(): void
    {
        $set = $this->publishedSet();
        $before = $this->service->publishedSet('ko');
        try {
            $this->service->publishSet($set->id, 'ko', $set->header->lockVersion, $set->footer->lockVersion + 1, null);
            self::fail('Stale pair was published.');
        } catch (LockConflictException) {
            self::assertEquals($before, $this->service->publishedSet('ko'));
        }
    }

    public function test_public_reads_use_stored_artifacts_even_if_source_cannot_be_read(): void
    {
        $set = $this->publishedSet();
        $controller = new PublicSiteShellController($this->service);
        $before = $controller->show(Request::create('/?locale=ko'));
        self::assertTrue($before->getData()->data->shell->enabled);
        self::assertStringContainsString('data-g7pb-element-site-part="header"', $before->getData()->data->shell->header_html);
        $this->database->getConnection()->table('g7pb_site_part_revisions')->where('site_part_id', $set->header->document->sitePartId)->update(['document_json' => '{invalid']);
        self::assertSame($before->getContent(), $controller->show(Request::create('/?locale=ko'))->getContent());
    }

    public function test_historical_preparation_preserves_element_source_and_active_revision(): void
    {
        $set = $this->publishedSet();
        $before = $this->service->publishedSet('ko');
        $this->database->getConnection()->table('g7pb_site_part_artifacts')->delete();
        $upgrade = $this->database->getContainer()->make(SitePartArtifactUpgrade::class);
        self::assertSame(2, $upgrade->missingCount());
        self::assertSame(2, $upgrade->prepare(10));
        self::assertSame(0, $upgrade->missingCount());
        self::assertEquals($before, $this->service->publishedSet('ko'));
        self::assertSame($set->header->revision, $this->service->get('header', 'ko', $set->id)->revision);
    }
}
