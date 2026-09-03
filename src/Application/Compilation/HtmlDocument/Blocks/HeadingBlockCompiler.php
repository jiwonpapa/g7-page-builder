<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class HeadingBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.heading-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'level', 'anchor', 'appearance'], 'Heading');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $level = $this->properties->requiredIntegerChoice($props, 'level', [2, 3, 4]);
        $anchor = $this->properties->optionalString($props, 'anchor', 80) ?? '';
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        if ($anchor !== '' && preg_match('/^[a-z][a-z0-9-]{0,79}$/D', $anchor) !== 1) {
            throw new DocumentCompileException('Heading anchor is invalid.');
        }
        $eyebrowMarkup = $eyebrow === null || $eyebrow === ''
            ? ''
            : '<p class="g7pb-section-eyebrow">'.$this->escaper->escape($eyebrow).'</p>';
        $anchorAttribute = $anchor === '' ? '' : ' id="'.$this->escaper->escapeAttribute($anchor).'"';

        return '<section class="g7pb-block g7pb-heading-block '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="heading">'
            .$eyebrowMarkup.'<h'.$level.' class="g7pb-heading-block__heading"'.$anchorAttribute.'>'.$this->richText->sanitizeInlineRichText($heading).'</h'.$level.'></section>';
    }
}
