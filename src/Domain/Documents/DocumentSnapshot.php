<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

final readonly class DocumentSnapshot
{
    public function __construct(
        public PageBuilderDocument $document,
        public string $title,
        public int $lockVersion,
        public int $revision,
        public ?string $activeArtifactSha256 = null,
        public ?string $activePublicSlug = null,
        public bool $isHome = false,
    ) {}
}
