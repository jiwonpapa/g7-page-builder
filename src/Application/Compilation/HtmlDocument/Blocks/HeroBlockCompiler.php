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

final readonly class HeroBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.hero-centered-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'title', 'body', 'primaryCta', 'image', 'alignment', 'mediaPosition', 'layout', 'appearance'], 'Hero');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $title = $this->properties->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->properties->optionalString($props, 'body', 4000);
        $alignment = $this->properties->optionalString($props, 'alignment', 16) ?? 'center';
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $mediaPosition = $this->properties->optionalString($props, 'mediaPosition', 16) ?? 'right';
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'spacious');
        $splitLayouts = ['balanced', 'screenshot', 'overlap', 'offset'];

        if (! in_array($alignment, ['left', 'center'], true)) {
            throw new DocumentCompileException('Hero alignment must be left or center.');
        }
        if ($layout !== null && ! in_array($layout, ['poster', 'product', 'backdrop', 'editorial', 'device', ...$splitLayouts], true)) {
            throw new DocumentCompileException('Hero layout is invalid.');
        }
        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Hero media position is invalid.');
        }

        $cta = $this->properties->optionalMap($props, 'primaryCta');
        $image = $this->properties->optionalMap($props, 'image');

        if ($layout !== null && in_array($layout, $splitLayouts, true)) {
            $copy = [];
            if ($eyebrow !== null && $eyebrow !== '') {
                $copy[] = '<p class="g7pb-section-eyebrow">'.$this->escaper->escape($eyebrow).'</p>';
            }
            $copy[] = '<h1>'.$this->richText->sanitizeInlineRichText($title).'</h1>';
            if ($body !== null && $body !== '') {
                $copy[] = $this->richText->hasCanonicalRichTextMarkup($body)
                    ? '<div class="g7pb-hero-split__body">'.$this->richText->sanitizeRichText($body).'</div>'
                    : '<p class="g7pb-hero-split__body">'.$this->escaper->formatText($body).'</p>';
            }
            if ($cta !== null) {
                $copy[] = $this->markup->compileActionLink($cta, 'Hero CTA', 'g7pb-button g7pb-button--primary');
            }
            if ($image !== null) {
                $this->properties->assertOnlyKeys($image, ['src', 'alt'], 'Hero image');
            }
            $src = $image === null ? '' : $this->properties->requiredString($image, 'src', 2048);
            $alt = $image === null ? '대표 이미지' : $this->properties->requiredString($image, 'alt', 300);
            $media = '<figure class="g7pb-hero-split__media">'.$this->markup->compileCatalogImage(
                $src,
                $alt,
                'g7pb-hero-split__image',
                '대표 이미지 자리',
                'eager',
            ).'</figure>';

            return '<section class="g7pb-block g7pb-hero g7pb-hero-split g7pb-hero-split--'.$mediaPosition.' g7pb-hero-split--layout-'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero"><div class="g7pb-hero-split__copy">'.implode('', $copy).'</div>'.$media.'</section>';
        }

        $parts = [];

        if ($eyebrow !== null && $eyebrow !== '') {
            $parts[] = '<p class="g7pb-hero__eyebrow">'.$this->escaper->escape($eyebrow).'</p>';
        }

        $parts[] = '<h1 class="g7pb-hero__title">'.$this->richText->sanitizeInlineRichText($title).'</h1>';

        if ($body !== null && $body !== '') {
            $parts[] = '<div class="g7pb-hero__body">'.$this->richText->sanitizeRichText($body).'</div>';
        }

        if ($cta !== null) {
            $label = $this->properties->requiredString($cta, 'label', 120);
            $url = $this->properties->requiredString($cta, 'url', 2048);
            $this->urls->assertAllowedUrl($url, 'Hero CTA');
            $parts[] = '<a class="g7pb-button g7pb-button--primary" href="'.$this->escaper->escapeAttribute($url).'">'.$this->escaper->escape($label).'</a>';
        }

        if ($image !== null) {
            $src = $this->properties->requiredString($image, 'src', 2048);
            $alt = $this->properties->optionalString($image, 'alt', 300) ?? '';
            $this->urls->assertAllowedImageUrl($src);
            $parts[] = '<img class="g7pb-hero__image" src="'.$this->escaper->escapeAttribute($src).'" alt="'.$this->escaper->escapeAttribute($alt).'" loading="eager">';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-hero--layout-'.$layout;

        return '<section class="g7pb-block g7pb-hero g7pb-hero--'.$alignment.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero">'.implode('', $parts).'</section>';
    }
}
