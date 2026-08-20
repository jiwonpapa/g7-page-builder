<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Media;

final readonly class PortableMedia
{
    public function __construct(
        public MediaAsset $asset,
        public string $contents,
    ) {
        if (strlen($this->contents) !== $this->asset->bytes) {
            throw new \InvalidArgumentException('내보낼 미디어 크기가 저장 정보와 일치하지 않습니다.');
        }
    }
}
