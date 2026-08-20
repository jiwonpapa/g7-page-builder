<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\SitePartNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SitePartRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SitePartRevisionRecord;

final class EloquentSitePartRepository implements SitePartRepository
{
    public function create(string $title, SitePartDocument $document, ?int $actorId): SitePartSnapshot
    {
        return DB::transaction(function () use ($title, $document, $actorId): SitePartSnapshot {
            if (SitePartRecord::query()
                ->where('kind', $document->kind)
                ->where('locale', $document->locale)
                ->exists()) {
                throw new \InvalidArgumentException('Site Part already exists for this kind and locale.');
            }

            $record = SitePartRecord::query()->create([
                'id' => $document->sitePartId,
                'kind' => $document->kind,
                'locale' => $document->locale,
                'title' => $title,
                'lock_version' => 1,
                'current_revision' => 1,
                'active_revision' => null,
                'published_at' => null,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
            $this->insertRevision($document, $title, 1, $actorId);

            return $this->snapshot($record);
        });
    }

    public function find(string $kind, string $locale): ?SitePartSnapshot
    {
        /** @var SitePartRecord|null $record */
        $record = SitePartRecord::query()
            ->where('kind', $kind)
            ->where('locale', $locale)
            ->first();

        return $record instanceof SitePartRecord ? $this->snapshot($record) : null;
    }

    public function findPublished(string $kind, string $locale): ?SitePartSnapshot
    {
        /** @var SitePartRecord|null $record */
        $record = SitePartRecord::query()
            ->where('kind', $kind)
            ->where('locale', $locale)
            ->whereNotNull('active_revision')
            ->first();
        if (! $record instanceof SitePartRecord || $record->active_revision === null) {
            return null;
        }

        return $this->snapshot($record, $record->active_revision);
    }

    public function listRevisions(string $sitePartId, int $limit): array
    {
        /** @var Collection<int, SitePartRevisionRecord> $records */
        $records = SitePartRevisionRecord::query()
            ->where('site_part_id', $sitePartId)
            ->orderByDesc('revision')
            ->limit($limit)
            ->get();

        return array_values($records->map(fn (SitePartRevisionRecord $record): SitePartRevision => $this->revision($record))->all());
    }

    public function saveDraft(
        string $title,
        SitePartDocument $document,
        int $expectedLockVersion,
        ?int $actorId,
    ): SitePartSnapshot {
        return DB::transaction(function () use ($title, $document, $expectedLockVersion, $actorId): SitePartSnapshot {
            $record = $this->lock($document->sitePartId);
            $this->assertLock($record, $expectedLockVersion);
            if ($record->kind !== $document->kind || $record->locale !== $document->locale) {
                throw new \InvalidArgumentException('Site Part identity cannot be changed.');
            }

            $nextRevision = $record->current_revision + 1;
            $this->insertRevision($document, $title, $nextRevision, $actorId);
            $record->fill([
                'title' => $title,
                'lock_version' => $record->lock_version + 1,
                'current_revision' => $nextRevision,
                'updated_by' => $actorId,
            ])->save();

            /** @var SitePartRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Saved Site Part is missing.'));
        });
    }

    public function publish(string $sitePartId, int $expectedLockVersion, ?int $actorId): SitePartSnapshot
    {
        return DB::transaction(function () use ($sitePartId, $expectedLockVersion, $actorId): SitePartSnapshot {
            $record = $this->lock($sitePartId);
            $this->assertLock($record, $expectedLockVersion);
            if ($record->active_revision === $record->current_revision) {
                return $this->snapshot($record);
            }

            $record->fill([
                'active_revision' => $record->current_revision,
                'lock_version' => $record->lock_version + 1,
                'published_at' => new \DateTimeImmutable,
                'updated_by' => $actorId,
            ])->save();

            /** @var SitePartRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Published Site Part is missing.'));
        });
    }

    private function lock(string $sitePartId): SitePartRecord
    {
        /** @var SitePartRecord|null $record */
        $record = SitePartRecord::query()->whereKey($sitePartId)->lockForUpdate()->first();

        return $record instanceof SitePartRecord
            ? $record
            : throw new SitePartNotFoundException('Site Part was not found.');
    }

    private function assertLock(SitePartRecord $record, int $expectedLockVersion): void
    {
        if ($record->lock_version !== $expectedLockVersion) {
            throw new LockConflictException($record->lock_version);
        }
    }

    private function snapshot(SitePartRecord $record, ?int $revisionNumber = null): SitePartSnapshot
    {
        $revisionNumber ??= $record->current_revision;
        /** @var SitePartRevisionRecord|null $revision */
        $revision = SitePartRevisionRecord::query()
            ->where('site_part_id', $record->id)
            ->where('revision', $revisionNumber)
            ->first();
        if (! $revision instanceof SitePartRevisionRecord) {
            throw new \RuntimeException('Current Site Part revision is missing.');
        }

        return new SitePartSnapshot(
            document: $this->decode($revision->document_json),
            title: $revision->title,
            lockVersion: $record->lock_version,
            revision: $revisionNumber,
            activeRevision: $record->active_revision,
            createdAt: \DateTimeImmutable::createFromInterface($record->created_at),
            updatedAt: \DateTimeImmutable::createFromInterface($record->updated_at),
            publishedAt: $record->published_at === null
                ? null
                : \DateTimeImmutable::createFromInterface($record->published_at),
        );
    }

    private function revision(SitePartRevisionRecord $record): SitePartRevision
    {
        return new SitePartRevision(
            document: $this->decode($record->document_json),
            title: $record->title,
            revision: $record->revision,
            authorId: $record->author_id,
            createdAt: \DateTimeImmutable::createFromInterface($record->created_at),
        );
    }

    private function insertRevision(
        SitePartDocument $document,
        string $title,
        int $revision,
        ?int $actorId,
    ): void {
        SitePartRevisionRecord::query()->create([
            'id' => $this->uuidV4(),
            'site_part_id' => $document->sitePartId,
            'revision' => $revision,
            'schema_version' => $document->schemaVersion,
            'title' => $title,
            'document_json' => json_encode(
                $document->toArray(),
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
            ),
            'author_id' => $actorId,
        ]);
    }

    private function decode(string $json): SitePartDocument
    {
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($data)) {
            throw new \RuntimeException('Stored Site Part JSON is invalid.');
        }

        return SitePartDocument::fromArray($data);
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20),
        );
    }
}
