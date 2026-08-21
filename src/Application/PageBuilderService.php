<?php

namespace Modules\Jiwonpapa\PageBuilder\Application;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageSeoMetadata;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\DocumentNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\RevisionNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PreparedPublication;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PreviewTicket;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\RenderedPage;

final class PageBuilderService
{
    public function __construct(
        private readonly PageBuilderRepository $repository,
        private readonly DocumentCompilerPort $compiler,
    ) {}

    public function create(
        string $title,
        string $slug,
        string $locale,
        ?int $actorId,
        string $shellMode = 'template',
    ): DocumentSnapshot {
        $title = trim($title);

        if ($title === '') {
            throw new \InvalidArgumentException('Page title must not be empty.');
        }

        $document = new PageBuilderDocument(
            documentId: $this->uuidV4(),
            slug: $slug,
            mode: 'canvas',
            locale: $locale,
            tokens: [],
            blocks: [],
            shellMode: $shellMode,
        );

        return $this->repository->create($title, $document, $actorId);
    }

    /**
     * @return array{items: list<DocumentSnapshot>, total: int, page: int, per_page: int}
     */
    public function paginate(int $page, int $perPage, string $status = 'active'): array
    {
        return $this->repository->paginate($page, $perPage, $status);
    }

    public function get(string $documentId): DocumentSnapshot
    {
        return $this->repository->find($documentId)
            ?? throw new DocumentNotFoundException('Page document was not found.');
    }

    public function duplicate(
        string $documentId,
        string $title,
        string $slug,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        $title = trim($title);

        if ($title === '') {
            throw new \InvalidArgumentException('Page title must not be empty.');
        }

        $source = $this->get($documentId);

        if ($source->lockVersion !== $expectedLockVersion) {
            throw new LockConflictException($source->lockVersion);
        }

        $copy = new PageBuilderDocument(
            documentId: $this->uuidV4(),
            slug: $slug,
            mode: 'canvas',
            locale: $source->document->locale,
            tokens: $source->document->tokens,
            blocks: $source->document->blocks,
            schemaVersion: $source->document->schemaVersion,
            shellMode: $source->document->shellMode,
            seo: $source->document->seo,
        );

        return $this->repository->create($title, $copy, $actorId);
    }

    public function createFromPageKit(
        string $title,
        string $slug,
        PageBuilderDocument $template,
        ?int $actorId,
    ): DocumentSnapshot {
        $title = trim($title);
        if ($title === '') {
            throw new \InvalidArgumentException('Page title must not be empty.');
        }

        $document = new PageBuilderDocument(
            documentId: $this->uuidV4(),
            slug: $slug,
            mode: 'canvas',
            locale: $template->locale,
            tokens: $template->tokens,
            blocks: $this->freshBlockIdentities($template->blocks),
            schemaVersion: $template->schemaVersion,
            shellMode: 'template',
            seo: $template->seo,
        );

        // 외부 Page Kit은 저장 전에 현재 compiler와 활성 Block Registry를 반드시 통과합니다.
        $this->compiler->compile(
            $document,
            1,
            'html',
            HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
        );

        return $this->repository->create($title, $document, $actorId);
    }

    /** @return list<DocumentRevision> */
    public function revisions(string $documentId, int $limit = 20): array
    {
        $this->get($documentId);

        return $this->repository->listRevisions($documentId, min(50, max(1, $limit)));
    }

    public function revision(string $documentId, int $revision): DocumentRevision
    {
        $this->get($documentId);

        return $this->repository->findRevision($documentId, $revision)
            ?? throw new RevisionNotFoundException('Page document revision was not found.');
    }

