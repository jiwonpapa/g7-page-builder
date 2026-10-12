<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use stdClass;

/** Independent draft preview fragment, not a stored publication or G7 compiler replacement. */
final readonly class DraftRenderer
{
    public function __construct(private Validator $validator) {}

    public function render(string $json, string $viewport = 'base'): string
    {
        $document = $this->validator->validateJson($json);
        // Validate the viewport even for empty documents.
        $this->validator::effectiveStyle((object) ['style' => new stdClass, 'responsive' => new stdClass], $viewport);
        $styles = Presentation::document($document, $viewport, $this->validator->semanticDisplays());
        $behavior = BehaviorPresentation::apply($document, $styles, $viewport);

        return '<div data-v3-surface="true" style="'.self::css(Presentation::SURFACE).'">'.$this->nodes($document->blocks, $document, $behavior['styles'], $behavior['attributes']).'</div>';
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
            if ($style['display'] === 'none') {
                continue;
            }
            $tag = match ($node->type) {
                'layout.section', 'layout.container' => $node->props->tag,
                'content.heading' => 'h'.$node->props->level,
                'media.image' => 'img',
                'action.link' => 'a',
                'action.button' => 'button',
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
                $attrs .= ' type="button"';
                $body = self::escape($node->props->label);
            } else {
                $body = $this->nodes($node->slots->content ?? [], $document, $styles, $attributes);
            }
            $html .= '<'.$tag.$attrs.'>'.($tag === 'img' ? '' : $body.'</'.$tag.'>');
        }

        return $html;
    }
}
