<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Compositions;

final readonly class NativeComposition
{
    public const SCHEMA_VERSION = 'g7-page-builder/native-composition/v1';

    public const MAX_BYTES = 262144;

    public function __construct(
        public string $id,
        public int $actorId,
        public string $title,
        public string $snapshot,
        public string $createdAt,
        public string $schemaVersion = self::SCHEMA_VERSION,
    ) {}

    public static function validate(string $schema, string $title, string $snapshot): void
    {
        if ($schema !== self::SCHEMA_VERSION || trim($title) === '' || mb_strlen(trim($title)) > 120
            || strlen($snapshot) > self::MAX_BYTES) {
            throw new \InvalidArgumentException('조합 형식, 이름 또는 크기를 확인해 주세요.');
        }
        try {
            $value = json_decode($snapshot, false, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new \InvalidArgumentException('조합 JSON 형식이 올바르지 않습니다.');
        }
        if (! $value instanceof \stdClass || ($value->schema_version ?? null) !== 'g7.editor-composition/v1'
            || ! ($value->node ?? null) instanceof \stdClass
            || ! is_string($value->templateIdentifier ?? null) || $value->templateIdentifier === ''
            || ! is_string($value->layoutName ?? null) || $value->layoutName === ''
            || ! is_string($value->signature ?? null) || ! preg_match('/^[a-f0-9]{64}$/', $value->signature)
            || ! in_array($value->scope ?? null, ['template', 'layout'], true)) {
            throw new \InvalidArgumentException('지원하지 않는 네이티브 조합입니다.');
        }
    }

    /** @return array<string, mixed> */
    public function toArray(bool $includeSnapshot = false): array
    {
        return [
            'id' => $this->id, 'title' => $this->title,
            'schema_version' => $this->schemaVersion, 'created_at' => $this->createdAt,
        ] + ($includeSnapshot ? ['snapshot' => $this->snapshot] : []);
    }
}
