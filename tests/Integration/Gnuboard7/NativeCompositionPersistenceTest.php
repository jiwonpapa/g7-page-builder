<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Facade;
use Modules\Jiwonpapa\PageBuilder\Application\Compositions\NativeCompositionService;
use Modules\Jiwonpapa\PageBuilder\Domain\Compositions\NativeComposition;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminNativeCompositionController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentNativeCompositionRepository;
use PHPUnit\Framework\TestCase;

final class NativeCompositionPersistenceTest extends TestCase
{
    private Capsule $db;

    protected function setUp(): void
    {
        $this->db = new Capsule;
        $this->db->addConnection(['driver' => 'sqlite', 'database' => ':memory:']);
        $this->db->setAsGlobal();
        $this->db->bootEloquent();
        $container = $this->db->getContainer();
        $container->instance('db', $this->db->getDatabaseManager());
        $container->instance('db.schema', $this->db->getConnection()->getSchemaBuilder());
        $response = $this->createStub(ResponseFactory::class);
        $response->method('json')->willReturnCallback(static fn (mixed $data = [], int $status = 200): JsonResponse => new JsonResponse($data, $status));
        $container->instance(ResponseFactory::class, $response);
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        (require dirname(__DIR__, 3).'/database/migrations/2026_09_08_000019_create_g7pb_native_compositions_table.php')->up();
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->db->getDatabaseManager()->disconnect();
    }

    public function test_actual_storage_preserves_bytes_and_isolates_users(): void
    {
        $service = new NativeCompositionService(new EloquentNativeCompositionRepository);
        $payload = '{"schema_version":"g7.editor-composition/v1","templateIdentifier":"sirsoft-basic","layoutName":"about","scope":"template","signature":"'.str_repeat('a', 64).'","node":{"id":"original","future":{},"items":[]}}';
        $item = $service->create(7, NativeComposition::SCHEMA_VERSION, '소개', $payload);
        self::assertSame($payload, $service->find(7, $item->id)->snapshot);
        self::assertSame([], $service->page(9, 1)['items']);
        self::assertCount(1, $service->page(7, 1)['items']);
        self::assertArrayNotHasKey('snapshot', $service->page(7, 1)['items'][0]);
        $controller = new AdminNativeCompositionController($service);
        $request = Request::create('/');
        $request->setUserResolver(fn (): object => new class
        {
            public function getAuthIdentifier(): int
            {
                return 9;
            }
        });
        self::assertSame(404, $controller->show($request, $item->id)->getStatusCode());
        self::assertSame(404, $controller->destroy($request, $item->id)->getStatusCode());
        self::assertSame($payload, $service->find(7, $item->id)->snapshot);
        $this->db->table('g7pb_native_compositions')->where('composition_id', $item->id)->update(['schema_version' => 'future/v2']);
        self::assertSame('future/v2', $service->page(7, 1)['items'][0]['schema_version']);
        self::assertSame('future/v2', $service->find(7, $item->id)->toArray(true)['schema_version']);
        $service->delete(7, $item->id);
        self::assertSame([], $service->page(7, 1)['items']);
    }

    public function test_controller_rejects_wrong_transport_and_routes_require_editor_permission(): void
    {
        $controller = new AdminNativeCompositionController(new NativeCompositionService(new EloquentNativeCompositionRepository));
        self::assertSame(422, $controller->store(Request::create('/', 'POST', ['title' => ['bad']]))->getStatusCode());
        self::assertSame(422, $controller->index(Request::create('/?page=-1'))->getStatusCode());
        $container = Container::getInstance();
        $router = new Router(new Dispatcher($container), $container);
        $container->instance('router', $router);
        require dirname(__DIR__, 3).'/src/routes/api.php';
        $count = 0;
        foreach ($router->getRoutes() as $route) {
            if (! str_contains($route->uri(), 'native-compositions')) {
                continue;
            }
            $count++;
            self::assertContains('auth:sanctum', $route->gatherMiddleware());
            self::assertContains('permission:admin,core.templates.layouts.edit', $route->gatherMiddleware());
        }
        self::assertSame(4, $count);
    }
}
