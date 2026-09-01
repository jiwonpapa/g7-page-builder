<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Modules\Jiwonpapa\PageBuilder\Contracts\SectionPatternRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Patterns\SectionPattern;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SectionPatternRecord;

final class EloquentSectionPatternRepository implements SectionPatternRepository
{
    public function allFor(int $actorId): array
    {
        /** @var list<SectionPatternRecord> $records */
        $records = SectionPatternRecord::query()
            ->where('actor_id', $actorId)
            ->orderByDesc('updated_at')
            ->get()
            ->values()
            ->all();

        return array_map(
            fn (SectionPatternRecord $record): SectionPattern => $this->hydrate($record),
            $records,
        );
    }

    public function findFor(string $patternId, int $actorId): ?SectionPattern
    {
        $record = SectionPatternRecord::query()
            ->whereKey($patternId)
            ->where('actor_id', $actorId)
            ->first();

        return $record instanceof SectionPatternRecord ? $this->hydrate($record) : null;
    }

    public function create(SectionPattern $pattern): SectionPattern
    {
        $record = SectionPatternRecord::query()->create([
            'pattern_id' => $pattern->patternId,
            'actor_id' => $pattern->actorId,
            'title' => $pattern->title,
            'category' => $pattern->category,
            'schema_version' => SectionPattern::SCHEMA_VERSION,
            'source_document_schema' => $pattern->sourceDocumentSchema,
            'section_json' => $pattern->section,
            'required_blocks_json' => $pattern->requiredBlocks,
            'asset_references_json' => $pattern->assetReferences,
            'preview_json' => $pattern->preview,
        ]);

        return $this->hydrate($record);
    }

    public function deleteFor(string $patternId, int $actorId): bool
    {
        return SectionPatternRecord::query()
            ->whereKey($patternId)
            ->where('actor_id', $actorId)
            ->delete() === 1;
    }

    private function hydrate(SectionPatternRecord $record): SectionPattern
    {
        $preview = (array) $record->getAttribute('preview_json');

        return new SectionPattern(
            patternId: (string) $record->getAttribute('pattern_id'),
            actorId: (int) $record->getAttribute('actor_id'),
            title: (string) $record->getAttribute('title'),
            category: (string) $record->getAttribute('category'),
            sourceDocumentSchema: (string) $record->getAttribute('source_document_schema'),
            section: (array) $record->getAttribute('section_json'),
            requiredBlocks: array_values((array) $record->getAttribute('required_blocks_json')),
            assetReferences: array_values((array) $record->getAttribute('asset_references_json')),
            preview: [
                'kind' => (string) ($preview['kind'] ?? 'section-summary'),
                'block_count' => (int) ($preview['block_count'] ?? 0),
            ],
            createdAt: \DateTimeImmutable::createFromInterface($record->getAttribute('created_at')),
            updatedAt: \DateTimeImmutable::createFromInterface($record->getAttribute('updated_at')),
        );
    }
}
