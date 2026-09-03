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

final readonly class EventScheduleBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.event-schedule-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Event schedule');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! in_array($layout, ['agenda', 'timeline'], true) || ! is_array($items) || count($items) < 1 || count($items) > 12) {
            throw new DocumentCompileException('Event schedule configuration is invalid.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Event item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['date', 'time', 'title', 'location', 'description', 'buttonLabel', 'buttonUrl'], "Event item {$index}");
            $date = $this->properties->requiredString($item, 'date', 40);
            $time = $this->properties->optionalString($item, 'time', 40) ?? '';
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 240);
            $location = $this->properties->optionalString($item, 'location', 240) ?? '';
            $description = $this->properties->requiredString($item, 'description', 1500);
            $buttonLabel = $this->properties->optionalString($item, 'buttonLabel', 120) ?? '';
            $buttonUrl = $this->properties->optionalString($item, 'buttonUrl', 2048) ?? '';
            if (($buttonLabel === '') !== ($buttonUrl === '')) {
                throw new DocumentCompileException("Event item {$index} link requires both a label and URL.");
            }
            $action = '';
            if ($buttonUrl !== '') {
                $this->urls->assertAllowedUrl($buttonUrl, "Event item {$index}");
                $action = '<a href="'.$this->escaper->escapeAttribute($buttonUrl).'">'.$this->escaper->escape($buttonLabel).' <span aria-hidden="true">→</span></a>';
            }
            $descriptionMarkup = $this->richText->hasRichTextMarkup($description)
                ? '<div class="g7pb-events__description">'.$this->richText->sanitizeRichText($description).'</div>'
                : '<p>'.$this->escaper->formatText($description).'</p>';
            $compiled[] = '<li><time datetime="'.$this->escaper->escapeAttribute($date.($time === '' ? '' : 'T'.$time)).'"><strong>'.$this->escaper->escape($date).'</strong>'.($time === '' ? '' : '<span>'.$this->escaper->escape($time).'</span>').'</time><article>'.($location === '' ? '' : '<p class="g7pb-events__location">'.$this->escaper->escape($location).'</p>').'<h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$descriptionMarkup.$action.'</article></li>';
        }

        return '<section class="g7pb-block g7pb-events g7pb-events--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="event-schedule">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<ol>'.implode('', $compiled).'</ol></section>';
    }
}
