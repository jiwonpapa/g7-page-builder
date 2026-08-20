<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShellSnapshot;

interface SiteShellPort
{
    public function get(string $locale): SiteShellSnapshot;

    public function save(SiteShell $shell, int $expectedLockVersion, ?int $actorId): SiteShellSnapshot;
}
