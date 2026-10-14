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
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Patterns\SectionPatternService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSectionPatternController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSectionPatternRepository;
use PHPUnit\Framework\TestCase;

/** Current v3 composition storage, not the preserved native composition service. */
final class ElementCompositionPersistenceTest extends TestCase
{
    private Capsule $database;

    private SectionPatternService $patterns;

    protected function setUp(): void
    {
        $this->database = new Capsule;
        $this->database->addConnection(['driver' => 'sqlite', 'database' => ':memory:']);
        $this->database->setAsGlobal();
        $this->database->bootEloquent();
        $container = $this->database->getContainer();
        $container->instance('db', $this->database->getDatabaseManager());
        $container->instance('db.schema', $this->database->getConnection()->getSchemaBuilder());
        $response = $this->createStub(ResponseFactory::class);
        $response->method('json')->willReturnCallback(static fn (mixed $data = [], int $status = 200): JsonResponse => new JsonResponse($data, $status));
        $container->instance(ResponseFactory::class, $response);
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        (require dirname(__DIR__, 3).'/database/migrations/2026_09_01_000015_create_g7pb_section_patterns_table.php')->up();
        $schema = json_decode(file_get_contents(dirname(__DIR__, 3).'/schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR);
        $policy = json_decode(file_get_contents(dirname(__DIR__, 3).'/schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR);
        $compiler = $this->createMock(DocumentCompilerPort::class);
        $compiler->expects(self::never())->method('compile');
        $this->patterns = new SectionPatternService(new EloquentSectionPatternRepository, $compiler, new BlockRegistry, new Validator($schema, $policy));
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->database->getDatabaseManager()->disconnect();
    }

    private function source(): string
    {
        $source = json_decode(file_get_contents(dirname(__DIR__, 2).'/Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $source->shell_mode = 'none';

        return json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    private function request(int $actor): Request
    {
        $request = Request::create('/?source_document_schema=g7-page-builder%2Fv3');
        $request->setUserResolver(static fn (): object => new class($actor)
        {
            public function __construct(private readonly int $id) {}

            public function getAuthIdentifier(): int
            {
                return $this->id;
            }
        });

        return $request;
    }

    public function test_v3_storage_and_controller_isolate_owners_and_preserve_canonical_source(): void
    {
        $source = $this->source();
        $saved = $this->patterns->createComposition(7, ' 재사용 구성 ', $source);
        $controller = new AdminSectionPatternController($this->patterns);
        self::assertSame('재사용 구성', $saved->title);
        self::assertSame(json_decode($source, true), json_decode($saved->section['document_json'], true));
        self::assertSame(array_column(json_decode($source, true)['assets'], 'url'), $saved->assetReferences);
        self::assertSame([], $this->patterns->all(7));
        self::assertSame([], $controller->index($this->request(9))->getData(true)['data']['items']);
        self::assertSame(404, $controller->destroy($this->request(9), $saved->patternId)->getStatusCode());
        self::assertCount(1, $this->patterns->allCompositions(7));
        self::assertSame($saved->section['document_json'], $this->patterns->allCompositions(7)[0]['section']['document_json']);
        self::assertSame(200, $controller->destroy($this->request(7), $saved->patternId)->getStatusCode());
        self::assertSame([], $this->patterns->allCompositions(7));
    }

    public function test_incompatible_sources_are_preserved_and_disabled_in_the_owner_list(): void
    {
        $saved = $this->patterns->createComposition(7, '보존 구성', $this->source());
        $future = json_decode($saved->section['document_json'], flags: JSON_THROW_ON_ERROR);
        $future->schema_version = 'future/v4';
        $json = json_encode($future, JSON_THROW_ON_ERROR);
        $this->database->table('g7pb_section_patterns')->where('pattern_id', $saved->patternId)
            ->update(['section_json' => json_encode(['document_json' => $json], JSON_THROW_ON_ERROR)]);
        $listed = $this->patterns->allCompositions(7);
        self::assertCount(1, $listed);
        self::assertFalse($listed[0]['compatible']);
        self::assertNotEmpty($listed[0]['compatibility_error']);
        self::assertSame($json, $listed[0]['section']['document_json']);
        self::assertSame([], $this->patterns->allCompositions(9));
    }

    public function test_current_composition_routes_keep_auth_and_separate_read_update_manage_permissions(): void
    {
        $container = Container::getInstance();
        $router = new Router(new Dispatcher($container), $container);
        $container->instance('router', $router);
        require dirname(__DIR__, 3).'/src/routes/api.php';
        $expected = ['GET' => 'read', 'POST' => 'update', 'DELETE' => 'manage'];
        $count = 0;
        foreach ($router->getRoutes() as $route) {
            if (! str_contains($route->uri(), 'section-patterns')) {
                continue;
            }
            $count++;
            self::assertContains('auth:sanctum', $route->gatherMiddleware());
            self::assertContains('permission:admin,jiwonpapa-page_builder.documents.'.$expected[$route->methods()[0]], $route->gatherMiddleware());
        }
        self::assertSame(3, $count);
    }
}
