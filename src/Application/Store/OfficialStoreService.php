<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Store;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackCompatibility;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackManager;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\OfficialStoreSourcePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageKitArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\RouteCatalogPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\PortableMedia;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\OfficialStoreCatalog;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\OfficialStoreProduct;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreArtifact;

final readonly class OfficialStoreService
{
    public function __construct(
        private OfficialStoreSourcePort $source,
        private PageKitArchivePort $pageKits,
        private BlockPackManager $blockPacks,
        private BlockRegistry $blocks,
        private PageBuilderService $pages,
        private MediaPort $media,
        private RouteCatalogPort $routes,
        private string $pageBuilderVersion,
        private string $g7Version,
    ) {}

    /** @return array<string, mixed> */
    public function catalog(): array
    {
        $catalog = $this->loadCatalog();
        $installed = [];
        foreach ($this->blockPacks->all() as $installation) {
            $installed[$installation->manifest->packId.'@'.$installation->manifest->packVersion] = $installation;
        }

        $products = [];
        foreach ($catalog->products as $product) {
            $compatibilityError = $this->compatibilityError($product);
            $installation = $installed[$product->productId.'@'.$product->productVersion] ?? null;
            $products[] = [
                ...$product->toArray(),
                'compatible' => $compatibilityError === null,
                'compatibility_error' => $compatibilityError,
                'installed' => $installation instanceof BlockPackInstallation,
                'installed_state' => $installation?->state->value,
            ];
        }

        return [
            'catalog_version' => 'g7pb-store/v1',
            'publisher' => ['id' => 'jiwonpapa', 'name' => '지원소프트'],
            'generated_at' => $catalog->generatedAt,
            'products' => $products,
        ];
    }

    public function installBlockPack(
        string $productId,
        string $productVersion,
        ?int $actorId,
    ): BlockPackInstallation {
        $product = $this->product($productId, $productVersion, 'block_pack');
        $this->assertCompatible($product);
        $artifact = $this->source->download($product);
        try {
            $installation = $this->blockPacks->installArchive(
                archivePath: $artifact->path,
                actorId: $actorId,
                source: 'store',
                sourceUri: $artifact->sourceUrl,
                enable: true,
                expectedSha256: $artifact->sha256,
                expectedPackVersion: $product->productVersion,
                expectedPackId: $product->productId,
            );

            return $installation;
        } finally {
            $this->source->release($artifact);
        }
    }

    public function applyPageKit(
        string $productId,
        string $productVersion,
        string $title,
        string $slug,
        ?int $actorId,
    ): DocumentSnapshot {
        $product = $this->product($productId, $productVersion, 'page_kit');
        $this->assertCompatible($product);
        $artifact = $this->source->download($product);
        $createdMedia = [];
        try {
            $bundle = $this->pageKits->read($artifact);
            if ($bundle->kitId !== $product->productId || $bundle->kitVersion !== $product->productVersion) {
                throw new \DomainException('Page Kit identity가 선택한 공식 마켓 상품과 일치하지 않습니다.');
            }
            foreach ($bundle->compatibility as $key => $constraint) {
                if ($key === 'document_schema') {
                    continue;
                }
                $version = match ($key) {
                    'page_builder' => $this->pageBuilderVersion,
                    'php' => PHP_VERSION,
                    'g7' => $this->g7Version,
                };
                if (! BlockPackCompatibility::matches($version, $constraint)) {
                    throw new \DomainException("Page Kit {$key} 호환성 조건을 충족하지 않습니다.");
                }
            }
            $this->assertRequiredBlocks($bundle->document, $product);
            $documentData = $bundle->document->toArray();
            $documentData = $this->resolveRouteReferences($documentData);

            $mediaUrls = [];
            foreach ($bundle->media as $item) {
                $asset = $this->media->store(
                    $item->originalName,
                    $item->mimeType,
                    $item->contents,
                    $item->width,
                    $item->height,
                    $actorId,
                );
                $createdMedia[] = $asset;
                $mediaUrls[$item->id] = $asset->url;
            }
            $documentData = $this->replaceReferences(
                $documentData,
                'g7pb-media://',
                $mediaUrls,
                'Page Kit에서 참조한 미디어를 찾지 못했습니다.',
            );
            $template = PageBuilderDocument::fromArray($documentData);

            return $this->pages->createFromPageKit($title, $slug, $template, $actorId);
        } catch (\Throwable $exception) {
            foreach (array_reverse($createdMedia) as $asset) {
                try {
                    $this->media->delete($asset->id);
                } catch (\Throwable) {
                    // 이번 요청이 만든 미디어만 best-effort로 정리합니다.
                }
            }

            throw $exception;
        } finally {
            $this->source->release($artifact);
        }
    }

    public function exportPageKit(
        string $documentId,
        string $kitId,
        string $kitVersion,
        string $title,
        string $description,
    ): StoreArtifact {
        $snapshot = $this->pages->get($documentId);
        $data = $snapshot->document->toArray();
        $portable = [];
        $mediaReferences = [];
        $data = $this->mapStrings($data, function (string $value) use (&$portable, &$mediaReferences): string {
            if (isset($mediaReferences[$value])) {
                return 'g7pb-media://'.$mediaReferences[$value];
            }
            $export = $this->media->exportByUrl($value);
            if (! $export instanceof PortableMedia) {
                if (str_contains($value, '/storage/g7-page-builder/')) {
                    throw new \DomainException('페이지가 참조하는 로컬 이미지를 Page Kit에 포함하지 못했습니다.');
                }

                return $value;
            }
            $id = 'image-'.(count($portable) + 1);
            $portable[] = $export;
            $mediaReferences[$value] = $id;

            return 'g7pb-media://'.$id;
        });
        $data['shell_mode'] = 'template';
        $portableDocument = PageBuilderDocument::fromArray($data);

        return $this->pageKits->write(
            $kitId,
            $kitVersion,
            $title,
            $description,
            $portableDocument,
            $portable,
        );
    }

    public function releaseExport(StoreArtifact $artifact): void
    {
        $this->pageKits->release($artifact);
    }

    private function loadCatalog(): OfficialStoreCatalog
    {
        return OfficialStoreCatalog::fromArray($this->source->catalog());
    }

    private function product(string $productId, string $productVersion, string $type): OfficialStoreProduct
    {
        $product = $this->loadCatalog()->find($productId, $productVersion);
        if ($product->productType !== $type) {
            throw new \DomainException('선택한 공식 마켓 상품 종류가 요청과 일치하지 않습니다.');
        }

        return $product;
    }

    private function assertCompatible(OfficialStoreProduct $product): void
    {
        $error = $this->compatibilityError($product);
        if ($error !== null) {
            throw new \DomainException($error);
        }
    }

    private function compatibilityError(OfficialStoreProduct $product): ?string
    {
        $versions = [
            'page_builder' => $this->pageBuilderVersion,
            'php' => PHP_VERSION,
            'g7' => $this->g7Version,
        ];
        foreach ($versions as $key => $version) {
            try {
                if (! BlockPackCompatibility::matches($version, $product->compatibility[$key])) {
                    return "현재 {$key} {$version}은 요구 조건 {$product->compatibility[$key]}과 호환되지 않습니다.";
                }
            } catch (\InvalidArgumentException) {
                return "상품의 {$key} 호환성 조건이 올바르지 않습니다.";
            }
        }

        return null;
    }

    private function assertRequiredBlocks(PageBuilderDocument $document, OfficialStoreProduct $product): void
    {
        $required = [];
        foreach ($product->requiredBlocks as $block) {
            $required[$block['block_id'].'@'.$block['block_version']] = true;
        }
        $this->walkBlocks($document->blocks, function (array $block) use (&$required): void {
            $blockId = $block['type'] ?? null;
            $blockVersion = $block['block_version'] ?? null;
            if (! is_string($blockId) || ! is_int($blockVersion)
                || $this->blocks->definition($blockId, $blockVersion) === null) {
                throw new \DomainException('Page Kit에 현재 사용할 수 없는 블록이 포함되어 있습니다.');
            }
            $required[$blockId.'@'.$blockVersion] = true;
        });
        foreach (array_keys($required) as $identity) {
            [$blockId, $blockVersion] = explode('@', $identity, 2);
            if ($this->blocks->definition($blockId, (int) $blockVersion) === null) {
                throw new \DomainException("Page Kit 필수 블록 {$identity}이 설치되지 않았습니다.");
            }
        }
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, mixed>
     */
    private function resolveRouteReferences(array $document): array
    {
        if (! str_contains(
            json_encode($document, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
            'g7pb-route://',
        )) {
            return $document;
        }
        $catalog = $this->routes->catalog();
        $available = [];
        foreach ($catalog['routes'] as $route) {
            if (! is_string($route['id'] ?? null) || ! is_string($route['path'] ?? null)
                || ($route['parameters'] ?? null) !== [] || str_starts_with($route['path'], '#')) {
                continue;
            }
            $available[$route['id']] = $route['path'];
        }

        return $this->replaceReferences(
            $document,
            'g7pb-route://',
            $available,
            'Page Kit에서 참조한 사이트 경로를 현재 템플릿에서 찾지 못했습니다.',
        );
    }

    /**
     * @param  array<string, mixed>  $value
     * @param  array<string, string>  $references
     * @return array<string, mixed>
     */
    private function replaceReferences(array $value, string $prefix, array $references, string $error): array
    {
        return $this->mapStrings($value, static function (string $candidate) use ($prefix, $references, $error): string {
            if (! str_starts_with($candidate, $prefix)) {
                return $candidate;
            }
            $id = substr($candidate, strlen($prefix));
            if ($id === '' || ! isset($references[$id])) {
                throw new \DomainException($error.' ('.$id.')');
            }

            return $references[$id];
        });
    }

    /**
     * @param  array<string, mixed>  $value
     * @param  callable(string): string  $mapper
     * @return array<string, mixed>
     */
    private function mapStrings(array $value, callable $mapper): array
    {
        foreach ($value as $key => $item) {
            if (is_string($item)) {
                $value[$key] = $mapper($item);
            } elseif (is_array($item)) {
                $value[$key] = $this->mapStrings($item, $mapper);
            }
        }

        return $value;
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     * @param  callable(array<string, mixed>): void  $callback
     */
    private function walkBlocks(array $blocks, callable $callback): void
    {
        foreach ($blocks as $block) {
            $callback($block);
            $slots = $block['slots'] ?? [];
            if (! is_array($slots)) {
                throw new \DomainException('Page Kit block slot이 올바르지 않습니다.');
            }
            foreach ($slots as $children) {
                if (! is_array($children)) {
                    throw new \DomainException('Page Kit block slot 항목이 올바르지 않습니다.');
                }
                $this->walkBlocks(array_values($children), $callback);
            }
        }
    }
}
