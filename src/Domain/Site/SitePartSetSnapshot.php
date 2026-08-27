<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

final readonly class SitePartSetSnapshot
{
    public function __construct(
        public string $id,
        public string $title,
        public string $locale,
        public bool $isActive,
        public SitePartSnapshot $header,
        public SitePartSnapshot $footer,
        public ?\DateTimeImmutable $createdAt = null,
        public ?\DateTimeImmutable $updatedAt = null,
    ) {}

    public function isReady(): bool
    {
        return $this->header->activeRevision !== null
            && $this->footer->activeRevision !== null;
    }
}
