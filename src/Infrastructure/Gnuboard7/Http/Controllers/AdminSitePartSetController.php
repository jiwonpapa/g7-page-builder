<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\SitePartNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSetSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;

final class AdminSitePartSetController
{
    public function __construct(
        private readonly SitePartService $siteParts,
        private readonly SiteShellService $siteShell,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $locale = $this->validatedLocale($request, $request->query->all());
        if ($locale instanceof JsonResponse) {
            return $locale;
        }

        try {
            return $this->success('헤더·푸터 세트를 조회했습니다.', [
                'items' => array_map($this->data(...), $this->siteParts->listSets($locale)),
            ]);
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'title' => ['required', 'string', 'max:255'],
        ]);
        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $locale = (string) $request->input('locale');
            $set = $this->siteParts->createSet(
                (string) $request->input('title'),
                $locale,
                $this->siteShell->get($locale)->shell,
                $this->actorId($request),
            );

            return $this->success('새 헤더·푸터 세트를 만들었습니다.', $this->data($set), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 400, 'G7PB_SITE_PART_SET_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function activate(Request $request, string $set): JsonResponse
    {
        $locale = $this->validatedLocale($request, $request->all());
        if ($locale instanceof JsonResponse) {
            return $locale;
        }

        try {
            return $this->success(
                '사용할 헤더·푸터 세트를 변경했습니다.',
                $this->data($this->siteParts->activateSet($set, $locale, $this->actorId($request))),
            );
        } catch (SitePartNotFoundException $exception) {
            return $this->error($request, 404, 'G7PB_SITE_PART_SET_NOT_FOUND', $exception->getMessage());
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 409, 'G7PB_SITE_PART_SET_NOT_READY', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function saveDraft(Request $request, string $set): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'header.title' => ['required', 'string', 'max:255'],
            'header.document' => ['required', 'array'],
            'header.expected_lock_version' => ['required', 'integer', 'min:1'],
            'footer.title' => ['required', 'string', 'max:255'],
            'footer.document' => ['required', 'array'],
            'footer.expected_lock_version' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->siteParts->saveSetDraft(
                $set,
                (string) $request->input('locale'),
                (string) $request->input('header.title'),
                (array) $request->input('header.document'),
                (int) $request->input('header.expected_lock_version'),
                (string) $request->input('footer.title'),
                (array) $request->input('footer.document'),
                (int) $request->input('footer.expected_lock_version'),
                $this->actorId($request),
            );

            return $this->success('헤더·푸터 세트를 저장했습니다.', $this->editorData($snapshot));
        } catch (SitePartNotFoundException $exception) {
            return $this->error($request, 404, 'G7PB_SITE_PART_SET_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->error($request, 409, 'G7PB_LOCK_CONFLICT', $exception->getMessage(), [
                'current_lock_version' => $exception->currentLockVersion,
            ]);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 400, 'G7PB_SITE_PART_SET_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function publish(Request $request, string $set): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'header_expected_lock_version' => ['required', 'integer', 'min:1'],
            'footer_expected_lock_version' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->siteParts->publishSet(
                $set,
                (string) $request->input('locale'),
                (int) $request->input('header_expected_lock_version'),
                (int) $request->input('footer_expected_lock_version'),
                $this->actorId($request),
            );

            return $this->success('헤더·푸터 세트를 발행했습니다.', $this->editorData($snapshot));
        } catch (SitePartNotFoundException $exception) {
            return $this->error($request, 404, 'G7PB_SITE_PART_SET_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->error($request, 409, 'G7PB_LOCK_CONFLICT', $exception->getMessage(), [
                'current_lock_version' => $exception->currentLockVersion,
            ]);
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    /** @param array<string, mixed> $input */
    private function validatedLocale(Request $request, array $input): string|JsonResponse
    {
        $validator = Validator::make($input, [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
        ]);

        return $validator->fails()
            ? $this->invalid($request, $validator->errors()->toArray())
            : (string) ($input['locale'] ?? '');
    }

    /** @return array<string, mixed> */
    private function data(SitePartSetSnapshot $set): array
    {
        return [
            'id' => $set->id,
            'title' => $set->title,
            'locale' => $set->locale,
            'is_active' => $set->isActive,
            'is_ready' => $set->isReady(),
            'header' => $this->partData($set->header),
            'footer' => $this->partData($set->footer),
            'created_at' => $set->createdAt?->format(DATE_ATOM),
            'updated_at' => $set->updatedAt?->format(DATE_ATOM),
        ];
    }

    /** @return array<string, mixed> */
    private function partData(SitePartSnapshot $snapshot): array
    {
        return [
            'site_part_id' => $snapshot->document->sitePartId,
            'revision' => $snapshot->revision,
            'active_revision' => $snapshot->activeRevision,
            'status' => $snapshot->activeRevision === null
                ? 'draft'
                : ($snapshot->hasUnpublishedChanges() ? 'published_with_changes' : 'published'),
            'updated_at' => $snapshot->updatedAt?->format(DATE_ATOM),
        ];
    }

    /** @return array<string, mixed> */
    private function editorData(SitePartSetSnapshot $set): array
    {
        return [
            'set' => $this->data($set),
            'header' => $this->resourceData($set->header),
            'footer' => $this->resourceData($set->footer),
        ];
    }

    /** @return array<string, mixed> */
    private function resourceData(SitePartSnapshot $snapshot): array
    {
        return [
            'set_id' => $snapshot->setId,
            'title' => $snapshot->title,
            'document' => $snapshot->document->toArray(),
            'lock_version' => $snapshot->lockVersion,
            'revision' => $snapshot->revision,
            'active_revision' => $snapshot->activeRevision,
            'status' => $snapshot->activeRevision === null
                ? 'draft'
                : ($snapshot->hasUnpublishedChanges() ? 'published_with_changes' : 'published'),
            'created_at' => $snapshot->createdAt?->format(DATE_ATOM),
            'updated_at' => $snapshot->updatedAt?->format(DATE_ATOM),
            'published_at' => $snapshot->publishedAt?->format(DATE_ATOM),
        ];
    }

    private function actorId(Request $request): ?int
    {
        $identifier = $request->user()?->getAuthIdentifier();

        return is_numeric($identifier) ? (int) $identifier : null;
    }

    private function success(string $message, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function invalid(Request $request, mixed $errors): JsonResponse
    {
        return $this->error($request, 400, 'G7PB_SITE_PART_SET_INVALID', '헤더·푸터 세트 입력이 올바르지 않습니다.', [
            'errors' => $errors,
        ]);
    }

    /** @param array<string, mixed> $data */
    private function error(Request $request, int $status, string $code, string $message, array $data = []): JsonResponse
    {
        $correlationId = bin2hex(random_bytes(8));

        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => $code, 'correlation_id' => $correlationId, ...$data],
            'correlation_id' => $correlationId,
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function unexpected(Request $request, \Throwable $exception): JsonResponse
    {
        Log::error('Page Builder Site Part set API failed.', ['exception' => $exception]);

        return $this->error($request, 500, 'G7PB_INTERNAL_ERROR', '요청을 처리하지 못했습니다.');
    }
}
