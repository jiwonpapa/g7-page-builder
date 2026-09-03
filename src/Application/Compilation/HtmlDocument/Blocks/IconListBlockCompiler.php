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

final readonly class IconListBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.icon-list-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Icon list');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 24);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Icon list must contain between two and eight items.');
        }
        if (! in_array($layout, ['single', 'two-column'], true)) {
            throw new DocumentCompileException('Icon list layout is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Icon list item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['icon', 'title', 'body'], "Icon list item {$index}");
            $icon = $this->properties->requiredString($item, 'icon', 32);
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->properties->optionalRichTextString($item, 'body', 2000) ?? '';
            if (! in_array($icon, BlockIconCompiler::FEATURE_ICONS, true)) {
                throw new DocumentCompileException("Icon list item {$index} uses an unsupported icon.");
            }
            $bodyMarkup = $this->richText->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-icon-list__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->escaper->formatText($body).'</p>';
            $compiled[] = '<li class="g7pb-icon-list__item">'.$this->icons->catalogIconSvg($icon, 'g7pb-icon-list__icon g7pb-icon--'.$icon).'<div><h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.'</div></li>';
        }

        return '<section class="g7pb-block g7pb-icon-list g7pb-icon-list--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="icon-list">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<ul class="g7pb-icon-list__items">'.implode('', $compiled).'</ul></section>';
    }
}
