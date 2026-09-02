<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Domain\Publishing;

/** Both sides belong to one database statement snapshot of the active set. */
final readonly class PublishedSitePartSet
{
    public function __construct(
        public string $setId,
        public string $locale,
        public ?SitePartArtifact $header,
        public ?SitePartArtifact $footer,
    ) {
        if (($header !== null && $header->kind !== 'header') || ($footer !== null && $footer->kind !== 'footer')) {
            throw new \InvalidArgumentException('Published Site Part kinds do not match.');
        }
    }

    public function isComplete(): bool
    {
        return $this->header !== null && $this->footer !== null;
    }
}
