<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use stdClass;

/** Pure authored interaction grammar; runtime state and vendor objects are excluded. */
final class Behaviors
{
    /** @param array<string, mixed> $policy */
    public static function validate(stdClass $document, array $policy): void
    {
        $entries = [];
        self::index($document->blocks, [], $entries);
        $within = fn (string $id, string $parent): bool => isset($entries[$id])
            && array_any($entries[$id]['ancestors'], fn (stdClass $node): bool => $node->instance_id === $parent);
        foreach ($entries as $entry) {
            $host = $entry['node'];
            $behavior = $host->behavior ?? null;
            if ($behavior === null) {
                continue;
            }
            if (! $behavior instanceof stdClass) {
                Schema::reject('behavior_host', $host->instance_id);
            }
            if (! self::layout($host, $policy)) {
                Schema::reject('behavior_host', $host->instance_id);
            }
            $used = [];
            $target = function (string $id, string $role) use ($entries, $within, $host, $policy, &$used): stdClass {
                $entry = $entries[$id] ?? null;
                if ($entry === null || ! $within($id, $host->instance_id)) {
                    Schema::reject('behavior_reference', $id);
                }
                $afterHost = false;
                foreach ($entry['ancestors'] as $ancestor) {
                    if ($afterHost && isset($ancestor->behavior)) {
                        Schema::reject('behavior_owner', $id);
                    }
                    if ($ancestor === $host) {
                        $afterHost = true;
                    }
                }
                if (isset($entry['node']->behavior)) {
                    Schema::reject('behavior_owner', $id);
                }
                if (isset($used[$id])) {
                    Schema::reject('behavior_duplicate', $id);
                }
                $used[$id] = true;
                if ($role === 'layout' ? ! self::layout($entry['node'], $policy) : ! in_array($entry['node']->type, $policy['trigger_types'], true)) {
                    Schema::reject('behavior_role', $id);
                }

                return $entry['node'];
            };
            $disjoint = function (array $ids) use ($within, $host): void {
                foreach ($ids as $id) {
                    if (array_any($ids, fn (string $other): bool => $other !== $id && $within($id, $other))) {
                        Schema::reject('behavior_overlap', $host->instance_id);
                    }
                }
            };
            if ($behavior->kind === 'carousel') {
                $viewport = $target($behavior->viewport_id, 'layout');
                $track = $target($behavior->track_id, 'layout');
                $target($behavior->previous_id, 'trigger');
                $target($behavior->next_id, 'trigger');
                if (isset($behavior->rotation_id)) {
                    $target($behavior->rotation_id, 'trigger');
                }
                if ($behavior->autoplay && ! isset($behavior->rotation_id)) {
                    Schema::reject('behavior_rotation', $host->instance_id);
                }
                $slides = $track->slots->content ?? [];
                if (count($viewport->slots->content ?? []) !== 1 || $viewport->slots->content[0] !== $track
                    || $slides === [] || array_any($slides, fn (stdClass $node): bool => ! self::layout($node, $policy) || isset($node->behavior))) {
                    Schema::reject('behavior_track', $host->instance_id);
                }
                if (! array_any($slides, fn (stdClass $node): bool => $node->instance_id === $behavior->active_slide_id)) {
                    Schema::reject('behavior_active', $host->instance_id);
                }
                foreach ([$behavior->previous_id, $behavior->next_id, ...isset($behavior->rotation_id) ? [$behavior->rotation_id] : []] as $control) {
                    if ($within($control, $behavior->viewport_id)) {
                        Schema::reject('behavior_overlap', $host->instance_id);
                    }
                }
                if (isset($behavior->rotation_id) && $entries[$behavior->rotation_id]['order'] > min(
                    $entries[$behavior->previous_id]['order'], $entries[$behavior->next_id]['order'], $entries[$behavior->viewport_id]['order'])) {
                    Schema::reject('behavior_order', $host->instance_id);
                }
            } else {
                foreach ($behavior->pairs as $pair) {
                    $target($pair->trigger_id, 'trigger');
                    $target($pair->panel_id, 'layout');
                }
                $disjoint(array_map(fn (stdClass $pair): string => $pair->panel_id, $behavior->pairs));
                foreach ($behavior->pairs as $pair) {
                    if (array_any($behavior->pairs, fn (stdClass $other): bool => $within($pair->trigger_id, $other->panel_id))) {
                        Schema::reject('behavior_overlap', $host->instance_id);
                    }
                }
                if ($behavior->kind === 'tabs') {
                    $target($behavior->tablist_id, 'layout');
                    if (! array_any($behavior->pairs, fn (stdClass $pair): bool => $pair->panel_id === $behavior->active_panel_id)) {
                        Schema::reject('behavior_active', $host->instance_id);
                    }
                    foreach ($behavior->pairs as $pair) {
                        if (! $within($pair->trigger_id, $behavior->tablist_id) || $within($pair->panel_id, $behavior->tablist_id)
                            || $within($behavior->tablist_id, $pair->panel_id)) {
                            Schema::reject('behavior_tablist', $host->instance_id);
                        }
                    }
                } else {
                    if ($behavior->mode === 'single' && count(array_filter($behavior->pairs, fn (stdClass $pair): bool => $pair->expanded)) > 1) {
                        Schema::reject('behavior_expanded', $host->instance_id);
                    }
                    foreach ($behavior->pairs as $pair) {
                        $target($pair->item_id, 'layout');
                        if (! $within($pair->trigger_id, $pair->item_id) || ! $within($pair->panel_id, $pair->item_id)) {
                            Schema::reject('behavior_item', $host->instance_id);
                        }
                    }
                    $disjoint(array_map(fn (stdClass $pair): string => $pair->item_id, $behavior->pairs));
                }
            }
        }
    }

    /** @param array<string, mixed> $policy */
    private static function layout(stdClass $node, array $policy): bool
    {
        return in_array($node->type, $policy['layout_types'], true) && in_array($node->props->tag ?? '', $policy['layout_tags'], true);
    }

    /** @param list<stdClass> $nodes
     * @param  list<stdClass>  $ancestors
     * @param  array<string, array{node: stdClass, ancestors: list<stdClass>, order: int}>  $entries
     */
    private static function index(array $nodes, array $ancestors, array &$entries): void
    {
        foreach ($nodes as $node) {
            if (! is_string($node->instance_id)) {
                Schema::reject('shape');
            }
            $entries[$node->instance_id] = ['node' => $node, 'ancestors' => $ancestors, 'order' => count($entries)];
            self::index($node->slots->content ?? [], [...$ancestors, $node], $entries);
        }
    }
}
