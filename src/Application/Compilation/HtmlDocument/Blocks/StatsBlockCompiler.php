<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class StatsBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private BlockIconCompiler $icons,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.stats-icons-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Stats');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        $icons = ['trend', 'users', 'target', 'chart'];
        if ($layout !== null && ! in_array($layout, ['grid', 'strip', 'split', 'editorial'], true)) {
            throw new DocumentCompileException('Stats layout is invalid.');
        }

        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Stats must contain between two and six items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Stats item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['icon', 'value', 'label', 'detail'], "Stats item {$index}");
            $icon = $this->properties->requiredString($item, 'icon', 32);
            if (! in_array($icon, $icons, true)) {
                throw new DocumentCompileException("Stats item {$index} icon is invalid.");
            }
            $value = $this->properties->requiredString($item, 'value', 80);
            $label = $this->properties->requiredInlineRichTextString($item, 'label', 120);
            $detail = $this->properties->optionalRichTextString($item, 'detail', 500) ?? '';
            $detailMarkup = $this->richText->hasCanonicalRichTextMarkup($detail)
                ? '<div class="g7pb-stats__detail">'.$this->richText->sanitizeRichText($detail).'</div>'
                : '<p>'.$this->escaper->formatText($detail).'</p>';
            $compiled[] = '<article>'.$this->icons->catalogIconSvg($icon, 'g7pb-stats__icon g7pb-stats__icon--'.$icon).'<strong>'.$this->escaper->escape($value).'</strong><h3>'.$this->richText->sanitizePromotedInlineRichText($label).'</h3>'.$detailMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-stats--layout-'.$layout;

        return '<section class="g7pb-block g7pb-stats'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="stats">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-stats__grid">'.implode('', $compiled).'</div></section>';
    }
}
