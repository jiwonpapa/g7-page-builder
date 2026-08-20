<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Store;

final readonly class StoreArtifact
{
    public function __construct(
        public string $path,
        public string $sourceUrl,
        public string $sha256,
        public int $bytes,
        public bool $temporary = true,
    ) {
        if ($this->path === '' || ! is_file($this->path)) {
            throw new \InvalidArgumentException('마켓 아티팩트 파일을 찾을 수 없습니다.');
        }
        StoreRules::assertSha256($this->sha256, '마켓 아티팩트 digest');
        if ($this->bytes < 1 || filesize($this->path) !== $this->bytes) {
            throw new \InvalidArgumentException('마켓 아티팩트 크기가 올바르지 않습니다.');
        }
    }
}
