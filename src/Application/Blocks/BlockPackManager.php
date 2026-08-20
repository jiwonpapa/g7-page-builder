<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockUsagePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInUseException;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackUsage;

final readonly class BlockPackManager
{
    public function __construct(
        private BlockPackRepository $packs,
        private BlockPackArchivePort $archives,
        private BlockUsagePort $usage,
        private BlockRegistry $registry,
        private string $pageBuilderVersion,
        private string $g7Version,
        private ?BlockPackRuntimeRegistry $runtimes = null,
    ) {}

    /** @return list<BlockPackInstallation> */
    public function all(): array
    {
        return $this->packs->all();
    }

    public function installLocal(
        string $archivePath,
        ?int $actorId,
        bool $enable = true,
        ?string $expectedSha256 = null,
    ): BlockPackInstallation {
        return $this->installArchive(
            archivePath: $archivePath,
            actorId: $actorId,
            source: 'local',
            sourceUri: null,
            enable: $enable,
            expectedSha256: $expectedSha256,
        );
    }

    public function installArchive(
        string $archivePath,
        ?int $actorId,
        string $source,
        ?string $sourceUri,
        bool $enable = true,
        ?string $expectedSha256 = null,
        ?string $expectedPackVersion = null,
    ): BlockPackInstallation {
        if (! in_array($source, ['local', 'github'], true)) {
            throw new \InvalidArgumentException('External Block Pack source is invalid.');
        }
        $stored = $this->archives->store($archivePath, $expectedSha256);
        $now = new \DateTimeImmutable;
        $installation = new BlockPackInstallation(
            manifest: $stored->manifest,
            state: BlockPackState::Staged,
            source: $source,
            sourceReference: $stored->storageReference,
            sourceUri: $sourceUri,
            archiveSha256: $stored->archiveSha256,
            installedAt: $now,
            installedBy: $actorId,
            updatedAt: $now,
        );
        try {
            if ($expectedPackVersion !== null && $stored->manifest->packVersion !== $expectedPackVersion) {
                throw new \DomainException('Block Pack manifest version이 선택한 Release 버전과 일치하지 않습니다.');
            }
            $this->assertCompatible($stored->manifest);
            $this->packs->save($installation);
        } catch (\Throwable $exception) {
            // 검증 또는 최초 등록 전 실패한 archive는 설치본으로 남기지 않습니다.
            $this->archives->delete($installation);

            throw $exception;
        }
        $this->register($installation);

        return $enable ? $this->enable($installation->manifest->packId, $installation->manifest->packVersion) : $installation;
    }

    public function enable(string $packId, string $packVersion): BlockPackInstallation
    {
        $installation = $this->find($packId, $packVersion);
        if (in_array($installation->state, [BlockPackState::Retired, BlockPackState::Quarantined], true)) {
            throw new \DomainException('격리되거나 폐기된 블록 팩은 활성화할 수 없습니다.');
        }
        $this->assertCompatible($installation->manifest);
        $this->register($installation);
        $previous = $this->packs->enabled($packId);
        $resolvedVersion = $this->registry->resolvedVersion($packId);
        if ($previous === null && $resolvedVersion !== null) {
            $previous = $this->packs->find($packId, $resolvedVersion);
        }
        if ($previous !== null && $previous->manifest->packVersion !== $packVersion) {
            $this->assertSafeReplacement($previous->manifest, $installation->manifest);
        }
        $this->registry->enable($packId, $packVersion);
        try {
            $this->runtimes?->swap($previous, $installation);
        } catch (\Throwable $exception) {
            if ($previous !== null) {
                $this->registry->enable($previous->manifest->packId, $previous->manifest->packVersion);
            } else {
                $this->registry->disable($packId);
            }

            throw $exception;
        }

        if ($previous !== null && $previous->manifest->packVersion !== $packVersion) {
            $this->packs->save($previous->withState(BlockPackState::Disabled, new \DateTimeImmutable));
        }

        $enabled = $installation->withState(BlockPackState::Enabled, new \DateTimeImmutable);
        $this->packs->save($enabled);

        return $enabled;
    }

    public function disable(string $packId, string $packVersion): BlockPackInstallation
    {
        $installation = $this->find($packId, $packVersion);
        if ($installation->state !== BlockPackState::Enabled) {
            throw new \DomainException('활성 상태의 블록 팩만 비활성화할 수 있습니다.');
        }

        $this->registry->disable($packId);
        $disabled = $installation->withState(BlockPackState::Disabled, new \DateTimeImmutable);
        $this->packs->save($disabled);

        return $disabled;
    }

    public function remove(string $packId, string $packVersion): BlockPackUsage
    {
        $installation = $this->find($packId, $packVersion);
        if ($installation->state === BlockPackState::Enabled) {
            throw new \DomainException('활성 블록 팩은 먼저 비활성화해야 제거할 수 있습니다.');
        }

        $usage = $this->usage->summarize($installation->manifest);
        if ($usage->isInUse()) {
            throw new BlockPackInUseException($usage);
        }

        if ($this->registry->hasManifest($packId, $packVersion)) {
            $this->registry->release($packId, $packVersion);
            $this->registry->unregister($packId, $packVersion);
        }
        $this->runtimes?->deactivate($installation);
        $this->packs->delete($packId, $packVersion);
        $this->archives->delete($installation);

        return $usage;
    }

    public function usage(string $packId, string $packVersion): BlockPackUsage
    {
        return $this->usage->summarize($this->find($packId, $packVersion)->manifest);
    }

    private function find(string $packId, string $packVersion): BlockPackInstallation
    {
        return $this->packs->find($packId, $packVersion)
            ?? throw new \DomainException('블록 팩을 찾지 못했습니다.');
    }

    private function register(BlockPackInstallation $installation): void
    {
        if (! $this->registry->hasManifest($installation->manifest->packId, $installation->manifest->packVersion)) {
            $this->registry->register($installation->manifest);
        }
    }

    private function assertCompatible(BlockPackManifest $manifest): void
    {
        $constraints = $manifest->compatibility;
        if (! BlockPackCompatibility::matches($this->pageBuilderVersion, $constraints['page_builder'])
            || ! BlockPackCompatibility::matches(PHP_VERSION, $constraints['php'])
            || ! BlockPackCompatibility::matches($this->g7Version, $constraints['g7'])) {
            throw new \DomainException('현재 Page Builder, PHP 또는 G7 버전과 호환되지 않는 블록 팩입니다.');
        }
    }

    private function assertSafeReplacement(BlockPackManifest $previous, BlockPackManifest $next): void
    {
        if ($previous->kind !== $next->kind) {
            throw new \DomainException('같은 블록 팩의 data/code 종류는 업데이트에서 바꿀 수 없습니다.');
        }

        $nextDefinitions = [];
        foreach ($next->blocks as $definition) {
            $nextDefinitions[$definition->identity()] = $definition;
        }
        $missing = [];
        foreach ($previous->blocks as $definition) {
            $replacement = $nextDefinitions[$definition->identity()] ?? null;
            if ($replacement === null) {
                $missing[] = $definition->identity();

                continue;
            }
            if ($replacement->toArray() !== $definition->toArray()) {
                throw new \DomainException("기존 block_id와 block_version의 계약을 업데이트에서 변경할 수 없습니다: {$definition->identity()}");
            }
        }
        if ($missing === []) {
            return;
        }

        $usage = $this->usage->summarizeBlockIdentities($missing);
        if ($usage->isInUse()) {
            throw new \DomainException(
                '사용 중인 기존 블록 버전을 제공하지 않는 업데이트는 활성화할 수 없습니다: '.implode(', ', $missing),
            );
        }
    }
}
