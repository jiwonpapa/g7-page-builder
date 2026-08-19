<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;

interface PageDocumentPort
{
    public function loadDraft(string $pageReference, string $locale): ?PageBuilderDocument;

    public function saveDraft(
        string $pageReference,
        PageBuilderDocument $document,
        int $expectedLockVersion,
    ): int;

    public function publish(
        string $pageReference,
        PageBuilderDocument $document,
        int $expectedLockVersion,
    ): int;
}

