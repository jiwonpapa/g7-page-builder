<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $slug
 * @property string $title
 * @property string $mode
 * @property string $locale
 * @property int $lock_version
 * @property int $current_revision
 * @property string|null $active_publication_id
 * @property bool $is_home
 * @property int|null $created_by
 * @property int|null $updated_by
 */
final class DocumentRecord extends Model
{
    protected $table = 'g7pb_documents';

    protected $keyType = 'string';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'slug',
        'title',
        'mode',
        'locale',
        'lock_version',
        'current_revision',
        'active_publication_id',
        'is_home',
        'created_by',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'lock_version' => 'integer',
            'current_revision' => 'integer',
            'is_home' => 'boolean',
            'created_by' => 'integer',
            'updated_by' => 'integer',
        ];
    }
}
