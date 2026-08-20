<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final readonly class BlockPackInstallation
{
    public function __construct(
        public BlockPackManifest $manifest,
        public BlockPackState $state,
        public string $source,
        public string $sourceReference,
        public ?string $sourceUri,
        public ?string $archiveSha256,
        public \DateTimeImmutable $installedAt,
        public ?int $installedBy,
        public \DateTimeImmutable $updatedAt,
    ) {
        if (! in_array($this->source, ['builtin', 'local', 'github', 'store'], true)) {
            throw new \InvalidArgumentException('Block Pack installation source is invalid.');
        }
        if ($this->sourceReference === '' || strlen($this->sourceReference) > 512) {
            throw new \InvalidArgumentException('Block Pack source reference is invalid.');
        }
        if ($this->sourceUri !== null && (strlen($this->sourceUri) > 1000 || filter_var($this->sourceUri, FILTER_VALIDATE_URL) === false)) {
            throw new \InvalidArgumentException('Block Pack source URI is invalid.');
        }
        if ($this->source === 'github' && $this->sourceUri === null) {
            throw new \InvalidArgumentException('GitHub Block Packs require a source URI.');
        }
        if ($this->source === 'builtin' && $this->archiveSha256 !== null) {
            throw new \InvalidArgumentException('Builtin Block Packs do not use archive digests.');
        }
        if ($this->source !== 'builtin') {
            if ($this->archiveSha256 === null) {
                throw new \InvalidArgumentException('External Block Packs require an archive digest.');
            }
            BlockPackRules::assertSha256($this->archiveSha256, 'archive digest');
        }
    }

    public function withState(BlockPackState $state, \DateTimeImmutable $updatedAt): self
    {
        if (! $this->state->canTransitionTo($state)) {
            throw new \DomainException("Block Pack cannot transition from {$this->state->value} to {$state->value}.");
        }

        return new self(
            manifest: $this->manifest,
            state: $state,
            source: $this->source,
            sourceReference: $this->sourceReference,
            sourceUri: $this->sourceUri,
            archiveSha256: $this->archiveSha256,
            installedAt: $this->installedAt,
            installedBy: $this->installedBy,
            updatedAt: $updatedAt,
        );
    }
}
