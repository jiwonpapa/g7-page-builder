<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Documents;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;

/** A new canonical page needs no built-in block, catalog, renderer or host. */
final readonly class EmptyStructureDocument
{
    public function __construct(private Validator $validator) {}

    /** @param array<string, array{kind: string, value: string}> $tokens */
    public function create(string $documentId, string $slug, string $locale, array $tokens, string $shellMode = 'template'): ValidatedDocument
    {
        $json = json_encode([
            'schema_version' => 'g7-page-builder/v3',
            'document_id' => $documentId,
            'slug' => $slug,
            'mode' => 'canvas',
            'locale' => $locale,
            'shell_mode' => $shellMode,
            'tokens' => (object) $tokens,
            'assets' => [],
            'blocks' => [],
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return ValidatedDocument::fromJson($json, $this->validator);
    }
}
