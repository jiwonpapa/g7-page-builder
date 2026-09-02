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
    ) {
        if (! in_array($kind, ['header', 'footer'], true) || $sourceRevision < 1 || $compilerVersion === ''
            || ! hash_equals(hash('sha256', $compilerVersion."\n".$html), $artifactSha256)) {
            throw new \InvalidArgumentException('Site Part artifact identity or digest is invalid.');
        }
    }
}
