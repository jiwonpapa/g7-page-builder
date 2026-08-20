<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

final readonly class SitePartSnapshot
{
    public function __construct(
        public SitePartDocument $document,
        public string $title,
        public int $lockVersion,
        public int $revision,
        public ?int $activeRevision = null,
        public ?\DateTimeImmutable $createdAt = null,
        public ?\DateTimeImmutable $updatedAt = null,
        public ?\DateTimeImmutable $publishedAt = null,
    ) {}

    public function hasUnpublishedChanges(): bool
    {
        return $this->activeRevision === null || $this->activeRevision !== $this->revision;
    }
}
