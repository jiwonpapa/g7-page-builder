<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Support\Facades\DB;
use Modules\Jiwonpapa\PageBuilder\Contracts\SiteKitInstallationPort;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7PageRouteRegistry;

final readonly class EloquentSiteKitInstallation implements SiteKitInstallationPort
{
    public function __construct(private G7PageRouteRegistry $paths) {}

    public function conflicts(array $paths): array
    {
        $issues = [];
        foreach ($paths as $key => $path) {
            try {
                $this->paths->assertAvailable($path);
            } catch (\DomainException|\InvalidArgumentException $exception) {
                $issues[$key] = $exception->getMessage();
            }
        }

        return $issues;
    }

    public function assign(string $documentId, string $path): void
    {
        $this->paths->assign($documentId, $path, 0);
    }

    public function drafts(callable $write): array
    {
        return DB::transaction(static fn (): array => $write());
    }

    public function once(string $requestId, string $fingerprint, ?int $actorId, callable $install): array
    {
        return DB::transaction(function () use ($requestId, $fingerprint, $actorId, $install): array {
            $table = DB::table('g7pb_site_kit_installations');
            $now = new \DateTimeImmutable;
            $table->insertOrIgnore(['request_id' => $requestId, 'fingerprint' => $fingerprint,
                'actor_id' => $actorId, 'created_at' => $now, 'updated_at' => $now]);
            $row = DB::table('g7pb_site_kit_installations')->where('request_id', $requestId)->lockForUpdate()->first();
            if ($row === null || $row->fingerprint !== $fingerprint
                || ($row->actor_id === null ? null : (int) $row->actor_id) !== $actorId) {
                throw new \DomainException('이미 다른 구성에 사용한 설치 요청입니다. 새 설치로 시작해 주세요.');
            }
            if (is_string($row->result_json)) {
                $result = json_decode($row->result_json, true, 64, JSON_THROW_ON_ERROR);
                if (! is_array($result)) {
                    throw new \RuntimeException('사이트 킷 설치 기록이 잘못됐습니다.');
                }

                return $result;
            }
            $result = $install();
            DB::table('g7pb_site_kit_installations')->where('request_id', $requestId)
                ->update(['result_json' => json_encode($result, JSON_THROW_ON_ERROR), 'updated_at' => $now]);

            return $result;
        });
    }
}
