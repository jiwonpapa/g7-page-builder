<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackManager;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Application\Store\OfficialStoreService;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockUsagePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\OfficialStoreSourcePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageKitArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\RouteCatalogPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackUsage;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\StoredBlockPack;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\MediaAsset;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\PortableMedia;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\OfficialStoreProduct;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\PageKitBundle;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\PageKitMedia;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreArtifact;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\ZipPageKitArchiveAdapter;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;

final class MemoryOfficialStorePackRepository implements BlockPackRepository
{
    /** @var array<string, BlockPackInstallation> */
    public array $items = [];

    public function all(): array
    {
        return array_values($this->items);
    }

    public function find(string $packId, string $packVersion): ?BlockPackInstallation
    {
        return $this->items[$packId.'@'.$packVersion] ?? null;
    }

    public function enabled(string $packId): ?BlockPackInstallation
    {
        foreach ($this->items as $item) {
            if ($item->manifest->packId === $packId && $item->state === BlockPackState::Enabled) {
                return $item;
            }
        }

        return null;
    }

    public function save(BlockPackInstallation $installation): void
    {
        $this->items[$installation->manifest->identity()] = $installation;
    }

    public function delete(string $packId, string $packVersion): void
    {
        unset($this->items[$packId.'@'.$packVersion]);
    }
}

final class OfficialStorePackArchiveFixture implements BlockPackArchivePort
{
    public bool $deleted = false;

    public function __construct(public BlockPackManifest $manifest) {}

    public function store(string $archivePath, ?string $expectedSha256 = null): StoredBlockPack
    {
        return new StoredBlockPack($this->manifest, str_repeat('a', 64), '/tmp/g7pb-official-store-pack');
    }

    public function delete(BlockPackInstallation $installation): void
    {
        $this->deleted = true;
    }
}

final class OfficialStoreUsageFixture implements BlockUsagePort
{
    public function summarize(BlockPackManifest $manifest): BlockPackUsage
    {
        return new BlockPackUsage(0, 0);
    }

    public function summarizeBlockIdentities(array $blockIdentities): BlockPackUsage
    {
        return new BlockPackUsage(0, 0);
    }
}

final class OfficialStoreSourceFixture implements OfficialStoreSourcePort
{
    public int $downloads = 0;

    public int $releases = 0;

    /** @param array<string, StoreArtifact> $artifacts */
    public function __construct(
        public array $catalogValue,
        private readonly array $artifacts,
    ) {}

    public function catalog(): array
    {
        return $this->catalogValue;
    }

    public function download(OfficialStoreProduct $product): StoreArtifact
    {
        $this->downloads++;

        return $this->artifacts[$product->productId]
            ?? throw new \RuntimeException('Fixture artifact is missing.');
    }

    public function release(StoreArtifact $artifact): void
    {
        $this->releases++;
    }
}

final class OfficialStoreMediaFixture implements MediaPort
{
    /** @var list<string> */
    public array $deleted = [];

    /** @var list<string> */
    public array $stored = [];

    /** @var list<string> */
    public array $exportLookups = [];

    /** @param array<string, PortableMedia> $exports */
    public function __construct(private readonly array $exports = []) {}

    public function recent(int $limit = 100): array
    {
        return [];
    }

    public function store(
        string $originalName,
        string $mimeType,
        string $contents,
        int $width,
        int $height,
        ?int $actorId,
    ): MediaAsset {
        $this->stored[] = $originalName;

        return new MediaAsset(
            '00000000-0000-4000-8000-000000000099',
            'https://g7pb.test/storage/g7-page-builder/imported.png',
            $originalName,
            $mimeType,
            strlen($contents),
            $width,
            $height,
            new \DateTimeImmutable('2026-08-20T00:00:00+00:00'),
        );
    }

    public function delete(string $mediaId): void
    {
        $this->deleted[] = $mediaId;
    }

    public function exportByUrl(string $url): ?PortableMedia
    {
        $this->exportLookups[] = $url;

        return $this->exports[$url] ?? null;
    }
}

final class OfficialStoreRouteFixture implements RouteCatalogPort
{
    /** @param list<array<string, mixed>> $routes */
    public function __construct(private readonly array $routes) {}

    public function catalog(): array
    {
        return ['active_template' => 'sirsoft-basic', 'routes' => $this->routes];
    }
}

final class OfficialStorePageKitFixture implements PageKitArchivePort
{
    public ?PageBuilderDocument $writtenDocument = null;

    /** @var list<PortableMedia> */
    public array $writtenMedia = [];

    public int $releases = 0;

    public function __construct(
        public PageKitBundle $bundle,
        private readonly StoreArtifact $output,
    ) {}

