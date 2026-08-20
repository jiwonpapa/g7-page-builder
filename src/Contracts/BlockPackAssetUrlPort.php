<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

interface BlockPackAssetUrlPort
{
    /** @return list<string> */
    public function styleUrls(string $packId, string $packVersion): array;
}
