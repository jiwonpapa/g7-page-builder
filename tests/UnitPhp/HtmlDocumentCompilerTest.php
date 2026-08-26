<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\CallbackBlockTypeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;

final class HtmlDocumentCompilerTest extends TestCase
{
    use CreatesBuiltInCompiler;

    public function test_compiler_is_deterministic_for_all_mvp_blocks(): void
    {
        $document = $this->document('<p>안전한 <strong>본문</strong></p>');
        $compiler = $this->builtInCompiler();

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

    public function test_external_block_fails_closed_without_its_registered_schema_validator(): void
    {
        $manifest = BlockPackManifest::fromArray([
            'manifest_version' => BlockPackManifest::VERSION,
            'pack_id' => 'vendor/schema-required',
            'pack_version' => '1.0.0',
            'kind' => 'code',
            'publisher' => ['id' => 'vendor', 'name' => 'Vendor', 'key_id' => 'vendor.main'],
            'compatibility' => ['page_builder' => '>=0.6.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'blocks' => [[
                'block_id' => 'vendor.schema-required-01', 'block_version' => 1, 'category' => 'content',
                'label' => ['ko' => '스키마 필수'], 'description' => ['ko' => '스키마 없이 컴파일할 수 없습니다.'],
                'thumbnail' => 'assets/schema.webp', 'schema_ref' => 'vendor:schema-required',
                'editor_component' => 'VendorSchemaRequired', 'compiler' => 'vendor.schema-required-01',
                'capabilities' => [],
            ]],
            'presets' => [],
            'runtime' => ['provider' => 'runtime/provider.php', 'editor' => 'dist/editor.js', 'styles' => []],
            'files' => [],
        ]);
        $registry = new BlockRegistry;
        $registry->register($manifest, enabled: true);
        $compilers = new BlockCompilerRegistry;
        $compilers->register(new CallbackBlockTypeCompiler(
            'vendor.schema-required-01',
            static fn (array $props): string => '<aside>'.htmlspecialchars((string) ($props['title'] ?? ''), ENT_QUOTES).'</aside>',
        ));
        $compiler = new HtmlDocumentCompiler($registry, $compilers);
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'schema-required',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000002',
                'type' => 'vendor.schema-required-01', 'block_version' => 1,
                'props' => ['title' => '차단'], 'slots' => [],
            ]],
        );

        try {
            $compiler->compile($document, 1, 'html', 'g7-7.0.7');
            self::fail('An external block compiled without a schema validator.');
        } catch (DocumentCompileException $exception) {
            self::assertSame('G7PB_BLOCK_RUNTIME_FAILED', $exception->errorCode);
        }
    }

    public function test_hero_rich_text_preserves_allowed_markup_and_sanitizes_attributes(): void
    {
        $document = $this->document('<p class="remove">설명 <strong>강조</strong> <a href="/guide" target="_blank">안내</a></p>');
        $result = $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertStringContainsString('<p>설명 <strong>강조</strong> <a href="/guide" rel="noopener noreferrer">안내</a></p>', $artifact);
        self::assertStringNotContainsString('target=', $artifact);
        self::assertStringNotContainsString('class="remove"', $artifact);
    }

    public function test_hero_rich_text_rejects_script_and_event_handlers(): void
    {
        $this->expectException(DocumentCompileException::class);

        $document = $this->document('<p onclick="alert(1)">설명</p><script>alert(1)</script>');
        $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_hero_rich_text_rejects_javascript_link(): void
    {
        $this->expectException(DocumentCompileException::class);

        $document = $this->document('<p><a href="javascript:alert(1)">위험</a></p>');
        $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_selected_range_typography_is_preserved_in_testimonials_and_faq(): void
    {
        $payload = $this->phaseTwoDocument()->toArray();
        $payload['blocks'][0]['props']['items'][0]['quote'] = '<p>앞 문장 <span data-g7pb-font="serif" data-g7pb-size="large" data-g7pb-tone="accent"><u>선택 문장</u></span> 뒤 문장</p>';
        $payload['blocks'][1]['props']['items'][0]['answer'] = '<p>기본 <strong>굵게</strong> <a href="/guide">내부 링크</a></p>';

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString(
            '앞 문장 <span data-g7pb-font="serif" data-g7pb-size="large" data-g7pb-tone="accent"><u>선택 문장</u></span> 뒤 문장',
            $artifact,
        );
        self::assertStringContainsString('<strong>굵게</strong> <a href="/guide" rel="noopener noreferrer">내부 링크</a>', $artifact);
        self::assertStringContainsString('class="g7pb-testimonials__quote"', $artifact);
        self::assertStringContainsString('class="g7pb-faq__answer"', $artifact);
    }

    public function test_selected_range_typography_rejects_untyped_mark_values(): void
    {
        $payload = $this->phaseTwoDocument()->toArray();
        $payload['blocks'][0]['props']['items'][0]['quote'] = '<p><span data-g7pb-font="comic">차단</span></p>';

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    public function test_heading_selected_range_and_typed_container_layout_are_compiled(): void
    {
        $payload = $this->document('<p>본문</p>')->toArray();
        $payload['tokens']['design.custom_color_1_light'] = '#123456';
        $payload['tokens']['design.custom_color_1_dark'] = '#abcdef';
        $payload['blocks'][0]['props']['title'] = '<p>다음 <span data-g7pb-weight="bold" data-g7pb-tone="custom1">작업</span> 안내</p>';
        $payload['blocks'][0]['props']['appearance'] = [
            'surface' => 'default',
            'spacing' => 'spacious',
            'containerWidth' => 'full',
            'containerAlign' => 'right',
            'minHeight' => 'viewport',
            'verticalAlign' => 'center',
        ];

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString(
            '<h1 class="g7pb-hero__title">다음 <span data-g7pb-weight="bold" data-g7pb-tone="custom1">작업</span> 안내</h1>',
            $artifact,
        );
        self::assertStringContainsString('g7pb-theme-custom-palette', $artifact);
        self::assertStringContainsString('--g7pb-custom-tone-1-light:#123456', $artifact);
        self::assertStringContainsString('--g7pb-custom-tone-1-dark:#abcdef', $artifact);
        self::assertStringContainsString('g7pb-container-width--full', $artifact);
        self::assertStringContainsString('g7pb-container-align--right', $artifact);
        self::assertStringContainsString('g7pb-container-height--viewport', $artifact);
        self::assertStringContainsString('g7pb-container-vertical--center', $artifact);
    }

    public function test_section_heading_selected_range_keeps_markup_and_plain_accessible_name(): void
    {
        $payload = $this->phaseTwoDocument()->toArray();
        $payload['blocks'][3]['props']['heading'] = '<p>서비스 <span data-g7pb-tone="custom2">안내</span></p>';

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString(
            '<h2>서비스 <span data-g7pb-tone="custom2">안내</span></h2>',
            $artifact,
        );
        self::assertStringContainsString('role="tablist" aria-label="서비스 안내"', $artifact);
        self::assertStringNotContainsString('aria-label="&lt;p&gt;서비스', $artifact);
    }

    public function test_selected_range_typography_is_preserved_in_production_content_blocks(): void
    {
        $payload = $this->productionLibraryDocument()->toArray();
        $payload['blocks'][1]['props']['quote'] = '<p>앞 <span data-g7pb-font="serif" data-g7pb-size="large"><u>선택 인용문</u></span> 뒤</p>';
        $payload['blocks'][2]['props']['body'] = '<p>안내 <strong>핵심</strong> <a href="/guide">확인</a></p>';
        $payload['blocks'][3]['props']['items'][0]['body'] = '<p>카드 <span data-g7pb-tone="accent">선택 설명</span></p>';

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString('<span data-g7pb-font="serif" data-g7pb-size="large"><u>선택 인용문</u></span>', $artifact);
        self::assertStringContainsString('<strong>핵심</strong> <a href="/guide" rel="noopener noreferrer">확인</a>', $artifact);
        self::assertStringContainsString('<span data-g7pb-tone="accent">선택 설명</span>', $artifact);
        self::assertStringContainsString('class="g7pb-blockquote__quote"', $artifact);
        self::assertStringContainsString('class="g7pb-content-notice__body"', $artifact);
        self::assertStringContainsString('class="g7pb-card-grid__body"', $artifact);
    }

    public function test_nested_inline_text_fields_preserve_selected_range_marks_across_the_catalog(): void
    {
        $foundation = $this->foundationDocument()->toArray();
        $foundation['blocks'][5]['props']['items'][0]['title'] = '<p>아이콘 <span data-g7pb-weight="bold">제목</span></p>';

        $mvp = $this->document('<p>본문</p>')->toArray();
        $mvp['blocks'][1]['props']['items'][0]['title'] = '<p>기능 <span data-g7pb-weight="bold">제목</span></p>';

        $catalog = $this->catalogPayload();
        $catalog['blocks'][1]['props']['slides'][0]['title'] = '<p>슬라이더 <span data-g7pb-weight="bold">제목</span></p>';
        $catalog['blocks'][3]['props']['items'][0]['label'] = '<p>통계 <span data-g7pb-weight="bold">라벨</span></p>';
        $catalog['blocks'][4]['props']['plans'][0]['name'] = '<p>가격 <span data-g7pb-weight="bold">이름</span></p>';
        $catalog['blocks'][4]['props']['plans'][0]['features'][0] = '<p>가격 <span data-g7pb-weight="bold">기능</span></p>';

        $phaseTwo = $this->phaseTwoDocument()->toArray();
        $phaseTwo['blocks'][1]['props']['items'][0]['question'] = '<p>질문 <span data-g7pb-weight="bold">강조</span></p>';
        $phaseTwo['blocks'][2]['props']['items'][0]['title'] = '<p>과정 <span data-g7pb-weight="bold">제목</span></p>';
        $phaseTwo['blocks'][3]['props']['items'][0]['heading'] = '<p>탭 <span data-g7pb-weight="bold">제목</span></p>';
        $phaseTwo['blocks'][4]['props']['columns'][0]['title'] = '<p>비교 <span data-g7pb-weight="bold">제목</span></p>';
        $phaseTwo['blocks'][4]['props']['columns'][0]['description'] = '<p>비교 <span data-g7pb-weight="bold">설명</span></p>';
        $phaseTwo['blocks'][4]['props']['rows'][0]['feature'] = '<p>비교 <span data-g7pb-weight="bold">항목</span></p>';
        $phaseTwo['blocks'][5]['props']['items'][0]['title'] = '<p>기사 <span data-g7pb-weight="bold">제목</span></p>';

        $production = $this->productionLibraryDocument()->toArray();
        $production['blocks'][2]['props']['title'] = '<p>공지 <span data-g7pb-weight="bold">제목</span></p>';
        $production['blocks'][3]['props']['items'][0]['title'] = '<p>카드 <span data-g7pb-weight="bold">제목</span></p>';

        $phaseThree = $this->phaseThreeDocument()->toArray();
        $phaseThree['blocks'][2]['props']['items'][0]['title'] = '<p>행사 <span data-g7pb-weight="bold">제목</span></p>';
        $phaseThree['blocks'][3]['props']['items'][0]['title'] = '<p>자료 <span data-g7pb-weight="bold">제목</span></p>';

        $artifact = $this->compileArtifacts([
            PageBuilderDocument::fromArray($foundation),
            PageBuilderDocument::fromArray($mvp),
            PageBuilderDocument::fromArray($catalog),
            PageBuilderDocument::fromArray($phaseTwo),
            PageBuilderDocument::fromArray($production),
            PageBuilderDocument::fromArray($phaseThree),
        ]);

        foreach ([
            '<h3>아이콘 <span data-g7pb-weight="bold">제목</span></h3>',
            '<h3>기능 <span data-g7pb-weight="bold">제목</span></h3>',
            '<h2>슬라이더 <span data-g7pb-weight="bold">제목</span></h2>',
            '<h3>통계 <span data-g7pb-weight="bold">라벨</span></h3>',
            '<h3>가격 <span data-g7pb-weight="bold">이름</span></h3>',
            '<li>가격 <span data-g7pb-weight="bold">기능</span></li>',
            '<summary><span>질문 <span data-g7pb-weight="bold">강조</span></span>',
            '<h3>과정 <span data-g7pb-weight="bold">제목</span></h3>',
            '<h3>탭 <span data-g7pb-weight="bold">제목</span></h3>',
            '<strong>비교 <span data-g7pb-weight="bold">제목</span></strong>',
            '<span>비교 <span data-g7pb-weight="bold">설명</span></span>',
            '<th scope="row">비교 <span data-g7pb-weight="bold">항목</span></th>',
            '<h3><a href="/news/first">기사 <span data-g7pb-weight="bold">제목</span></a></h3>',
            '<h2 class="g7pb-content-notice__title">공지 <span data-g7pb-weight="bold">제목</span></h2>',
            '<h3>카드 <span data-g7pb-weight="bold">제목</span></h3>',
            '<h3>행사 <span data-g7pb-weight="bold">제목</span></h3>',
            '<h3>자료 <span data-g7pb-weight="bold">제목</span></h3>',
        ] as $expectedMarkup) {
            self::assertStringContainsString($expectedMarkup, $artifact);
        }
        self::assertSame(17, substr_count($artifact, 'data-g7pb-weight="bold"'));
    }

    public function test_nested_long_text_fields_preserve_block_rich_text_across_the_catalog(): void
    {
        $richText = static fn (string $label): string => '<p>앞 <strong>'.$label.'</strong></p><ul><li><a href="/guide">'.$label.' 안내</a></li></ul>';

        $foundation = $this->foundationDocument()->toArray();
        $foundation['blocks'][5]['props']['items'][0]['body'] = $richText('아이콘 본문');

        $mvp = $this->document('<p>본문</p>')->toArray();
        $mvp['blocks'][1]['props']['items'][0]['body'] = $richText('기능 본문');
        $mvp['blocks'][2]['props']['body'] = $richText('행동 본문');

        $catalog = $this->catalogPayload();
        $catalog['blocks'][3]['props']['items'][0]['detail'] = $richText('통계 설명');
        $catalog['blocks'][4]['props']['plans'][0]['description'] = $richText('가격 설명');
        $catalog['blocks'][5]['props']['members'][0]['bio'] = $richText('팀 소개');
        $catalog['blocks'][7]['props']['description'] = $richText('차트 설명');

        $formAndMap = $this->formAndMapDocument()->toArray();
        $formAndMap['blocks'][0]['props']['description'] = $richText('문의 설명');
        $formAndMap['blocks'][1]['props']['description'] = $richText('지도 설명');

        $phaseTwo = $this->phaseTwoDocument()->toArray();
        $phaseTwo['blocks'][6]['props']['caption'] = $richText('영상 설명');

        $artifact = $this->compileArtifacts([
            PageBuilderDocument::fromArray($foundation),
            PageBuilderDocument::fromArray($mvp),
            PageBuilderDocument::fromArray($catalog),
            PageBuilderDocument::fromArray($formAndMap),
            PageBuilderDocument::fromArray($phaseTwo),
        ]);

        foreach (['아이콘 본문', '기능 본문', '행동 본문', '통계 설명', '가격 설명', '팀 소개', '차트 설명', '문의 설명', '지도 설명', '영상 설명'] as $label) {
            self::assertStringContainsString('<strong>'.$label.'</strong>', $artifact);
            self::assertStringContainsString('<a href="/guide" rel="noopener noreferrer">'.$label.' 안내</a>', $artifact);
        }
    }

    public function test_new_rich_text_paths_reject_unsafe_markup_urls_and_nested_links(): void
    {
        $unsafeMarkup = $this->document('<p>본문</p>')->toArray();
        $unsafeMarkup['blocks'][1]['props']['items'][0]['title'] = '<p onclick="alert(1)">위험</p>';
        $this->assertCompileRejected(PageBuilderDocument::fromArray($unsafeMarkup));

        $unsafeUrl = $this->document('<p>본문</p>')->toArray();
        $unsafeUrl['blocks'][2]['props']['body'] = '<p><a href="javascript:alert(1)">위험</a></p>';
        $this->assertCompileRejected(PageBuilderDocument::fromArray($unsafeUrl));

        $nestedLink = $this->phaseTwoDocument()->toArray();
        $nestedLink['blocks'][1]['props']['items'][0]['question'] = '<p><a href="/outer">바깥 <a href="/inner">안쪽</a></a></p>';
        $this->assertCompileRejected(PageBuilderDocument::fromArray($nestedLink));

        $linkedArticleTitle = $this->phaseTwoDocument()->toArray();
        $linkedArticleTitle['blocks'][5]['props']['items'][0]['title'] = '<p><a href="/different">링크 제목</a></p>';
        $this->assertCompileRejected(PageBuilderDocument::fromArray($linkedArticleTitle));
    }

    public function test_rich_text_length_uses_visible_text_and_rejects_visible_overflow(): void
    {
        $withinLimit = $this->productionLibraryDocument()->toArray();
        $withinLimit['blocks'][2]['props']['title'] = '<p>'.str_repeat('<span data-g7pb-weight="bold">가</span>', 20).'</p>';

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($withinLimit),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;
        self::assertSame(20, substr_count($artifact, 'data-g7pb-weight="bold"'));

        $overLimit = $this->productionLibraryDocument()->toArray();
        $overLimit['blocks'][2]['props']['title'] = '<p>'.str_repeat('가', 201).'</p>';
        $this->assertCompileRejected(PageBuilderDocument::fromArray($overLimit));
    }

    public function test_article_title_marks_do_not_leak_tags_into_image_alternative_text(): void
    {
        $payload = $this->phaseTwoDocument()->toArray();
        $payload['blocks'][5]['props']['items'][0]['title'] = '<p>접근성 <span data-g7pb-tone="accent">이름</span></p>';
        $payload['blocks'][5]['props']['items'][0]['imageSrc'] = '/storage/article.webp';
        $payload['blocks'][5]['props']['items'][0]['imageAlt'] = '';

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString('alt="접근성 이름"', $artifact);
        self::assertStringNotContainsString('alt="&lt;p&gt;', $artifact);
        self::assertStringContainsString('<h3><a href="/news/first">접근성 <span data-g7pb-tone="accent">이름</span></a></h3>', $artifact);
    }

    public function test_plain_v1_strings_keep_their_existing_html_structure(): void
    {
        $artifact = $this->compileArtifacts([
            $this->foundationDocument(),
            $this->document('<p>본문</p>'),
            PageBuilderDocument::fromArray($this->catalogPayload()),
            $this->formAndMapDocument(),
            $this->phaseTwoDocument(),
        ]);

        foreach ([
            '<h3>빠른 시작</h3><p>준비된 구조에서 내용을 편집합니다.</p>',
            '<h3>빠른 제작</h3><p>블록으로 제작합니다.</p>',
            '<p class="g7pb-cta__body">필요한 행동을 분명하게 안내합니다.</p>',
            '<h3>사용자</h3><p>누적 사용자</p>',
            '<h3>Starter</h3><p class="g7pb-pricing__price"><strong>₩29,000</strong><span>/월</span></p><p>시작 플랜</p>',
            '<strong>제품</strong><p>제품을 설계합니다.</p>',
            '<figcaption><header class="g7pb-section-heading"><p class="g7pb-section-eyebrow">데이터</p><h2>분기별 성과</h2></header><p>0부터 100까지 비교합니다.</p></figcaption>',
            '<div class="g7pb-inquiry__intro"><header class="g7pb-section-heading"><p class="g7pb-section-eyebrow">CONTACT</p><h2>문의하세요</h2></header><p>영업일 기준으로 답변합니다.</p></div>',
            '<figcaption>제품 소개 영상입니다.</figcaption>',
        ] as $existingMarkup) {
            self::assertStringContainsString($existingMarkup, $artifact);
        }
    }

    public function test_promoted_fields_keep_bare_inline_markup_as_literal_plain_text(): void
    {
        $payload = $this->productionLibraryDocument()->toArray();
        $payload['blocks'][2]['props']['title'] = '문자 <strong>그대로</strong>';

        $mvp = $this->document('<p>본문</p>')->toArray();
        $mvp['blocks'][2]['props']['body'] = '본문 <strong>그대로</strong>';

        $artifact = $this->compileArtifacts([
            PageBuilderDocument::fromArray($payload),
            PageBuilderDocument::fromArray($mvp),
        ]);

        self::assertStringContainsString('<h2 class="g7pb-content-notice__title">문자 &lt;strong&gt;그대로&lt;/strong&gt;</h2>', $artifact);
        self::assertStringContainsString('<p class="g7pb-cta__body">본문 &lt;strong&gt;그대로&lt;/strong&gt;</p>', $artifact);
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

        $artifact = (string) $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7')->artifact;

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
        $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_cta_accepts_only_the_typed_logout_hash_action(): void
    {
        $compiler = $this->builtInCompiler();
        $artifact = (string) $compiler->compile(
            $this->document('<p>안전한 본문</p>', ['primaryLink' => ['label' => '로그아웃', 'url' => '#g7-action-logout']]),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString('href="#g7-action-logout"', $artifact);

        $this->expectException(DocumentCompileException::class);
        $compiler->compile(
            $this->document('<p>안전한 본문</p>', ['primaryLink' => ['label' => '임의 동작', 'url' => '#unknown-action']]),
            1,
            'html',
            'g7-7.0.7',
        );
    }

    public function test_contact_rejects_form_configuration(): void
    {
        $this->expectException(DocumentCompileException::class);

        $document = $this->document(
            '<p>안전한 본문</p>',
            [],
            ['formAction' => '/submit'],
        );
        $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_contact_rejects_invalid_phone_and_email(): void
    {
        $compiler = $this->builtInCompiler();

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

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString('g7pb-surface--contrast', $artifact);
        self::assertStringContainsString('g7pb-spacing--compact', $artifact);
    }

    public function test_element_appearance_is_scoped_to_the_selected_field(): void
    {
        $payload = $this->document('<p>안전한 본문</p>')->toArray();
        $payload['blocks'][0]['props']['appearance'] = [
            'surface' => 'default',
            'spacing' => 'spacious',
            'elements' => [
                'title' => ['size' => 'large', 'weight' => 'bold', 'align' => 'right'],
            ],
        ];

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertMatchesRegularExpression('/<h1 class="[^"]*g7pb-hero__title[^"]*g7pb-element-size--large[^"]*g7pb-element-weight--bold[^"]*g7pb-element-align--right[^"]*">/', $artifact);
        self::assertDoesNotMatchRegularExpression('/g7pb-hero__body[^"]*g7pb-element-size--large/', $artifact);
    }

    public function test_element_appearance_rejects_arbitrary_tokens(): void
    {
        $payload = $this->document('<p>안전한 본문</p>')->toArray();
        $payload['blocks'][0]['props']['appearance'] = [
            'surface' => 'default',
            'spacing' => 'spacious',
            'elements' => ['title' => ['size' => 'expression(alert(1))']],
        ];

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    public function test_element_appearance_targets_cover_every_editable_builtin_field(): void
    {
        /** @var array<string, list<string>> $fieldsByType */
        $fieldsByType = [
            'content.heading-01' => ['eyebrow', 'heading'],
            'content.rich-text-01' => ['content'],
            'media.image-01' => ['caption'],
            'action.buttons-01' => ['items.0.label'],
            'media.image-text-01' => ['eyebrow', 'heading', 'body', 'primaryLabel'],
            'content.icon-list-01' => ['eyebrow', 'heading', 'items.0.title', 'items.0.body'],
            'content.hero-centered-01' => ['eyebrow', 'title', 'body', 'primaryLabel'],
            'content.features-grid-01' => ['title', 'items.0.title', 'items.0.body'],
            'content.cta-split-01' => ['eyebrow', 'heading', 'body', 'primaryLabel', 'secondaryLabel'],
            'content.contact-info-01' => ['heading', 'address', 'phone', 'email', 'ctaLabel', 'mapLabel'],
            'content.hero-split-01' => ['eyebrow', 'title', 'body', 'primaryLabel'],
            'content.hero-slider-01' => ['slides.0.eyebrow', 'slides.0.title', 'slides.0.body', 'slides.0.buttonLabel'],
            'trust.logo-cloud-01' => ['heading', 'logos.0.name'],
            'data.stats-icons-01' => ['eyebrow', 'heading', 'items.0.value', 'items.0.label', 'items.0.detail'],
            'commerce.pricing-tiers-01' => ['eyebrow', 'heading', 'plans.0.name', 'plans.0.price', 'plans.0.period', 'plans.0.description', 'plans.0.buttonLabel'],
            'company.team-grid-01' => ['eyebrow', 'heading', 'members.0.name', 'members.0.role', 'members.0.bio'],
            'media.gallery-grid-01' => ['eyebrow', 'heading', 'images.0.caption'],
            'data.bar-chart-01' => ['eyebrow', 'heading', 'description', 'unit', 'items.0.label'],
            'g7.board-recent-posts-01' => ['eyebrow', 'heading'],
            'g7.ecommerce-product-grid-01' => ['eyebrow', 'heading'],
            'form.inquiry-01' => ['eyebrow', 'heading', 'description', 'privacyLabel', 'submitLabel'],
            'location.map-directions-01' => ['eyebrow', 'heading', 'description', 'address', 'phone', 'hours', 'parking', 'directionsLabel'],
            'trust.testimonials-01' => ['eyebrow', 'heading', 'items.0.quote', 'items.0.name', 'items.0.role', 'items.0.company'],
            'content.faq-accordion-01' => ['eyebrow', 'heading', 'items.0.question', 'items.0.answer'],
            'content.process-timeline-01' => ['eyebrow', 'heading', 'items.0.title', 'items.0.body', 'items.1.linkLabel'],
            'content.tabs-01' => ['eyebrow', 'heading', 'items.0.label', 'items.0.heading', 'items.0.body'],
            'commerce.comparison-table-01' => ['eyebrow', 'heading', 'columns.0.title', 'columns.0.description', 'rows.0.feature'],
            'content.article-list-01' => ['eyebrow', 'heading', 'items.0.category', 'items.0.date', 'items.0.title', 'items.0.summary'],
            'media.video-embed-01' => ['eyebrow', 'heading', 'caption'],
            'trust.logo-carousel-01' => ['eyebrow', 'heading', 'logos.0.name'],
            'trust.testimonial-slider-01' => ['eyebrow', 'heading', 'items.0.quote', 'items.0.name', 'items.0.role', 'items.0.company'],
            'content.event-schedule-01' => ['eyebrow', 'heading', 'items.0.date', 'items.0.time', 'items.0.location', 'items.0.title', 'items.0.description', 'items.0.buttonLabel'],
            'content.download-resources-01' => ['eyebrow', 'heading', 'items.0.title', 'items.0.description', 'items.0.fileType', 'items.0.fileSize', 'items.0.buttonLabel'],
            'g7.board-content-archive-01' => ['eyebrow', 'heading'],
            'g7.ecommerce-product-showcase-01' => ['eyebrow', 'heading'],
            'g7.board-post-detail-01' => ['eyebrow', 'heading', 'linkLabel'],
            'g7.ecommerce-product-detail-01' => ['eyebrow', 'heading', 'buttonLabel'],
            'content.divider-01' => ['label'],
            'content.blockquote-01' => ['quote', 'citation', 'role'],
            'content.notice-01' => ['title', 'body', 'actionLabel'],
            'content.card-grid-01' => ['eyebrow', 'heading', 'items.0.kicker', 'items.0.title', 'items.0.body', 'items.0.linkLabel'],
            'navigation.breadcrumbs-01' => ['items.0.label', 'currentLabel'],
            'navigation.anchor-menu-01' => ['label', 'items.0.label'],
            'navigation.social-links-01' => ['heading', 'items.0.label'],
            'media.image-carousel-01' => ['eyebrow', 'heading', 'images.0.caption'],
        ];
        $documents = [
            $this->document('<p>안전한 본문</p>'),
            PageBuilderDocument::fromArray($this->catalogPayload()),
            $this->dynamicDocument(),
            $this->formAndMapDocument(),
            $this->phaseTwoDocument(),
            $this->phaseThreeDocument(),
            $this->phaseFourDocument(),
            $this->foundationDocument(),
            $this->productionLibraryDocument(),
        ];
        $styledFieldCount = 0;
        $compiledArtifacts = '';

        foreach ($documents as $document) {
            $payload = $document->toArray();
            foreach ($payload['blocks'] as &$block) {
                $fields = $fieldsByType[$block['type']] ?? [];
                self::assertNotSame([], $fields, 'Missing element appearance coverage for '.$block['type']);
                $block['props']['appearance'] = [
                    'elements' => array_fill_keys($fields, ['font' => 'serif']),
                ];
                $styledFieldCount += count($fields);
            }
            unset($block);

            $compiledArtifacts .= (string) $this->builtInCompiler()->compile(
                PageBuilderDocument::fromArray($payload),
                1,
                'html',
                'g7-7.0.7',
            )->artifact;
        }

        self::assertCount(45, $fieldsByType);
        self::assertGreaterThanOrEqual($styledFieldCount, substr_count($compiledArtifacts, 'g7pb-element-font--serif'));
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
        $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        );
    }

    public function test_typed_motion_is_compiled_to_runtime_data_attributes(): void
    {
        $payload = $this->document('<p>안전한 본문</p>')->toArray();
        $payload['blocks'][1]['motion'] = [
            'preset' => 'stagger',
            'intensity' => 'strong',
            'trigger' => 'repeat',
            'stagger_ms' => 160,
        ];

        $artifact = (string) $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        )->artifact;

        self::assertStringContainsString('data-block-id="00000000-0000-4000-8000-000000000003"', $artifact);
        self::assertStringContainsString('data-g7pb-motion="stagger"', $artifact);
        self::assertStringContainsString('data-g7pb-motion-intensity="strong"', $artifact);
        self::assertStringContainsString('data-g7pb-motion-trigger="repeat"', $artifact);
        self::assertStringContainsString('data-g7pb-motion-stagger="160"', $artifact);
    }

    public function test_motion_preset_is_rejected_for_an_incompatible_block(): void
    {
        $payload = $this->document('<p>안전한 본문</p>')->toArray();
        $payload['blocks'][0]['motion'] = [
            'preset' => 'chart-draw',
            'intensity' => 'normal',
            'trigger' => 'once',
            'stagger_ms' => 100,
        ];

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        );
    }

    public function test_all_catalog_blocks_compile_to_typed_public_markup(): void
    {
        $payload = $this->catalogPayload();
        $slider = $payload['blocks'][1];
        unset($payload['blocks'][1]);
        $payload['blocks'] = array_values($payload['blocks']);

        $compiler = $this->builtInCompiler();
        $catalog = $compiler->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
        $sliderResult = $compiler->compile(
            PageBuilderDocument::fromArray(array_replace($payload, ['blocks' => [$slider]])),
            1,
            'html',
            'g7-7.0.7',
        );

        self::assertSame('0.15.0', $catalog->compilerVersion);
        foreach (['hero-split', 'logo-cloud', 'stats', 'pricing', 'team', 'gallery', 'bar-chart'] as $type) {
            self::assertStringContainsString('data-block-type="'.$type.'"', (string) $catalog->artifact);
        }
        self::assertStringContainsString('data-block-type="hero-slider"', (string) $sliderResult->artifact);
        self::assertStringContainsString('data-g7pb-slider', (string) $sliderResult->artifact);
        self::assertStringContainsString('data-g7pb-slider-autoplay="true"', (string) $sliderResult->artifact);
        self::assertStringContainsString('data-g7pb-slider-prev', (string) $sliderResult->artifact);
        self::assertStringContainsString('<progress max="100" value="74.5" data-tone="emerald">', (string) $catalog->artifact);
        self::assertStringNotContainsString('<script', (string) $catalog->artifact);
    }

    public function test_foundation_blocks_compile_to_safe_typed_public_markup(): void
    {
        $result = $this->builtInCompiler()->compile($this->foundationDocument(), 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertSame('0.15.0', $result->compilerVersion);
        foreach (['heading', 'rich-text', 'image', 'buttons', 'image-text', 'icon-list'] as $type) {
            self::assertStringContainsString('data-block-type="'.$type.'"', $artifact);
        }
        self::assertStringContainsString('id="foundation"', $artifact);
        self::assertStringContainsString('<a href="/guide" rel="noopener noreferrer">내부 링크</a>', $artifact);
        self::assertStringContainsString('role="group" aria-label="페이지 행동"', $artifact);
        self::assertStringContainsString('g7pb-icon--bolt', $artifact);
        self::assertStringContainsString('data-g7pb-motion="stagger"', $artifact);
        $imageTextMedia = strpos($artifact, 'g7pb-image-text__media');
        $imageTextCopy = strpos($artifact, 'g7pb-image-text__copy');
        self::assertIsInt($imageTextMedia);
        self::assertIsInt($imageTextCopy);
        self::assertTrue($imageTextMedia < $imageTextCopy, 'Image text keeps media-first DOM order in every variant.');
        self::assertStringNotContainsString('<script', $artifact);
        self::assertStringNotContainsString('javascript:', $artifact);
    }

    public function test_production_library_blocks_compile_to_accessible_typed_public_markup(): void
    {
        $result = $this->builtInCompiler()->compile($this->productionLibraryDocument(), 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertSame('0.15.0', $result->compilerVersion);
        foreach (['divider', 'blockquote', 'notice', 'card-grid', 'breadcrumbs', 'anchor-menu', 'social-links', 'image-carousel'] as $type) {
            self::assertStringContainsString('data-block-type="'.$type.'"', $artifact);
        }
        self::assertStringContainsString('role="note"', $artifact);
        self::assertStringContainsString('aria-current="page"', $artifact);
        self::assertStringContainsString('href="#pricing"', $artifact);
        self::assertStringContainsString('data-g7pb-slider-controls="both"', $artifact);
        self::assertStringContainsString('aria-label="1번 이미지를 선택하세요"', $artifact);
        self::assertStringContainsString('alt="제품 전시 공간"', $artifact);
        self::assertStringNotContainsString('<script', $artifact);
        self::assertStringNotContainsString('javascript:', $artifact);
    }

    public function test_production_library_rejects_unsafe_notice_routes(): void
    {
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000200', slug: 'unsafe-notice', mode: 'canvas', locale: 'ko', tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000201', 'type' => 'content.notice-01', 'block_version' => 1,
                'props' => ['tone' => 'critical', 'title' => '주의', 'body' => '안내', 'actionLabel' => '열기', 'actionUrl' => 'javascript:alert(1)'], 'slots' => [],
            ]],
        );

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_navigation_and_social_blocks_reject_non_page_protocols(): void
    {
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000210', slug: 'unsafe-social', mode: 'canvas', locale: 'ko', tokens: [],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000211', 'type' => 'navigation.social-links-01', 'block_version' => 1,
                'props' => ['heading' => '공식 채널', 'items' => [['network' => 'website', 'label' => '메일', 'url' => 'mailto:test@example.com']], 'variant' => 'labels', 'alignment' => 'left'], 'slots' => [],
            ]],
        );

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_all_builtin_presets_compile_as_typed_documents(): void
    {
        $contents = file_get_contents(dirname(__DIR__, 2).'/resources/block-packs/builtin-core/manifest.json');
        self::assertIsString($contents);
        $manifest = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        self::assertCount(95, $manifest['presets']);

        foreach (array_values($manifest['presets']) as $index => $preset) {
            $document = new PageBuilderDocument(
                documentId: '00000000-0000-4000-8000-000000000200',
                slug: 'preset-'.($index + 1),
                mode: 'canvas',
                locale: 'ko',
                tokens: [],
                blocks: [[
                    'instance_id' => sprintf('00000000-0000-4000-8000-%012d', $index + 1),
                    'type' => $preset['block_id'],
                    'block_version' => $preset['block_version'],
                    'props' => $preset['props'],
                    'slots' => [],
                ]],
            );
            $result = $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
            self::assertStringContainsString('data-testid="page-builder-rendered-block"', (string) $result->artifact, $preset['preset_id']);
        }
    }

    public function test_empty_optional_foundation_targets_ignore_only_their_stale_styles(): void
    {
        $payload = $this->foundationDocument()->toArray();
        $payload['blocks'][0]['props']['eyebrow'] = '';
        $payload['blocks'][0]['props']['appearance']['elements']['eyebrow'] = ['tone' => 'accent'];
        $payload['blocks'][2]['props']['caption'] = '';
        $payload['blocks'][2]['props']['appearance'] = ['elements' => ['caption' => ['tone' => 'accent']]];
        $payload['blocks'][4]['props']['eyebrow'] = '';
        $payload['blocks'][4]['props']['body'] = '';
        unset($payload['blocks'][4]['props']['primaryLink']);
        $payload['blocks'][4]['props']['appearance']['elements'] = [
            'eyebrow' => ['tone' => 'accent'],
            'body' => ['tone' => 'accent'],
            'primaryLabel' => ['tone' => 'accent'],
        ];
        $payload['blocks'][5]['props']['eyebrow'] = '';
        $payload['blocks'][5]['props']['items'][0]['body'] = '';
        $payload['blocks'][5]['props']['appearance'] = ['elements' => ['eyebrow' => ['tone' => 'accent']]];

        $result = $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
        self::assertStringNotContainsString('g7pb-element-tone--accent', (string) $result->artifact);
    }

    public function test_duplicate_heading_anchors_fail_closed(): void
    {
        $payload = $this->foundationDocument()->toArray();
        $duplicate = $payload['blocks'][0];
        $duplicate['instance_id'] = '00000000-0000-4000-8000-000000000299';
        $payload['blocks'][] = $duplicate;

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    public function test_foundation_appearance_rejects_unsupported_and_stale_collection_paths(): void
    {
        $invalid = $this->foundationDocument()->toArray();
        $invalid['blocks'][2]['props']['appearance'] = ['elements' => ['body' => ['tone' => 'accent']]];
        try {
            $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($invalid), 1, 'html', 'g7-7.0.7');
            self::fail('An unsupported Image appearance path was accepted.');
        } catch (DocumentCompileException) {
            $this->addToAssertionCount(1);
        }

        $alias = $this->foundationDocument()->toArray();
        $alias['blocks'][3]['props']['appearance'] = ['elements' => ['primaryLabel' => ['tone' => 'accent']]];
        try {
            $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($alias), 1, 'html', 'g7-7.0.7');
            self::fail('A Buttons root alias bypassed its typed items.N.label path.');
        } catch (DocumentCompileException) {
            $this->addToAssertionCount(1);
        }

        $stale = $this->foundationDocument()->toArray();
        $stale['blocks'][3]['props']['appearance'] = ['elements' => ['items.9.label' => ['tone' => 'accent']]];
        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($stale), 1, 'html', 'g7-7.0.7');
    }

    public function test_foundation_blocks_reject_unsafe_markup_urls_and_untyped_values(): void
    {
        /** @var array<string, callable(array<string, mixed>&): void> $mutations */
        $mutations = [
            'heading anchor' => static function (array &$payload): void {
                $payload['blocks'][0]['props']['anchor'] = 'javascript:alert';
            },
            'rich text script' => static function (array &$payload): void {
                $payload['blocks'][1]['props']['content'] = '<script>alert(1)</script>';
            },
            'image source' => static function (array &$payload): void {
                $payload['blocks'][2]['props']['src'] = 'javascript:alert(1)';
            },
            'image link' => static function (array &$payload): void {
                $payload['blocks'][2]['props']['linkUrl'] = 'javascript:alert(1)';
            },
            'button link' => static function (array &$payload): void {
                $payload['blocks'][3]['props']['items'][0]['url'] = 'javascript:alert(1)';
            },
            'image text body' => static function (array &$payload): void {
                $payload['blocks'][4]['props']['body'] = '<img src=x onerror=alert(1)>';
            },
            'icon name' => static function (array &$payload): void {
                $payload['blocks'][5]['props']['items'][0]['icon'] = 'javascript';
            },
        ];

        foreach ($mutations as $label => $mutate) {
            $payload = $this->foundationDocument()->toArray();
            $mutate($payload);
            try {
                $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
                self::fail("Unsafe foundation mutation was accepted: {$label}");
            } catch (DocumentCompileException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_catalog_warns_but_allows_multiple_hero_family_blocks(): void
    {
        $result = $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($this->catalogPayload()),
            1,
            'html',
            'g7-7.0.7',
        );

        self::assertCount(1, $result->warnings);
        self::assertStringContainsString('Hero 계열 블록이 2개', $result->warnings[0]);
        self::assertStringContainsString('data-block-type="hero-split"', (string) $result->artifact);
        self::assertStringContainsString('data-block-type="hero-slider"', (string) $result->artifact);
    }

    public function test_compiler_wraps_artifact_with_allowlisted_page_design_classes(): void
    {
        $payload = $this->document('<p>안전한 본문</p>')->toArray();
        $payload['tokens'] = [
            'design.palette' => 'emerald',
            'design.font' => 'serif',
            'design.radius' => 'round',
            'design.width' => 'wide',
            'design.scale' => 'large',
            'vendor.option' => true,
        ];

        $result = $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        );

        self::assertStringContainsString(
            'class="g7pb-document-theme g7pb-theme-mode-light g7pb-theme-palette-emerald g7pb-theme-font-serif g7pb-theme-radius-round g7pb-theme-width-wide g7pb-theme-scale-large"',
            (string) $result->artifact,
        );
        self::assertStringNotContainsString('vendor.option', (string) $result->artifact);
    }

    public function test_catalog_rejects_unsafe_action_urls(): void
    {
        $payload = $this->catalogPayload();
        $payload['blocks'] = [$payload['blocks'][4]];
        $payload['blocks'][0]['props']['plans'][0]['buttonUrl'] = 'javascript:alert(1)';

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        );
    }

    public function test_catalog_rejects_out_of_range_chart_values(): void
    {
        $payload = $this->catalogPayload();
        $payload['blocks'] = [$payload['blocks'][7]];
        $payload['blocks'][0]['props']['items'][0]['value'] = 101;

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(
            PageBuilderDocument::fromArray($payload),
            1,
            'html',
            'g7-7.0.7',
        );
    }

    public function test_g7_dynamic_blocks_compile_only_typed_public_api_placeholders(): void
    {
        $result = $this->builtInCompiler()->compile(
            $this->dynamicDocument(),
            1,
            'html',
            'g7-7.0.7',
        );
        $artifact = (string) $result->artifact;

        self::assertSame('0.15.0', $result->compilerVersion);
        self::assertStringContainsString('data-block-type="g7-recent-posts"', $artifact);
        self::assertStringContainsString('/api/modules/sirsoft-board/boards/popular?period=week&amp;limit=6', $artifact);
        self::assertStringContainsString('data-block-type="g7-product-grid"', $artifact);
        self::assertStringContainsString('/api/modules/sirsoft-ecommerce/products/new?limit=4', $artifact);
        self::assertStringContainsString('data-g7pb-audience="member"', $artifact);
        self::assertStringContainsString('data-g7pb-product-base="/shop/products"', $artifact);
        self::assertStringNotContainsString('<script', $artifact);
        self::assertStringNotContainsString('sirsoft-page', $artifact);
    }

    public function test_g7_product_grid_rejects_an_unsafe_detail_route(): void
    {
        $document = $this->dynamicDocument('//attacker.example/products');

        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
    }

    public function test_inquiry_form_and_map_compile_to_typed_public_markup(): void
    {
        $result = $this->builtInCompiler()->compile($this->formAndMapDocument(), 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertStringContainsString('data-block-type="inquiry-form"', $artifact);
        self::assertStringContainsString('data-block-id="00000000-0000-4000-8000-000000000092"', $artifact);
        self::assertStringContainsString('action="/pages/business-contact/inquiries"', $artifact);
        self::assertStringContainsString('name="block_instance_id"', $artifact);
        self::assertStringContainsString('name="website"', $artifact);
        self::assertStringContainsString('data-block-type="map-directions"', $artifact);
        self::assertStringContainsString('https://www.openstreetmap.org/export/embed.html?', $artifact);
        self::assertStringContainsString('href="https://www.openstreetmap.org/directions"', $artifact);
        self::assertStringNotContainsString('recipient', $artifact);
        self::assertStringNotContainsString('<script', $artifact);
    }

    public function test_inquiry_and_map_reject_untyped_or_unsafe_configuration(): void
    {
        $payload = $this->formAndMapDocument()->toArray();
        $payload['blocks'][0]['props']['recipient'] = 'attacker@example.com';

        try {
            $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
            self::fail('An arbitrary form recipient was accepted.');
        } catch (DocumentCompileException) {
            self::assertTrue(true);
        }

        $payload = $this->formAndMapDocument()->toArray();
        $payload['blocks'][1]['props']['directionsUrl'] = 'javascript:alert(1)';
        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    public function test_phase_two_catalog_compiles_accessible_typed_markup(): void
    {
        $result = $this->builtInCompiler()->compile($this->phaseTwoDocument(), 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertSame('0.15.0', $result->compilerVersion);
        foreach (['testimonials', 'faq-accordion', 'process-timeline', 'tabs', 'comparison-table', 'article-list', 'video-embed'] as $type) {
            self::assertStringContainsString('data-block-type="'.$type.'"', $artifact);
        }
        self::assertStringContainsString('data-g7pb-accordion-behavior="single"', $artifact);
        self::assertStringContainsString('<details open>', $artifact);
        self::assertStringContainsString('role="tablist"', $artifact);
        self::assertStringContainsString('role="tabpanel"', $artifact);
        self::assertStringContainsString('<table>', $artifact);
        self::assertStringContainsString('https://www.youtube-nocookie.com/embed/abcDEF12345?rel=0', $artifact);
        self::assertStringNotContainsString('<script', $artifact);
        self::assertStringNotContainsString('javascript:', $artifact);
    }

    public function test_phase_two_catalog_rejects_untyped_video_and_invalid_tab_state(): void
    {
        $payload = $this->phaseTwoDocument()->toArray();
        $payload['blocks'] = [$payload['blocks'][6]];
        $payload['blocks'][0]['props']['videoId'] = 'https://attacker.example/embed';

        try {
            $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
            self::fail('An arbitrary video URL was accepted.');
        } catch (DocumentCompileException) {
            self::assertTrue(true);
        }

        $payload = $this->phaseTwoDocument()->toArray();
        $payload['blocks'] = [$payload['blocks'][3]];
        $payload['blocks'][0]['props']['initialTab'] = 9;
        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    public function test_phase_three_catalog_compiles_sliders_resources_and_typed_g7_variants(): void
    {
        $result = $this->builtInCompiler()->compile($this->phaseThreeDocument(), 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertSame('0.15.0', $result->compilerVersion);
        foreach (['logo-carousel', 'testimonial-slider', 'event-schedule', 'download-resources', 'g7-board-archive', 'g7-product-showcase'] as $type) {
            self::assertStringContainsString('data-block-type="'.$type.'"', $artifact);
        }
        self::assertSame(2, substr_count($artifact, ' data-g7pb-slider '));
        self::assertStringContainsString('data-g7pb-archive-search', $artifact);
        self::assertStringContainsString('data-g7pb-archive-filter', $artifact);
        self::assertStringContainsString('/api/modules/sirsoft-board/boards/posts/recent?limit=12', $artifact);
        self::assertStringContainsString('/api/modules/sirsoft-ecommerce/products/new?limit=6', $artifact);
        self::assertStringContainsString('data-g7pb-product-base="/shop/products"', $artifact);
        self::assertSame(2, substr_count($artifact, 'data-g7pb-pagination'));
        self::assertStringContainsString('data-g7pb-page-size="4"', $artifact);
        self::assertStringContainsString('data-g7pb-page-size="3"', $artifact);
        self::assertStringContainsString('href="/files/guide.pdf" download', $artifact);
        self::assertStringNotContainsString('<script', $artifact);
    }

    public function test_phase_four_g7_details_and_generic_visibility_compile_to_typed_placeholders(): void
    {
        $result = $this->builtInCompiler()->compile($this->phaseFourDocument(), 1, 'html', 'g7-7.0.7');
        $artifact = (string) $result->artifact;

        self::assertSame('0.15.0', $result->compilerVersion);
        self::assertStringContainsString('data-block-type="g7-post-detail"', $artifact);
        self::assertStringContainsString('data-block-type="g7-product-detail"', $artifact);
        self::assertStringContainsString('/api/modules/sirsoft-board/boards/notice/posts/17', $artifact);
        self::assertStringContainsString('/api/modules/sirsoft-ecommerce/products/SKU-17', $artifact);
        self::assertStringContainsString('data-g7pb-visibility-audience="member"', $artifact);
        self::assertStringContainsString('data-g7pb-show-content="true"', $artifact);
        self::assertStringContainsString('data-g7pb-show-description="false"', $artifact);
        self::assertSame(2, substr_count($artifact, 'data-g7pb-data-detail'));
        self::assertStringNotContainsString('<script', $artifact);
    }

    public function test_phase_four_rejects_unsafe_keys_routes_and_visibility(): void
    {
        $payload = $this->phaseFourDocument()->toArray();
        $payload['blocks'] = [$payload['blocks'][1]];
        $payload['blocks'][0]['props']['productKey'] = '../secret';
        try {
            $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
            self::fail('An unsafe product key was accepted.');
        } catch (DocumentCompileException) {
            self::assertTrue(true);
        }

        $payload = $this->phaseFourDocument()->toArray();
        $payload['blocks'] = [$payload['blocks'][0]];
        $payload['blocks'][0]['visibility'] = ['audience' => 'administrator'];
        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    public function test_phase_three_catalog_rejects_unsafe_resource_and_product_routes(): void
    {
        $payload = $this->phaseThreeDocument()->toArray();
        $payload['blocks'] = [$payload['blocks'][3]];
        $payload['blocks'][0]['props']['items'][0]['url'] = 'javascript:alert(1)';
        try {
            $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
            self::fail('An unsafe download route was accepted.');
        } catch (DocumentCompileException) {
            self::assertTrue(true);
        }

        $payload = $this->phaseThreeDocument()->toArray();
        $payload['blocks'] = [$payload['blocks'][5]];
        $payload['blocks'][0]['props']['detailBasePath'] = '//attacker.example/products';
        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    /**
     * @return array<string, mixed>
     */
    private function catalogPayload(): array
    {
        $contents = file_get_contents(dirname(__DIR__).'/Contract/document-catalog-v1.fixture.json');
        self::assertIsString($contents);

        return json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
    }

    private function foundationDocument(): PageBuilderDocument
    {
        $contents = file_get_contents(dirname(__DIR__).'/Contract/document-foundation-v1.fixture.json');
        self::assertIsString($contents);

        return PageBuilderDocument::fromArray(json_decode($contents, true, flags: JSON_THROW_ON_ERROR));
    }

    private function productionLibraryDocument(): PageBuilderDocument
    {
        $blocks = [
            ['type' => 'content.divider-01', 'props' => ['variant' => 'gradient', 'width' => 'standard', 'label' => '서비스 안내']],
            ['type' => 'content.blockquote-01', 'props' => ['quote' => '좋은 페이지는 다음 행동을 분명하게 만듭니다.', 'citation' => '김기획', 'role' => '제품 책임자', 'alignment' => 'left', 'variant' => 'mark']],
            ['type' => 'content.notice-01', 'props' => ['tone' => 'info', 'title' => '방문 전 확인해 주세요', 'body' => '운영 시간과 준비 사항을 확인하세요.', 'actionLabel' => '운영 안내', 'actionUrl' => '/guide']],
            ['type' => 'content.card-grid-01', 'props' => ['eyebrow' => 'SERVICES', 'heading' => '필요한 서비스를 고르세요', 'items' => [['kicker' => '01', 'title' => '상담', 'body' => '목표를 정리합니다.', 'linkLabel' => '상담 보기', 'linkUrl' => '/consulting'], ['kicker' => '02', 'title' => '구축', 'body' => '결과물을 만듭니다.', 'linkLabel' => '구축 보기', 'linkUrl' => '/build']], 'columns' => 2, 'variant' => 'outlined']],
            ['type' => 'navigation.breadcrumbs-01', 'props' => ['items' => [['label' => '홈', 'url' => '/'], ['label' => '서비스', 'url' => '/services']], 'currentLabel' => '상세 안내']],
            ['type' => 'navigation.anchor-menu-01', 'props' => ['label' => '이 페이지에서', 'items' => [['label' => '소개', 'anchor' => 'intro'], ['label' => '가격', 'anchor' => 'pricing']], 'sticky' => true, 'alignment' => 'center']],
            ['type' => 'navigation.social-links-01', 'props' => ['heading' => '공식 채널', 'items' => [['network' => 'instagram', 'label' => '인스타그램', 'url' => 'https://instagram.com/example'], ['network' => 'blog', 'label' => '블로그', 'url' => '/blog']], 'variant' => 'icons', 'alignment' => 'left']],
            ['type' => 'media.image-carousel-01', 'props' => ['eyebrow' => 'GALLERY', 'heading' => '공간을 미리 만나보세요', 'images' => [['src' => '', 'alt' => '밝은 상담 공간', 'caption' => '편안한 상담 공간'], ['src' => '/storage/space-2.webp', 'alt' => '제품 전시 공간', 'caption' => '제품 전시 공간']], 'autoplay' => false, 'interval' => 5000, 'controls' => 'both', 'aspectRatio' => '16:9']],
        ];
        $blocks = array_map(static fn (array $block, int $index): array => [
            'instance_id' => '00000000-0000-4000-8000-'.str_pad((string) (201 + $index), 12, '0', STR_PAD_LEFT),
            'type' => $block['type'], 'block_version' => 1, 'props' => $block['props'], 'slots' => [],
        ], $blocks, array_keys($blocks));

        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000200', slug: 'production-library', mode: 'canvas', locale: 'ko', tokens: [], blocks: $blocks,
        );
    }

    private function dynamicDocument(string $detailBasePath = '/shop/products'): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000080',
            slug: 'g7-data',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000081',
                    'type' => 'g7.board-recent-posts-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'NEWS', 'heading' => '최근 게시글', 'source' => 'popular',
                        'period' => 'week', 'limit' => 6, 'audience' => 'all',
                        'emptyMessage' => '게시글이 없습니다.',
                    ],
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000082',
                    'type' => 'g7.ecommerce-product-grid-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'SHOP', 'heading' => '신상품', 'source' => 'new',
                        'limit' => 4, 'columns' => 4, 'audience' => 'member',
                        'detailBasePath' => $detailBasePath, 'emptyMessage' => '상품이 없습니다.',
                    ],
                    'slots' => [],
                ],
            ],
        );
    }

    private function formAndMapDocument(): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000091',
            slug: 'business-contact',
            mode: 'canvas',
            locale: 'ko',
            tokens: ['design.color_mode' => 'system'],
            blocks: [
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000092',
                    'type' => 'form.inquiry-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'CONTACT', 'heading' => '문의하세요', 'description' => '영업일 기준으로 답변합니다.',
                        'formKind' => 'inquiry', 'submitLabel' => '문의 보내기', 'successMessage' => '접수되었습니다.',
                        'privacyLabel' => '개인정보 수집에 동의합니다.', 'showPhone' => true, 'showSubject' => true,
                    ],
                    'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-000000000093',
                    'type' => 'location.map-directions-01',
                    'block_version' => 1,
                    'props' => [
                        'eyebrow' => 'LOCATION', 'heading' => '찾아오시는 길', 'description' => '대중교통을 이용해 주세요.',
                        'address' => '서울특별시 중구 세종대로 110', 'latitude' => 37.5665, 'longitude' => 126.9780,
                        'zoom' => 16, 'provider' => 'openstreetmap', 'directionsLabel' => '길찾기',
                        'directionsUrl' => 'https://www.openstreetmap.org/directions', 'phone' => '02-1234-5678',
                        'hours' => '평일 09:00~18:00', 'parking' => '주차 1시간 지원',
                    ],
                    'slots' => [],
                ],
            ],
        );
    }

    private function phaseTwoDocument(): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-0000000000a0',
            slug: 'phase-two-catalog',
            mode: 'canvas',
            locale: 'ko',
            tokens: ['design.color_mode' => 'dark'],
            blocks: [
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000a1', 'type' => 'trust.testimonials-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '후기', 'heading' => '고객 이야기', 'layout' => 'grid', 'items' => [
                        ['quote' => '빠르게 만들었습니다.', 'name' => '김고객', 'role' => '대표', 'company' => '예시회사', 'avatarSrc' => '', 'avatarAlt' => '', 'rating' => 5],
                        ['quote' => '운영이 편해졌습니다.', 'name' => '이고객', 'role' => '운영자', 'company' => '샘플회사', 'avatarSrc' => '', 'avatarAlt' => '', 'rating' => 4],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000a2', 'type' => 'content.faq-accordion-01', 'block_version' => 1,
                    'props' => ['eyebrow' => 'FAQ', 'heading' => '질문과 답변', 'behavior' => 'single', 'openFirst' => true, 'items' => [
                        ['question' => '어떻게 시작하나요?', 'answer' => '블록을 선택해 시작합니다.'],
                        ['question' => '모바일을 지원하나요?', 'answer' => '반응형 출력을 지원합니다.'],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000a3', 'type' => 'content.process-timeline-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '과정', 'heading' => '진행 방법', 'layout' => 'horizontal', 'items' => [
                        ['title' => '선택', 'body' => '블록을 선택합니다.', 'linkLabel' => '', 'linkUrl' => ''],
                        ['title' => '발행', 'body' => '검토 후 발행합니다.', 'linkLabel' => '안내', 'linkUrl' => '/guide'],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000a4', 'type' => 'content.tabs-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '안내', 'heading' => '서비스 안내', 'initialTab' => 1, 'style' => 'underline', 'items' => [
                        ['label' => '기획', 'heading' => '기획 안내', 'body' => '목표를 정합니다.'],
                        ['label' => '운영', 'heading' => '운영 안내', 'body' => '안전하게 발행합니다.'],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000a5', 'type' => 'commerce.comparison-table-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '비교', 'heading' => '플랜 비교', 'highlightColumn' => 1, 'columns' => [
                        ['title' => '기본', 'description' => '시작용'], ['title' => '성장', 'description' => '운영용'],
                    ], 'rows' => [
                        ['feature' => '페이지', 'values' => ['3개', '무제한']], ['feature' => '지원', 'values' => ['문서', '이메일']],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000a6', 'type' => 'content.article-list-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '소식', 'heading' => '새로운 이야기', 'layout' => 'list', 'items' => [
                        ['category' => '제품', 'title' => '첫 소식', 'summary' => '첫 번째 소식입니다.', 'date' => '2026-08-21', 'imageSrc' => '', 'imageAlt' => '', 'url' => '/news/first'],
                        ['category' => '가이드', 'title' => '두 번째 소식', 'summary' => '두 번째 소식입니다.', 'date' => '2026-08-20', 'imageSrc' => '', 'imageAlt' => '', 'url' => '/news/second'],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000a7', 'type' => 'media.video-embed-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '영상', 'heading' => '제품 소개', 'caption' => '제품 소개 영상입니다.', 'provider' => 'youtube', 'videoId' => 'abcDEF12345', 'ratio' => '16:9'], 'slots' => [],
                ],
            ],
        );
    }

    private function phaseThreeDocument(): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-0000000000b0',
            slug: 'phase-three-catalog',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000b1', 'type' => 'trust.logo-carousel-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '파트너', 'heading' => '함께합니다', 'autoplay' => true, 'interval' => 5000, 'logos' => [
                        ['name' => 'A', 'imageSrc' => '', 'imageAlt' => '', 'url' => '/a'],
                        ['name' => 'B', 'imageSrc' => '', 'imageAlt' => '', 'url' => '/b'],
                        ['name' => 'C', 'imageSrc' => '', 'imageAlt' => '', 'url' => '/c'],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000b2', 'type' => 'trust.testimonial-slider-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '후기', 'heading' => '고객 이야기', 'autoplay' => false, 'interval' => 7000, 'items' => [
                        ['quote' => '좋습니다.', 'name' => '김고객', 'role' => '대표', 'company' => 'A', 'avatarSrc' => '', 'avatarAlt' => '', 'rating' => 5],
                        ['quote' => '편합니다.', 'name' => '이고객', 'role' => '운영', 'company' => 'B', 'avatarSrc' => '', 'avatarAlt' => '', 'rating' => 4],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000b3', 'type' => 'content.event-schedule-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '일정', 'heading' => '다가오는 행사', 'layout' => 'agenda', 'items' => [
                        ['date' => '2026-09-03', 'time' => '14:00', 'title' => '웨비나', 'location' => '온라인', 'description' => '제품을 소개합니다.', 'buttonLabel' => '신청', 'buttonUrl' => '/events/1'],
                    ]], 'motion' => ['preset' => 'stagger', 'intensity' => 'normal', 'trigger' => 'once', 'stagger_ms' => 100], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000b4', 'type' => 'content.download-resources-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '자료', 'heading' => '다운로드', 'items' => [
                        ['title' => '소개서', 'description' => '제품 소개서입니다.', 'fileType' => 'PDF', 'fileSize' => '2 MB', 'buttonLabel' => '받기', 'url' => '/files/guide.pdf'],
                    ]], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000b5', 'type' => 'g7.board-content-archive-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '아카이브', 'heading' => '게시글', 'source' => 'recent', 'period' => 'month', 'limit' => 12, 'pageSize' => 4, 'audience' => 'all', 'showSearch' => true, 'showBoardFilter' => true, 'emptyMessage' => '게시글이 없습니다.'], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000b6', 'type' => 'g7.ecommerce-product-showcase-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '상품', 'heading' => '추천', 'source' => 'new', 'limit' => 6, 'pageSize' => 3, 'audience' => 'member', 'detailBasePath' => '/shop/products', 'layout' => 'featured', 'emptyMessage' => '상품이 없습니다.'], 'slots' => [],
                ],
            ],
        );
    }

    private function phaseFourDocument(): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-0000000000c0',
            slug: 'phase-four-data',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000c1', 'type' => 'g7.board-post-detail-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '게시글', 'heading' => '공지 상세', 'boardSlug' => 'notice', 'postId' => 17, 'detailUrl' => '/board/notice/17', 'linkLabel' => '전체 보기', 'audience' => 'all', 'showContent' => true, 'emptyMessage' => '게시글이 없습니다.'],
                    'visibility' => ['audience' => 'member'], 'motion' => ['preset' => 'reveal', 'intensity' => 'normal', 'trigger' => 'once', 'stagger_ms' => 100], 'slots' => [],
                ],
                [
                    'instance_id' => '00000000-0000-4000-8000-0000000000c2', 'type' => 'g7.ecommerce-product-detail-01', 'block_version' => 1,
                    'props' => ['eyebrow' => '상품', 'heading' => '상품 상세', 'productKey' => 'SKU-17', 'detailUrl' => '/shop/products/SKU-17', 'buttonLabel' => '구매 정보 보기', 'audience' => 'guest', 'showDescription' => false, 'emptyMessage' => '상품이 없습니다.'], 'slots' => [],
                ],
            ],
        );
    }

    /** @param list<PageBuilderDocument> $documents */
    private function compileArtifacts(array $documents): string
    {
        $artifacts = '';
        foreach ($documents as $document) {
            $artifacts .= (string) $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7')->artifact;
        }

        return $artifacts;
    }

    private function assertCompileRejected(PageBuilderDocument $document): void
    {
        try {
            $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7');
            self::fail('Unsafe or invalid rich text compiled successfully.');
        } catch (DocumentCompileException) {
            self::addToAssertionCount(1);
        }
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
