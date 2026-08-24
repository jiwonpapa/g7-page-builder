<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\Response;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRules;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;
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

        $manifest = null;
        $sourceReference = null;
        if ($packId === 'jiwonpapa/builtin-core') {
            $moduleRoot = dirname(__DIR__, 5);
            $manifest = (new BuiltInBlockPackLoader)->load($moduleRoot);
            if ($manifest->packVersion === $version) {
                $sourceReference = $moduleRoot.'/resources/block-packs/builtin-core';
            }
        } else {
            $installation = $this->packs->find($packId, $version);
            if ($installation !== null
                && in_array($installation->state, [BlockPackState::Enabled, BlockPackState::Disabled], true)) {
                $manifest = $installation->manifest;
                $sourceReference = $installation->sourceReference;
            }
        }

        if (! $manifest instanceof BlockPackManifest
            || ! is_string($sourceReference)
            || ! $this->isBrowserAsset($manifest, $path)
            || ! isset($manifest->files[$path])) {
            return response('Not Found', 404);
        }

        $root = realpath($sourceReference);
        $target = realpath($sourceReference.'/'.$path);
        if ($root === false || $target === false || ! str_starts_with($target, $root.'/')) {
            return response('Not Found', 404);
        }
        $digest = hash_file('sha256', $target);
        if (! is_string($digest) || ! hash_equals($manifest->files[$path], $digest)) {
            return response('Not Found', 404);
        }

        $headers = [
            'Content-Type' => $this->contentType($path),
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ];
        if (str_ends_with(strtolower($path), '.svg')) {
            $headers['Content-Security-Policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
        }

        return response()->file($target, $headers);
    }

    private function isBrowserAsset(BlockPackManifest $manifest, string $path): bool
    {
        if ($manifest->runtime !== null
            && ($path === $manifest->runtime['editor'] || in_array($path, $manifest->runtime['styles'], true))) {
            return true;
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (! in_array($extension, ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'], true)) {
            return false;
        }
        foreach ([...$manifest->blocks, ...$manifest->presets] as $item) {
            if ($item->thumbnail === $path) {
                return true;
            }
        }

        return false;
    }

    private function contentType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'css' => 'text/css; charset=utf-8',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'avif' => 'image/avif',
            'svg' => 'image/svg+xml',
            default => 'text/javascript; charset=utf-8',
        };
    }
}