    public function restoreRevision(
        string $documentId,
        int $revision,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return $this->repository->restoreRevision(
            $documentId,
            $revision,
            $expectedLockVersion,
            $actorId,
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function saveDraft(
        string $documentId,
        array $payload,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        $payload['document_id'] = $documentId;
        $payload['mode'] = 'canvas';
        $document = PageBuilderDocument::fromArray($payload);

        return $this->repository->saveDraft($document, $expectedLockVersion, $actorId);
    }

    /** @param array<string, mixed>|null $seo */
    public function updateMetadata(
        string $documentId,
        string $title,
        string $slug,
        string $locale,
        int $expectedLockVersion,
        ?int $actorId,
        ?string $shellMode = null,
        ?array $seo = null,
    ): DocumentSnapshot {
        $title = trim($title);

        if ($title === '') {
            throw new \InvalidArgumentException('Page title must not be empty.');
        }

        return $this->repository->updateMetadata(
            $documentId,
            $title,
            $slug,
            $locale,
            $expectedLockVersion,
            $actorId,
            $shellMode,
            $seo === null ? null : PageSeoMetadata::fromArray($seo),
        );
    }

    public function preview(string $documentId, int $expectedLockVersion, ?int $actorId): PreviewTicket
    {
        $snapshot = $this->get($documentId);

        if ($snapshot->lockVersion !== $expectedLockVersion) {
            throw new LockConflictException($snapshot->lockVersion);
        }

        return $this->createPreviewTicket(
            $documentId,
            $snapshot->revision,
            $snapshot->document,
            $actorId,
        );
    }

    public function previewRevision(string $documentId, int $revision, ?int $actorId): PreviewTicket
    {
        $source = $this->revision($documentId, $revision);

        return $this->createPreviewTicket(
            $documentId,
            $source->revision,
            $source->document,
            $actorId,
        );
    }

    public function renderPreview(string $token): ?RenderedPage
    {
        $source = $this->repository->findPreviewSource(
            hash('sha256', $token),
            new \DateTimeImmutable,
        );

        if ($source === null) {
            return null;
        }

        $result = $this->compiler->compile(
            $source->document,
            $source->revision,
            'html',
            HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
        );

        return new RenderedPage(
            title: $source->title,
            slug: $source->document->slug,
            locale: $source->document->locale,
            artifact: is_string($result->artifact) ? $result->artifact : '',
            artifactSha256: $result->artifactSha256,
            shellMode: $source->document->shellMode,
            seo: $source->document->seo,
        );
    }

    public function preparePublication(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): PreparedPublication {
        $snapshot = $this->get($documentId);

        if ($snapshot->lockVersion !== $expectedLockVersion) {
            throw new LockConflictException($snapshot->lockVersion);
        }

        $result = $this->compiler->compile(
            $snapshot->document,
            $snapshot->revision,
            'html',
            HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
        );
        $token = bin2hex(random_bytes(32));

        $this->repository->storePublicationCandidate(
            $result,
            $expectedLockVersion,
            hash('sha256', $token),
            new \DateTimeImmutable('+30 minutes'),
            $actorId,
        );

        return new PreparedPublication($token, $result->artifactSha256, $result->warnings);
    }

    public function commitPublication(string $token): RenderedPage
    {
        return $this->repository->commitPublication(
            hash('sha256', $token),
            new \DateTimeImmutable,
        );
    }

    public function unpublish(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return $this->repository->unpublish($documentId, $expectedLockVersion, $actorId);
    }

    public function archive(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return $this->repository->archive($documentId, $expectedLockVersion, $actorId);
    }

    public function restoreArchived(
        string $documentId,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return $this->repository->restoreArchived($documentId, $expectedLockVersion, $actorId);
    }

    public function purge(
        string $documentId,
        int $expectedLockVersion,
        string $confirmationSlug,
    ): void {
        $this->repository->purge($documentId, $expectedLockVersion, $confirmationSlug);
    }

    public function setHome(
        string $documentId,
        bool $enabled,
        int $expectedLockVersion,
        ?int $actorId,
    ): DocumentSnapshot {
        return $this->repository->setHome($documentId, $enabled, $expectedLockVersion, $actorId);
    }

    public function findPublished(string $slug): ?RenderedPage
    {
        return $this->repository->findPublishedBySlug($slug);
    }

    public function findPublishedHome(): ?RenderedPage
    {
        return $this->repository->findPublishedHome();
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

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     * @return array<int, array<string, mixed>>
     */
    private function freshBlockIdentities(array $blocks): array
    {
        $fresh = [];
        foreach ($blocks as $block) {
            $block['instance_id'] = $this->uuidV4();
            $slots = $block['slots'] ?? [];
            if (! is_array($slots)) {
                throw new \InvalidArgumentException('Page Kit block slots must be an object.');
            }
            foreach ($slots as $name => $children) {
                if (! is_string($name) || ! is_array($children)) {
                    throw new \InvalidArgumentException('Page Kit block slot is invalid.');
                }
                $slots[$name] = $this->freshBlockIdentities(array_values($children));
            }
            $block['slots'] = $slots;
            $fresh[] = $block;
        }

        return $fresh;
    }

    private function createPreviewTicket(
        string $documentId,
        int $revision,
        PageBuilderDocument $document,
        ?int $actorId,
    ): PreviewTicket {
        $this->compiler->compile(
            $document,
            $revision,
            'html',
            HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
        );

        $token = bin2hex(random_bytes(32));
        $expiresAt = new \DateTimeImmutable('+15 minutes');

        $this->repository->storePreviewToken(
            $documentId,
            $revision,
            hash('sha256', $token),
            $expiresAt,
            $actorId,
        );

        return new PreviewTicket($token, $expiresAt);
    }
}
