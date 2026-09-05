<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $document_id
 * @property string|null $path
 * @property int $lock_version
 */
final class PageRouteRecord extends Model
{
    protected $table = 'g7pb_page_routes';

    protected $primaryKey = 'document_id';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = ['document_id', 'path', 'lock_version'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['lock_version' => 'integer'];
    }
}
