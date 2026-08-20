<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;

interface BlockPackSignatureVerifierPort
{
    public function verify(BlockPackManifest $manifest, string $manifestJson, string $detachedSignature): void;
}
