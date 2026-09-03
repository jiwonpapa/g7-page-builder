<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class AnchorMenuBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.anchor-menu-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['label', 'items', 'sticky', 'alignment', 'appearance'], 'Anchor menu');
        $label = $this->properties->requiredString($props, 'label', 120);
        $items = $props['items'] ?? null;
        $sticky = $this->properties->requiredBoolean($props, 'sticky');
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Anchor menu must contain between two and eight items.');
        }
        if (! in_array($alignment, ['left', 'center'], true)) {
            throw new DocumentCompileException('Anchor menu alignment is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Anchor menu item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'anchor'], "Anchor menu item {$index}");
            $itemLabel = $this->properties->requiredString($item, 'label', 120);
            $anchor = $this->properties->requiredString($item, 'anchor', 80);
            if (preg_match('/^[a-z][a-z0-9-]{0,79}$/D', $anchor) !== 1) {
                throw new DocumentCompileException("Anchor menu item {$index} anchor is invalid.");
            }
            $compiled[] = '<li><a href="#'.$this->escaper->escapeAttribute($anchor).'">'.$this->escaper->escape($itemLabel).'</a></li>';
        }
        $stickyClass = $sticky ? ' g7pb-anchor-menu--sticky' : '';

        return '<section class="g7pb-block g7pb-anchor-menu g7pb-anchor-menu--'.$alignment.$stickyClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="anchor-menu"><nav aria-label="'.$this->escaper->escapeAttribute($label).'"><strong>'.$this->escaper->escape($label).'</strong><ul>'.implode('', $compiled).'</ul></nav></section>';
    }
}
