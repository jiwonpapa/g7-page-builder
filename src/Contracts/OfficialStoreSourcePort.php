<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Store\OfficialStoreProduct;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreArtifact;

interface OfficialStoreSourcePort
{
    /** @return array<string, mixed> */
    public function catalog(): array;

    public function download(OfficialStoreProduct $product): StoreArtifact;

    public function release(StoreArtifact $artifact): void;
}
