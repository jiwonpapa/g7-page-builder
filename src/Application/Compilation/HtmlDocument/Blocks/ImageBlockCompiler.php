<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class ImageBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.image-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['src', 'alt', 'caption', 'linkUrl', 'aspectRatio', 'appearance'], 'Image');
        $src = $this->properties->optionalString($props, 'src', 2048) ?? '';
        $alt = $this->properties->optionalString($props, 'alt', 300) ?? '';
        $caption = $this->properties->optionalString($props, 'caption', 500) ?? '';
        $linkUrl = $this->properties->optionalString($props, 'linkUrl', 2048) ?? '';
        $aspectRatio = $this->properties->requiredString($props, 'aspectRatio', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! in_array($aspectRatio, ['auto', '16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Image aspect ratio is invalid.');
        }
        $media = $this->markup->compileCatalogImage($src, $alt, 'g7pb-image-block__image', '이미지를 선택하세요');
        if ($linkUrl !== '') {
            $this->urls->assertAllowedUrl($linkUrl, 'Image link');
            $media = '<a class="g7pb-image-block__link" href="'.$this->escaper->escapeAttribute($linkUrl).'">'.$media.'</a>';
        }
        $captionMarkup = $caption === '' ? '' : '<figcaption>'.$this->escaper->escape($caption).'</figcaption>';

        return '<section class="g7pb-block g7pb-image-block '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image"><figure class="g7pb-image-block__figure g7pb-image-block__figure--'.str_replace(':', '-', $aspectRatio).'">'.$media.$captionMarkup.'</figure></section>';
    }
}
