<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Jiwonpapa\PageBuilder\Application\Patterns\SectionPatternService;

final class AdminSectionPatternController
{
    public function __construct(private readonly SectionPatternService $patterns) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success('내 패턴을 조회했습니다.', [
            'items' => $this->patterns->all($this->actorId($request)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $section = $request->input('section');
        if (! is_array($section)) {
            return $this->error(422, 'G7PB_SECTION_PATTERN_INVALID', '저장할 Section이 올바르지 않습니다.');
        }

        try {
            $pattern = $this->patterns->create(
                actorId: $this->actorId($request),
                title: (string) $request->input('title', ''),
                category: (string) $request->input('category', ''),
                sourceDocumentSchema: (string) $request->input('source_document_schema', ''),
                section: $section,
            );

            return $this->success('선택한 구역을 내 패턴에 저장했습니다.', $pattern->toArray(), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error(422, 'G7PB_SECTION_PATTERN_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->error(422, 'G7PB_SECTION_PATTERN_UNAVAILABLE', $exception->getMessage());
        }
    }

    public function destroy(Request $request, string $pattern): JsonResponse
    {
        try {
            $this->patterns->delete($this->actorId($request), $pattern);

            return $this->success('내 패턴을 삭제했습니다.', ['pattern_id' => $pattern]);
        } catch (\DomainException $exception) {
            return $this->error(404, 'G7PB_SECTION_PATTERN_NOT_FOUND', $exception->getMessage());
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

    private function success(string $message, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status, [], JSON_UNESCAPED_UNICODE);
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
