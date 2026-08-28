<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageSeoMetadata;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;
use PHPUnit\Framework\TestCase;

final class DomainContractsTest extends TestCase
{
    public function test_document_defaults_to_schema_v1(): void
    {
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
        );

        self::assertSame('g7-page-builder/v1', $document->schemaVersion);
        self::assertSame('template', $document->shellMode);
    }

    public function test_document_rejects_non_canvas_mode(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'site',
            locale: 'ko',
            tokens: [],
            blocks: [],
        );
    }

    public function test_document_rejects_invalid_uuid(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new PageBuilderDocument(
            documentId: 'not-a-uuid',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
        );
    }

    public function test_document_rejects_unsupported_schema_version(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
            schemaVersion: 'g7-page-builder/v2',
        );
    }

    public function test_compile_result_requires_sha256(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new CompileResult(
            compilerVersion: '0.1.0',
            documentId: '00000000-0000-4000-8000-000000000001',
            sourceRevision: 1,
            targetFormat: 'html',
            targetEngineVersion: 'g7-7.0.7',
            artifact: '<section></section>',
            artifactSha256: 'invalid',
        );
    }

    public function test_document_rejects_an_unknown_site_shell_mode(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
            shellMode: 'g7-theme',
        );
    }

    public function test_document_accepts_template_builder_blank_and_legacy_shell_modes(): void
    {
        foreach (['template', 'builder', 'none', 'global'] as $shellMode) {
            $document = new PageBuilderDocument(
                documentId: '00000000-0000-4000-8000-000000000001',
                slug: 'page-builder',
                mode: 'canvas',
                locale: 'ko',
                tokens: [],
                blocks: [],
                shellMode: $shellMode,
            );

            self::assertSame($shellMode, $document->shellMode);
        }
    }

    public function test_document_rejects_an_unapproved_design_token_value(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Page design token design.palette is invalid.');

        new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: ['design.palette' => 'javascript:alert(1)'],
            blocks: [],
        );
    }

    public function test_document_round_trips_typed_seo_metadata(): void
    {
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
            seo: new PageSeoMetadata(
                title: '검색 제목',
                description: '검색 설명',
                ogImageUrl: '/storage/share.webp',
                robots: 'noindex',
            ),
        );

        $roundTripped = PageBuilderDocument::fromArray($document->toArray());
        self::assertSame('검색 제목', $roundTripped->seo?->title);
        self::assertSame('/storage/share.webp', $roundTripped->seo?->ogImageUrl);
        self::assertSame('noindex', $roundTripped->seo?->robots);
    }

    public function test_seo_metadata_rejects_executable_image_urls(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new PageSeoMetadata(ogImageUrl: 'javascript:alert(1)');
    }

    public function test_site_shell_validates_navigation_and_has_a_stable_representation_hash(): void
    {
        $shell = SiteShell::fromArray('ko', [
            'brand_name' => '지원소프트',
            'logo_url' => '/storage/brand.webp',
            'home_url' => '/',
            'header_variant' => 'solid',
            'sticky' => true,
            'navigation' => [
                ['label' => '소개', 'url' => '/pages/about'],
                ['label' => '문의', 'url' => '/pages/contact'],
            ],
            'cta' => ['label' => '시작하기', 'url' => '/pages/start'],
            'footer_text' => '지원소프트. All rights reserved.',
            'show_footer_navigation' => true,
        ]);

        self::assertSame('지원소프트', $shell->brandName);
        self::assertCount(2, $shell->navigation);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $shell->representationSha256());
        self::assertSame($shell->representationSha256(), SiteShell::fromArray('ko', $shell->toArray())->representationSha256());
    }

    public function test_site_shell_rejects_executable_navigation_urls(): void
    {
        $this->expectException(InvalidArgumentException::class);

        SiteShell::fromArray('ko', [
            'brand_name' => '지원소프트',
            'home_url' => '/',
            'navigation' => [['label' => '위험', 'url' => 'javascript:alert(1)']],
        ]);
    }

    public function test_site_part_round_trips_a_typed_header_document(): void
    {
        $document = new SitePartDocument(
            sitePartId: '00000000-0000-4000-8000-000000000010',
            kind: 'header',
            locale: 'ko',
            tokens: ['accent' => '#2458d6'],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000011',
                'type' => 'site.header.navigation-01',
                'block_version' => 1,
                'props' => ['brand_name' => '지원소프트'],
                'slots' => [],
            ]],
        );

        self::assertSame('g7-page-builder/site-part/v1', $document->schemaVersion);
        self::assertSame($document->toArray(), SitePartDocument::fromArray($document->toArray())->toArray());
    }

    public function test_site_part_rejects_a_footer_block_inside_a_header_document(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new SitePartDocument(
            sitePartId: '00000000-0000-4000-8000-000000000010',
            kind: 'header',
            locale: 'ko',
            tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000011',
                'type' => 'site.footer.simple-01',
                'block_version' => 1,
                'props' => [],
                'slots' => [],
            ]],
        );
    }

    public function test_site_part_rejects_duplicate_primary_blocks(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('exactly one primary');

        new SitePartDocument(
            sitePartId: '00000000-0000-4000-8000-000000000010',
            kind: 'header',
            locale: 'ko',
            tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000011',
                'type' => 'site.header.navigation-01',
                'block_version' => 1,
                'props' => [],
                'slots' => [],
            ], [
                'instance_id' => '00000000-0000-4000-8000-000000000012',
                'type' => 'site.header.navigation-01',
                'block_version' => 1,
                'props' => [],
                'slots' => [],
            ]],
        );
    }

    public function test_site_part_compiler_escapes_content_and_rejects_executable_urls(): void
    {
        $document = new SitePartDocument(
            sitePartId: '00000000-0000-4000-8000-000000000010',
            kind: 'header',
            locale: 'ko',
            tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000011',
                'type' => 'site.header.navigation-01',
                'block_version' => 1,
                'props' => [
                    'brand_name' => '<script>alert(1)</script>',
                    'home_url' => '/',
                    'navigation' => [[
                        'label' => '소개',
                        'url' => '/pages/about',
                        'children' => [['label' => '팀', 'url' => '/pages/team']],
                    ]],
                    'mobile_menu_style' => 'drawer-left',
                    'responsive' => [
                        'tablet' => ['density' => 'spacious', 'alignment' => 'center', 'show_cta' => true, 'mobile_menu_style' => 'drawer-left'],
                        'mobile' => ['density' => 'compact', 'alignment' => 'spread', 'show_cta' => false, 'mobile_menu_style' => 'sheet-bottom'],
                    ],
                ],
                'slots' => [],
            ]],
        );

        $artifact = (new SitePartHtmlCompiler)->compile($document, 3);

        self::assertStringNotContainsString('<script>', $artifact->html);
        self::assertStringContainsString('&lt;script&gt;', $artifact->html);
        self::assertStringContainsString('data-g7pb-menu-style="sheet-bottom"', $artifact->html);
        self::assertStringContainsString('data-g7pb-tablet-density="spacious"', $artifact->html);
        self::assertStringContainsString('data-g7pb-mobile-menu-style="sheet-bottom"', $artifact->html);
        self::assertStringContainsString('data-g7pb-mobile-cta="hide"', $artifact->html);
        self::assertStringContainsString('data-g7pb-menu-backdrop', $artifact->html);
        self::assertStringContainsString('data-g7pb-menu-close', $artifact->html);
        self::assertStringContainsString('class="g7pb-site-subnav"', $artifact->html);
        self::assertStringContainsString('data-g7pb-submenu-toggle', $artifact->html);
        self::assertStringContainsString('data-g7pb-mobile-submenu', $artifact->html);
        self::assertStringContainsString('data-g7pb-system-controls', $artifact->html);
        self::assertStringContainsString('data-g7pb-system-theme', $artifact->html);
        self::assertStringContainsString('data-g7pb-system-search-host', $artifact->html);
        self::assertStringNotContainsString('<form', $artifact->html);
        self::assertStringNotContainsString('<select', $artifact->html);
        self::assertStringContainsString('href="#g7-action-logout"', $artifact->html);
        self::assertStringContainsString('/pages/team', $artifact->html);
        self::assertSame(3, $artifact->sourceRevision);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $artifact->artifactSha256);

        $configured = $document->toArray();
        $configured['blocks'][0]['slots'] = ['systemControls' => [[
            'instance_id' => '00000000-0000-4000-8000-000000000012',
            'type' => 'site.header.system-controls-01',
            'block_version' => 1,
            'props' => [
                'search' => true,
                'account' => true,
                'cart' => false,
                'notifications' => false,
                'theme' => true,
                'locale' => false,
                'currency' => false,
            ],
            'slots' => [],
        ]]];
        $configuredArtifact = (new SitePartHtmlCompiler)->compile(SitePartDocument::fromArray($configured), 4);
        self::assertStringContainsString('data-g7pb-system-search-host', $configuredArtifact->html);
        self::assertStringNotContainsString('data-g7pb-system-cart', $configuredArtifact->html);
        self::assertStringNotContainsString('data-g7pb-system-notification-count', $configuredArtifact->html);
        self::assertStringNotContainsString('data-g7pb-system-locale-host', $configuredArtifact->html);

        $unsafe = $document->toArray();
        $unsafe['blocks'][0]['props']['home_url'] = 'javascript:alert(1)';

        $this->expectException(DocumentCompileException::class);
        (new SitePartHtmlCompiler)->compile(SitePartDocument::fromArray($unsafe), 3);
    }

    public function test_site_part_compiler_rejects_a_third_navigation_level(): void
    {
        $document = new SitePartDocument(
            sitePartId: '00000000-0000-4000-8000-000000000010',
            kind: 'header',
            locale: 'ko',
            tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000011',
                'type' => 'site.header.navigation-01',
                'block_version' => 1,
                'props' => [
                    'brand_name' => '지원소프트',
                    'home_url' => '/',
                    'navigation' => [[
                        'label' => '서비스',
                        'url' => '/pages/services',
                        'children' => [[
                            'label' => '기능',
                            'url' => '/pages/features',
                            'children' => [['label' => '깊은 링크', 'url' => '/pages/deep']],
                        ]],
                    ]],
                ],
                'slots' => [],
            ]],
        );

        $this->expectException(DocumentCompileException::class);
        $this->expectExceptionMessage('only two menu levels');
        (new SitePartHtmlCompiler)->compile($document, 1);
    }
}
