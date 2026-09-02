<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PublishedSitePartSet;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSetSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;

interface SitePartRepository
{
    public function createSet(
        string $title,
        SitePartDocument $header,
        SitePartDocument $footer,
        ?int $actorId,
    ): SitePartSetSnapshot;

    /** @return list<SitePartSetSnapshot> */
    public function listSets(string $locale): array;

    public function activateSet(string $setId, string $locale, ?int $actorId): SitePartSetSnapshot;

    public function saveSetDraft(
        string $setId,
        string $headerTitle,
        SitePartDocument $header,
        int $headerExpectedLockVersion,
        string $footerTitle,
        SitePartDocument $footer,
        int $footerExpectedLockVersion,
        ?int $actorId,
    ): SitePartSetSnapshot;

    public function publishSet(
        string $setId,
        int $headerExpectedLockVersion,
        int $footerExpectedLockVersion,
        ?int $actorId,
        SitePartArtifact $headerArtifact,
        SitePartArtifact $footerArtifact,
    ): SitePartSetSnapshot;

    public function find(string $kind, string $locale, ?string $setId = null): ?SitePartSnapshot;

    public function findPublished(string $kind, string $locale): ?SitePartSnapshot;

    public function findPublishedSet(string $locale): ?PublishedSitePartSet;

    /** @return list<SitePartRevision> */
    public function listRevisions(string $sitePartId, int $limit): array;

    public function saveDraft(
        string $title,
        SitePartDocument $document,
        int $expectedLockVersion,
        ?int $actorId,
    ): SitePartSnapshot;

    public function publish(string $sitePartId, int $expectedLockVersion, ?int $actorId, SitePartArtifact $artifact): SitePartSnapshot;
}
