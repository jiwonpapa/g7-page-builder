<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7PageRouteRegistry;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7TemplateRouteBridge;

final class AdminPageRouteController
{
    public function __construct(private readonly G7PageRouteRegistry $paths, private readonly G7TemplateRouteBridge $routes) {}

    public function show(Request $request, string $document): JsonResponse
    {
        return $this->respond(fn (): array => $this->paths->get($document));
    }

    public function update(Request $request, string $document): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'path' => ['present', 'nullable', 'string', 'max:240'],
            'expected_lock_version' => ['required', 'integer', 'min:0'],
        ]);
        if ($validator->fails()) {
            return $this->error('주소와 최신 저장 버전을 확인해 주세요.', 422);
        }

        return $this->respond(function () use ($request, $document): array {
            $input = $request->input('path');
            $result = $this->paths->assign($document, is_string($input) ? $input : null, (int) $request->input('expected_lock_version'));
            $this->routes->invalidate();

            return $result;
        });
    }

    /** @param callable(): array<string, mixed> $action */
    private function respond(callable $action): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'message' => '페이지 주소를 확인했습니다.', 'data' => $action()]);
        } catch (ModelNotFoundException) {
            return $this->error('페이지를 찾을 수 없습니다.', 404);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($exception->getMessage(), 422);
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage(), 409);
        } catch (\Throwable $exception) {
            Log::warning('Page Builder path request failed.', ['exception' => $exception]);

            return $this->error('페이지 주소를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.', 503);
        }
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, 'error' => [
            'code' => 'G7PB_PAGE_PATH_INVALID', 'message' => $message,
        ]], $status);
    }
}
