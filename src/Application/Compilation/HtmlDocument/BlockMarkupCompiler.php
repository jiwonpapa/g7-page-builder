<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class BlockMarkupCompiler
{
    public function __construct(
        private BlockPropertyReader $properties,
        private CompilationUrlPolicy $urls,
        private RichTextSanitizer $richText,
        private HtmlEscaper $escaper,
    ) {}

    public function compilePagination(string $label): string
    {
        return '<nav class="g7pb-dynamic-pagination" data-g7pb-pagination aria-label="'.$this->escaper->escapeAttribute($label).' 페이지" hidden><span data-g7pb-runtime-button data-g7pb-page-prev>이전</span><span data-g7pb-page-status aria-live="polite">1 / 1</span><span data-g7pb-runtime-button data-g7pb-page-next>다음</span></nav>';
    }

    public function compileSectionHeading(?string $eyebrow, string $heading): string
    {
        $eyebrowMarkup = $eyebrow === null || $eyebrow === ''
            ? ''
            : '<p class="g7pb-section-eyebrow">'.$this->escaper->escape($eyebrow).'</p>';

        return '<header class="g7pb-section-heading">'.$eyebrowMarkup.'<h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2></header>';
    }

    public function compileCatalogImage(
        string $src,
        string $alt,
        string $className,
        string $placeholderLabel,
        string $loading = 'lazy',
    ): string {
        if ($src === '') {
            return '<span class="g7pb-media-placeholder '.$className.'" role="img" aria-label="'.$this->escaper->escapeAttribute($placeholderLabel).'"><span>'.$this->escaper->escape($placeholderLabel).'</span></span>';
        }

        if ($alt === '') {
            throw new DocumentCompileException('Image alternative text is required.');
        }

        $this->urls->assertAllowedImageUrl($src);

        return '<img class="'.$className.'" src="'.$this->escaper->escapeAttribute($src).'" alt="'.$this->escaper->escapeAttribute($alt).'" loading="'.$loading.'">';
    }

    /**
     * @param  array<string, mixed>  $link
     */
    public function compileActionLink(array $link, string $property, string $className): string
    {
        $this->properties->assertOnlyKeys($link, ['label', 'url'], $property);
        $label = $this->properties->requiredString($link, 'label', 120);
        $url = $this->properties->requiredString($link, 'url', 2048);
        $this->urls->assertAllowedUrl($url, $property);

        return '<a class="'.$className.'" href="'.$this->escaper->escapeAttribute($url).'">'.$this->escaper->escape($label).'</a>';
    }

    public function embedPlaceholder(
        string $kind,
        string $src,
        string $title,
    ): string {
        return '<span data-g7pb-embed data-g7pb-embed-kind="'.$this->escaper->escapeAttribute($kind).'" data-g7pb-embed-src="'.$this->escaper->escapeAttribute($src).'" data-g7pb-embed-title="'.$this->escaper->escapeAttribute($title).'"></span>';
    }
}
