<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $disk
 * @property string $path
 * @property string $original_name
 * @property string $mime_type
 * @property int $bytes
 * @property int $width
 * @property int $height
 * @property int|null $created_by
 * @property \DateTimeInterface $created_at
 */
final class MediaRecord extends Model
{
    protected $table = 'g7pb_media';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'bytes',
        'width',
        'height',
        'created_by',
        'created_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'bytes' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'created_by' => 'integer',
            'created_at' => 'immutable_datetime',
        ];
    }
}
