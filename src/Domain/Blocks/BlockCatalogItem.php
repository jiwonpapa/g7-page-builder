<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class BlockCatalogItem
{
    /**
     * @param  array<string, string>  $label
     * @param  array<string, string>  $description
     * @param  array<string, mixed>|null  $presetProps
     */
    public function __construct(
        public string $catalogId,
        public string $kind,
        public string $packId,
        public string $packVersion,
        public string $blockId,
        public int $blockVersion,
        public string $editorComponent,
        public string $category,
        public array $label,
        public array $description,
        public string $thumbnail,
        public bool $favorite,
        public ?array $presetProps = null,
    ) {
        if (! in_array($this->kind, ['definition', 'preset'], true)) {
            throw new \InvalidArgumentException('Block catalog item kind is invalid.');
        }
        if (preg_match('/^(?:block|preset):[a-z0-9][a-z0-9._:\/@-]{2,255}$/', $this->catalogId) !== 1) {
            throw new \InvalidArgumentException('Block catalog item id is invalid.');
        }
        if ($this->kind === 'preset' && $this->presetProps === null) {
            throw new \InvalidArgumentException('Block preset catalog items require props.');
        }
        if ($this->kind === 'definition' && $this->presetProps !== null) {
            throw new \InvalidArgumentException('Block definition catalog items cannot contain preset props.');
        }
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'catalog_id' => $this->catalogId,
            'kind' => $this->kind,
            'pack_id' => $this->packId,
            'pack_version' => $this->packVersion,
            'block_id' => $this->blockId,
            'block_version' => $this->blockVersion,
            'editor_component' => $this->editorComponent,
            'category' => $this->category,
            'label' => $this->label,
            'description' => $this->description,
            'thumbnail' => $this->thumbnail,
            'favorite' => $this->favorite,
            'insertable' => true,
            'preset_props' => $this->presetProps,
        ];
    }
}
