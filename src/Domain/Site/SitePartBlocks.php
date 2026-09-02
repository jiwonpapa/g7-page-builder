<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

/** Immutable node input; historical reads retain the original envelope. */
final readonly class SitePartBlocks
{
    /** @param list<array<string, mixed>> $values */
    private function __construct(private array $values) {}

    /** @param array<mixed> $values */
    public static function fromArray(array $values): self
    {
        if (! array_is_list($values)) {
            throw new \InvalidArgumentException('Site Part blocks must be a list.');
        }
        $ids = [];
        foreach ($values as $value) {
            self::validateNode($value, $ids);
        }

        return new self($values);
    }

    /** @param list<array<string, mixed>> $values */
    public static function fromStoredArray(array $values): self
    {
        return new self($values);
    }

    /** @return list<array<string, mixed>> */
    public function toArray(): array
    {
        return $this->values;
    }

    /** @param array<string, true> $ids */
    private static function validateNode(mixed $node, array &$ids): void
    {
        $keys = ['instance_id', 'type', 'block_version', 'props', 'slots'];
        if (! is_array($node) || array_diff($keys, array_keys($node)) !== [] || array_diff(array_keys($node), $keys) !== []) {
            throw new \InvalidArgumentException('Site Part block fields are invalid.');
        }
        $id = $node['instance_id'];
        if (! is_string($id) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $id) !== 1 || isset($ids[strtolower($id)])) {
            throw new \InvalidArgumentException('Site Part block id must be a unique UUID.');
        }
        $ids[strtolower($id)] = true;
        if ($node['block_version'] !== 1 || ! is_string($node['type'])) {
            throw new \InvalidArgumentException('Site Part block version or type is unsupported.');
        }
        foreach (['props', 'slots'] as $key) {
            if (! is_array($node[$key]) || ($node[$key] !== [] && array_is_list($node[$key]))) {
                throw new \InvalidArgumentException("Site Part block {$key} must be an object.");
            }
        }
        foreach ($node['slots'] as $name => $children) {
            if (! is_string($name) || ! is_array($children) || ! array_is_list($children)) {
                throw new \InvalidArgumentException('Site Part slot children must be a list.');
            }
            foreach ($children as $child) {
                self::validateNode($child, $ids);
            }
        }
    }
}
