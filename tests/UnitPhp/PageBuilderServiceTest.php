<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\PublicationCommitException;
use PHPUnit\Framework\TestCase;

final class PageBuilderServiceTest extends TestCase
{
    public function test_archived_document_cannot_compile_or_prepare_a_publication(): void
    {
        $snapshot = new DocumentSnapshot($this->document(), 'Fixture', 2, 1, archivedAt: new \DateTimeImmutable);
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->expects(self::once())->method('find')->willReturn($snapshot);
        $repository->expects(self::never())->method('storePublicationCandidate');
        $compiler = $this->createMock(DocumentCompilerPort::class);
        $compiler->expects(self::never())->method('compile');
        $this->expectException(PublicationCommitException::class);
        (new PageBuilderService($repository, $compiler))->preparePublication($snapshot->document->documentId, 2, 1);
    }

    public function test_preview_does_not_issue_a_token_when_the_draft_cannot_compile(): void
    {
        $snapshot = new DocumentSnapshot(
            document: $this->document(),
            title: '페이지 빌더',
            lockVersion: 3,
            revision: 2,
        );
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->expects(self::once())
            ->method('find')
            ->with($snapshot->document->documentId)
            ->willReturn($snapshot);
        $repository->expects(self::never())->method('storePreviewToken');
        $compiler = $this->createMock(DocumentCompilerPort::class);
        $compiler->expects(self::once())
            ->method('compile')
            ->with(
                $snapshot->document,
                $snapshot->revision,
                'html',
                HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
            )
            ->willThrowException(new DocumentCompileException('Invalid draft.'));

        $service = new PageBuilderService($repository, $compiler);

        $this->expectException(DocumentCompileException::class);
        $service->preview($snapshot->document->documentId, $snapshot->lockVersion, 1);
    }

    public function test_create_rejects_a_whitespace_only_title_before_persistence(): void
    {
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->expects(self::never())->method('create');
        $compiler = $this->createStub(DocumentCompilerPort::class);
        $service = new PageBuilderService($repository, $compiler);

        $this->expectException(\InvalidArgumentException::class);
        $service->create(" \t\n ", 'page-builder', 'ko', 1);
    }

