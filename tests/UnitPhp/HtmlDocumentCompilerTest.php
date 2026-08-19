<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use PHPUnit\Framework\TestCase;

final class HtmlDocumentCompilerTest extends TestCase
{
    public function test_compiler_is_deterministic_for_all_mvp_blocks(): void
    {
        $document = $this->document('<p>안전한 <strong>본문</strong></p>');
        $compiler = new HtmlDocumentCompiler;

        $first = $compiler->compile($document, 1, 'html', 'g7-7.0.7');
        $second = $compiler->compile($document, 1, 'html', 'g7-7.0.7');

        self::assertSame($first->artifact, $second->artifact);
        self::assertSame($first->artifactSha256, $second->artifactSha256);
        self::assertStringContainsString('data-block-type="hero"', (string) $first->artifact);
        self::assertStringContainsString('data-block-type="features"', (string) $first->artifact);
        self::assertStringContainsString('data-block-type="cta"', (string) $first->artifact);
        self::assertStringContainsString('data-block-type="contact"', (string) $first->artifact);
        self::assertStringContainsString('g7pb-icon--sparkles', (string) $first->artifact);
        self::assertStringNotContainsString('<form', (string) $first->artifact);
    }

    public function test_hero_rich_text_preserves_allowed_markup_and_sanitizes_attributes(): void
    {
        $document = $this->document('<p class="remove">설명 <strong>강조</strong> <a href="/guide" target="_blank">안내</a></p>');
        $result = (new HtmlDocumentCompiler)->compile($document, 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertStringContainsString('<p>설명 <strong>강조</strong> <a href="/guide" rel="noopener noreferrer">안내</a></p>', $artifact);
        self::assertStringNotContainsString('target=', $artifact);
        self::assertStringNotContainsString('class="remove"', $artifact);
    }

    public function test_hero_rich_text_rejects_script_and_event_handlers(): void
    {
        $this->expectException(DocumentCompileException::class);

        $document = $this->document('<p onclick="alert(1)">설명</p><script>alert(1)</script>');
        (new HtmlDocumentCompiler)->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_hero_rich_text_rejects_javascript_link(): void
    {
        $this->expectException(DocumentCompileException::class);

        $document = $this->document('<p><a href="javascript:alert(1)">위험</a></p>');
        (new HtmlDocumentCompiler)->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_cta_and_contact_escape_plain_text_and_compile_safe_links(): void
    {
        $document = $this->document(
            '<p>안전한 본문</p>',
            [
                'heading' => '<script>alert(1)</script> 다음 단계',
                'body' => '<img src=x onerror=alert(1)> 설명',
                'primaryLink' => ['label' => '시작하기', 'url' => '/start?from=cta'],
            ],
            [
                'address' => "서울 <script>alert(1)</script>\n2층",
                'cta' => ['label' => '이메일 문의', 'url' => 'mailto:hello@example.com'],
                'mapLink' => ['label' => '지도', 'url' => 'https://maps.example.com/place'],
            ],
        );

        $artifact = (string) (new HtmlDocumentCompiler)->compile($document, 1, 'html', 'g7-7.0.7')->artifact;

        self::assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt; 다음 단계', $artifact);
        self::assertStringContainsString('&lt;img src=x onerror=alert(1)&gt; 설명', $artifact);
        self::assertStringContainsString('href="/start?from=cta"', $artifact);
        self::assertStringContainsString('href="mailto:hello@example.com"', $artifact);
        self::assertStringContainsString('href="https://maps.example.com/place"', $artifact);
        self::assertStringContainsString('href="tel:0212345678"', $artifact);
        self::assertStringNotContainsString('<script>', $artifact);
        self::assertStringNotContainsString('<img src=x', $artifact);
        self::assertStringNotContainsString('<form', $artifact);
    }

    public function test_cta_rejects_javascript_url(): void
    {
        $this->expectException(DocumentCompileException::class);

        $document = $this->document(
            '<p>안전한 본문</p>',
            ['primaryLink' => ['label' => '위험', 'url' => 'javascript:alert(1)']],
        );
        (new HtmlDocumentCompiler)->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_contact_rejects_form_configuration(): void
    {
        $this->expectException(DocumentCompileException::class);

        $document = $this->document(
            '<p>안전한 본문</p>',
            [],
            ['formAction' => '/submit'],
        );
        (new HtmlDocumentCompiler)->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_contact_rejects_invalid_phone_and_email(): void
    {
        $compiler = new HtmlDocumentCompiler;

        try {
            $compiler->compile(
                $this->document('<p>안전한 본문</p>', [], ['phone' => 'javascript:alert(1)']),
                1,
                'html',
                'g7-7.0.7',
            );
            self::fail('Invalid Contact phone was accepted.');
        } catch (DocumentCompileException) {
            self::assertTrue(true);
        }

        $this->expectException(DocumentCompileException::class);
        $compiler->compile(
            $this->document('<p>안전한 본문</p>', [], ['email' => 'not-an-email']),
            1,
            'html',
            'g7-7.0.7',
        );
    }

    public function test_block_appearance_is_compiled_from_a_typed_allowlist(): void
    {
        $document = $this->document('<p>안전한 본문</p>');
        $payload = $document->toArray();
        $payload['blocks'][0]['props']['appearance'] = [
            'surface' => 'contrast',
            'spacing' => 'compact',
        ];

        $artifact = (string) (new HtmlDocumentCompiler)->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString('g7pb-surface--contrast', $artifact);
        self::assertStringContainsString('g7pb-spacing--compact', $artifact);
    }

    public function test_block_appearance_rejects_arbitrary_css_values(): void
    {
        $document = $this->document('<p>안전한 본문</p>');
        $payload = $document->toArray();
        $payload['blocks'][0]['props']['appearance'] = [
            'surface' => 'bg-[url(javascript:alert(1))]',
            'spacing' => 'normal',
        ];

        $this->expectException(DocumentCompileException::class);
        (new HtmlDocumentCompiler)->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        );
    }

    /**
     * @param  array<string, mixed>  $ctaOverrides
     * @param  array<string, mixed>  $contactOverrides
     */
    private function document(string $heroBody, array $ctaOverrides = [], array $contactOverrides = []): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000002',
                    'type' => 'content.hero-centered-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => '새 소식',
                        'title' => '페이지 빌더',
                        'body' => $heroBody,
                        'primaryCta' => ['label' => '시작하기', 'url' => '/start'],
                        'image' => ['src' => 'https://example.com/hero.jpg', 'alt' => '제품 화면'],
                        'alignment' => 'center',
                    ],
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000003',
                    'type' => 'content.features-grid-01',
                    'block_version' => 1,
                    'props' => [
                        'title' => '주요 기능',
                        'items' => [
                            ['icon' => 'sparkles', 'title' => '빠른 제작', 'body' => '블록으로 제작합니다.'],
                            ['icon' => 'shield', 'title' => '안전한 발행', 'body' => '마지막 정상본을 유지합니다.'],
                        ],
                    ],
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000004',
                    'type' => 'content.cta-split-01',
                    'block_version' => 1,
                    'props' => array_replace([
                        'eyebrow' => '다음 단계',
                        'heading' => '페이지 제작을 시작하세요',
                        'body' => '필요한 행동을 분명하게 안내합니다.',
                        'primaryLink' => ['label' => '시작하기', 'url' => '/start'],
                        'secondaryLink' => ['label' => '도입 문의', 'url' => 'https://example.com/contact'],
                        'theme' => 'dark',
                    ], $ctaOverrides),
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000005',
                    'type' => 'content.contact-info-01',
                    'block_version' => 1,
                    'props' => array_replace([
                        'heading' => '문의 안내',
                        'address' => '서울특별시 중구 세종대로 110',
                        'phone' => '02-1234-5678',
                        'email' => 'hello@example.com',
                        'cta' => ['label' => '상담 요청', 'url' => '/contact'],
                        'mapLink' => ['label' => '지도에서 보기', 'url' => 'https://maps.example.com/'],
                    ], $contactOverrides),
                    'slots' => [],
                ],
            ],
        );
    }
}
