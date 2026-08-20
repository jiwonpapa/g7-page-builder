<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Store;

final readonly class PageKitMedia
{
    public function __construct(
        public string $id,
        public string $path,
        public string $sha256,
        public string $originalName,
        public string $mimeType,
        public int $width,
        public int $height,
        public string $contents,
    ) {
        if (preg_match('/^[a-z0-9][a-z0-9._-]{1,63}$/', $this->id) !== 1
            || preg_match('#^media/[A-Za-z0-9._-]+$#', $this->path) !== 1) {
            throw new \InvalidArgumentException('Page Kit 미디어 식별자가 올바르지 않습니다.');
        }
        StoreRules::assertSha256($this->sha256, 'Page Kit 미디어 digest');
        if (! hash_equals($this->sha256, hash('sha256', $this->contents))) {
            throw new \InvalidArgumentException('Page Kit 미디어 digest가 일치하지 않습니다.');
        }
        if (! in_array($this->mimeType, ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'], true)
            || $this->width < 1 || $this->width > 12000 || $this->height < 1 || $this->height > 12000) {
            throw new \InvalidArgumentException('Page Kit 미디어 정보가 올바르지 않습니다.');
        }
    }
}
