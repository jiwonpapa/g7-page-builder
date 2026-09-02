<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

/** Validates the write envelope, without judging or completing draft content. */
final class PageDocumentWritePolicy
{
    /** @param array<string, mixed> $data */
    public static function validate(array $data): void
    {
        $schema = self::schema();
        self::fields($data, $schema, '$');
        foreach (['tokens', 'seo'] as $field) {
            if (array_key_exists($field, $data)) {
                self::object($data[$field], $field);
            }
        }
        if (array_key_exists('shell_mode', $data) && ! is_string($data['shell_mode'])) {
            self::reject('shell_mode');
        }
        $blocks = $data['blocks'];
        if (! is_array($blocks) || ! array_is_list($blocks)) {
            self::reject('blocks');
        }
        $pending = [];
        foreach ($blocks as $index => $block) {
            $pending[] = [$block, 'blocks.'.$index];
        }
        $ids = [];
        while ($pending !== []) {
            [$block, $path] = array_pop($pending);
            $block = self::object($block, $path);
            self::fields($block, $schema['$defs']['block'], $path);
            $id = $block['instance_id'];
            if (! is_string($id) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id) !== 1) {
                self::reject($path.'.instance_id');
            }
            if (isset($ids[strtolower($id)])) {
                self::reject($path.'.instance_id (duplicate)');
            }
            $ids[strtolower($id)] = true;
            if (count($ids) > 500) {
                self::reject('blocks (node limit)');
            }
            $type = $block['type'];
            if (! is_string($type) || preg_match('/^[a-z0-9][a-z0-9._\/-]+$/', $type) !== 1) {
                self::reject($path.'.type');
            }
            $version = $block['block_version'];
            if ((! is_int($version) && ! is_float($version)) || ! is_finite((float) $version) || $version < 1 || floor($version) != $version) {
                self::reject($path.'.block_version');
            }
            $props = self::object($block['props'], $path.'.props');
            $layoutFields = self::knownBlock($type, $version, $props, $data['schema_version'], $path, $schema);
            foreach (['motion' => 'motion', 'visibility' => 'visibility', 'responsive' => 'blockResponsive'] as $field => $definition) {
                if (array_key_exists($field, $block)) {
                    self::settings($block[$field], $schema['$defs'][$definition], $path.'.'.$field, $schema['$defs']);
                }
            }
            /** @var array<string, array{layout?: array<string, mixed>}> $responsive */
            $responsive = $block['responsive'] ?? [];
            foreach ($responsive as $viewport => $override) {
                if (isset($override['layout']) && array_diff(array_keys($override['layout']), $layoutFields) !== []) {
                    self::reject($path.'.responsive.'.$viewport.'.layout');
                }
            }
            $slots = self::object($block['slots'] ?? [], $path.'.slots');
            if (array_key_exists('slots', $block) && $block['slots'] === null) {
                self::reject($path.'.slots');
            }
            foreach ($slots as $name => $children) {
                if (preg_match('/^[a-z][a-z0-9_-]*$/', $name) !== 1 || ! is_array($children) || ! array_is_list($children) || count($children) > 200) {
                    self::reject($path.'.slots.'.$name);
                }
                foreach ($children as $index => $child) {
                    $pending[] = [$child, $path.'.slots.'.$name.'.'.$index];
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $props
     * @param  array{properties: array<string, mixed>, required: list<string>, '$defs': array<string, array<string, mixed>>}  $schema
     * @return list<string>
     */
    private static function knownBlock(string $type, int|float $version, array $props, mixed $schemaVersion, string $path, array $schema): array
    {
        $versions = self::builtinVersions();
        if (isset($versions[$type]) && $version != $versions[$type]) {
            self::reject($path.'.block_version');
        }
        /** @var list<array{if?: array{properties: array{type: array{const: string}}}, then?: array{properties: array{block_version: array{const: int}, props: array{'$ref': string}}}}> $variants */
        $variants = $schema['$defs']['block']['allOf'];
        foreach ($variants as $variant) {
            if (($variant['if']['properties']['type']['const'] ?? null) !== $type || ! isset($variant['then'])) {
                continue;
            }
            $rules = $variant['then']['properties'];
            if ($version != $rules['block_version']['const']) {
                self::reject($path.'.block_version');
            }
            if (str_starts_with($type, 'layout.')) {
                if ($schemaVersion !== 'g7-page-builder/v2') {
                    self::reject($path.'.type');
                }
                $definition = $schema['$defs'][substr($rules['props']['$ref'], strlen('#/$defs/'))];
                self::fields($props, $definition, $path.'.props');
                /** @var array<string, array{enum: list<string|int>}> $properties */
                $properties = $definition['properties'];
                foreach ($properties as $field => $rule) {
                    if (! in_array($props[$field], $rule['enum'], true)) {
                        self::reject($path.'.props.'.$field);
                    }
                }

                return array_keys($properties);
            }

            return [];
        }

        return [];
    }

    /** Only the envelope setting definitions are visited; content props are excluded.
     * @param  array<string, mixed>  $rule
     * @param  array<string, array<string, mixed>>  $definitions
     */
    private static function settings(mixed $value, array $rule, string $path, array $definitions): void
    {
        if (isset($rule['$ref']) && is_string($rule['$ref'])) {
            self::settings($value, $definitions[substr($rule['$ref'], strlen('#/$defs/'))], $path, $definitions);

            return;
        }
        if (isset($rule['enum']) && is_array($rule['enum'])) {
            if (! in_array($value, $rule['enum'], true)) {
                self::reject($path);
            }

            return;
        }
        if (array_key_exists('const', $rule)) {
            if ($value !== $rule['const']) {
                self::reject($path);
            }

            return;
        }
        if (($rule['type'] ?? null) !== 'object') {
            throw new \LogicException('Unsupported envelope setting schema: '.$path);
        }
        $object = self::object($value, $path);
        self::fields($object, $rule, $path);
        if (isset($rule['minProperties']) && count($object) < $rule['minProperties']) {
            self::reject($path);
        }
        /** @var array<string, array<string, mixed>> $properties */
        $properties = $rule['properties'];
        foreach ($object as $field => $setting) {
            self::settings($setting, $properties[$field], $path.'.'.$field, $definitions);
        }
    }

    /** @return array<string, mixed> */
    private static function object(mixed $value, string $path): array
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            self::reject($path);
        }
        foreach (array_keys($value) as $key) {
            if (! is_string($key)) {
                self::reject($path);
            }
        }

        return $value;
    }

    /** @param array<string, mixed> $value
     * @param  array<string, mixed>  $definition
     */
    private static function fields(array $value, array $definition, string $path): void
    {
        /** @var array<string, mixed> $properties */
        $properties = $definition['properties'];
        /** @var list<string> $required */
        $required = $definition['required'] ?? [];
        if (array_diff(array_keys($value), array_keys($properties)) !== [] || array_diff($required, array_keys($value)) !== []) {
            self::reject($path.' (fields)');
        }
    }

    private static function reject(string $path): never
    {
        throw new \InvalidArgumentException('Invalid page write contract: '.$path);
    }

    /** @return array<string, int> */
    private static function builtinVersions(): array
    {
        static $versions = null;
        if ($versions === null) {
            $path = dirname(__DIR__, 3).'/resources/block-packs/builtin-core/manifest.json';
            /** @var array{blocks: list<array{block_id: string, block_version: int}>} $manifest */
            $manifest = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
            $versions = array_column($manifest['blocks'], 'block_version', 'block_id');
        }

        return $versions;
    }

    /** @return array{properties: array<string, mixed>, required: list<string>, '$defs': array<string, array<string, mixed>>} */
    private static function schema(): array
    {
        static $schema = null;
        if ($schema === null) {
            $path = dirname(__DIR__, 3).'/schemas/page-builder-document.schema.json';
            $schema = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        }

        return $schema;
    }
}
