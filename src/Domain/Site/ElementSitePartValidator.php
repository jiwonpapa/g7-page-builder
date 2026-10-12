<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\LayoutPolicy;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Schema;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use stdClass;

/** Composition supplies schemas. The shared page validator owns all element rules. */
final readonly class ElementSitePartValidator
{
    private Validator $documents;

    /** @param array<string, mixed> $envelope
     * @param  array<string, mixed>  $documentSchema
     * @param  array<string, mixed>  $policy
     */
    public function __construct(private array $envelope, private array $documentSchema, private array $policy)
    {
        if (($envelope['properties']['content']['$ref'] ?? null) !== ($documentSchema['$id'] ?? null)) {
            Schema::reject('schema', '$.content');
        }
        $this->documents = new Validator($documentSchema, $policy);
    }

    /** @return array{schema_version: string, kind: string, content: ValidatedDocument} */
    public function validateJson(string $json): array
    {
        $value = Schema::decode($json, $this->policy['limits']['json_depth'] + 1);
        if (LayoutPolicy::compactJsonBytes($value) > $this->policy['limits']['utf8_bytes']) {
            Schema::reject('byte_limit');
        }
        $rule = $this->envelope;
        $rule['properties']['content'] = $this->documentSchema;
        Schema::validate($value, $rule, $this->documentSchema['$defs']);
        if (! $value instanceof stdClass || ! $value->content instanceof stdClass) {
            Schema::reject('shape');
        }
        $content = ValidatedDocument::fromJson(json_encode($value->content, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION), $this->documents);
        if ($content->shellMode !== 'none') {
            Schema::reject('site_part_shell', '$.content.shell_mode');
        }
        if (property_exists($value->content, 'seo')) {
            Schema::reject('site_part_seo', '$.content.seo');
        }

        return ['schema_version' => $value->schema_version, 'kind' => $value->kind, 'content' => $content];
    }
}