    public function read(StoreArtifact $artifact): PageKitBundle
    {
        return $this->bundle;
    }

    public function write(
        string $kitId,
        string $kitVersion,
        string $title,
        string $description,
        PageBuilderDocument $document,
        array $media,
    ): StoreArtifact {
        $this->writtenDocument = $document;
        $this->writtenMedia = $media;

        return $this->output;
    }

    public function release(StoreArtifact $artifact): void
    {
        $this->releases++;
    }
}

final class OfficialStoreServiceTest extends TestCase
{
    use CreatesBuiltInCompiler;

    public function test_catalog_and_official_block_pack_install_use_catalog_identity_and_existing_pack_gates(): void
    {
        $source = new OfficialStoreSourceFixture($this->catalogValue(), $this->artifacts());
        $packs = new MemoryOfficialStorePackRepository;
        $archive = new OfficialStorePackArchiveFixture($this->marketingManifest());
        [$service] = $this->service($source, new ZipPageKitArchiveAdapter, new OfficialStoreMediaFixture,
            $this->routes(), $packs, $archive);

        $before = $service->catalog();
        self::assertCount(6, $before['products']);
        self::assertFalse($before['products'][0]['installed']);

        $installed = $service->installBlockPack('jiwonpapa/marketing-presets', '1.0.0', 7);

        self::assertSame(BlockPackState::Enabled, $installed->state);
        self::assertSame('store', $installed->source);
        self::assertSame(1, $source->downloads);
        self::assertSame(1, $source->releases);
        self::assertTrue($service->catalog()['products'][0]['installed']);
        self::assertFalse($archive->deleted);
    }

    public function test_page_kit_resolves_template_route_and_creates_one_fresh_unpublished_draft(): void
    {
        $source = new OfficialStoreSourceFixture($this->catalogValue(), $this->artifacts());
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->expects(self::once())->method('create')
            ->willReturnCallback(static fn (string $title, PageBuilderDocument $document): DocumentSnapshot => new DocumentSnapshot(
                $document,
                $title,
                1,
                1,
            ));
        $media = new OfficialStoreMediaFixture;
        [$service] = $this->service(
            $source,
            new ZipPageKitArchiveAdapter,
            $media,
            $this->routes(),
            pageRepository: $repository,
            compiler: $this->builtInCompiler(),
        );

        $created = $service->applyPageKit(
            'jiwonpapa/company-launch',
            '1.1.0',
            ' 새 회사 페이지 ',
            'company-from-store',
            7,
        );

        self::assertSame('새 회사 페이지', $created->title);
        self::assertSame('company-from-store', $created->document->slug);
        self::assertSame('template', $created->document->shellMode);
        self::assertCount(6, $created->document->blocks);
        self::assertSame('/login', $created->document->blocks[5]['props']['secondaryLink']['url']);
        self::assertSame(
            'https://g7pb.test/storage/g7-page-builder/imported.png',
            $created->document->blocks[0]['props']['image']['src'],
        );
        self::assertSame([
            'hero-team.webp',
            'team-product.webp',
            'team-design.webp',
            'team-engineering.webp',
            'customer-operations.webp',
            'customer-founder.webp',
        ], $media->stored);
        self::assertNotSame('81000000-0000-4000-8000-000000000001', $created->document->blocks[0]['instance_id']);
        self::assertNull($created->activeArtifactSha256);
        self::assertSame(1, $source->releases);
    }

