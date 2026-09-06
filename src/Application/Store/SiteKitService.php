<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Store;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackCompatibility;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SiteKitInstallationPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SiteKitSourcePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Routing\PagePath;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\SiteKitBundle;

final readonly class SiteKitService
{
    public function __construct(
        private SiteKitSourcePort $source,
        private SiteKitInstallationPort $installations,
        private PageBuilderService $pages,
        private SitePartRepository $parts,
        private DocumentCompilerPort $compiler,
        private SitePartHtmlCompiler $partCompiler,
        private MediaPort $media,
        private string $pageBuilderVersion,
        private string $g7Version,
    ) {}

    /** @return array{items: list<array<string, mixed>>} */
    public function catalog(): array
    {
        $items = [];
        foreach ($this->source->ids() as $id) {
            $bundle = $this->source->load($id);
            $error = $this->compatibilityError($bundle);
            $items[] = ['id' => $id, 'version' => $bundle->manifest['kit_version'],
                'title' => $bundle->manifest['title'], 'description' => $bundle->manifest['description'],
                'locale' => $bundle->manifest['locale'], 'pages' => $bundle->pages(),
                'compatible' => $error === null, 'compatibility_error' => $error];
        }

        return ['items' => $items];
    }

    /** @param array<string, string> $paths
     * @return array<string, mixed>
     */
    public function preview(string $id, array $paths): array
    {
        $bundle = $this->source->load($id);
        $paths = $this->paths($bundle, $paths);
        $issues = $this->installations->conflicts($paths);
        $error = $this->compatibilityError($bundle);
        if ($error !== null) {
            $issues['compatibility'] = $error;
        }
        $urls = [];
        foreach ($bundle->media as $item) {
            $urls[$item->id] = '/site-kit-preview/'.$item->originalName;
        }
        $data = $bundle->resolve($paths, $urls);
        $this->assertCompiles($data);

        return ['can_install' => $issues === [], 'issues' => $issues, 'pages' => array_map(
            static fn (array $page): array => [...$page, 'path' => $paths[$page['key']]], $bundle->pages()),
            'parts' => ['header', 'footer'], 'media_count' => count($bundle->media),
            'kit_version' => $bundle->manifest['kit_version']];
    }

    /** @param array<string, string> $paths
     * @return array<string, mixed>
     */
    public function install(string $id, string $version, string $title, array $paths, string $requestId, ?int $actorId): array
    {
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $requestId) !== 1
            || trim($title) === '' || strlen($title) > 240) {
            throw new \InvalidArgumentException('설치 이름과 요청 식별자를 확인해 주세요.');
        }
        $bundle = $this->source->load($id);
        if ($version !== $bundle->manifest['kit_version']) {
            throw new \DomainException('사이트 킷 버전이 변경됐습니다. 구성을 다시 확인해 주세요.');
        }
        $paths = $this->paths($bundle, $paths);
        $fingerprint = hash('sha256', json_encode([$id, $version, trim($title), $paths, $bundle->manifest], JSON_THROW_ON_ERROR));

        return $this->installations->once($requestId, $fingerprint, $actorId, function () use ($id, $bundle, $paths, $title, $requestId, $actorId): array {
            $preview = $this->preview($id, $paths);
            if (! $preview['can_install']) {
                throw new \DomainException(implode(' ', $preview['issues']));
            }
            $createdMedia = [];
            try {
                $urls = [];
                foreach ($bundle->media as $item) {
                    $asset = $this->media->store($item->originalName, $item->mimeType, $item->contents, $item->width, $item->height, $actorId);
                    $createdMedia[] = $asset;
                    $urls[$item->id] = $asset->url;
                }

                return $this->installations->drafts(function () use ($bundle, $paths, $urls, $actorId, $requestId, $title, $id): array {
                    $data = $bundle->resolve($paths, $urls);
                    $items = [];
                    foreach ($data['pages'] as $page) {
                        $slug = 'site-'.str_replace('-', '', $requestId).'-'.$page['key'];
                        $snapshot = $this->pages->createFromPageKit($page['title'], $slug, PageBuilderDocument::fromArray($page['document']), $actorId);
                        $this->installations->assign($snapshot->document->documentId, $paths[$page['key']]);
                        $items[] = ['key' => $page['key'], 'title' => $page['title'], 'document_id' => $snapshot->document->documentId,
                            'path' => $paths[$page['key']], 'slug' => $slug];
                    }
                    $header = $this->freshPart($data['header']);
                    $footer = $this->freshPart($data['footer']);
                    $set = $this->parts->createSet(trim($title).' · '.substr($requestId, 0, 8), $header, $footer, $actorId, false);

                    return ['request_id' => $requestId, 'kit_id' => $id, 'kit_version' => $bundle->manifest['kit_version'],
                        'title' => trim($title), 'locale' => $bundle->manifest['locale'], 'pages' => $items,
                        'set_id' => $set->id, 'status' => 'draft'];
                });
            } catch (\Throwable $exception) {
                foreach (array_reverse($createdMedia) as $asset) {
                    try {
                        $this->media->delete($asset->id);
                    } catch (\Throwable) {
                        // Only this failed attempt's files; database rollback remains mandatory.
                    }
                }
                throw $exception;
            }
        });
    }

    /** @param array<string, string> $paths
     * @return array<string, string>
     */
    private function paths(SiteKitBundle $bundle, array $paths): array
    {
        $expected = array_column($bundle->pages(), 'key');
        if (array_diff($expected, array_keys($paths)) !== [] || array_diff(array_keys($paths), $expected) !== []) {
            throw new \InvalidArgumentException('모든 페이지의 주소를 지정해 주세요.');
        }
        $normalized = [];
        foreach ($expected as $key) {
            $normalized[$key] = PagePath::normalize($paths[$key]);
        }
        if (count(array_unique($normalized)) !== count($normalized)) {
            throw new \InvalidArgumentException('페이지마다 서로 다른 주소를 지정해 주세요.');
        }

        return $normalized;
    }

    private function compatibilityError(SiteKitBundle $bundle): ?string
    {
        foreach (['page_builder' => $this->pageBuilderVersion, 'g7' => $this->g7Version, 'php' => PHP_VERSION] as $key => $version) {
            if (! BlockPackCompatibility::matches($version, $bundle->manifest['compatibility'][$key])) {
                return '현재 '.$key.' 버전에서 사용할 수 없는 사이트 킷입니다.';
            }
        }

        return null;
    }

    /** @param array<string, mixed> $data */
    private function assertCompiles(array $data): void
    {
        foreach ($data['pages'] as $page) {
            $this->compiler->compile(PageBuilderDocument::fromArray($page['document']), 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
        }
        foreach (['header', 'footer'] as $kind) {
            $this->partCompiler->compile(SitePartDocument::fromArray($data[$kind]), 1);
        }
    }

    /** @param array<string, mixed> $data */
    private function freshPart(array $data): SitePartDocument
    {
        $refresh = function (array $node) use (&$refresh): array {
            foreach ($node as $key => $value) {
                if (in_array($key, ['site_part_id', 'instance_id'], true)) {
                    $bytes = random_bytes(16);
                    $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
                    $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
                    $hex = bin2hex($bytes);
                    $node[$key] = substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20);
                } elseif (is_array($value)) {
                    $node[$key] = $refresh($value);
                }
            }

            return $node;
        };

        return SitePartDocument::fromArray($refresh($data));
    }
}
