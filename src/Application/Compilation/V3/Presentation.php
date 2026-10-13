<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use stdClass;

/** Generated CSS for validated v3 documents; never an authored/persisted source. */
final class Presentation
{
    public const FONTS = ['sans' => 'Arial, sans-serif', 'serif' => 'Georgia, serif', 'mono' => 'monospace'];

    public const SURFACE = ['box-sizing' => 'border-box', 'font-family' => self::FONTS['sans'],
        'font-size' => '16px', 'line-height' => '1.5', 'font-weight' => '400', 'margin' => '0', 'padding' => '24px'];

    public const PARAGRAPH = ['margin' => '0', 'min-height' => '1em'];

    public static function color(stdClass $color, stdClass $document): string
    {
        return $color->kind === 'hex' ? $color->value : $document->tokens->{$color->value}->value;
    }

    private static function length(stdClass $value): string
    {
        return $value->value.$value->unit;
    }

    private static function track(stdClass|string $value): string
    {
        return is_string($value) ? $value : (isset($value->fr) ? $value->fr.'fr' : self::length($value));
    }

    private static function grid(stdClass|string $value): string
    {
        return $value instanceof stdClass && isset($value->min)
            ? 'minmax('.self::track($value->min).','.self::track($value->max).')' : self::track($value);
    }

    /** @return array<string, string> */
    private static function background(stdClass $value, stdClass $document): array
    {
        if ($value->kind === 'solid') {
            return ['background' => self::color($value->color, $document)];
        }
        if ($value->kind === 'linear') {
            $stops = array_map(fn (stdClass $stop): string => self::color($stop->color, $document).' '.($stop->offset * 100).'%', $value->stops);

            return ['background' => 'linear-gradient('.$value->angle.'deg,'.implode(',', $stops).')'];
        }
        $asset = array_find($document->assets, fn (stdClass $asset): bool => $asset->asset_id === $value->asset_id);
        $url = str_replace(['\\', '"', "\n", "\r", "\f"], ['\\\\', '\\"', '', '', ''], $asset->url);

        return ['background-image' => 'url("'.$url.'")', 'background-size' => $value->fit,
            'background-position' => $value->x.'% '.$value->y.'%', 'background-repeat' => 'no-repeat'];
    }

    /** @param array<string, string> $out */
    private static function size(array &$out, string $key, stdClass|string $value, ?stdClass $parent, stdClass $own): void
    {
        $property = $key === 'basis' ? 'flex-basis' : $key;
        if ($value instanceof stdClass) {
            $out[$property] = self::length($value);
        } elseif ($value === 'hug') {
            $out[$property] = 'fit-content';
        } elseif ($value !== 'fill') {
            $out[$property] = $value;
        } elseif ($key === 'basis') {
            $out[$property] = '0px';
            $out['flex-grow'] = (string) ($own->grow ?? 1);
        } elseif (($parent->display ?? null) === 'flex') {
            $main = ($parent->direction ?? 'row') === 'row' ? 'width' : 'height';
            $out[$property] = 'auto';
            if ($main === $key) {
                $out['flex-basis'] = '0px';
                $out['flex-grow'] = (string) ($own->grow ?? 1);
                $out['min-'.$key] = '0px';
            } else {
                $out['align-self'] = (string) ($own->align_self ?? 'stretch');
            }
        } else {
            $out[$property] = '100%';
        }
    }

