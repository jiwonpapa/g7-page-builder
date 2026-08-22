<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\RenderedPage;

final class PublicPageController
{
    public function __construct(private readonly PageBuilderService $service) {}

    public function show(string $slug): JsonResponse
    {
        return $this->publishedResponse($this->service->findPublished($slug));
    }

    public function home(): JsonResponse
    {
        return $this->publishedResponse($this->service->findPublishedHome());
    }

    public function preview(string $token): JsonResponse
    {
        $page = $this->service->renderPreview($token);

        if ($page === null) {
            return $this->notFound('미리보기가 만료되었거나 이미 사용되었습니다.');
        }

        return $this->pageResponse($page, '페이지 미리보기를 조회했습니다.', [
            'Cache-Control' => 'no-store',
            'Pragma' => 'no-cache',
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
    }

    private function publishedResponse(?RenderedPage $page): JsonResponse
    {
        if ($page === null) {
            return $this->notFound('발행된 페이지를 찾을 수 없습니다.');
        }

        return $this->pageResponse($page, '발행된 페이지를 조회했습니다.', [
            'Cache-Control' => 'public, no-cache, must-revalidate',
            'ETag' => '"'.$page->representationSha256().'"',
        ]);
    }

    /** @param array<string, string> $headers */
    private function pageResponse(RenderedPage $page, string $message, array $headers): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                // G7 SeoMetaResolver discovers data.seo_meta on each data source.
                'seo_meta' => $page->seo?->toArray(),
                'page' => [
                    'title' => $page->title,
                    'slug' => $page->slug,
                    'locale' => $page->locale,
                    'shell_mode' => $page->shellMode,
                    'artifact' => $page->artifact,
                    'artifact_sha256' => $page->artifactSha256,
                    'published_at' => $page->publishedAt?->format(DATE_ATOM),
                    'seo_meta' => $page->seo?->toArray(),
                ],
            ],
        ], 200, $headers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => 'G7PB_PAGE_NOT_FOUND'],
        ], 404, [
            'Cache-Control' => 'no-store',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
