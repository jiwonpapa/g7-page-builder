<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCatalogService;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockCatalogItem;

final class AdminBlockCatalogController
{
    public function __construct(private readonly BlockCatalogService $catalog) {}

    public function index(Request $request): JsonResponse
    {
        $queryValue = $request->query('query', '');
        $categoryValue = $request->query('category', '');
        $locale = $request->query('locale', 'ko');
        if (! is_string($queryValue) || ! is_string($categoryValue) || ! is_string($locale)) {
            return $this->error(422, 'G7PB_BLOCK_CATALOG_FILTER_INVALID', '블록 검색 조건이 올바르지 않습니다.');
        }
        $query = trim($queryValue);
        $category = trim($categoryValue);
        if (mb_strlen($query) > 120 || ($category !== '' && preg_match('/^[a-z0-9][a-z0-9._-]{1,63}$/', $category) !== 1)) {
            return $this->error(422, 'G7PB_BLOCK_CATALOG_FILTER_INVALID', '블록 검색 조건이 올바르지 않습니다.');
        }

        $items = $this->catalog->list(
            actorId: $this->actorId($request),
            locale: $locale,
            query: $query,
            category: $category === '' ? null : $category,
            favoritesOnly: filter_var($request->query('favorites'), FILTER_VALIDATE_BOOL),
        );

        return $this->success('블록 카탈로그를 조회했습니다.', [
            'items' => array_map(static fn (BlockCatalogItem $item): array => $item->toArray(), $items),
            'categories' => array_values(array_unique(array_map(
                static fn (BlockCatalogItem $item): string => $item->category,
                $this->catalog->list($this->actorId($request)),
            ))),
        ]);
    }

    public function favorite(Request $request): JsonResponse
    {
        $catalogId = $request->input('catalog_id');
        $favorite = $request->input('favorite');
        if (! is_string($catalogId)
            || preg_match('/^(?:block|preset):[a-z0-9][a-z0-9._:\/@-]{2,255}$/', $catalogId) !== 1
            || ! is_bool($favorite)) {
            return $this->error(422, 'G7PB_BLOCK_FAVORITE_INVALID', '즐겨찾기 상태가 올바르지 않습니다.');
        }

        try {
            $this->catalog->setFavorite($this->actorId($request), $catalogId, $favorite);

            return $this->success(
                $favorite ? '즐겨찾기에 추가했습니다.' : '즐겨찾기에서 제거했습니다.',
                ['catalog_id' => $catalogId, 'favorite' => $favorite],
            );
        } catch (\DomainException $exception) {
            return $this->error(404, 'G7PB_BLOCK_NOT_FOUND', $exception->getMessage());
        }
    }

    private function actorId(Request $request): int
    {
        $identifier = $request->user()?->getAuthIdentifier();
        if (! is_numeric($identifier) || (int) $identifier < 1) {
            throw new \RuntimeException('Authenticated administrator id is unavailable.');
        }

        return (int) $identifier;
    }

    private function success(string $message, mixed $data): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], 200, [], JSON_UNESCAPED_UNICODE);
    }

    private function error(int $status, string $code, string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => $code],
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }
}
