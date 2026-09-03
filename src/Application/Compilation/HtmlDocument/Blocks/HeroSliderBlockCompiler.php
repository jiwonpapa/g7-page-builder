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

final readonly class HeroSliderBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.hero-slider-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['slides', 'autoplay', 'interval', 'loop', 'appearance'], 'Slider Hero');
        $slides = $props['slides'] ?? null;
        $appearance = $this->appearance->appearanceClasses($props, 'contrast', 'spacious');
        $autoplay = $props['autoplay'] ?? true;
        $interval = $props['interval'] ?? 5000;
        $loop = $props['loop'] ?? true;

        if (! is_array($slides) || count($slides) < 2 || count($slides) > 5) {
            throw new DocumentCompileException('Slider Hero must contain between two and five slides.');
        }
        if (! is_bool($autoplay) || ! is_bool($loop) || ! in_array($interval, [3000, 5000, 7000], true)) {
            throw new DocumentCompileException('Slider Hero playback settings are invalid.');
        }

        $compiled = [];
        foreach (array_values($slides) as $index => $slide) {
            if (! is_array($slide)) {
                throw new DocumentCompileException("Slider Hero item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys(
                $slide,
                ['eyebrow', 'title', 'body', 'buttonLabel', 'buttonUrl', 'imageSrc', 'imageAlt'],
                "Slider Hero item {$index}",
            );
            $eyebrow = $this->properties->optionalString($slide, 'eyebrow', 120);
            $title = $this->properties->requiredInlineRichTextString($slide, 'title', 200);
            $body = $this->properties->optionalString($slide, 'body', 2000);
            $buttonLabel = $this->properties->requiredString($slide, 'buttonLabel', 120);
            $buttonUrl = $this->properties->requiredString($slide, 'buttonUrl', 2048);
            $imageSrc = $this->properties->optionalString($slide, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($slide, 'imageAlt', 300) ?? '';
            $this->urls->assertAllowedUrl($buttonUrl, "Slider Hero item {$index}");

            $copy = $eyebrow === null || $eyebrow === ''
                ? ''
                : '<p class="g7pb-section-eyebrow">'.$this->escaper->escape($eyebrow).'</p>';
            $copy .= '<h2>'.$this->richText->sanitizePromotedInlineRichText($title).'</h2>';
            if ($body !== null && $body !== '') {
                $copy .= $this->richText->hasRichTextMarkup($body)
                    ? '<div class="g7pb-hero-slider__body">'.$this->richText->sanitizeRichText($body).'</div>'
                    : '<p>'.$this->escaper->formatText($body).'</p>';
            }
            $copy .= '<a class="g7pb-button g7pb-button--primary" href="'.$this->escaper->escapeAttribute($buttonUrl).'">'.$this->escaper->escape($buttonLabel).'</a>';
            $media = $this->markup->compileCatalogImage(
                $imageSrc,
                $imageAlt,
                'g7pb-hero-slider__image',
                '슬라이드 '.($index + 1).' 이미지 자리',
                $index === 0 ? 'eager' : 'lazy',
            );
            $compiled[] = '<article class="g7pb-hero-slider__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($slides).'"><div class="g7pb-hero-slider__copy">'.$copy.'</div><figure>'.$media.'</figure></article>';
        }

        return '<section class="g7pb-block g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero-slider" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="'.($loop ? 'true' : 'false').'" aria-label="대표 콘텐츠 슬라이더"><div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $compiled).'</div></div><div class="g7pb-hero-slider__controls"><div class="g7pb-hero-slider__dots" data-g7pb-slider-dots aria-label="슬라이드 선택"></div></div><p class="g7pb-hero-slider__status" data-g7pb-slider-status aria-live="polite"></p></section>';
    }
}
