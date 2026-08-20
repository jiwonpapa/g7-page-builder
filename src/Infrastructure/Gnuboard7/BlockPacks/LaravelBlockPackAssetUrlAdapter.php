<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\BlockPacks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;

final readonly class LaravelBlockPackAssetUrlAdapter implements BlockPackAssetUrlPort
{
    public function __construct(private BlockPackRepository $packs) {}

    public function styleUrls(string $packId, string $packVersion): array
    {
        $installation = $this->packs->find($packId, $packVersion);
        if ($installation === null || $installation->manifest->runtime === null) {
            return [];
        }
        $styles = $installation->manifest->runtime['styles'];
        [$publisher, $pack] = explode('/', $packId, 2);

        return array_map(function (string $path) use ($publisher, $pack, $packVersion): string {
            $encodedPath = implode('/', array_map('rawurlencode', explode('/', $path)));

            return url('/modules/jiwonpapa-page_builder/block-packs/'
                .rawurlencode($publisher).'/'.rawurlencode($pack).'/'.rawurlencode($packVersion).'/'.$encodedPath);
        }, $styles);
    }
}
