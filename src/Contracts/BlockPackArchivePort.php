<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\StoredBlockPack;

interface BlockPackArchivePort
{
    public function store(string $archivePath, ?string $expectedSha256 = null): StoredBlockPack;

    public function delete(BlockPackInstallation $installation): void;
}
