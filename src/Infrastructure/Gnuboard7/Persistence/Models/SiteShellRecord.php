<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $locale
 * @property string $config_json
 * @property int $lock_version
 * @property int|null $updated_by
 * @property \DateTimeInterface $created_at
 * @property \DateTimeInterface $updated_at
 */
final class SiteShellRecord extends Model
{
    protected $table = 'g7pb_site_shells';

    protected $primaryKey = 'locale';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = ['locale', 'config_json', 'lock_version', 'updated_by'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'lock_version' => 'integer',
            'updated_by' => 'integer',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
