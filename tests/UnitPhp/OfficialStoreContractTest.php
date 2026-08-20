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

    public function test_bundled_catalog_contains_only_official_free_products_with_valid_artifacts(): void
    {
        $catalog = OfficialStoreCatalog::fromArray($this->catalogValue());

        self::assertCount(2, $catalog->products);
        self::assertSame(['block_pack', 'page_kit'], array_column($catalog->toArray()['products'], 'product_type'));
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

    public function test_page_kit_archive_round_trips_the_bundled_document(): void
    {
        $catalog = OfficialStoreCatalog::fromArray($this->catalogValue());
        $product = $catalog->find('jiwonpapa/company-launch', '1.0.0');
        $path = dirname(__DIR__, 2).'/resources/store/dist/artifacts/'.basename($product->artifact['url']);
        $artifact = new StoreArtifact(
            $path,
            $product->artifact['url'],
            $product->artifact['sha256'],
            $product->artifact['bytes'],
            false,
        );

        $bundle = (new ZipPageKitArchiveAdapter)->read($artifact);

        self::assertSame('jiwonpapa/company-launch', $bundle->kitId);
        self::assertSame('1.0.0', $bundle->kitVersion);
        self::assertCount(4, $bundle->document->blocks);
        self::assertSame('g7pb-route://auth.login', $bundle->document->blocks[3]['props']['secondaryLink']['url']);
        self::assertSame([], $bundle->media);
        $resolved = $bundle->document->toArray();
        $resolved['blocks'][3]['props']['secondaryLink']['url'] = '/login';
        $compiled = $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($resolved),
            1,
            'html',
            'g7-7.0.7',
        );
        self::assertStringContainsString('data-block-type="stats"', (string) $compiled->artifact);
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
