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
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\RouteCollection;
use Illuminate\Routing\UrlGenerator;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCatalogService;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackManager;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\GitHubBlockPackService;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackReleaseSourcePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockUsagePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRelease;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackUsage;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\StoredBlockPack;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\BlockPacks\LaravelBlockPackAssetUrlAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminBlockCatalogController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminBlockPackController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\BlockPackAssetController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockFavoriteAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockUsageAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\DocumentRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\RevisionRecord;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class MutableBlockUsage implements BlockUsagePort
{
    public function __construct(public BlockPackUsage $usage) {}

    public function summarize(BlockPackManifest $manifest): BlockPackUsage
    {
        return $manifest->blocks === [] ? new BlockPackUsage(0, 0) : $this->usage;
    }

    public function summarizeBlockIdentities(array $blockIdentities): BlockPackUsage
    {
        return $blockIdentities === [] ? new BlockPackUsage(0, 0) : $this->usage;
    }
}

final class FixtureBlockPackArchive implements BlockPackArchivePort
{
    public bool $deleted = false;

    public function __construct(
        public BlockPackManifest $manifest,
        private readonly string $storageReference,
    ) {}

    public function store(string $archivePath, ?string $expectedSha256 = null): StoredBlockPack
    {
        return new StoredBlockPack($this->manifest, str_repeat('a', 64), $this->storageReference);
    }

    public function delete(BlockPackInstallation $installation): void
    {
        $this->deleted = true;
    }
}

final class FixtureBlockPackReleaseSource implements BlockPackReleaseSourcePort
{
    public function releases(string $owner, string $repository, string $assetName): array
    {
        return [new BlockPackRelease(
            owner: $owner,
            repository: $repository,
            tag: 'v1.0.0',
            version: '1.0.0',
            assetId: 100,
            assetName: $assetName,
            assetBytes: 1024,
            sha256: str_repeat('a', 64),
            releaseUrl: "https://github.com/{$owner}/{$repository}/releases/tag/v1.0.0",
            publishedAt: new \DateTimeImmutable('2026-08-20T00:00:00Z'),
        )];
    }

    public function download(BlockPackRelease $release): string
    {
        return '/tmp/g7pb-fixture-release.zip';
    }
}

final class BlockPackAdaptersTest extends TestCase
{
    private Capsule $database;

    private string $temporaryRoot;

    private BlockRegistry $registry;

    private EloquentBlockPackRepository $packs;

    private MutableBlockUsage $usage;

    private FixtureBlockPackArchive $archives;

    private AdminBlockPackController $packController;

    protected function setUp(): void
    {
        parent::setUp();
        $this->temporaryRoot = sys_get_temp_dir().'/g7pb-adapter-test-'.bin2hex(random_bytes(8));
        self::assertTrue(mkdir($this->temporaryRoot, 0700));

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
        $container->instance(
            UrlGeneratorContract::class,
            new UrlGenerator(new RouteCollection, Request::create('https://g7pb.test')),
        );
        $responses = $this->createStub(ResponseFactoryContract::class);
        $responses->method('json')->willReturnCallback(
            static fn (mixed $data = [], int $status = 200, array $headers = [], int $options = 0): JsonResponse => new JsonResponse($data, $status, $headers, $options),
        );
        $responses->method('make')->willReturnCallback(
            static fn (mixed $content = '', int $status = 200, array $headers = []): Response => new Response($content, $status, $headers),
        );
        $responses->method('file')->willReturnCallback(
            static fn (string $file, array $headers = []): BinaryFileResponse => new BinaryFileResponse($file, 200, $headers),
        );
        $container->instance(ResponseFactoryContract::class, $responses);
        $container->instance('validator', new ValidationFactory(new Translator(new ArrayLoader, 'ko'), $container));
        Container::setInstance($container);
        Facade::setFacadeApplication($container);

        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $migrationFile) {
            (require $migrationFile)->up();
        }

