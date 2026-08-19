<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Publishing;

final readonly class PreparedPublication
{
    /**
     * @param  list<string>  $warnings
     */
    public function __construct(
        public string $token,
        public string $artifactSha256,
        public array $warnings,
    ) {}
}
