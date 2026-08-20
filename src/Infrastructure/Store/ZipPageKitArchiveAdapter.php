<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Store;

use Modules\Jiwonpapa\PageBuilder\Contracts\PageKitArchivePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\PageKitBundle;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\PageKitMedia;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreRules;
use ZipArchive;

final class ZipPageKitArchiveAdapter implements PageKitArchivePort
{
    private const MAX_FILES = 103;

    private const MAX_EXPANDED_BYTES = 52_428_800;

    public function read(StoreArtifact $artifact): PageKitBundle
    {
        $zip = new ZipArchive;
        if ($zip->open($artifact->path, ZipArchive::RDONLY) !== true) {
            throw new \InvalidArgumentException('Page Kit ZIP을 열 수 없습니다.');
        }
        try {
            $entries = $this->entries($zip);
            if (! isset($entries['manifest.json'], $entries['document.json'])) {
                throw new \InvalidArgumentException('Page Kit 필수 파일이 없습니다.');
            }
            $manifest = $this->jsonObject($this->contents($zip, 'manifest.json'), 'manifest.json');
            $this->assertManifest($manifest);
            $files = $manifest['files'];
            if (! is_array($files)) {
                throw new \InvalidArgumentException('Page Kit 파일 목록이 올바르지 않습니다.');
            }
            $declared = ['manifest.json' => true];
            foreach ($files as $path => $sha256) {
                if (! is_string($path) || ! is_string($sha256) || ! isset($entries[$path])) {
                    throw new \InvalidArgumentException('Page Kit 선언 파일을 찾을 수 없습니다.');
                }
                StoreRules::assertSha256($sha256, "Page Kit {$path} digest");
                if (! hash_equals($sha256, hash('sha256', $this->contents($zip, $path)))) {
                    throw new \InvalidArgumentException("Page Kit {$path} digest가 일치하지 않습니다.");
                }
                $declared[$path] = true;
            }
            if (array_diff_key($entries, $declared) !== [] || array_diff_key($declared, $entries) !== []) {
                throw new \InvalidArgumentException('Page Kit ZIP에 선언되지 않은 파일이 있습니다.');
            }

            $document = PageBuilderDocument::fromArray(
                $this->jsonObject($this->contents($zip, 'document.json'), 'document.json'),
            );
            $media = [];
            $mediaItems = $manifest['media'];
            if (! is_array($mediaItems) || count($mediaItems) > 100) {
                throw new \InvalidArgumentException('Page Kit 미디어 목록이 올바르지 않습니다.');
            }
            $seenMediaIds = [];
            $seenMediaPaths = [];
            foreach ($mediaItems as $item) {
                if (! is_array($item)) {
                    throw new \InvalidArgumentException('Page Kit 미디어 항목이 올바르지 않습니다.');
                }
                StoreRules::assertOnlyKeys(
                    $item,
                    ['id', 'path', 'sha256', 'original_name', 'mime_type', 'width', 'height'],
                    'Page Kit 미디어',
                );
                $id = StoreRules::requiredString($item, 'id', 64);
                $path = StoreRules::requiredString($item, 'path', 240);
                $mediaSha256 = StoreRules::requiredString($item, 'sha256', 64);
                if (isset($seenMediaIds[$id]) || isset($seenMediaPaths[$path])) {
                    throw new \InvalidArgumentException('Page Kit 미디어 식별자 또는 경로가 중복되었습니다.');
                }
                if (! isset($files[$path]) || ! hash_equals($files[$path], $mediaSha256)) {
                    throw new \InvalidArgumentException('Page Kit 미디어와 파일 digest 선언이 일치하지 않습니다.');
                }
                $seenMediaIds[$id] = true;
                $seenMediaPaths[$path] = true;
                $contents = $this->contents($zip, $path);
                /** @var array<int|string, mixed>|false $image */
                $image = @getimagesizefromstring($contents);
                if ($image === false
                    || ! is_int($image[0] ?? null)
                    || ! is_int($image[1] ?? null)
                    || ! is_string($image['mime'] ?? null)) {
                    throw new \InvalidArgumentException('Page Kit에는 실제 이미지 파일만 포함할 수 있습니다.');
                }
                $media[] = new PageKitMedia(
                    id: $id,
                    path: $path,
                    sha256: $mediaSha256,
                    originalName: StoreRules::requiredString($item, 'original_name', 255),
                    mimeType: StoreRules::requiredString($item, 'mime_type', 40),
                    width: is_int($item['width'] ?? null) ? $item['width'] : 0,
                    height: is_int($item['height'] ?? null) ? $item['height'] : 0,
                    contents: $contents,
                );
                if ($image[0] !== $media[array_key_last($media)]->width
                    || $image[1] !== $media[array_key_last($media)]->height
                    || $image['mime'] !== $media[array_key_last($media)]->mimeType) {
                    throw new \InvalidArgumentException('Page Kit 미디어 실제 형식이 manifest와 일치하지 않습니다.');
                }
            }
            $declaredMediaPaths = array_diff(array_keys($files), ['document.json']);
            if (array_diff($declaredMediaPaths, array_keys($seenMediaPaths)) !== []
                || array_diff(array_keys($seenMediaPaths), $declaredMediaPaths) !== []) {
                throw new \InvalidArgumentException('Page Kit 미디어와 파일 목록이 일치하지 않습니다.');
            }
            $compatibility = $manifest['compatibility'];
            if (! is_array($compatibility)) {
                throw new \InvalidArgumentException('Page Kit 호환성 정보가 올바르지 않습니다.');
            }

            return new PageKitBundle(
                kitId: StoreRules::requiredString($manifest, 'kit_id', 128),
                kitVersion: StoreRules::requiredString($manifest, 'kit_version', 64),
                title: StoreRules::requiredString($manifest, 'title', 200),
                description: StoreRules::requiredString($manifest, 'description', 1000),
                compatibility: [
                    'page_builder' => StoreRules::requiredString($compatibility, 'page_builder', 100),
                    'php' => StoreRules::requiredString($compatibility, 'php', 100),
                    'g7' => StoreRules::requiredString($compatibility, 'g7', 100),
                    'document_schema' => StoreRules::requiredString($compatibility, 'document_schema', 100),
                ],
                document: $document,
                media: $media,
            );
        } finally {
            $zip->close();
        }
    }

