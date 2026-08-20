<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $pack_id
 * @property string $pack_version
 * @property string $kind
 * @property string $state
 * @property string $manifest_json
 * @property string $source
 * @property string $source_reference
 * @property string|null $source_uri
 * @property string|null $archive_sha256
 * @property \DateTimeInterface $installed_at
 * @property int|null $installed_by
 * @property \DateTimeInterface $updated_at
 */
final class BlockPackRecord extends Model
{
    protected $table = 'g7pb_block_packs';

    public $incrementing = false;

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'pack_id', 'pack_version', 'kind', 'state', 'manifest_json', 'source', 'source_reference', 'source_uri',
        'archive_sha256', 'installed_at', 'installed_by', 'updated_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'installed_at' => 'immutable_datetime',
            'installed_by' => 'integer',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
