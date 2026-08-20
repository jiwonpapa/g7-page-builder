<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;

interface BlockPackProviderLoaderPort
{
    public function load(BlockPackInstallation $installation): BlockPackProvider;
}
