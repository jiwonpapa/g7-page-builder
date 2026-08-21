<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory as ResponseFactoryContract;
use Illuminate\Contracts\Routing\UrlGenerator as UrlGeneratorContract;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\RouteCollection;
use Illuminate\Routing\UrlGenerator;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Fluent;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\PublicationCommitException;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminDocumentController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSiteShellController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\FormSubmissionController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\PublicPageController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\ViewerController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\PageBuilderHomeOverride;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockFavoriteAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSiteShellAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\FormSubmissionRecord;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

final class PublicationPersistenceTest extends TestCase
{
    use CreatesBuiltInCompiler;

    private Capsule $database;

    protected function setUp(): void
    {
        parent::setUp();

        $this->database = new Capsule;
        $this->database->addConnection([
            'driver' => 'sqlite',
            'database' => ':memory:',
            'foreign_key_constraints' => true,
        ]);
        $this->database->setAsGlobal();
        $this->database->bootEloquent();
        $container = $this->database->getContainer();
        $container->instance('db', $this->database->getDatabaseManager());
        $container->instance('db.schema', $this->database->getConnection()->getSchemaBuilder());
        $container->instance('log', new NullLogger);
        $config = $container->make('config');
        self::assertInstanceOf(Fluent::class, $config);
        $config->set('g7-page-builder.forms', [
            'recipient' => null,
            'ip_hash_key' => 'test-form-hash-key',
            'minimum_fill_seconds' => 1,
        ]);
        $container->instance(
            UrlGeneratorContract::class,
            new UrlGenerator(new RouteCollection, Request::create('https://g7pb.test')),
        );
        $responseFactory = $this->createStub(ResponseFactoryContract::class);
        $responseFactory->method('json')->willReturnCallback(
            static fn (
                mixed $data = [],
                int $status = 200,
                array $headers = [],
                int $options = 0,
            ): JsonResponse => new JsonResponse($data, $status, $headers, $options),
        );
        $responseFactory->method('view')->willReturnCallback(
            static fn (
                string $view,
                array $data = [],
                int $status = 200,
                array $headers = [],
            ): Response => new Response($view, $status, $headers),
        );
        $responseFactory->method('make')->willReturnCallback(
            static fn (
                mixed $content = '',
                int $status = 200,
                array $headers = [],
            ): Response => new Response($content, $status, $headers),
        );
        $container->instance(ResponseFactoryContract::class, $responseFactory);
        $container->instance(
            'validator',
            new ValidationFactory(new Translator(new ArrayLoader, 'ko'), $container),
        );
        Container::setInstance($container);
        Facade::setFacadeApplication($container);

        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $migrationFile) {
            $migration = require $migrationFile;
            $migration->up();
        }
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

    public function test_global_site_shell_uses_cas_locking_and_published_pages_snapshot_the_shell_mode(): void
    {
        $siteShell = new SiteShellService(new EloquentSiteShellAdapter);
        $initial = $siteShell->get('ko');
        self::assertSame(0, $initial->lockVersion);

        $saved = $siteShell->save('ko', [
            'brand_name' => '지원소프트',
            'logo_url' => '',
            'home_url' => '/',
            'header_variant' => 'solid',
            'sticky' => true,
            'navigation' => [['label' => '소개', 'url' => '/pages/about']],
            'cta' => ['label' => '문의', 'url' => '/pages/contact'],
            'footer_text' => '지원소프트',
            'show_footer_navigation' => true,
        ], 0, 1);
        self::assertSame(1, $saved->lockVersion);
        self::assertSame('지원소프트', $siteShell->get('ko')->shell->brandName);

        try {
            $siteShell->save('ko', $saved->shell->toArray(), 0, 2);
            self::fail('A stale site shell write must fail.');
        } catch (LockConflictException $exception) {
            self::assertSame(1, $exception->currentLockVersion);
        }

        $pages = new PageBuilderService(new EloquentPageBuilderRepository, $this->builtInCompiler());
        $intro = $pages->create('인트로', 'shell-free-intro', 'ko', null, 'none');
        $candidate = $pages->preparePublication($intro->document->documentId, $intro->lockVersion, null);
        $published = $pages->commitPublication($candidate->token);
        self::assertSame('none', $published->shellMode);
        self::assertSame('none', $pages->findPublished('shell-free-intro')?->shellMode);
    }

