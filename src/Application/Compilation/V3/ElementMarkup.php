<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use stdClass;

/** One semantic element renderer for a draft viewport and responsive publication.
 * Only validated documents and generated presentation enter this class.
 */
final readonly class ElementMarkup
{
    public function __construct(private bool $publication = false, private BlockIconCompiler $icons = new BlockIconCompiler(new HtmlEscaper)) {}

    /** @param array<string, array<string, string>> $styles
     * @param  array<string, array<string, string>>  $attributes
     */
    public function render(stdClass $document, array $styles, array $attributes): string
    {
        $marker = $this->publication ? ' data-g7pb-v3-public=""' : '';
        $surface = $this->publication ? ['color' => 'initial', ...Presentation::SURFACE] : Presentation::SURFACE;

        return '<div data-v3-surface="true"'.$marker.' style="'.self::css($surface).'">'.$this->nodes($document->blocks, $document, $styles, $attributes).'</div>';
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** @param array<string, string> $styles */
    private static function css(array $styles): string
    {
        $output = '';
        foreach ($styles as $key => $value) {
            $output .= $key.':'.$value.';';
        }

        return self::escape($output);
    }

    private static function link(stdClass $link, string $body): string
    {
        return '<a href="'.self::escape($link->url).'"'.($link->new_tab ? ' target="_blank" rel="noopener noreferrer"' : '').'>'.$body.'</a>';
    }

    /** @param list<stdClass> $runs */
    private function runs(array $runs, stdClass $document): string
    {
        $html = '';
        foreach ($runs as $run) {
            $text = '<span style="'.self::css(Presentation::run($run, $document)).'">'.self::escape($run->text).'</span>';
            $html .= isset($run->link) ? self::link($run->link, $text) : $text;
        }

        return $html;
    }

    /** @param list<stdClass> $nodes
     * @param  array<string, array<string, string>>  $styles
     * @param  array<string, array<string, string>>  $attributes
     */
    private function nodes(array $nodes, stdClass $document, array $styles, array $attributes): string
    {
        $html = '';
        foreach ($nodes as $node) {
            $style = $styles[$node->instance_id];
            if (! $this->publication && $style['display'] === 'none') {
                continue;
            }
            $tag = match ($node->type) {
                'layout.section', 'layout.container' => $node->props->tag,
                'content.heading' => 'h'.$node->props->level,
                'media.image' => 'img',
                'media.icon' => 'span',
                'action.link' => 'a',
                'action.button' => $this->publication ? 'span' : 'button',
                default => 'div',
            };
            $attrs = ' id="node-'.$node->instance_id.'" data-v3-node="'.$node->instance_id.'" style="'.self::css($style).'"';
            foreach ($attributes[$node->instance_id] ?? [] as $key => $value) {
                $attrs .= ' '.$key.'="'.self::escape($value).'"';
            }
            $body = '';
            if ($node->type === 'media.image') {
                $asset = array_find($document->assets, fn (stdClass $asset): bool => $asset->asset_id === $node->props->asset_id);
                $attrs .= ' src="'.self::escape($asset->url).'" alt="'.self::escape($node->props->alt).'"';
            } elseif ($node->type === 'media.icon') {
                $attrs .= $node->props->decorative ? ' aria-hidden="true"' : ' role="img" aria-label="'.self::escape($node->props->label).'"';
                $body = $this->icons->catalogIconSvg($node->props->icon, '', true, ! $this->publication);
            } elseif ($node->type === 'content.heading') {
                $body = $this->runs($node->props->runs, $document);
            } elseif ($node->type === 'content.text') {
                foreach ($node->props->paragraphs as $runs) {
                    $body .= '<p style="'.self::css(Presentation::PARAGRAPH).'">'.$this->runs($runs, $document).'</p>';
                }
            } elseif ($node->type === 'action.link') {
                $link = $node->props->link;
                $attrs .= ' href="'.self::escape($link->url).'"'.($link->new_tab ? ' target="_blank" rel="noopener noreferrer"' : '');
                $body = self::escape($node->props->label);
            } elseif ($node->type === 'action.button') {
                $attrs .= $this->publication ? ' data-g7pb-runtime-button=""' : ' type="button"';
                $body = self::escape($node->props->label);
            } else {
                $body = $this->nodes($node->slots->content ?? [], $document, $styles, $attributes);
            }
            $html .= '<'.$tag.$attrs.'>'.($tag === 'img' ? '' : $body.'</'.$tag.'>');
        }

        return $html;
    }
}
