<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageSeoMetadata;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\DocumentNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\PublicationCommitException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\RevisionNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\SlugAlreadyExistsException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PreviewSource;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\RenderedPage;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\DocumentRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PreviewTokenRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PublicationRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\RevisionRecord;

final class EloquentPageBuilderRepository implements PageBuilderRepository
{
    public function create(string $title, PageBuilderDocument $document, ?int $actorId): DocumentSnapshot
    {
        return DB::transaction(function () use ($title, $document, $actorId): DocumentSnapshot {
            if (DocumentRecord::query()->where('slug', $document->slug)->exists()) {
                throw new SlugAlreadyExistsException('The page slug is already in use.');
            }

            $record = DocumentRecord::query()->create([
                'id' => $document->documentId,
                'slug' => $document->slug,
                'title' => $title,
                'mode' => 'canvas',
                'locale' => $document->locale,
                'lock_version' => 1,
                'current_revision' => 1,
                'is_home' => false,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $this->insertRevision($document, $title, 1, $actorId);

            return $this->snapshot($record);
        });
    }

    public function paginate(int $page, int $perPage, string $status = 'active'): array
    {
        $query = DocumentRecord::query()->orderByDesc('updated_at')->orderBy('id');
        if ($status === 'active') {
            $query->whereNull('archived_at');
        } elseif ($status === 'archived') {
            $query->whereNotNull('archived_at');
        } elseif ($status !== 'all') {
            throw new \InvalidArgumentException('Document status filter is invalid.');
        }
        $total = (clone $query)->count();
        /** @var Collection<int, DocumentRecord> $records */
        $records = $query->forPage($page, $perPage)->get();

        return [
            'items' => array_values($records->map(fn (DocumentRecord $record): DocumentSnapshot => $this->snapshot($record))->all()),
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    public function find(string $documentId): ?DocumentSnapshot
    {
        /** @var DocumentRecord|null $record */
        $record = DocumentRecord::query()->find($documentId);

        return $record instanceof DocumentRecord ? $this->snapshot($record) : null;
    }

    public function listRevisions(string $documentId, int $limit): array
    {
        /** @var Collection<int, RevisionRecord> $records */
        $records = RevisionRecord::query()
            ->where('document_id', $documentId)
            ->orderByDesc('revision')
            ->limit($limit)
            ->get();

        return array_values($records->map(fn (RevisionRecord $record): DocumentRevision => $this->revision($record))->all());
    }

    public function findRevision(string $documentId, int $revision): ?DocumentRevision
    {
        /** @var RevisionRecord|null $record */
        $record = RevisionRecord::query()
            ->where('document_id', $documentId)
            ->where('revision', $revision)
            ->first();

        return $record instanceof RevisionRecord ? $this->revision($record) : null;
    }

    public function restoreRevision(
        string $documentId,
        int $revision,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return DB::transaction(function () use ($documentId, $revision, $expectedLockVersion, $actorId): DocumentSnapshot {
            $record = $this->lockDocument($documentId);
            $this->assertLockVersion($record, $expectedLockVersion);
            /** @var RevisionRecord|null $sourceRecord */
            $sourceRecord = RevisionRecord::query()
                ->where('document_id', $documentId)
                ->where('revision', $revision)
                ->first();

            if (! $sourceRecord instanceof RevisionRecord) {
                throw new RevisionNotFoundException('Page document revision was not found.');
            }

            $source = $this->decodeDocument($sourceRecord->document_json);
            $sourceTitle = is_string($sourceRecord->title) && trim($sourceRecord->title) !== ''
                ? $sourceRecord->title
                : $record->title;
            $this->assertSlugAvailable($source->slug, $documentId);
            $nextRevision = $record->current_revision + 1;
            $this->insertRevision($source, $sourceTitle, $nextRevision, $actorId);

            $record->fill([
                'title' => $sourceTitle,
                'slug' => $source->slug,
                'mode' => 'canvas',
                'locale' => $source->locale,
                'lock_version' => $record->lock_version + 1,
                'current_revision' => $nextRevision,
                'updated_by' => $actorId,
            ])->save();

            /** @var DocumentRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Restored page document is missing.'));
        });
    }

    public function saveDraft(
        PageBuilderDocument $document,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return DB::transaction(function () use ($document, $expectedLockVersion, $actorId): DocumentSnapshot {
            $record = $this->lockDocument($document->documentId);
            $this->assertLockVersion($record, $expectedLockVersion);
            $this->assertSlugAvailable($document->slug, $document->documentId);

            // The visual editor deliberately does not own SEO fields. Preserve
            // metadata configured in the manager when an editor round-trip omits it.
            if ($document->seo === null) {
                $current = $this->loadDocument($record);
                if ($current->seo instanceof PageSeoMetadata) {
                    $document = PageBuilderDocument::fromArray([
                        ...$document->toArray(),
                        'seo' => $current->seo->toArray(),
                    ]);
                }
            }

            $nextRevision = $record->current_revision + 1;
            $this->insertRevision($document, $record->title, $nextRevision, $actorId);

            $record->fill([
                'slug' => $document->slug,
                'mode' => 'canvas',
                'locale' => $document->locale,
                'lock_version' => $record->lock_version + 1,
                'current_revision' => $nextRevision,
                'updated_by' => $actorId,
            ])->save();

            /** @var DocumentRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Saved page document is missing.'));
        });
    }

    public function updateMetadata(
        string $documentId,
        string $title,
        string $slug,
        string $locale,
        int $expectedLockVersion,
        ?int $actorId,
        ?string $shellMode = null,
        ?PageSeoMetadata $seo = null,
    ): DocumentSnapshot {
        return DB::transaction(function () use ($documentId, $title, $slug, $locale, $expectedLockVersion, $actorId, $shellMode, $seo): DocumentSnapshot {
            $record = $this->lockDocument($documentId);
            $this->assertLockVersion($record, $expectedLockVersion);
            $this->assertSlugAvailable($slug, $documentId);
            $current = $this->loadDocument($record);
            $next = new PageBuilderDocument(
                documentId: $current->documentId,
                slug: $slug,
                mode: 'canvas',
                locale: $locale,
                tokens: $current->tokens,
                blocks: $current->blocks,
                schemaVersion: $current->schemaVersion,
                shellMode: $shellMode ?? $current->shellMode,
                seo: $seo ?? $current->seo,
            );
            $nextRevision = $record->current_revision + 1;
            $this->insertRevision($next, $title, $nextRevision, $actorId);

            $record->fill([
                'title' => $title,
                'slug' => $slug,
                'locale' => $locale,
                'lock_version' => $record->lock_version + 1,
                'current_revision' => $nextRevision,
                'updated_by' => $actorId,
            ])->save();

            /** @var DocumentRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Saved page document is missing.'));
        });
    }

    public function storePreviewToken(
        string $documentId,
        int $revision,
        string $tokenHash,
        \DateTimeImmutable $expiresAt,
        ?int $actorId,
    ): void {
        DB::transaction(function () use ($documentId, $revision, $tokenHash, $expiresAt, $actorId): void {
            $this->lockDocument($documentId);

            if (! RevisionRecord::query()
                ->where('document_id', $documentId)
                ->where('revision', $revision)
                ->exists()) {
                throw new RevisionNotFoundException('Page document revision was not found.');
            }

            PreviewTokenRecord::query()->create([
                'token_hash' => $tokenHash,
                'document_id' => $documentId,
                'revision' => $revision,
                'expires_at' => $expiresAt,
                'created_by' => $actorId,
                'created_at' => new \DateTimeImmutable,
            ]);
        });
    }

    public function findPreviewSource(string $tokenHash, \DateTimeImmutable $now): ?PreviewSource
    {
        /** @var PreviewTokenRecord|null $token */
        $token = PreviewTokenRecord::query()->whereKey($tokenHash)->first();

        if (! $token instanceof PreviewTokenRecord || $token->expires_at->getTimestamp() <= $now->getTimestamp()) {
            return null;
        }

        /** @var DocumentRecord|null $record */
        $record = DocumentRecord::query()->find($token->document_id);
        /** @var RevisionRecord|null $revision */
        $revision = RevisionRecord::query()
            ->where('document_id', $token->document_id)
            ->where('revision', $token->revision)
            ->first();

        if (! $record instanceof DocumentRecord || ! $revision instanceof RevisionRecord) {
            return null;
        }

        return new PreviewSource(
            title: is_string($revision->title) && trim($revision->title) !== ''
                ? $revision->title
                : $record->title,
            document: $this->decodeDocument($revision->document_json),
            revision: $revision->revision,
        );
    }

    public function storePublicationCandidate(
        CompileResult $result,
        int $expectedLockVersion,
        string $tokenHash,
        \DateTimeImmutable $expiresAt,
        ?int $actorId,
    ): void {
        DB::transaction(function () use ($result, $expectedLockVersion, $tokenHash, $expiresAt, $actorId): void {
            $record = $this->lockDocument($result->documentId);
            $this->assertLockVersion($record, $expectedLockVersion);

            if ($record->current_revision !== $result->sourceRevision || ! is_string($result->artifact)) {
                throw new LockConflictException($record->lock_version);
            }

            $this->assertActiveSlugAvailable($record->slug, $record->id);
            $document = $this->loadDocument($record);

            PublicationRecord::query()->create([
                'id' => $this->uuidV4(),
                'document_id' => $result->documentId,
                'source_revision' => $result->sourceRevision,
                'prepared_lock_version' => $expectedLockVersion,
                'title' => $record->title,
                'slug' => $record->slug,
                'locale' => $record->locale,
                'shell_mode' => $document->shellMode,
                'compiler_version' => $result->compilerVersion,
                'target_engine_version' => $result->targetEngineVersion,
                'artifact' => $result->artifact,
                'artifact_sha256' => $result->artifactSha256,
                'warnings_json' => $this->encodeJson($result->warnings),
                'seo_json' => $document->seo?->toArray(),
                'status' => 'candidate',
                'token_hash' => $tokenHash,
                'expires_at' => $expiresAt,
                'created_by' => $actorId,
                'created_at' => new \DateTimeImmutable,
            ]);
        });
    }

    public function commitPublication(string $tokenHash, \DateTimeImmutable $now): RenderedPage
    {
        return DB::transaction(function () use ($tokenHash, $now): RenderedPage {
            /** @var PublicationRecord|null $publication */
            $publication = PublicationRecord::query()
                ->where('token_hash', $tokenHash)
                ->lockForUpdate()
                ->first();

            if (! $publication instanceof PublicationRecord || $publication->status !== 'candidate') {
                throw new PublicationCommitException('Publication candidate was not found.');
            }

            if ($publication->expires_at === null || $publication->expires_at->getTimestamp() <= $now->getTimestamp()) {
                throw new PublicationCommitException('Publication candidate has expired.');
            }

            $record = $this->lockDocument($publication->document_id);

            if (
                $record->current_revision !== $publication->source_revision
                || $publication->prepared_lock_version === null
                || $record->lock_version !== $publication->prepared_lock_version
            ) {
                throw new LockConflictException($record->lock_version);
            }

            $this->assertActiveSlugAvailable($publication->slug, $publication->document_id);

            if (is_string($record->active_publication_id) && $record->active_publication_id !== '') {
                PublicationRecord::query()
                    ->whereKey($record->active_publication_id)
                    ->where('status', 'active')
                    ->update(['status' => 'superseded']);
            }

            $publication->status = 'active';
            $publication->published_at = $now;
            $publication->save();

            $record->active_publication_id = $publication->id;
            $record->save();

            return $this->renderedPage($record, $publication);
        });
    }

    public function unpublish(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return DB::transaction(function () use ($documentId, $expectedLockVersion, $actorId): DocumentSnapshot {
            $record = $this->lockDocument($documentId);
            $this->assertLockVersion($record, $expectedLockVersion);

            if (! is_string($record->active_publication_id) || $record->active_publication_id === '') {
                return $this->snapshot($record);
            }

            PublicationRecord::query()
                ->whereKey($record->active_publication_id)
                ->where('status', 'active')
                ->update(['status' => 'superseded']);

            $record->fill([
                'active_publication_id' => null,
                'is_home' => false,
                'lock_version' => $record->lock_version + 1,
                'updated_by' => $actorId,
            ])->save();

            /** @var DocumentRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Unpublished page document is missing.'));
        });
    }

    public function archive(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return DB::transaction(function () use ($documentId, $expectedLockVersion, $actorId): DocumentSnapshot {
            $record = $this->lockDocument($documentId);
            $this->assertLockVersion($record, $expectedLockVersion);

            if ($record->archived_at !== null) {
                return $this->snapshot($record);
            }

            if (is_string($record->active_publication_id) && $record->active_publication_id !== '') {
                PublicationRecord::query()
                    ->whereKey($record->active_publication_id)
                    ->where('status', 'active')
                    ->update(['status' => 'superseded']);
            }

            $record->fill([
                'active_publication_id' => null,
                'is_home' => false,
                'archived_at' => new \DateTimeImmutable,
                'lock_version' => $record->lock_version + 1,
                'updated_by' => $actorId,
            ])->save();

            /** @var DocumentRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Archived page document is missing.'));
        });
    }

    public function restoreArchived(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return DB::transaction(function () use ($documentId, $expectedLockVersion, $actorId): DocumentSnapshot {
            $record = $this->lockDocument($documentId);
            $this->assertLockVersion($record, $expectedLockVersion);

            if ($record->archived_at === null) {
                return $this->snapshot($record);
            }

            $record->fill([
                'archived_at' => null,
                'lock_version' => $record->lock_version + 1,
                'updated_by' => $actorId,
            ])->save();

            /** @var DocumentRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Restored page document is missing.'));
        });
    }

    public function purge(
        string $documentId,
        int $expectedLockVersion,
        string $confirmationSlug,
    ): void {
        DB::transaction(function () use ($documentId, $expectedLockVersion, $confirmationSlug): void {
            $record = $this->lockDocument($documentId);
            $this->assertLockVersion($record, $expectedLockVersion);

            if ($record->archived_at === null) {
                throw new \DomainException('Only an archived page document can be permanently deleted.');
            }
            if (! hash_equals($record->slug, trim($confirmationSlug))) {
                throw new \DomainException('The confirmation slug does not match the page document.');
            }
            if (is_string($record->active_publication_id) && $record->active_publication_id !== '') {
                throw new \DomainException('A published page document cannot be permanently deleted.');
            }

            $record->delete();
        });
    }

    public function findPublishedBySlug(string $slug): ?RenderedPage
    {
        /** @var PublicationRecord|null $publication */
        $publication = PublicationRecord::query()
            ->where('status', 'active')
            ->where('slug', $slug)
            ->first();

        if (! $publication instanceof PublicationRecord) {
            return null;
        }

        /** @var DocumentRecord|null $record */
        $record = DocumentRecord::query()->find($publication->document_id);

        if (! $record instanceof DocumentRecord || $record->active_publication_id !== $publication->id) {
            return null;
        }

        return $this->renderedPage($record, $publication);
    }

    public function setHome(
        string $documentId,
        bool $enabled,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return DB::transaction(function () use ($documentId, $enabled, $expectedLockVersion, $actorId): DocumentSnapshot {
            /**
             * 홈 지정은 모든 문서를 같은 순서로 잠가 동시에 두 홈이 생기는 것을 막습니다.
             * 문서 수가 작은 관리자 작업에만 실행되는 의도적인 직렬화입니다.
             *
             * @var Collection<int, DocumentRecord> $documents
             */
            $documents = DocumentRecord::query()
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $record = $documents->firstWhere('id', $documentId);

            if (! $record instanceof DocumentRecord) {
                throw new DocumentNotFoundException('The page document was not found.');
            }

            $this->assertLockVersion($record, $expectedLockVersion);

            if ($enabled && (! is_string($record->active_publication_id) || $record->active_publication_id === '')) {
                throw new PublicationCommitException('Only a published page can be assigned as the home page.');
            }

            if ((bool) $record->is_home === $enabled) {
                return $this->snapshot($record);
            }

            if ($enabled) {
                $previousHomes = $documents->filter(
                    static fn (DocumentRecord $document): bool => $document->id !== $documentId
                        && (bool) $document->is_home,
                );

                foreach ($previousHomes as $previousHome) {
                    $previousHome->fill([
                        'is_home' => false,
                        'lock_version' => $previousHome->lock_version + 1,
                        'updated_by' => $actorId,
                    ])->save();
                }
            }

            $record->fill([
                'is_home' => $enabled,
                'lock_version' => $record->lock_version + 1,
                'updated_by' => $actorId,
            ])->save();

            /** @var DocumentRecord|null $fresh */
            $fresh = $record->fresh();

            return $this->snapshot($fresh ?? throw new \RuntimeException('Home page document is missing.'));
        });
    }

    public function findPublishedHome(): ?RenderedPage
    {
        /** @var DocumentRecord|null $record */
        $record = DocumentRecord::query()->where('is_home', true)->first();

        if (! $record instanceof DocumentRecord || ! is_string($record->active_publication_id)) {
            return null;
        }

        /** @var PublicationRecord|null $publication */
        $publication = PublicationRecord::query()
            ->whereKey($record->active_publication_id)
            ->where('status', 'active')
            ->first();

        return $publication instanceof PublicationRecord
            ? $this->renderedPage($record, $publication)
            : null;
    }

    private function snapshot(DocumentRecord $record): DocumentSnapshot
    {
        $artifactHash = null;
        $activePublicSlug = null;
        $publishedAt = null;
        $publishedRevision = null;

        if (is_string($record->active_publication_id) && $record->active_publication_id !== '') {
            /** @var PublicationRecord|null $publication */
            $publication = PublicationRecord::query()
                ->whereKey($record->active_publication_id)
                ->where('status', 'active')
                ->first();

            if ($publication instanceof PublicationRecord) {
                $artifactHash = $publication->artifact_sha256;
                $activePublicSlug = $publication->slug;
                $publishedAt = $publication->published_at;
                $publishedRevision = $publication->source_revision;
            }
        }

        return new DocumentSnapshot(
            document: $this->loadDocument($record),
            title: $record->title,
            lockVersion: $record->lock_version,
            revision: $record->current_revision,
            activeArtifactSha256: is_string($artifactHash) ? $artifactHash : null,
            activePublicSlug: is_string($activePublicSlug) ? $activePublicSlug : null,
            isHome: (bool) $record->is_home,
            createdAt: \DateTimeImmutable::createFromInterface($record->created_at),
            updatedAt: \DateTimeImmutable::createFromInterface($record->updated_at),
            publishedAt: $publishedAt instanceof \DateTimeInterface
                ? \DateTimeImmutable::createFromInterface($publishedAt)
                : null,
            archivedAt: $record->archived_at instanceof \DateTimeInterface
                ? \DateTimeImmutable::createFromInterface($record->archived_at)
                : null,
            hasUnpublishedChanges: is_int($publishedRevision) && $publishedRevision !== $record->current_revision,
        );
    }

    private function revision(RevisionRecord $record): DocumentRevision
    {
        return new DocumentRevision(
            document: $this->decodeDocument($record->document_json),
            title: is_string($record->title) && trim($record->title) !== '' ? $record->title : '',
            revision: $record->revision,
            schemaVersion: $record->schema_version,
            authorId: $record->author_id,
            createdAt: \DateTimeImmutable::createFromInterface($record->created_at),
        );
    }

    private function loadDocument(DocumentRecord $record): PageBuilderDocument
    {
        /** @var RevisionRecord|null $revision */
        $revision = RevisionRecord::query()
            ->where('document_id', $record->id)
            ->where('revision', $record->current_revision)
            ->first();

        if (! $revision instanceof RevisionRecord) {
            throw new \RuntimeException('Current page revision is missing.');
        }

        return $this->decodeDocument($revision->document_json);
    }

    private function lockDocument(string $documentId): DocumentRecord
    {
        /** @var DocumentRecord|null $record */
        $record = DocumentRecord::query()->whereKey($documentId)->lockForUpdate()->first();

        if (! $record instanceof DocumentRecord) {
            throw new DocumentNotFoundException('Page document was not found.');
        }

        return $record;
    }

    private function assertLockVersion(DocumentRecord $record, int $expectedLockVersion): void
    {
        if ($record->lock_version !== $expectedLockVersion) {
            throw new LockConflictException($record->lock_version);
        }
    }

    private function assertSlugAvailable(string $slug, string $exceptDocumentId): void
    {
        if (DocumentRecord::query()
            ->where('slug', $slug)
            ->whereKeyNot($exceptDocumentId)
            ->exists()) {
            throw new SlugAlreadyExistsException('The page slug is already in use.');
        }
    }

    private function assertActiveSlugAvailable(string $slug, string $exceptDocumentId): void
    {
        if (PublicationRecord::query()
            ->where('status', 'active')
            ->where('slug', $slug)
            ->where('document_id', '!=', $exceptDocumentId)
            ->exists()) {
            throw new SlugAlreadyExistsException('The public page slug is already in use.');
        }
    }

    private function insertRevision(
        PageBuilderDocument $document,
        string $title,
        int $revision,
        ?int $actorId,
    ): void {
        RevisionRecord::query()->create([
            'id' => $this->uuidV4(),
            'document_id' => $document->documentId,
            'revision' => $revision,
            'schema_version' => $document->schemaVersion,
            'title' => $title,
            'document_json' => $this->encodeJson($document->toArray()),
            'author_id' => $actorId,
            'created_at' => new \DateTimeImmutable,
        ]);
    }

    private function decodeDocument(string $json): PageBuilderDocument
    {
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($data)) {
            throw new \RuntimeException('Stored page document JSON is invalid.');
        }

        return PageBuilderDocument::fromArray($data);
    }

    private function renderedPage(DocumentRecord $record, PublicationRecord $publication): RenderedPage
    {
        $publishedAt = $publication->published_at;

        return new RenderedPage(
            title: $publication->title,
            slug: $publication->slug,
            locale: $publication->locale,
            artifact: $publication->artifact,
            artifactSha256: $publication->artifact_sha256,
            publishedAt: $publishedAt instanceof \DateTimeInterface
                ? \DateTimeImmutable::createFromInterface($publishedAt)
                : null,
            shellMode: $publication->shell_mode,
            seo: is_array($publication->seo_json)
                ? PageSeoMetadata::fromArray($publication->seo_json)
                : null,
        );
    }

    private function encodeJson(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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
