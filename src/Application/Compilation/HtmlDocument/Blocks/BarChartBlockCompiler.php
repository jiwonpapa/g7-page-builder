<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class BarChartBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.bar-chart-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'unit', 'items', 'appearance'], 'Bar Chart');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->properties->optionalRichTextString($props, 'description', 1000) ?? '';
        $unit = $this->properties->optionalString($props, 'unit', 20) ?? '';
        $items = $props['items'] ?? null;
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        $tones = ['blue', 'indigo', 'emerald', 'amber'];

        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Bar Chart must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Bar Chart item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'value', 'tone'], "Bar Chart item {$index}");
            $label = $this->properties->requiredString($item, 'label', 120);
            $value = $this->properties->requiredNumber($item, 'value', 0, 100);
            $tone = $this->properties->requiredString($item, 'tone', 16);
            if (! in_array($tone, $tones, true)) {
                throw new DocumentCompileException("Bar Chart item {$index} tone is invalid.");
            }
            $formattedValue = rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
            $compiled[] = '<label><span><span>'.$this->escaper->escape($label).'</span><strong>'.$this->escaper->escape($formattedValue).'<span class="g7pb-bar-chart__unit">'.$this->escaper->escape($unit).'</span></strong></span><progress max="100" value="'.$this->escaper->escapeAttribute($formattedValue).'" data-tone="'.$tone.'">'.$this->escaper->escape($formattedValue).'</progress></label>';
        }

        $descriptionMarkup = $description === '' ? '' : ($this->richText->hasCanonicalRichTextMarkup($description)
            ? '<div class="g7pb-bar-chart__description">'.$this->richText->sanitizeRichText($description).'</div>'
            : '<p>'.$this->escaper->formatText($description).'</p>');

        return '<section class="g7pb-block g7pb-bar-chart '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="bar-chart"><figure><figcaption>'.$this->markup->compileSectionHeading($eyebrow, $heading).$descriptionMarkup.'</figcaption><div class="g7pb-bar-chart__plot">'.implode('', $compiled).'</div></figure></section>';
    }
}