    public function test_site_shell_api_accepts_an_empty_menu_logo_and_footer(): void
    {
        $controller = new AdminSiteShellController($this->siteShellService());
        $response = $controller->update(Request::create('/site-shell', 'PUT', [
            'locale' => 'ko',
            'expected_lock_version' => 0,
            'brand_name' => '메뉴 없는 사이트',
            'logo_url' => null,
            'home_url' => '/',
            'header_variant' => 'solid',
            'sticky' => true,
            'navigation' => [],
            'cta' => null,
            'footer_text' => null,
            'show_footer_navigation' => true,
        ]));

        self::assertSame(200, $response->getStatusCode());
        $payload = $response->getData(true);
        self::assertTrue($payload['success']);
        self::assertSame([], $payload['data']['navigation']);
        self::assertSame('', $payload['data']['logo_url']);
        self::assertSame('', $payload['data']['footer_text']);
    }

    public function test_site_parts_bootstrap_from_legacy_shell_and_publish_independent_revisions(): void
    {
        $shells = $this->siteShellService();
        $savedShell = $shells->save('ko', [
            'brand_name' => '지원소프트',
            'logo_url' => '/storage/brand.webp',
            'home_url' => '/',
            'header_variant' => 'transparent',
            'sticky' => true,
            'navigation' => [['label' => '소개', 'url' => '/pages/about']],
            'cta' => ['label' => '문의', 'url' => '/pages/contact'],
            'footer_text' => 'Copyright',
            'show_footer_navigation' => true,
        ], 0, 1);
        $siteParts = new SitePartService(new EloquentSitePartRepository, new SitePartHtmlCompiler);

        $header = $siteParts->bootstrap('header', 'ko', $savedShell->shell, 1);
        $footer = $siteParts->bootstrap('footer', 'ko', $savedShell->shell, 1);

        self::assertSame('site.header.navigation-01', $header->document->blocks[0]['type']);
        self::assertSame('지원소프트', $header->document->blocks[0]['props']['brand_name']);
        self::assertSame('site.footer.simple-01', $footer->document->blocks[0]['type']);
        self::assertSame(1, $header->revision);
        self::assertNull($header->activeRevision);

        $document = $header->document->toArray();
        $document['blocks'][] = [
            'instance_id' => '00000000-0000-4000-8000-000000000099',
            'type' => 'site.header.announcement-01',
            'block_version' => 1,
            'props' => ['text' => '새 소식', 'link_label' => '보기', 'link_url' => '/pages/news'],
            'slots' => [],
        ];
        $draft = $siteParts->saveDraft('header', 'ko', '메인 Header', $document, $header->lockVersion, 2);
        self::assertSame(2, $draft->revision);
        self::assertSame(2, $draft->lockVersion);
        self::assertTrue($draft->hasUnpublishedChanges());

        $published = $siteParts->publish('header', 'ko', $draft->lockVersion, 2);
        self::assertSame(2, $published->activeRevision);
        self::assertSame(3, $published->lockVersion);
        self::assertFalse($published->hasUnpublishedChanges());
        self::assertNotNull($published->publishedAt);
        self::assertSame(2, $siteParts->published('header', 'ko')?->revision);
        self::assertCount(2, $siteParts->revisions('header', 'ko'));
        self::assertSame('메인 Header', $siteParts->revisions('header', 'ko')[0]->title);

        $idempotent = $siteParts->bootstrap('header', 'ko', $savedShell->shell, 3);
        self::assertSame($published->document->sitePartId, $idempotent->document->sitePartId);
        self::assertSame(2, $idempotent->revision);
    }

    public function test_published_metadata_and_public_slug_do_not_follow_later_draft_changes(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('발행 제목', 'published-page', 'ko', null);
        $draft = $service->saveDraft(
            $created->document->documentId,
            $this->documentPayload($created->document->documentId, 'published-page', 'ko'),
            $created->lockVersion,
            null,
        );

        $candidate = $service->preparePublication(
            $draft->document->documentId,
            $draft->lockVersion,
            null,
        );
        $published = $service->commitPublication($candidate->token);
        $changedDraft = $service->updateMetadata(
            $draft->document->documentId,
            '변경된 초안 제목',
            'changed-draft-page',
            'en',
            $draft->lockVersion,
            null,
        );

        $stillPublished = $service->findPublished('published-page');

        self::assertNotNull($stillPublished);
        self::assertSame('발행 제목', $stillPublished->title);
        self::assertSame('published-page', $stillPublished->slug);
        self::assertSame('ko', $stillPublished->locale);
        self::assertSame($published->artifactSha256, $stillPublished->artifactSha256);
        self::assertNull($service->findPublished('changed-draft-page'));
        self::assertSame('변경된 초안 제목', $changedDraft->title);
        self::assertSame('changed-draft-page', $changedDraft->document->slug);
        self::assertSame('published-page', $changedDraft->activePublicSlug);
        self::assertSame($published->artifactSha256, $changedDraft->activeArtifactSha256);

        $responseData = $this->snapshotData($service, $changedDraft);
        self::assertSame('변경된 초안 제목', $responseData['title']);
        self::assertSame(
            'https://g7pb.test/pages/published-page',
            $responseData['public_url'],
        );
    }