    public function test_page_kit_compile_failure_rolls_back_only_media_created_by_the_attempt(): void
    {
        $png = $this->onePixelPng();
        $template = new PageBuilderDocument(
            '00000000-0000-4000-8000-000000000020',
            'media-template',
            'canvas',
            'ko',
            [],
            [[
                'instance_id' => '00000000-0000-4000-8000-000000000021',
                'type' => 'content.hero-split-01',
                'block_version' => 1,
                'props' => [
                    'eyebrow' => '회사', 'title' => '이미지 Page Kit', 'body' => '설명',
                    'image' => ['src' => 'g7pb-media://image-1', 'alt' => '샘플'],
                    'mediaPosition' => 'right',
                ],
                'slots' => [],
            ]],
        );
        $media = new PageKitMedia(
            'image-1',
            'media/image-1.png',
            hash('sha256', $png),
            'sample.png',
            'image/png',
            1,
            1,
            $png,
        );
        $bundle = new PageKitBundle(
            'jiwonpapa/company-launch',
            '1.1.0',
            '회사 소개 랜딩',
            '미디어 롤백 fixture',
            [
                'page_builder' => '>=0.10.0 <1.0.0', 'php' => '>=8.5',
                'g7' => '>=7.0.7', 'document_schema' => 'g7-page-builder/v1',
            ],
            $template,
            [$media],
        );
        $source = new OfficialStoreSourceFixture($this->catalogValue(), $this->artifacts());
        $mediaPort = new OfficialStoreMediaFixture;
        $compiler = $this->createStub(DocumentCompilerPort::class);
        $compiler->method('compile')->willThrowException(new DocumentCompileException('fixture failure'));
        $pageKits = new OfficialStorePageKitFixture($bundle, $this->artifacts()['jiwonpapa/company-launch']);
        [$service] = $this->service(
            $source,
            $pageKits,
            $mediaPort,
            $this->routes(),
            compiler: $compiler,
        );

        try {
            $service->applyPageKit('jiwonpapa/company-launch', '1.1.0', '실패', 'failed-kit', 7);
            self::fail('A Page Kit draft was created after compile failure.');
        } catch (DocumentCompileException $exception) {
            self::assertSame('fixture failure', $exception->getMessage());
        }

        self::assertSame(['sample.png'], $mediaPort->stored);
        self::assertSame(['00000000-0000-4000-8000-000000000099'], $mediaPort->deleted);
        self::assertSame(1, $source->releases);
    }

