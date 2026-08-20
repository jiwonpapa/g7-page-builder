<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShellSnapshot;

final class AdminSiteShellController
{
    public function __construct(private readonly SiteShellService $service) {}

    public function show(Request $request): JsonResponse
    {
        $locale = $request->query('locale', 'ko');
        if (! is_string($locale) || preg_match('/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/', $locale) !== 1) {
            return $this->error(400, 'G7PB_SITE_SHELL_INVALID', '사이트 언어가 올바르지 않습니다.');
        }

        try {
            return $this->success('공통 메뉴 설정을 조회했습니다.', $this->data($this->service->get($locale)));
        } catch (\Throwable $exception) {
            return $this->unexpected($exception);
        }
    }

    public function update(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'expected_lock_version' => ['required', 'integer', 'min:0'],
            'brand_name' => ['required', 'string', 'max:120'],
            'logo_url' => ['present', 'nullable', 'string', 'max:2048'],
            'home_url' => ['required', 'string', 'max:2048'],
            'header_variant' => ['required', 'in:solid,transparent'],
            'sticky' => ['required', 'boolean'],
            'navigation' => ['present', 'array', 'max:10'],
            'navigation.*.label' => ['required', 'string', 'max:80'],
            'navigation.*.url' => ['required', 'string', 'max:2048'],
            'cta' => ['nullable', 'array'],
            'cta.label' => ['required_with:cta', 'string', 'max:80'],
            'cta.url' => ['required_with:cta', 'string', 'max:2048'],
            'footer_text' => ['present', 'nullable', 'string', 'max:300'],
            'show_footer_navigation' => ['required', 'boolean'],
        ]);
        if ($validator->fails()) {
            return $this->error(400, 'G7PB_SITE_SHELL_INVALID', '공통 메뉴 설정이 올바르지 않습니다.', [
                'errors' => $validator->errors()->toArray(),
            ]);
        }

        try {
            /** @var array<string, mixed> $payload */
            $payload = $request->all();
            $payload['logo_url'] = is_string($payload['logo_url'] ?? null) ? $payload['logo_url'] : '';
            $payload['footer_text'] = is_string($payload['footer_text'] ?? null) ? $payload['footer_text'] : '';
            $snapshot = $this->service->save(
                (string) $request->input('locale'),
                $payload,
                (int) $request->input('expected_lock_version'),
                $this->actorId($request),
            );

            return $this->success('공통 Header·Footer를 저장했습니다.', $this->data($snapshot));
        } catch (LockConflictException $exception) {
            return $this->error(409, 'G7PB_LOCK_CONFLICT', '다른 관리자가 공통 메뉴를 먼저 수정했습니다.', [
                'current_lock_version' => $exception->currentLockVersion,
            ]);
        } catch (\InvalidArgumentException $exception) {
            return $this->error(400, 'G7PB_SITE_SHELL_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($exception);
        }
    }

    /** @return array<string, mixed> */
    private function data(SiteShellSnapshot $snapshot): array
    {
        return [
            'locale' => $snapshot->shell->locale,
            'lock_version' => $snapshot->lockVersion,
            ...$snapshot->shell->toArray(),
            'updated_at' => $snapshot->updatedAt?->format(DATE_ATOM),
        ];
    }

    private function actorId(Request $request): ?int
    {
        $identifier = $request->user()?->getAuthIdentifier();

        return is_numeric($identifier) ? (int) $identifier : null;
    }

    /** @param array<string, mixed> $data */
    private function success(string $message, array $data): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], 200, [], JSON_UNESCAPED_UNICODE);
    }

    /** @param array<string, mixed> $data */
    private function error(int $status, string $code, string $message, array $data = []): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => $code, ...$data],
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function unexpected(\Throwable $exception): JsonResponse
    {
        $correlationId = bin2hex(random_bytes(8));
        Log::error('Page Builder site shell request failed.', [
            'correlation_id' => $correlationId,
            'exception' => $exception,
        ]);

        return $this->error(500, 'G7PB_INTERNAL_ERROR', '공통 메뉴 처리 중 오류가 발생했습니다.', [
            'correlation_id' => $correlationId,
        ]);
    }
}
