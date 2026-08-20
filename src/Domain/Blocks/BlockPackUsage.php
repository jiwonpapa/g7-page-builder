<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class BlockPackUsage
{
    public function __construct(
        public int $documents,
        public int $revisions,
    ) {
        if ($this->documents < 0 || $this->revisions < 0) {
            throw new \InvalidArgumentException('Block Pack usage counts cannot be negative.');
        }
    }

    public function isInUse(): bool
    {
        return $this->documents > 0 || $this->revisions > 0;
    }
}
