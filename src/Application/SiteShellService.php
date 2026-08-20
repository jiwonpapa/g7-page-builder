<?php

namespace Modules\Jiwonpapa\PageBuilder\Application;

use Modules\Jiwonpapa\PageBuilder\Contracts\SiteShellPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShellSnapshot;

final class SiteShellService
{
    public function __construct(private readonly SiteShellPort $port) {}

    public function get(string $locale): SiteShellSnapshot
    {
        return $this->port->get($locale);
    }

    /** @param array<string, mixed> $payload */
    public function save(string $locale, array $payload, int $expectedLockVersion, ?int $actorId): SiteShellSnapshot
    {
        return $this->port->save(SiteShell::fromArray($locale, $payload), $expectedLockVersion, $actorId);
    }
}
