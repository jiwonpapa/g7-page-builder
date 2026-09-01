<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

final class SectionPatternRecord extends Model
{
    protected $table = 'g7pb_section_patterns';

    protected $primaryKey = 'pattern_id';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = [
        'pattern_id', 'actor_id', 'title', 'category', 'schema_version', 'source_document_schema',
        'section_json', 'required_blocks_json', 'asset_references_json', 'preview_json',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'actor_id' => 'integer',
            'section_json' => 'array',
            'required_blocks_json' => 'array',
            'asset_references_json' => 'array',
            'preview_json' => 'array',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
