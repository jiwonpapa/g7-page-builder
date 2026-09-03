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

final readonly class CardGridBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.card-grid-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'columns', 'variant', 'layout', 'appearance'], 'Card grid');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $columns = $this->properties->requiredIntegerChoice($props, 'columns', [2, 3]);
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Card grid must contain between two and six items.');
        }
        if (! in_array($variant, ['plain', 'outlined'], true)) {
            throw new DocumentCompileException('Card grid variant is invalid.');
        }
        if ($layout !== null && ! in_array($layout, ['grid', 'bento', 'rail', 'editorial', 'numbered'], true)) {
            throw new DocumentCompileException('Card grid layout is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Card grid item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['kicker', 'title', 'body', 'linkLabel', 'linkUrl'], "Card grid item {$index}");
            $kicker = $this->properties->optionalString($item, 'kicker', 80) ?? '';
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->properties->optionalString($item, 'body', 1000) ?? '';
            $linkLabel = $this->properties->optionalString($item, 'linkLabel', 120) ?? '';
            $linkUrl = $this->properties->optionalString($item, 'linkUrl', 2048) ?? '';
            if (($linkLabel === '') !== ($linkUrl === '')) {
                throw new DocumentCompileException("Card grid item {$index} link label and URL must be provided together.");
            }
            $link = '';
            if ($linkLabel !== '') {
                $this->urls->assertAllowedUrl($linkUrl, "Card grid item {$index}");
                $link = '<a href="'.$this->escaper->escapeAttribute($linkUrl).'">'.$this->escaper->escape($linkLabel).'<span aria-hidden="true"> →</span></a>';
            }
            $bodyMarkup = $body === '' ? '' : ($this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-card-grid__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-card-grid__body">'.$this->escaper->formatText($body).'</p>');
            $compiled[] = '<article class="g7pb-card-grid__item">'.($kicker === '' ? '' : '<p class="g7pb-card-grid__kicker">'.$this->escaper->escape($kicker).'</p>').'<h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-card-grid--layout-'.$layout;

        return '<section class="g7pb-block g7pb-card-grid g7pb-card-grid--'.$columns.' g7pb-card-grid--'.$variant.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="card-grid">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-card-grid__items">'.implode('', $compiled).'</div></section>';
    }
}
