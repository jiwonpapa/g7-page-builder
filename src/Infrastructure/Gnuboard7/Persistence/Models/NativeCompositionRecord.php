<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models;

use Illuminate\Database\Eloquent\Model;

final class NativeCompositionRecord extends Model
{
    protected $table = 'g7pb_native_compositions';

    protected $primaryKey = 'composition_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];
}
