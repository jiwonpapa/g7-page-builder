<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class BlockPackManifest
{
    public const VERSION = 'g7pb-block-pack/v1';

    /**
     * @param  array{id: string, name: string, key_id?: string}  $publisher
     * @param  array{page_builder: string, php: string, g7: string}  $compatibility
     * @param  list<BlockDefinition>  $blocks
     * @param  list<BlockPreset>  $presets
     * @param  array{provider: string, editor: string, styles: list<string>}|null  $runtime
     * @param  array<string, string>  $files
     */
    public function __construct(
        public string $packId,
        public string $packVersion,
        public string $kind,
        public array $publisher,
        public array $compatibility,
        public array $blocks,
        public array $presets,
        public ?array $runtime,
        public array $files,
        public string $manifestVersion = self::VERSION,
    ) {
        if ($this->manifestVersion !== self::VERSION) {
            throw new \InvalidArgumentException('Block Pack manifest version is not supported.');
        }

        BlockPackRules::assertPackId($this->packId);
        BlockPackRules::assertSemver($this->packVersion, 'version');

        if (! in_array($this->kind, ['data', 'code'], true)) {
            throw new \InvalidArgumentException('Block Pack kind must be data or code.');
        }

        $this->assertPublisher();
        [$packPublisher] = explode('/', $this->packId, 2);
        if ($packPublisher !== $this->publisher['id']) {
            throw new \InvalidArgumentException('Block Pack id publisher must match publisher.id.');
        }
        $this->assertCompatibility();
        $this->assertRuntime();
        $this->assertFiles();
        $this->assertContent();
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $packId = self::string($data, 'pack_id');
        $packVersion = self::string($data, 'pack_version');
        $blocks = self::objectList($data, 'blocks');
        $presets = self::objectList($data, 'presets');

        $runtimeData = $data['runtime'] ?? null;
        if ($runtimeData !== null && ! is_array($runtimeData)) {
            throw new \InvalidArgumentException('Block Pack runtime must be an object.');
        }

        return new self(
            packId: $packId,
            packVersion: $packVersion,
            kind: self::string($data, 'kind'),
            publisher: self::publisher($data),
            compatibility: self::compatibility($data),
            blocks: array_map(
                static fn (array $block): BlockDefinition => BlockDefinition::fromArray($packId, $packVersion, $block),
                $blocks,
            ),
            presets: array_map(
                static fn (array $preset): BlockPreset => BlockPreset::fromArray($packId, $packVersion, $preset),
                $presets,
            ),
            runtime: $runtimeData === null ? null : self::runtime($runtimeData),
            files: self::files($data),
            manifestVersion: self::string($data, 'manifest_version'),
        );
    }

    public static function fromJson(string $json): self
    {
        try {
            $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new \InvalidArgumentException('Block Pack manifest JSON is invalid.', 0, $exception);
        }

        if (! is_array($data)) {
            throw new \InvalidArgumentException('Block Pack manifest must be an object.');
        }

        return self::fromArray($data);
    }

    public function identity(): string
    {
        return $this->packId.'@'.$this->packVersion;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $data = [
            'manifest_version' => $this->manifestVersion,
            'pack_id' => $this->packId,
            'pack_version' => $this->packVersion,
            'kind' => $this->kind,
            'publisher' => $this->publisher,
            'compatibility' => $this->compatibility,
            'blocks' => array_map(
                static fn (BlockDefinition $definition): array => $definition->toArray(),
                $this->blocks,
            ),
            'presets' => array_map(
                static fn (BlockPreset $preset): array => $preset->toArray(),
                $this->presets,
            ),
            'files' => $this->files,
        ];

        if ($this->runtime !== null) {
            $data['runtime'] = $this->runtime;
        }

        return $data;
    }

    private function assertPublisher(): void
    {
        if (preg_match('/^[a-z0-9][a-z0-9._-]{1,63}$/', $this->publisher['id']) !== 1) {
            throw new \InvalidArgumentException('Block Pack publisher id is invalid.');
        }
        if ($this->publisher['name'] === '' || mb_strlen($this->publisher['name']) > 120) {
            throw new \InvalidArgumentException('Block Pack publisher name is invalid.');
        }
        $keyId = $this->publisher['key_id'] ?? null;
        if ($keyId !== null && preg_match('/^[A-Za-z0-9._:-]{1,128}$/', $keyId) !== 1) {
            throw new \InvalidArgumentException('Block Pack publisher key id is invalid.');
        }
    }

    private function assertCompatibility(): void
    {
        foreach ($this->compatibility as $constraint) {
            if ($constraint === '' || strlen($constraint) > 64) {
                throw new \InvalidArgumentException('Block Pack compatibility constraint is invalid.');
            }
        }
    }

    private function assertRuntime(): void
    {
        if ($this->kind === 'data' && $this->runtime !== null) {
            throw new \InvalidArgumentException('Data Block Packs cannot declare runtime code.');
        }
        if ($this->kind === 'code' && $this->runtime === null) {
            throw new \InvalidArgumentException('Code Block Packs require a runtime provider.');
        }
        if ($this->runtime === null) {
            return;
        }

        BlockPackRules::assertIdentifier($this->runtime['provider'], 'runtime provider');
        BlockPackRules::assertRelativePath($this->runtime['editor'], 'runtime editor');
        foreach ($this->runtime['styles'] as $style) {
            BlockPackRules::assertRelativePath($style, 'runtime style');
        }
    }

    private function assertFiles(): void
    {
        foreach ($this->files as $path => $sha256) {
            BlockPackRules::assertRelativePath($path, 'file path');
            BlockPackRules::assertSha256($sha256, "file digest for {$path}");
        }
    }

    private function assertContent(): void
    {
        if ($this->kind === 'data' && $this->blocks !== []) {
            throw new \InvalidArgumentException('Data Block Packs cannot define new block types.');
        }
        if ($this->kind === 'code' && $this->blocks === []) {
            throw new \InvalidArgumentException('Code Block Packs require at least one block definition.');
        }

        $blockIdentities = [];
        foreach ($this->blocks as $definition) {
            if ($definition->packId !== $this->packId || $definition->packVersion !== $this->packVersion) {
                throw new \InvalidArgumentException('Block definition owner does not match its Pack.');
            }
            if (isset($blockIdentities[$definition->identity()])) {
                throw new \InvalidArgumentException('Block Pack contains a duplicate block definition.');
            }
            $blockIdentities[$definition->identity()] = true;
        }

        $presetIdentities = [];
        foreach ($this->presets as $preset) {
            if ($preset->packId !== $this->packId || $preset->packVersion !== $this->packVersion) {
                throw new \InvalidArgumentException('Block preset owner does not match its Pack.');
            }
            if (isset($presetIdentities[$preset->identity()])) {
                throw new \InvalidArgumentException('Block Pack contains a duplicate preset.');
            }
            $presetIdentities[$preset->identity()] = true;
        }
    }

    /** @param array<string, mixed> $data */
    private static function string(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (! is_string($value) || $value === '') {
            throw new \InvalidArgumentException("Block Pack {$key} is required.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private static function objectList(array $data, string $key): array
    {
        $value = $data[$key] ?? null;
        if (! is_array($value)) {
            throw new \InvalidArgumentException("Block Pack {$key} must be a list.");
        }

        $normalized = [];
        foreach ($value as $item) {
            if (! is_array($item)) {
                throw new \InvalidArgumentException("Block Pack {$key} item must be an object.");
            }
            $normalized[] = $item;
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{id: string, name: string, key_id?: string}
     */
    private static function publisher(array $data): array
    {
        $value = $data['publisher'] ?? null;
        if (! is_array($value)) {
            throw new \InvalidArgumentException('Block Pack publisher must be an object.');
        }

        $publisher = [
            'id' => self::string($value, 'id'),
            'name' => self::string($value, 'name'),
        ];
        if (isset($value['key_id'])) {
            $publisher['key_id'] = self::string($value, 'key_id');
        }

        return $publisher;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{page_builder: string, php: string, g7: string}
     */
    private static function compatibility(array $data): array
    {
        $value = $data['compatibility'] ?? null;
        if (! is_array($value)) {
            throw new \InvalidArgumentException('Block Pack compatibility must be an object.');
        }

        return [
            'page_builder' => self::string($value, 'page_builder'),
            'php' => self::string($value, 'php'),
            'g7' => self::string($value, 'g7'),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{provider: string, editor: string, styles: list<string>}
     */
    private static function runtime(array $data): array
    {
        $styles = $data['styles'] ?? null;
        if (! is_array($styles)) {
            throw new \InvalidArgumentException('Block Pack runtime styles must be a list.');
        }

        $normalizedStyles = [];
        foreach ($styles as $style) {
            if (! is_string($style)) {
                throw new \InvalidArgumentException('Block Pack runtime style path is invalid.');
            }
            $normalizedStyles[] = $style;
        }

        return [
            'provider' => self::string($data, 'provider'),
            'editor' => self::string($data, 'editor'),
            'styles' => $normalizedStyles,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, string>
     */
    private static function files(array $data): array
    {
        $value = $data['files'] ?? null;
        if (! is_array($value)) {
            throw new \InvalidArgumentException('Block Pack files must be an object.');
        }

        $files = [];
        foreach ($value as $path => $digest) {
            if (! is_string($path) || ! is_string($digest)) {
                throw new \InvalidArgumentException('Block Pack file entry is invalid.');
            }
            $files[$path] = $digest;
        }

        return $files;
    }
}
