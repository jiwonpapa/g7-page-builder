<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\SitePartNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSetSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SitePartRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SitePartRevisionRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SitePartSetRecord;

final class EloquentSitePartRepository implements SitePartRepository
{
    public function createSet(
        string $title,
        SitePartDocument $header,
        SitePartDocument $footer,
        ?int $actorId,
    ): SitePartSetSnapshot {
        return DB::transaction(function () use ($title, $header, $footer, $actorId): SitePartSetSnapshot {
            if ($header->kind !== 'header' || $footer->kind !== 'footer' || $header->locale !== $footer->locale) {
                throw new \InvalidArgumentException('Site Part set requires one Header and one Footer in the same locale.');
            }
            if (SitePartSetRecord::query()->where('locale', $header->locale)->where('title', $title)->exists()) {
                throw new \InvalidArgumentException('같은 이름의 헤더·푸터 세트가 이미 있습니다.');
            }

            $set = SitePartSetRecord::query()->create([
                'id' => $this->uuidV4(),
                'locale' => $header->locale,
                'title' => $title,
                'is_active' => ! SitePartSetRecord::query()->where('locale', $header->locale)->where('is_active', true)->exists(),
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
            $this->createPart($set->id, $title.' Header', $header, $actorId);
            $this->createPart($set->id, $title.' Footer', $footer, $actorId);

            return $this->setSnapshot($set);
        });
    }

    /** @return list<SitePartSetSnapshot> */
    public function listSets(string $locale): array
    {
        /** @var Collection<int, SitePartSetRecord> $sets */
        $sets = SitePartSetRecord::query()
            ->where('locale', $locale)
            ->orderBy('created_at')
            ->orderBy('title')
            ->get();

        return array_values($sets->map(fn (SitePartSetRecord $set): SitePartSetSnapshot => $this->setSnapshot($set))->all());
    }

    public function activateSet(string $setId, string $locale, ?int $actorId): SitePartSetSnapshot
    {
        return DB::transaction(function () use ($setId, $locale, $actorId): SitePartSetSnapshot {
            /** @var Collection<int, SitePartSetRecord> $sets */
            $sets = SitePartSetRecord::query()
                ->where('locale', $locale)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $set = $sets->first(fn (SitePartSetRecord $candidate): bool => $candidate->id === $setId);
            if (! $set instanceof SitePartSetRecord) {
                throw new SitePartNotFoundException('헤더·푸터 세트를 찾을 수 없습니다.');
            }
            $parts = SitePartRecord::query()->where('set_id', $set->id)->get()->keyBy('kind');
            $header = $parts->get('header');
            $footer = $parts->get('footer');
            if (! $header instanceof SitePartRecord || ! $footer instanceof SitePartRecord
                || $header->active_revision === null || $footer->active_revision === null) {
                throw new \InvalidArgumentException('Header와 Footer를 모두 발행한 뒤 사용할 수 있습니다.');
            }

            $updatedAt = new \DateTimeImmutable;
            SitePartSetRecord::query()->where('locale', $locale)->where('is_active', true)->update([
                'is_active' => false,
                'updated_by' => $actorId,
                'updated_at' => $updatedAt,
            ]);
            SitePartSetRecord::query()->whereKey($set->id)->update([
                'is_active' => true,
                'updated_by' => $actorId,
                'updated_at' => $updatedAt,
            ]);

            /** @var SitePartSetRecord|null $fresh */
            $fresh = SitePartSetRecord::query()->find($set->id);

            return $this->setSnapshot($fresh ?? throw new \RuntimeException('Activated Site Part set is missing.'));
        });
    }

    public function saveSetDraft(
        string $setId,
        string $headerTitle,
        SitePartDocument $header,
        int $headerExpectedLockVersion,
        string $footerTitle,
        SitePartDocument $footer,
        int $footerExpectedLockVersion,
        ?int $actorId,
    ): SitePartSetSnapshot {
        return DB::transaction(function () use ($setId, $headerTitle, $header, $headerExpectedLockVersion, $footerTitle, $footer, $footerExpectedLockVersion, $actorId): SitePartSetSnapshot {
            if ($header->kind !== 'header' || $footer->kind !== 'footer' || $header->locale !== $footer->locale) {
                throw new \InvalidArgumentException('Site Part set requires one Header and one Footer in the same locale.');
            }
            $this->saveDraft($headerTitle, $header, $headerExpectedLockVersion, $actorId);
            $this->saveDraft($footerTitle, $footer, $footerExpectedLockVersion, $actorId);
            /** @var SitePartSetRecord|null $set */
            $set = SitePartSetRecord::query()->whereKey($setId)->lockForUpdate()->first();
            if (! $set instanceof SitePartSetRecord) {
                throw new SitePartNotFoundException('헤더·푸터 세트를 찾을 수 없습니다.');
            }

            return $this->setSnapshot($set);
        });
    }

    public function publishSet(
        string $setId,
        int $headerExpectedLockVersion,
        int $footerExpectedLockVersion,
        ?int $actorId,
    ): SitePartSetSnapshot {
        return DB::transaction(function () use ($setId, $headerExpectedLockVersion, $footerExpectedLockVersion, $actorId): SitePartSetSnapshot {
            /** @var Collection<int, SitePartRecord> $parts */
            $parts = SitePartRecord::query()->where('set_id', $setId)->orderBy('kind')->lockForUpdate()->get()->keyBy('kind');
            $header = $parts->get('header');
            $footer = $parts->get('footer');
            if (! $header instanceof SitePartRecord || ! $footer instanceof SitePartRecord) {
                throw new SitePartNotFoundException('헤더·푸터 세트를 찾을 수 없습니다.');
            }
            $this->assertLock($header, $headerExpectedLockVersion);
            $this->assertLock($footer, $footerExpectedLockVersion);
            $updatedAt = new \DateTimeImmutable;
            foreach ([$header, $footer] as $record) {
                if ($record->active_revision === $record->current_revision) {
                    continue;
                }
                $record->fill([
                    'active_revision' => $record->current_revision,
                    'lock_version' => $record->lock_version + 1,
                    'published_at' => $updatedAt,
                    'updated_by' => $actorId,
                ])->save();
            }
            /** @var SitePartSetRecord|null $set */
            $set = SitePartSetRecord::query()->whereKey($setId)->first();

            return $this->setSnapshot($set ?? throw new SitePartNotFoundException('헤더·푸터 세트를 찾을 수 없습니다.'));
        });
    }

    public function find(string $kind, string $locale, ?string $setId = null): ?SitePartSnapshot
    {
        $resolvedSetId = $setId ?? $this->resolvedSetId($locale);
        if ($resolvedSetId === null) {
            return null;
        }

        /** @var SitePartRecord|null $record */
        $record = SitePartRecord::query()
            ->where('set_id', $resolvedSetId)
            ->where('kind', $kind)
            ->where('locale', $locale)
            ->first();

        return $record instanceof SitePartRecord ? $this->snapshot($record) : null;
    }

    public function findPublished(string $kind, string $locale): ?SitePartSnapshot
    {
        $setId = SitePartSetRecord::query()
            ->where('locale', $locale)
            ->where('is_active', true)
            ->value('id');
        if (! is_string($setId)) {
            return null;
        }

        /** @var SitePartRecord|null $record */
        $record = SitePartRecord::query()
            ->where('set_id', $setId)
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
            setId: $record->set_id,
        );
    }

    private function resolvedSetId(string $locale): ?string
    {
        $active = SitePartSetRecord::query()
            ->where('locale', $locale)
            ->where('is_active', true)
            ->value('id');
        if (is_string($active)) {
            return $active;
        }
        $first = SitePartSetRecord::query()->where('locale', $locale)->oldest()->value('id');

        return is_string($first) ? $first : null;
    }

    private function createPart(
        string $setId,
        string $title,
        SitePartDocument $document,
        ?int $actorId,
    ): SitePartRecord {
        $record = SitePartRecord::query()->create([
            'id' => $document->sitePartId,
            'set_id' => $setId,
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

        return $record;
    }

    private function setSnapshot(SitePartSetRecord $set): SitePartSetSnapshot
    {
        $header = $this->find('header', $set->locale, $set->id);
        $footer = $this->find('footer', $set->locale, $set->id);
        if ($header === null || $footer === null) {
            throw new \RuntimeException('Site Part set is incomplete.');
        }

        return new SitePartSetSnapshot(
            id: $set->id,
            title: $set->title,
            locale: $set->locale,
            isActive: $set->is_active,
            header: $header,
            footer: $footer,
            createdAt: \DateTimeImmutable::createFromInterface($set->created_at),
            updatedAt: \DateTimeImmutable::createFromInterface($set->updated_at),
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
