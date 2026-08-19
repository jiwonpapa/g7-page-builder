<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

final readonly class DocumentRevision
{
    public function __construct(
        public PageBuilderDocument $document,
        public string $title,
        public int $revision,
        public string $schemaVersion,
        public ?int $authorId,
        public \DateTimeImmutable $createdAt,
    ) {}
}