    public function test_duplicate_copies_the_current_draft_into_a_fresh_document_identity(): void
    {
        $sourceDocument = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'source-page',
            mode: 'canvas',
            locale: 'ko',
            tokens: ['accent' => '#2458d6'],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000002',
                'type' => 'content.hero-centered-01',
                'block_version' => 1,
                'props' => ['title' => '복제할 페이지'],
                'slots' => [],
            ]],
            shellMode: 'none',
        );
        $source = new DocumentSnapshot(
            document: $sourceDocument,
            title: '원본',
            lockVersion: 4,
            revision: 3,
            activeArtifactSha256: str_repeat('a', 64),
            activePublicSlug: 'source-page',
            isHome: true,
        );
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->expects(self::once())
            ->method('find')
            ->with($sourceDocument->documentId)
            ->willReturn($source);
        $repository->expects(self::once())
            ->method('create')
            ->with(
                '새 초안',
                self::callback(static function (PageBuilderDocument $copy) use ($sourceDocument): bool {
                    return $copy->documentId !== $sourceDocument->documentId
                        && $copy->slug === 'source-page-copy'
                        && $copy->locale === $sourceDocument->locale
                        && $copy->tokens === $sourceDocument->tokens
                        && $copy->blocks === $sourceDocument->blocks
                        && $copy->schemaVersion === $sourceDocument->schemaVersion
                        && $copy->shellMode === $sourceDocument->shellMode;
                }),
                7,
            )
            ->willReturnCallback(static fn (string $title, PageBuilderDocument $copy): DocumentSnapshot => new DocumentSnapshot(
                document: $copy,
                title: $title,
                lockVersion: 1,
                revision: 1,
            ));
        $service = new PageBuilderService($repository, $this->createStub(DocumentCompilerPort::class));

        $copy = $service->duplicate($sourceDocument->documentId, ' 새 초안 ', 'source-page-copy', 4, 7);

        self::assertSame('새 초안', $copy->title);
        self::assertSame(1, $copy->lockVersion);
        self::assertSame(1, $copy->revision);
        self::assertNull($copy->activeArtifactSha256);
        self::assertFalse($copy->isHome);
    }

    public function test_duplicate_rejects_a_stale_source_lock_before_creating_a_copy(): void
    {
        $source = new DocumentSnapshot(
            document: $this->document(),
            title: '원본',
            lockVersion: 5,
            revision: 2,
        );
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->method('find')->willReturn($source);
        $repository->expects(self::never())->method('create');
        $service = new PageBuilderService($repository, $this->createStub(DocumentCompilerPort::class));

        $this->expectException(LockConflictException::class);
        $service->duplicate($source->document->documentId, '복사본', 'page-builder-copy', 4, 7);
    }

    public function test_page_kit_creates_a_compiled_unpublished_document_with_fresh_identities(): void
    {
        $template = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000020',
            slug: 'kit-template',
            mode: 'canvas',
            locale: 'ko',
            tokens: ['design.palette' => 'blue'],
            blocks: [[
                'instance_id' => '00000000-0000-4000-8000-000000000021',
                'type' => 'content.hero-centered-01',
                'block_version' => 1,
                'props' => ['title' => 'Page Kit'],
                'slots' => ['content' => [[
                    'instance_id' => '00000000-0000-4000-8000-000000000022',
                    'type' => 'content.hero-centered-01',
                    'block_version' => 1,
                    'props' => ['title' => 'Nested Page Kit'],
                    'slots' => [],
                ]]],
            ]],
            shellMode: 'none',
        );
        $repository = $this->createMock(PageBuilderRepository::class);
        $compiler = $this->createMock(DocumentCompilerPort::class);
        $compiler->expects(self::once())
            ->method('compile')
            ->with(
                self::callback(static fn (PageBuilderDocument $document): bool => $document->documentId !== $template->documentId
                    && $document->blocks[0]['instance_id'] !== $template->blocks[0]['instance_id']
                    && $document->blocks[0]['slots']['content'][0]['instance_id']
                        !== $template->blocks[0]['slots']['content'][0]['instance_id']
                    && $document->slug === 'new-kit-page'
                    && $document->shellMode === 'template'),
                1,
                'html',
                HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
            )
            ->willReturnCallback(static fn (PageBuilderDocument $document): CompileResult => new CompileResult(
                compilerVersion: '0.10.0',
                documentId: $document->documentId,
                sourceRevision: 1,
                targetFormat: 'html',
                targetEngineVersion: HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
                artifact: '<section></section>',
                artifactSha256: hash('sha256', '<section></section>'),
            ));
        $repository->expects(self::once())
            ->method('create')
            ->willReturnCallback(static fn (string $title, PageBuilderDocument $document): DocumentSnapshot => new DocumentSnapshot(
                $document,
                $title,
                1,
                1,
            ));
        $service = new PageBuilderService($repository, $compiler);

        $created = $service->createFromPageKit(' 새 회사 페이지 ', 'new-kit-page', $template, 7);

        self::assertSame('새 회사 페이지', $created->title);
        self::assertNull($created->activeArtifactSha256);
        self::assertFalse($created->isHome);
    }

    public function test_page_kit_rejects_an_empty_title_and_malformed_slots_before_persistence(): void
    {
        $repository = $this->createMock(PageBuilderRepository::class);
        $repository->expects(self::never())->method('create');
        $compiler = $this->createMock(DocumentCompilerPort::class);
        $compiler->expects(self::never())->method('compile');
        $service = new PageBuilderService($repository, $compiler);

        try {
            $service->createFromPageKit('   ', 'empty-kit', $this->document(), 7);
            self::fail('A Page Kit with an empty title was accepted.');
        } catch (\InvalidArgumentException $exception) {
            self::assertStringContainsString('title', $exception->getMessage());
        }

        $malformed = new PageBuilderDocument(
            '00000000-0000-4000-8000-000000000030',
            'malformed-kit',
            'canvas',
            'ko',
            [],
            [[
                'instance_id' => '00000000-0000-4000-8000-000000000031',
                'type' => 'content.hero-centered-01',
                'block_version' => 1,
                'props' => ['title' => 'Malformed'],
                'slots' => 'not-an-object',
            ]],
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('slots');
        $service->createFromPageKit('Malformed', 'malformed-kit-copy', $malformed, 7);
    }

    private function document(): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
        );
    }
}
