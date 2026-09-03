<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class FaqAccordionBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.faq-accordion-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'behavior', 'openFirst', 'appearance'], 'FAQ accordion');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $behavior = $this->properties->requiredString($props, 'behavior', 16);
        $openFirst = $this->properties->requiredBoolean($props, 'openFirst');
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! in_array($behavior, ['single', 'multiple'], true)) {
            throw new DocumentCompileException('FAQ accordion behavior is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 12) {
            throw new DocumentCompileException('FAQ accordion must contain between two and twelve items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("FAQ item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['question', 'answer'], "FAQ item {$index}");
            $question = $this->properties->requiredInlineRichTextString($item, 'question', 300);
            $answer = $this->properties->requiredString($item, 'answer', 4000);
            $open = $openFirst && $index === 0;
            $compiled[] = '<div class="g7pb-faq__item" data-g7pb-accordion-item data-g7pb-open="'.($open ? 'true' : 'false').'">'
                .'<div class="g7pb-faq__trigger" role="button" tabindex="0" data-g7pb-accordion-trigger aria-expanded="'.($open ? 'true' : 'false').'"><span>'.$this->richText->sanitizePromotedInlineRichText($question).'</span><i aria-hidden="true">+</i></div>'
                .'<div class="g7pb-faq__answer" data-g7pb-accordion-panel>'.$this->richText->sanitizeRichText($answer).'</div></div>';
        }

        return '<section class="g7pb-block g7pb-faq '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="faq-accordion" data-g7pb-accordion data-g7pb-accordion-behavior="'.$behavior.'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-faq__items">'.implode('', $compiled).'</div></section>';
    }
}