    public function write(
        string $kitId,
        string $kitVersion,
        string $title,
        string $description,
        PageBuilderDocument $document,
        array $media,
    ): StoreArtifact {
        StoreRules::assertProductId($kitId);
        StoreRules::assertSemver($kitVersion, 'Page Kit 버전');
        $path = tempnam(sys_get_temp_dir(), 'g7pb-page-kit-');
        if (! is_string($path)) {
            throw new \RuntimeException('Page Kit 임시 파일을 만들지 못했습니다.');
        }
        @unlink($path);
        $path .= '.zip';
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
            throw new \RuntimeException('Page Kit ZIP을 만들지 못했습니다.');
        }
        try {
            $documentJson = $this->json($document->toArray());
            $expandedBytes = strlen($documentJson);
            if (count($media) > 100 || $expandedBytes > self::MAX_EXPANDED_BYTES) {
                throw new \InvalidArgumentException('Page Kit 내보내기 크기가 허용 범위를 벗어났습니다.');
            }
            $files = ['document.json' => hash('sha256', $documentJson)];
            $mediaManifest = [];
            foreach ($media as $index => $portable) {
                $expandedBytes += strlen($portable->contents);
                if ($expandedBytes > self::MAX_EXPANDED_BYTES) {
                    throw new \InvalidArgumentException('Page Kit 내보내기 크기가 허용 범위를 벗어났습니다.');
                }
                /** @var array<int|string, mixed>|false $actualImage */
                $actualImage = @getimagesizefromstring($portable->contents);
                if ($actualImage === false
                    || ! is_string($actualImage['mime'] ?? null)
                    || ! is_int($actualImage[0] ?? null)
                    || ! is_int($actualImage[1] ?? null)
                    || $actualImage['mime'] !== $portable->asset->mimeType
                    || $actualImage[0] !== $portable->asset->width
                    || $actualImage[1] !== $portable->asset->height) {
                    throw new \InvalidArgumentException('Page Kit 내보내기 이미지 정보가 실제 파일과 일치하지 않습니다.');
                }
                $extension = match ($portable->asset->mimeType) {
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                    'image/avif' => 'avif',
                    'image/gif' => 'gif',
                    default => throw new \InvalidArgumentException('지원하지 않는 Page Kit 이미지입니다.'),
                };
                $id = 'image-'.($index + 1);
                $mediaPath = "media/{$id}.{$extension}";
                $sha256 = hash('sha256', $portable->contents);
                $files[$mediaPath] = $sha256;
                $mediaManifest[] = [
                    'id' => $id,
                    'path' => $mediaPath,
                    'sha256' => $sha256,
                    'original_name' => $portable->asset->originalName,
                    'mime_type' => $portable->asset->mimeType,
                    'width' => $portable->asset->width,
                    'height' => $portable->asset->height,
                ];
                if (! $zip->addFromString($mediaPath, $portable->contents)) {
                    throw new \RuntimeException('Page Kit 미디어를 ZIP에 추가하지 못했습니다.');
                }
                $zip->setMtimeName($mediaPath, 315532800);
            }
            $manifest = [
                'manifest_version' => 'g7pb-page-kit/v1',
                'kit_id' => $kitId,
                'kit_version' => $kitVersion,
                'publisher' => ['id' => 'jiwonpapa', 'name' => '지원소프트'],
                'title' => trim($title),
                'description' => trim($description),
                'license' => 'free',
                'compatibility' => [
                    'page_builder' => '>=0.10.0 <1.0.0',
                    'php' => '>=8.5',
                    'g7' => '>=7.0.7',
                    'document_schema' => 'g7-page-builder/v1',
                ],
                'document' => 'document.json',
                'media' => $mediaManifest,
                'files' => $files,
            ];
            $this->assertManifest($manifest);
            if (! $zip->addFromString('document.json', $documentJson)
                || ! $zip->addFromString('manifest.json', $this->json($manifest))) {
                throw new \RuntimeException('Page Kit 문서를 ZIP에 추가하지 못했습니다.');
            }
            $zip->setMtimeName('document.json', 315532800);
            $zip->setMtimeName('manifest.json', 315532800);
        } catch (\Throwable $exception) {
            $zip->close();
            @unlink($path);

            throw $exception;
        }
        if (! $zip->close()) {
            @unlink($path);
            throw new \RuntimeException('Page Kit ZIP을 닫지 못했습니다.');
        }
        $bytes = filesize($path);
        $sha256 = hash_file('sha256', $path);
        if (! is_int($bytes) || $bytes > self::MAX_EXPANDED_BYTES || ! is_string($sha256)) {
            @unlink($path);
            throw new \RuntimeException('Page Kit ZIP 결과를 읽지 못했습니다.');
        }

