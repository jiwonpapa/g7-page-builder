<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

/** Common ownership metadata; each version keeps its own canonical content. */
interface SitePartSource
{
    public string $sitePartId { get; }

    public string $kind { get; }

    public string $locale { get; }

    public string $schemaVersion { get; }

    /** @return array<string, mixed> */
    public function toArray(): array;
}
