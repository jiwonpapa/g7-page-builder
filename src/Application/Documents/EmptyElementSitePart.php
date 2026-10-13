<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Documents;

use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartValidator;

/** New Site Parts start with the same empty element document as a page. */
final readonly class EmptyElementSitePart
{
    public function __construct(private EmptyStructureDocument $documents, private ElementSitePartValidator $validator) {}

    /** @param array<string, array{kind: string, value: string}> $tokens */
    public function create(string $id, string $kind, string $locale, array $tokens): ElementSitePartDocument
    {
        $content = $this->documents->create($id, 'site-'.$kind, $locale, $tokens, 'none');

        return ElementSitePartDocument::fromJson(json_encode([
            'schema_version' => 'g7-page-builder/site-part/v2',
            'kind' => $kind,
            'content' => (object) $content->toArray(),
        ], JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION), $this->validator);
    }
}
