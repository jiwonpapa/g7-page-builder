<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackSignatureVerifierPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRules;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\StoredBlockPack;

final readonly class ZipBlockPackArchiveAdapter implements BlockPackArchivePort
{
    private const MAX_ARCHIVE_BYTES = 52_428_800;

    private const MAX_EXTRACTED_BYTES = 104_857_600;

    private const MAX_FILES = 2_002;

    public function __construct(
        private string $storageRoot,
        private ?BlockPackSignatureVerifierPort $signatures = null,
    ) {}

    public function store(string $archivePath, ?string $expectedSha256 = null): StoredBlockPack
    {
        if (! is_file($archivePath) || ! is_readable($archivePath)) {
            throw new \InvalidArgumentException('읽을 수 있는 블록 팩 ZIP 파일이 필요합니다.');
        }
        $archiveBytes = filesize($archivePath);
        if (! is_int($archiveBytes) || $archiveBytes < 1 || $archiveBytes > self::MAX_ARCHIVE_BYTES) {
            throw new \InvalidArgumentException('블록 팩 ZIP 파일은 50MB 이하여야 합니다.');
        }

        $archiveSha256 = hash_file('sha256', $archivePath);
        if (! is_string($archiveSha256)) {
            throw new \RuntimeException('블록 팩 ZIP 해시를 계산하지 못했습니다.');
        }
        if ($expectedSha256 !== null && ! hash_equals($expectedSha256, $archiveSha256)) {
            throw new \DomainException('블록 팩 ZIP SHA-256이 배포 정보와 일치하지 않습니다.');
        }

        $zip = new \ZipArchive;
        if ($zip->open($archivePath, \ZipArchive::RDONLY) !== true) {
            throw new \InvalidArgumentException('올바른 ZIP 블록 팩 파일이 아닙니다.');
        }

        try {
            [$manifest, $entries] = $this->inspect($zip);
            $destination = $this->destination($manifest);
            if (file_exists($destination)) {
                throw new \DomainException("같은 블록 팩 버전이 이미 저장되어 있습니다: {$manifest->identity()}");
            }

            $staging = $this->temporaryDirectory();
            try {
                $this->extract($zip, $entries, $staging);
                $parent = dirname($destination);
                if (! is_dir($parent) && ! mkdir($parent, 0755, true) && ! is_dir($parent)) {
                    throw new \RuntimeException('블록 팩 저장 경로를 만들지 못했습니다.');
                }
                if (! rename($staging, $destination)) {
                    throw new \RuntimeException('검증한 블록 팩을 저장하지 못했습니다.');
                }
            } finally {
                if (is_dir($staging)) {
                    $this->removeTree($staging, dirname($staging));
                }
            }

            return new StoredBlockPack($manifest, $archiveSha256, $destination);
        } finally {
            $zip->close();
        }
    }

    public function delete(BlockPackInstallation $installation): void
    {
        if ($installation->source === 'builtin') {
            throw new \DomainException('내장 블록 팩은 제거할 수 없습니다.');
        }

        $root = $this->canonicalRoot();
        $target = realpath($installation->sourceReference);
        if ($target === false) {
            return;
        }
        if (! str_starts_with($target.'/', $root.'/')) {
            throw new \DomainException('블록 팩 저장 경로가 제품 소유 경계를 벗어났습니다.');
        }

        $this->removeTree($target, $root);
    }

    /**
     * @return array{BlockPackManifest, array<string, int>}
     */
    private function inspect(\ZipArchive $zip): array
    {
        if ($zip->numFiles < 1 || $zip->numFiles > self::MAX_FILES) {
            throw new \InvalidArgumentException('블록 팩 파일 수 제한을 초과했습니다.');
        }

        $entries = [];
        $totalBytes = 0;
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $stat = $zip->statIndex($index, \ZipArchive::FL_UNCHANGED);
            if ($stat === false) {
                throw new \InvalidArgumentException('블록 팩 ZIP 항목을 읽지 못했습니다.');
            }
            $name = rtrim($stat['name'], '/');
            if ($name === '') {
                continue;
            }
            BlockPackRules::assertRelativePath($name, 'ZIP entry path');
            if (isset($entries[$name])) {
                throw new \InvalidArgumentException('블록 팩 ZIP에 중복 경로가 있습니다.');
            }
            $this->assertRegularFile($zip, $index);
            $size = $stat['size'];
            if ($size < 0) {
                throw new \InvalidArgumentException('블록 팩 ZIP 파일 크기가 올바르지 않습니다.');
            }
            $totalBytes += $size;
            if ($totalBytes > self::MAX_EXTRACTED_BYTES) {
                throw new \InvalidArgumentException('블록 팩 압축 해제 크기 제한을 초과했습니다.');
            }
            $entries[$name] = $index;
        }

        $manifestIndex = $entries['manifest.json'] ?? null;
        if (! is_int($manifestIndex)) {
            throw new \InvalidArgumentException('블록 팩 루트에 manifest.json이 필요합니다.');
        }
        $manifestJson = $zip->getFromIndex($manifestIndex, 1_048_576, \ZipArchive::FL_UNCHANGED);
        if (! is_string($manifestJson)) {
            throw new \InvalidArgumentException('블록 팩 manifest.json을 읽지 못했습니다.');
        }
        $manifest = BlockPackManifest::fromJson($manifestJson);
        if ($manifest->kind === 'code') {
            $signatureIndex = $entries['manifest.sig'] ?? null;
            if (! is_int($signatureIndex) || $this->signatures === null) {
                throw new \DomainException('Code Block Pack은 신뢰 발행자의 manifest.sig가 필요합니다.');
            }
            $signature = $zip->getFromIndex($signatureIndex, 1024, \ZipArchive::FL_UNCHANGED);
            if (! is_string($signature)) {
                throw new \InvalidArgumentException('Code Block Pack manifest.sig를 읽지 못했습니다.');
            }
            $this->signatures->verify($manifest, $manifestJson, $signature);
            $runtime = $manifest->runtime ?? throw new \DomainException('Code Block Pack runtime이 없습니다.');
            foreach ([$runtime['provider'], $runtime['editor'], ...$runtime['styles']] as $runtimePath) {
                if (! isset($manifest->files[$runtimePath])) {
                    throw new \DomainException("Code Block Pack runtime 파일이 digest 목록에 없습니다: {$runtimePath}");
                }
            }
            if (! str_ends_with($runtime['provider'], '.php')) {
                throw new \DomainException('Code Block Pack runtime provider는 서명된 PHP 파일이어야 합니다.');
            }
        }

        $allowed = array_fill_keys(array_keys($manifest->files), true);
        $allowed['manifest.json'] = true;
        if ($manifest->kind === 'code') {
            $allowed['manifest.sig'] = true;
        }
        foreach ($entries as $path => $index) {
            if (! isset($allowed[$path])) {
                throw new \InvalidArgumentException("manifest에 선언하지 않은 파일이 있습니다: {$path}");
            }
            if (isset($manifest->files[$path])) {
                $contents = $zip->getFromIndex($index, 0, \ZipArchive::FL_UNCHANGED);
                if (! is_string($contents) || ! hash_equals($manifest->files[$path], hash('sha256', $contents))) {
                    throw new \DomainException("블록 팩 파일 SHA-256이 일치하지 않습니다: {$path}");
                }
            }
        }
        foreach ($manifest->files as $path => $_digest) {
            if (! isset($entries[$path])) {
                throw new \InvalidArgumentException("manifest에 선언한 파일이 ZIP에 없습니다: {$path}");
            }
        }

        return [$manifest, $entries];
    }

    /** @param array<string, int> $entries */
    private function extract(\ZipArchive $zip, array $entries, string $destination): void
    {
        foreach ($entries as $path => $index) {
            $contents = $zip->getFromIndex($index, 0, \ZipArchive::FL_UNCHANGED);
            if (! is_string($contents)) {
                throw new \RuntimeException("블록 팩 파일을 읽지 못했습니다: {$path}");
            }
            $target = $destination.'/'.$path;
            $parent = dirname($target);
            if (! is_dir($parent) && ! mkdir($parent, 0755, true) && ! is_dir($parent)) {
                throw new \RuntimeException('블록 팩 하위 경로를 만들지 못했습니다.');
            }
            if (file_put_contents($target, $contents, LOCK_EX) !== strlen($contents)) {
                throw new \RuntimeException("블록 팩 파일을 저장하지 못했습니다: {$path}");
            }
        }
    }

    private function assertRegularFile(\ZipArchive $zip, int $index): void
    {
        $operationsSystem = 0;
        $attributes = 0;
        if ($zip->getExternalAttributesIndex($index, $operationsSystem, $attributes, \ZipArchive::FL_UNCHANGED)
            && $operationsSystem === \ZipArchive::OPSYS_UNIX) {
            $mode = ($attributes >> 16) & 0170000;
            if ($mode !== 0 && $mode !== 0100000) {
                throw new \InvalidArgumentException('블록 팩 ZIP은 일반 파일만 포함할 수 있습니다.');
            }
        }
    }

    private function destination(BlockPackManifest $manifest): string
    {
        [$publisher, $name] = explode('/', $manifest->packId, 2);

        return $this->canonicalRoot().'/'.$publisher.'/'.$name.'/'.$manifest->packVersion;
    }

    private function canonicalRoot(): string
    {
        if (! is_dir($this->storageRoot) && ! mkdir($this->storageRoot, 0755, true) && ! is_dir($this->storageRoot)) {
            throw new \RuntimeException('블록 팩 저장소를 만들지 못했습니다.');
        }
        $root = realpath($this->storageRoot);

        return $root !== false ? $root : throw new \RuntimeException('블록 팩 저장소 경로를 확인하지 못했습니다.');
    }

    private function temporaryDirectory(): string
    {
        $root = $this->canonicalRoot().'/.staging';
        if (! is_dir($root) && ! mkdir($root, 0700, true) && ! is_dir($root)) {
            throw new \RuntimeException('블록 팩 임시 저장소를 만들지 못했습니다.');
        }
        $path = $root.'/'.bin2hex(random_bytes(16));
        if (! mkdir($path, 0700)) {
            throw new \RuntimeException('블록 팩 임시 경로를 만들지 못했습니다.');
        }

        return $path;
    }

    private function removeTree(string $target, string $boundary): void
    {
        $targetPath = realpath($target);
        $boundaryPath = realpath($boundary);
        if ($targetPath === false || $boundaryPath === false || $targetPath === $boundaryPath
            || ! str_starts_with($targetPath.'/', $boundaryPath.'/')) {
            throw new \DomainException('안전 경계를 확인하지 못해 블록 팩 파일을 제거하지 않았습니다.');
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($targetPath, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            if ($item->isLink() || $item->isFile()) {
                if (! unlink($item->getPathname())) {
                    throw new \RuntimeException('블록 팩 파일을 제거하지 못했습니다.');
                }
            } elseif (! rmdir($item->getPathname())) {
                throw new \RuntimeException('블록 팩 디렉터리를 제거하지 못했습니다.');
            }
        }
        if (! rmdir($targetPath)) {
            throw new \RuntimeException('블록 팩 저장 경로를 제거하지 못했습니다.');
        }
    }
}
