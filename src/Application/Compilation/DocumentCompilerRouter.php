<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;

/** Schema routing does not convert documents or change the legacy compiler. */
final readonly class DocumentCompilerRouter implements DocumentCompilerPort
{
    public function __construct(private DocumentCompilerPort $legacy, private DocumentCompilerPort $elements) {}

    public function supports(string $targetFormat, string $targetEngineVersion): bool
    {
        return $this->legacy->supports($targetFormat, $targetEngineVersion)
            && $this->elements->supports($targetFormat, $targetEngineVersion);
    }

    public function compile(PageDocument $document, int $sourceRevision, string $targetFormat, string $targetEngineVersion): CompileResult
    {
        $compiler = $document instanceof ValidatedDocument ? $this->elements : $this->legacy;

        return $compiler->compile($document, $sourceRevision, $targetFormat, $targetEngineVersion);
    }
}
