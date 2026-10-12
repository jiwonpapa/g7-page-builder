<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Publishing;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDocument;

final readonly class PreviewSource
{
    public function __construct(
        public string $title,
        public PageDocument $document,
        public int $revision,
    ) {}
}
