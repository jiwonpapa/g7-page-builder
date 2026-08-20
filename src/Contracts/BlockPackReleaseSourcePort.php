<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRelease;

interface BlockPackReleaseSourcePort
{
    /** @return list<BlockPackRelease> */
    public function releases(string $owner, string $repository, string $assetName): array;

    /** @return non-empty-string Temporary file path owned by the caller. */
    public function download(BlockPackRelease $release): string;
}
