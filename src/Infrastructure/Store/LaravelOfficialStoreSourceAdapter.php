<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Store;

use Illuminate\Support\Facades\Http;
use Modules\Jiwonpapa\PageBuilder\Contracts\OfficialStoreSourcePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\OfficialStoreProduct;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreArtifact;

final class LaravelOfficialStoreSourceAdapter implements OfficialStoreSourcePort
{
    public function catalog(): array
    {
        $url = (string) config('g7-page-builder.official-store.catalog_url');
        $this->assertAllowedUrl($url);
        $response = Http::acceptJson()
            ->connectTimeout($this->connectTimeout())
            ->timeout($this->timeout())
            ->withOptions($this->transportOptions())
            ->get($url);
        if (! $response->successful()) {
            throw new \RuntimeException("공식 마켓 카탈로그 응답이 HTTP {$response->status()}입니다.");
        }
        $body = $response->body();
        if (strlen($body) > (int) config('g7-page-builder.official-store.catalog_max_bytes', 1_048_576)) {
            throw new \RuntimeException('공식 마켓 카탈로그 크기가 제한을 초과했습니다.');
        }
        $payload = json_decode($body, true, 128, JSON_THROW_ON_ERROR);
        if (! is_array($payload)) {
            throw new \RuntimeException('공식 마켓 카탈로그가 JSON object가 아닙니다.');
        }

        return $payload;
    }

    public function download(OfficialStoreProduct $product): StoreArtifact
    {
        $url = $product->artifact['url'];
        $this->assertAllowedUrl($url);
        $configuredMaximum = (int) config('g7-page-builder.official-store.artifact_max_bytes', 52_428_800);
        if ($product->artifact['bytes'] > $configuredMaximum) {
            throw new \DomainException('공식 마켓 상품 크기가 서버 제한을 초과했습니다.');
        }

        $path = tempnam(sys_get_temp_dir(), 'g7pb-store-');
        if (! is_string($path)) {
            throw new \RuntimeException('공식 마켓 임시 파일을 만들지 못했습니다.');
        }
        try {
            $handle = fopen($path, 'wb');
            if ($handle === false) {
                throw new \RuntimeException('공식 마켓 임시 파일을 열지 못했습니다.');
            }
            try {
                $response = Http::connectTimeout($this->connectTimeout())
                    ->timeout($this->timeout())
                    ->withOptions([...$this->transportOptions(), 'sink' => $handle])
                    ->get($url);
            } finally {
                fclose($handle);
            }
            if (! $response->successful()) {
                throw new \RuntimeException("공식 마켓 상품 응답이 HTTP {$response->status()}입니다.");
            }
            clearstatcache(true, $path);
            $bytes = filesize($path);
            if (! is_int($bytes) || $bytes !== $product->artifact['bytes'] || $bytes > $configuredMaximum) {
                throw new \DomainException('공식 마켓 상품 크기가 카탈로그와 일치하지 않습니다.');
            }
            $sha256 = hash_file('sha256', $path);
            if (! is_string($sha256) || ! hash_equals($product->artifact['sha256'], $sha256)) {
                throw new \DomainException('공식 마켓 상품 SHA-256이 카탈로그와 일치하지 않습니다.');
            }

            return new StoreArtifact($path, $url, $sha256, $bytes);
        } catch (\Throwable $exception) {
            @unlink($path);

            throw $exception;
        }
    }

    public function release(StoreArtifact $artifact): void
    {
        if ($artifact->temporary && is_file($artifact->path)) {
            @unlink($artifact->path);
        }
    }

    private function assertAllowedUrl(string $url): void
    {
        $parts = parse_url($url);
        $host = is_array($parts) && is_string($parts['host'] ?? null)
            ? strtolower($parts['host'])
            : '';
        $scheme = is_array($parts) ? ($parts['scheme'] ?? null) : null;
        $allowed = array_map('strtolower', (array) config('g7-page-builder.official-store.allowed_hosts', []));
        if ($scheme !== 'https' || $host === '' || ! in_array($host, $allowed, true)
            || isset($parts['user']) || isset($parts['pass'])) {
            throw new \DomainException('공식 마켓 URL이 허용된 HTTPS 배포 서버를 벗어났습니다.');
        }
    }

    private function connectTimeout(): int
    {
        return max(1, min(10, (int) config('g7-page-builder.official-store.connect_timeout_seconds', 5)));
    }

    /** @return array{allow_redirects: false, verify?: string} */
    private function transportOptions(): array
    {
        $options = ['allow_redirects' => false];
        $caBundle = config('g7-page-builder.official-store.ca_bundle');
        if ($caBundle === null || $caBundle === '') {
            return $options;
        }
        if (! is_string($caBundle) || ! is_file($caBundle) || ! is_readable($caBundle)) {
            throw new \RuntimeException('공식 마켓 CA 인증서 파일을 읽을 수 없습니다.');
        }
        $options['verify'] = $caBundle;

        return $options;
    }

    private function timeout(): int
    {
        return max(5, min(60, (int) config('g7-page-builder.official-store.timeout_seconds', 20)));
    }
}
