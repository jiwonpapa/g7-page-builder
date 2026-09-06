<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing;

use App\Services\TemplateService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Modules\Jiwonpapa\PageBuilder\Domain\Routing\PagePath;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\DocumentRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PageRouteRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PublicationRecord;

final class G7PageRouteRegistry
{
    public function __construct(private readonly TemplateService $templates) {}

    public function assertAvailable(string $input): void
    {
        $path = PagePath::normalize($input);
        if (PagePath::conflicts($path, $this->nativeRoutes())) {
            throw new \DomainException('이미 G7에서 사용하는 주소입니다. 다른 주소를 입력해 주세요.');
        }
        if (PageRouteRecord::query()->where('path', $path)->exists()) {
            throw new \DomainException('다른 페이지가 사용 중인 주소입니다.');
        }
    }

    /** @return array{path: ?string, lock_version: int, active: bool, reason: ?string} */
    public function get(string $documentId): array
    {
        $document = DocumentRecord::query()->findOrFail($documentId);
        $route = PageRouteRecord::query()->find($documentId);
        $active = $this->activeEntries();
        $entry = array_values(array_filter($active, static fn (array $row): bool => $row['document_id'] === $documentId))[0] ?? null;
        $reason = null;
        if ($route?->path !== null) {
            $reason = $entry === null ? '활성 사이트 템플릿 방식으로 발행한 뒤 주소가 연결됩니다.' : null;
            if ($entry !== null && PagePath::conflicts($route->path, $this->nativeRoutes())) {
                $reason = '기존 G7 주소와 충돌하여 연결을 중지했습니다. 다른 주소로 변경해 주세요.';
            }
        }
        if ($document->archived_at !== null) {
            $reason = '보관한 페이지는 주소를 연결할 수 없습니다.';
        }

        return ['path' => $route?->path, 'lock_version' => $route->lock_version ?? 0,
            'active' => $entry !== null && $reason === null, 'reason' => $reason];
    }

    /** @return array{path: ?string, lock_version: int, active: bool, reason: ?string} */
    public function assign(string $documentId, ?string $input, int $expectedVersion): array
    {
        $path = $input === null || trim($input) === '' ? null : PagePath::normalize($input);
        if ($path !== null && PagePath::conflicts($path, $this->nativeRoutes())) {
            throw new \DomainException('이미 G7에서 사용하는 주소입니다. 다른 주소를 입력해 주세요.');
        }
        try {
            DB::transaction(function () use ($documentId, $path, $expectedVersion): void {
                $query = DocumentRecord::query();
                $query->lockForUpdate();
                $document = $query->findOrFail($documentId);
                if ($document->archived_at !== null) {
                    throw new \DomainException('보관한 페이지의 주소는 변경할 수 없습니다.');
                }
                $route = PageRouteRecord::query()->lockForUpdate()->find($documentId);
                if (($route->lock_version ?? 0) !== $expectedVersion) {
                    throw new \DomainException('다른 화면에서 주소가 변경되었습니다. 닫았다가 다시 열어 주세요.');
                }
                if ($path !== null && PageRouteRecord::query()->where('path', $path)->where('document_id', '!=', $documentId)->exists()) {
                    throw new \DomainException('다른 페이지가 사용 중인 주소입니다.');
                }
                PageRouteRecord::query()->updateOrCreate(['document_id' => $documentId], [
                    'path' => $path, 'lock_version' => $expectedVersion + 1,
                ]);
            });
        } catch (QueryException $exception) {
            if (in_array((string) $exception->getCode(), ['23000', '23505'], true)) {
                throw new \DomainException('다른 페이지가 사용 중인 주소입니다.', previous: $exception);
            }
            throw $exception;
        }

        return $this->get($documentId);
    }

    /** @param list<array<string, mixed>> $routes
     * @return list<array<string, mixed>>
     */
    public function merge(array $routes): array
    {
        $native = $this->withoutAliases($routes);
        $aliases = [];
        foreach ($this->activeEntries() as $entry) {
            if (PagePath::conflicts($entry['path'], $native)) {
                continue;
            }
            $aliases[] = ['path' => $entry['path'], 'layout' => 'jiwonpapa-page_builder.page_builder_public',
                'params' => ['slug' => $entry['slug']], 'auth_required' => false,
                'meta' => ['title' => $entry['title'], 'g7pb_page_path' => true],
                'source' => ['kind' => 'module', 'identifier' => 'jiwonpapa-page_builder']];
        }

        return [...$aliases, ...$native];
    }

    public function publishedSlug(string $path): ?string
    {
        $entry = array_values(array_filter($this->activeEntries(), static fn (array $row): bool => $row['path'] === $path))[0] ?? null;
        if ($entry === null || PagePath::conflicts($path, $this->nativeRoutes())) {
            return null;
        }

        return $entry['slug'];
    }

    /** @return list<array{document_id: string, path: string, slug: string, title: string}> */
    private function activeEntries(): array
    {
        $entries = [];
        // Only module-owned tables. Never read G7 page/menu/layout tables.
        $rows = PageRouteRecord::query()->whereNotNull('path')->get();
        $documents = DocumentRecord::query()->whereIn('id', $rows->pluck('document_id'))->whereNull('archived_at')->get()->keyBy('id');
        $publications = PublicationRecord::query()->whereIn('id', $documents->pluck('active_publication_id')->filter())
            ->where('status', 'active')->where('shell_mode', 'template')->get()->keyBy('id');
        foreach ($rows as $row) {
            $document = $documents->get($row->document_id);
            $publication = $document === null ? null : $publications->get($document->active_publication_id);
            if ($publication !== null && $publication->document_id === $row->document_id && $row->path !== null) {
                $entries[] = ['document_id' => $row->document_id, 'path' => $row->path, 'slug' => $publication->slug, 'title' => $publication->title];
            }
        }

        return $entries;
    }

    /** @return list<array<string, mixed>> */
    private function nativeRoutes(): array
    {
        $identifier = $this->templates->getActiveTemplateIdentifier('user');
        $result = $this->templates->getRoutesDataWithModules($identifier);
        $routes = $result['data']['routes'] ?? null;
        if ($result['success'] !== true || ! is_array($routes)) {
            throw new \RuntimeException('G7 주소 목록을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        }

        return $this->withoutAliases(array_values(array_filter($routes, 'is_array')));
    }

    /** @param list<array<string, mixed>> $routes
     * @return list<array<string, mixed>>
     */
    private function withoutAliases(array $routes): array
    {
        return array_values(array_filter($routes, static fn (array $route): bool => ($route['source']['identifier'] ?? null) !== 'jiwonpapa-page_builder'
            || ($route['meta']['g7pb_page_path'] ?? false) !== true));
    }
}
