<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
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
        self::assertSame('global', $document->shellMode);
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
}
