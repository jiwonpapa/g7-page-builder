<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Application\Store\OfficialStoreService;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class AdminOfficialStoreController
{
    public function __construct(private readonly OfficialStoreService $store) {}

    public function index(Request $request): JsonResponse
    {
        try {
            return $this->success('지원소프트 공식 무료 마켓을 조회했습니다.', $this->store->catalog());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception, '공식 무료 마켓을 불러오지 못했습니다.');
        }
    }

    public function installBlockPack(Request $request): JsonResponse
    {
        $identity = $this->identity($request);
        if ($identity instanceof JsonResponse) {
            return $identity;
        }
        try {
            $installation = $this->store->installBlockPack(
                $identity['product_id'],
                $identity['product_version'],
                $this->actorId($request),
            );

            return $this->success('공식 Block Pack을 검증하고 설치했습니다.', $this->installationData($installation), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 422, 'G7PB_STORE_PRODUCT_INVALID', $exception->getMessage());
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_STORE_INSTALL_REJECTED', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception, '공식 Block Pack을 설치하지 못했습니다.');
        }
    }

    public function applyPageKit(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'product_id' => ['required', 'string', 'max:128', 'regex:/^jiwonpapa\/[a-z0-9][a-z0-9._-]{1,63}$/'],
            'product_version' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
        ]);
        if ($validator->fails()) {
            return $this->error($request, 422, 'G7PB_STORE_PAGE_KIT_INVALID', 'Page Kit 적용 정보가 올바르지 않습니다.');
        }
        try {
            $validated = $validator->validated();
            $snapshot = $this->store->applyPageKit(
                $this->validatedString($validated, 'product_id'),
                $this->validatedString($validated, 'product_version'),
                trim($this->validatedString($validated, 'title')),
                $this->validatedString($validated, 'slug'),
                $this->actorId($request),
            );

            return $this->success('Page Kit을 새 미발행 초안으로 적용했습니다.', $this->snapshotData($snapshot), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 422, 'G7PB_STORE_PAGE_KIT_INVALID', $exception->getMessage());
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_STORE_PAGE_KIT_REJECTED', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception, 'Page Kit을 적용하지 못했습니다.');
        }
    }

    public function exportPageKit(Request $request, string $document): JsonResponse|BinaryFileResponse
    {
        $validator = Validator::make($request->query->all(), [
            'kit_id' => ['required', 'string', 'max:128', 'regex:/^jiwonpapa\/[a-z0-9][a-z0-9._-]{1,63}$/'],
            'kit_version' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['required', 'string', 'max:1000'],
        ]);
        if ($validator->fails()) {
            return $this->error($request, 422, 'G7PB_STORE_PAGE_KIT_EXPORT_INVALID', 'Page Kit 배포 정보를 확인해 주세요.');
        }
        try {
            $validated = $validator->validated();
            $kitId = $this->validatedString($validated, 'kit_id');
            $kitVersion = $this->validatedString($validated, 'kit_version');
            $artifact = $this->store->exportPageKit(
                $document,
                $kitId,
                $kitVersion,
                $this->validatedString($validated, 'title'),
                $this->validatedString($validated, 'description'),
            );
            $name = str_replace('/', '-', $kitId).'-'.$kitVersion.'.zip';

            return response()->download($artifact->path, $name, [
                'Content-Type' => 'application/zip',
                'X-Content-Type-Options' => 'nosniff',
                'X-G7PB-SHA256' => $artifact->sha256,
            ])->deleteFileAfterSend(true);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 422, 'G7PB_STORE_PAGE_KIT_EXPORT_INVALID', $exception->getMessage());
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_STORE_PAGE_KIT_EXPORT_REJECTED', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception, 'Page Kit 배포 ZIP을 만들지 못했습니다.');
        }
    }

    /** @return array{product_id: string, product_version: string}|JsonResponse */
    private function identity(Request $request): array|JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'product_id' => ['required', 'string', 'max:128', 'regex:/^jiwonpapa\/[a-z0-9][a-z0-9._-]{1,63}$/'],
            'product_version' => ['required', 'string', 'max:64'],
        ]);
        if ($validator->fails()) {
            return $this->error($request, 422, 'G7PB_STORE_PRODUCT_INVALID', '공식 마켓 상품 정보가 올바르지 않습니다.');
        }

        $validated = $validator->validated();

        return [
            'product_id' => $this->validatedString($validated, 'product_id'),
            'product_version' => $this->validatedString($validated, 'product_version'),
        ];
    }

    /** @param array<string, mixed> $validated */
    private function validatedString(array $validated, string $key): string
    {
        $value = $validated[$key] ?? null;
        if (! is_string($value)) {
            throw new \InvalidArgumentException("{$key} 값이 올바르지 않습니다.");
        }

        return $value;
    }

    /** @return array<string, mixed> */
    private function installationData(BlockPackInstallation $installation): array
    {
        return [
            'pack_id' => $installation->manifest->packId,
            'pack_version' => $installation->manifest->packVersion,
            'kind' => $installation->manifest->kind,
            'publisher' => $installation->manifest->publisher,
            'state' => $installation->state->value,
            'source' => $installation->source,
            'source_uri' => $installation->sourceUri,
            'archive_sha256' => $installation->archiveSha256,
            'blocks' => count($installation->manifest->blocks),
            'presets' => count($installation->manifest->presets),
            'runtime_active' => true,
            'editor_asset_url' => null,
            'style_asset_urls' => [],
            'usage' => ['documents' => 0, 'revisions' => 0],
            'installed_at' => $installation->installedAt->format(DATE_ATOM),
            'updated_at' => $installation->updatedAt->format(DATE_ATOM),
        ];
    }

    /** @return array<string, mixed> */
    private function snapshotData(DocumentSnapshot $snapshot): array
    {
        return [
            'title' => $snapshot->title,
            'document' => $snapshot->document->toArray(),
            'lock_version' => $snapshot->lockVersion,
            'revision' => $snapshot->revision,
            'public_url' => null,
            'active_artifact_sha256' => null,
            'is_home' => false,
            'status' => 'draft',
            'has_unpublished_changes' => false,
            'created_at' => $snapshot->createdAt?->format(DATE_ATOM),
            'updated_at' => $snapshot->updatedAt?->format(DATE_ATOM),
            'published_at' => null,
            'archived_at' => null,
        ];
    }

    private function actorId(Request $request): ?int
    {
        $identifier = $request->user()?->getAuthIdentifier();

        return is_numeric($identifier) ? (int) $identifier : null;
    }

    private function success(string $message, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function error(Request $request, int $status, string $code, string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => $code, 'correlation_id' => $this->correlationId($request)],
        ], $status, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function unexpected(Request $request, \Throwable $exception, string $message): JsonResponse
    {
        $correlationId = $this->correlationId($request);
        Log::error('G7 Page Builder official store request failed.', [
            'correlation_id' => $correlationId,
            'exception' => $exception,
        ]);

        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => 'G7PB_STORE_INTERNAL_ERROR', 'correlation_id' => $correlationId],
        ], 500, [], JSON_UNESCAPED_UNICODE);
    }

    private function correlationId(Request $request): string
    {
        $provided = $request->header('X-Correlation-ID');

        return is_string($provided) && preg_match('/^[A-Za-z0-9._-]{8,100}$/', $provided) === 1
            ? $provided
            : bin2hex(random_bytes(12));
    }
}
