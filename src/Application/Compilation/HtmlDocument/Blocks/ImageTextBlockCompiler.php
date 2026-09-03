<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class ImageTextBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.image-text-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'body', 'image', 'mediaPosition', 'primaryLink', 'appearance'], 'Image text');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $body = $this->properties->optionalString($props, 'body', 10000) ?? '';
        $image = $this->properties->optionalMap($props, 'image');
        $mediaPosition = $this->properties->requiredString($props, 'mediaPosition', 16);
        $primaryLink = $this->properties->optionalMap($props, 'primaryLink');
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if ($image === null) {
            throw new DocumentCompileException('Image text image is required.');
        }
        $this->properties->assertOnlyKeys($image, ['src', 'alt'], 'Image text image');
        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Image text media position is invalid.');
        }
        $src = $this->properties->optionalString($image, 'src', 2048) ?? '';
        $alt = $this->properties->optionalString($image, 'alt', 300) ?? '';
        $media = '<figure class="g7pb-image-text__media">'.$this->markup->compileCatalogImage($src, $alt, 'g7pb-image-text__image', '대표 이미지를 선택하세요').'</figure>';
        $copy = '<div class="g7pb-image-text__copy">'.($eyebrow === null || $eyebrow === '' ? '' : '<p class="g7pb-section-eyebrow">'.$this->escaper->escape($eyebrow).'</p>')
            .'<h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2>'.($body === '' ? '' : '<div class="g7pb-image-text__body">'.$this->richText->sanitizeRichText($body).'</div>')
            .($primaryLink === null ? '' : $this->markup->compileActionLink($primaryLink, 'Image text primary link', 'g7pb-button g7pb-button--primary')).'</div>';
        $content = $media.$copy;

        return '<section class="g7pb-block g7pb-image-text g7pb-image-text--'.$mediaPosition.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image-text">'.$content.'</section>';
    }
}
