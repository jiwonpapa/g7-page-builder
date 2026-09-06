<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Domain\Store;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Routing\PagePath;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;

/** A portable set of canonical sources; no published HTML or vendor state. */
final readonly class SiteKitBundle
{
    /** @var list<array{key: string, title: string, path: string}> */
    private array $pageSummaries;

    /** @param array<string, mixed> $manifest
     * @param  list<PageKitMedia>  $media
     */
    public function __construct(public array $manifest, public array $media = [])
    {
        if (($manifest['schema_version'] ?? null) !== 'g7pb-site-kit/v1') {
            throw new \InvalidArgumentException('사이트 킷 형식이 지원되지 않습니다.');
        }
        foreach (['kit_id', 'kit_version', 'title', 'description', 'locale'] as $key) {
            if (! is_string($manifest[$key] ?? null) || trim($manifest[$key]) === '') {
                throw new \InvalidArgumentException('사이트 킷 필수 정보가 없습니다: '.$key);
            }
        }
        StoreRules::assertProductId($manifest['kit_id']);
        StoreRules::assertSemver($manifest['kit_version'], '사이트 킷 버전');
        $compatibility = $manifest['compatibility'] ?? null;
        if (! is_array($compatibility)) {
            throw new \InvalidArgumentException('사이트 킷 호환 조건이 없습니다.');
        }
        foreach (['page_builder', 'g7', 'php'] as $key) {
            if (! is_string($compatibility[$key] ?? null) || $compatibility[$key] === '') {
                throw new \InvalidArgumentException('사이트 킷 호환 조건이 잘못됐습니다.');
            }
        }
        $pages = $manifest['pages'] ?? null;
        if (! is_array($pages) || ! array_is_list($pages) || count($pages) < 1 || count($pages) > 20) {
            throw new \InvalidArgumentException('사이트 킷은 1~20개 페이지를 포함해야 합니다.');
        }
        $keys = [];
        $summaries = [];
        foreach ($pages as $page) {
            if (! is_array($page) || ! is_string($page['key'] ?? null)
                || preg_match('/^[a-z][a-z0-9-]{0,39}$/D', $page['key']) !== 1
                || isset($keys[$page['key']]) || ! is_string($page['title'] ?? null) || trim($page['title']) === ''
                || ! is_string($page['path'] ?? null) || ! is_array($page['document'] ?? null)) {
                throw new \InvalidArgumentException('사이트 킷 페이지 정보가 잘못되거나 중복됐습니다.');
            }
            $keys[$page['key']] = PagePath::normalize($page['path']);
            $summaries[] = ['key' => $page['key'], 'title' => $page['title'], 'path' => $page['path']];
        }
        $this->pageSummaries = $summaries;
        if (count(array_unique($keys)) !== count($keys)) {
            throw new \InvalidArgumentException('사이트 킷 기본 주소가 중복됐습니다.');
        }
        $mediaUrls = [];
        foreach ($media as $item) {
            if (isset($mediaUrls[$item->id])) {
                throw new \InvalidArgumentException('사이트 킷 미디어가 중복됐습니다.');
            }
            $mediaUrls[$item->id] = '/site-kit-preview/'.$item->originalName;
        }
        $resolved = $this->resolve($keys, $mediaUrls);
        foreach ($resolved['pages'] as $page) {
            $document = PageBuilderDocument::fromArray($page['document']);
            if ($document->locale !== $manifest['locale'] || $document->shellMode !== 'template') {
                throw new \InvalidArgumentException('사이트 킷 페이지의 언어 또는 출력 방식이 일치하지 않습니다.');
            }
        }
        foreach (['header', 'footer'] as $kind) {
            if (! is_array($resolved[$kind] ?? null)) {
                throw new \InvalidArgumentException('사이트 킷 헤더·푸터가 없습니다.');
            }
            $part = SitePartDocument::fromArray($resolved[$kind]);
            if ($part->kind !== $kind || $part->locale !== $manifest['locale'] || $part->blocks === []) {
                throw new \InvalidArgumentException('사이트 킷 헤더·푸터 구성이 잘못됐습니다.');
            }
        }
    }

    /** @return list<array{key: string, title: string, path: string}> */
    public function pages(): array
    {
        return $this->pageSummaries;
    }

    /** @param array<string, string> $paths
     * @param  array<string, string>  $mediaUrls
     * @return array<string, mixed>
     */
    public function resolve(array $paths, array $mediaUrls): array
    {
        return $this->map($this->manifest, $paths, $mediaUrls);
    }

    /** @param array<string, mixed> $data
     * @param  array<string, string>  $paths
     * @param  array<string, string>  $mediaUrls
     * @return array<string, mixed>
     */
    private function map(array $data, array $paths, array $mediaUrls): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = $this->map($value, $paths, $mediaUrls);
            } elseif (is_string($value)) {
                foreach (['g7pb-page://' => $paths, 'g7pb-media://' => $mediaUrls] as $prefix => $targets) {
                    if (str_starts_with($value, $prefix)) {
                        $data[$key] = $targets[substr($value, strlen($prefix))]
                            ?? throw new \InvalidArgumentException('사이트 킷 내부 연결 대상을 찾을 수 없습니다: '.$value);
                    }
                }
            }
        }

        return $data;
    }
}
