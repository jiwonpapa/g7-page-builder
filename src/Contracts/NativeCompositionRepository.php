<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Compositions\NativeComposition;

interface NativeCompositionRepository
{
    /** @return list<NativeComposition> */
    public function pageFor(int $actorId, int $page): array;

    public function findFor(int $actorId, string $id): ?NativeComposition;

    public function create(NativeComposition $composition): NativeComposition;

    public function deleteFor(int $actorId, string $id): bool;
}
