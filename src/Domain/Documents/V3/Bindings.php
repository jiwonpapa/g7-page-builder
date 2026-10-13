<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use stdClass;

/** Fixed service capability grammar; no endpoints, live values or framework dependencies. */
final class Bindings
{
    /** @param array<string, mixed> $policy */
    public static function validate(stdClass $document, array $policy): void
    {
        $entries = [];
        self::index($document->blocks, [], $entries);
        $triggers = [];
        foreach ($entries as $entry) {
            $behavior = $entry['node']->behavior ?? null;
            if ($behavior === null) {
                continue;
            }
            $ids = $behavior->kind === 'carousel'
                ? [$behavior->previous_id, $behavior->next_id, $behavior->rotation_id ?? null]
                : array_map(fn (stdClass $pair): string => $pair->trigger_id, $behavior->pairs);
            foreach ($ids as $id) {
                if ($id !== null) {
                    $triggers[$id] = true;
                }
            }
        }
        foreach ($entries as $entry) {
            $host = $entry['node'];
            $binding = $host->binding ?? null;
            if ($binding === null) {
                continue;
            }
            if (! in_array($host->type, $policy['host_types'], true) || ! in_array($host->props->tag ?? '', $policy['host_tags'], true)) {
                Schema::reject('binding_host', $host->instance_id);
            }
            if (isset($host->behavior) || array_any($entry['ancestors'], fn (stdClass $node): bool => isset($node->binding))) {
                Schema::reject('binding_owner', $host->instance_id);
            }
            $used = $names = [];
            $target = function (string $id, string $type) use ($entries, $host, &$used): stdClass {
                $item = $entries[$id] ?? null;
                if ($item === null || ! in_array($host, $item['ancestors'], true)) {
                    Schema::reject('binding_reference', $id);
                }
                if (isset($used[$id])) {
                    Schema::reject('binding_duplicate', $id);
                }
                $used[$id] = true;
                if ($item['node']->type !== $type) {
                    Schema::reject('binding_role', $id);
                }

                return $item['node'];
            };
            foreach ($binding->fields as $field) {
                if (isset($names[$field->name])) {
                    Schema::reject('binding_duplicate', $host->instance_id);
                }
                $names[$field->name] = true;
                $input = $target($field->input_id, 'form.control');
                $target($field->label_id, 'form.label');
                if ($input->props->kind !== $policy['fields'][$field->name]['kind']) {
                    Schema::reject('binding_control', $field->input_id);
                }
            }
            foreach ($policy['fields'] as $name => $rule) {
                if ($rule['required'] && ! isset($names[$name])) {
                    Schema::reject('binding_required', $host->instance_id);
                }
            }
            $target($binding->submit_id, 'action.button');
            $target($binding->status_id, 'content.text');
            if (isset($triggers[$binding->submit_id])) {
                Schema::reject('binding_action', $binding->submit_id);
            }
        }
    }

    /** @param list<stdClass> $nodes
     * @param  list<stdClass>  $ancestors
     * @param  array<string, array{node: stdClass, ancestors: list<stdClass>}>  $entries
     */
    private static function index(array $nodes, array $ancestors, array &$entries): void
    {
        foreach ($nodes as $node) {
            if (! is_string($node->instance_id)) {
                Schema::reject('shape');
            }
            $entries[$node->instance_id] = ['node' => $node, 'ancestors' => $ancestors];
            self::index($node->slots->content ?? [], [...$ancestors, $node], $entries);
        }
    }
}
