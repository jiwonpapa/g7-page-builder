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
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;

final class AdminSitePartController
{
    public function __construct(
        private readonly SitePartService $siteParts,
        private readonly SiteShellService $siteShell,
    ) {}

    public function show(Request $request, string $kind): JsonResponse
    {
        $locale = $this->locale($request);
        if ($locale instanceof JsonResponse) {
            return $locale;
        }

        $setId = $request->query('set_id');
        if ($setId !== null && (! is_string($setId) || preg_match('/^[0-9a-f-]{36}$/i', $setId) !== 1)) {
            return $this->invalid($request, ['set_id' => ['Invalid Site Part set id.']]);
        }

        try {
            return $this->success('Site Part를 조회했습니다.', $this->data($this->siteParts->get($kind, $locale, $setId)));
        } catch (SitePartNotFoundException $exception) {
            return $this->error($request, 404, 'G7PB_SITE_PART_NOT_FOUND', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function bootstrap(Request $request, string $kind): JsonResponse
    {
        $locale = $this->locale($request);
        if ($locale instanceof JsonResponse) {
            return $locale;
        }

        try {
            $snapshot = $this->siteParts->bootstrap(
                $kind,
                $locale,
                $this->siteShell->get($locale)->shell,
                $this->actorId($request),
            );

            return $this->success('Site Part 초안을 준비했습니다.', $this->data($snapshot), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 400, 'G7PB_SITE_PART_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function saveDraft(Request $request, string $kind): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'title' => ['required', 'string', 'max:255'],
            'expected_lock_version' => ['required', 'integer', 'min:1'],
            'document' => ['required', 'array'],
            'set_id' => ['sometimes', 'uuid'],
        ]);
        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->siteParts->saveDraft(
                $kind,
                (string) $request->input('locale'),
                (string) $request->input('title'),
                (array) $request->input('document'),
                (int) $request->input('expected_lock_version'),
                $this->actorId($request),
                $this->optionalSetId($request),
            );

            return $this->success('Site Part 초안을 저장했습니다.', $this->data($snapshot));
        } catch (SitePartNotFoundException $exception) {
            return $this->error($request, 404, 'G7PB_SITE_PART_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->error($request, 409, 'G7PB_LOCK_CONFLICT', $exception->getMessage(), [
                'current_lock_version' => $exception->currentLockVersion,
            ]);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 400, 'G7PB_SITE_PART_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function publish(Request $request, string $kind): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'expected_lock_version' => ['required', 'integer', 'min:1'],
            'set_id' => ['sometimes', 'uuid'],
        ]);
        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            return $this->success('Site Part를 발행했습니다.', $this->data($this->siteParts->publish(
                $kind,
                (string) $request->input('locale'),
                (int) $request->input('expected_lock_version'),
                $this->actorId($request),
                $this->optionalSetId($request),
            )));
        } catch (SitePartNotFoundException $exception) {
            return $this->error($request, 404, 'G7PB_SITE_PART_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->error($request, 409, 'G7PB_LOCK_CONFLICT', $exception->getMessage(), [
                'current_lock_version' => $exception->currentLockVersion,
            ]);
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function revisions(Request $request, string $kind): JsonResponse
    {
        $validator = Validator::make($request->query->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'set_id' => ['sometimes', 'uuid'],
        ]);
        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        $locale = $request->query('locale');
        $limit = $request->query('limit', '20');
        if (! is_string($locale) || ! is_string($limit)) {
            return $this->invalid($request, ['query' => ['Invalid Site Part revision query.']]);
        }

        try {
            return $this->success('Site Part 리비전을 조회했습니다.', [
                'items' => array_map(
                    fn (SitePartRevision $revision): array => [
                        'revision' => $revision->revision,
                        'title' => $revision->title,
                        'document' => $revision->document->toArray(),
                        'author_id' => $revision->authorId,
                        'created_at' => $revision->createdAt->format(DATE_ATOM),
                    ],
                    $this->siteParts->revisions(
                        $kind,
                        $locale,
                        (int) $limit,
                        $this->optionalSetId($request),
                    ),
                ),
            ]);
        } catch (SitePartNotFoundException $exception) {
            return $this->error($request, 404, 'G7PB_SITE_PART_NOT_FOUND', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    private function locale(Request $request): string|JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'locale' => ['required', 'string', 'min:2', 'max:16'],
        ]);

        return $validator->fails()
            ? $this->invalid($request, $validator->errors()->toArray())
            : (string) $request->input('locale');
    }

    /** @return array<string, mixed> */
    private function data(SitePartSnapshot $snapshot): array
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

    private function optionalSetId(Request $request): ?string
    {
        $setId = $request->input('set_id');

        return is_string($setId) && $setId !== '' ? $setId : null;
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
        return $this->error($request, 400, 'G7PB_SITE_PART_INVALID', 'Site Part 입력이 올바르지 않습니다.', [
            'errors' => $errors,
        ]);
    }

    /** @param array<string, mixed> $data */
    private function error(Request $request, int $status, string $code, string $message, array $data = []): JsonResponse
    {
        $correlationId = $this->correlationId($request);

        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => $code, 'correlation_id' => $correlationId, ...$data],
            'correlation_id' => $correlationId,
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function unexpected(Request $request, \Throwable $exception): JsonResponse
    {
        $correlationId = $this->correlationId($request);
        Log::error('Page Builder Site Part API failed.', [
            'correlation_id' => $correlationId,
            'exception' => $exception,
        ]);

        return $this->error($request, 500, 'G7PB_INTERNAL_ERROR', '요청을 처리하지 못했습니다.');
    }

    private function correlationId(Request $request): string
    {
        $existing = $request->attributes->get('g7pb_correlation_id');
        if (is_string($existing) && preg_match('/^[a-f0-9]{16}$/', $existing) === 1) {
            return $existing;
        }

        $generated = bin2hex(random_bytes(8));
        $request->attributes->set('g7pb_correlation_id', $generated);

        return $generated;
    }
}
