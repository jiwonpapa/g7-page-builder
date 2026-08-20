<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockDefinition;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPreset;

final class BlockRegistry
{
    /** @var array<string, BlockPackManifest> */
    private array $manifests = [];

    /** @var array<string, string> */
    private array $enabledPackVersions = [];

    /** @var array<string, string> */
    private array $resolvedPackVersions = [];

    public function register(BlockPackManifest $manifest, bool $enabled = false): void
    {
        if (isset($this->manifests[$manifest->identity()])) {
            throw new \DomainException("Block Pack {$manifest->identity()} is already registered.");
        }

        $this->manifests[$manifest->identity()] = $manifest;

        if ($enabled) {
            try {
                $this->enable($manifest->packId, $manifest->packVersion);
            } catch (\Throwable $exception) {
                unset($this->manifests[$manifest->identity()]);

                throw $exception;
            }
        }
    }

    public function enable(string $packId, string $packVersion): void
    {
        $manifest = $this->manifest($packId, $packVersion);
        $candidateVersions = $this->enabledPackVersions;
        $candidateVersions[$packId] = $packVersion;
        $candidateResolvedVersions = $this->resolvedPackVersions;
        $candidateResolvedVersions[$packId] = $packVersion;

        $this->assertResolvedCatalog($candidateVersions);
        $this->resolvedDefinitions($candidateResolvedVersions);
        $this->enabledPackVersions = $candidateVersions;
        $this->resolvedPackVersions = $candidateResolvedVersions;
    }

    public function disable(string $packId): void
    {
        if (! isset($this->enabledPackVersions[$packId])) {
            throw new \DomainException("Block Pack {$packId} is not enabled.");
        }

        $candidateVersions = $this->enabledPackVersions;
        unset($candidateVersions[$packId]);
        $this->assertResolvedCatalog($candidateVersions);
        $this->enabledPackVersions = $candidateVersions;
    }

    public function retain(string $packId, string $packVersion): void
    {
        $this->manifest($packId, $packVersion);
        $candidateVersions = $this->resolvedPackVersions;
        $candidateVersions[$packId] = $packVersion;
        $this->resolvedDefinitions($candidateVersions);
        $this->resolvedPackVersions = $candidateVersions;
    }

    public function release(string $packId, string $packVersion): void
    {
        if (($this->enabledPackVersions[$packId] ?? null) === $packVersion) {
            throw new \DomainException('Enabled Block Packs must be disabled before releasing runtime resolution.');
        }
        if (($this->resolvedPackVersions[$packId] ?? null) === $packVersion) {
            unset($this->resolvedPackVersions[$packId]);
        }
    }

    public function unregister(string $packId, string $packVersion): void
    {
        if (($this->enabledPackVersions[$packId] ?? null) === $packVersion) {
            throw new \DomainException('Enabled Block Packs must be disabled before unregistering.');
        }
        if (($this->resolvedPackVersions[$packId] ?? null) === $packVersion) {
            throw new \DomainException('Resolved Block Packs must be released before unregistering.');
        }

        $identity = self::packIdentity($packId, $packVersion);
        if (! isset($this->manifests[$identity])) {
            throw new \DomainException("Block Pack {$identity} is not registered.");
        }

        unset($this->manifests[$identity]);
    }

    public function enabledVersion(string $packId): ?string
    {
        return $this->enabledPackVersions[$packId] ?? null;
    }

    public function resolvedVersion(string $packId): ?string
    {
        return $this->resolvedPackVersions[$packId] ?? null;
    }

    public function hasManifest(string $packId, string $packVersion): bool
    {
        return isset($this->manifests[self::packIdentity($packId, $packVersion)]);
    }

    public function definition(string $blockId, int $blockVersion): ?BlockDefinition
    {
        return $this->resolvedDefinitions($this->resolvedPackVersions)[$blockId.'@'.$blockVersion] ?? null;
    }

    /** @return array<string, BlockDefinition> */
    public function definitions(): array
    {
        return $this->resolvedCatalog($this->enabledPackVersions)['definitions'];
    }

    /** @return array<string, BlockPreset> */
    public function presets(): array
    {
        return $this->resolvedCatalog($this->enabledPackVersions)['presets'];
    }

    /** @return list<BlockPackManifest> */
    public function registeredManifests(): array
    {
        $manifests = $this->manifests;
        ksort($manifests);

        return array_values($manifests);
    }

    private function manifest(string $packId, string $packVersion): BlockPackManifest
    {
        $identity = self::packIdentity($packId, $packVersion);
        $manifest = $this->manifests[$identity] ?? null;

        if ($manifest === null) {
            throw new \DomainException("Block Pack {$identity} is not registered.");
        }

        return $manifest;
    }

    /** @param array<string, string> $enabledVersions */
    private function assertResolvedCatalog(array $enabledVersions): void
    {
        $this->resolvedCatalog($enabledVersions);
    }

    /**
     * @param  array<string, string>  $enabledVersions
     * @return array{definitions: array<string, BlockDefinition>, presets: array<string, BlockPreset>}
     */
    private function resolvedCatalog(array $enabledVersions): array
    {
        $definitions = $this->resolvedDefinitions($enabledVersions);
        $presets = [];

        foreach ($enabledVersions as $packId => $packVersion) {
            $manifest = $this->manifest($packId, $packVersion);
            foreach ($manifest->presets as $preset) {
                if (! isset($definitions[$preset->blockIdentity()])) {
                    throw new \DomainException("Block preset {$preset->identity()} references an unavailable definition.");
                }
                if (isset($presets[$preset->identity()])) {
                    throw new \DomainException("Block preset {$preset->identity()} is duplicated.");
                }
                $presets[$preset->identity()] = $preset;
            }
        }

        ksort($definitions);
        ksort($presets);

        return ['definitions' => $definitions, 'presets' => $presets];
    }

    /**
     * @param  array<string, string>  $versions
     * @return array<string, BlockDefinition>
     */
    private function resolvedDefinitions(array $versions): array
    {
        $definitions = [];
        ksort($versions);
        foreach ($versions as $packId => $packVersion) {
            $manifest = $this->manifest($packId, $packVersion);
            foreach ($manifest->blocks as $definition) {
                $identity = $definition->identity();
                if (isset($definitions[$identity])) {
                    throw new \DomainException("Block definition {$identity} is provided by multiple resolved Packs.");
                }
                $definitions[$identity] = $definition;
            }
        }
        ksort($definitions);

        return $definitions;
    }

    private static function packIdentity(string $packId, string $packVersion): string
    {
        return $packId.'@'.$packVersion;
    }
}
