<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class TabsBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.tabs-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'initialTab', 'style', 'appearance'], 'Tabs');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $initialTab = $props['initialTab'] ?? null;
        $style = $this->properties->requiredString($props, 'style', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($style, ['underline', 'pills'], true)) {
            throw new DocumentCompileException('Tabs style is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Tabs must contain between two and six items.');
        }
        if (! is_int($initialTab) || $initialTab < 0 || $initialTab >= count($items)) {
            throw new DocumentCompileException('Tabs initial tab is invalid.');
        }

        $buttons = [];
        $panels = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Tab item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'heading', 'body'], "Tab item {$index}");
            $label = $this->properties->requiredString($item, 'label', 80);
            $itemHeading = $this->properties->requiredInlineRichTextString($item, 'heading', 200);
            $body = $this->properties->requiredString($item, 'body', 4000);
            $selected = $initialTab === $index;
            $buttons[] = '<span data-g7pb-runtime-button role="tab" data-g7pb-tab="'.$index.'" aria-selected="'.($selected ? 'true' : 'false').'" tabindex="'.($selected ? '0' : '-1').'">'.$this->escaper->escape($label).'</span>';
            $bodyMarkup = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-tabs__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->escaper->formatText($body).'</p>';
            $panels[] = '<article role="tabpanel" data-g7pb-tab-panel="'.$index.'" tabindex="0"'.($selected ? '' : ' hidden').'><h3>'.$this->richText->sanitizePromotedInlineRichText($itemHeading).'</h3>'.$bodyMarkup.'</article>';
        }

        return '<section class="g7pb-block g7pb-tabs g7pb-tabs--'.$style.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="tabs" data-g7pb-tabs data-g7pb-tabs-initial="'.$initialTab.'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-tabs__list" role="tablist" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.implode('', $buttons).'</div><div class="g7pb-tabs__panels">'.implode('', $panels).'</div></section>';
    }
}
