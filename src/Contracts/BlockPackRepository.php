<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;

interface BlockPackRepository
{
    /** @return list<BlockPackInstallation> */
    public function all(): array;

    public function find(string $packId, string $packVersion): ?BlockPackInstallation;

    public function enabled(string $packId): ?BlockPackInstallation;

    public function save(BlockPackInstallation $installation): void;

    public function delete(string $packId, string $packVersion): void;
}
