<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class FeaturesBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockIconCompiler $icons,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.features-grid-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $title = $this->properties->requiredInlineRichTextString($props, 'title', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');

        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Features must contain between two and six items.');
        }
        if ($layout !== null && ! in_array($layout, ['grid', 'bento', 'editorial', 'panel', 'list'], true)) {
            throw new DocumentCompileException('Features layout is invalid.');
        }

        $compiledItems = [];

        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Feature item {$index} must be an object.");
            }

            $icon = $this->properties->requiredString($item, 'icon', 32);
            $itemTitle = $this->properties->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->properties->requiredRichTextString($item, 'body', 2000);

            if (! in_array($icon, BlockIconCompiler::FEATURE_ICONS, true)) {
                throw new DocumentCompileException("Feature item {$index} uses an unsupported icon.");
            }

            $bodyMarkup = $this->richText->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-features__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->escaper->formatText($body).'</p>';
            $compiledItems[] = '<article class="g7pb-features__item">'.$this->icons->catalogIconSvg($icon, 'g7pb-features__icon g7pb-icon--'.$icon).'<h3>'.$this->richText->sanitizePromotedInlineRichText($itemTitle).'</h3>'.$bodyMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-features--layout-'.$layout;

        return '<section class="g7pb-block g7pb-features'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="features"><h2 class="g7pb-features__title">'.$this->richText->sanitizeInlineRichText($title).'</h2><div class="g7pb-features__grid">'.implode('', $compiledItems).'</div></section>';
    }
}