    /** @param array<string, string> $displays
     * @return array<string, string>
     */
    private static function node(stdClass $node, stdClass $document, stdClass $style, ?stdClass $parent, array $displays): array
    {
        $out = ['box-sizing' => 'border-box', 'margin' => '0', 'padding' => '0', 'border-width' => '0',
            'display' => ($style->hidden ?? false) ? 'none' : ($style->display ?? ($displays[$node->props->tag ?? ''] ?? 'block')),
            'position' => ($style->position ?? 'flow') === 'flow' ? 'static' : $style->position];
        if (in_array($node->type, ['content.heading', 'content.text', 'action.link'], true)) {
            $out['white-space'] = 'pre-wrap';
        }
        if ($node->type === 'content.heading') {
            $out['font-size'] = [2, 1.5, 1.17, 1, 0.83, 0.67][$node->props->level - 1].'em';
            $out['font-weight'] = '700';
        }
        if ($node->type === 'media.icon') {
            $out['width'] = '24px';
            $out['height'] = '24px';
        }
        foreach (['width', 'height', 'basis'] as $key) {
            if (isset($style->{$key})) {
                self::size($out, $key, $style->{$key}, $parent, $style);
            }
        }
        foreach (['min_width', 'max_width', 'min_height', 'max_height', 'row_gap', 'column_gap', 'font_size', 'letter_spacing'] as $key) {
            if (isset($style->{$key})) {
                $out[str_replace('_', '-', $key)] = self::length($style->{$key});
            }
        }
        foreach (['top', 'right', 'bottom', 'left'] as $side) {
            foreach (['margin', 'padding', 'inset'] as $group) {
                $value = $style->{$group.'_'.$side} ?? null;
                if ($value !== null) {
                    $out[$group === 'inset' ? $side : $group.'-'.$side] = $value === 'auto' ? $value : self::length($value);
                }
            }
            $border = $style->{'border_'.$side} ?? null;
            if ($border !== null) {
                $out['border-'.$side] = $border->width.'px '.$border->style.' '.self::color($border->color, $document);
            }
        }
        foreach (['top_left', 'top_right', 'bottom_left', 'bottom_right'] as $corner) {
            if (isset($style->{'radius_'.$corner})) {
                $out['border-'.str_replace('_', '-', $corner).'-radius'] = self::length($style->{'radius_'.$corner});
            }
        }
        $direct = ['aspect_ratio' => 'aspect-ratio', 'direction' => 'flex-direction', 'wrap' => 'flex-wrap',
            'justify' => 'justify-content', 'align' => 'align-items', 'align_self' => 'align-self', 'grow' => 'flex-grow',
            'shrink' => 'flex-shrink', 'z_index' => 'z-index', 'opacity' => 'opacity', 'font_weight' => 'font-weight',
            'text_align' => 'text-align', 'text_decoration' => 'text-decoration', 'object_fit' => 'object-fit'];
        foreach ($direct as $key => $property) {
            if (isset($style->{$key})) {
                $out[$property] = (string) $style->{$key};
            }
        }
        foreach (['columns', 'rows'] as $axis) {
            if (isset($style->{$axis})) {
                $out['grid-template-'.$axis] = implode(' ', array_map(self::grid(...), $style->{$axis}));
            }
        }
        foreach (['column', 'row'] as $axis) {
            if (isset($style->{$axis.'_start'})) {
                $out['grid-'.$axis.'-start'] = (string) $style->{$axis.'_start'};
            }
            if (isset($style->{$axis.'_span'})) {
                $out['grid-'.$axis.'-end'] = 'span '.$style->{$axis.'_span'};
            }
        }
        if (isset($style->background)) {
            $out = array_replace($out, self::background($style->background, $document));
        }
        if (isset($style->color)) {
            $out['color'] = self::color($style->color, $document);
        }
        if (isset($style->font_family)) {
            $out['font-family'] = self::FONTS[$style->font_family];
        }
        if (isset($style->line_height)) {
            $out['line-height'] = $style->line_height instanceof stdClass ? self::length($style->line_height) : (string) $style->line_height;
        }
        if (isset($style->rotation)) {
            $out['transform'] = 'rotate('.$style->rotation.'deg)';
        }
        if (isset($style->object_x) || isset($style->object_y)) {
            $out['object-position'] = ($style->object_x ?? 50).'% '.($style->object_y ?? 50).'%';
        }
        if (isset($style->shadows)) {
            $shadows = array_map(fn (stdClass $shadow): string => ($shadow->inset ? 'inset ' : '').$shadow->x.'px '.$shadow->y.'px '.$shadow->blur.'px '.$shadow->spread.'px '.self::color($shadow->color, $document), $style->shadows);
            $out['box-shadow'] = $shadows === [] ? 'none' : implode(',', $shadows);
        }

        return $out;
    }

    /** Caller must use the v3 Validator before this generated presentation.
     * @param  array<string, string>  $displays
     * @return array<string, array<string, string>>
     */
    public static function document(stdClass $document, string $viewport = 'base', array $displays = []): array
    {
        $styles = [];
        $visit = function (array $nodes, ?stdClass $parent = null) use (&$visit, &$styles, $document, $viewport, $displays): void {
            foreach ($nodes as $node) {
                $style = Validator::effectiveStyle($node, $viewport);
                $styles[$node->instance_id] = self::node($node, $document, $style, $parent, $displays);
                $visit($node->slots->content ?? [], $style);
            }
        };
        $visit($document->blocks);

        return $styles;
    }

    /** @return array<string, string> */
    public static function run(stdClass $run, stdClass $document): array
    {
        $out = [];
        if (isset($run->color)) {
            $out['color'] = self::color($run->color, $document);
        }
        if (isset($run->font_size)) {
            $out['font-size'] = self::length($run->font_size);
        }
        if (isset($run->bold)) {
            $out['font-weight'] = $run->bold ? '700' : '400';
        }
        if (isset($run->italic)) {
            $out['font-style'] = $run->italic ? 'italic' : 'normal';
        }
        if (isset($run->underline) || isset($run->strike)) {
            $out['text-decoration'] = implode(' ', array_filter([($run->underline ?? false) ? 'underline' : '', ($run->strike ?? false) ? 'line-through' : ''])) ?: 'none';
        }

        return $out;
    }
}
