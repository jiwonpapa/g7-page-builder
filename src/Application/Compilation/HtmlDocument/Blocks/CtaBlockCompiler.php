<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class CtaBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.cta-split-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys(
            $props,
            ['eyebrow', 'heading', 'body', 'primaryLink', 'secondaryLink', 'theme', 'layout', 'appearance'],
            'CTA',
        );

        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $body = $this->properties->optionalRichTextString($props, 'body', 2000);
        $theme = $this->properties->requiredString($props, 'theme', 16);
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');

        if (! in_array($theme, ['light', 'dark'], true)) {
            throw new DocumentCompileException('CTA theme must be light or dark.');
        }
        if ($layout !== null && ! in_array($layout, ['split', 'centered', 'banner', 'panel'], true)) {
            throw new DocumentCompileException('CTA layout is invalid.');
        }

        $copy = [];
        if ($eyebrow !== null && $eyebrow !== '') {
            $copy[] = '<p class="g7pb-cta__eyebrow">'.$this->escaper->escape($eyebrow).'</p>';
        }
        $copy[] = '<h2 class="g7pb-cta__heading">'.$this->richText->sanitizeInlineRichText($heading).'</h2>';
        if ($body !== null && $body !== '') {
            $copy[] = $this->richText->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-cta__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-cta__body">'.$this->escaper->formatText($body).'</p>';
        }

        $actions = [];
        $primaryLink = $this->properties->optionalMap($props, 'primaryLink');
        if ($primaryLink !== null) {
            $actions[] = $this->markup->compileActionLink($primaryLink, 'CTA primary link', 'g7pb-button g7pb-button--primary');
        }
        $secondaryLink = $this->properties->optionalMap($props, 'secondaryLink');
        if ($secondaryLink !== null) {
            $actions[] = $this->markup->compileActionLink($secondaryLink, 'CTA secondary link', 'g7pb-button g7pb-button--secondary');
        }

        $actionMarkup = $actions === []
            ? ''
            : '<div class="g7pb-cta__actions">'.implode('', $actions).'</div>';

        $layoutClass = $layout === null ? '' : ' g7pb-cta--layout-'.$layout;

        return '<section class="g7pb-block g7pb-cta g7pb-cta--'.$theme.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="cta"><div class="g7pb-cta__copy">'.implode('', $copy).'</div>'.$actionMarkup.'</section>';
    }
}
