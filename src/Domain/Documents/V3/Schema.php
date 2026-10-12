<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use InvalidArgumentException;
use JsonException;
use stdClass;

/** Checked-in bounded JSON Schema subset; not an API for arbitrary schemas. */
final class Schema
{
    public static function decode(string $json, mixed $maxDepth): mixed
    {
        if (! is_int($maxDepth) || $maxDepth < 1 || $maxDepth > 512) {
            self::reject('schema');
        }
        try {
            return json_decode($json, flags: JSON_THROW_ON_ERROR, depth: $maxDepth + 1);
        } catch (JsonException $error) {
            self::reject($error->getCode() === JSON_ERROR_DEPTH ? 'json_depth' : 'json');
        }
    }

    /** @param array<string, mixed> $rule
     * @param  array<string, mixed>  $definitions
     */
    public static function validate(mixed $value, array $rule, array $definitions, string $path = '$'): void
    {
        if (isset($rule['$ref'])) {
            $name = substr($rule['$ref'], 8);
            if (! str_starts_with($rule['$ref'], '#/$defs/') || ! isset($definitions[$name])) {
                self::reject('schema', $path);
            }
            self::validate($value, $definitions[$name], $definitions, $path);

            return;
        }
        if (isset($rule['anyOf'])) {
            foreach ($rule['anyOf'] as $choice) {
                try {
                    self::validate($value, $choice, $definitions, $path);

                    return;
                } catch (InvalidArgumentException $error) {
                    if (str_starts_with($error->getMessage(), 'schema:')) {
                        throw $error;
                    }
                }
            }
            self::reject('value', $path.':anyOf');
        }
        if (array_key_exists('const', $rule) && ! self::equal($value, $rule['const'])) {
            self::reject('value', $path);
        }
        if (isset($rule['enum']) && ! array_any($rule['enum'], fn ($item) => self::equal($value, $item))) {
            self::reject('value', $path);
        }
        switch ($rule['type'] ?? null) {
            case 'object':
                if (! $value instanceof stdClass) {
                    self::reject('shape', $path);
                }
                foreach ($rule['required'] ?? [] as $key) {
                    if (! property_exists($value, $key)) {
                        self::reject('required', $path.'.'.$key);
                    }
                }
                foreach (get_object_vars($value) as $key => $child) {
                    if (! array_key_exists($key, $rule['properties'] ?? [])) {
                        self::reject('unknown_field', $path.'.'.$key);
                    }
                    self::validate($child, $rule['properties'][$key], $definitions, $path.'.'.$key);
                }
                break;
            case 'array':
                if (! is_array($value) || ! array_is_list($value)) {
                    self::reject('shape', $path);
                }
                if (count($value) < ($rule['minItems'] ?? 0) || count($value) > ($rule['maxItems'] ?? PHP_INT_MAX)) {
                    self::reject('range', $path);
                }
                foreach ($value as $index => $child) {
                    self::validate($child, $rule['items'], $definitions, $path.'.'.$index);
                }
                break;
            case 'string':
                if (! is_string($value)) {
                    self::reject('shape', $path);
                }
                $length = preg_match_all('/./us', $value);
                if ($length === false || $length < ($rule['minLength'] ?? 0) || $length > ($rule['maxLength'] ?? PHP_INT_MAX)
                    || isset($rule['pattern']) && preg_match('~'.str_replace('~', '\\~', $rule['pattern']).'~uD', $value) !== 1) {
                    self::reject('value', $path);
                }
                break;
            case 'number':
                if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value)) {
                    self::reject('shape', $path);
                }
                if ($value < ($rule['minimum'] ?? -INF) || $value > ($rule['maximum'] ?? INF)) {
                    self::reject('range', $path);
                }
                if (isset($rule['multipleOf']) && abs($value / $rule['multipleOf'] - round($value / $rule['multipleOf'])) > 1e-7) {
                    self::reject('precision', $path);
                }
                break;
            case 'boolean':
                if (! is_bool($value)) {
                    self::reject('shape', $path);
                }
                break;
            case null: break;
            default: self::reject('schema', $path);
        }
    }

    private static function equal(mixed $left, mixed $right): bool
    {
        return (is_int($left) || is_float($left)) && (is_int($right) || is_float($right))
            ? $left == $right : $left === $right;
    }

    public static function reject(string $code, string $path = '$'): never
    {
        throw new InvalidArgumentException($code.': '.$path);
    }
}
