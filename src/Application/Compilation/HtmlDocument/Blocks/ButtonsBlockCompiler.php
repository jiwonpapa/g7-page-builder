<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class ButtonsBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.buttons-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['items', 'alignment', 'appearance'], 'Buttons');
        $items = $props['items'] ?? null;
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        if (! is_array($items) || count($items) < 1 || count($items) > 3) {
            throw new DocumentCompileException('Buttons must contain between one and three items.');
        }
        if (! in_array($alignment, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Button alignment is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Button item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'url', 'variant'], "Button item {$index}");
            $label = $this->properties->requiredString($item, 'label', 120);
            $url = $this->properties->requiredString($item, 'url', 2048);
            $variant = $this->properties->requiredString($item, 'variant', 16);
            if (! in_array($variant, ['primary', 'secondary', 'text'], true)) {
                throw new DocumentCompileException("Button item {$index} variant is invalid.");
            }
            $this->urls->assertAllowedUrl($url, "Button item {$index}");
            $compiled[] = '<a class="g7pb-button g7pb-button--'.$variant.'" href="'.$this->escaper->escapeAttribute($url).'">'.$this->escaper->escape($label).'</a>';
        }

        return '<section class="g7pb-block g7pb-buttons '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="buttons"><div class="g7pb-buttons__items g7pb-buttons__items--'.$alignment.'" role="group" aria-label="페이지 행동">'.implode('', $compiled).'</div></section>';
    }
}
