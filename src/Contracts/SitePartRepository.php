<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;

interface SitePartRepository
{
    public function create(string $title, SitePartDocument $document, ?int $actorId): SitePartSnapshot;

    public function find(string $kind, string $locale): ?SitePartSnapshot;

    public function findPublished(string $kind, string $locale): ?SitePartSnapshot;

    /** @return list<SitePartRevision> */
    public function listRevisions(string $sitePartId, int $limit): array;

    public function saveDraft(
        string $title,
        SitePartDocument $document,
        int $expectedLockVersion,
        ?int $actorId,
    ): SitePartSnapshot;

    public function publish(string $sitePartId, int $expectedLockVersion, ?int $actorId): SitePartSnapshot;
}
