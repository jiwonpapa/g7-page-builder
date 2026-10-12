<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\LayoutPolicy;
use stdClass;

/** Pure target-contract validation. Schema/policy loading belongs to composition, not this domain. */
final readonly class Validator
{
    /** @param array<string, mixed> $schema
     * @param  array<string, mixed>  $policy
     */
    public function __construct(private array $schema, private array $policy) {}

    public function validateJson(string $json): stdClass
    {
        $value = Schema::decode($json, $this->policy['limits']['json_depth']);
        if (LayoutPolicy::compactJsonBytes($value) > $this->policy['limits']['utf8_bytes']) {
            Schema::reject('byte_limit');
        }
        Schema::validate($value, $this->schema, $this->schema['$defs']);
        if (! $value instanceof stdClass) {
            Schema::reject('shape');
        }
        $assets = [];
        foreach ($value->assets as $asset) {
            if (isset($assets[$asset->asset_id])) {
                Schema::reject('duplicate_asset');
            }
            $assets[$asset->asset_id] = true;
        }
        foreach (get_object_vars($value->tokens) as $color) {
            if ($color->kind !== 'hex') {
                Schema::reject('token_cycle');
            }
        }
        $ids = [];
        $this->nodes($value->blocks, null, 1, $ids, $assets);

        return $value;
    }

    /** @param list<stdClass> $nodes
     * @param  array<string, bool>  $ids
     * @param  array<string, bool>  $assets
     */
    private function nodes(array $nodes, ?stdClass $parent, int $depth, array &$ids, array $assets): void
    {
        if ($nodes !== [] && $depth > $this->policy['limits']['depth']) {
            Schema::reject('depth_limit');
        }
        foreach ($nodes as $node) {
            $identity = $node->instance_id;
            if (! is_string($identity)) {
                Schema::reject('shape');
            }
            if (isset($ids[$identity])) {
                Schema::reject('duplicate_id');
            }
            $ids[$identity] = true;
            if (count($ids) > $this->policy['limits']['nodes']) {
                Schema::reject('node_limit');
            }
            $required = $this->policy['node_props'][$node->type];
            if (count(get_object_vars($node->props)) !== count($required)
                || array_any($required, fn ($key) => ! property_exists($node->props, $key))) {
                Schema::reject('props_type');
            }
            if (! in_array($node->type, $this->policy['containers'], true) && get_object_vars($node->slots) !== []) {
                Schema::reject('leaf_slots');
            }
            Semantics::validate($node, $parent, $this->policy['semantics']);
            if ($node->type === 'media.image' && ! isset($assets[$node->props->asset_id])) {
                Schema::reject('asset_reference');
            }
            foreach (['base', 'tablet', 'mobile'] as $viewport) {
                $this->style(self::effectiveStyle($node, $viewport), $parent ? self::effectiveStyle($parent, $viewport) : null, $assets);
            }
            $this->nodes($node->slots->content ?? [], $node, $depth + 1, $ids, $assets);
        }
    }

    public static function effectiveStyle(stdClass $node, string $viewport): stdClass
    {
        if (! in_array($viewport, ['base', 'tablet', 'mobile'], true)) {
            Schema::reject('viewport');
        }

        return (object) array_replace(get_object_vars($node->style), $viewport === 'base' ? [] : get_object_vars($node->responsive->{$viewport} ?? new stdClass));
    }

    public function viewportAt(float $width): string
    {
        if (! is_finite($width) || $width < 0) {
            Schema::reject('viewport');
        }

        return $width < $this->policy['breakpoints']['tablet'] ? 'mobile' : ($width < $this->policy['breakpoints']['desktop'] ? 'tablet' : 'base');
    }

    /** @return array<string, string> */
    public function semanticDisplays(): array
    {
        return $this->policy['semantics']['display'];
    }

    /** @param array<string, bool> $assets */
    private function style(stdClass $style, ?stdClass $parent, array $assets): void
    {
        if (($style->position ?? null) === 'absolute' && ($parent === null || ! in_array($parent->position ?? 'flow', ['relative', 'absolute'], true))) {
            Schema::reject('position_parent');
        }
        if ((property_exists($style, 'rotation') || array_any(['top', 'right', 'bottom', 'left'], fn ($side) => property_exists($style, 'inset_'.$side))) && ($style->position ?? null) !== 'absolute') {
            Schema::reject('position');
        }
        foreach (['width', 'height'] as $axis) {
            $min = $style->{'min_'.$axis} ?? null;
            $max = $style->{'max_'.$axis} ?? null;
            if ($min !== null && $max !== null && $min->unit === $max->unit && $min->value > $max->value) {
                Schema::reject('size_order');
            }
        }
        $background = $style->background ?? null;
        if (($background->kind ?? null) === 'image' && ! isset($assets[$background->asset_id])) {
            Schema::reject('asset_reference');
        }
        if (($background->kind ?? null) === 'linear') {
            foreach ($background->stops as $index => $stop) {
                if ($index > 0 && $stop->offset < $background->stops[$index - 1]->offset) {
                    Schema::reject('gradient_order');
                }
            }
        }
    }
}
