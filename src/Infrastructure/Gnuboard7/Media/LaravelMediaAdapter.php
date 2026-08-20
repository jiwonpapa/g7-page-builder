<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Media;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Storage;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\MediaAsset;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\MediaRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PublicationRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\RevisionRecord;

final class LaravelMediaAdapter implements MediaPort
{
    public function recent(int $limit = 100): array
    {
        /** @var Collection<int, MediaRecord> $records */
        $records = MediaRecord::query()
            ->orderByDesc('created_at')
            ->limit(min(100, max(1, $limit)))
            ->get();
        $assets = [];
        foreach ($records as $record) {
            $assets[] = $this->asset($record);
        }

        return $assets;
    }

    public function store(
        string $originalName,
        string $mimeType,
        string $contents,
        int $width,
        int $height,
        ?int $actorId,
    ): MediaAsset {
        $id = $this->uuidV4();
        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/avif' => 'avif',
            'image/gif' => 'gif',
            default => throw new \InvalidArgumentException('지원하지 않는 이미지 형식입니다.'),
        };
        $path = 'g7-page-builder/'.date('Y/m').'/'.$id.'.'.$extension;

        if (! Storage::disk('public')->put($path, $contents, ['visibility' => 'public'])) {
            throw new \RuntimeException('이미지 파일을 저장하지 못했습니다.');
        }

        try {
            $record = MediaRecord::query()->create([
                'id' => $id,
                'disk' => 'public',
                'path' => $path,
                'original_name' => mb_substr($originalName, 0, 255),
                'mime_type' => $mimeType,
                'bytes' => strlen($contents),
                'width' => $width,
                'height' => $height,
                'created_by' => $actorId,
                'created_at' => new \DateTimeImmutable,
            ]);
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($path);
            throw $exception;
        }

        return $this->asset($record);
    }

    public function delete(string $mediaId): void
    {
        /** @var MediaRecord|null $record */
        $record = MediaRecord::query()->find($mediaId);
        if (! $record instanceof MediaRecord) {
            throw new \DomainException('미디어 파일을 찾을 수 없습니다.');
        }

        $url = $this->publicUrl($record->disk, $record->path);
        if (
            RevisionRecord::query()->where('document_json', 'like', '%'.$url.'%')->exists()
            || PublicationRecord::query()->where('artifact', 'like', '%'.$url.'%')->exists()
        ) {
            throw new \DomainException('페이지나 발행본에서 사용 중인 이미지는 삭제할 수 없습니다.');
        }

        Storage::disk($record->disk)->delete($record->path);
        $record->delete();
    }

    private function asset(MediaRecord $record): MediaAsset
    {
        return new MediaAsset(
            id: $record->id,
            url: $this->publicUrl($record->disk, $record->path),
            originalName: $record->original_name,
            mimeType: $record->mime_type,
            bytes: $record->bytes,
            width: $record->width,
            height: $record->height,
            createdAt: \DateTimeImmutable::createFromInterface($record->created_at),
        );
    }

    private function publicUrl(string $disk, string $path): string
    {
        if ($disk !== 'public') {
            throw new \RuntimeException('지원하지 않는 미디어 저장소입니다.');
        }

        return (string) url('/storage/'.ltrim($path, '/'));
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20));
    }
}
