<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $kind
 * @property string $locale
 * @property string $title
 * @property int $lock_version
 * @property int $current_revision
 * @property int|null $active_revision
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \DateTimeInterface|null $published_at
 * @property \DateTimeInterface $created_at
 * @property \DateTimeInterface $updated_at
 */
final class SitePartRecord extends Model
{
    protected $table = 'g7pb_site_parts';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = [
        'id', 'kind', 'locale', 'title', 'lock_version', 'current_revision', 'active_revision',
        'published_at', 'created_by', 'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'lock_version' => 'integer',
            'current_revision' => 'integer',
            'active_revision' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'published_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
