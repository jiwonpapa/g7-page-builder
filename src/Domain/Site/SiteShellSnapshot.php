<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

final readonly class SiteShellSnapshot
{
    public function __construct(
        public SiteShell $shell,
        public int $lockVersion,
        public ?\DateTimeImmutable $updatedAt = null,
    ) {}
}
