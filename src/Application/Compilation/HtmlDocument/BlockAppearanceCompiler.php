<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class BlockAppearanceCompiler
{
    public function __construct(
        private BlockPropertyReader $properties,
    ) {}

    /**
     * @param  array<string, mixed>  $props
     */
    public function appearanceClasses(array $props, string $defaultSurface, string $defaultSpacing): string
    {
        $appearance = $this->properties->optionalMap($props, 'appearance') ?? [];
        $this->properties->assertOnlyKeys($appearance, ['surface', 'spacing', 'textScale', 'textAlign', 'containerWidth', 'containerAlign', 'minHeight', 'verticalAlign', 'elements'], 'Block appearance');
        $surface = $this->properties->optionalString($appearance, 'surface', 16) ?? $defaultSurface;
        $spacing = $this->properties->optionalString($appearance, 'spacing', 16) ?? $defaultSpacing;
        $textScale = $this->properties->optionalString($appearance, 'textScale', 16) ?? 'balanced';
        $textAlign = $this->properties->optionalString($appearance, 'textAlign', 16) ?? 'left';
        $containerWidth = $this->properties->optionalString($appearance, 'containerWidth', 16) ?? 'inherit';
        $containerAlign = $this->properties->optionalString($appearance, 'containerAlign', 16) ?? 'center';
        $minHeight = $this->properties->optionalString($appearance, 'minHeight', 16) ?? 'auto';
        $verticalAlign = $this->properties->optionalString($appearance, 'verticalAlign', 16) ?? 'start';

        if (! in_array($surface, ['default', 'soft', 'contrast'], true)) {
            throw new DocumentCompileException('Block appearance surface is invalid.');
        }

        if (! in_array($spacing, ['compact', 'normal', 'spacious'], true)) {
            throw new DocumentCompileException('Block appearance spacing is invalid.');
        }

        if (! in_array($textScale, ['compact', 'balanced', 'large'], true) || ! in_array($textAlign, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Block typography appearance is invalid.');
        }
        if (! in_array($containerWidth, ['inherit', 'narrow', 'standard', 'wide', 'full'], true)
            || ! in_array($containerAlign, ['left', 'center', 'right', 'stretch'], true)
            || ! in_array($minHeight, ['auto', 'compact', 'medium', 'large', 'viewport'], true)
            || ! in_array($verticalAlign, ['start', 'center', 'end'], true)) {
            throw new DocumentCompileException('Block container appearance is invalid.');
        }

        $classes = 'g7pb-surface--'.$surface.' g7pb-spacing--'.$spacing;
        if (array_key_exists('textScale', $appearance) || $textScale !== 'balanced') {
            $classes .= ' g7pb-text-scale--'.$textScale;
        }
        if (array_key_exists('textAlign', $appearance) || $textAlign !== 'left') {
            $classes .= ' g7pb-text-align--'.$textAlign;
        }
        $classes .= ' g7pb-container-width--'.$containerWidth
            .' g7pb-container-align--'.$containerAlign
            .' g7pb-container-height--'.$minHeight
            .' g7pb-container-vertical--'.$verticalAlign;

        return $classes;
    }
}
