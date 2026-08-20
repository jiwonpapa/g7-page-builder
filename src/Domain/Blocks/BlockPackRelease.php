<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class BlockPackRelease
{
    public function __construct(
        public string $owner,
        public string $repository,
        public string $tag,
        public string $version,
        public int $assetId,
        public string $assetName,
        public int $assetBytes,
        public string $sha256,
        public string $releaseUrl,
        public \DateTimeImmutable $publishedAt,
    ) {
        foreach ([$this->owner, $this->repository] as $part) {
            if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $part) !== 1) {
                throw new \InvalidArgumentException('GitHub repository identity is invalid.');
            }
        }
        BlockPackRules::assertSemver($this->version, 'release version');
        BlockPackRules::assertSha256($this->sha256, 'GitHub release asset digest');
        if ($this->assetId < 1 || $this->assetBytes < 1 || $this->assetBytes > 52_428_800) {
            throw new \InvalidArgumentException('GitHub release asset metadata is invalid.');
        }
        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$/i', $this->assetName) !== 1) {
            throw new \InvalidArgumentException('GitHub Block Pack asset name must be a ZIP file.');
        }
        if (filter_var($this->releaseUrl, FILTER_VALIDATE_URL) === false) {
            throw new \InvalidArgumentException('GitHub release URL is invalid.');
        }
    }

    public function repositoryIdentity(): string
    {
        return $this->owner.'/'.$this->repository;
    }
}
