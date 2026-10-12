<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use stdClass;

/** Canonical behavior references become generated attributes, never stored HTML. */
final class BehaviorPresentation
{
    /**
     * @param  array<string, array<string, string>>  $styles
     * @return array{attributes: array<string, array<string, string>>, styles: array<string, array<string, string>>}
     */
    public static function apply(stdClass $document, array $styles, string $viewport): array
    {
        $tree = [];
        self::index($document->blocks, $tree);
        $attributes = [];
        $set = function (string $id, array $values) use (&$attributes): void {
            $attributes[$id] = array_replace($attributes[$id] ?? [], $values);
        };
        $defaults = function (string $id, array $values) use ($tree, $viewport, &$styles): void {
            $authored = Validator::effectiveStyle($tree[$id], $viewport);
            if ($styles[$id]['display'] === 'none') {
                return;
            }
            foreach ($values as [$key, $property, $value]) {
                if (! property_exists($authored, $key)) {
                    $styles[$id][$property] = $value;
                }
            }
        };
        foreach ($tree as $node) {
            if ($node->type === 'action.button') {
                foreach (['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color'] as $property) {
                    $styles[$node->instance_id][$property] ??= 'inherit';
                }
                $styles[$node->instance_id]['white-space'] = 'pre-wrap';
            }
            $behavior = $node->behavior ?? null;
            if ($behavior === null) {
                continue;
            }
            if (! $behavior instanceof stdClass) {
                throw new \InvalidArgumentException('behavior_shape');
            }
            $host = $node->instance_id;
            $set($host, ['data-g7pb-control-ids' => 'stable']);
            if ($behavior->kind === 'tabs') {
                $initial = array_find_key($behavior->pairs, fn (stdClass $pair): bool => $pair->panel_id === $behavior->active_panel_id);
                $set($host, ['data-g7pb-tabs' => '', 'data-g7pb-tabs-initial' => (string) $initial]);
                $set($behavior->tablist_id, ['role' => 'tablist', 'aria-label' => $behavior->label, 'aria-orientation' => $behavior->orientation]);
                foreach ($behavior->pairs as $pair) {
                    $active = $pair->panel_id === $behavior->active_panel_id;
                    $set($pair->trigger_id, ['role' => 'tab', 'aria-controls' => 'node-'.$pair->panel_id, 'aria-selected' => $active ? 'true' : 'false', 'tabindex' => $active ? '0' : '-1']);
                    $set($pair->panel_id, ['role' => 'tabpanel', 'aria-labelledby' => 'node-'.$pair->trigger_id, 'tabindex' => '0']);
                }
            } elseif ($behavior->kind === 'disclosure') {
                $set($host, ['data-g7pb-accordion' => '', 'data-g7pb-accordion-behavior' => $behavior->mode]);
                foreach ($behavior->pairs as $pair) {
                    $set($pair->item_id, ['data-g7pb-accordion-item' => '', 'data-g7pb-open' => $pair->expanded ? 'true' : 'false']);
                    $set($pair->trigger_id, ['data-g7pb-accordion-trigger' => '', 'aria-controls' => 'node-'.$pair->panel_id, 'aria-expanded' => $pair->expanded ? 'true' : 'false']);
                    $set($pair->panel_id, ['data-g7pb-accordion-panel' => '', 'aria-labelledby' => 'node-'.$pair->trigger_id, 'role' => 'region']);
                }
            } else {
                $slides = $tree[$behavior->track_id]->slots->content ?? [];
                $initial = array_find_key($slides, fn (stdClass $slide): bool => $slide->instance_id === $behavior->active_slide_id);
                $set($host, ['data-g7pb-slider' => '', 'role' => 'region', 'aria-roledescription' => '캐러셀', 'aria-label' => $behavior->label,
                    'data-g7pb-slider-initial' => (string) $initial, 'data-g7pb-slider-loop' => $behavior->loop ? 'true' : 'false',
                    'data-g7pb-slider-autoplay' => $behavior->autoplay ? 'true' : 'false', 'data-g7pb-slider-interval' => (string) $behavior->interval_ms]);
                $set($behavior->viewport_id, ['data-g7pb-slider-viewport' => '']);
                $set($behavior->track_id, ['data-g7pb-slider-track' => '', 'aria-live' => $behavior->autoplay ? 'off' : 'polite', 'aria-atomic' => 'false']);
                $set($behavior->previous_id, ['data-g7pb-slider-prev' => '', 'aria-controls' => 'node-'.$behavior->viewport_id]);
                $set($behavior->next_id, ['data-g7pb-slider-next' => '', 'aria-controls' => 'node-'.$behavior->viewport_id]);
                if (isset($behavior->rotation_id)) {
                    $set($behavior->rotation_id, ['data-g7pb-slider-toggle' => '', 'aria-controls' => 'node-'.$behavior->viewport_id, 'aria-pressed' => $behavior->autoplay ? 'true' : 'false']);
                }
                $styles[$behavior->viewport_id]['overflow'] = 'hidden';
                $defaults($behavior->track_id, [['display', 'display', 'flex'], ['direction', 'flex-direction', 'row'], ['wrap', 'flex-wrap', 'nowrap']]);
                foreach ($slides as $index => $slide) {
                    $set($slide->instance_id, ['data-g7pb-slider-slide' => '', 'role' => 'group', 'aria-roledescription' => '슬라이드', 'aria-label' => ($index + 1).' / '.count($slides)]);
                    $defaults($slide->instance_id, [['grow', 'flex-grow', '0'], ['shrink', 'flex-shrink', '0'], ['basis', 'flex-basis', '100%'], ['min_width', 'min-width', '0px']]);
                }
            }
        }

        return ['attributes' => $attributes, 'styles' => $styles];
    }

    /** @param list<stdClass> $nodes
     * @param  array<string, stdClass>  $tree
     */
    private static function index(array $nodes, array &$tree): void
    {
        foreach ($nodes as $node) {
            if (! is_string($node->instance_id)) {
                throw new \InvalidArgumentException('node_identity');
            }
            $tree[$node->instance_id] = $node;
            self::index($node->slots->content ?? [], $tree);
        }
    }
}
