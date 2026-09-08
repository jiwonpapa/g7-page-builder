<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Jiwonpapa\PageBuilder\Application\Compositions\NativeCompositionService;

final readonly class AdminNativeCompositionController
{
    public function __construct(private NativeCompositionService $compositions) {}

    public function index(Request $request): JsonResponse
    {
        $page = filter_var($request->query('page', '1'), FILTER_VALIDATE_INT);
        if ($page === false || $page < 1 || $page > 10000) {
            return $this->error(422, '목록 범위를 확인해 주세요.');
        }

        return $this->success($this->compositions->page($this->actor($request), $page));
    }

    public function store(Request $request): JsonResponse
    {
        $title = $request->input('title');
        $schema = $request->input('schema_version');
        $snapshot = $request->input('snapshot');
        if (! is_string($title) || ! is_string($schema) || ! is_string($snapshot)) {
            return $this->error(422, '조합 형식을 확인해 주세요.');
        }
        try {
            return $this->success($this->compositions->create($this->actor($request), $schema, $title, $snapshot)->toArray(), 201);
        } catch (\InvalidArgumentException $error) {
            return $this->error(422, $error->getMessage());
        }
    }

    public function show(Request $request, string $composition): JsonResponse
    {
        try {
            return $this->success($this->compositions->find($this->actor($request), $composition)->toArray(true));
        } catch (\DomainException $error) {
            return $this->error(404, $error->getMessage());
        }
    }

    public function destroy(Request $request, string $composition): JsonResponse
    {
        try {
            $this->compositions->delete($this->actor($request), $composition);

            return $this->success(['id' => $composition]);
        } catch (\DomainException $error) {
            return $this->error(404, $error->getMessage());
        }
    }

    private function actor(Request $request): int
    {
        $id = $request->user()?->getAuthIdentifier();
        if (! is_numeric($id) || (int) $id < 1) {
            throw new \RuntimeException('Authenticated administrator id is unavailable.');
        }

        return (int) $id;
    }

    private function success(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $data], $status);
    }

    private function error(int $status, string $message): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message,
            'data' => ['code' => 'G7PB_NATIVE_COMPOSITION_INVALID']], $status);
    }
}
