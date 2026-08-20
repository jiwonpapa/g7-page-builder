<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackCompatibility;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackManager;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackRuntimeRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\GitHubBlockPackService;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackProvider;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackProviderLoaderPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackReleaseSourcePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockSchemaValidatorPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockUsagePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInUseException;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRelease;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackUsage;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\StoredBlockPack;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\Ed25519BlockPackSignatureVerifier;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\ZipBlockPackArchiveAdapter;
use PHPUnit\Framework\TestCase;

final class BlockPackLifecycleTest extends TestCase
{
    private string $temporaryRoot;

    protected function setUp(): void
    {
        parent::setUp();
        $this->temporaryRoot = sys_get_temp_dir().'/g7pb-pack-test-'.bin2hex(random_bytes(8));
        self::assertTrue(mkdir($this->temporaryRoot, 0700));
    }

    protected function tearDown(): void
    {
        if (is_dir($this->temporaryRoot)) {
            $this->removeTree($this->temporaryRoot);
        }
        parent::tearDown();
    }

    public function test_compatibility_ranges_are_deterministic(): void
    {
        self::assertTrue(BlockPackCompatibility::matches('0.6.0', '>=0.6.0 <1.0.0'));
        self::assertTrue(BlockPackCompatibility::matches('0.9.5', '^0.9.0'));
        self::assertFalse(BlockPackCompatibility::matches('1.0.0', '>=0.6.0 <1.0.0'));
    }

    public function test_data_pack_can_be_installed_disabled_and_removed_when_unused(): void
    {
        $manifest = $this->dataManifest();
        $repository = $this->repository();
        $archives = $this->archives($manifest);
        $registry = $this->registry();
        $manager = new BlockPackManager(
            $repository,
            $archives,
            $this->usage(new BlockPackUsage(0, 0)),
            $registry,
            '0.6.0',
            '7.0.7',
        );

        $installed = $manager->installLocal('/tmp/pack.zip', 7);
        self::assertSame(BlockPackState::Enabled, $installed->state);
        self::assertArrayHasKey('jiwonpapa/marketing-presets:hero.launch-blue', $registry->presets());

        $disabled = $manager->disable($manifest->packId, $manifest->packVersion);
        self::assertSame(BlockPackState::Disabled, $disabled->state);
        $manager->remove($manifest->packId, $manifest->packVersion);

        self::assertNull($repository->find($manifest->packId, $manifest->packVersion));
        self::assertTrue($archives->deleted);
    }

    public function test_removal_is_blocked_when_any_document_or_revision_uses_the_pack(): void
    {
        $manifest = $this->dataManifest();
        $repository = $this->repository();
        $archives = $this->archives($manifest);
        $manager = new BlockPackManager(
            $repository,
            $archives,
            $this->usage(new BlockPackUsage(2, 5)),
            $this->registry(),
            '0.6.0',
            '7.0.7',
        );
        $manager->installLocal('/tmp/pack.zip', 7, enable: false);

        try {
            $manager->remove($manifest->packId, $manifest->packVersion);
            self::fail('An in-use Block Pack was removed.');
        } catch (BlockPackInUseException $exception) {
            self::assertSame(2, $exception->usage->documents);
            self::assertSame(5, $exception->usage->revisions);
        }

        self::assertNotNull($repository->find($manifest->packId, $manifest->packVersion));
        self::assertFalse($archives->deleted);
    }

    public function test_incompatible_archive_is_removed_before_it_can_be_registered(): void
    {
        $manifestData = $this->dataManifestArray();
        $manifestData['compatibility']['page_builder'] = '>=2.0.0';
        $manifest = BlockPackManifest::fromArray($manifestData);
        $repository = $this->repository();
        $archives = $this->archives($manifest);
        $manager = new BlockPackManager(
            $repository,
            $archives,
            $this->usage(new BlockPackUsage(0, 0)),
            $this->registry(),
            '0.6.0',
            '7.0.7',
        );

        try {
            $manager->installLocal('/tmp/incompatible.zip', 7);
            self::fail('An incompatible Block Pack was installed.');
        } catch (\DomainException $exception) {
            self::assertStringContainsString('호환되지 않는', $exception->getMessage());
        }

        self::assertNull($repository->find($manifest->packId, $manifest->packVersion));
        self::assertTrue($archives->deleted);
    }

