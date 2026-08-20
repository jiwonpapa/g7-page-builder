<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Media\MediaAsset;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\PortableMedia;

interface MediaPort
{
    /** @return list<MediaAsset> */
    public function recent(int $limit = 100): array;

    public function store(
        string $originalName,
        string $mimeType,
        string $contents,
        int $width,
        int $height,
        ?int $actorId,
    ): MediaAsset;

    public function delete(string $mediaId): void;

    public function exportByUrl(string $url): ?PortableMedia;
}
