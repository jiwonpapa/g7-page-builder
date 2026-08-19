<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use PHPUnit\Framework\TestCase;

final class PageBuilderServiceTest extends TestCase
{
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