    public function test_update_cannot_drop_a_block_version_used_by_existing_revisions(): void
    {
        $repository = $this->repository();
        $registry = $this->registry();
        $usage = $this->usage(new BlockPackUsage(1, 3));
        $first = $this->codeManifest('1.0.0', 1);
        $second = $this->codeManifest('2.0.0', 2);
        $firstManager = new BlockPackManager(
            $repository, $this->archives($first), $usage, $registry, '0.6.0', '7.0.7',
        );
        $firstManager->installLocal('/tmp/code-v1.zip', 7);
        $secondManager = new BlockPackManager(
            $repository, $this->archives($second), $usage, $registry, '0.6.0', '7.0.7',
        );

        try {
            $secondManager->installLocal('/tmp/code-v2.zip', 7);
            self::fail('An update removed a block version referenced by existing revisions.');
        } catch (\DomainException $exception) {
            self::assertStringContainsString('사용 중인 기존 블록 버전', $exception->getMessage());
        }

        self::assertSame('1.0.0', $repository->enabled('vendor/update-safe')?->manifest->packVersion);
        self::assertSame(BlockPackState::Staged, $repository->find('vendor/update-safe', '2.0.0')?->state);
        self::assertNotNull($registry->definition('vendor.update-safe-01', 1));
    }

