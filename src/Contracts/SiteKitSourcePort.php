<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Store\SiteKitBundle;

interface SiteKitSourcePort
{
    /** @return list<string> */
    public function ids(): array;

    public function load(string $id): SiteKitBundle;
}
