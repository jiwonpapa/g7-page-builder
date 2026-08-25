<?php

use Illuminate\Support\Facades\Route;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminBlockCatalogController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminBlockPackController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminDocumentController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminMediaController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminOfficialStoreController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminRouteCatalogController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSitePartController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminSiteShellController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\FormSubmissionController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\PublicPageController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\PublicSiteShellController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\CanonicalApiAccessResponse;

Route::prefix('admin')->middleware([CanonicalApiAccessResponse::class, 'auth:sanctum', 'throttle:300,1'])->name('admin.')->group(function (): void {
    Route::get('routes/catalog', [AdminRouteCatalogController::class, 'index'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('routes.catalog');
    Route::get('blocks/catalog', [AdminBlockCatalogController::class, 'index'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('blocks.catalog');
    Route::put('blocks/favorite', [AdminBlockCatalogController::class, 'favorite'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('blocks.favorite');
    Route::get('store/catalog', [AdminOfficialStoreController::class, 'index'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('store.catalog');
    Route::post('store/block-packs/install', [AdminOfficialStoreController::class, 'installBlockPack'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('store.block-packs.install');
    Route::post('store/page-kits/apply', [AdminOfficialStoreController::class, 'applyPageKit'])
        ->middleware([
            'permission:admin,jiwonpapa-page_builder.documents.read',
            'permission:admin,jiwonpapa-page_builder.documents.create',
        ])
        ->name('store.page-kits.apply');
    Route::get('block-packs', [AdminBlockPackController::class, 'index'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('block-packs.index');
    Route::post('block-packs', [AdminBlockPackController::class, 'store'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('block-packs.store');
    Route::put('block-packs/state', [AdminBlockPackController::class, 'state'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('block-packs.state');
    Route::delete('block-packs', [AdminBlockPackController::class, 'destroy'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('block-packs.destroy');
    Route::post('block-packs/github/check', [AdminBlockPackController::class, 'githubCheck'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('block-packs.github.check');
    Route::post('block-packs/github/install', [AdminBlockPackController::class, 'githubInstall'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('block-packs.github.install');
    Route::get('site-parts/{kind}', [AdminSitePartController::class, 'show'])
        ->whereIn('kind', ['header', 'footer'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('site-parts.show');
    Route::post('site-parts/{kind}/bootstrap', [AdminSitePartController::class, 'bootstrap'])
        ->whereIn('kind', ['header', 'footer'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.create')
        ->name('site-parts.bootstrap');
    Route::put('site-parts/{kind}/draft', [AdminSitePartController::class, 'saveDraft'])
        ->whereIn('kind', ['header', 'footer'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.update')
        ->name('site-parts.draft');
    Route::post('site-parts/{kind}/publish', [AdminSitePartController::class, 'publish'])
        ->whereIn('kind', ['header', 'footer'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('site-parts.publish');
    Route::get('site-parts/{kind}/revisions', [AdminSitePartController::class, 'revisions'])
        ->whereIn('kind', ['header', 'footer'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('site-parts.revisions');
    Route::get('site-shell', [AdminSiteShellController::class, 'show'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('site-shell.show');
    Route::put('site-shell', [AdminSiteShellController::class, 'update'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('site-shell.update');
    Route::get('form-submissions', [FormSubmissionController::class, 'index'])
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.read')
        ->name('form-submissions.index');
    Route::patch('form-submissions/{submission}', [FormSubmissionController::class, 'update'])
        ->whereUuid('submission')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.update')
        ->name('form-submissions.update');
    Route::post('form-submissions/{submission}/retry', [FormSubmissionController::class, 'retry'])
        ->whereUuid('submission')
        ->middleware('permission:admin,jiwonpapa-page_builder.documents.manage')
        ->name('form-submissions.retry');
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
    Route::post('documents/{document}/duplicate', [AdminDocumentController::class, 'duplicate'])
        ->whereUuid('document')
        ->middleware([
            'permission:admin,jiwonpapa-page_builder.documents.read',
            'permission:admin,jiwonpapa-page_builder.documents.create',
        ])
        ->name('documents.duplicate');
    Route::get('documents/{document}/page-kit/export', [AdminOfficialStoreController::class, 'exportPageKit'])
        ->whereUuid('document')
        ->middleware([
            'permission:admin,jiwonpapa-page_builder.documents.read',
            'permission:admin,jiwonpapa-page_builder.documents.manage',
        ])
        ->name('documents.page-kit.export');
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

Route::get('public/home', [PublicPageController::class, 'home'])
    ->middleware('throttle:120,1')
    ->name('public.home');

Route::get('public/site-shell', [PublicSiteShellController::class, 'show'])
    ->name('public.site-shell.show');

Route::get('public/previews/{token}', [PublicPageController::class, 'preview'])
    ->where('token', '[a-f0-9]{64}')
    ->middleware('throttle:120,1')
    ->name('public.previews.show');
