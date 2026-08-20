<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $document_id
 * @property int $source_revision
 * @property int|null $prepared_lock_version
 * @property string $title
 * @property string $slug
 * @property string $locale
 * @property string $shell_mode
 * @property string $compiler_version
 * @property string $target_engine_version
 * @property string $artifact
 * @property string $artifact_sha256
 * @property string|null $warnings_json
 * @property string $status
 * @property string|null $token_hash
 * @property \DateTimeInterface|null $expires_at
 * @property \DateTimeInterface|null $published_at
 * @property int|null $created_by
 */
final class PublicationRecord extends Model
{
    protected $table = 'g7pb_publications';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'document_id',
        'source_revision',
        'prepared_lock_version',
        'title',
        'slug',
        'locale',
        'shell_mode',
        'compiler_version',
        'target_engine_version',
        'artifact',
        'artifact_sha256',
        'warnings_json',
        'status',
        'token_hash',
        'expires_at',
        'published_at',
        'created_by',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'source_revision' => 'integer',
            'prepared_lock_version' => 'integer',
            'expires_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'created_by' => 'integer',
        ];
    }
}
