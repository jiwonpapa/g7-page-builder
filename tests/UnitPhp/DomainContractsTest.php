<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use PHPUnit\Framework\TestCase;

final class DomainContractsTest extends TestCase
{
    public function test_document_defaults_to_schema_v1(): void
    {
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
        );

        self::assertSame('g7-page-builder/v1', $document->schemaVersion);
    }

    public function test_document_rejects_non_canvas_mode(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'site',
            locale: 'ko',
            tokens: [],
            blocks: [],
        );
    }

    public function test_document_rejects_invalid_uuid(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new PageBuilderDocument(
            documentId: 'not-a-uuid',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
        );
    }

    public function test_document_rejects_unsupported_schema_version(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000001',
            slug: 'page-builder',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [],
            schemaVersion: 'g7-page-builder/v2',
        );
    }

    public function test_compile_result_requires_sha256(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new CompileResult(
            compilerVersion: '0.1.0',
            documentId: '00000000-0000-4000-8000-000000000001',
            sourceRevision: 1,
            targetFormat: 'html',
            targetEngineVersion: 'g7-7.0.7',
            artifact: '<section></section>',
            artifactSha256: 'invalid',
        );
    }
}
