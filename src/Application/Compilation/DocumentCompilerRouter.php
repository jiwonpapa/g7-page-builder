<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;

/** Schema routing does not convert documents or change the legacy compiler. */
final readonly class DocumentCompilerRouter implements DocumentCompilerPort
{
    /** @param DocumentCompilerPort|\Closure(): DocumentCompilerPort $legacy */
    public function __construct(private DocumentCompilerPort|\Closure $legacy, private DocumentCompilerPort $elements) {}

    private function legacy(): DocumentCompilerPort
    {
        return $this->legacy instanceof \Closure ? ($this->legacy)() : $this->legacy;
    }

    public function supports(string $targetFormat, string $targetEngineVersion): bool
    {
        return $this->elements->supports($targetFormat, $targetEngineVersion)
            || $this->legacy()->supports($targetFormat, $targetEngineVersion);
    }

    public function compile(PageDocument $document, int $sourceRevision, string $targetFormat, string $targetEngineVersion): CompileResult
    {
        $compiler = $document instanceof ValidatedDocument ? $this->elements : $this->legacy();

        return $compiler->compile($document, $sourceRevision, $targetFormat, $targetEngineVersion);
    }
}