        return new StoreArtifact($path, 'operator-export://'.$kitId.'/'.$kitVersion, $sha256, $bytes);
    }

    public function release(StoreArtifact $artifact): void
    {
        if ($artifact->temporary && is_file($artifact->path)) {
            @unlink($artifact->path);
        }
    }

    /** @return array<string, int> */
    private function entries(ZipArchive $zip): array
    {
        if ($zip->numFiles < 1 || $zip->numFiles > self::MAX_FILES) {
            throw new \InvalidArgumentException('Page Kit 파일 수가 허용 범위를 벗어났습니다.');
        }
        $entries = [];
        $expanded = 0;
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $stat = $zip->statIndex($index);
            if (! is_array($stat)) {
                throw new \InvalidArgumentException('Page Kit ZIP 정보를 읽지 못했습니다.');
            }
            $name = $stat['name'];
            $size = $stat['size'];
            if (isset($entries[$name])
                || preg_match('#^(manifest\.json|document\.json|media/[A-Za-z0-9._-]+)$#', $name) !== 1) {
                throw new \InvalidArgumentException('Page Kit ZIP 경로가 안전하지 않습니다.');
            }
            $attributes = 0;
            $operations = 0;
            if ($zip->getExternalAttributesIndex($index, $operations, $attributes)
                && (($attributes >> 16) & 0170000) === 0120000) {
                throw new \InvalidArgumentException('Page Kit ZIP은 심볼릭 링크를 포함할 수 없습니다.');
            }
            $expanded += $size;
            if ($expanded > self::MAX_EXPANDED_BYTES) {
                throw new \InvalidArgumentException('Page Kit 압축 해제 크기가 제한을 초과했습니다.');
            }
            $entries[$name] = $size;
        }

        return $entries;
    }

    /** @param array<string, mixed> $manifest */
    private function assertManifest(array $manifest): void
    {
        StoreRules::assertOnlyKeys($manifest, [
            'manifest_version', 'kit_id', 'kit_version', 'publisher', 'title', 'description',
            'license', 'compatibility', 'document', 'media', 'files',
        ], 'Page Kit manifest');
        $publisher = $manifest['publisher'] ?? null;
        $compatibility = $manifest['compatibility'] ?? null;
        $media = $manifest['media'] ?? null;
        $files = $manifest['files'] ?? null;
        if (! is_array($publisher) || ! is_array($compatibility) || ! is_array($media) || ! is_array($files)) {
            throw new \InvalidArgumentException('Page Kit manifest 구조가 올바르지 않습니다.');
        }
        StoreRules::assertOnlyKeys($publisher, ['id', 'name'], 'Page Kit 발행자');
        StoreRules::assertOnlyKeys(
            $compatibility,
            ['page_builder', 'php', 'g7', 'document_schema'],
            'Page Kit 호환성',
        );
        if (($manifest['manifest_version'] ?? null) !== 'g7pb-page-kit/v1'
            || ($publisher['id'] ?? null) !== 'jiwonpapa'
            || ! is_string($publisher['name'] ?? null)
            || trim($publisher['name']) === ''
            || ($manifest['license'] ?? null) !== 'free'
            || ($manifest['document'] ?? null) !== 'document.json'
            || ($compatibility['document_schema'] ?? null) !== 'g7-page-builder/v1') {
            throw new \InvalidArgumentException('지원하지 않는 Page Kit manifest입니다.');
        }
        StoreRules::assertProductId(StoreRules::requiredString($manifest, 'kit_id', 128));
        StoreRules::assertSemver(StoreRules::requiredString($manifest, 'kit_version', 64), 'Page Kit 버전');
        StoreRules::requiredString($manifest, 'title', 200);
        StoreRules::requiredString($manifest, 'description', 1000);
        foreach (['page_builder', 'php', 'g7', 'document_schema'] as $field) {
            StoreRules::requiredString($compatibility, $field, 100);
        }
        if (count($media) > 100 || count($files) < 1 || count($files) > 102) {
            throw new \InvalidArgumentException('Page Kit 파일 또는 미디어 수가 올바르지 않습니다.');
        }
        foreach ($files as $file => $digest) {
            if (! is_string($file) || preg_match('#^(document\.json|media/[A-Za-z0-9._-]+)$#', $file) !== 1
                || ! is_string($digest)) {
                throw new \InvalidArgumentException('Page Kit 파일 선언이 올바르지 않습니다.');
            }
            StoreRules::assertSha256($digest, "Page Kit {$file} digest");
        }
        if (! isset($files['document.json'])) {
            throw new \InvalidArgumentException('Page Kit document.json digest가 없습니다.');
        }
    }

    /** @return array<string, mixed> */
    private function jsonObject(string $contents, string $name): array
    {
        $value = json_decode($contents, true, 128, JSON_THROW_ON_ERROR);
        if (! is_array($value) || array_is_list($value)) {
            throw new \InvalidArgumentException("Page Kit {$name}은 JSON object여야 합니다.");
        }

        return $value;
    }

    private function contents(ZipArchive $zip, string $name): string
    {
        $contents = $zip->getFromName($name);
        if (! is_string($contents)) {
            throw new \InvalidArgumentException("Page Kit {$name} 파일을 읽지 못했습니다.");
        }

        return $contents;
    }

    /** @param array<string, mixed> $value */
    private function json(array $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n";
    }
}
