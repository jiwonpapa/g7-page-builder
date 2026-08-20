<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\Response;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRules;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final readonly class BlockPackAssetController
{
    public function __construct(private BlockPackRepository $packs) {}

    public function show(string $publisher, string $pack, string $version, string $path): BinaryFileResponse|Response
    {
        $packId = $publisher.'/'.$pack;
        try {
            BlockPackRules::assertPackId($packId);
            BlockPackRules::assertSemver($version, 'version');
            BlockPackRules::assertRelativePath($path, 'asset path');
        } catch (\InvalidArgumentException) {
            return response('Not Found', 404);
        }

        $installation = $this->packs->find($packId, $version);
        if ($installation === null
            || $installation->manifest->kind !== 'code'
            || ! in_array($installation->state, [BlockPackState::Enabled, BlockPackState::Disabled], true)
            || ! $this->isBrowserAsset($installation->manifest->runtime, $path)
            || ! isset($installation->manifest->files[$path])) {
            return response('Not Found', 404);
        }

        $root = realpath($installation->sourceReference);
        $target = realpath($installation->sourceReference.'/'.$path);
        if ($root === false || $target === false || ! str_starts_with($target, $root.'/')) {
            return response('Not Found', 404);
        }
        $digest = hash_file('sha256', $target);
        if (! is_string($digest) || ! hash_equals($installation->manifest->files[$path], $digest)) {
            return response('Not Found', 404);
        }

        return response()->file($target, [
            'Content-Type' => $this->contentType($path),
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** @param array{provider: string, editor: string, styles: list<string>}|null $runtime */
    private function isBrowserAsset(?array $runtime, string $path): bool
    {
        return $runtime !== null && ($path === $runtime['editor'] || in_array($path, $runtime['styles'], true));
    }

    private function contentType(string $path): string
    {
        return str_ends_with(strtolower($path), '.css')
            ? 'text/css; charset=utf-8'
            : 'text/javascript; charset=utf-8';
    }
}