    public function test_zip_archive_verifies_manifest_hashes_and_extracts_only_declared_files(): void
    {
        $asset = 'verified thumbnail bytes';
        $manifest = $this->dataManifestArray();
        $manifest['files'] = ['assets/hero-launch-blue.webp' => hash('sha256', $asset)];
        $archivePath = $this->temporaryRoot.'/valid.zip';
        $this->writeArchive($archivePath, [
            'manifest.json' => json_encode($manifest, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
            'assets/hero-launch-blue.webp' => $asset,
        ]);
        $adapter = new ZipBlockPackArchiveAdapter($this->temporaryRoot.'/storage');

        $archiveSha256 = hash_file('sha256', $archivePath);
        self::assertIsString($archiveSha256);
        $stored = $adapter->store($archivePath, $archiveSha256);

        self::assertSame('jiwonpapa/marketing-presets', $stored->manifest->packId);
        self::assertFileExists($stored->storageReference.'/manifest.json');
        self::assertSame($asset, file_get_contents($stored->storageReference.'/assets/hero-launch-blue.webp'));
    }

    public function test_zip_archive_rejects_path_traversal_before_extraction(): void
    {
        $archivePath = $this->temporaryRoot.'/traversal.zip';
        $this->writeArchive($archivePath, [
            'manifest.json' => json_encode($this->dataManifestArray(), JSON_THROW_ON_ERROR),
            '../outside.php' => '<?php echo "unsafe";',
        ]);

        $this->expectException(\InvalidArgumentException::class);
        (new ZipBlockPackArchiveAdapter($this->temporaryRoot.'/storage'))->store($archivePath);
    }

    public function test_github_check_selects_the_highest_semver_instead_of_api_order(): void
    {
        $source = new class implements BlockPackReleaseSourcePort
        {
            public function releases(string $owner, string $repository, string $assetName): array
            {
                return [
                    $this->release($owner, $repository, $assetName, '1.2.0', 12),
                    $this->release($owner, $repository, $assetName, '1.10.0', 110),
                    $this->release($owner, $repository, $assetName, '1.9.9', 99),
                ];
            }

            public function download(BlockPackRelease $release): string
            {
                return '/tmp/not-used.zip';
            }

            private function release(string $owner, string $repository, string $assetName, string $version, int $assetId): BlockPackRelease
            {
                return new BlockPackRelease(
                    owner: $owner,
                    repository: $repository,
                    tag: 'v'.$version,
                    version: $version,
                    assetId: $assetId,
                    assetName: $assetName,
                    assetBytes: 1024,
                    sha256: str_repeat('a', 64),
                    releaseUrl: "https://github.com/{$owner}/{$repository}/releases/tag/v{$version}",
                    publishedAt: new \DateTimeImmutable('2026-08-20T00:00:00Z'),
                );
            }
        };
        $manifest = $this->dataManifest();
        $manager = new BlockPackManager(
            $this->repository(),
            $this->archives($manifest),
            $this->usage(new BlockPackUsage(0, 0)),
            $this->registry(),
            '0.6.0',
            '7.0.7',
        );

        $result = (new GitHubBlockPackService($source, $manager))->check(
            'jiwonpapa',
            'g7-block-packs',
            'g7pb-block-pack.zip',
        );

        self::assertSame('1.10.0', $result['release']->version);
        self::assertNull($result['installed_version']);
        self::assertTrue($result['update_available']);
    }

    public function test_github_install_rejects_an_archive_whose_manifest_version_differs_from_the_release(): void
    {
        $source = new class implements BlockPackReleaseSourcePort
        {
            public function releases(string $owner, string $repository, string $assetName): array
            {
                return [new BlockPackRelease(
                    owner: $owner,
                    repository: $repository,
                    tag: 'v2.0.0',
                    version: '2.0.0',
                    assetId: 20,
                    assetName: $assetName,
                    assetBytes: 1024,
                    sha256: str_repeat('a', 64),
                    releaseUrl: "https://github.com/{$owner}/{$repository}/releases/tag/v2.0.0",
                    publishedAt: new \DateTimeImmutable('2026-08-20T00:00:00Z'),
                )];
            }

            public function download(BlockPackRelease $release): string
            {
                return '/tmp/github-version-mismatch.zip';
            }
        };
        $manifest = $this->dataManifest();
        $repository = $this->repository();
        $archives = $this->archives($manifest);
        $manager = new BlockPackManager(
            $repository, $archives, $this->usage(new BlockPackUsage(0, 0)),
            $this->registry(), '0.6.0', '7.0.7',
        );

        try {
            (new GitHubBlockPackService($source, $manager))->installLatest(
                'jiwonpapa', 'g7-block-packs', 'g7pb-block-pack.zip', 7,
            );
            self::fail('A mismatched GitHub Release manifest was installed.');
        } catch (\DomainException $exception) {
            self::assertStringContainsString('Release 버전과 일치하지 않습니다', $exception->getMessage());
        }

        self::assertNull($repository->find($manifest->packId, $manifest->packVersion));
        self::assertTrue($archives->deleted);
    }

    public function test_store_install_rejects_an_archive_whose_manifest_id_differs_from_the_product(): void
    {
        $manifest = $this->dataManifest();
        $repository = $this->repository();
        $archives = $this->archives($manifest);
        $manager = new BlockPackManager(
            $repository, $archives, $this->usage(new BlockPackUsage(0, 0)),
            $this->registry(), '0.6.0', '7.0.7',
        );

        try {
            $manager->installArchive(
                '/tmp/store-id-mismatch.zip',
                7,
                'store',
                'https://www.g7devops.com/store/mismatch.zip',
                expectedPackId: 'jiwonpapa/another-product',
            );
            self::fail('A mismatched official store manifest was installed.');
        } catch (\DomainException $exception) {
            self::assertStringContainsString('상품과 일치하지 않습니다', $exception->getMessage());
        }

        self::assertNull($repository->find($manifest->packId, $manifest->packVersion));
        self::assertTrue($archives->deleted);
    }

    public function test_code_pack_requires_a_trusted_ed25519_manifest_signature(): void
    {
        $files = [
            'runtime/provider.php' => '<?php return new stdClass;',
            'dist/editor.js' => 'window.G7PBCodePack = true;',
            'assets/hero.webp' => 'thumbnail',
        ];
        $manifest = [
            'manifest_version' => BlockPackManifest::VERSION,
            'pack_id' => 'vendor/signed-blocks',
            'pack_version' => '1.0.0',
            'kind' => 'code',
            'publisher' => ['id' => 'vendor', 'name' => '검증 발행자', 'key_id' => 'vendor.main'],
            'compatibility' => ['page_builder' => '>=0.6.0 <1.0.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'blocks' => [[
                'block_id' => 'vendor.signed-hero-01',
                'block_version' => 1,
                'category' => 'hero',
                'label' => ['ko' => '서명 히어로'],
                'description' => ['ko' => '서명된 코드 블록입니다.'],
                'thumbnail' => 'assets/hero.webp',
                'schema_ref' => 'vendor:signedHero',
                'editor_component' => 'VendorSignedHero',
                'compiler' => 'vendor.signed-hero-01',
                'capabilities' => [],
            ]],
            'presets' => [],
            'runtime' => [
                'provider' => 'runtime/provider.php',
                'editor' => 'dist/editor.js',
                'styles' => [],
            ],
            'files' => array_map(static fn (string $contents): string => hash('sha256', $contents), $files),
        ];
        $manifestJson = json_encode($manifest, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $keypair = sodium_crypto_sign_keypair();
        $publicKey = sodium_crypto_sign_publickey($keypair);
        $secretKey = sodium_crypto_sign_secretkey($keypair);
        $signature = base64_encode(sodium_crypto_sign_detached($manifestJson, $secretKey));
        $archivePath = $this->temporaryRoot.'/signed.zip';
        $this->writeArchive($archivePath, ['manifest.json' => $manifestJson, 'manifest.sig' => $signature, ...$files]);
        $verifier = new Ed25519BlockPackSignatureVerifier([
            'vendor.main' => ['publisher_id' => 'vendor', 'public_key' => base64_encode($publicKey)],
        ]);

        $stored = (new ZipBlockPackArchiveAdapter($this->temporaryRoot.'/signed-storage', $verifier))->store($archivePath);

        self::assertSame('vendor/signed-blocks', $stored->manifest->packId);
        self::assertFileExists($stored->storageReference.'/runtime/provider.php');

        $impostor = BlockPackManifest::fromArray([
            ...$manifest,
            'pack_id' => 'attacker/signed-blocks',
            'publisher' => ['id' => 'attacker', 'name' => '위장 발행자', 'key_id' => 'vendor.main'],
        ]);
        try {
            $verifier->verify($impostor, $manifestJson, $signature);
            self::fail('A trusted key must not sign another publisher namespace.');
        } catch (\DomainException $exception) {
            self::assertStringContainsString('신뢰 목록에 없는', $exception->getMessage());
        }
    }

    public function test_signed_code_runtime_registers_exact_manifest_compiler_and_schema_contracts(): void
    {
        $manifest = BlockPackManifest::fromArray([
            'manifest_version' => BlockPackManifest::VERSION,
            'pack_id' => 'vendor/runtime-blocks',
            'pack_version' => '1.0.0',
            'kind' => 'code',
            'publisher' => ['id' => 'vendor', 'name' => '검증 발행자', 'key_id' => 'vendor.main'],
            'compatibility' => ['page_builder' => '>=0.6.0 <1.0.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'blocks' => [[
                'block_id' => 'vendor.notice-01',
                'block_version' => 1,
                'category' => 'content',
                'label' => ['ko' => '알림'],
                'description' => ['ko' => '서명 런타임 알림 블록'],
                'thumbnail' => 'assets/notice.webp',
                'schema_ref' => 'vendor:notice',
                'editor_component' => 'VendorNotice',
                'compiler' => 'vendor.notice-01',
                'capabilities' => [],
            ]],
            'presets' => [],
            'runtime' => ['provider' => 'runtime/provider.php', 'editor' => 'dist/editor.js', 'styles' => []],
            'files' => [
                'runtime/provider.php' => str_repeat('a', 64),
                'dist/editor.js' => str_repeat('b', 64),
                'assets/notice.webp' => str_repeat('c', 64),
            ],
        ]);
        $installation = new BlockPackInstallation(
            manifest: $manifest,
            state: BlockPackState::Enabled,
            source: 'local',
            sourceReference: '/tmp/vendor-runtime-blocks',
            sourceUri: null,
            archiveSha256: str_repeat('d', 64),
            installedAt: new \DateTimeImmutable,
            installedBy: 7,
            updatedAt: new \DateTimeImmutable,
        );
        $loader = new class($manifest) implements BlockPackProviderLoaderPort
        {
            public function __construct(private readonly BlockPackManifest $manifest) {}

            public function load(BlockPackInstallation $installation): BlockPackProvider
            {
                return new class($this->manifest) implements BlockPackProvider
                {
                    public function __construct(private readonly BlockPackManifest $manifest) {}

                    public function manifest(): BlockPackManifest
                    {
                        return $this->manifest;
                    }

                    public function compilers(): iterable
                    {
                        yield new class implements BlockTypeCompilerPort
                        {
                            public function key(): string
                            {
                                return 'vendor.notice-01';
                            }

                            public function compile(array $props): string
                            {
                                return '<section class="vendor-notice"><aside>'.htmlspecialchars((string) $props['title'], ENT_QUOTES).'</aside></section>';
                            }
                        };
                    }

                    public function schemaValidators(): iterable
                    {
                        yield new class implements BlockSchemaValidatorPort
                        {
                            public function schemaRef(): string
                            {
                                return 'vendor:notice';
                            }

                            public function validate(array $props): void
                            {
                                if (! is_string($props['title'] ?? null) || $props['title'] === '') {
                                    throw new \InvalidArgumentException('Notice title is required.');
                                }
                            }
                        };
                    }
                };
            }
        };
        $compilers = new BlockCompilerRegistry;
        $schemas = new BlockSchemaRegistry;
        $runtimes = new BlockPackRuntimeRegistry($loader, $compilers, $schemas);
        $runtimes->activate($installation);
        $registry = new BlockRegistry;
        $registry->register($manifest, enabled: true);
        $assets = new class implements BlockPackAssetUrlPort
        {
            public function styleUrls(string $packId, string $packVersion): array
            {
                return ['/modules/block-pack/style.css?version=1&theme=default'];
            }
        };
        $compiler = new HtmlDocumentCompiler($registry, $compilers, $schemas, $assets);
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'signed-runtime',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000002',
                'type' => 'vendor.notice-01',
                'block_version' => 1,
                'props' => ['title' => '검증된 알림'],
                'slots' => [],
            ]],
        );

        $result = $compiler->compile($document, 1, 'html', 'g7-7.0.7');

        self::assertStringContainsString('<aside>검증된 알림</aside>', (string) $result->artifact);
        self::assertStringContainsString(
            '<link rel="stylesheet" href="/modules/block-pack/style.css?version=1&amp;theme=default">',
            (string) $result->artifact,
        );
        self::assertTrue($compilers->has('vendor.notice-01'));
        self::assertTrue($schemas->has('vendor:notice'));
    }

    private function dataManifest(): BlockPackManifest
    {
        return BlockPackManifest::fromArray($this->dataManifestArray());
    }

    private function codeManifest(string $packVersion, int $blockVersion): BlockPackManifest
    {
        return BlockPackManifest::fromArray([
            'manifest_version' => BlockPackManifest::VERSION,
            'pack_id' => 'vendor/update-safe',
            'pack_version' => $packVersion,
            'kind' => 'code',
            'publisher' => ['id' => 'vendor', 'name' => '검증 발행자', 'key_id' => 'vendor.main'],
            'compatibility' => ['page_builder' => '>=0.6.0 <1.0.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'blocks' => [[
                'block_id' => 'vendor.update-safe-01',
                'block_version' => $blockVersion,
                'category' => 'content',
                'label' => ['ko' => '업데이트 안전 블록'],
                'description' => ['ko' => '이전 버전 보존을 검증합니다.'],
                'thumbnail' => 'assets/update-safe.webp',
                'schema_ref' => 'vendor:update-safe:'.$blockVersion,
                'editor_component' => 'VendorUpdateSafe'.$blockVersion,
                'compiler' => 'vendor.update-safe-01.'.$blockVersion,
                'capabilities' => [],
            ]],
            'presets' => [],
            'runtime' => ['provider' => 'runtime/provider.php', 'editor' => 'dist/editor.js', 'styles' => []],
            'files' => [],
        ]);
    }

    /** @return array<string, mixed> */
    private function dataManifestArray(): array
    {
        $contents = file_get_contents(dirname(__DIR__).'/Contract/block-pack-data-v1.fixture.json');
        self::assertIsString($contents);
        $manifest = json_decode($contents, true, 64, JSON_THROW_ON_ERROR);
        self::assertIsArray($manifest);

        return $manifest;
    }

    private function registry(): BlockRegistry
    {
        $registry = new BlockRegistry;
        $registry->register((new BuiltInBlockPackLoader)->load(dirname(__DIR__, 2)), enabled: true);

        return $registry;
    }

    private function repository(): BlockPackRepository
    {
        return new class implements BlockPackRepository
        {
            /** @var array<string, BlockPackInstallation> */
            private array $items = [];

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
        };
    }

    /** @return BlockPackArchivePort&object{deleted: bool} */
    private function archives(BlockPackManifest $manifest): BlockPackArchivePort
    {
        return new class($manifest) implements BlockPackArchivePort
        {
            public bool $deleted = false;

            public function __construct(private readonly BlockPackManifest $manifest) {}

            public function store(string $archivePath, ?string $expectedSha256 = null): StoredBlockPack
            {
                return new StoredBlockPack($this->manifest, str_repeat('a', 64), '/tmp/installed-pack');
            }

            public function delete(BlockPackInstallation $installation): void
            {
                $this->deleted = true;
            }
        };
    }

    private function usage(BlockPackUsage $usage): BlockUsagePort
    {
        return new class($usage) implements BlockUsagePort
        {
            public function __construct(private readonly BlockPackUsage $usage) {}

            public function summarize(BlockPackManifest $manifest): BlockPackUsage
            {
                return $this->usage;
            }

            public function summarizeBlockIdentities(array $blockIdentities): BlockPackUsage
            {
                return $blockIdentities === [] ? new BlockPackUsage(0, 0) : $this->usage;
            }
        };
    }

    /** @param array<string, string> $files */
    private function writeArchive(string $path, array $files): void
    {
        $zip = new \ZipArchive;
        self::assertTrue($zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE));
        foreach ($files as $name => $contents) {
            self::assertTrue($zip->addFromString($name, $contents));
        }
        self::assertTrue($zip->close());
    }

    private function removeTree(string $path): void
    {
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
