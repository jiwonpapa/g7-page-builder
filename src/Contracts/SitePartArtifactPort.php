<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PublishedSitePartSet;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;

interface SitePartArtifactPort
{
    /** The caller holds the document lock and publication transaction. */
    public function store(string $sitePartId, SitePartArtifact $artifact): void;

    public function findPublishedSet(string $locale): ?PublishedSitePartSet;

    /** Explicit upgrade only, never called by public rendering. */
    public function missingPublicationCount(): int;

    /** @return list<SitePartSnapshot> */
    public function missingPublications(int $limit): array;

    /** Preserve the source JSON, revision, active pointer and lock version. */
    public function prepareHistorical(SitePartSnapshot $source, SitePartArtifact $artifact): void;

    /** Fail when any published revision lacks a valid immutable artifact. */
    public function assertReady(): void;
}
