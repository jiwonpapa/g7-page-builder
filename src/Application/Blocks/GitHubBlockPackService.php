<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackReleaseSourcePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackRelease;

final readonly class GitHubBlockPackService
{
    public function __construct(
        private BlockPackReleaseSourcePort $source,
        private BlockPackManager $packs,
    ) {}

    /** @return array{release: BlockPackRelease, installed_version: string|null, update_available: bool} */
    public function check(string $owner, string $repository, string $assetName): array
    {
        $release = $this->latest($owner, $repository, $assetName);
        $installedVersion = null;
        foreach ($this->packs->all() as $installation) {
            if ($installation->sourceUri !== null
                && str_contains($installation->sourceUri, 'github.com/'.$owner.'/'.$repository.'/')) {
                if ($installedVersion === null || version_compare($installation->manifest->packVersion, $installedVersion, '>')) {
                    $installedVersion = $installation->manifest->packVersion;
                }
            }
        }

        return [
            'release' => $release,
            'installed_version' => $installedVersion,
            'update_available' => $installedVersion === null || version_compare($release->version, $installedVersion, '>'),
        ];
    }

    public function installLatest(
        string $owner,
        string $repository,
        string $assetName,
        ?int $actorId,
        bool $enable = true,
    ): BlockPackInstallation {
        $release = $this->latest($owner, $repository, $assetName);
        $archivePath = $this->source->download($release);

        try {
            return $this->packs->installArchive(
                archivePath: $archivePath,
                actorId: $actorId,
                source: 'github',
                sourceUri: $release->releaseUrl,
                enable: $enable,
                expectedSha256: $release->sha256,
                expectedPackVersion: $release->version,
            );
        } finally {
            if (is_file($archivePath)) {
                unlink($archivePath);
            }
        }
    }

    private function latest(string $owner, string $repository, string $assetName): BlockPackRelease
    {
        $releases = $this->source->releases($owner, $repository, $assetName);
        if ($releases === []) {
            throw new \DomainException('SHA-256 digest가 있는 안정 버전 GitHub Release ZIP을 찾지 못했습니다.');
        }
        usort($releases, static fn (BlockPackRelease $left, BlockPackRelease $right): int => version_compare($right->version, $left->version));

        return $releases[0];
    }
}
