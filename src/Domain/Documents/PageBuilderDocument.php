<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

/**
 * G7 구현과 독립적인 페이지 빌더 원본 문서입니다.
 */
final readonly class PageBuilderDocument
{
    /**
     * @param  array<string, string|int|float|bool|null>  $tokens
     * @param  array<int, array<string, mixed>>  $blocks
     */
    public function __construct(
        public string $documentId,
        public string $slug,
        public string $mode,
        public string $locale,
        public array $tokens,
        public array $blocks,
        public string $schemaVersion = 'g7-page-builder/v1',
    ) {
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $this->documentId) !== 1) {
            throw new \InvalidArgumentException('Page document id must be a UUID.');
        }

        if ($this->schemaVersion !== 'g7-page-builder/v1') {
            throw new \InvalidArgumentException('Page schema version is not supported.');
        }

        if ($this->mode !== 'canvas') {
            throw new \InvalidArgumentException('Page mode must be canvas for schema v1.');
        }

        if (preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $this->slug) !== 1) {
            throw new \InvalidArgumentException('Page slug is invalid.');
        }

        if (strlen($this->slug) > 120) {
            throw new \InvalidArgumentException('Page slug is too long.');
        }

        if (preg_match('/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/', $this->locale) !== 1) {
            throw new \InvalidArgumentException('Page locale is invalid.');
        }

        if (count($this->blocks) > 500) {
            throw new \InvalidArgumentException('Page document has too many blocks.');
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $tokens = $data['tokens'] ?? [];
        $blocks = $data['blocks'] ?? null;

        if (! is_array($tokens) || ! is_array($blocks)) {
            throw new \InvalidArgumentException('Page tokens and blocks must be arrays.');
        }

        foreach ($tokens as $name => $value) {
            if (! is_string($name) || (! is_scalar($value) && $value !== null)) {
                throw new \InvalidArgumentException('Page token value is invalid.');
            }
        }

        foreach ($blocks as $block) {
            if (! is_array($block)) {
                throw new \InvalidArgumentException('Each page block must be an object.');
            }
        }

        return new self(
            documentId: self::requiredString($data, 'document_id'),
            slug: self::requiredString($data, 'slug'),
            mode: self::requiredString($data, 'mode'),
            locale: self::requiredString($data, 'locale'),
            tokens: $tokens,
            blocks: array_values($blocks),
            schemaVersion: self::requiredString($data, 'schema_version'),
        );
    }

    /**
     * @return array{
     *     schema_version: string,
     *     document_id: string,
     *     slug: string,
     *     mode: string,
     *     locale: string,
     *     tokens: array<string, string|int|float|bool|null>,
     *     blocks: array<int, array<string, mixed>>
     * }
     */
    public function toArray(): array
    {
        return [
            'schema_version' => $this->schemaVersion,
            'document_id' => $this->documentId,
            'slug' => $this->slug,
            'mode' => $this->mode,
            'locale' => $this->locale,
            'tokens' => $this->tokens,
            'blocks' => $this->blocks,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function requiredString(array $data, string $key): string
    {
        $value = $data[$key] ?? null;

        if (! is_string($value) || $value === '') {
            throw new \InvalidArgumentException("Page {$key} is required.");
        }

        return $value;
    }
}
