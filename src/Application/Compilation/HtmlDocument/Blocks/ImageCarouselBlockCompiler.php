<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class ImageCarouselBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.image-carousel-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'images', 'autoplay', 'interval', 'controls', 'aspectRatio', 'appearance'], 'Image carousel');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $images = $props['images'] ?? null;
        $autoplay = $this->properties->requiredBoolean($props, 'autoplay');
        $interval = $this->properties->requiredIntegerChoice($props, 'interval', [3000, 5000, 7000]);
        $controls = $this->properties->requiredString($props, 'controls', 16);
        $aspectRatio = $this->properties->requiredString($props, 'aspectRatio', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! is_array($images) || count($images) < 2 || count($images) > 8) {
            throw new DocumentCompileException('Image carousel must contain between two and eight images.');
        }
        if (! in_array($controls, ['arrows', 'dots', 'both'], true) || ! in_array($aspectRatio, ['16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Image carousel controls or aspect ratio is invalid.');
        }
        $slides = [];
        foreach (array_values($images) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Image carousel item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['src', 'alt', 'caption'], "Image carousel item {$index}");
            $src = $this->properties->optionalString($item, 'src', 2048) ?? '';
            $alt = $this->properties->requiredString($item, 'alt', 300);
            $caption = $this->properties->optionalString($item, 'caption', 300) ?? '';
            $media = $this->markup->compileCatalogImage($src, $alt, 'g7pb-image-carousel__image', ($index + 1).'번 이미지를 선택하세요', $index === 0 ? 'eager' : 'lazy');
            $slides[] = '<figure class="g7pb-hero-slider__slide g7pb-image-carousel__slide">'.$media.($caption === '' ? '' : '<figcaption>'.$this->escaper->escape($caption).'</figcaption>').'</figure>';
        }

        return '<section class="g7pb-block g7pb-hero-slider g7pb-image-carousel g7pb-image-carousel--'.str_replace(':', '-', $aspectRatio).' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image-carousel" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" data-g7pb-slider-controls="'.$controls.'" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }
}
