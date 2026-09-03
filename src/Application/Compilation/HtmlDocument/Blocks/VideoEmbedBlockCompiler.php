<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class VideoEmbedBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.video-embed-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'caption', 'provider', 'videoId', 'ratio', 'appearance'], 'Video embed');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $caption = $this->properties->optionalRichTextString($props, 'caption', 1000) ?? '';
        $provider = $this->properties->requiredString($props, 'provider', 16);
        $videoId = $this->properties->requiredString($props, 'videoId', 32);
        $ratio = $this->properties->requiredString($props, 'ratio', 8);
        $appearance = $this->appearance->appearanceClasses($props, 'contrast', 'normal');
        if (! in_array($provider, ['youtube', 'vimeo'], true) || preg_match('/^[A-Za-z0-9_-]{6,32}$/D', $videoId) !== 1) {
            throw new DocumentCompileException('Video provider or identifier is invalid.');
        }
        if (! in_array($ratio, ['16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Video ratio is invalid.');
        }
        $src = $provider === 'youtube'
            ? 'https://www.youtube-nocookie.com/embed/'.$videoId.'?rel=0'
            : 'https://player.vimeo.com/video/'.$videoId;

        $captionMarkup = $caption === '' ? '' : '<figcaption>'.($this->richText->hasCanonicalRichTextMarkup($caption) ? $this->richText->sanitizeRichText($caption) : $this->escaper->formatText($caption)).'</figcaption>';

        $embed = $this->markup->embedPlaceholder('video-'.$provider, $src, $this->richText->inlinePlainText($heading));

        return '<section class="g7pb-block g7pb-video '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="video-embed">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<figure><div class="g7pb-video__frame" data-ratio="'.$this->escaper->escapeAttribute($ratio).'">'.$embed.'</div>'.$captionMarkup.'</figure></section>';
    }
}
