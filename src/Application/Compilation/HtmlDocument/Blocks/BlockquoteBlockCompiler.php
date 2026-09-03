<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class BlockquoteBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.blockquote-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['quote', 'citation', 'role', 'alignment', 'variant', 'appearance'], 'Blockquote');
        $quote = $this->properties->requiredString($props, 'quote', 2000);
        $citation = $this->properties->requiredString($props, 'citation', 120);
        $role = $this->properties->optionalString($props, 'role', 160) ?? '';
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($alignment, ['left', 'center'], true) || ! in_array($variant, ['line', 'mark'], true)) {
            throw new DocumentCompileException('Blockquote alignment or variant is invalid.');
        }
        $roleMarkup = $role === '' ? '' : '<span class="g7pb-blockquote__role">'.$this->escaper->escape($role).'</span>';

        $quoteMarkup = $this->richText->hasRichTextMarkup($quote)
            ? '<div class="g7pb-blockquote__quote">'.$this->richText->sanitizeRichText($quote).'</div>'
            : '<p class="g7pb-blockquote__quote">'.$this->escaper->formatText($quote).'</p>';

        return '<section class="g7pb-block g7pb-blockquote g7pb-blockquote--'.$alignment.' g7pb-blockquote--'.$variant.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="blockquote"><blockquote>'.$quoteMarkup.'<footer><cite>'.$this->escaper->escape($citation).'</cite>'.$roleMarkup.'</footer></blockquote></section>';
    }
}
