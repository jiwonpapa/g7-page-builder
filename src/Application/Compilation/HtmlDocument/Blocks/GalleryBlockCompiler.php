<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class GalleryBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.gallery-grid-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'images', 'columns', 'layout', 'appearance'], 'Gallery');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $images = $props['images'] ?? null;
        $columns = $props['columns'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');

        if (! is_int($columns) || ! in_array($columns, [2, 3, 4], true)) {
            throw new DocumentCompileException('Gallery columns are invalid.');
        }
        if ($layout !== null && ! in_array($layout, ['grid', 'bento', 'masonry', 'filmstrip'], true)) {
            throw new DocumentCompileException('Gallery layout is invalid.');
        }
        if (! is_array($images) || count($images) < 2 || count($images) > 12) {
            throw new DocumentCompileException('Gallery must contain between two and twelve images.');
        }

        $compiled = [];
        foreach (array_values($images) as $index => $image) {
            if (! is_array($image)) {
                throw new DocumentCompileException("Gallery image {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($image, ['src', 'alt', 'caption'], "Gallery image {$index}");
            $src = $this->properties->optionalString($image, 'src', 2048) ?? '';
            $alt = $this->properties->requiredString($image, 'alt', 300);
            $caption = $this->properties->optionalString($image, 'caption', 300) ?? '';
            $media = $this->markup->compileCatalogImage($src, $alt, 'g7pb-gallery__image', '이미지 '.($index + 1));
            $figcaption = $caption === '' ? '' : '<figcaption>'.$this->escaper->escape($caption).'</figcaption>';
            $compiled[] = '<figure>'.$media.$figcaption.'</figure>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-gallery--layout-'.$layout;

        return '<section class="g7pb-block g7pb-gallery'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="gallery">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-gallery__grid g7pb-gallery__grid--'.$columns.'">'.implode('', $compiled).'</div></section>';
    }
}
