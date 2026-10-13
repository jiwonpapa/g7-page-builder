<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Schema;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;

/** Site Part ownership around the same canonical element document, never block-specific data. */
final readonly class ElementSitePartDocument implements SitePartSource
{
    public string $sitePartId;

    public string $locale;

    private function __construct(public string $schemaVersion, public string $kind, public ValidatedDocument $content)
    {
        $this->sitePartId = $content->documentId;
        $this->locale = $content->locale;
    }

    public static function fromJson(string $json, ElementSitePartValidator $validator): self
    {
        $source = $validator->validateJson($json);

        return new self($source['schema_version'], $source['kind'], $source['content']);
    }

    public function withContent(ValidatedDocument $content, ElementSitePartValidator $validator): self
    {
        if ($content->documentId !== $this->sitePartId || $content->locale !== $this->locale || $content->slug !== $this->content->slug) {
            Schema::reject('site_part_identity', '$.content');
        }

        return self::fromJson(json_encode([
            'schema_version' => $this->schemaVersion, 'kind' => $this->kind, 'content' => $content->toArray(),
        ], JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION), $validator);
    }

    /** A fresh transport snapshot; mutating it cannot alter this source.
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return ['schema_version' => $this->schemaVersion, 'kind' => $this->kind, 'content' => (object) $this->content->toArray()];
    }

    public function toJson(): string
    {
        return json_encode($this->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }
}
