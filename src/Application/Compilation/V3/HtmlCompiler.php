<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\TemplateMarkupPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;

/** Compiles canonical elements, never catalog identities or vendor state. */
final readonly class HtmlCompiler implements DocumentCompilerPort
{
    public const COMPILER_VERSION = '1.0.0';

    public function __construct(private Validator $validator) {}

    public function supports(string $targetFormat, string $targetEngineVersion): bool
    {
        return $targetFormat === 'html' && $targetEngineVersion === HtmlDocumentCompiler::TARGET_ENGINE_VERSION;
    }

    public function compile(PageDocument $document, int $sourceRevision, string $targetFormat, string $targetEngineVersion): CompileResult
    {
        if (! $this->supports($targetFormat, $targetEngineVersion) || ! $document instanceof ValidatedDocument) {
            throw new DocumentCompileException('The page document or compiler target is not supported.');
        }
        $source = $this->validator->validateJson($document->toJson());
        $presentation = ResponsiveStyles::document($source, $this->validator);
        $artifact = (new ElementMarkup(publication: true, formFields: $this->validator->formFields()))->render($source, $presentation['styles'], $presentation['attributes']);
        (new TemplateMarkupPolicy)->assertTemplateCompatibleMarkup($artifact, 'Compiled v3 document');

        return new CompileResult(
            compilerVersion: self::COMPILER_VERSION,
            documentId: $document->documentId,
            sourceRevision: $sourceRevision,
            targetFormat: $targetFormat,
            targetEngineVersion: $targetEngineVersion,
            artifact: $artifact,
            artifactSha256: hash('sha256', $artifact),
        );
    }
}
