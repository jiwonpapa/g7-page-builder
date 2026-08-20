<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Media;

final readonly class MediaAsset
{
    public function __construct(
        public string $id,
        public string $url,
        public string $originalName,
        public string $mimeType,
        public int $bytes,
        public int $width,
        public int $height,
        public \DateTimeImmutable $createdAt,
    ) {}
}
