<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\MediaAsset;

final class AdminMediaController
{
    public function __construct(private readonly MediaPort $media) {}

    public function index(): JsonResponse
    {
        return $this->success('미디어 목록을 조회했습니다.', [
            'items' => array_map(fn (MediaAsset $asset): array => $this->assetData($asset), $this->media->recent()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'max:10240', 'mimetypes:image/jpeg,image/png,image/webp,image/avif,image/gif'],
        ]);

        if ($validator->fails()) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', 'JPG, PNG, WebP, AVIF, GIF 이미지를 10MB 이하로 업로드해 주세요.');
        }

        $file = $request->file('file');
        if (! $file instanceof UploadedFile || ! $file->isValid()) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', '업로드한 이미지 파일이 올바르지 않습니다.');
        }

        $dimensions = @getimagesize($file->getPathname());
        if (! is_array($dimensions)) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', '실제 이미지 파일만 업로드할 수 있습니다.');
        }
        $width = (int) $dimensions[0];
        $height = (int) $dimensions[1];
        if ($width < 1 || $height < 1 || $width > 12000 || $height > 12000) {
            return $this->error($request, 422, 'G7PB_MEDIA_DIMENSIONS_INVALID', '이미지 크기는 최대 12000×12000px까지 지원합니다.');
        }

        $contents = file_get_contents($file->getPathname());
        $mimeType = $file->getMimeType();
        if (! is_string($contents) || ! is_string($mimeType)) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', '이미지 파일을 읽지 못했습니다.');
        }

        try {
            $asset = $this->media->store(
                $file->getClientOriginalName(),
                $mimeType,
                $contents,
                $width,
                $height,
                $this->actorId($request),
            );

            return $this->success('이미지를 업로드했습니다.', $this->assetData($asset), 201);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    public function destroy(Request $request, string $media): JsonResponse
    {
        try {
            $this->media->delete($media);

            return $this->success('이미지를 삭제했습니다.', ['media_id' => $media]);
        } catch (\DomainException $exception) {
            return $this->error($request, 409, 'G7PB_MEDIA_IN_USE', $exception->getMessage());
        } catch (\Throwable $exception) {
            return $this->unexpected($request, $exception);
        }
    }

    /** @return array<string, mixed> */
    private function assetData(MediaAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'url' => $asset->url,
            'original_name' => $asset->originalName,
            'mime_type' => $asset->mimeType,
            'bytes' => $asset->bytes,
            'width' => $asset->width,
            'height' => $asset->height,
            'created_at' => $asset->createdAt->format(DATE_ATOM),
        ];
    }

    private function actorId(Request $request): ?int
    {
        $identifier = $request->user()?->getAuthIdentifier();

        return is_numeric($identifier) ? (int) $identifier : null;
    }

    private function success(string $message, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function error(Request $request, int $status, string $code, string $message): JsonResponse
    {
        $correlationId = $this->correlationId($request);
        Log::warning('G7 Page Builder media request was rejected.', [
            'correlation_id' => $correlationId,
            'code' => $code,
            'status' => $status,
            'path' => $request->path(),
        ]);

        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => ['code' => $code, 'correlation_id' => $correlationId],
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    private function unexpected(Request $request, \Throwable $exception): JsonResponse
    {
        $correlationId = $this->correlationId($request);
        Log::error('G7 Page Builder media request failed.', [
            'correlation_id' => $correlationId,
            'exception' => $exception,
        ]);

        return response()->json([
            'success' => false,
            'message' => '이미지 요청을 처리하지 못했습니다.',
            'data' => ['code' => 'G7PB_MEDIA_INTERNAL_ERROR', 'correlation_id' => $correlationId],
        ], 500, [], JSON_UNESCAPED_UNICODE);
    }

    private function correlationId(Request $request): string
    {
        $provided = $request->header('X-Correlation-ID');
        if (is_string($provided) && preg_match('/^[A-Za-z0-9._-]{8,100}$/', $provided) === 1) {
            return $provided;
        }

        return bin2hex(random_bytes(16));
    }
}
