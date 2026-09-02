<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartArtifactPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PublishedSitePartSet;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SitePartRecord;

final class EloquentSitePartArtifactStore implements SitePartArtifactPort
{
    public function store(string $sitePartId, SitePartArtifact $artifact): void
    {
        $existing = DB::table('g7pb_site_part_artifacts')->where('site_part_id', $sitePartId)->where('source_revision', $artifact->sourceRevision)->first();
        if ($existing !== null) {
            if ($existing->html !== $artifact->html || $existing->artifact_sha256 !== $artifact->artifactSha256 || $existing->compiler_version !== $artifact->compilerVersion || $existing->kind !== $artifact->kind) {
                throw new \DomainException('A published Site Part artifact is immutable. Save a new revision before publishing changed output.');
            }

            return;
        }
        DB::table('g7pb_site_part_artifacts')->insert([
            'site_part_id' => $sitePartId, 'source_revision' => $artifact->sourceRevision,
            'kind' => $artifact->kind, 'compiler_version' => $artifact->compilerVersion,
            'html' => $artifact->html, 'artifact_sha256' => $artifact->artifactSha256,
            'created_at' => new \DateTimeImmutable,
        ]);
    }

    public function findPublishedSet(string $locale): ?PublishedSitePartSet
    {
        $query = DB::table('g7pb_site_part_sets as sets')->where('sets.locale', $locale)->where('sets.is_active', true);
        $columns = ['sets.id', 'sets.locale'];
        foreach (['header', 'footer'] as $kind) {
            $query->leftJoin('g7pb_site_parts as '.$kind, function (JoinClause $join) use ($kind): void {
                $join->on($kind.'.set_id', '=', 'sets.id')->where($kind.'.kind', $kind);
            })->leftJoin('g7pb_site_part_artifacts as '.$kind.'_artifact', function (JoinClause $join) use ($kind): void {
                $join->on($kind.'_artifact.site_part_id', '=', $kind.'.id')->on($kind.'_artifact.source_revision', '=', $kind.'.active_revision');
            });
            foreach (['html', 'artifact_sha256', 'compiler_version', 'source_revision', 'kind'] as $field) {
                $columns[] = $kind.'_artifact.'.$field.' as '.$kind.'_'.$field;
            }
        }
        // One statement observes one active set and both active revisions.
        $rows = $query->get($columns);
        if ($rows->isEmpty()) {
            return null;
        }
        if ($rows->count() !== 1) {
            throw new \RuntimeException('The active Site Part set is ambiguous.');
        }
        $row = $rows->first();
        if (! is_string($row->id) || ! is_string($row->locale)) {
            throw new \RuntimeException('The published Site Part set identity is invalid.');
        }

        return new PublishedSitePartSet($row->id, $row->locale, $this->artifact($row, 'header'), $this->artifact($row, 'footer'));
    }

    public function missingPublicationCount(): int
    {
        return $this->publishedRows()->whereNull('artifact.site_part_id')->count();
    }

    public function missingPublications(int $limit): array
    {
        $rows = $this->publishedRows()->whereNull('artifact.site_part_id')
            ->join('g7pb_site_part_revisions as revision', function (JoinClause $join): void {
                $join->on('revision.site_part_id', '=', 'part.id')->on('revision.revision', '=', 'part.active_revision');
            })->orderBy('part.id')->limit(max(1, min(100, $limit)))
            ->get(['part.id', 'part.set_id', 'part.lock_version', 'part.active_revision', 'revision.title', 'revision.document_json']);
        $result = [];
        foreach ($rows as $row) {
            $payload = json_decode((string) $row->document_json, true, flags: JSON_THROW_ON_ERROR);
            if (! is_array($payload)) {
                throw new \RuntimeException('Stored Site Part JSON is invalid.');
            }
            $document = SitePartDocument::fromStoredArray($payload);
            if ($document->sitePartId !== $row->id) {
                throw new \RuntimeException('Stored Site Part identity does not match its revision.');
            }
            $result[] = new SitePartSnapshot($document, (string) $row->title, (int) $row->lock_version, (int) $row->active_revision, (int) $row->active_revision, setId: (string) $row->set_id);
        }

        return $result;
    }

    public function prepareHistorical(SitePartSnapshot $source, SitePartArtifact $artifact): void
    {
        DB::transaction(function () use ($source, $artifact): void {
            /** @var SitePartRecord|null $record */
            $record = SitePartRecord::query()->whereKey($source->document->sitePartId)->lockForUpdate()->first();
            if ($record === null || $record->active_revision !== $source->revision || $record->lock_version !== $source->lockVersion) {
                throw new LockConflictException($record->lock_version ?? 0);
            }
            if ($artifact->sourceRevision !== $source->revision || $artifact->kind !== $record->kind) {
                throw new \InvalidArgumentException('Historical Site Part artifact identity does not match.');
            }
            $source->document->assertWritable();
            $this->store($record->id, $artifact);
        });
    }

    public function assertReady(): void
    {
        foreach ($this->publishedRows()->get(['part.kind as expected_kind', 'artifact.html', 'artifact.artifact_sha256', 'artifact.compiler_version', 'artifact.source_revision', 'artifact.kind']) as $row) {
            $artifact = $this->artifact($row);
            if ($artifact === null || $artifact->kind !== $row->expected_kind) {
                throw new \RuntimeException('Published Site Part artifacts require explicit preparation before cutover.');
            }
        }
    }

    private function publishedRows(): Builder
    {
        return DB::table('g7pb_site_parts as part')->whereNotNull('part.active_revision')
            ->leftJoin('g7pb_site_part_artifacts as artifact', function (JoinClause $join): void {
                $join->on('artifact.site_part_id', '=', 'part.id')->on('artifact.source_revision', '=', 'part.active_revision');
            });
    }

    private function artifact(\stdClass $row, string $prefix = ''): ?SitePartArtifact
    {
        $prefix = $prefix === '' ? '' : $prefix.'_';
        $html = $row->{$prefix.'html'};
        if ($html === null) {
            return null;
        }
        $hash = $row->{$prefix.'artifact_sha256'};
        $version = $row->{$prefix.'compiler_version'};
        $kind = $row->{$prefix.'kind'};
        $revision = $row->{$prefix.'source_revision'};
        if (! is_string($html) || ! is_string($hash) || ! is_string($version) || ! is_string($kind) || ! is_numeric($revision)) {
            throw new \RuntimeException('Stored Site Part artifact is invalid.');
        }

        return new SitePartArtifact($kind, $html, $hash, $version, (int) $revision);
    }
}
