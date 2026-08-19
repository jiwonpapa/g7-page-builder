<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Persistence;

final class LockConflictException extends \RuntimeException
{
    public function __construct(public readonly int $currentLockVersion)
    {
        parent::__construct('The page draft was changed by another request.');
    }
}
