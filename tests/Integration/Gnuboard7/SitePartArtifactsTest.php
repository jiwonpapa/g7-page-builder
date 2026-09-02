<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Config\Repository as ConfigRepository;
use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory as ResponseFactoryContract;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Events\Dispatcher;
use Illuminate\Foundation\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartArtifactUpgrade;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartArtifactPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSetSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Console\PrepareSitePartArtifactsCommand;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSitePartController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSitePartSetController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\PublicSiteShellController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSitePartArtifactStore;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSiteShellAdapter;
use Modules\Jiwonpapa\PageBuilder\Providers\PageBuilderServiceProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\Console\Tester\CommandTester;

final class SitePartArtifactsTest extends TestCase
{
    private Capsule $database;

    private SitePartService $service;

    private EloquentSitePartArtifactStore $artifacts;

    protected function setUp(): void
    {
        parent::setUp();
        $application = new Application(dirname(__DIR__, 3));
        $application->instance('config', new ConfigRepository(['app' => ['locale' => 'ko']]));
        $this->database = new Capsule($application);
        $this->database->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'foreign_key_constraints' => true]);
        $this->database->setEventDispatcher(new Dispatcher(new Container));
        $this->database->setAsGlobal();
        $this->database->bootEloquent();
        $container = $this->database->getContainer();
        $container->instance('db', $this->database->getDatabaseManager());
        $container->instance('db.schema', $this->database->getConnection()->getSchemaBuilder());
        $container->instance('log', new NullLogger);
        $container->instance('validator', new ValidationFactory(new Translator(new ArrayLoader, 'ko'), $container));
        $response = $this->createStub(ResponseFactoryContract::class);
        $response->method('json')->willReturnCallback(static fn (mixed $data = [], int $status = 200, array $headers = [], int $options = 0): JsonResponse => new JsonResponse($data, $status, $headers, $options));
        $container->instance(ResponseFactoryContract::class, $response);
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $path) {
            (require $path)->up();
        }
        $this->artifacts = new EloquentSitePartArtifactStore;
        $this->service = new SitePartService(new EloquentSitePartRepository($this->artifacts), new SitePartHtmlCompiler);
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

    public function test_provider_resolves_the_artifact_store_and_upgrade_service(): void
    {
        $container = $this->database->getContainer();
        (new PageBuilderServiceProvider($container))->register();
        self::assertInstanceOf(EloquentSitePartArtifactStore::class, $container->make(SitePartArtifactPort::class));
        $upgrade = $container->make(SitePartArtifactUpgrade::class);
        self::assertSame(0, $upgrade->missingCount());
        $upgrade->check();
    }

    public function test_public_html_survives_unreadable_source_and_does_not_recompile(): void
    {
        $set = $this->publishedSet('Stored output');
        $controller = new PublicSiteShellController($this->service);
        $before = $controller->show(Request::create('/public/site-shell?locale=ko'));
        $this->database->getConnection()->table('g7pb_site_part_revisions')->update(['document_json' => '{invalid historical json']);
        $after = $controller->show(Request::create('/public/site-shell?locale=ko'));
        self::assertSame(200, $after->getStatusCode());
        self::assertTrue($after->getData(true)['data']['shell']['enabled']);
        self::assertSame($before->getContent(), $after->getContent());
        self::assertSame($before->headers->get('ETag'), $after->headers->get('ETag'));
        self::assertSame($set->id, $this->service->publishedSet('ko')?->setId);
    }

    public function test_public_shell_uses_the_application_locale_without_shared_negotiation_cache(): void
    {
        $this->publishedSet('Korean shell');
        $this->publishedSet('English shell', 'en');
        $controller = new PublicSiteShellController($this->service);
        $request = Request::create('/public/site-shell', 'GET', [], [], [], ['HTTP_ACCEPT_LANGUAGE' => 'en-US,en;q=0.9']);
        self::assertSame('en', $request->getLocale());

        // G7 SetLocale sets the application locale, including user preference,
        // without changing Symfony Request::getLocale().
        $korean = $controller->show($request);
        self::assertSame('ko', $korean->getData(true)['data']['shell']['locale']);
        self::assertStringContainsString('Korean shell', $korean->getData(true)['data']['shell']['header_html']);
        self::assertSame('no-store, private', $korean->headers->get('Cache-Control'));
        self::assertSame('Accept-Language', $korean->headers->get('Vary'));

        $this->database->getContainer()->make('config')->set('app.locale', 'en');
        $english = $controller->show($request);
        self::assertSame('en', $english->getData(true)['data']['shell']['locale']);
        self::assertStringContainsString('English shell', $english->getData(true)['data']['shell']['header_html']);
        self::assertSame('no-store, private', $english->headers->get('Cache-Control'));
        self::assertNotSame($korean->headers->get('ETag'), $english->headers->get('ETag'));

        $explicit = $controller->show(Request::create('/public/site-shell?locale=ko'));
        self::assertSame('ko', $explicit->getData(true)['data']['shell']['locale']);
        self::assertSame('max-age=30, public, stale-while-revalidate=300', $explicit->headers->get('Cache-Control'));
        self::assertSame('Accept-Language', $explicit->headers->get('Vary'));
        self::assertSame($korean->headers->get('ETag'), $explicit->headers->get('ETag'));
    }

    public function test_pair_is_read_in_one_statement_even_when_active_set_changes_after_the_read(): void
    {
        $a = $this->publishedSet('Set A');
        $b = $this->publishedSet('Set B');
        $reads = 0;
        $this->database->getConnection()->listen(function ($event) use (&$reads, $b): void {
            if (str_contains($event->sql, 'header_artifact') && str_contains($event->sql, 'footer_artifact')) {
                $reads++;
                if ($reads === 1) {
                    // QueryExecuted fires after the single SELECT captured its rows.
                    $this->service->activateSet($b->id, 'ko', null);
                }
            }
        });
        $pair = $this->service->publishedSet('ko');
        self::assertSame(1, $reads);
        self::assertSame($a->id, $pair?->setId);
        self::assertStringContainsString('Set A', $pair?->header?->html ?? '');
        self::assertStringContainsString('Set A', $pair?->footer?->html ?? '');
        self::assertSame($b->id, $this->service->publishedSet('ko')?->setId);
    }

    public function test_immutable_artifact_and_failed_publication_preserve_the_last_good_pair(): void
    {
        $set = $this->publishedSet('Immutable');
        $before = $this->service->publishedSet('ko');
        $artifact = $before->header;
        try {
            $this->artifacts->store($set->header->document->sitePartId, new SitePartArtifact('header', 'replacement', hash('sha256', "9.0.0\nreplacement"), '9.0.0', $artifact->sourceRevision));
            self::fail('An existing published artifact was overwritten.');
        } catch (\DomainException) {
            self::assertEquals($before, $this->service->publishedSet('ko'));
        }
        $current = $this->service->get('header', 'ko', $set->id);
        $payload = $current->document->toArray();
        $payload['blocks'][0]['props']['home_url'] = 'javascript:alert(1)';
        $draft = $this->service->saveDraft('header', 'ko', 'Invalid URL', $payload, $current->lockVersion, null, $set->id);
        try {
            $this->service->publish('header', 'ko', $draft->lockVersion, null, $set->id);
            self::fail('An unsafe compile was published.');
        } catch (\RuntimeException) {
            self::assertEquals($before, $this->service->publishedSet('ko'));
            self::assertSame(2, $this->database->getConnection()->table('g7pb_site_part_artifacts')->count());
        }
    }

    public function test_active_set_change_cannot_redirect_a_draft_with_the_same_lock_version(): void
    {
        $a = $this->publishedSet('Set A');
        $b = $this->publishedSet('Set B');
        $loaded = $this->service->get('header', 'ko');
        self::assertSame($a->id, $loaded->setId);
        self::assertSame($loaded->lockVersion, $b->header->lockVersion);
        $this->service->activateSet($b->id, 'ko', null);
        $before = $this->sourceState();
        $publishedB = $this->service->publishedSet('ko');
        $payload = $loaded->document->toArray();
        $payload['blocks'][0]['props']['brand_name'] = 'Edited A';
        $input = ['locale' => 'ko', 'title' => 'Edited A', 'expected_lock_version' => $loaded->lockVersion, 'document' => $payload];
        $controller = new AdminSitePartController($this->service, new SiteShellService(new EloquentSiteShellAdapter));

        $rejected = $controller->saveDraft(Request::create('/site-parts/header/draft', 'PUT', $input), 'header');
        self::assertSame(400, $rejected->getStatusCode());
        self::assertSame('G7PB_SITE_PART_INVALID', $rejected->getData(true)['data']['code']);
        self::assertSame($before, $this->sourceState());
        self::assertEquals($publishedB, $this->service->publishedSet('ko'));

        $saved = $controller->saveDraft(Request::create('/site-parts/header/draft', 'PUT', [...$input, 'set_id' => $a->id]), 'header');
        self::assertSame(200, $saved->getStatusCode());
        self::assertSame($a->id, $saved->getData(true)['data']['set_id']);
        self::assertEquals($b->header, $this->service->get('header', 'ko', $b->id));
        self::assertEquals($b->footer, $this->service->get('footer', 'ko', $b->id));
        $draftA = $this->service->get('header', 'ko', $a->id);
        self::assertSame($loaded->revision + 1, $draftA->revision);
        self::assertSame('Edited A', $draftA->document->blocks[0]['props']['brand_name']);

        $published = $controller->publish(Request::create('/site-parts/header/publish', 'POST', [
            'locale' => 'ko', 'set_id' => $a->id, 'expected_lock_version' => $draftA->lockVersion,
        ]), 'header');
        self::assertSame(200, $published->getStatusCode());
        self::assertSame($a->id, $published->getData(true)['data']['set_id']);
        self::assertSame($draftA->revision, $this->service->get('header', 'ko', $a->id)->activeRevision);
        self::assertEquals($b->header, $this->service->get('header', 'ko', $b->id));
        self::assertEquals($publishedB, $this->service->publishedSet('ko'));
    }

    public function test_draft_identity_fields_are_required_and_never_rewritten(): void
    {
        $set = $this->publishedSet('Identity');
        $header = $set->header->document->toArray();
        $wrongKind = $set->footer->document->toArray();
        $wrongKind['site_part_id'] = $header['site_part_id'];
        $wrongLocale = [...$header, 'locale' => 'en'];
        $missingId = $header;
        unset($missingId['site_part_id']);
        $before = $this->sourceState();
        $controller = new AdminSitePartController($this->service, new SiteShellService(new EloquentSiteShellAdapter));
        foreach ([$wrongKind, $wrongLocale, $missingId] as $payload) {
            $response = $controller->saveDraft(Request::create('/site-parts/header/draft', 'PUT', [
                'locale' => 'ko', 'set_id' => $set->id, 'title' => 'Identity',
                'expected_lock_version' => $set->header->lockVersion, 'document' => $payload,
            ]), 'header');
            self::assertSame(400, $response->getStatusCode());
            self::assertSame($before, $this->sourceState());
        }
    }

    public function test_legacy_envelope_get_is_lossless_but_save_and_publish_are_rejected(): void
    {
        $set = $this->publishedSet('Legacy');
        $current = $this->service->get('header', 'ko', $set->id);
        $payload = $current->document->toArray();
        $payload['blocks'][0]['instance_id'] = 'legacy-generated-id';
        $payload['blocks'][0]['block_version'] = 999;
        $json = json_encode($payload, JSON_THROW_ON_ERROR);
        $revision = $this->database->getConnection()->table('g7pb_site_part_revisions')->where('site_part_id', $current->document->sitePartId)->where('revision', $current->revision);
        $revision->update(['document_json' => $json]);
        $before = $this->service->publishedSet('ko');
        $controller = new AdminSitePartController($this->service, new SiteShellService(new EloquentSiteShellAdapter));
        $read = $controller->show(Request::create('/site-parts/header', 'GET', ['locale' => 'ko', 'set_id' => $set->id]), 'header');
        self::assertSame(200, $read->getStatusCode());
        self::assertSame($payload, $read->getData(true)['data']['document']);
        $save = $controller->saveDraft(Request::create('/site-parts/header', 'PUT', ['locale' => 'ko', 'set_id' => $set->id, 'title' => 'Legacy', 'expected_lock_version' => $current->lockVersion, 'document' => $payload]), 'header');
        self::assertSame(400, $save->getStatusCode());
        $publish = $controller->publish(Request::create('/site-parts/header/publish', 'POST', ['locale' => 'ko', 'set_id' => $set->id, 'expected_lock_version' => $current->lockVersion]), 'header');
        self::assertSame(422, $publish->getStatusCode());
        $setController = new AdminSitePartSetController($this->service, new SiteShellService(new EloquentSiteShellAdapter));
        $setPublish = $setController->publish(Request::create('/site-part-sets/'.$set->id.'/publish', 'POST', [
            'locale' => 'ko', 'header_expected_lock_version' => $current->lockVersion,
            'footer_expected_lock_version' => $set->footer->lockVersion,
        ]), $set->id);
        self::assertSame(422, $setPublish->getStatusCode());
        try {
            (new EloquentSitePartRepository)->saveDraft('Bypass', $this->service->get('header', 'ko', $set->id)->document, $current->lockVersion, null);
            self::fail('Recovered document bypassed strict repository writes.');
        } catch (\InvalidArgumentException) {
            self::assertSame($json, $revision->value('document_json'));
        }
        self::assertSame($current->lockVersion, $this->service->get('header', 'ko', $set->id)->lockVersion);
        self::assertEquals($before, $this->service->publishedSet('ko'));
    }

    public function test_upgrade_is_explicit_bounded_restartable_and_preserves_source_and_pointers(): void
    {
        $this->publishedSet('Upgrade');
        // Simulate a pre-upgrade database using fixture rows, then apply the additive migration.
        $migration = require dirname(__DIR__, 3).'/database/migrations/2026_09_02_000016_create_g7pb_site_part_artifacts_table.php';
        $migration->down();
        $before = $this->sourceState();
        $migration->up();
        self::assertSame(0, $this->database->getConnection()->table('g7pb_site_part_artifacts')->count());
        self::assertSame($before, $this->sourceState());
        $upgrade = new SitePartArtifactUpgrade($this->artifacts, new SitePartHtmlCompiler);
        // Artisan also asks the application about its console/test environment.
        $application = new Application(dirname(__DIR__, 3));
        $application->instance('env', 'testing');
        $application->instance(SitePartArtifactUpgrade::class, $upgrade);
        $command = new PrepareSitePartArtifactsCommand;
        $command->setLaravel($application);
        $tester = new CommandTester($command);
        self::assertSame(1, $tester->execute([]));
        self::assertSame(0, $this->database->getConnection()->table('g7pb_site_part_artifacts')->count());
        self::assertSame(1, $tester->execute(['--prepare' => true, '--limit' => '1']));
        self::assertSame(1, $upgrade->missingCount());
        self::assertSame($before, $this->sourceState());
        self::assertSame(0, $tester->execute(['--prepare' => true, '--limit' => '1']));
        self::assertSame(0, $tester->execute([]));
        self::assertSame(0, $upgrade->prepare(100));
        self::assertSame($before, $this->sourceState());
        self::assertTrue($this->service->publishedSet('ko')->isComplete());
    }

    public function test_stale_compiled_snapshot_cannot_replace_newer_publication(): void
    {
        $set = $this->publishedSet('Concurrency');
        $source = $this->service->get('header', 'ko', $set->id);
        $old = (new SitePartHtmlCompiler)->compile($source->document, $source->revision);
        $payload = $source->document->toArray();
        $payload['blocks'][0]['props']['brand_name'] = 'New revision';
        $draft = $this->service->saveDraft('header', 'ko', 'New', $payload, $source->lockVersion, null, $set->id);
        try {
            (new EloquentSitePartRepository)->publish($source->document->sitePartId, $draft->lockVersion, null, $old);
            self::fail('An older artifact was attached to a newer revision.');
        } catch (LockConflictException) {
            self::assertSame($source->revision, $this->service->publishedSet('ko')->header->sourceRevision);
        }
    }

    public function test_failure_on_second_artifact_rolls_back_the_whole_publication_pair(): void
    {
        $port = $this->createMock(SitePartArtifactPort::class);
        $port->expects(self::exactly(2))->method('store')->willReturnCallback(function (string $id, SitePartArtifact $artifact): void {
            if ($artifact->kind === 'footer') {
                throw new \RuntimeException('Fixture storage failure');
            }
            $this->artifacts->store($id, $artifact);
        });
        $service = new SitePartService(new EloquentSitePartRepository($port), new SitePartHtmlCompiler);
        $set = $service->createSet('Transaction', 'ko', SiteShell::defaults('ko'), null);
        $before = $this->sourceState();
        try {
            $service->publishSet($set->id, 'ko', 1, 1, null);
            self::fail('Second artifact failure did not stop publication.');
        } catch (\RuntimeException $exception) {
            self::assertSame('Fixture storage failure', $exception->getMessage());
            self::assertSame(0, $this->database->getConnection()->table('g7pb_site_part_artifacts')->count());
            self::assertSame($before, $this->sourceState());
        }
    }

    private function publishedSet(string $name, string $locale = 'ko'): SitePartSetSnapshot
    {
        $shell = SiteShell::fromArray($locale, ['brand_name' => $name, 'footer_text' => $name]);
        $set = $this->service->createSet($name, $locale, $shell, null);

        return $this->service->publishSet($set->id, $locale, $set->header->lockVersion, $set->footer->lockVersion, null);
    }

    private function sourceState(): array
    {
        return [
            $this->database->getConnection()->table('g7pb_site_parts')->orderBy('id')->get()->toJson(),
            $this->database->getConnection()->table('g7pb_site_part_revisions')->orderBy('id')->get()->toJson(),
        ];
    }
}
