<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageSeoMetadata;
use stdClass;

/**
 * Immutable value for the existing v3 grammar, not another document format.
 * The validator is supplied by composition; this value performs no I/O.
 * Keep JSON object/list distinctions through persistence and HTTP adapters.
 */
final readonly class ValidatedDocument implements PageDocument
{
    private string $json;

    public string $documentId;

    public string $slug;

    public string $locale;

    public string $shellMode;

    public string $schemaVersion;

    public ?PageSeoMetadata $seo;

    private int $rootNodes;

    private function __construct(stdClass $document)
    {
        $this->json = json_encode($document, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        $this->documentId = $document->document_id;
        $this->slug = $document->slug;
        $this->locale = $document->locale;
        $this->shellMode = $document->shell_mode;
        $this->schemaVersion = $document->schema_version;
        $this->seo = isset($document->seo) ? PageSeoMetadata::fromArray(get_object_vars($document->seo)) : null;
        $this->rootNodes = count($document->blocks);
    }

    public static function fromJson(string $json, Validator $validator): self
    {
        return new self($validator->validateJson($json));
    }

    public function toJson(): string
    {
        return $this->json;
    }

    public function rootCount(): int
    {
        return $this->rootNodes;
    }

    /**
     * A fresh transport snapshot. Nested maps remain objects, and arrays remain
     * lists. Mutating a returned snapshot cannot mutate this validated value.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        // Only this class's validated, immutable JSON can reach this decode.
        /** @var stdClass $document */
        $document = json_decode($this->json, flags: JSON_THROW_ON_ERROR);

        return get_object_vars($document);
    }
}
