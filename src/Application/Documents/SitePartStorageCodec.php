<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Documents;

use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartValidator;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSource;
use stdClass;

/** Dispatch only. Reading or saving a document never migrates its version. */
final readonly class SitePartStorageCodec
{
    public function __construct(private ?ElementSitePartValidator $elements = null) {}

    public function decodeStored(string $json): SitePartDocument|ElementSitePartDocument
    {
        return $this->decode($json, true);
    }

    public function decodeDraft(string $json, SitePartSource $current): SitePartDocument|ElementSitePartDocument
    {
        $document = $this->decode($json, false);
        if ($document->schemaVersion !== $current->schemaVersion) {
            throw new \InvalidArgumentException('Site Part version changes require explicit migration or revision restoration.');
        }
        if ($document->sitePartId !== $current->sitePartId || $document->kind !== $current->kind || $document->locale !== $current->locale
            || ($document instanceof ElementSitePartDocument && $current instanceof ElementSitePartDocument && $document->content->slug !== $current->content->slug)) {
            throw new \InvalidArgumentException('Site Part document identity does not match the requested target.');
        }

        return $document;
    }

    public function encodeRevision(SitePartSource $document): string
    {
        if ($document instanceof ElementSitePartDocument) {
            return ElementSitePartDocument::fromJson($document->toJson(), $this->elementValidator())->toJson();
        }
        if (! $document instanceof SitePartDocument) {
            throw new \InvalidArgumentException('Site Part source is not supported.');
        }
        $document->assertWritable();

        return json_encode($document->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    private function decode(string $json, bool $stored): SitePartDocument|ElementSitePartDocument
    {
        try {
            $payload = json_decode($json, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \InvalidArgumentException('Site Part JSON is invalid.', previous: $error);
        }
        if (! $payload instanceof stdClass) {
            throw new \InvalidArgumentException('Site Part must be a JSON object.');
        }
        if (($payload->schema_version ?? null) === 'g7-page-builder/site-part/v2') {
            // Associative decoding destroys the distinction between {} and [].
            return ElementSitePartDocument::fromJson($json, $this->elementValidator());
        }
        if (($payload->schema_version ?? null) !== 'g7-page-builder/site-part/v1') {
            throw new \InvalidArgumentException('Site Part schema version is not supported.');
        }
        /** @var array<string, mixed> $legacy */
        $legacy = json_decode($json, true, flags: JSON_THROW_ON_ERROR);

        return $stored ? SitePartDocument::fromStoredArray($legacy) : SitePartDocument::fromArray($legacy);
    }

    private function elementValidator(): ElementSitePartValidator
    {
        return $this->elements ?? throw new \InvalidArgumentException('Element Site Part support is unavailable.');
    }
}
