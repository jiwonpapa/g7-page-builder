<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $site_part_id
 * @property int $revision
 * @property string $schema_version
 * @property string $title
 * @property string $document_json
 * @property int|null $author_id
 * @property \DateTimeInterface $created_at
 * @property \DateTimeInterface $updated_at
 */
final class SitePartRevisionRecord extends Model
{
    protected $table = 'g7pb_site_part_revisions';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = [
        'id', 'site_part_id', 'revision', 'schema_version', 'title', 'document_json', 'author_id',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'author_id' => 'integer',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
