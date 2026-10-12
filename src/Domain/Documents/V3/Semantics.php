<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use stdClass;

/** Structural grammar uses the same versioned policy as the browser validator. */
final class Semantics
{
    /** @param array<string, mixed> $policy */
    public static function validate(stdClass $node, ?stdClass $parent, array $policy): void
    {
        $tag = $node->props->tag ?? '';
        $parentTag = $parent->props->tag ?? '';
        if (isset($policy['parents'][$tag]) && ! in_array($parentTag, $policy['parents'][$tag], true)) {
            Schema::reject('semantic_parent');
        }
        if (isset($policy['children'][$parentTag]) && ! in_array($tag, $policy['children'][$parentTag], true)) {
            Schema::reject('semantic_child');
        }
        $tags = array_map(fn (stdClass $child): string => $child->props->tag ?? '', $node->slots->content ?? []);
        $sequence = $policy['sequence'][$tag] ?? null;
        if ($sequence !== null) {
            $order = array_values($sequence['order']);
            $ranks = array_map(function (string $child) use ($order): int {
                $rank = array_search($child, $order, true);

                return $rank === false ? -1 : $rank;
            }, $tags);
            foreach ($ranks as $index => $rank) {
                if ($index > 0 && $rank < $ranks[$index - 1]) {
                    Schema::reject('semantic_order');
                }
            }
            foreach ($sequence['singletons'] as $child) {
                if (count(array_filter($tags, fn (string $tag): bool => $tag === $child)) > 1) {
                    Schema::reject('semantic_order');
                }
            }
        }
        foreach ($policy['edge_children'][$tag] ?? [] as $child) {
            $indices = array_keys($tags, $child, true);
            if (count($indices) > 1 || count($indices) === 1 && $indices[0] !== 0 && $indices[0] !== count($tags) - 1) {
                Schema::reject('semantic_order');
            }
        }
    }
}
