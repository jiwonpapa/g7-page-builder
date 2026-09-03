<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class HeroSplitBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.hero-split-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys(
            $props,
            ['eyebrow', 'title', 'body', 'primaryCta', 'image', 'mediaPosition', 'layout', 'appearance'],
            'Split Hero',
        );

        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $title = $this->properties->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->properties->optionalString($props, 'body', 2000);
        $mediaPosition = $this->properties->requiredString($props, 'mediaPosition', 16);
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'spacious');

        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Split Hero media position is invalid.');
        }
        if ($layout !== null && ! in_array($layout, ['balanced', 'screenshot', 'overlap', 'offset'], true)) {
            throw new DocumentCompileException('Split Hero layout is invalid.');
        }

        $copy = [];
        if ($eyebrow !== null && $eyebrow !== '') {
            $copy[] = '<p class="g7pb-section-eyebrow">'.$this->escaper->escape($eyebrow).'</p>';
        }
        $copy[] = '<h1>'.$this->richText->sanitizeInlineRichText($title).'</h1>';
        if ($body !== null && $body !== '') {
            $copy[] = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-hero-split__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-hero-split__body">'.$this->escaper->formatText($body).'</p>';
        }

        $cta = $this->properties->optionalMap($props, 'primaryCta');
        if ($cta !== null) {
            $copy[] = $this->markup->compileActionLink($cta, 'Split Hero CTA', 'g7pb-button g7pb-button--primary');
        }

        $image = $this->properties->optionalMap($props, 'image');
        $src = $image === null ? '' : $this->properties->requiredString($image, 'src', 2048);
        $alt = $image === null ? '대표 이미지' : $this->properties->requiredString($image, 'alt', 300);
        if ($image !== null) {
            $this->properties->assertOnlyKeys($image, ['src', 'alt'], 'Split Hero image');
        }
        $media = '<figure class="g7pb-hero-split__media">'.$this->markup->compileCatalogImage(
            $src,
            $alt,
            'g7pb-hero-split__image',
            '대표 이미지 자리',
            'eager',
        ).'</figure>';

        $layoutClass = $layout === null ? '' : ' g7pb-hero-split--layout-'.$layout;

        return '<section class="g7pb-block g7pb-hero-split g7pb-hero-split--'.$mediaPosition.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero-split"><div class="g7pb-hero-split__copy">'.implode('', $copy).'</div>'.$media.'</section>';
    }
}
