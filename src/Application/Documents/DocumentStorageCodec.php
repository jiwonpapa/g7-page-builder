<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Documents;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use stdClass;

/** Version dispatch at the storage boundary, never a document migration. */
final readonly class DocumentStorageCodec
{
    public function __construct(private Validator $validator) {}

    public function decodeStored(string $json): PageBuilderDocument|ValidatedDocument
    {
        return $this->decode($json, true);
    }

    public function decodeDraft(string $json, string $expectedDocumentId): PageBuilderDocument|ValidatedDocument
    {
        $document = $this->decode($json, false);
        if ($document->documentId !== $expectedDocumentId) {
            throw new \InvalidArgumentException('Draft document identity does not match the requested document.');
        }

        return $document;
    }

    public function encodeRevision(PageBuilderDocument|ValidatedDocument $document): string
    {
        if ($document instanceof ValidatedDocument) {
            return ValidatedDocument::fromJson($document->toJson(), $this->validator)->toJson();
        }

        // Historical recovery is read-only. A new revision still satisfies the
        // current legacy write policy, just as the existing repository requires.
        PageBuilderDocument::fromArray($document->toArray());

        return json_encode($document->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function decode(string $json, bool $stored): PageBuilderDocument|ValidatedDocument
    {
        try {
            $source = json_decode($json, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \InvalidArgumentException('Page document JSON is invalid.', previous: $error);
        }
        if (! $source instanceof stdClass) {
            throw new \InvalidArgumentException('Page document must be an object.');
        }
        $version = $source->schema_version ?? null;
        if ($version === 'g7-page-builder/v3') {
            // Keep the original JSON: associative decoding collapses {} and [].
            return ValidatedDocument::fromJson($json, $this->validator);
        }
        if (! in_array($version, ['g7-page-builder/v1', 'g7-page-builder/v2'], true)) {
            throw new \InvalidArgumentException('Page schema version is not supported.');
        }

        /** @var array<string, mixed> $legacy */
        $legacy = json_decode($json, true, flags: JSON_THROW_ON_ERROR);

        return $stored ? PageBuilderDocument::fromStoredArray($legacy) : PageBuilderDocument::fromArray($legacy);
    }
}
