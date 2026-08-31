<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

use InvalidArgumentException;
use JsonException;

/** Pure structural policy; envelope/props validation belongs to the document schema. */
final readonly class LayoutPolicy
{
    /** @param array{policy_version: string, document_schema: string, limits: array{nodes: int, slot_children: int, depth: int, utf8_bytes: int}, root_types: list<string>, leaf_types: list<string>, layouts: array{section: string, columns: string, stack: string}, child_groups: array<string, list<string>>, ratios: array<int, list<string>>, gap_px: array<string, int>} $policy */
    public function __construct(private array $policy) {}

    public function validate(mixed $document): void
    {
        if (! is_array($document) || ! isset($document['blocks']) || ! is_array($document['blocks']) || ! array_is_list($document['blocks'])) {
            $this->reject('shape', 'blocks');
        }
        $pending = [];
        foreach (array_reverse($document['blocks'], true) as $index => $node) {
            $pending[] = [$node, null, 1, 'blocks.'.$index];
        }
        $ids = [];
        $layouts = array_values($this->policy['layouts']);
        $known = [...$this->policy['root_types'], ...$layouts];
        while ($pending !== []) {
            [$node, $parent, $depth, $path] = array_pop($pending);
            if ($depth > $this->policy['limits']['depth']) {
                $this->reject('depth_limit', $path);
            }
            if (! is_array($node) || ! isset($node['props']) || ! is_array($node['props']) || ($node['props'] !== [] && array_is_list($node['props'])) || ! $this->positiveInteger($node['block_version'] ?? null)) {
                $this->reject('shape', $path);
            }
            $id = $node['instance_id'] ?? null;
            if (! is_string($id) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id) !== 1) {
                $this->reject('id', $path);
            }
            $identity = strtolower($id);
            if (isset($ids[$identity])) {
                $this->reject('duplicate_id', $path);
            }
            $ids[$identity] = true;
            if (count($ids) > $this->policy['limits']['nodes']) {
                $this->reject('node_limit', $path);
            }
            $type = $node['type'] ?? null;
            if (! is_string($type) || ! in_array($type, $known, true) || (in_array($type, $layouts, true) && $node['block_version'] != 1)) {
                $this->reject('type', $path);
            }
            if (! $this->allowsChild($parent, $type)) {
                $this->reject('parent', $path);
            }
            $names = $this->slotNames($type, $node['props']);
            $slots = array_key_exists('slots', $node) ? $node['slots'] : [];
            if (! is_array($slots) || ($slots !== [] && array_is_list($slots))) {
                $this->reject('shape', $path.'.slots');
            }
            foreach (array_reverse($slots, true) as $name => $children) {
                if (! in_array($name, $names, true)) {
                    $this->reject('slot', $path.'.slots.'.$name);
                }
                if (! is_array($children) || ! array_is_list($children)) {
                    $this->reject('shape', $path.'.slots.'.$name);
                }
                if (count($children) > $this->policy['limits']['slot_children']) {
                    $this->reject('slot_limit', $path.'.slots.'.$name);
                }
                foreach (array_reverse($children, true) as $index => $child) {
                    $pending[] = [$child, $type, $depth + 1, $path.'.slots.'.$name.'.'.$index];
                }
            }
        }
        if (self::compactJsonBytes($document) > $this->policy['limits']['utf8_bytes']) {
            $this->reject('byte_limit', '$');
        }
    }

    public function allowsChild(?string $parent, string $child): bool
    {
        $layout = $this->policy['layouts'];
        $key = $parent === null ? 'root' : array_search($parent, $layout, true);
        if ($key === false) {
            return false;
        }
        foreach ($this->policy['child_groups'][$key] as $group) {
            $types = match ($group) {
                'compatibility' => $this->policy['root_types'],
                'leaf' => $this->policy['leaf_types'],
                default => [$layout[$group]],
            };
            if (in_array($child, $types, true)) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $props
     * @return list<string>
     */
    public function slotNames(string $type, array $props): array
    {
        $layout = $this->policy['layouts'];
        if ($type === $layout['section'] || $type === $layout['stack']) {
            return ['content'];
        }
        if ($type !== $layout['columns']) {
            return [];
        }
        $columns = $props['columns'] ?? null;
        if (! $this->positiveInteger($columns) || ! in_array($columns, [1, 2, 3])) {
            $this->reject('columns', 'props.columns');
        }
        $columns = (int) $columns;
        if (! in_array($props['ratio'] ?? null, $this->policy['ratios'][$columns], true)) {
            $this->reject('columns', 'props.ratio');
        }

        return array_map(static fn (int $index): string => 'column'.$index, range(1, $columns));
    }

    /** Byte-count normalization only, never a replacement canonical serialization. */
    public static function compactJsonBytes(mixed $value): int
    {
        try {
            $json = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
        } catch (JsonException $error) {
            throw new InvalidArgumentException('json: $', previous: $error);
        }
        // PHP and ECMAScript use different exponent display thresholds. Skip all
        // strings and normalize only number tokens to JS's compact representation.
        $normalized = preg_replace_callback('/"[^"\\\\]*+(?:\\\\.[^"\\\\]*+)*+"(*SKIP)(*F)|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/s', static function (array $match): string {
            $number = json_encode((float) $match[0], JSON_THROW_ON_ERROR);
            if ((float) $number === 0.0) {
                return '0';
            }
            if (! str_contains(strtolower($number), 'e')) {
                return $number;
            }
            [$mantissa, $exponentText] = explode('e', strtolower($number));
            $negative = str_starts_with($mantissa, '-') ? '-' : '';
            $mantissa = ltrim($mantissa, '-');
            $exponent = (int) $exponentText;
            $digits = rtrim(str_replace('.', '', $mantissa), '0');
            if ($exponent >= -6 && $exponent < 21) {
                $point = $exponent + 1;
                if ($point <= 0) {
                    return $negative.'0.'.str_repeat('0', -$point).$digits;
                }
                if ($point >= strlen($digits)) {
                    return $negative.$digits.str_repeat('0', $point - strlen($digits));
                }

                return $negative.substr($digits, 0, $point).'.'.substr($digits, $point);
            }
            $fraction = strlen($digits) > 1 ? '.'.substr($digits, 1) : '';

            return $negative.$digits[0].$fraction.'e'.($exponent >= 0 ? '+' : '').$exponent;
        }, $json);
        if ($normalized === null) {
            throw new InvalidArgumentException('json: $');
        }

        return strlen($normalized);
    }

    private function reject(string $code, string $path): never
    {
        throw new InvalidArgumentException($code.': '.$path);
    }

    private function positiveInteger(mixed $value): bool
    {
        return (is_int($value) && $value >= 1)
            || (is_float($value) && is_finite($value) && $value >= 1 && floor($value) === $value);
    }
}
