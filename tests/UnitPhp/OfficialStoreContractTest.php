<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\MediaAsset;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\PortableMedia;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\OfficialStoreCatalog;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreArtifact;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\ZipPageKitArchiveAdapter;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;
use ZipArchive;

final class OfficialStoreContractTest extends TestCase
{
    use CreatesBuiltInCompiler;

    public function test_default_catalog_url_uses_the_non_redirecting_canonical_host(): void
    {
        $configSource = file_get_contents(dirname(__DIR__, 2).'/config/official-store.php');
        self::assertIsString($configSource);
        self::assertStringContainsString(
            "'https://www.g7devops.com/modules/jiwonpapa-page_builder/store/catalog.json'",
            $configSource,
        );
        self::assertStringNotContainsString(
            "\n        'https://g7devops.com/modules/jiwonpapa-page_builder/store/catalog.json'",
            $configSource,
        );
    }

    public function test_bundled_catalog_contains_only_official_free_products_with_valid_artifacts(): void
    {
        $catalog = OfficialStoreCatalog::fromArray($this->catalogValue());

        self::assertCount(6, $catalog->products);
        self::assertSame(
            ['block_pack', 'page_kit', 'page_kit', 'page_kit', 'page_kit', 'page_kit'],
            array_column($catalog->toArray()['products'], 'product_type'),
        );
        self::assertSame([
            'jiwonpapa/marketing-presets',
            'jiwonpapa/company-launch',
            'jiwonpapa/service-conversion',
            'jiwonpapa/local-business',
            'jiwonpapa/event-launch',
            'jiwonpapa/editorial-community',
        ], array_column($catalog->toArray()['products'], 'product_id'));
        foreach ($catalog->products as $product) {
            $path = dirname(__DIR__, 2).'/resources/store/dist/artifacts/'.basename($product->artifact['url']);
            self::assertFileExists($path);
            self::assertSame($product->artifact['bytes'], filesize($path));
            self::assertSame($product->artifact['sha256'], hash_file('sha256', $path));
        }
    }

    public function test_catalog_rejects_foreign_publishers_and_non_free_products(): void
    {
        $foreign = $this->catalogValue();
        $foreign['publisher']['id'] = 'another-vendor';
        $this->expectException(\InvalidArgumentException::class);
        OfficialStoreCatalog::fromArray($foreign);
    }

    public function test_catalog_rejects_paid_products_and_non_string_tags(): void
    {
        $paid = $this->catalogValue();
        $paid['products'][0]['license'] = 'paid';
        try {
            OfficialStoreCatalog::fromArray($paid);
            self::fail('A paid product entered the free-only official store.');
        } catch (\InvalidArgumentException $exception) {
            self::assertStringContainsString('무료', $exception->getMessage());
        }

        $invalidTag = $this->catalogValue();
        $invalidTag['products'][0]['tags'][] = ['not' => 'a string'];
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('태그');
        OfficialStoreCatalog::fromArray($invalidTag);
    }

    public function test_catalog_rejects_duplicate_product_versions(): void
    {
        $duplicate = $this->catalogValue();
        $duplicate['products'][] = $duplicate['products'][0];

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('중복');
        OfficialStoreCatalog::fromArray($duplicate);
    }

    public function test_page_kit_archives_round_trip_and_compile_every_bundled_document(): void
    {
        $catalog = OfficialStoreCatalog::fromArray($this->catalogValue());
        $expectedBlocks = [
            'jiwonpapa/company-launch' => 6,
            'jiwonpapa/service-conversion' => 6,
            'jiwonpapa/local-business' => 6,
            'jiwonpapa/event-launch' => 7,
            'jiwonpapa/editorial-community' => 5,
        ];
        $adapter = new ZipPageKitArchiveAdapter;

        foreach ($expectedBlocks as $productId => $blockCount) {
            $product = $catalog->find($productId, '1.0.0');
            self::assertCount(3, $product->preview['screenshots']);
            self::assertSame($product->preview['screenshots'][0], $product->preview['thumbnail_url']);
            self::assertIsString($product->preview['demo_url']);
            $expectedWidths = [1425, 805, 375];
            foreach ($product->preview['screenshots'] as $index => $screenshotUrl) {
                $screenshotPath = dirname(__DIR__, 2).'/resources/store/dist/previews/'.basename($screenshotUrl);
                self::assertFileExists($screenshotPath);
                $size = getimagesize($screenshotPath);
                self::assertIsArray($size);
                self::assertSame($expectedWidths[$index], $size[0]);
                self::assertSame('image/webp', $size['mime']);
            }
            $demoPath = dirname(__DIR__, 2).'/resources/store/dist/demos/'.basename($product->preview['demo_url']).'.html';
            self::assertFileExists($demoPath);
            $demo = file_get_contents($demoPath);
            self::assertIsString($demo);
            self::assertSame($blockCount, substr_count($demo, 'data-testid="page-builder-rendered-block"'));
            self::assertStringNotContainsString('g7pb-media://', $demo);
            self::assertStringNotContainsString('g7pb-route://', $demo);
            self::assertStringNotContainsString('data-g7pb-inquiry-form', $demo);

            $path = dirname(__DIR__, 2).'/resources/store/dist/artifacts/'.basename($product->artifact['url']);
            $bundle = $adapter->read(new StoreArtifact(
                $path,
                $product->artifact['url'],
                $product->artifact['sha256'],
                $product->artifact['bytes'],
                false,
            ));

            self::assertSame($productId, $bundle->kitId);
            self::assertSame('1.0.0', $bundle->kitVersion);
            self::assertCount($blockCount, $bundle->document->blocks);
            self::assertCount(1, $bundle->media);
            self::assertSame('image-1', $bundle->media[0]->id);
            self::assertSame('image/webp', $bundle->media[0]->mimeType);
            self::assertSame(1600, $bundle->media[0]->width);
            self::assertSame(900, $bundle->media[0]->height);

            $resolved = $bundle->document->toArray();
            array_walk_recursive($resolved, static function (mixed &$value): void {
                if ($value === 'g7pb-media://image-1') {
                    $value = 'https://g7pb.test/storage/g7-page-builder/page-kit.webp';
                } elseif ($value === 'g7pb-route://auth.login') {
                    $value = '/login';
                }
            });
            $compiled = $this->builtInCompiler()->compile(
                PageBuilderDocument::fromArray($resolved),
                1,
                'html',
                'g7-7.0.7',
            );
            self::assertIsString($compiled->artifact);
            self::assertSame(
                $blockCount,
                substr_count($compiled->artifact, 'data-testid="page-builder-rendered-block"'),
            );
        }

        $company = $catalog->find('jiwonpapa/company-launch', '1.0.0');
        $companyBundle = $adapter->read(new StoreArtifact(
            dirname(__DIR__, 2).'/resources/store/dist/artifacts/'.basename($company->artifact['url']),
            $company->artifact['url'],
            $company->artifact['sha256'],
            $company->artifact['bytes'],
            false,
        ));
        self::assertSame('g7pb-route://auth.login', $companyBundle->document->blocks[5]['props']['secondaryLink']['url']);
    }