    public function test_duplicate_is_a_fresh_draft_without_publication_home_or_revision_history(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('원본 문서', 'duplicate-source', 'ko', null, 'none');
        $draft = $service->saveDraft(
            $created->document->documentId,
            $this->documentPayload($created->document->documentId, 'duplicate-source', 'ko'),
            $created->lockVersion,
            null,
        );
        $candidate = $service->preparePublication(
            $draft->document->documentId,
            $draft->lockVersion,
            null,
        );
        $service->commitPublication($candidate->token);
        $source = $service->setHome(
            $draft->document->documentId,
            true,
            $service->get($draft->document->documentId)->lockVersion,
            null,
        );

        $copy = $service->duplicate(
            $source->document->documentId,
            '원본 문서 복사본',
            'duplicate-source-copy',
            $source->lockVersion,
            null,
        );

        self::assertNotSame($source->document->documentId, $copy->document->documentId);
        self::assertSame('원본 문서 복사본', $copy->title);
        self::assertSame('duplicate-source-copy', $copy->document->slug);
        self::assertSame($source->document->locale, $copy->document->locale);
        self::assertSame($source->document->tokens, $copy->document->tokens);
        self::assertSame($source->document->blocks, $copy->document->blocks);
        self::assertSame($source->document->shellMode, $copy->document->shellMode);
        self::assertSame(1, $copy->lockVersion);
        self::assertSame(1, $copy->revision);
        self::assertCount(1, $service->revisions($copy->document->documentId));
        self::assertNull($copy->activeArtifactSha256);
        self::assertNull($copy->activePublicSlug);
        self::assertNull($copy->publishedAt);
        self::assertFalse($copy->isHome);
        self::assertNotNull($service->findPublished('duplicate-source'));
        self::assertNull($service->findPublished('duplicate-source-copy'));
    }

    public function test_published_page_uses_clean_url_and_legacy_url_redirects_permanently(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('검색 친화 주소', 'clean-route', 'ko', null);
        $candidate = $service->preparePublication(
            $created->document->documentId,
            $created->lockVersion,
            null,
        );
        $service->commitPublication($candidate->token);
        $viewer = $this->viewer($service);

        $response = $viewer->show(Request::create('/pages/clean-route'), 'clean-route');
        $legacy = $viewer->legacy('clean-route');

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(301, $legacy->getStatusCode());
        self::assertSame('https://g7pb.test/pages/clean-route', $legacy->getTargetUrl());
    }

    public function test_only_a_published_page_can_be_the_single_home_page(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $first = $service->create('첫 홈', 'first-home', 'ko', null);
        $second = $service->create('둘째 홈', 'second-home', 'ko', null);

        try {
            $service->setHome($first->document->documentId, true, $first->lockVersion, null);
            self::fail('An unpublished document must not become the home page.');
        } catch (PublicationCommitException) {
            self::assertNull($service->findPublishedHome());
        }

        $firstCandidate = $service->preparePublication($first->document->documentId, $first->lockVersion, null);
        $service->commitPublication($firstCandidate->token);
        $firstHome = $service->setHome($first->document->documentId, true, $first->lockVersion, null);
        self::assertTrue($firstHome->isHome);
        self::assertSame('first-home', $service->findPublishedHome()?->slug);

        $secondCandidate = $service->preparePublication($second->document->documentId, $second->lockVersion, null);
        $service->commitPublication($secondCandidate->token);
        $secondHome = $service->setHome($second->document->documentId, true, $second->lockVersion, null);

        self::assertTrue($secondHome->isHome);
        self::assertFalse($service->get($first->document->documentId)->isHome);
        self::assertSame('second-home', $service->findPublishedHome()?->slug);

        $unpublished = $service->unpublish(
            $secondHome->document->documentId,
            $secondHome->lockVersion,
            null,
        );
        self::assertFalse($unpublished->isHome);
        self::assertNull($service->findPublishedHome());
    }

