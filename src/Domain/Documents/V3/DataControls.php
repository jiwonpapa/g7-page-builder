<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use stdClass;

/** Stable references to ordinary authored controls outside the repeated prototype. */
final class DataControls
{
    /** @param array<string, mixed> $rules */
    public static function validate(stdClass $document, array $rules): void
    {
        $entries = [];
        self::index($document->blocks, [], $entries);
        $used = [];
        foreach ($entries as $entry) {
            $host = $entry['node'];
            $data = $host->data ?? null;
            $controls = $data->controls ?? null;
            if ($controls === null) {
                continue;
            }
            $roles = array_filter(array_keys($rules['control_roles']), fn (int|string $role): bool => is_string($role) && isset($controls->{$role}));
            $paging = [$controls->previous_id ?? null, $controls->next_id ?? null, $controls->status_id ?? null];
            if (str_ends_with($data->source, '-detail') || $roles === [] || (array_any($paging, fn ($id): bool => $id !== null) && in_array(null, $paging, true))) {
                Schema::reject('data_controls', $host->instance_id);
            }
            foreach ($roles as $role) {
                $id = $controls->{$role};
                $target = $entries[$id] ?? null;
                if ($target === null) {
                    Schema::reject('data_control_reference', $id);
                }
                $node = $target['node'];
                if (! in_array($node->type, $rules['control_roles'][$role], true)
                    || ($node->type === 'form.control' && ! in_array($node->props->kind, $rules['control_kinds'], true))
                    || array_any([...$target['ancestors'], $node], fn (stdClass $item): bool => isset($item->data) || isset($item->binding) || isset($item->system) || isset($item->behavior))) {
                    Schema::reject('data_control_owner', $id);
                }
                if (isset($used[$id])) {
                    Schema::reject('data_control_duplicate', $id);
                }
                $used[$id] = true;
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
