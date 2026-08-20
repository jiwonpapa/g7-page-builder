<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockFavoritePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockCatalogItem;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockDefinition;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPreset;

final readonly class BlockCatalogService
{
    public function __construct(
        private BlockRegistry $registry,
        private BlockFavoritePort $favorites,
    ) {}

    /**
     * @return list<BlockCatalogItem>
     */
    public function list(
        int $actorId,
        string $locale = 'ko',
        string $query = '',
        ?string $category = null,
        bool $favoritesOnly = false,
    ): array {
        $locale = in_array($locale, ['ko', 'en'], true) ? $locale : 'ko';
        $query = mb_strtolower(trim($query));
        $favoriteIds = array_fill_keys($this->favorites->blockIdsFor($actorId), true);
        $definitions = $this->registry->definitions();
        $items = [];

        foreach ($definitions as $definition) {
            $catalogId = self::definitionCatalogId($definition);
            $item = new BlockCatalogItem(
                catalogId: $catalogId,
                kind: 'definition',
                packId: $definition->packId,
                packVersion: $definition->packVersion,
                blockId: $definition->blockId,
                blockVersion: $definition->blockVersion,
                editorComponent: $definition->editorComponent,
                category: $definition->category,
                label: $definition->label,
                description: $definition->description,
                thumbnail: $definition->thumbnail,
                favorite: isset($favoriteIds[$catalogId]),
            );
            if ($this->matches($item, $locale, $query, $category, $favoritesOnly)) {
                $items[] = $item;
            }
        }

        foreach ($this->registry->presets() as $preset) {
            $definition = $definitions[$preset->blockIdentity()];
            $catalogId = self::presetCatalogId($preset);
            $item = new BlockCatalogItem(
                catalogId: $catalogId,
                kind: 'preset',
                packId: $preset->packId,
                packVersion: $preset->packVersion,
                blockId: $preset->blockId,
                blockVersion: $preset->blockVersion,
                editorComponent: $definition->editorComponent,
                category: $preset->category,
                label: $preset->label,
                description: $preset->description,
                thumbnail: $preset->thumbnail,
                favorite: isset($favoriteIds[$catalogId]),
                presetProps: $preset->props,
            );
            if ($this->matches($item, $locale, $query, $category, $favoritesOnly)) {
                $items[] = $item;
            }
        }

        usort($items, static function (BlockCatalogItem $left, BlockCatalogItem $right) use ($locale): int {
            return [! $left->favorite, $left->category, $left->label[$locale] ?? $left->label['ko'], $left->catalogId]
                <=> [! $right->favorite, $right->category, $right->label[$locale] ?? $right->label['ko'], $right->catalogId];
        });

        return $items;
    }

    public function setFavorite(int $actorId, string $catalogId, bool $favorite): void
    {
        $available = false;
        foreach ($this->list($actorId) as $item) {
            if ($item->catalogId === $catalogId) {
                $available = true;
                break;
            }
        }
        if (! $available) {
            throw new \DomainException('즐겨찾기할 수 있는 블록을 찾지 못했습니다.');
        }

        $this->favorites->setFavorite($actorId, $catalogId, $favorite);
    }

    public static function definitionCatalogId(BlockDefinition $definition): string
    {
        return 'block:'.$definition->blockId.'@'.$definition->blockVersion;
    }

    public static function presetCatalogId(BlockPreset $preset): string
    {
        return 'preset:'.$preset->packId.':'.$preset->presetId;
    }

    private function matches(
        BlockCatalogItem $item,
        string $locale,
        string $query,
        ?string $category,
        bool $favoritesOnly,
    ): bool {
        if ($favoritesOnly && ! $item->favorite) {
            return false;
        }
        if ($category !== null && $category !== '' && $item->category !== $category) {
            return false;
        }
        if ($query === '') {
            return true;
        }

        $haystack = implode(' ', [
            $item->catalogId,
            $item->blockId,
            $item->label[$locale] ?? $item->label['ko'],
            $item->label['ko'],
            $item->description[$locale] ?? $item->description['ko'],
            $item->description['ko'],
        ]);

        return str_contains(mb_strtolower($haystack), $query);
    }
}
