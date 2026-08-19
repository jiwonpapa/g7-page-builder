<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $token_hash
 * @property string $document_id
 * @property int $revision
 * @property \DateTimeInterface $expires_at
 * @property int|null $created_by
 */
final class PreviewTokenRecord extends Model
{
    protected $table = 'g7pb_preview_tokens';

    protected $primaryKey = 'token_hash';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'token_hash',
        'document_id',
        'revision',
        'expires_at',
        'created_by',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'expires_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'created_by' => 'integer',
        ];
    }
}