        $this->registry = new BlockRegistry;
        $this->registry->register((new BuiltInBlockPackLoader)->load(dirname(__DIR__, 3)), enabled: true);
        $this->packs = new EloquentBlockPackRepository;
        $this->usage = new MutableBlockUsage(new BlockPackUsage(0, 0));
        $this->archives = new FixtureBlockPackArchive($this->dataManifest(), $this->temporaryRoot.'/installed');
        $manager = new BlockPackManager(
            $this->packs,
            $this->archives,
            $this->usage,
            $this->registry,
            '0.6.0',
            '7.0.7',
        );
        $this->packController = new AdminBlockPackController(
            $manager,
            $this->registry,
            new GitHubBlockPackService(new FixtureBlockPackReleaseSource, $manager),
        );
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->database->getDatabaseManager()->disconnect();
        $this->removeTree($this->temporaryRoot);

        parent::tearDown();
    }

    public function test_catalog_http_contract_filters_and_persists_actor_favorites(): void
    {
        $managerResponse = $this->packController->store($this->uploadRequest());
        self::assertSame(201, $managerResponse->getStatusCode());
        $controller = new AdminBlockCatalogController(new BlockCatalogService(
            $this->registry,
            new EloquentBlockFavoriteAdapter,
        ));

        $catalog = $this->json($controller->index($this->request('GET', query: ['query' => '출시', 'locale' => 'ko'])));
        self::assertTrue($catalog['success']);
        self::assertCount(1, $catalog['data']['items']);
        self::assertSame('preset', $catalog['data']['items'][0]['kind']);

        $favorite = $controller->favorite($this->request('PUT', [
            'catalog_id' => 'preset:jiwonpapa/marketing-presets:hero.launch-blue',
            'favorite' => true,
        ]));
        self::assertSame(200, $favorite->getStatusCode());
        $favorites = $this->json($controller->index($this->request('GET', query: ['favorites' => 'true'])));
        self::assertCount(1, $favorites['data']['items']);
        self::assertTrue($favorites['data']['items'][0]['favorite']);

        self::assertSame(422, $controller->index($this->request('GET', query: ['query' => str_repeat('x', 121)]))->getStatusCode());
        self::assertSame(422, $controller->favorite($this->request('PUT', [
            'catalog_id' => 'invalid', 'favorite' => 'yes',
        ]))->getStatusCode());
        self::assertSame(404, $controller->favorite($this->request('PUT', [
            'catalog_id' => 'block:missing.block@1', 'favorite' => true,
        ]))->getStatusCode());
    }

    public function test_pack_http_contract_installs_changes_state_checks_github_and_blocks_in_use_removal(): void
    {
        $initial = $this->json($this->packController->index());
        self::assertCount(1, $initial['data']['items']);
        self::assertSame('jiwonpapa/builtin-core', $initial['data']['items'][0]['pack_id']);
        self::assertSame(422, $this->packController->store($this->request('POST'))->getStatusCode());

        self::assertSame(201, $this->packController->store($this->uploadRequest())->getStatusCode());
        self::assertCount(2, $this->json($this->packController->index())['data']['items']);
        self::assertSame(422, $this->packController->state($this->request('PUT', ['state' => 'enabled']))->getStatusCode());
        self::assertSame(409, $this->packController->destroy($this->identityRequest('DELETE'))->getStatusCode());
        self::assertSame(200, $this->packController->state($this->identityRequest('PUT', ['state' => 'disabled']))->getStatusCode());
        self::assertSame(200, $this->packController->destroy($this->identityRequest('DELETE'))->getStatusCode());
        self::assertTrue($this->archives->deleted);

        self::assertSame(422, $this->packController->destroy($this->request('DELETE'))->getStatusCode());
        self::assertSame(422, $this->packController->githubCheck($this->request('POST', ['owner' => '../bad']))->getStatusCode());
        $this->archives->manifest = $this->codeManifest();
        $github = $this->json($this->packController->githubCheck($this->request('POST', $this->githubSource())));
        self::assertSame('1.0.0', $github['data']['release']['version']);
        self::assertTrue($github['data']['update_available']);
        self::assertSame(201, $this->packController->githubInstall($this->request('POST', $this->githubSource()))->getStatusCode());

        $codeIdentity = ['pack_id' => 'vendor/runtime-assets', 'pack_version' => '1.0.0'];
        self::assertSame(200, $this->packController->state($this->request('PUT', [
            ...$codeIdentity, 'state' => 'disabled',
        ]))->getStatusCode());
        $this->usage->usage = new BlockPackUsage(2, 5);
        $blocked = $this->json($this->packController->destroy($this->request('DELETE', $codeIdentity)));
        self::assertSame('G7PB_BLOCK_PACK_IN_USE', $blocked['data']['code']);
        self::assertSame(['documents' => 2, 'revisions' => 5], $blocked['data']['usage']);
    }

    public function test_usage_and_asset_adapters_only_expose_manifest_owned_code_pack_files(): void
    {
        $manifest = $this->codeManifest();
        $source = $this->temporaryRoot.'/code-pack';
        self::assertTrue(mkdir($source.'/runtime', 0700, true));
        self::assertTrue(mkdir($source.'/dist', 0700, true));
        foreach ($manifest->files as $path => $digest) {
            $contents = match ($path) {
                'runtime/provider.php' => '<?php return null;',
                'dist/editor.js' => 'window.vendorPack=true;',
                'dist/preview.png' => 'PNG fixture',
                default => '.vendor-notice{color:navy}',
            };
            self::assertSame($digest, hash('sha256', $contents));
            file_put_contents($source.'/'.$path, $contents);
        }
        $installation = new BlockPackInstallation(
            $manifest,
            BlockPackState::Enabled,
            'local',
            $source,
            null,
            str_repeat('b', 64),
            new \DateTimeImmutable,
            7,
            new \DateTimeImmutable,
        );
        $this->packs->save($installation);

        $documentId = '10000000-0000-4000-8000-000000000001';
        DocumentRecord::query()->create([
            'id' => $documentId, 'slug' => 'usage-fixture', 'title' => '사용량', 'mode' => 'canvas', 'locale' => 'ko',
        ]);
        RevisionRecord::query()->create([
            'id' => '10000000-0000-4000-8000-000000000002',
            'document_id' => $documentId,
            'revision' => 1,
            'schema_version' => 'g7-page-builder/v1',
            'document_json' => json_encode(['blocks' => [[
                'type' => 'vendor.notice-01', 'block_version' => 1, 'slots' => [],
            ]]], JSON_THROW_ON_ERROR),
            'created_at' => new \DateTimeImmutable,
        ]);
        $usage = (new EloquentBlockUsageAdapter)->summarize($manifest);
        self::assertSame(1, $usage->documents);
        self::assertSame(1, $usage->revisions);
        self::assertSame(0, (new EloquentBlockUsageAdapter)->summarizeBlockIdentities([])->revisions);

        $assetUrls = new LaravelBlockPackAssetUrlAdapter($this->packs);
        self::assertCount(1, $assetUrls->styleUrls($manifest->packId, $manifest->packVersion));
        self::assertSame([], $assetUrls->styleUrls('vendor/missing', '1.0.0'));
        $assets = new BlockPackAssetController($this->packs);
        $editor = $assets->show('vendor', 'runtime-assets', '1.0.0', 'dist/editor.js');
        self::assertInstanceOf(BinaryFileResponse::class, $editor);
        self::assertSame('text/javascript; charset=utf-8', $editor->headers->get('Content-Type'));
        $thumbnail = $assets->show('vendor', 'runtime-assets', '1.0.0', 'dist/preview.png');
        self::assertInstanceOf(BinaryFileResponse::class, $thumbnail);
        self::assertSame('image/png', $thumbnail->headers->get('Content-Type'));
        self::assertSame(404, $assets->show('vendor', 'runtime-assets', '1.0.0', 'runtime/provider.php')->getStatusCode());
        self::assertSame(
            404,
            $assets->show('vendor', 'runtime-assets', '1.0.0', 'dist/unlisted.png')->getStatusCode(),
        );
        file_put_contents($source.'/dist/editor.js', 'tampered');
        self::assertSame(404, $assets->show('vendor', 'runtime-assets', '1.0.0', 'dist/editor.js')->getStatusCode());
        self::assertSame(404, $assets->show('../bad', 'runtime-assets', '1.0.0', 'dist/editor.js')->getStatusCode());

        $builtIn = $assets->show(
            'jiwonpapa',
            'builtin-core',
            '0.14.0',
            'thumbnails/generated/block-01-hero.png',
        );
        self::assertInstanceOf(BinaryFileResponse::class, $builtIn);
        self::assertSame('image/png', $builtIn->headers->get('Content-Type'));
        self::assertSame(
            404,
            $assets->show('jiwonpapa', 'builtin-core', '0.13.0', 'thumbnails/generated/block-01-hero.png')
                ->getStatusCode(),
        );
    }

    private function dataManifest(): BlockPackManifest
    {
        $contents = file_get_contents(dirname(__DIR__, 2).'/Contract/block-pack-data-v1.fixture.json');
        self::assertIsString($contents);

        return BlockPackManifest::fromJson($contents);
    }

    private function codeManifest(): BlockPackManifest
    {
        $files = [
            'runtime/provider.php' => '<?php return null;',
            'dist/editor.js' => 'window.vendorPack=true;',
            'dist/style.css' => '.vendor-notice{color:navy}',
            'dist/preview.png' => 'PNG fixture',
        ];

        return BlockPackManifest::fromArray([
            'manifest_version' => BlockPackManifest::VERSION,
            'pack_id' => 'vendor/runtime-assets',
            'pack_version' => '1.0.0',
            'kind' => 'code',
            'publisher' => ['id' => 'vendor', 'name' => 'Vendor', 'key_id' => 'vendor.main'],
            'compatibility' => ['page_builder' => '>=0.6.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'blocks' => [[
                'block_id' => 'vendor.notice-01', 'block_version' => 1, 'category' => 'content',
                'label' => ['ko' => '외부 알림'], 'description' => ['ko' => '외부 알림 블록'],
                'thumbnail' => 'dist/preview.png', 'schema_ref' => 'vendor:notice',
                'editor_component' => 'VendorNotice', 'compiler' => 'vendor.notice-01', 'capabilities' => [],
            ]],
            'presets' => [],
            'runtime' => ['provider' => 'runtime/provider.php', 'editor' => 'dist/editor.js', 'styles' => ['dist/style.css']],
            'files' => array_map(static fn (string $contents): string => hash('sha256', $contents), $files),
        ]);
    }

    /** @param array<string, mixed> $data */
    private function identityRequest(string $method, array $data = []): Request
    {
        return $this->request($method, [
            'pack_id' => 'jiwonpapa/marketing-presets',
            'pack_version' => '1.0.0',
            ...$data,
        ]);
    }

    private function uploadRequest(): Request
    {
        $path = $this->temporaryRoot.'/upload.zip';
        file_put_contents($path, 'fixture');

        return $this->request('POST', ['enable' => '1'], [
            'archive' => new UploadedFile($path, 'pack.zip', 'application/zip', null, true),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, UploadedFile>  $files
     * @param  array<string, string>  $query
     */
    private function request(string $method, array $data = [], array $files = [], array $query = []): Request
    {
        $request = Request::create('/block-packs', $method, $method === 'GET' ? $query : $data, [], $files);
        $request->setUserResolver(static fn (): object => new class
        {
            public function getAuthIdentifier(): int
            {
                return 7;
            }
        });

        return $request;
    }

    /** @return array{owner: string, repository: string, asset_name: string} */
    private function githubSource(): array
    {
        return ['owner' => 'jiwonpapa', 'repository' => 'g7-block-packs', 'asset_name' => 'g7pb-block-pack.zip'];
    }

    /** @return array<string, mixed> */
    private function json(JsonResponse $response): array
    {
        $payload = $response->getData(true);
        self::assertIsArray($payload);

        return $payload;
    }

    private function removeTree(string $path): void
    {
        if (! is_dir($path)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            $item->isDir() && ! $item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($path);
    }
}
