<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Contracts\RouteCatalogPort;

final class AdminRouteCatalogController
{
    public function __construct(private readonly RouteCatalogPort $routes) {}

    public function index(): JsonResponse
    {
        try {
            return response()->json([
                'success' => true,
                'message' => '활성 G7 템플릿의 서비스 경로를 조회했습니다.',
                'data' => $this->routes->catalog(),
            ], 200, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\Throwable $exception) {
            Log::warning('G7 Page Builder route catalog was unavailable.', ['exception' => $exception]);

            return response()->json([
                'success' => false,
                'message' => '현재 사이트의 서비스 경로를 불러오지 못했습니다.',
                'data' => ['code' => 'G7PB_ROUTE_CATALOG_UNAVAILABLE'],
            ], 503, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
}
