<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Store;

use Modules\Jiwonpapa\PageBuilder\Contracts\SiteKitSourcePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\PageKitMedia;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\SiteKitBundle;

final class BundledSiteKitSource implements SiteKitSourcePort
{
    public function __construct(private readonly ?string $sourceRoot = null) {}

    public function ids(): array
    {
        $ids = ['company-starter'];
        try {
            $this->load('professional-services');
            $ids[] = 'professional-services';
        } catch (\InvalidArgumentException|\JsonException) {
            // A missing or incomplete optional download must not hide the free kit.
        }

        return $ids;
    }

    public function load(string $id): SiteKitBundle
    {
        if (! in_array($id, ['company-starter', 'professional-services'], true)) {
            throw new \InvalidArgumentException('사이트 킷을 찾을 수 없습니다.');
        }
        $root = $this->sourceRoot ?? dirname(__DIR__, 3);
        $manifestPath = $root.'/resources/site-kits/'.$id.'.json';
        if (! is_file($manifestPath) || is_link($manifestPath)) {
            throw new \InvalidArgumentException('사이트 킷 파일을 확인할 수 없습니다.');
        }
        $data = json_decode((string) file_get_contents($manifestPath), true, 64, JSON_THROW_ON_ERROR);
        if (! is_array($data) || ! is_array($data['media'] ?? null) || ! array_is_list($data['media'])) {
            throw new \InvalidArgumentException('사이트 킷 미디어 목록이 잘못됐습니다.');
        }
        $media = [];
        foreach ($data['media'] as $item) {
            if (! is_array($item) || ! is_string($item['path'] ?? null) || ! is_string($item['id'] ?? null)
                || ! is_string($item['sha256'] ?? null) || str_contains($item['path'], '..')) {
                throw new \InvalidArgumentException('사이트 킷 미디어 경로가 잘못됐습니다.');
            }
            $path = realpath($root.'/'.$item['path']);
            if ($path === false || ! str_starts_with($path, $root.'/resources/') || ! is_file($path)
                || filesize($path) > 8 * 1024 * 1024 || hash_file('sha256', $path) !== $item['sha256']) {
                throw new \InvalidArgumentException('사이트 킷 미디어 무결성을 확인할 수 없습니다.');
            }
            $size = getimagesize($path);
            if ($size === false || ! in_array($size['mime'], ['image/webp', 'image/png', 'image/jpeg'], true)) {
                throw new \InvalidArgumentException('사이트 킷 이미지 형식이 지원되지 않습니다.');
            }
            $media[] = new PageKitMedia($item['id'], 'media/'.basename($path), $item['sha256'], basename($path),
                $size['mime'], $size[0], $size[1], (string) file_get_contents($path));
        }

        return new SiteKitBundle($data, $media);
    }
}
