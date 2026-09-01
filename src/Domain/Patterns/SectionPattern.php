<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Patterns;

final readonly class SectionPattern
{
    public const SCHEMA_VERSION = 'g7-page-builder/section-pattern/v1';

    /**
     * @param  array<string, mixed>  $section
     * @param  list<string>  $requiredBlocks
     * @param  list<string>  $assetReferences
     * @param  array{kind: string, block_count: int}  $preview
     */
    public function __construct(
        public string $patternId,
        public int $actorId,
        public string $title,
        public string $category,
        public string $sourceDocumentSchema,
        public array $section,
        public array $requiredBlocks,
        public array $assetReferences,
        public array $preview,
        public \DateTimeImmutable $createdAt,
        public \DateTimeImmutable $updatedAt,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(bool $compatible = true, ?string $compatibilityError = null): array
    {
        return [
            'schema_version' => self::SCHEMA_VERSION,
            'pattern_id' => $this->patternId,
            'title' => $this->title,
            'category' => $this->category,
            'source_document_schema' => $this->sourceDocumentSchema,
            'section' => $this->section,
            'required_blocks' => $this->requiredBlocks,
            'asset_references' => $this->assetReferences,
            'preview' => $this->preview,
            'created_at' => $this->createdAt->format(DATE_ATOM),
            'updated_at' => $this->updatedAt->format(DATE_ATOM),
            'compatible' => $compatible,
            'compatibility_error' => $compatibilityError,
        ];
    }
}
