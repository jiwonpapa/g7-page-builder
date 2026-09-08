<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Contracts\SlotBlockCompilerPort;

final readonly class CardBlockCompiler implements SlotBlockCompilerPort
{
    public function __construct(private BlockPropertyReader $properties, private BlockAppearanceCompiler $appearance) {}

    public function key(): string
    {
        return 'builtin.card-01';
    }

    public function compile(array $props): string
    {
        return $this->compileSlots($props, []);
    }

    public function compileSlots(array $props, array $slots): string
    {
        $this->properties->assertOnlyKeys($props, ['variant', 'appearance'], 'Card');
        $variant = $this->properties->optionalString($props, 'variant', 16) ?? 'outlined';
        if (! in_array($variant, ['plain', 'outlined'], true) || array_diff(array_keys($slots), ['media', 'body', 'actions']) !== []) {
            throw new \InvalidArgumentException('Card variant or slots are invalid.');
        }
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        $html = '<section class="g7pb-block" data-testid="page-builder-rendered-block" data-block-type="card"><article class="g7pb-single-card g7pb-single-card--'.$variant.' '.$appearance.'">';
        foreach (['media', 'body', 'actions'] as $name) {
            $html .= '<div data-card-slot="'.$name.'">'.($slots[$name] ?? '').'</div>';
        }

        return $html.'</article></section>';
    }
}
