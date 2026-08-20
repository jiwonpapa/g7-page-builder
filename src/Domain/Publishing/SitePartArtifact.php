<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Publishing;

final readonly class SitePartArtifact
{
    public function __construct(
        public string $kind,
        public string $html,
        public string $artifactSha256,
        public string $compilerVersion,
        public int $sourceRevision,
    ) {}
}
