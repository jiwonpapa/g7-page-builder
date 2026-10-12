<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3;

use stdClass;

final readonly class Migration
{
    /** @param array<string, mixed> $policy */
    public function __construct(private array $policy) {}

    /** Explicit snapshot preparation, not conversion or source validation.
     * @return array{source_json: string, source_revision: int, source_schema: string, target_schema: string, publish: false}
     */
    public function prepare(string $sourceJson, int $sourceRevision, int $expectedRevision, bool $explicitChoice): array
    {
        if (! $explicitChoice) {
            Schema::reject('explicit_choice');
        }
        if ($sourceRevision < 1 || $sourceRevision > 9007199254740991 || $sourceRevision !== $expectedRevision) {
            Schema::reject('source_revision');
        }
        if (strlen($sourceJson) > $this->policy['migration']['source_max_bytes']) {
            Schema::reject('byte_limit');
        }
        $source = Schema::decode($sourceJson, $this->policy['limits']['json_depth']);
        if (! $source instanceof stdClass || ! is_string($source->schema_version ?? null) || ! in_array($source->schema_version, $this->policy['migration']['source_schemas'], true)) {
            Schema::reject('source_schema');
        }

        return ['source_json' => $sourceJson, 'source_revision' => $sourceRevision, 'source_schema' => $source->schema_version,
            'target_schema' => $this->policy['schema_version'], 'publish' => false];
    }
}
