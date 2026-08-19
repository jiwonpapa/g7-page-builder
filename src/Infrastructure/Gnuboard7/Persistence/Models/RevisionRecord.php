<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $document_id
 * @property int $revision
 * @property string $schema_version
 * @property string|null $title
 * @property string $document_json
 * @property int|null $author_id
 * @property \DateTimeInterface $created_at
 */
final class RevisionRecord extends Model
{
    protected $table = 'g7pb_revisions';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'document_id',
        'revision',
        'schema_version',
        'title',
        'document_json',
        'author_id',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'author_id' => 'integer',
            'created_at' => 'immutable_datetime',
        ];
    }
}
