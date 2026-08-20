<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Database\Eloquent\Collection;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\BlockPackRecord;

final class EloquentBlockPackRepository implements BlockPackRepository
{
    public function all(): array
    {
        /** @var Collection<int, BlockPackRecord> $records */
        $records = BlockPackRecord::query()->orderBy('pack_id')->orderByDesc('pack_version')->get();

        return array_values($records->map(fn (BlockPackRecord $record): BlockPackInstallation => $this->installation($record))->all());
    }

    public function find(string $packId, string $packVersion): ?BlockPackInstallation
    {
        /** @var BlockPackRecord|null $record */
        $record = BlockPackRecord::query()
            ->where('pack_id', $packId)
            ->where('pack_version', $packVersion)
            ->first();

        return $record instanceof BlockPackRecord ? $this->installation($record) : null;
    }

    public function enabled(string $packId): ?BlockPackInstallation
    {
        /** @var BlockPackRecord|null $record */
        $record = BlockPackRecord::query()
            ->where('pack_id', $packId)
            ->where('state', BlockPackState::Enabled->value)
            ->first();

        return $record instanceof BlockPackRecord ? $this->installation($record) : null;
    }

    public function save(BlockPackInstallation $installation): void
    {
        $identity = [
            'pack_id' => $installation->manifest->packId,
            'pack_version' => $installation->manifest->packVersion,
        ];
        $values = [
            'kind' => $installation->manifest->kind,
            'state' => $installation->state->value,
            'manifest_json' => json_encode(
                $installation->manifest->toArray(),
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
            ),
            'source' => $installation->source,
            'source_reference' => $installation->sourceReference,
            'source_uri' => $installation->sourceUri,
            'archive_sha256' => $installation->archiveSha256,
            'installed_at' => $installation->installedAt,
            'installed_by' => $installation->installedBy,
            'updated_at' => $installation->updatedAt,
        ];
        $query = BlockPackRecord::query()
            ->where('pack_id', $identity['pack_id'])
            ->where('pack_version', $identity['pack_version']);
        if ($query->exists()) {
            $query->update($values);

            return;
        }

        BlockPackRecord::query()->create([...$identity, ...$values]);
    }

    public function delete(string $packId, string $packVersion): void
    {
        BlockPackRecord::query()
            ->where('pack_id', $packId)
            ->where('pack_version', $packVersion)
            ->delete();
    }

    private function installation(BlockPackRecord $record): BlockPackInstallation
    {
        return new BlockPackInstallation(
            manifest: BlockPackManifest::fromJson($record->manifest_json),
            state: BlockPackState::from($record->state),
            source: $record->source,
            sourceReference: $record->source_reference,
            sourceUri: $record->source_uri,
            archiveSha256: $record->archive_sha256,
            installedAt: \DateTimeImmutable::createFromInterface($record->installed_at),
            installedBy: $record->installed_by,
            updatedAt: \DateTimeImmutable::createFromInterface($record->updated_at),
        );
    }
}
