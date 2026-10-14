<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use stdClass;

/** Pure shared capability grammar. Public transport and live records stay outside the domain. */
final class DataBindings
{
    /** @param array<string, mixed> $rules */
    public static function validate(stdClass $document, array $rules): void
    {
        self::visit($document->blocks, false, $rules);
        DataControls::validate($document, $rules);
    }

    /** @param list<stdClass> $nodes
     * @param  array<string, mixed>  $rules
     */
    private static function visit(array $nodes, bool $inside, array $rules): void
    {
        foreach ($nodes as $node) {
            if ($inside && (isset($node->data) || isset($node->binding) || isset($node->system) || isset($node->behavior) || str_starts_with($node->type, 'form.'))) {
                Schema::reject('data_owner', $node->instance_id);
            }
            $data = $node->data ?? null;
            if ($data !== null) {
                if (! in_array($node->type, $rules['host_types'], true) || ! in_array($node->props->tag ?? '', $rules['host_tags'], true)
                    || isset($node->binding) || isset($node->system) || isset($node->behavior) || count($node->slots->content ?? []) !== 1) {
                    Schema::reject('data_host', $node->instance_id);
                }
                if (! in_array($data->feed, $rules['feeds'][$data->source], true)) {
                    Schema::reject('data_feed', $node->instance_id);
                }
                if ((($data->feed === 'board' || $data->source === 'post-detail') && $data->board_slug === '')
                    || ($data->source === 'product-detail' && $data->product_key === '')) {
                    Schema::reject('data_source', $node->instance_id);
                }
                $children = [];
                self::collect($node->slots->content ?? [], $children);
                $keys = [];
                foreach ($data->fields as $field) {
                    $target = $children[$field->node_id] ?? null;
                    $key = $field->node_id.':'.$field->property;
                    if ($target === null || isset($keys[$key])) {
                        Schema::reject('data_reference', $field->node_id);
                    }
                    $keys[$key] = true;
                    if (! in_array($target->type, $rules['properties'][$field->property], true) || ! in_array($field->field, $rules['fields'][$field->property], true)) {
                        Schema::reject('data_field', $field->node_id);
                    }
                }
            }
            self::visit($node->slots->content ?? [], $inside || $data !== null, $rules);
        }
    }

    /** @param list<stdClass> $nodes
     * @param  array<string, stdClass>  $entries
     *
     * @param-out array<string, stdClass> $entries
     */
    private static function collect(array $nodes, array &$entries): void
    {
        foreach ($nodes as $node) {
            if (! is_string($node->instance_id)) {
                Schema::reject('shape');
            }
            $entries[$node->instance_id] = $node;
            self::collect($node->slots->content ?? [], $entries);
        }
    }
}
