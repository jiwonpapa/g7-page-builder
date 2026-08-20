<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

final readonly class SitePartRevision
{
    public function __construct(
        public SitePartDocument $document,
        public string $title,
        public int $revision,
        public ?int $authorId,
        public \DateTimeImmutable $createdAt,
    ) {}
}
