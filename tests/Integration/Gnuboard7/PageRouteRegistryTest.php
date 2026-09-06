<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use App\Contracts\Extension\CacheInterface;
use App\Services\TemplateService;
use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\SiteShellPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminPageRouteController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\ViewerController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\PageBuilderPathOverride;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\DocumentRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PageRouteRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PublicationRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7PageRouteRegistry;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7TemplateRouteBridge;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\HttpFoundation\Response;

final class PageRouteRegistryTest extends TestCase
{
    private Capsule $db;

    private G7PageRouteRegistry $paths;

    /** @var list<array<string, mixed>> */
    private array $native = [['path' => '/'], ['path' => '*/board/:slug']];

    private string $id = '00000000-0000-4000-8000-000000000001';

    protected function setUp(): void
    {
        $this->db = new Capsule;
        $this->db->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'foreign_key_constraints' => true]);
        $this->db->setAsGlobal();
        $this->db->bootEloquent();
        $container = $this->db->getContainer();
        $container->instance('db', $this->db->getDatabaseManager());
        $container->instance('db.schema', $this->db->getConnection()->getSchemaBuilder());
        $container->instance('log', new NullLogger);
        $container->instance('validator', new Factory(new Translator(new ArrayLoader, 'ko'), $container));
        $response = $this->createStub(ResponseFactory::class);
        $response->method('json')->willReturnCallback(static fn (mixed $data = [], int $status = 200): JsonResponse => new JsonResponse($data, $status));
        $container->instance(ResponseFactory::class, $response);
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $file) {
            (require $file)->up();
        }
        (new EloquentPageBuilderRepository)->create('회사소개', new PageBuilderDocument($this->id, 'company', 'canvas', 'ko', [], []), 1);
        $templates = $this->createStub(TemplateService::class);
        $templates->method('getActiveTemplateIdentifier')->willReturn('sirsoft-basic');
        $templates->method('getRoutesDataWithModules')->willReturnCallback(fn (): array => ['success' => true, 'data' => ['routes' => $this->native]]);
        $this->paths = new G7PageRouteRegistry($templates);
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->db->getDatabaseManager()->disconnect();
    }

    public function test_container_resolves_the_route_registry_without_an_optional_null_fallback(): void
    {
        $container = new Container;
        $container->instance(PageBuilderService::class, new PageBuilderService(new EloquentPageBuilderRepository, $this->createStub(DocumentCompilerPort::class)));
        $container->instance(CacheInterface::class, $this->createMock(CacheInterface::class));
        $container->instance(TemplateService::class, $this->createStub(TemplateService::class));
        $bridge = $container->make(G7TemplateRouteBridge::class);
        $property = new \ReflectionProperty($bridge, 'pagePaths');
        self::assertInstanceOf(G7PageRouteRegistry::class, $property->getValue($bridge));
    }

    public function test_address_activates_only_for_last_successful_publication_and_keeps_its_slug(): void
    {
        $draft = $this->paths->assign($this->id, '/about', 0);
        self::assertFalse($draft['active']);
        self::assertNull($this->paths->publishedSlug('/about'));
        $this->publish();
        self::assertTrue($this->paths->get($this->id)['active']);
        self::assertSame('company', $this->paths->publishedSlug('/about'));
        DocumentRecord::query()->whereKey($this->id)->update(['slug' => 'draft-changed', 'lock_version' => 2]);
        self::assertSame('company', $this->paths->publishedSlug('/about'));
        $merged = $this->paths->merge($this->native);
        self::assertSame('/about', $merged[0]['path']);
        self::assertSame(['slug' => 'company'], $merged[0]['params']);
        self::assertSame($merged, $this->paths->merge($merged));
        // A failed/unfinished preparation does not replace the active pointer.
        $old = PublicationRecord::query()->firstOrFail();
        $prepared = $old->replicate();
        $prepared->id = '00000000-0000-4000-8000-000000000003';
        $prepared->status = 'prepared';
        $prepared->slug = 'draft-changed';
        $prepared->save();
        self::assertSame('company', $this->paths->publishedSlug('/about'));
        DocumentRecord::query()->whereKey($this->id)->update(['active_publication_id' => null]);
        self::assertNull($this->paths->publishedSlug('/about'));
        self::assertSame($this->native, $this->paths->merge($this->native));
    }

    public function test_stale_and_duplicate_updates_preserve_existing_assignment(): void
    {
        $this->paths->assign($this->id, '/about', 0);
        try {
            $this->paths->assign($this->id, '/wrong', 0);
            self::fail('Stale update accepted');
        } catch (\DomainException) {
            self::assertSame('/about', $this->paths->get($this->id)['path']);
        }
        $other = '00000000-0000-4000-8000-000000000004';
        (new EloquentPageBuilderRepository)->create('Other', new PageBuilderDocument($other, 'other', 'canvas', 'ko', [], []), 1);
        try {
            $this->paths->assign($other, '/about', 0);
            self::fail('Duplicate accepted');
        } catch (\DomainException) {
            self::assertNull($this->paths->get($other)['path']);
        }
        $removed = $this->paths->assign($this->id, null, 1);
        self::assertSame(2, $removed['lock_version']);
        self::assertNull($removed['path']);
        self::assertSame('/about', $this->paths->assign($other, '/about', 0)['path']);
        self::assertSame(1, PageRouteRecord::query()->whereKey($this->id)->count());
    }

    public function test_native_routes_win_when_added_after_assignment_and_archived_documents_stay_hidden(): void
    {
        $this->paths->assign($this->id, '/about', 0);
        $this->publish();
        $this->native[] = ['path' => '/about', 'layout' => 'native'];
        self::assertFalse($this->paths->get($this->id)['active']);
        self::assertNull($this->paths->publishedSlug('/about'));
        self::assertSame($this->native, $this->paths->merge($this->native));
        $this->native = [];
        DocumentRecord::query()->whereKey($this->id)->update(['archived_at' => new \DateTimeImmutable]);
        self::assertNull($this->paths->publishedSlug('/about'));
        $this->expectException(\DomainException::class);
        $this->paths->assign($this->id, '/renamed', 1);
    }

    public function test_dynamic_native_route_is_rejected_without_a_new_row(): void
    {
        $this->expectException(\DomainException::class);
        try {
            $this->paths->assign($this->id, '/board/news', 0);
        } finally {
            self::assertSame(0, PageRouteRecord::query()->count());
        }
    }

    public function test_independent_shell_is_not_silently_rendered_inside_native_template(): void
    {
        $this->paths->assign($this->id, '/about', 0);
        $this->publish();
        PublicationRecord::query()->update(['shell_mode' => 'builder']);
        self::assertFalse($this->paths->get($this->id)['active']);
        self::assertNull($this->paths->publishedSlug('/about'));
    }

    public function test_http_contract_rejects_stale_or_invalid_requests_and_invalidates_after_success(): void
    {
        $pages = new PageBuilderService(new EloquentPageBuilderRepository, $this->createStub(DocumentCompilerPort::class));
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturn(1);
        $cache->expects(self::once())->method('put');
        $bridge = new G7TemplateRouteBridge($pages, $cache, $this->paths);
        $controller = new AdminPageRouteController($this->paths, $bridge);
        self::assertSame(422, $controller->update(Request::create('/', 'PUT', ['path' => '/about']), $this->id)->getStatusCode());
        self::assertSame(200, $controller->update(Request::create('/', 'PUT', ['path' => '/about', 'expected_lock_version' => 0]), $this->id)->getStatusCode());
        self::assertSame(409, $controller->update(Request::create('/', 'PUT', ['path' => '/wrong', 'expected_lock_version' => 0]), $this->id)->getStatusCode());
        self::assertSame('/about', $controller->show(Request::create('/'), $this->id)->getData(true)['data']['path']);
        $this->publish();
        self::assertSame('/about', $bridge->filterHomeRoute($this->native, 'user')[0]['path']);
        self::assertSame($this->native, $bridge->filterHomeRoute($this->native, 'admin'));
    }

    public function test_path_middleware_leaves_post_system_and_unpublished_requests_to_g7(): void
    {
        $pages = new PageBuilderService(new EloquentPageBuilderRepository, $this->createStub(DocumentCompilerPort::class));
        $viewer = new ViewerController($pages, new SiteShellService($this->createStub(SiteShellPort::class)),
            new SitePartService($this->createStub(SitePartRepository::class), new SitePartHtmlCompiler));
        $middleware = new PageBuilderPathOverride($this->paths, $viewer);
        $this->paths->assign($this->id, '/about', 0);
        foreach ([['/about', 'POST'], ['/admin/users', 'GET'], ['/about', 'GET']] as [$path, $method]) {
            $next = new Response('native', 204);
            self::assertSame($next, $middleware->handle(Request::create($path, $method), static fn (): Response => $next));
        }
    }

    public function test_route_registration_requires_existing_admin_read_and_manage_permissions(): void
    {
        $container = $this->db->getContainer();
        $router = new Router(new Dispatcher($container), $container);
        $container->instance('router', $router);
        $routeFiles = glob(dirname(__DIR__, 3).'/src/routes/api.php') ?: [];
        self::assertCount(1, $routeFiles);
        foreach ($routeFiles as $file) {
            require $file;
        }
        $router->getRoutes()->refreshNameLookups();
        $show = $router->getRoutes()->getByName('admin.documents.path.show');
        $update = $router->getRoutes()->getByName('admin.documents.path.update');
        self::assertNotNull($show);
        self::assertNotNull($update);
        self::assertContains('auth:sanctum', $update->gatherMiddleware());
        self::assertContains('permission:admin,jiwonpapa-page_builder.documents.manage', $update->gatherMiddleware());
        self::assertContains('permission:admin,jiwonpapa-page_builder.documents.read', $show->gatherMiddleware());
        self::assertSame(['PUT'], $update->methods());
    }

    private function publish(): void
    {
        $publication = '00000000-0000-4000-8000-000000000002';
        PublicationRecord::query()->create(['id' => $publication, 'document_id' => $this->id, 'source_revision' => 1,
            'title' => '회사소개', 'slug' => 'company', 'locale' => 'ko', 'shell_mode' => 'template',
            'compiler_version' => '1.0.0', 'target_engine_version' => '1.0.0', 'artifact' => '<p>Published</p>',
            'artifact_sha256' => hash('sha256', '<p>Published</p>'), 'status' => 'active', 'published_at' => new \DateTimeImmutable]);
        DocumentRecord::query()->whereKey($this->id)->update(['active_publication_id' => $publication]);
    }
}
