<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;

interface JsonUiCompilerPort
{
    /**
     * @return array<string, mixed>
     */
    public function compile(PageBuilderDocument $document, string $targetEngineVersion): array;

    public function supports(string $targetEngineVersion): bool;
}

