<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BasicElementBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class BasicElementBlockCompilerTest extends TestCase
{
    private function compiler(string $kind): BasicElementBlockCompiler
    {
        $properties = new BlockPropertyReader(new RichTextSanitizer);
        $escaper = new HtmlEscaper;

        return new BasicElementBlockCompiler($kind, $properties, new BlockAppearanceCompiler($properties), new BlockIconCompiler($escaper), $escaper);
    }

    public function test_static_semantics_and_escaping(): void
    {
        $compiler = $this->compiler('list');
        self::assertSame('builtin.list-01', $compiler->key());
        foreach ([false => 'ul', true => 'ol'] as $ordered => $tag) {
            $html = $compiler->compile(['ordered' => (bool) $ordered, 'items' => [['text' => '<script>alert(1)</script>'], ['text' => '한글 목록']]]);
            self::assertStringContainsString('<'.$tag.' class="g7pb-basic-list"><li>&lt;script&gt;', $html);
            self::assertStringNotContainsString('<script>', $html);
        }
        $icon = ['icon' => 'shield', 'size' => 'large', 'tone' => 'accent', 'decorative' => false, 'label' => '보안 "인증"'];
        $html = $this->compiler('icon')->compile($icon);
        self::assertStringContainsString('role="img" aria-label="보안 &quot;인증&quot;"', $html);
        self::assertStringContainsString('data-g7pb-runtime-icon', $html);
        $html = $this->compiler('icon')->compile([...$icon, 'decorative' => true]);
        self::assertStringNotContainsString('role="img"', $html);
        self::assertStringNotContainsString('aria-label=', $html);
        $badge = $this->compiler('badge')->compile(['label' => '신규 <안내>', 'icon' => '', 'size' => 'small', 'tone' => 'muted']);
        self::assertStringContainsString('신규 &lt;안내&gt;', $badge);
        self::assertStringNotContainsString('role=', $badge);
        self::assertStringNotContainsString('data-g7pb-runtime-icon', $badge);
    }

    public function test_all_allowed_icons_sizes_and_tones_compile(): void
    {
        foreach (BlockIconCompiler::FEATURE_ICONS as $icon) {
            foreach (['small', 'medium', 'large'] as $size) {
                foreach (['default', 'muted', 'accent'] as $tone) {
                    self::assertStringContainsString('g7pb-basic-size--'.$size, $this->compiler('badge')->compile(['icon' => $icon, 'label' => '안내', 'size' => $size, 'tone' => $tone]));
                }
            }
        }
        self::assertStringContainsString(str_repeat('한', 200), $this->compiler('list')->compile(['ordered' => true, 'items' => array_fill(0, 20, ['text' => str_repeat('한', 200)])]));
    }

    /** @return iterable<string, array{string, array<string, mixed>}> */
    public static function invalidProps(): iterable
    {
        $list = ['ordered' => false, 'items' => [['text' => '안내']]];
        $icon = ['icon' => 'check', 'size' => 'medium', 'tone' => 'default', 'decorative' => false, 'label' => '확인'];
        $badge = ['label' => '신규', 'icon' => '', 'size' => 'small', 'tone' => 'accent'];
        foreach ([[], array_fill(0, 21, ['text' => '항목']), [['text' => ' ']], [['text' => str_repeat('한', 201)]], [['text' => '항목', 'children' => []]], ['잘못된 항목'], ['key' => ['text' => '항목']]] as $index => $items) {
            yield 'list-'.$index => ['list', [...$list, 'items' => $items]];
        }
        yield 'list-bool' => ['list', [...$list, 'ordered' => 'false']];
        yield 'icon-empty-name' => ['icon', [...$icon, 'label' => ' ']];
        yield 'icon-long-name' => ['icon', [...$icon, 'label' => str_repeat('한', 121)]];
        yield 'icon-missing-name' => ['icon', array_diff_key($icon, ['label' => true])];
        yield 'icon-raw-svg' => ['icon', [...$icon, 'icon' => '<svg/>']];
        yield 'icon-bool' => ['icon', [...$icon, 'decorative' => 1]];
        yield 'badge-empty' => ['badge', [...$badge, 'label' => '']];
        yield 'badge-long' => ['badge', [...$badge, 'label' => str_repeat('한', 41)]];
        yield 'badge-size' => ['badge', [...$badge, 'size' => '100px']];
        yield 'badge-tone' => ['badge', [...$badge, 'tone' => '#fff']];
        yield 'badge-link' => ['badge', [...$badge, 'url' => '/']];
        yield 'badge-js' => ['badge', [...$badge, 'onClick' => 'alert(1)']];
        yield 'badge-style' => ['badge', [...$badge, 'style' => 'color:red']];
    }

    #[DataProvider('invalidProps')]
    public function test_invalid_inputs_are_rejected(string $kind, array $props): void
    {
        $this->expectException(DocumentCompileException::class);
        $this->compiler($kind)->compile($props);
    }

    public function test_unknown_compiler_kind_is_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->compiler('script');
    }
}
