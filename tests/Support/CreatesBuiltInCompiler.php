<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Support;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;

trait CreatesBuiltInCompiler
{
    private function builtInCompiler(): HtmlDocumentCompiler
    {
        $registry = new BlockRegistry;
        $registry->register(
            (new BuiltInBlockPackLoader)->load(dirname(__DIR__, 2)),
            enabled: true,
        );

        return new HtmlDocumentCompiler($registry);
    }
}
