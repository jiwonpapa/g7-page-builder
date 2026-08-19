<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Publishing;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;

final readonly class PreviewSource
{
    public function __construct(
        public string $title,
        public PageBuilderDocument $document,
        public int $revision,
    ) {}
}
