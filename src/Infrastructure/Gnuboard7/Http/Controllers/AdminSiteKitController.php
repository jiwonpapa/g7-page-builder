<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Application\Store\SiteKitService;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class AdminSiteKitController
{
    public function __construct(private SiteKitService $kits) {}

    public function index(): JsonResponse
    {
        return $this->respond(fn (): array => $this->kits->catalog());
    }

    public function preview(Request $request): JsonResponse
    {
        return $this->run($request, false);
    }

    public function install(Request $request): JsonResponse
    {
        return $this->run($request, true);
    }

    private function run(Request $request, bool $install): JsonResponse
    {
        $rules = ['kit_id' => ['required', 'string', 'max:100'], 'paths' => ['required', 'array', 'max:20'],
            'paths.*' => ['required', 'string', 'max:240']];
        if ($install) {
            $rules += ['kit_version' => ['required', 'string', 'max:40'], 'title' => ['required', 'string', 'max:80'],
                'request_id' => ['required', 'uuid']];
        }
        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return $this->error('사이트 킷 이름과 페이지 주소를 확인해 주세요.', 422);
        }
        $input = $validator->validated();

        return $this->respond(fn (): array => $install
            ? $this->kits->install($input['kit_id'], $input['kit_version'], $input['title'], $input['paths'],
                $input['request_id'], $request->user() === null ? null : (int) $request->user()->getAuthIdentifier())
            : $this->kits->preview($input['kit_id'], $input['paths']));
    }

    /** @param callable(): array<string, mixed> $action */
    private function respond(callable $action): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $action()]);
        } catch (\InvalidArgumentException|DocumentCompileException $exception) {
            return $this->error($exception->getMessage(), 422);
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage(), 409);
        } catch (\Throwable $exception) {
            Log::warning('Site Kit request failed.', ['exception' => $exception]);

            return $this->error('사이트 킷을 처리하지 못했습니다. 같은 요청으로 다시 시도해 주세요.', 503);
        }
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message,
            'error' => ['code' => 'G7PB_SITE_KIT_INVALID', 'message' => $message]], $status);
    }
}
