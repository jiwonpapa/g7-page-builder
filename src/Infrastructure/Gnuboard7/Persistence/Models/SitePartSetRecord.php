<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $locale
 * @property string $title
 * @property bool $is_active
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property \DateTimeInterface $created_at
 * @property \DateTimeInterface $updated_at
 */
final class SitePartSetRecord extends Model
{
    protected $table = 'g7pb_site_part_sets';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = [
        'id', 'locale', 'title', 'is_active', 'created_by', 'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
