<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class StoredBlockPack
{
    public function __construct(
        public BlockPackManifest $manifest,
        public string $archiveSha256,
        public string $storageReference,
    ) {
        BlockPackRules::assertSha256($this->archiveSha256, 'archive digest');
        if ($this->storageReference === '' || strlen($this->storageReference) > 512) {
            throw new \InvalidArgumentException('Stored Block Pack reference is invalid.');
        }
    }
}
