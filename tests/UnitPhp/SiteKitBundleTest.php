<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Store\SiteKitBundle;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\BundledSiteKitSource;
use PHPUnit\Framework\TestCase;

final class SiteKitBundleTest extends TestCase
{
    public function test_sample_has_canonical_pages_parts_media_and_relocatable_links(): void
    {
        $bundle = (new BundledSiteKitSource)->load('company-starter');
        self::assertCount(3, $bundle->pages());
        self::assertCount(3, $bundle->media);
        $resolved = $bundle->resolve(['about' => '/company/about', 'services' => '/company/services', 'contact' => '/company/contact'],
            ['image-1' => '/one.webp', 'image-2' => '/two.webp', 'image-3' => '/three.webp']);
        self::assertSame('/company/services', $resolved['pages'][0]['document']['blocks'][0]['props']['primaryCta']['url']);
        self::assertSame('/company/contact', $resolved['header']['blocks'][0]['props']['navigation'][2]['url']);
        self::assertSame('/one.webp', $resolved['pages'][0]['document']['blocks'][0]['props']['image']['src']);
        self::assertStringNotContainsString('g7pb-page://', json_encode($resolved, JSON_THROW_ON_ERROR));
    }

    public function test_missing_reference_is_rejected_before_any_installation(): void
    {
        $bundle = (new BundledSiteKitSource)->load('company-starter');
        $data = $bundle->manifest;
        $data['header']['blocks'][0]['props']['home_url'] = 'g7pb-page://missing';
        $this->expectException(\InvalidArgumentException::class);
        new SiteKitBundle($data, $bundle->media);
    }

    public function test_duplicate_paths_and_unsupported_schema_are_rejected(): void
    {
        $bundle = (new BundledSiteKitSource)->load('company-starter');
        foreach (['path', 'schema'] as $case) {
            $data = $bundle->manifest;
            if ($case === 'path') {
                $data['pages'][1]['path'] = $data['pages'][0]['path'];
            } else {
                $data['schema_version'] = 'g7pb-site-kit/v2';
            }
            try {
                new SiteKitBundle($data, $bundle->media);
                self::fail('Invalid bundle was accepted.');
            } catch (\InvalidArgumentException $exception) {
                self::assertNotSame('', $exception->getMessage());
            }
        }
    }
}
