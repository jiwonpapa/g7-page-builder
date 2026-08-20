<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

interface BlockFavoritePort
{
    /** @return list<string> */
    public function blockIdsFor(int $actorId): array;

    public function setFavorite(int $actorId, string $blockId, bool $favorite): void;
}