    public function test_home_override_is_opt_in_and_falls_through_without_an_assignment(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $middleware = new PageBuilderHomeOverride($service, $this->siteShellService());
        $fallback = static fn (): Response => new Response('g7-home', 200);

        $before = $middleware->handle(Request::create('/', 'GET'), $fallback);
        self::assertSame('g7-home', $before->getContent());

        $created = $service->create('인트로 홈', 'intro-home', 'ko', null);
        $candidate = $service->preparePublication($created->document->documentId, $created->lockVersion, null);
        $service->commitPublication($candidate->token);
        $home = $service->setHome($created->document->documentId, true, $created->lockVersion, null);
        self::assertTrue($home->isHome);

        $after = $middleware->handle(Request::create('/', 'GET'), $fallback);
        self::assertSame(200, $after->getStatusCode());
        self::assertSame('app', $after->getContent());
        self::assertStringContainsString('no-cache', (string) $after->headers->get('Cache-Control'));

        $nonRoot = $middleware->handle(Request::create('/admin', 'GET'), $fallback);
        self::assertSame('g7-home', $nonRoot->getContent());
    }

    public function test_prepare_maps_an_active_public_slug_collision_to_the_canonical_409_code(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $owner = $service->create('공개 소유자', 'reserved-public-slug', 'ko', null);
        $candidate = $service->preparePublication(
            $owner->document->documentId,
            $owner->lockVersion,
            null,
        );
        $service->commitPublication($candidate->token);
        $service->updateMetadata(
            $owner->document->documentId,
            '공개 소유자 초안',
            'owner-draft-slug',
            'ko',
            $owner->lockVersion,
            null,
        );

        $contender = $service->create('충돌 후보', 'contender-draft-slug', 'ko', null);
        $contender = $service->updateMetadata(
            $contender->document->documentId,
            '충돌 후보',
            'reserved-public-slug',
            'ko',
            $contender->lockVersion,
            null,
        );
        $request = Request::create('/prepare', 'POST', [
            'expected_lock_version' => $contender->lockVersion,
        ]);

        $response = (new AdminDocumentController($service))->preparePublication(
            $request,
            $contender->document->documentId,
        );
        /** @var array<string, mixed> $payload */
        $payload = $response->getData(true);

        self::assertSame(409, $response->getStatusCode());
        self::assertFalse($payload['success']);
        self::assertSame('G7PB_PUBLIC_SLUG_CONFLICT', $payload['data']['code']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{24}$/', $payload['data']['correlation_id']);
    }

    public function test_preview_ticket_can_be_reopened_until_it_expires(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('반복 미리보기', 'repeatable-preview', 'ko', null);
        $draft = $service->saveDraft(
            $created->document->documentId,
            $this->documentPayload($created->document->documentId, 'repeatable-preview', 'ko'),
            $created->lockVersion,
            null,
        );
        $ticket = $service->preview($draft->document->documentId, $draft->lockVersion, null);

        $first = $service->renderPreview($ticket->token);
        $second = $service->renderPreview($ticket->token);

        self::assertNotNull($first);
        self::assertNotNull($second);
        self::assertSame($first->artifactSha256, $second->artifactSha256);
    }

    public function test_historical_revision_preview_and_restore_create_a_new_draft_without_changing_publication(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('리비전 복구', 'revision-origin', 'ko', null);
        $original = $service->saveDraft(
            $created->document->documentId,
            $this->documentPayload($created->document->documentId, 'revision-origin', 'ko'),
            $created->lockVersion,
            null,
        );
        $candidate = $service->preparePublication(
            $original->document->documentId,
            $original->lockVersion,
            null,
        );
        $published = $service->commitPublication($candidate->token);
        $changed = $service->updateMetadata(
            $original->document->documentId,
            '현재 문서 제목',
            'revision-changed',
            'en',
            $original->lockVersion,
            null,
        );

        $history = $service->revisions($changed->document->documentId);
        self::assertSame([3, 2, 1], array_map(
            static fn (DocumentRevision $revision): int => $revision->revision,
            $history,
        ));

        $ticket = $service->previewRevision($changed->document->documentId, 2, null);
        $historicalPreview = $service->renderPreview($ticket->token);
        self::assertNotNull($historicalPreview);
        self::assertSame('리비전 복구', $historicalPreview->title);
        self::assertSame('revision-origin', $historicalPreview->slug);

        $restored = $service->restoreRevision(
            $changed->document->documentId,
            2,
            $changed->lockVersion,
            null,
        );

        self::assertSame(4, $restored->revision);
        self::assertSame('revision-origin', $restored->document->slug);
        self::assertSame('ko', $restored->document->locale);
        self::assertSame('리비전 복구', $restored->title);
        self::assertSame($published->artifactSha256, $restored->activeArtifactSha256);
        self::assertSame('revision-origin', $restored->activePublicSlug);

        $unpublished = $service->unpublish(
            $restored->document->documentId,
            $restored->lockVersion,
            null,
        );
        self::assertNull($unpublished->activeArtifactSha256);
        self::assertNull($unpublished->activePublicSlug);
        self::assertNull($service->findPublished('revision-origin'));
        self::assertCount(4, $service->revisions($unpublished->document->documentId));
    }

    public function test_unpublish_invalidates_every_prepared_publication_candidate(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('공개해제 안전성', 'unpublish-safety', 'ko', null);
        $draft = $service->saveDraft(
            $created->document->documentId,
            $this->documentPayload($created->document->documentId, 'unpublish-safety', 'ko'),
            $created->lockVersion,
            null,
        );
        $firstCandidate = $service->preparePublication(
            $draft->document->documentId,
            $draft->lockVersion,
            null,
        );
        $service->commitPublication($firstCandidate->token);
        $staleCandidate = $service->preparePublication(
            $draft->document->documentId,
            $draft->lockVersion,
            null,
        );
        $unpublished = $service->unpublish(
            $draft->document->documentId,
            $draft->lockVersion,
            null,
        );

        self::assertNull($service->findPublished('unpublish-safety'));
        self::assertSame($draft->lockVersion + 1, $unpublished->lockVersion);

        try {
            $service->commitPublication($staleCandidate->token);
            self::fail('A candidate prepared before unpublish must never become active.');
        } catch (LockConflictException $exception) {
            self::assertSame($unpublished->lockVersion, $exception->currentLockVersion);
        }

        self::assertNull($service->findPublished('unpublish-safety'));
    }

    public function test_public_responses_must_revalidate_before_serving_a_cached_artifact(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('캐시 안전성', 'cache-safety', 'ko', null, 'builder');
        $candidate = $service->preparePublication(
            $created->document->documentId,
            $created->lockVersion,
            null,
        );
        $published = $service->commitPublication($candidate->token);

        $viewer = $this->viewer($service);
        $viewerResponse = $viewer->show(Request::create('/cache-safety'), 'cache-safety');
        $notModifiedRequest = Request::create('/cache-safety');
        $notModifiedRequest->headers->set('If-None-Match', (string) $viewerResponse->headers->get('ETag'));
        $notModifiedResponse = $viewer->show($notModifiedRequest, 'cache-safety');
        $apiResponse = (new PublicPageController($service))->show('cache-safety');

        foreach ([$viewerResponse, $notModifiedResponse, $apiResponse] as $response) {
            $cacheControl = (string) $response->headers->get('Cache-Control');
            self::assertStringContainsString('public', $cacheControl);
            self::assertStringContainsString('no-cache', $cacheControl);
            self::assertStringContainsString('must-revalidate', $cacheControl);
            self::assertStringNotContainsString('max-age', $cacheControl);
            self::assertStringNotContainsString('stale-while-revalidate', $cacheControl);
        }
        $contentSecurityPolicy = (string) $viewerResponse->headers->get('Content-Security-Policy');
        self::assertStringContainsString("script-src 'self'", $contentSecurityPolicy);
        self::assertStringNotContainsString("'unsafe-eval'", $contentSecurityPolicy);
        self::assertStringNotContainsString("script-src 'self' 'unsafe-inline'", $contentSecurityPolicy);
        self::assertSame(304, $notModifiedResponse->getStatusCode());
    }

    public function test_metadata_only_republish_changes_the_representation_etag(): void
    {
        $service = new PageBuilderService(
            new EloquentPageBuilderRepository,
            $this->builtInCompiler(),
        );
        $created = $service->create('첫 제목', 'etag-metadata', 'ko', null);
        $firstCandidate = $service->preparePublication(
            $created->document->documentId,
            $created->lockVersion,
            null,
        );
        $first = $service->commitPublication($firstCandidate->token);
        $changed = $service->updateMetadata(
            $created->document->documentId,
            '바뀐 제목',
            'etag-metadata',
            'en',
            $created->lockVersion,
            null,
        );
        $secondCandidate = $service->preparePublication(
            $changed->document->documentId,
            $changed->lockVersion,
            null,
        );
        $second = $service->commitPublication($secondCandidate->token);

        self::assertSame($first->artifactSha256, $second->artifactSha256);
        self::assertNotSame($first->representationSha256(), $second->representationSha256());
    }

    public function test_archive_hides_publication_and_purge_requires_archived_slug_confirmation(): void
    {
        $repository = new EloquentPageBuilderRepository;
        $service = new PageBuilderService($repository, $this->builtInCompiler());
        $created = $service->create('보관 테스트', 'archive-test', 'ko', null);
        $candidate = $service->preparePublication($created->document->documentId, $created->lockVersion, null);
        $service->commitPublication($candidate->token);

        $archived = $service->archive($created->document->documentId, $created->lockVersion, null);
        self::assertNotNull($archived->archivedAt);
        self::assertNull($archived->activePublicSlug);
        self::assertNull($service->findPublished('archive-test'));
        self::assertSame(0, $service->paginate(1, 20, 'active')['total']);
        self::assertSame(1, $service->paginate(1, 20, 'archived')['total']);

        try {
            $service->purge($created->document->documentId, $archived->lockVersion, 'wrong-slug');
            self::fail('Typed confirmation mismatch was accepted.');
        } catch (\DomainException) {
            self::assertNotNull($service->get($created->document->documentId));
        }

        $service->purge($created->document->documentId, $archived->lockVersion, 'archive-test');
        self::assertNull($repository->find($created->document->documentId));
    }

    public function test_block_pack_installation_state_and_actor_favorites_use_module_owned_tables(): void
    {
        $manifestJson = file_get_contents(dirname(__DIR__, 2).'/Contract/block-pack-data-v1.fixture.json');
        self::assertIsString($manifestJson);
        $manifest = BlockPackManifest::fromJson($manifestJson);
        $now = new \DateTimeImmutable('2026-08-20T00:00:00Z');
        $repository = new EloquentBlockPackRepository;
        $installation = new BlockPackInstallation(
            manifest: $manifest,
            state: BlockPackState::Staged,
            source: 'local',
            sourceReference: '/var/lib/g7pb/packs/marketing-presets/1.0.0',
            sourceUri: null,
            archiveSha256: str_repeat('a', 64),
            installedAt: $now,
            installedBy: 7,
            updatedAt: $now,
        );
        $repository->save($installation);
        $repository->save($installation->withState(BlockPackState::Enabled, $now->modify('+1 minute')));

        self::assertSame(BlockPackState::Enabled, $repository->find($manifest->packId, $manifest->packVersion)?->state);
        self::assertSame($manifest->packVersion, $repository->enabled($manifest->packId)?->manifest->packVersion);

        $favorites = new EloquentBlockFavoriteAdapter;
        $favorites->setFavorite(7, 'preset:jiwonpapa/marketing-presets:hero.launch-blue', true);
        self::assertSame(['preset:jiwonpapa/marketing-presets:hero.launch-blue'], $favorites->blockIdsFor(7));
        $favorites->setFavorite(7, 'preset:jiwonpapa/marketing-presets:hero.launch-blue', false);
        self::assertSame([], $favorites->blockIdsFor(7));
    }

    public function test_published_inquiry_is_stored_before_mail_delivery_and_managed_from_the_admin_inbox(): void
    {
        $service = new PageBuilderService(new EloquentPageBuilderRepository, $this->builtInCompiler());
        $created = $service->create('문의 페이지', 'inquiry-page', 'ko', null);
        $payload = $created->document->toArray();
        $payload['blocks'] = [[
            'instance_id' => '00000000-0000-4000-8000-000000000094',
            'type' => 'form.inquiry-01',
            'block_version' => 1,
            'props' => [
                'eyebrow' => 'CONTACT', 'heading' => '문의하세요', 'description' => '답변을 드립니다.',
                'formKind' => 'inquiry', 'submitLabel' => '문의 보내기', 'successMessage' => '접수되었습니다.',
                'privacyLabel' => '개인정보 수집에 동의합니다.', 'showPhone' => true, 'showSubject' => true,
            ],
            'slots' => [],
        ]];
        $draft = $service->saveDraft($created->document->documentId, $payload, $created->lockVersion, null);
        $candidate = $service->preparePublication($draft->document->documentId, $draft->lockVersion, null);
        $service->commitPublication($candidate->token);
        $controller = new FormSubmissionController($service);
        $request = Request::create('/pages/inquiry-page/inquiries', 'POST', [
            'block_instance_id' => '00000000-0000-4000-8000-000000000094',
            'form_kind' => 'inquiry',
            'name' => '홍길동',
            'email' => 'hello@example.com',
            'phone' => '010-1234-5678',
            'subject' => '도입 문의',
            'message' => '서비스 도입을 문의합니다.',
            'privacy' => '1',
            'website' => '',
            'started_at' => time() - 2,
        ], [], [], ['REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'G7PB test']);

        $stored = $controller->store($request, 'inquiry-page');
        self::assertSame(201, $stored->getStatusCode());
        $submissionId = (string) $stored->getData(true)['data']['submission_id'];
        $record = FormSubmissionRecord::query()->findOrFail($submissionId);
        self::assertSame('unread', $record->status);
        self::assertSame('failed', $record->mail_status);
        self::assertSame(1, $record->mail_attempts);
        self::assertNotSame('127.0.0.1', $record->ip_hash);

        $index = $controller->index(Request::create('/admin/inquiries', 'GET'));
        self::assertSame($submissionId, $index->getData(true)['data']['items'][0]['id']);
        $updated = $controller->update(Request::create('/admin/inquiries/'.$submissionId, 'PATCH', ['status' => 'read']), $submissionId);
        self::assertSame('read', $updated->getData(true)['data']['status']);
        $retried = $controller->retry($submissionId);
        self::assertSame(2, $retried->getData(true)['data']['mail_attempts']);
        self::assertStringContainsString('보존', $retried->getData(true)['message']);
    }

    /**
     * @return array<string, mixed>
     */
    private function documentPayload(string $documentId, string $slug, string $locale): array
    {
        return [
            'schema_version' => 'g7-page-builder/v1',
            'document_id' => $documentId,
            'slug' => $slug,
            'mode' => 'canvas',
            'locale' => $locale,
            'tokens' => [],
            'blocks' => [
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000002',
                    'type' => 'content.hero-centered-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => '새 소식',
                        'title' => '페이지 빌더',
                        'body' => '<p>발행된 <strong>본문</strong></p>',
                        'primaryCta' => ['label' => '시작하기', 'url' => '/start'],
                        'image' => ['src' => '/hero.jpg', 'alt' => '제품 화면'],
                        'alignment' => 'center',
                    ],
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000003',
                    'type' => 'content.features-grid-01',
                    'block_version' => 1,
                    'props' => [
                        'title' => '주요 기능',
                        'items' => [
                            ['icon' => 'sparkles', 'title' => '빠른 제작', 'body' => '블록으로 제작합니다.'],
                            ['icon' => 'shield', 'title' => '안전한 발행', 'body' => '정상 발행본을 유지합니다.'],
                        ],
                    ],
                    'slots' => [],
                ],
            ],
        ];
    }

    private function siteShellService(): SiteShellService
    {
        return new SiteShellService(new EloquentSiteShellAdapter);
    }

    private function viewer(PageBuilderService $service): ViewerController
    {
        return new ViewerController(
            $service,
            $this->siteShellService(),
            new SitePartService(new EloquentSitePartRepository, new SitePartHtmlCompiler),
            new SitePartHtmlCompiler,
        );
    }

    /**
     * @return array{title: string, document: array<string, mixed>, lock_version: int, revision: int, public_url: string|null, active_artifact_sha256: string|null}
     */
    private function snapshotData(PageBuilderService $service, DocumentSnapshot $snapshot): array
    {
        $controller = new AdminDocumentController($service);
        $method = new \ReflectionMethod($controller, 'snapshotData');

        /** @var array{title: string, document: array<string, mixed>, lock_version: int, revision: int, public_url: string|null, active_artifact_sha256: string|null} $data */
        $data = $method->invoke($controller, $snapshot);

        return $data;
    }
}
