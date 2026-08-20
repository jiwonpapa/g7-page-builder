<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockFavoritePort;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\BlockFavoriteRecord;

final class EloquentBlockFavoriteAdapter implements BlockFavoritePort
{
    public function blockIdsFor(int $actorId): array
    {
        $values = BlockFavoriteRecord::query()
            ->where('actor_id', $actorId)
            ->orderBy('catalog_id')
            ->pluck('catalog_id')
            ->all();
        $ids = [];
        foreach ($values as $value) {
            if (is_string($value)) {
                $ids[] = $value;
            }
        }

        return $ids;
    }

    public function setFavorite(int $actorId, string $blockId, bool $favorite): void
    {
        if ($favorite) {
            BlockFavoriteRecord::query()->firstOrCreate(
                ['actor_id' => $actorId, 'catalog_id' => $blockId],
                ['created_at' => new \DateTimeImmutable],
            );

            return;
        }

        BlockFavoriteRecord::query()
            ->where('actor_id', $actorId)
            ->where('catalog_id', $blockId)
            ->delete();
    }
}
