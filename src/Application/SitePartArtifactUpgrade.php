<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Application;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartArtifactPort;

/** An explicit pre-cutover operation; never part of a public request. */
final readonly class SitePartArtifactUpgrade
{
    public function __construct(private SitePartArtifactPort $artifacts, private SitePartHtmlCompiler $compiler) {}

    public function check(): void
    {
        $this->artifacts->assertReady();
    }

    public function missingCount(): int
    {
        return $this->artifacts->missingPublicationCount();
    }

    /** Prepare a bounded batch. Failure preserves previous artifacts and source JSON. */
    public function prepare(int $limit): int
    {
        if ($limit < 1 || $limit > 100) {
            throw new \InvalidArgumentException('Site Part preparation limit must be between 1 and 100.');
        }
        $prepared = 0;
        foreach ($this->artifacts->missingPublications($limit) as $source) {
            $artifact = $this->compiler->compile($source->document, $source->revision);
            $this->artifacts->prepareHistorical($source, $artifact);
            $prepared++;
        }

        return $prepared;
    }
}
