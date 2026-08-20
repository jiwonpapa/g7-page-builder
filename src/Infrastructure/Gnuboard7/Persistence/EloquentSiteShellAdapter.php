<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Support\Facades\DB;
use Modules\Jiwonpapa\PageBuilder\Contracts\SiteShellPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShellSnapshot;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SiteShellRecord;

final class EloquentSiteShellAdapter implements SiteShellPort
{
    public function get(string $locale): SiteShellSnapshot
    {
        /** @var SiteShellRecord|null $record */
        $record = SiteShellRecord::query()->find($locale);
        if (! $record instanceof SiteShellRecord) {
            return new SiteShellSnapshot(SiteShell::defaults($locale), 0);
        }

        return $this->snapshot($record);
    }

    public function save(SiteShell $shell, int $expectedLockVersion, ?int $actorId): SiteShellSnapshot
    {
        return DB::transaction(function () use ($shell, $expectedLockVersion, $actorId): SiteShellSnapshot {
            /** @var SiteShellRecord|null $record */
            $record = SiteShellRecord::query()->whereKey($shell->locale)->lockForUpdate()->first();
            if (! $record instanceof SiteShellRecord) {
                if ($expectedLockVersion !== 0) {
                    throw new LockConflictException(0);
                }
                $record = SiteShellRecord::query()->create([
                    'locale' => $shell->locale,
                    'config_json' => $this->encode($shell->toArray()),
                    'lock_version' => 1,
                    'updated_by' => $actorId,
                ]);

                return $this->snapshot($record);
            }
            if ($record->lock_version !== $expectedLockVersion) {
                throw new LockConflictException($record->lock_version);
            }

            $record->fill([
                'config_json' => $this->encode($shell->toArray()),
                'lock_version' => $record->lock_version + 1,
                'updated_by' => $actorId,
            ])->save();

            return $this->snapshot($record);
        });
    }

    private function snapshot(SiteShellRecord $record): SiteShellSnapshot
    {
        $data = json_decode($record->config_json, true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($data)) {
            throw new \RuntimeException('Stored site shell JSON is invalid.');
        }

        return new SiteShellSnapshot(
            shell: SiteShell::fromArray($record->locale, $data),
            lockVersion: $record->lock_version,
            updatedAt: \DateTimeImmutable::createFromInterface($record->updated_at),
        );
    }

    /** @param array<string, mixed> $data */
    private function encode(array $data): string
    {
        return json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
