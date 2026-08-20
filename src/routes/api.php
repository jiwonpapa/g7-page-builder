<?php

use Illuminate\Support\Facades\Route;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminDocumentController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminMediaController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSiteShellController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\PublicPageController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\CanonicalApiAccessResponse;

Route::prefix('admin')->middleware([CanonicalApiAccessResponse::class, 'auth:sanctum', 'throttle:300,1'])->name('admin.')->group(function (): void {
    Route::get('site-shell', [AdminSiteShellController::class, 'show'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('site-shell.show');
    Route::put('site-shell', [AdminSiteShellController::class, 'update'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('site-shell.update');
    Route::get('documents', [AdminDocumentController::class, 'index'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('documents.index');
    Route::post('documents', [AdminDocumentController::class, 'store'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.create')
        ->name('documents.store');
    Route::get('documents/{document}', [AdminDocumentController::class, 'show'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('documents.show');
    Route::get('documents/{document}/revisions', [AdminDocumentController::class, 'revisions'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('documents.revisions.index');
    Route::get('documents/{document}/revisions/{revision}', [AdminDocumentController::class, 'showRevision'])
        ->whereUuid('document')
        ->whereNumber('revision')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('documents.revisions.show');
    Route::post('documents/{document}/revisions/{revision}/preview', [AdminDocumentController::class, 'previewRevision'])
        ->whereUuid('document')
        ->whereNumber('revision')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('documents.revisions.preview');
    Route::post('documents/{document}/revisions/{revision}/restore', [AdminDocumentController::class, 'restoreRevision'])
        ->whereUuid('document')
        ->whereNumber('revision')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.update')
        ->name('documents.revisions.restore');
    Route::patch('documents/{document}', [AdminDocumentController::class, 'update'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.update')
        ->name('documents.update');
    Route::put('documents/{document}/draft', [AdminDocumentController::class, 'saveDraft'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.update')
        ->name('documents.draft');
    Route::post('documents/{document}/preview', [AdminDocumentController::class, 'preview'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.update')
        ->name('documents.preview');
    Route::post('documents/{document}/publications/prepare', [AdminDocumentController::class, 'preparePublication'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('documents.publications.prepare');
    Route::post('documents/{document}/publications/unpublish', [AdminDocumentController::class, 'unpublish'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('documents.publications.unpublish');
    Route::post('documents/{document}/home', [AdminDocumentController::class, 'setHome'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('documents.home');
    Route::post('documents/{document}/archive', [AdminDocumentController::class, 'archive'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('documents.archive');
    Route::post('documents/{document}/restore-archived', [AdminDocumentController::class, 'restoreArchived'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('documents.restore-archived');
    Route::delete('documents/{document}', [AdminDocumentController::class, 'purge'])
        ->whereUuid('document')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('documents.purge');
    Route::get('media', [AdminMediaController::class, 'index'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('media.index');
    Route::post('media', [AdminMediaController::class, 'store'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.update')
        ->name('media.store');
    Route::delete('media/{media}', [AdminMediaController::class, 'destroy'])
        ->whereUuid('media')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('media.destroy');
    Route::post('publications/{token}/commit', [AdminDocumentController::class, 'commitPublication'])
        ->where('token', '[a-f0-9]{64}')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('publications.commit');
});

Route::get('public/pages/{slug}', [PublicPageController::class, 'show'])
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
    ->middleware('throttle:120,1')
    ->name('public.pages.show');
