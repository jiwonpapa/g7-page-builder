<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackUsage;

interface BlockUsagePort
{
    public function summarize(BlockPackManifest $manifest): BlockPackUsage;

    /** @param list<string> $blockIdentities Canonical block_id@block_version identities. */
    public function summarizeBlockIdentities(array $blockIdentities): BlockPackUsage;
}
