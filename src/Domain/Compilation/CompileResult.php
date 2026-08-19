<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Compilation;

final readonly class CompileResult
{
    /**
     * @param  string|array<string, mixed>  $artifact
     * @param  list<string>  $warnings
     */
    public function __construct(
        public string $compilerVersion,
        public string $documentId,
        public int $sourceRevision,
        public string $targetFormat,
        public string $targetEngineVersion,
        public string|array $artifact,
        public string $artifactSha256,
        public array $warnings = [],
        public string $schemaVersion = 'g7-page-builder-compile-result/v1',
    ) {
        if ($this->sourceRevision < 1) {
            throw new \InvalidArgumentException('Source revision must be positive.');
        }

        if (! in_array($this->targetFormat, ['html', 'g7-json-ui'], true)) {
            throw new \InvalidArgumentException('Unsupported target format.');
        }

        if (preg_match('/^[a-f0-9]{64}$/', $this->artifactSha256) !== 1) {
            throw new \InvalidArgumentException('Artifact hash must be lowercase sha256.');
        }
    }
}
