<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;

interface BlockPackProvider
{
    public function manifest(): BlockPackManifest;

    /** @return iterable<BlockTypeCompilerPort> */
    public function compilers(): iterable;

    /** @return iterable<BlockSchemaValidatorPort> */
    public function schemaValidators(): iterable;
}
