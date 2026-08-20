<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $actor_id
 * @property string $catalog_id
 * @property \DateTimeInterface $created_at
 */
final class BlockFavoriteRecord extends Model
{
    protected $table = 'g7pb_block_favorites';

    public $incrementing = false;

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = ['actor_id', 'catalog_id', 'created_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'actor_id' => 'integer',
            'created_at' => 'immutable_datetime',
        ];
    }
}
