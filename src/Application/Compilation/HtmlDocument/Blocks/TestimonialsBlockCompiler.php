<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class TestimonialsBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.testimonials-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Testimonials');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($layout, ['grid', 'spotlight', 'split', 'wall', 'quote-hero'], true)) {
            throw new DocumentCompileException('Testimonials layout is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Testimonials must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Testimonial item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['quote', 'name', 'role', 'company', 'avatarSrc', 'avatarAlt', 'rating'], "Testimonial item {$index}");
            $quote = $this->properties->requiredString($item, 'quote', 1200);
            $name = $this->properties->requiredString($item, 'name', 120);
            $role = $this->properties->optionalString($item, 'role', 120) ?? '';
            $company = $this->properties->optionalString($item, 'company', 120) ?? '';
            $avatarSrc = $this->properties->optionalString($item, 'avatarSrc', 2048) ?? '';
            $avatarAlt = $this->properties->optionalString($item, 'avatarAlt', 300) ?? '';
            $rating = $this->properties->requiredIntegerChoice($item, 'rating', [1, 2, 3, 4, 5]);
            $avatar = $this->markup->compileCatalogImage($avatarSrc, $avatarAlt !== '' ? $avatarAlt : $name, 'g7pb-testimonials__avatar', mb_substr($name, 0, 1));
            $meta = ($role === '' ? '' : '<span class="g7pb-testimonial-role">'.$this->escaper->escape($role).'</span>')
                .($role !== '' && $company !== '' ? '<i aria-hidden="true"> · </i>' : '')
                .($company === '' ? '' : '<span class="g7pb-testimonial-company">'.$this->escaper->escape($company).'</span>');
            $compiled[] = '<blockquote><p class="g7pb-testimonials__rating" aria-label="5점 만점에 '.$rating.'점">'.str_repeat('★', $rating).'</p><div class="g7pb-testimonials__quote">'.$this->richText->sanitizeRichText($quote).'</div><footer><figure>'.$avatar.'</figure><cite><strong>'.$this->escaper->escape($name).'</strong>'.$meta.'</cite></footer></blockquote>';
        }

        return '<section class="g7pb-block g7pb-testimonials g7pb-testimonials--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="testimonials">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-testimonials__items">'.implode('', $compiled).'</div></section>';
    }
}
