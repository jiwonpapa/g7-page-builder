<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;

final class MinimalG7FixtureTest extends TestCase
{
    use CreatesBuiltInCompiler;

    public function test_core_only_manifest_and_public_capability_placeholders_work_without_optional_modules(): void
    {
        $manifestJson = file_get_contents(dirname(__DIR__, 2).'/module.json');
        self::assertIsString($manifestJson);
        $manifest = json_decode($manifestJson, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame([], $manifest['dependencies']['modules'] ?? null);
        self::assertSame([], $manifest['dependencies']['plugins'] ?? null);

        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-0000000000f0',
            slug: 'minimal-g7-fixture',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000f1',
                    'type' => 'g7.board-recent-posts-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'NEWS', 'heading' => '최근 글', 'source' => 'recent',
                        'period' => 'week', 'limit' => 6, 'audience' => 'all',
                        'emptyMessage' => '게시글 capability가 없습니다.',
                    ],
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000f2',
                    'type' => 'g7.ecommerce-product-grid-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'SHOP', 'heading' => '상품', 'source' => 'new',
                        'limit' => 4, 'columns' => 4, 'audience' => 'all',
                        'detailBasePath' => '/shop/products', 'emptyMessage' => '상품 capability가 없습니다.',
                    ],
                    'slots' => [],
                ],
            ],
        );

        $artifact = (string) $this->builtInCompiler()
            ->compile($document, 1, 'html', 'g7-7.0.7')
            ->artifact;

        self::assertStringContainsString('/api/modules/sirsoft-board/boards/posts/recent?', $artifact);
        self::assertStringContainsString('/api/modules/sirsoft-ecommerce/products/new?', $artifact);
        self::assertStringNotContainsString('Modules\\Sirsoft', $artifact);
        self::assertStringNotContainsString('App\\Models', $artifact);
        self::assertStringNotContainsString('g7_', $artifact);
    }
}
