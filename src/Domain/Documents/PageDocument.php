<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

/** Read-only metadata shared by versioned canonical documents, not a second format. */
interface PageDocument
{
    public string $documentId { get; }

    public string $slug { get; }

    public string $locale { get; }

    public string $shellMode { get; }

    public string $schemaVersion { get; }

    public ?PageSeoMetadata $seo { get; }

    /** @return array<string, mixed> */
    public function toArray(): array;

    public function rootCount(): int;
}
