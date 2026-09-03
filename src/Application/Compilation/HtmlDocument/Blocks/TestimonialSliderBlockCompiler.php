<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class TestimonialSliderBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.testimonial-slider-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'autoplay', 'interval', 'appearance'], 'Testimonial slider');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $autoplay = $this->properties->requiredBoolean($props, 'autoplay');
        $interval = $this->properties->requiredIntegerChoice($props, 'interval', [5000, 7000, 9000]);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Testimonial slider must contain between two and eight items.');
        }

        $slides = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Testimonial slider item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['quote', 'name', 'role', 'company', 'avatarSrc', 'avatarAlt', 'rating'], "Testimonial slider item {$index}");
            $quote = $this->properties->requiredString($item, 'quote', 1200);
            $name = $this->properties->requiredString($item, 'name', 120);
            $role = $this->properties->optionalString($item, 'role', 120) ?? '';
            $company = $this->properties->optionalString($item, 'company', 120) ?? '';
            $avatarSrc = $this->properties->optionalString($item, 'avatarSrc', 2048) ?? '';
            $avatarAlt = $this->properties->optionalString($item, 'avatarAlt', 300) ?? '';
            $rating = $this->properties->requiredIntegerChoice($item, 'rating', [1, 2, 3, 4, 5]);
            $avatar = $this->markup->compileCatalogImage($avatarSrc, $avatarAlt !== '' ? $avatarAlt : $name, 'g7pb-testimonial-slider__avatar', mb_substr($name, 0, 1));
            $meta = ($role === '' ? '' : '<span class="g7pb-testimonial-role">'.$this->escaper->escape($role).'</span>')
                .($role !== '' && $company !== '' ? '<i aria-hidden="true"> · </i>' : '')
                .($company === '' ? '' : '<span class="g7pb-testimonial-company">'.$this->escaper->escape($company).'</span>');
            $quoteMarkup = $this->richText->hasRichTextMarkup($quote)
                ? '<div class="g7pb-testimonial-slider__quote">'.$this->richText->sanitizeRichText($quote).'</div>'
                : '<p class="g7pb-testimonial-slider__quote">'.$this->escaper->formatText($quote).'</p>';
            $slides[] = '<blockquote class="g7pb-hero-slider__slide g7pb-testimonial-slider__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($items).'"><p class="g7pb-testimonial-slider__rating" aria-label="5점 만점에 '.$rating.'점">'.str_repeat('★', $rating).'</p>'.$quoteMarkup.'<footer><figure>'.$avatar.'</figure><cite><strong>'.$this->escaper->escape($name).'</strong>'.$meta.'</cite></footer></blockquote>';
        }

        return '<section class="g7pb-block g7pb-testimonial-slider g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="testimonial-slider" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }
}