    public function test_every_built_in_thumbnail_reference_is_shipped(): void
    {
        $root = dirname(__DIR__, 2).'/resources/block-packs/builtin-core';
        $manifest = json_decode(
            (string) file_get_contents($root.'/manifest.json'),
            true,
            128,
            JSON_THROW_ON_ERROR,
        );
        self::assertIsArray($manifest);
        foreach ([...$manifest['blocks'], ...$manifest['presets']] as $item) {
            self::assertIsArray($item);
            self::assertIsString($item['thumbnail'] ?? null);
            self::assertFileExists($root.'/'.$item['thumbnail']);
        }
    }

    public function test_page_kit_export_round_trips_declared_image_bytes_and_metadata(): void
    {
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            true,
        );
        self::assertIsString($png);
        $catalog = OfficialStoreCatalog::fromArray($this->catalogValue());
        $product = $catalog->find('jiwonpapa/company-launch', '1.0.0');
        $source = dirname(__DIR__, 2).'/resources/store/dist/artifacts/'.basename($product->artifact['url']);
        $sourceArtifact = new StoreArtifact(
            $source,
            $product->artifact['url'],
            (string) hash_file('sha256', $source),
            (int) filesize($source),
            false,
        );
        $adapter = new ZipPageKitArchiveAdapter;
        $data = $adapter->read($sourceArtifact)->document->toArray();
        $data['blocks'][0]['props']['image'] = ['src' => 'g7pb-media://image-1', 'alt' => 'portable image'];
        $document = PageBuilderDocument::fromArray($data);
        $asset = new MediaAsset(
            '00000000-0000-4000-8000-000000000077',
            'https://g7pb.test/storage/g7-page-builder/portable.png',
            'portable.png',
            'image/png',
            strlen($png),
            1,
            1,
            new \DateTimeImmutable('2026-08-20T00:00:00+00:00'),
        );

        $export = $adapter->write(
            'jiwonpapa/portable-page',
            '1.0.0',
            '휴대 이미지 페이지',
            '이미지가 포함된 Page Kit fixture',
            $document,
            [new PortableMedia($asset, $png)],
        );
        try {
            $roundTrip = $adapter->read($export);
            self::assertCount(1, $roundTrip->media);
            self::assertSame('image-1', $roundTrip->media[0]->id);
            self::assertSame('image/png', $roundTrip->media[0]->mimeType);
            self::assertSame($png, $roundTrip->media[0]->contents);
            self::assertSame('g7pb-media://image-1', $roundTrip->document->blocks[0]['props']['image']['src']);
        } finally {
            $adapter->release($export);
        }
        self::assertFileDoesNotExist($export->path);
    }

    public function test_page_kit_archive_rejects_path_traversal_before_extraction(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'g7pb-malicious-');
        self::assertIsString($path);
        unlink($path);
        $path .= '.zip';
        $zip = new ZipArchive;
        self::assertTrue($zip->open($path, ZipArchive::CREATE | ZipArchive::EXCL));
        $zip->addFromString('manifest.json', '{}');
        $zip->addFromString('document.json', '{}');
        $zip->addFromString('../escape.php', '<?php');
        $zip->close();
        $bytes = filesize($path);
        $sha256 = hash_file('sha256', $path);
        self::assertIsInt($bytes);
        self::assertIsString($sha256);

        try {
            $this->expectException(\InvalidArgumentException::class);
            $this->expectExceptionMessage('안전하지 않습니다');
            (new ZipPageKitArchiveAdapter)->read(new StoreArtifact(
                $path,
                'https://www.g7devops.com/malicious.zip',
                $sha256,
                $bytes,
            ));
        } finally {
            @unlink($path);
        }
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
}