    public function test_export_embeds_module_media_and_preserves_external_urls(): void
    {
        $png = $this->onePixelPng();
        $localUrl = 'https://g7pb.test/storage/g7-page-builder/export.png';
        $asset = new MediaAsset(
            '00000000-0000-4000-8000-000000000088',
            $localUrl,
            'export.png',
            'image/png',
            strlen($png),
            1,
            1,
            new \DateTimeImmutable('2026-08-20T00:00:00+00:00'),
        );
        $document = new PageBuilderDocument(
            '00000000-0000-4000-8000-000000000001',
            'export-source',
            'canvas',
            'ko',
            [],
            [
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000002',
                    'type' => 'content.hero-split-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'EXPORT', 'title' => '내보내기', 'body' => '외부 링크 유지',
                        'image' => ['src' => $localUrl, 'alt' => '내보낼 이미지'],
                        'primaryCta' => ['label' => '외부', 'url' => 'https://example.com'],
                        'mediaPosition' => 'right',
                    ],
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000003',
                    'type' => 'content.hero-split-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'DUPLICATE', 'title' => '중복 미디어', 'body' => '동일 미디어 재사용',
                        'image' => ['src' => $localUrl, 'alt' => '같은 이미지'],
                        'primaryCta' => ['label' => '외부', 'url' => 'https://example.org'],
                        'mediaPosition' => 'left',
                    ],
                    'slots' => [],
                ],
            ],
            shellMode: 'none',
        );
        $repository = $this->createStub(PageBuilderRepository::class);
        $repository->method('find')->willReturn(new DocumentSnapshot($document, '내보내기', 2, 2));
        $source = new OfficialStoreSourceFixture($this->catalogValue(), $this->artifacts());
        $pageKits = new OfficialStorePageKitFixture(
            $this->bundledPageKit(),
            $this->artifacts()['jiwonpapa/company-launch'],
        );
        $media = new OfficialStoreMediaFixture([$localUrl => new PortableMedia($asset, $png)]);
        [$service] = $this->service(
            $source,
            $pageKits,
            $media,
            $this->routes(),
            pageRepository: $repository,
        );

        $artifact = $service->exportPageKit(
            $document->documentId,
            'jiwonpapa/exported-page',
            '1.0.0',
            '내보낸 페이지',
            '배포용 fixture',
        );
        $service->releaseExport($artifact);

        self::assertSame('g7pb-media://image-1', $pageKits->writtenDocument?->blocks[0]['props']['image']['src']);
        self::assertSame('g7pb-media://image-1', $pageKits->writtenDocument?->blocks[1]['props']['image']['src']);
        self::assertSame('https://example.com', $pageKits->writtenDocument?->blocks[0]['props']['primaryCta']['url']);
        self::assertSame([$localUrl], $media->exportLookups);
        self::assertSame('template', $pageKits->writtenDocument?->shellMode);
        self::assertCount(1, $pageKits->writtenMedia);
        self::assertSame(1, $pageKits->releases);
    }

    public function test_incompatible_product_and_missing_route_fail_before_document_persistence(): void
    {
        $incompatibleCatalog = $this->catalogValue();
        $incompatibleCatalog['products'][1]['compatibility']['page_builder'] = '>=9.0.0';
        $incompatibleSource = new OfficialStoreSourceFixture($incompatibleCatalog, $this->artifacts());
        [$incompatible] = $this->service(
            $incompatibleSource,
            new ZipPageKitArchiveAdapter,
            new OfficialStoreMediaFixture,
            $this->routes(),
        );
        self::assertFalse($incompatible->catalog()['products'][1]['compatible']);
        try {
            $incompatible->applyPageKit('jiwonpapa/company-launch', '1.1.0', '차단', 'blocked-kit', 7);
            self::fail('An incompatible Page Kit was applied.');
        } catch (\DomainException $exception) {
            self::assertStringContainsString('호환되지 않습니다', $exception->getMessage());
        }
        self::assertSame(0, $incompatibleSource->downloads);

        $source = new OfficialStoreSourceFixture($this->catalogValue(), $this->artifacts());
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->expects(self::never())->method('create');
        [$missingRoute] = $this->service(
            $source,
            new ZipPageKitArchiveAdapter,
            new OfficialStoreMediaFixture,
            new OfficialStoreRouteFixture([]),
            pageRepository: $repository,
            compiler: $this->builtInCompiler(),
        );
        try {
            $missingRoute->applyPageKit('jiwonpapa/company-launch', '1.1.0', '경로 없음', 'missing-route', 7);
            self::fail('A Page Kit with an unresolved route was applied.');
        } catch (\DomainException $exception) {
            self::assertStringContainsString('사이트 경로', $exception->getMessage());
        }
        self::assertSame(1, $source->releases);
    }

    /**
     * @return array{OfficialStoreService, MemoryOfficialStorePackRepository}
     */
    private function service(
        OfficialStoreSourcePort $source,
        PageKitArchivePort $pageKits,
        MediaPort $media,
        RouteCatalogPort $routes,
        ?MemoryOfficialStorePackRepository $packs = null,
        ?BlockPackArchivePort $packArchive = null,
        ?PageBuilderRepository $pageRepository = null,
        ?DocumentCompilerPort $compiler = null,
    ): array {
        $registry = new BlockRegistry;
        $registry->register((new BuiltInBlockPackLoader)->load(dirname(__DIR__, 2)), enabled: true);
        $packs ??= new MemoryOfficialStorePackRepository;
        $packArchive ??= new OfficialStorePackArchiveFixture($this->marketingManifest());
        $pageRepository ??= $this->createStub(PageBuilderRepository::class);
        $compiler ??= $this->createStub(DocumentCompilerPort::class);
        $manager = new BlockPackManager(
            $packs,
            $packArchive,
            new OfficialStoreUsageFixture,
            $registry,
            '0.10.0',
            '7.0.7',
        );

        return [
            new OfficialStoreService(
                $source,
                $pageKits,
                $manager,
                $registry,
                new PageBuilderService($pageRepository, $compiler),
                $media,
                $routes,
                '0.10.0',
                '7.0.7',
            ),
            $packs,
        ];
    }

    private function marketingManifest(): BlockPackManifest
    {
        return BlockPackManifest::fromJson((string) file_get_contents(
            dirname(__DIR__, 2).'/resources/store/source/block-packs/marketing-presets/manifest.json',
        ));
    }

    /** @return array<string, mixed> */
    private function catalogValue(): array
    {
        $value = json_decode(
            (string) file_get_contents(dirname(__DIR__, 2).'/resources/store/dist/catalog.json'),
            true,
            128,
            JSON_THROW_ON_ERROR,
        );
        self::assertIsArray($value);

        return $value;
    }

    /** @return array<string, StoreArtifact> */
    private function artifacts(): array
    {
        $artifacts = [];
        foreach ($this->catalogValue()['products'] as $product) {
            self::assertIsArray($product);
            $id = $product['product_id'];
            $url = $product['artifact']['url'];
            self::assertIsString($id);
            self::assertIsString($url);
            $path = dirname(__DIR__, 2).'/resources/store/dist/artifacts/'.basename($url);
            $bytes = filesize($path);
            $sha256 = hash_file('sha256', $path);
            self::assertIsInt($bytes);
            self::assertIsString($sha256);
            $artifacts[$id] = new StoreArtifact($path, $url, $sha256, $bytes, false);
        }

        return $artifacts;
    }

    private function bundledPageKit(): PageKitBundle
    {
        return (new ZipPageKitArchiveAdapter)->read($this->artifacts()['jiwonpapa/company-launch']);
    }

    private function routes(): OfficialStoreRouteFixture
    {
        return new OfficialStoreRouteFixture([[
            'id' => 'auth.login',
            'label' => '로그인',
            'category' => '회원',
            'path' => '/login',
            'parameters' => [],
        ]]);
    }

    private function onePixelPng(): string
    {
        $contents = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        );
        self::assertIsString($contents);

        return $contents;
    }
}
