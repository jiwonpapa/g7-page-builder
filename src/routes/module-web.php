<?php

use Illuminate\Support\Facades\Route;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\ViewerController;

Route::get('admin', [ViewerController::class, 'manager'])
    ->name('admin.index');

Route::get('admin/editor', [ViewerController::class, 'editor'])
    ->name('admin.editor');

Route::get('admin/site-parts/{kind}', [ViewerController::class, 'sitePartEditor'])
    ->whereIn('kind', ['header', 'footer'])
    ->name('admin.site-part');

Route::get('preview/{token}', [ViewerController::class, 'preview'])
    ->where('token', '[a-f0-9]{64}')
    ->name('preview');

Route::get('p/{slug}', [ViewerController::class, 'legacy'])
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
    ->name('public.page');
