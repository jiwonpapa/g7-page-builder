<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class ComparisonTableBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.comparison-table-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'columns', 'rows', 'highlightColumn', 'appearance'], 'Comparison table');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $columns = $props['columns'] ?? null;
        $rows = $props['rows'] ?? null;
        $highlight = $props['highlightColumn'] ?? null;
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! is_array($columns) || count($columns) < 2 || count($columns) > 4) {
            throw new DocumentCompileException('Comparison table must contain between two and four columns.');
        }
        if (! is_array($rows) || count($rows) < 1 || count($rows) > 12) {
            throw new DocumentCompileException('Comparison table must contain between one and twelve rows.');
        }
        if (! is_int($highlight) || $highlight < -1 || $highlight >= count($columns)) {
            throw new DocumentCompileException('Comparison table highlighted column is invalid.');
        }

        $headings = [];
        foreach (array_values($columns) as $index => $column) {
            if (! is_array($column)) {
                throw new DocumentCompileException("Comparison column {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($column, ['title', 'description'], "Comparison column {$index}");
            $title = $this->properties->requiredInlineRichTextString($column, 'title', 120);
            $description = $this->properties->optionalInlineRichTextString($column, 'description', 300) ?? '';
            $headings[] = '<th scope="col"'.($highlight === $index ? ' class="is-highlighted"' : '').'><strong>'.$this->richText->sanitizePromotedInlineRichText($title).'</strong>'.($description === '' ? '' : '<span>'.$this->richText->sanitizePromotedInlineRichText($description).'</span>').'</th>';
        }

        $compiledRows = [];
        foreach (array_values($rows) as $rowIndex => $row) {
            if (! is_array($row)) {
                throw new DocumentCompileException("Comparison row {$rowIndex} must be an object.");
            }
            $this->properties->assertOnlyKeys($row, ['feature', 'values'], "Comparison row {$rowIndex}");
            $feature = $this->properties->requiredInlineRichTextString($row, 'feature', 200);
            $values = $row['values'] ?? null;
            if (! is_array($values) || count($values) !== count($columns)) {
                throw new DocumentCompileException("Comparison row {$rowIndex} values must match the columns.");
            }
            $cells = [];
            foreach (array_values($values) as $columnIndex => $value) {
                if (! is_string($value) || trim($value) === '' || mb_strlen($value) > 300) {
                    throw new DocumentCompileException("Comparison row {$rowIndex} value {$columnIndex} is invalid.");
                }
                $cells[] = '<td'.($highlight === $columnIndex ? ' class="is-highlighted"' : '').'>'.$this->escaper->formatText($value).'</td>';
            }
            $compiledRows[] = '<tr><th scope="row">'.$this->richText->sanitizePromotedInlineRichText($feature).'</th>'.implode('', $cells).'</tr>';
        }

        return '<section class="g7pb-block g7pb-comparison '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="comparison-table">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-comparison__scroll" role="region" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).' 비교표" tabindex="0"><table><caption class="g7pb-visually-hidden">'.$this->escaper->escape($this->richText->inlinePlainText($heading)).'</caption><thead><tr><th scope="col">항목</th>'.implode('', $headings).'</tr></thead><tbody>'.implode('', $compiledRows).'</tbody></table></div></section>';
    }
}
