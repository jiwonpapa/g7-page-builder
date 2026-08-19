<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;

interface PageDocumentPort
{
    public function loadDraft(string $documentId): ?PageBuilderDocument;

    public function saveDraft(
        PageBuilderDocument $document,
        int $expectedLockVersion,
    ): int;
}
