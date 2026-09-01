<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Patterns\SectionPattern;

interface SectionPatternRepository
{
    /** @return list<SectionPattern> */
    public function allFor(int $actorId): array;

    public function findFor(string $patternId, int $actorId): ?SectionPattern;

    public function create(SectionPattern $pattern): SectionPattern;

    public function deleteFor(string $patternId, int $actorId): bool;
}
