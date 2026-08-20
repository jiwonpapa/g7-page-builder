<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Store;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;

final readonly class PageKitBundle
{
    /**
     * @param  array{page_builder: string, php: string, g7: string, document_schema: string}  $compatibility
     * @param  list<PageKitMedia>  $media
     */
    public function __construct(
        public string $kitId,
        public string $kitVersion,
        public string $title,
        public string $description,
        public array $compatibility,
        public PageBuilderDocument $document,
        public array $media,
    ) {
        StoreRules::assertProductId($this->kitId);
        StoreRules::assertSemver($this->kitVersion, 'Page Kit 버전');
        if ($this->title === '' || $this->description === ''
            || $this->compatibility['document_schema'] !== 'g7-page-builder/v1') {
            throw new \InvalidArgumentException('Page Kit 정보가 올바르지 않습니다.');
        }
    }
}
