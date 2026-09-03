<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class DividerBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.divider-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['variant', 'width', 'label', 'appearance'], 'Divider');
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $width = $this->properties->requiredString($props, 'width', 16);
        $label = $this->properties->optionalString($props, 'label', 120) ?? '';
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        if (! in_array($variant, ['solid', 'dashed', 'gradient'], true)) {
            throw new DocumentCompileException('Divider variant is invalid.');
        }
        if (! in_array($width, ['narrow', 'standard', 'full'], true)) {
            throw new DocumentCompileException('Divider width is invalid.');
        }
        $labelMarkup = $label === '' ? '' : '<span class="g7pb-divider__label">'.$this->escaper->escape($label).'</span>';

        return '<section class="g7pb-block g7pb-divider g7pb-divider--'.$variant.' g7pb-divider--'.$width.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="divider"><span class="g7pb-divider__line" aria-hidden="true"></span>'.$labelMarkup.'<span class="g7pb-divider__line" aria-hidden="true"></span></section>';
    }
}
