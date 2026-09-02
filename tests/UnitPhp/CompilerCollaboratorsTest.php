<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\ElementAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CompilerCollaboratorsTest extends TestCase
{
    public function test_rich_text_preserves_typed_marks_and_projects_visible_text(): void
    {
        $sanitizer = new RichTextSanitizer;
        $html = '<p>첫 <span data-g7pb-font-size-rem="3" data-g7pb-tone="accent">문장</span></p><p><a href="/guide">둘째</a></p>';

        self::assertSame('첫 <span data-g7pb-font-size-rem="3" data-g7pb-tone="accent">문장</span><br><a href="/guide" rel="noopener noreferrer">둘째</a>', $sanitizer->sanitizeInlineRichText($html));
        self::assertSame('첫 문장 둘째', $sanitizer->promotedRichTextPlainText($html, false, true));
        self::assertSame('&lt;비교&gt;', $sanitizer->sanitizePromotedInlineRichText('<비교>'));
    }

    #[DataProvider('unsafeRichText')]
    public function test_rich_text_rejects_unsafe_markup_and_invalid_link_context(string $html, bool $allowLinks): void
    {
        $this->expectException(DocumentCompileException::class);
        (new RichTextSanitizer)->sanitizeRichText($html, $allowLinks);
    }

    /** @return iterable<string, array{string, bool}> */
    public static function unsafeRichText(): iterable
    {
        yield 'event handler' => ['<p onclick="alert(1)">위험</p>', true];
        yield 'unsafe URL' => ['<p><a href="javascript:alert(1)">위험</a></p>', true];
        yield 'nested link' => ['<p><a href="/one"><a href="/two">중첩</a></a></p>', true];
        yield 'links in link-owned field' => ['<p><a href="/guide">제목</a></p>', false];
        yield 'arbitrary typed font size' => ['<p><span data-g7pb-font-size-rem="3.1">본문</span></p>', true];
    }

    public function test_block_and_rich_text_urls_share_the_same_policy_without_sharing_image_capabilities(): void
    {
        $urls = new CompilationUrlPolicy;
        $urls->assertAllowedUrl('mailto:hello@example.com', 'Action');
        $urls->assertAllowedUrl('#g7-action-logout', 'Action');
        $urls->assertAllowedImageUrl('/assets/photo.png');
        self::assertSame('tel:+821012345678', $urls->phoneHref('+82 (10) 1234-5678'));
        self::assertStringContainsString('href="mailto:hello@example.com"', (new RichTextSanitizer($urls))->sanitizeRichText('<p><a href="mailto:hello@example.com">문의</a></p>'));

        $this->expectException(DocumentCompileException::class);
        $urls->assertAllowedImageUrl('mailto:hello@example.com');
    }

    #[DataProvider('unsafeUrls')]
    public function test_url_policy_rejects_unsafe_links(string $url): void
    {
        $this->expectException(DocumentCompileException::class);
        (new CompilationUrlPolicy)->assertAllowedUrl($url, 'Action');
    }

    /** @return iterable<string, array{string}> */
    public static function unsafeUrls(): iterable
    {
        yield 'protocol relative' => ['//external.example/path'];
        yield 'insecure HTTP' => ['http://external.example/path'];
        yield 'JavaScript' => ['javascript:alert(1)'];
        yield 'control character' => ["/path\nnext"];
        yield 'backslash' => ['/\\external.example'];
    }

    public function test_element_styles_target_the_named_field_after_unrelated_markup_is_wrapped(): void
    {
        $compiler = new ElementAppearanceCompiler;
        $result = $compiler->apply(
            '<section><div><h2 class="g7pb-heading-block__heading">제목</h2></div><p>설명</p></section>',
            ['appearance' => ['elements' => ['heading' => ['weight' => 'bold']]]],
            'content.heading-01',
        );

        self::assertStringContainsString('class="g7pb-heading-block__heading g7pb-element-weight--bold"', $result);
        self::assertStringContainsString('<p>설명</p>', $result);
        self::assertSame(1, substr_count($result, 'g7pb-element-weight--bold'));
    }

    public function test_element_styles_reject_missing_targets_instead_of_styling_another_node(): void
    {
        $this->expectException(DocumentCompileException::class);
        $this->expectExceptionMessage('Element appearance target heading is not supported');
        (new ElementAppearanceCompiler)->apply('<section><h2>다른 제목</h2></section>', ['appearance' => ['elements' => ['heading' => ['weight' => 'bold']]]], 'content.heading-01');
    }
}
