<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class SocialLinksBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private CompilationUrlPolicy $urls,
        private BlockIconCompiler $icons,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.social-links-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['heading', 'items', 'variant', 'alignment', 'appearance'], 'Social links');
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        $networks = ['instagram', 'youtube', 'facebook', 'linkedin', 'x', 'kakao', 'blog', 'website'];
        if (! is_array($items) || count($items) < 1 || count($items) > 8) {
            throw new DocumentCompileException('Social links must contain between one and eight items.');
        }
        if (! in_array($variant, ['icons', 'labels'], true) || ! in_array($alignment, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Social links variant or alignment is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Social link item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['network', 'label', 'url'], "Social link item {$index}");
            $network = $this->properties->requiredString($item, 'network', 16);
            $label = $this->properties->requiredString($item, 'label', 120);
            $url = $this->properties->requiredString($item, 'url', 2048);
            if (! in_array($network, $networks, true)) {
                throw new DocumentCompileException("Social link item {$index} network is invalid.");
            }
            $this->urls->assertPageOrHttpsUrl($url, "Social link item {$index}");
            $compiled[] = '<li><a class="g7pb-social-links__link g7pb-social-links__link--'.$network.'" href="'.$this->escaper->escapeAttribute($url).'" rel="noopener noreferrer"><span class="g7pb-social-links__icon" aria-hidden="true">'.$this->icons->catalogIconSvg($network, 'g7pb-social-links__glyph').'</span><span>'.$this->escaper->escape($label).'</span></a></li>';
        }

        return '<section class="g7pb-block g7pb-social-links g7pb-social-links--'.$variant.' g7pb-social-links--'.$alignment.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="social-links"><nav aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'"><h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2><ul>'.implode('', $compiled).'</ul></nav></section>';
    }
}
