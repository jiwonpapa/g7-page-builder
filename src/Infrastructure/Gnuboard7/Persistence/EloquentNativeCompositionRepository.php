<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Modules\Jiwonpapa\PageBuilder\Contracts\NativeCompositionRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Compositions\NativeComposition;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\NativeCompositionRecord;

final class EloquentNativeCompositionRepository implements NativeCompositionRepository
{
    public function pageFor(int $actorId, int $page): array
    {
        /** @var list<NativeCompositionRecord> $records */
        $records = NativeCompositionRecord::query()->where('actor_id', $actorId)
            ->orderByDesc('created_at')->orderByDesc('composition_id')->offset(($page - 1) * 30)->limit(31)
            ->get(['composition_id', 'actor_id', 'title', 'created_at', 'schema_version'])
            ->values()->all();

        return array_map(fn (NativeCompositionRecord $record): NativeComposition => $this->hydrate($record), $records);
    }

    public function findFor(int $actorId, string $id): ?NativeComposition
    {
        $record = NativeCompositionRecord::query()->where('actor_id', $actorId)->whereKey($id)->first();

        return $record instanceof NativeCompositionRecord ? $this->hydrate($record) : null;
    }

    public function create(NativeComposition $composition): NativeComposition
    {
        $record = NativeCompositionRecord::query()->create([
            'composition_id' => $composition->id, 'actor_id' => $composition->actorId,
            'title' => $composition->title, 'schema_version' => NativeComposition::SCHEMA_VERSION,
            'snapshot_json' => $composition->snapshot,
        ]);

        return $this->hydrate($record);
    }

    public function deleteFor(int $actorId, string $id): bool
    {
        return NativeCompositionRecord::query()->where('actor_id', $actorId)->whereKey($id)->delete() === 1;
    }

    private function hydrate(NativeCompositionRecord $record): NativeComposition
    {
        return new NativeComposition(
            (string) $record->getAttribute('composition_id'), (int) $record->getAttribute('actor_id'),
            (string) $record->getAttribute('title'), (string) $record->getAttribute('snapshot_json'),
            $record->getAttribute('created_at')->toAtomString(),
            (string) $record->getAttribute('schema_version'),
        );
    }
}
