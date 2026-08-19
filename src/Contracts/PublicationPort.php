<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;

interface PublicationPort
{
    public function prepare(CompileResult $result, int $expectedLockVersion): string;

    public function commit(string $publicationToken): int;

    public function rejectExpiredCandidates(): int;
}
