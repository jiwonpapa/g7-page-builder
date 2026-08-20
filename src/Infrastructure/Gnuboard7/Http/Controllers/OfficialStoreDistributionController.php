<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class OfficialStoreDistributionController
{
    public function catalog(Request $request): Response
    {
        $path = $this->root().'/catalog.json';
        if (! is_file($path)) {
            abort(404);
        }
        $contents = file_get_contents($path);
        if (! is_string($contents)) {
            abort(404);
        }

        $payload = json_decode($contents, true, 128, JSON_THROW_ON_ERROR);
        if (! is_array($payload) || ! is_array($payload['products'] ?? null)) {
            abort(500, 'Official Store catalog is invalid.');
        }
        $origin = rtrim($request->getSchemeAndHttpHost(), '/');
        foreach ($payload['products'] as &$product) {
            if (! is_array($product)) {
                continue;
            }
            if (is_array($product['artifact'] ?? null) && is_string($product['artifact']['url'] ?? null)) {
                $product['artifact']['url'] = $this->rebaseStoreUrl($product['artifact']['url'], $origin);
            }
            if (! is_array($product['preview'] ?? null)) {
                continue;
            }
            foreach (['thumbnail_url', 'demo_url'] as $key) {
                if (is_string($product['preview'][$key] ?? null)) {
                    $product['preview'][$key] = $this->rebaseStoreUrl($product['preview'][$key], $origin);
                }
            }
            if (is_array($product['preview']['screenshots'] ?? null)) {
                $product['preview']['screenshots'] = array_map(
                    fn (mixed $url): mixed => is_string($url) ? $this->rebaseStoreUrl($url, $origin) : $url,
                    $product['preview']['screenshots'],
                );
            }
        }
        unset($product);
        $responseBody = json_encode(
            $payload,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );

        return response($responseBody, 200, [
            'Content-Type' => 'application/json; charset=utf-8',
            'Cache-Control' => 'public, max-age=300, must-revalidate',
            'ETag' => '"'.hash('sha256', $responseBody).'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function artifact(string $file): BinaryFileResponse
    {
        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$/', $file) !== 1) {
            abort(404);
        }
        $path = $this->root().'/artifacts/'.$file;
        if (! is_file($path)) {
            abort(404);
        }

        return response()->file($path, [
            'Content-Type' => 'application/zip',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function preview(string $file): BinaryFileResponse
    {
        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.(?:svg|webp|png)$/', $file) !== 1) {
            abort(404);
        }
        $path = $this->root().'/previews/'.$file;
        if (! is_file($path)) {
            abort(404);
        }

        return response()->file($path, [
            'Cache-Control' => 'public, max-age=86400, must-revalidate',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        ]);
    }

    private function root(): string
    {
        return dirname(__DIR__, 5).'/resources/store/dist';
    }

    private function rebaseStoreUrl(string $url, string $origin): string
    {
        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path)
            || ! str_starts_with($path, '/modules/jiwonpapa-page_builder/store/')) {
            return $url;
        }

        return $origin.$path;
    }
}
