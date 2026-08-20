<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class BlockPreset
{
    /**
     * @param  array<string, string>  $label
     * @param  array<string, string>  $description
     * @param  array<string, mixed>  $props
     */
    public function __construct(
        public string $packId,
        public string $packVersion,
        public string $presetId,
        public string $blockId,
        public int $blockVersion,
        public string $category,
        public array $label,
        public array $description,
        public string $thumbnail,
        public array $props,
    ) {
        BlockPackRules::assertPackId($this->packId);
        BlockPackRules::assertSemver($this->packVersion, 'version');
        BlockPackRules::assertIdentifier($this->presetId, 'preset_id');
        BlockPackRules::assertIdentifier($this->blockId, 'preset block_id');
        BlockPackRules::assertIdentifier($this->category, 'preset category');
        BlockPackRules::assertLocalizedText($this->label, 'preset label');
        BlockPackRules::assertLocalizedText($this->description, 'preset description');
        BlockPackRules::assertRelativePath($this->thumbnail, 'preset thumbnail');
        BlockPackRules::assertJsonObject($this->props, 'preset props');

        if ($this->blockVersion < 1) {
            throw new \InvalidArgumentException('Preset block version must be positive.');
        }
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(string $packId, string $packVersion, array $data): self
    {
        $label = self::localizedText($data, 'label');
        $description = self::localizedText($data, 'description');
        $props = $data['props'] ?? null;

        if (! is_array($props)) {
            throw new \InvalidArgumentException('Block preset props must be an object.');
        }

        return new self(
            packId: $packId,
            packVersion: $packVersion,
            presetId: self::string($data, 'preset_id'),
            blockId: self::string($data, 'block_id'),
            blockVersion: self::integer($data, 'block_version'),
            category: self::string($data, 'category'),
            label: $label,
            description: $description,
            thumbnail: self::string($data, 'thumbnail'),
            props: $props,
        );
    }

    public function identity(): string
    {
        return $this->packId.':'.$this->presetId;
    }

    public function blockIdentity(): string
    {
        return $this->blockId.'@'.$this->blockVersion;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'preset_id' => $this->presetId,
            'block_id' => $this->blockId,
            'block_version' => $this->blockVersion,
            'category' => $this->category,
            'label' => $this->label,
            'description' => $this->description,
            'thumbnail' => $this->thumbnail,
            'props' => $this->props,
        ];
    }

    /** @param array<string, mixed> $data */
    private static function string(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (! is_string($value) || $value === '') {
            throw new \InvalidArgumentException("Block preset {$key} is required.");
        }

        return $value;
    }

    /** @param array<string, mixed> $data */
    private static function integer(array $data, string $key): int
    {
        $value = $data[$key] ?? null;
        if (! is_int($value)) {
            throw new \InvalidArgumentException("Block preset {$key} must be an integer.");
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
            throw new \InvalidArgumentException("Block preset {$key} must be an object.");
        }

        $normalized = [];
        foreach ($value as $locale => $text) {
            if (! is_string($locale) || ! is_string($text)) {
                throw new \InvalidArgumentException("Block preset {$key} is invalid.");
            }
            $normalized[$locale] = $text;
        }

        return $normalized;
    }
}
