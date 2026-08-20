<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

/**
 * G7 Layout Editor와 분리된 전역 Header/Footer 원본 문서입니다.
 */
final readonly class SitePartDocument
{
    /**
     * @param  array<string, string|int|float|bool|null>  $tokens
     * @param  list<array<string, mixed>>  $blocks
     */
    public function __construct(
        public string $sitePartId,
        public string $kind,
        public string $locale,
        public array $tokens,
        public array $blocks,
        public string $schemaVersion = 'g7-page-builder/site-part/v1',
    ) {
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $this->sitePartId) !== 1) {
            throw new \InvalidArgumentException('Site Part id must be a UUID.');
        }
        if (! in_array($this->kind, ['header', 'footer'], true)) {
            throw new \InvalidArgumentException('Site Part kind must be header or footer.');
        }
        if (preg_match('/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/', $this->locale) !== 1) {
            throw new \InvalidArgumentException('Site Part locale is invalid.');
        }
        if ($this->schemaVersion !== 'g7-page-builder/site-part/v1') {
            throw new \InvalidArgumentException('Site Part schema version is not supported.');
        }
        if (count($this->blocks) > 50) {
            throw new \InvalidArgumentException('Site Part has too many blocks.');
        }
        foreach ($this->blocks as $block) {
            $type = $block['type'] ?? null;
            if (! is_string($type) || ! str_starts_with($type, "site.{$this->kind}.")) {
                throw new \InvalidArgumentException('Site Part block kind does not match its document.');
            }
        }
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $tokens = $data['tokens'] ?? [];
        $blocks = $data['blocks'] ?? null;
        if (! is_array($tokens) || ! is_array($blocks)) {
            throw new \InvalidArgumentException('Site Part tokens and blocks must be arrays.');
        }
        foreach ($tokens as $name => $value) {
            if (! is_string($name) || (! is_scalar($value) && $value !== null)) {
                throw new \InvalidArgumentException('Site Part token value is invalid.');
            }
        }
        foreach ($blocks as $block) {
            if (! is_array($block)) {
                throw new \InvalidArgumentException('Each Site Part block must be an object.');
            }
        }

        return new self(
            sitePartId: self::requiredString($data, 'site_part_id'),
            kind: self::requiredString($data, 'kind'),
            locale: self::requiredString($data, 'locale'),
            tokens: $tokens,
            blocks: array_values($blocks),
            schemaVersion: self::requiredString($data, 'schema_version'),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'schema_version' => $this->schemaVersion,
            'site_part_id' => $this->sitePartId,
            'kind' => $this->kind,
            'locale' => $this->locale,
            'tokens' => $this->tokens,
            'blocks' => $this->blocks,
        ];
    }

    /** @param array<string, mixed> $data */
    private static function requiredString(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (! is_string($value) || trim($value) === '') {
            throw new \InvalidArgumentException("Site Part {$key} must be a non-empty string.");
        }

        return trim($value);
    }
}
