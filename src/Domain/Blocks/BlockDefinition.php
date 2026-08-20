<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class BlockDefinition
{
    /**
     * @param  array<string, string>  $label
     * @param  array<string, string>  $description
     * @param  list<string>  $capabilities
     */
    public function __construct(
        public string $packId,
        public string $packVersion,
        public string $blockId,
        public int $blockVersion,
        public string $category,
        public array $label,
        public array $description,
        public string $thumbnail,
        public string $schemaRef,
        public string $editorComponent,
        public string $compiler,
        public array $capabilities,
    ) {
        BlockPackRules::assertPackId($this->packId);
        BlockPackRules::assertSemver($this->packVersion, 'version');
        BlockPackRules::assertIdentifier($this->blockId, 'block_id');
        BlockPackRules::assertIdentifier($this->category, 'block category');
        BlockPackRules::assertLocalizedText($this->label, 'block label');
        BlockPackRules::assertLocalizedText($this->description, 'block description');
        BlockPackRules::assertRelativePath($this->thumbnail, 'block thumbnail');

        if ($this->blockVersion < 1) {
            throw new \InvalidArgumentException('Block version must be positive.');
        }
        if ($this->schemaRef === '' || strlen($this->schemaRef) > 512) {
            throw new \InvalidArgumentException('Block schema reference is invalid.');
        }
        if (preg_match('/^[A-Za-z][A-Za-z0-9]{1,127}$/', $this->editorComponent) !== 1) {
            throw new \InvalidArgumentException('Block editor component key is invalid.');
        }
        BlockPackRules::assertIdentifier($this->compiler, 'compiler key');

        if (count($this->capabilities) !== count(array_unique($this->capabilities))) {
            throw new \InvalidArgumentException('Block capabilities must be unique.');
        }
        foreach ($this->capabilities as $capability) {
            BlockPackRules::assertIdentifier($capability, 'capability');
        }
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(string $packId, string $packVersion, array $data): self
    {
        return new self(
            packId: $packId,
            packVersion: $packVersion,
            blockId: self::string($data, 'block_id'),
            blockVersion: self::integer($data, 'block_version'),
            category: self::string($data, 'category'),
            label: self::localizedText($data, 'label'),
            description: self::localizedText($data, 'description'),
            thumbnail: self::string($data, 'thumbnail'),
            schemaRef: self::string($data, 'schema_ref'),
            editorComponent: self::string($data, 'editor_component'),
            compiler: self::string($data, 'compiler'),
            capabilities: self::stringList($data, 'capabilities'),
        );
    }

    public function identity(): string
    {
        return $this->blockId.'@'.$this->blockVersion;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'block_id' => $this->blockId,
            'block_version' => $this->blockVersion,
            'category' => $this->category,
            'label' => $this->label,
            'description' => $this->description,
            'thumbnail' => $this->thumbnail,
            'schema_ref' => $this->schemaRef,
            'editor_component' => $this->editorComponent,
            'compiler' => $this->compiler,
            'capabilities' => $this->capabilities,
        ];
    }

    /** @param array<string, mixed> $data */
    private static function string(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (! is_string($value) || $value === '') {
            throw new \InvalidArgumentException("Block definition {$key} is required.");
        }

        return $value;
    }

    /** @param array<string, mixed> $data */
    private static function integer(array $data, string $key): int
    {
        $value = $data[$key] ?? null;
        if (! is_int($value)) {
            throw new \InvalidArgumentException("Block definition {$key} must be an integer.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, string>
     */
    private static function localizedText(array $data, string $key): array
    {
        $value = $data[$key] ?? null;
        if (! is_array($value)) {
            throw new \InvalidArgumentException("Block definition {$key} must be an object.");
        }

        $normalized = [];
        foreach ($value as $locale => $text) {
            if (! is_string($locale) || ! is_string($text)) {
                throw new \InvalidArgumentException("Block definition {$key} is invalid.");
            }
            $normalized[$locale] = $text;
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<string>
     */
    private static function stringList(array $data, string $key): array
    {
        $value = $data[$key] ?? null;
        if (! is_array($value)) {
            throw new \InvalidArgumentException("Block definition {$key} must be a list.");
        }

        $normalized = [];
        foreach ($value as $item) {
            if (! is_string($item)) {
                throw new \InvalidArgumentException("Block definition {$key} is invalid.");
            }
            $normalized[] = $item;
        }

        return $normalized;
    }
}
