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

final readonly class DownloadResourcesBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.download-resources-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'appearance'], 'Download resources');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! is_array($items) || count($items) < 1 || count($items) > 12) {
            throw new DocumentCompileException('Download resources must contain between one and twelve items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Download resource {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['title', 'description', 'fileType', 'fileSize', 'buttonLabel', 'url'], "Download resource {$index}");
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 240);
            $description = $this->properties->optionalString($item, 'description', 1200) ?? '';
            $fileType = $this->properties->requiredString($item, 'fileType', 20);
            $fileSize = $this->properties->optionalString($item, 'fileSize', 40) ?? '';
            $buttonLabel = $this->properties->requiredString($item, 'buttonLabel', 120);
            $url = $this->properties->requiredString($item, 'url', 2048);
            $this->urls->assertAllowedUrl($url, "Download resource {$index}");
            $fileMeta = '<span class="g7pb-downloads__file-type">'.$this->escaper->escape($fileType).'</span>'
                .($fileSize === '' ? '' : '<i aria-hidden="true"> · </i><span class="g7pb-downloads__file-size">'.$this->escaper->escape($fileSize).'</span>');
            $descriptionMarkup = $description === '' ? '' : ($this->richText->hasRichTextMarkup($description)
                ? '<div class="g7pb-downloads__description">'.$this->richText->sanitizeRichText($description).'</div>'
                : '<p>'.$this->escaper->formatText($description).'</p>');
            $compiled[] = '<li><span class="g7pb-downloads__type">'.$this->escaper->escape(mb_strtoupper($fileType)).'</span><div><h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$descriptionMarkup.'<small>'.$fileMeta.'</small></div><a href="'.$this->escaper->escapeAttribute($url).'" download>'.$this->escaper->escape($buttonLabel).' <span aria-hidden="true">↓</span></a></li>';
        }

        return '<section class="g7pb-block g7pb-downloads '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="download-resources">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<ul>'.implode('', $compiled).'</ul></section>';
    }
}
