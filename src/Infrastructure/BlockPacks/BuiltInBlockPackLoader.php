<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;

final class BuiltInBlockPackLoader
{
    public function load(string $moduleRoot): BlockPackManifest
    {
        $path = rtrim($moduleRoot, '/').'/resources/block-packs/builtin-core/manifest.json';
        $contents = file_get_contents($path);

        if (! is_string($contents)) {
            throw new \RuntimeException('Builtin Block Pack manifest could not be read.');
        }

        return BlockPackManifest::fromJson($contents);
    }
}
