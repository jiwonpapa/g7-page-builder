<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;

final class PublicPageController
{
    public function __construct(private readonly PageBuilderService $service) {}

    public function show(string $slug): JsonResponse
    {
        $page = $this->service->findPublished($slug);

        if ($page === null) {
            return response()->json([
                'success' => false,
                'message' => '발행된 페이지를 찾을 수 없습니다.',
                'data' => ['code' => 'G7PB_PAGE_NOT_FOUND'],
            ], 404, [], JSON_UNESCAPED_UNICODE);
        }

        return response()->json([
            'success' => true,
            'message' => '발행된 페이지를 조회했습니다.',
            'data' => [
                'page' => [
                    'title' => $page->title,
                    'slug' => $page->slug,
                    'locale' => $page->locale,
                    'shell_mode' => $page->shellMode,
                    'artifact' => $page->artifact,
                    'artifact_sha256' => $page->artifactSha256,
                    'published_at' => $page->publishedAt?->format(DATE_ATOM),
                ],
            ],
        ], 200, [
            'Cache-Control' => 'public, no-cache, must-revalidate',
            'ETag' => '"'.$page->representationSha256().'"',
        ], JSON_UNESCAPED_UNICODE);
    }
}
