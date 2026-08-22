<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageSeoMetadata;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PreviewSource;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\RenderedPage;

interface PageBuilderRepository
{
    public function create(string $title, PageBuilderDocument $document, ?int $actorId): DocumentSnapshot;

    /**
     * @return array{items: list<DocumentSnapshot>, total: int, page: int, per_page: int}
     */
    public function paginate(int $page, int $perPage, string $status = 'active'): array;

    public function find(string $documentId): ?DocumentSnapshot;

    /** @return list<DocumentRevision> */
    public function listRevisions(string $documentId, int $limit): array;

    public function findRevision(string $documentId, int $revision): ?DocumentRevision;

    public function restoreRevision(
        string $documentId,
        int $revision,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot;

    public function saveDraft(
        PageBuilderDocument $document,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot;

    public function updateMetadata(
        string $documentId,
        string $title,
        string $slug,
        string $locale,
        int $expectedLockVersion,
        ?int $actorId,
        ?string $shellMode = null,
        ?PageSeoMetadata $seo = null,
    ): DocumentSnapshot;

    public function storePreviewToken(
        string $documentId,
        int $revision,
        string $tokenHash,
        \DateTimeImmutable $expiresAt,
        ?int $actorId,
    ): void;

    public function findPreviewSource(string $tokenHash, \DateTimeImmutable $now): ?PreviewSource;

    public function storePublicationCandidate(
        CompileResult $result,
        int $expectedLockVersion,
        string $tokenHash,
        \DateTimeImmutable $expiresAt,
        ?int $actorId,
    ): void;

    public function commitPublication(string $tokenHash, \DateTimeImmutable $now): RenderedPage;

    public function unpublish(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot;

    public function archive(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot;

    public function restoreArchived(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot;

    public function purge(
        string $documentId,
        int $expectedLockVersion,
        string $confirmationSlug,
    ): void;

    public function setHome(
        string $documentId,
        bool $enabled,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot;

    public function findPublishedBySlug(string $slug): ?RenderedPage;

    public function findPublishedHome(): ?RenderedPage;
}
