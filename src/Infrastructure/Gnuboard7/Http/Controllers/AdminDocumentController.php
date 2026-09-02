<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\DocumentNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\PublicationCommitException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\RevisionNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\SlugAlreadyExistsException;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7TemplateRouteBridge;

final class AdminDocumentController
{
    public function __construct(
        private readonly PageBuilderService $service,
        private readonly ?G7TemplateRouteBridge $templateRoutes = null,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query->all(), [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'status' => ['sometimes', 'in:active,archived,all'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        $status = $request->query('status', 'active');
        $result = $this->service->paginate(
            max(1, (int) $request->query('page', '1')),
            min(100, max(1, (int) $request->query('per_page', '20'))),
            is_string($status) ? $status : 'active',
        );

        return $this->success('페이지 목록을 조회했습니다.', [
            'items' => array_map(fn (DocumentSnapshot $snapshot): array => $this->snapshotData($snapshot), $result['items']),
            'pagination' => [
                'total' => $result['total'],
                'page' => $result['page'],
                'per_page' => $result['per_page'],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'locale' => ['sometimes', 'string', 'min:2', 'max:16'],
            'mode' => ['sometimes', 'in:canvas'],
            'shell_mode' => ['sometimes', 'in:template,builder,none,global'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->service->create(
                trim((string) $request->input('title')),
                (string) $request->input('slug'),
                (string) $request->input('locale', 'ko'),
                $this->actorId($request),
                (string) $request->input('shell_mode', 'template'),
            );

            return $this->success('페이지 문서를 생성했습니다.', $this->snapshotData($snapshot), 201);
        } catch (SlugAlreadyExistsException $exception) {
            return $this->domainError($request, 409, 'G7PB_DOCUMENT_INVALID', $exception->getMessage());
        } catch (\InvalidArgumentException $exception) {
            return $this->domainError($request, 400, 'G7PB_DOCUMENT_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function show(Request $request, string $document): JsonResponse
    {
        try {
            return $this->success(
                '페이지 문서를 조회했습니다.',
                $this->snapshotData($this->service->get($document)),
            );
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function duplicate(Request $request, string $document): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'expected_lock_version' => ['required', 'integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->service->duplicate(
                $document,
                trim((string) $request->input('title')),
                (string) $request->input('slug'),
                (int) $request->input('expected_lock_version'),
                $this->actorId($request),
            );

            return $this->success('문서를 새 초안으로 복제했습니다.', $this->snapshotData($snapshot), 201);
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (SlugAlreadyExistsException $exception) {
            return $this->domainError(
                $request,
                409,
                'G7PB_DOCUMENT_SLUG_CONFLICT',
                '이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해 주세요.',
            );
        } catch (\InvalidArgumentException $exception) {
            return $this->domainError($request, 400, 'G7PB_DOCUMENT_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function revisions(Request $request, string $document): JsonResponse
    {
        $validator = Validator::make($request->query->all(), [
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->service->get($document);

            return $this->success('리비전 목록을 조회했습니다.', [
                'current_revision' => $snapshot->revision,
                'items' => array_map(
                    fn (DocumentRevision $revision): array => $this->revisionData($revision, false),
                    $this->service->revisions($document, (int) $request->query('limit', '20')),
                ),
            ]);
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function showRevision(Request $request, string $document, int $revision): JsonResponse
    {
        try {
            return $this->success(
                '리비전을 조회했습니다.',
                $this->revisionData($this->service->revision($document, $revision), true),
            );
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (RevisionNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_REVISION_NOT_FOUND', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function previewRevision(Request $request, string $document, int $revision): JsonResponse
    {
        try {
            $source = $this->service->revision($document, $revision);
            $ticket = $this->service->previewRevision($document, $revision, $this->actorId($request));

            return $this->success('리비전 미리보기를 준비했습니다.', [
                'preview_url' => $this->previewUrl($ticket->token, $source->document->shellMode),
                'expires_at' => $ticket->expiresAt->format(DATE_ATOM),
            ]);
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (RevisionNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_REVISION_NOT_FOUND', $exception->getMessage());
        } catch (DocumentCompileException $exception) {
            return $this->domainError($request, 422, $exception->errorCode, $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function restoreRevision(Request $request, string $document, int $revision): JsonResponse
    {
        $lockVersion = $this->validatedLockVersion($request);

        if ($lockVersion instanceof JsonResponse) {
            return $lockVersion;
        }

        try {
            $snapshot = $this->service->restoreRevision(
                $document,
                $revision,
                $lockVersion,
                $this->actorId($request),
            );

            return $this->success('선택한 리비전을 새 초안으로 복원했습니다.', $this->snapshotData($snapshot));
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (RevisionNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_REVISION_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (SlugAlreadyExistsException $exception) {
            return $this->domainError($request, 409, 'G7PB_DOCUMENT_INVALID', $exception->getMessage());
        } catch (\InvalidArgumentException $exception) {
            return $this->domainError($request, 422, 'G7PB_DOCUMENT_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function update(Request $request, string $document): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'locale' => ['required', 'string', 'min:2', 'max:16'],
            'expected_lock_version' => ['required', 'integer', 'min:1'],
            'shell_mode' => ['sometimes', 'in:template,builder,none,global'],
            'seo' => ['sometimes', 'array:title,description,og_image_url,robots'],
            'seo.title' => ['sometimes', 'nullable', 'string', 'max:70'],
            'seo.description' => ['sometimes', 'nullable', 'string', 'max:200'],
            'seo.og_image_url' => ['sometimes', 'nullable', 'string', 'max:2048', 'regex:#^(?:/[^\\s]*|https://[^\\s]+)$#u'],
            'seo.robots' => ['sometimes', 'in:index,noindex'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->service->updateMetadata(
                $document,
                trim((string) $request->input('title')),
                (string) $request->input('slug'),
                (string) $request->input('locale'),
                (int) $request->input('expected_lock_version'),
                $this->actorId($request),
                $request->has('shell_mode') ? (string) $request->input('shell_mode') : null,
                $this->seoInput($request),
            );

            return $this->success('페이지 정보를 수정했습니다.', $this->snapshotData($snapshot));
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (SlugAlreadyExistsException|\InvalidArgumentException $exception) {
            return $this->domainError($request, 400, 'G7PB_DOCUMENT_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function saveDraft(Request $request, string $document): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'expected_lock_version' => ['required', 'integer', 'min:1'],
            'document' => ['required', 'array'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            /** @var array<string, mixed> $payload */
            $payload = $request->input('document');
            $snapshot = $this->service->saveDraft(
                $document,
                $payload,
                (int) $request->input('expected_lock_version'),
                $this->actorId($request),
            );

            return $this->success('초안을 저장했습니다.', $this->snapshotData($snapshot));
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (SlugAlreadyExistsException|\InvalidArgumentException $exception) {
            return $this->domainError($request, 400, 'G7PB_DOCUMENT_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function preview(Request $request, string $document): JsonResponse
    {
        $lockVersion = $this->validatedLockVersion($request);

        if ($lockVersion instanceof JsonResponse) {
            return $lockVersion;
        }

        try {
            $snapshot = $this->service->get($document);
            $ticket = $this->service->preview($document, $lockVersion, $this->actorId($request));

            return $this->success('미리보기를 준비했습니다.', [
                'preview_url' => $this->previewUrl($ticket->token, $snapshot->document->shellMode),
                'expires_at' => $ticket->expiresAt->format(DATE_ATOM),
            ]);
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (DocumentCompileException $exception) {
            return $this->domainError($request, 422, $exception->errorCode, $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function preparePublication(Request $request, string $document): JsonResponse
    {
        $lockVersion = $this->validatedLockVersion($request);

        if ($lockVersion instanceof JsonResponse) {
            return $lockVersion;
        }

        try {
            $candidate = $this->service->preparePublication(
                $document,
                $lockVersion,
                $this->actorId($request),
            );

            return $this->success('발행 후보를 준비했습니다.', [
                'publication_token' => $candidate->token,
                'artifact_sha256' => $candidate->artifactSha256,
                'warnings' => $candidate->warnings,
            ]);
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (DocumentCompileException $exception) {
            return $this->domainError($request, 422, $exception->errorCode, $exception->getMessage());
        } catch (SlugAlreadyExistsException $exception) {
            return $this->domainError($request, 409, 'G7PB_PUBLIC_SLUG_CONFLICT', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function commitPublication(Request $request, string $token): JsonResponse
    {
        try {
            $page = $this->service->commitPublication($token);
            $this->templateRoutes?->invalidate();

            return $this->success('페이지를 발행했습니다.', [
                'public_url' => url('/pages/'.$page->slug),
                'artifact_sha256' => $page->artifactSha256,
                'published_at' => $page->publishedAt?->format(DATE_ATOM),
            ]);
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (PublicationCommitException $exception) {
            return $this->domainError($request, 409, 'G7PB_PUBLICATION_INVALID', $exception->getMessage());
        } catch (SlugAlreadyExistsException $exception) {
            return $this->domainError($request, 409, 'G7PB_PUBLIC_SLUG_CONFLICT', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function unpublish(Request $request, string $document): JsonResponse
    {
        $lockVersion = $this->validatedLockVersion($request);

        if ($lockVersion instanceof JsonResponse) {
            return $lockVersion;
        }

        try {
            $snapshot = $this->service->unpublish(
                $document,
                $lockVersion,
                $this->actorId($request),
            );
            $this->templateRoutes?->invalidate();

            return $this->success('페이지 공개를 해제했습니다.', $this->snapshotData($snapshot));
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function setHome(Request $request, string $document): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'enabled' => ['required', 'boolean'],
            'expected_lock_version' => ['required', 'integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $snapshot = $this->service->setHome(
                $document,
                (bool) $request->boolean('enabled'),
                (int) $request->input('expected_lock_version'),
                $this->actorId($request),
            );
            $this->templateRoutes?->invalidate();

            return $this->success(
                $snapshot->isHome ? '홈 페이지로 지정했습니다.' : '홈 페이지 지정을 해제했습니다.',
                $this->snapshotData($snapshot),
            );
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (PublicationCommitException $exception) {
            return $this->domainError($request, 409, 'G7PB_HOME_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function archive(Request $request, string $document): JsonResponse
    {
        $lockVersion = $this->validatedLockVersion($request);

        if ($lockVersion instanceof JsonResponse) {
            return $lockVersion;
        }

        try {
            $snapshot = $this->service->archive($document, $lockVersion, $this->actorId($request));
            $this->templateRoutes?->invalidate();

            return $this->success(
                '페이지 문서를 보관함으로 이동했습니다.',
                $this->snapshotData($snapshot),
            );
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function restoreArchived(Request $request, string $document): JsonResponse
    {
        $lockVersion = $this->validatedLockVersion($request);

        if ($lockVersion instanceof JsonResponse) {
            return $lockVersion;
        }

        try {
            return $this->success(
                '페이지 문서를 보관함에서 복원했습니다.',
                $this->snapshotData($this->service->restoreArchived($document, $lockVersion, $this->actorId($request))),
            );
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function purge(Request $request, string $document): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'expected_lock_version' => ['required', 'integer', 'min:1'],
            'confirmation_slug' => ['required', 'string', 'max:120'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($request, $validator->errors()->toArray());
        }

        try {
            $this->service->purge(
                $document,
                (int) $request->input('expected_lock_version'),
                (string) $request->input('confirmation_slug'),
            );
            $this->templateRoutes?->invalidate();

            return $this->success('페이지 문서를 영구 삭제했습니다.', ['document_id' => $document]);
        } catch (DocumentNotFoundException $exception) {
            return $this->domainError($request, 404, 'G7PB_DOCUMENT_NOT_FOUND', $exception->getMessage());
        } catch (LockConflictException $exception) {
            return $this->lockConflict($request, $exception);
        } catch (\DomainException $exception) {
            return $this->domainError($request, 409, 'G7PB_DOCUMENT_LIFECYCLE_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshotData(DocumentSnapshot $snapshot): array
    {
        return [
            'title' => $snapshot->title,
            'document' => $snapshot->document->toArray(),
            'lock_version' => $snapshot->lockVersion,
            'revision' => $snapshot->revision,
            'public_url' => $snapshot->activeArtifactSha256 === null || $snapshot->activePublicSlug === null
                ? null
                : url('/pages/'.$snapshot->activePublicSlug),
            'active_artifact_sha256' => $snapshot->activeArtifactSha256,
            'is_home' => $snapshot->isHome,
            'status' => $snapshot->archivedAt !== null
                ? 'archived'
                : ($snapshot->activeArtifactSha256 === null
                    ? 'draft'
                    : ($snapshot->hasUnpublishedChanges ? 'published_with_changes' : 'published')),
            'has_unpublished_changes' => $snapshot->hasUnpublishedChanges,
            'created_at' => $snapshot->createdAt?->format(DATE_ATOM),
            'updated_at' => $snapshot->updatedAt?->format(DATE_ATOM),
            'published_at' => $snapshot->publishedAt?->format(DATE_ATOM),
            'archived_at' => $snapshot->archivedAt?->format(DATE_ATOM),
        ];
    }

    private function previewUrl(string $token, string $shellMode): string
    {
        $url = url('/modules/jiwonpapa-page_builder/preview/'.$token);

        return $shellMode === 'template' ? $url.'?shell=template' : $url;
    }

    /** @return array<string, mixed> */
    private function revisionData(DocumentRevision $revision, bool $includeDocument): array
    {
        $data = [
            'revision' => $revision->revision,
            'schema_version' => $revision->schemaVersion,
            'title' => $revision->title,
            'slug' => $revision->document->slug,
            'locale' => $revision->document->locale,
            'block_count' => count($revision->document->blocks),
            'author_id' => $revision->authorId,
            'created_at' => $revision->createdAt->format(DATE_ATOM),
        ];

        if ($includeDocument) {
            $data['document'] = $revision->document->toArray();
        }

        return $data;
    }

    private function validatedLockVersion(Request $request): int|JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'expected_lock_version' => ['required', 'integer', 'min:1'],
        ]);

        return $validator->fails()
            ? $this->invalid($request, $validator->errors()->toArray())
            : (int) $request->input('expected_lock_version');
    }

    private function actorId(Request $request): ?int
    {
        $identifier = $request->user()?->getAuthIdentifier();

        return is_numeric($identifier) ? (int) $identifier : null;
    }

    /** @return array{title: string, description: string, og_image_url: string, robots: string}|null */
    private function seoInput(Request $request): ?array
    {
        $seo = $request->input('seo');
        if (! is_array($seo)) {
            return null;
        }

        return [
            'title' => is_string($seo['title'] ?? null) ? $seo['title'] : '',
            'description' => is_string($seo['description'] ?? null) ? $seo['description'] : '',
            'og_image_url' => is_string($seo['og_image_url'] ?? null) ? $seo['og_image_url'] : '',
            'robots' => is_string($seo['robots'] ?? null) ? $seo['robots'] : 'index',
        ];
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
        return $this->domainError($request, 400, 'G7PB_DOCUMENT_INVALID', '페이지 문서 입력이 올바르지 않습니다.', [
            'errors' => $errors,
        ]);
    }

    private function lockConflict(Request $request, LockConflictException $exception): JsonResponse
    {
        return $this->domainError($request, 409, 'G7PB_LOCK_CONFLICT', $exception->getMessage(), [
            'current_lock_version' => $exception->currentLockVersion,
        ]);
    }

    /**
     * @param  array<string, mixed>  $details
     */
    private function domainError(
        Request $request,
        int $status,
        string $code,
        string $message,
        array $details = [],
    ): JsonResponse {
        $correlationId = $this->correlationId($request);
        Log::warning('G7 Page Builder request was rejected.', [
            'correlation_id' => $correlationId,
            'code' => $code,
            'status' => $status,
            'path' => $request->path(),
            'message' => $message,
        ]);

        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => [
                'code' => $code,
                'correlation_id' => $correlationId,
                ...$details,
            ],
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function unexpected(Request $request, \Throwable $exception): JsonResponse
    {
        $correlationId = $this->correlationId($request);
        Log::error('G7 Page Builder request failed.', [
            'correlation_id' => $correlationId,
            'exception' => $exception,
        ]);

        return response()->json([
            'success' => false,
            'message' => '페이지 빌더 요청을 처리하지 못했습니다.',
            'data' => [
                'code' => 'G7PB_INTERNAL_ERROR',
                'correlation_id' => $correlationId,
            ],
        ], 500, [], JSON_UNESCAPED_UNICODE);
    }

    private function correlationId(Request $request): string
    {
        $provided = $request->header('X-Correlation-ID');

        if (is_string($provided) && preg_match('/^[A-Za-z0-9._-]{8,100}$/', $provided) === 1) {
            return $provided;
        }

        return bin2hex(random_bytes(12));
    }
}
