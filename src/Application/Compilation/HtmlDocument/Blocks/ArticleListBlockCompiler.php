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

final readonly class ArticleListBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.article-list-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Article list');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! in_array($layout, ['list', 'grid', 'featured', 'magazine', 'editorial'], true)) {
            throw new DocumentCompileException('Article list layout is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Article list must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Article item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['category', 'title', 'summary', 'date', 'imageSrc', 'imageAlt', 'url'], "Article item {$index}");
            $category = $this->properties->optionalString($item, 'category', 80) ?? '';
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 240, allowLinks: false);
            $summary = $this->properties->requiredString($item, 'summary', 1200);
            $date = $this->properties->optionalString($item, 'date', 40) ?? '';
            if ($date !== '') {
                $parsedDate = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
                if ($parsedDate === false || $parsedDate->format('Y-m-d') !== $date) {
                    throw new DocumentCompileException("Article item {$index} 날짜는 날짜 선택기로 입력해 주세요.");
                }
            }
            $imageSrc = $this->properties->optionalString($item, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($item, 'imageAlt', 300) ?? '';
            $url = $this->properties->requiredString($item, 'url', 2048);
            $this->urls->assertAllowedUrl($url, "Article item {$index}");
            $plainTitle = $this->richText->promotedInlinePlainText($title, allowLinks: false);
            $media = $this->markup->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $plainTitle, 'g7pb-articles__image', str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT));
            $meta = array_filter([
                $category === '' ? '' : '<span>'.$this->escaper->escape($category).'</span>',
                $date === '' ? '' : '<time datetime="'.$this->escaper->escapeAttribute($date).'">'.$this->escaper->escape($date).'</time>',
            ]);
            $summaryMarkup = $this->richText->hasRichTextMarkup($summary)
                ? '<div class="g7pb-articles__summary">'.$this->richText->sanitizeRichText($summary).'</div>'
                : '<p>'.$this->escaper->formatText($summary).'</p>';
            $compiled[] = '<article><figure>'.$media.'</figure><div>'.($meta === [] ? '' : '<p class="g7pb-articles__meta">'.implode('<i>·</i>', $meta).'</p>').'<h3><a href="'.$this->escaper->escapeAttribute($url).'">'.$this->richText->sanitizePromotedInlineRichText($title, allowLinks: false).'</a></h3>'.$summaryMarkup.'<a class="g7pb-articles__link" href="'.$this->escaper->escapeAttribute($url).'">읽어보기 <span aria-hidden="true">→</span></a></div></article>';
        }

        return '<section class="g7pb-block g7pb-articles g7pb-articles--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="article-list">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-articles__items">'.implode('', $compiled).'</div></section>';
    }
}
