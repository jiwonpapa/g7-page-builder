<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class LogoCarouselBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.logo-carousel-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'logos', 'autoplay', 'interval', 'appearance'], 'Logo carousel');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $logos = $props['logos'] ?? null;
        $autoplay = $this->properties->requiredBoolean($props, 'autoplay');
        $interval = $this->properties->requiredIntegerChoice($props, 'interval', [3000, 5000, 7000]);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        if (! is_array($logos) || count($logos) < 3 || count($logos) > 12) {
            throw new DocumentCompileException('Logo carousel must contain between three and twelve logos.');
        }

        $slides = [];
        foreach (array_values($logos) as $index => $logo) {
            if (! is_array($logo)) {
                throw new DocumentCompileException("Logo carousel item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($logo, ['name', 'imageSrc', 'imageAlt', 'url'], "Logo carousel item {$index}");
            $name = $this->properties->requiredString($logo, 'name', 120);
            $imageSrc = $this->properties->optionalString($logo, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($logo, 'imageAlt', 300) ?? '';
            $url = $this->properties->optionalString($logo, 'url', 2048) ?? '';
            $visual = $imageSrc === ''
                ? '<span>'.$this->escaper->escape($name).'</span>'
                : $this->markup->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name.' 로고', 'g7pb-logo-carousel__image', $name);
            if ($url !== '') {
                $this->urls->assertAllowedUrl($url, "Logo carousel item {$index}");
                $visual = '<a href="'.$this->escaper->escapeAttribute($url).'" aria-label="'.$this->escaper->escapeAttribute($name).'">'.$visual.'</a>';
            }
            $slides[] = '<div class="g7pb-hero-slider__slide g7pb-logo-carousel__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($logos).'">'.$visual.'</div>';
        }

        return '<section class="g7pb-block g7pb-logo-carousel g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="logo-carousel" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }
}
