<?php

use Illuminate\Support\Facades\Route;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\OfficialStoreDistributionController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\ViewerController;

Route::get('store/catalog.json', [OfficialStoreDistributionController::class, 'catalog'])
    ->name('store.catalog');
Route::get('store/artifacts/{file}', [OfficialStoreDistributionController::class, 'artifact'])
    ->where('file', '[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip')
    ->name('store.artifact');
Route::get('store/previews/{file}', [OfficialStoreDistributionController::class, 'preview'])
    ->where('file', '[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.(?:svg|webp|png)')
    ->name('store.preview');

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
