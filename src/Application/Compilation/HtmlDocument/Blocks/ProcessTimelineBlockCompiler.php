<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class ProcessTimelineBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.process-timeline-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Process timeline');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! in_array($layout, ['vertical', 'horizontal'], true)) {
            throw new DocumentCompileException('Process timeline layout is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Process timeline must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Process step {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['title', 'body', 'linkLabel', 'linkUrl'], "Process step {$index}");
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 200);
            $body = $this->properties->requiredString($item, 'body', 1500);
            $linkLabel = $this->properties->optionalString($item, 'linkLabel', 120) ?? '';
            $linkUrl = $this->properties->optionalString($item, 'linkUrl', 2048) ?? '';
            if (($linkLabel === '') !== ($linkUrl === '')) {
                throw new DocumentCompileException("Process step {$index} link requires both a label and URL.");
            }
            $link = '';
            if ($linkUrl !== '') {
                $this->urls->assertAllowedUrl($linkUrl, "Process step {$index}");
                $link = '<a href="'.$this->escaper->escapeAttribute($linkUrl).'">'.$this->escaper->escape($linkLabel).' <span aria-hidden="true">→</span></a>';
            }
            $bodyMarkup = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-process__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->escaper->formatText($body).'</p>';
            $compiled[] = '<li><span class="g7pb-process__number">'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT).'</span><h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</li>';
        }

        return '<section class="g7pb-block g7pb-process g7pb-process--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="process-timeline">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<ol>'.implode('', $compiled).'</ol></section>';
    }
}
