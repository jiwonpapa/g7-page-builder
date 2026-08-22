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
    /** @var list<string> */
    private const DOWNLOAD_EXTENSIONS = ['pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];

    /** @var array<string, list<string>> */
    private const DOWNLOAD_MIME_TYPES = [
        'pdf' => ['application/pdf'],
        'zip' => ['application/zip', 'application/x-zip-compressed'],
        'doc' => ['application/msword', 'application/x-ole-storage', 'application/octet-stream'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
        'xls' => ['application/vnd.ms-excel', 'application/x-ole-storage', 'application/octet-stream'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
        'ppt' => ['application/vnd.ms-powerpoint', 'application/x-ole-storage', 'application/octet-stream'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'],
        'txt' => ['text/plain'],
        'csv' => ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
    ];

    public function __construct(private readonly MediaPort $media) {}

    public function index(Request $request): JsonResponse
    {
        $kind = $this->mediaKind($request, allowAll: true);
        if ($kind === null) {
            return $this->error($request, 422, 'G7PB_MEDIA_KIND_INVALID', '미디어 종류를 확인해 주세요.');
        }

        $assets = array_values(array_filter(
            $this->media->recent(),
            static fn (MediaAsset $asset): bool => $kind === 'all'
                || ($kind === 'image') === str_starts_with($asset->mimeType, 'image/'),
        ));

        return $this->success('미디어 목록을 조회했습니다.', [
            'items' => array_map(fn (MediaAsset $asset): array => $this->assetData($asset), $assets),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $kind = $this->mediaKind($request);
        if ($kind === null) {
            return $this->error($request, 422, 'G7PB_MEDIA_KIND_INVALID', '업로드할 파일 종류를 확인해 주세요.');
        }

        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'max:'.($kind === 'image' ? '10240' : '25600')],
        ]);

        if ($validator->fails()) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', $this->uploadHelp($kind));
        }

        $file = $request->file('file');
        if (! $file instanceof UploadedFile || ! $file->isValid()) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', '업로드한 파일이 올바르지 않습니다.');
        }

        $width = 0;
        $height = 0;
        if ($kind === 'image') {
            $dimensions = @getimagesize($file->getPathname());
            if (! is_array($dimensions)) {
                return $this->error($request, 422, 'G7PB_MEDIA_INVALID', '실제 이미지 파일만 업로드할 수 있습니다.');
            }
            $width = (int) $dimensions[0];
            $height = (int) $dimensions[1];
            if ($width < 1 || $height < 1 || $width > 12000 || $height > 12000) {
                return $this->error($request, 422, 'G7PB_MEDIA_DIMENSIONS_INVALID', '이미지 크기는 최대 12000×12000px까지 지원합니다.');
            }
        }

        $contents = file_get_contents($file->getPathname());
        $mimeType = $file->getMimeType();
        if (! is_string($contents) || ! is_string($mimeType)) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', '파일을 읽지 못했습니다.');
        }
        if ($kind === 'image' && ! in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'], true)) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', $this->uploadHelp($kind));
        }
        if ($kind === 'download' && ! $this->isAllowedDownload($file, $mimeType)) {
            return $this->error($request, 422, 'G7PB_MEDIA_INVALID', $this->uploadHelp($kind));
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

            return $this->success($kind === 'image' ? '이미지를 업로드했습니다.' : '다운로드 파일을 업로드했습니다.', $this->assetData($asset), 201);
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

            return $this->success('미디어 파일을 삭제했습니다.', ['media_id' => $media]);
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
            'kind' => str_starts_with($asset->mimeType, 'image/') ? 'image' : 'download',
            'created_at' => $asset->createdAt->format(DATE_ATOM),
        ];
    }

    private function mediaKind(Request $request, bool $allowAll = false): ?string
    {
        $kind = $request->input('kind', 'image');
        if (! is_string($kind)) {
            return null;
        }

        $allowed = $allowAll ? ['image', 'download', 'all'] : ['image', 'download'];

        return in_array($kind, $allowed, true) ? $kind : null;
    }

    private function uploadHelp(string $kind): string
    {
        return $kind === 'download'
            ? 'PDF, ZIP, Word, Excel, PowerPoint, TXT, CSV 파일을 25MB 이하로 업로드해 주세요.'
            : 'JPG, PNG, WebP, AVIF, GIF 이미지를 10MB 이하로 업로드해 주세요.';
    }

    private function isAllowedDownload(UploadedFile $file, string $mimeType): bool
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, self::DOWNLOAD_EXTENSIONS, true)) {
            return false;
        }

        return in_array($mimeType, self::DOWNLOAD_MIME_TYPES[$extension], true);
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
            'message' => '미디어 요청을 처리하지 못했습니다.',
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
