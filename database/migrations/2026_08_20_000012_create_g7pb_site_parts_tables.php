<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_site_parts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('kind', 16);
            $table->string('locale', 16);
            $table->string('title');
            $table->unsignedInteger('lock_version')->default(1);
            $table->unsignedInteger('current_revision')->default(1);
            $table->unsignedInteger('active_revision')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->unique(['kind', 'locale'], 'g7pb_site_part_kind_locale_unique');
        });

        Schema::create('g7pb_site_part_revisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('site_part_id');
            $table->unsignedInteger('revision');
            $table->string('schema_version', 64);
            $table->string('title');
            $table->longText('document_json');
            $table->unsignedBigInteger('author_id')->nullable();
            $table->timestamps();
            $table->unique(['site_part_id', 'revision'], 'g7pb_site_part_revision_unique');
            $table->foreign('site_part_id', 'g7pb_site_part_revision_fk')
                ->references('id')->on('g7pb_site_parts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_site_part_revisions');
        Schema::dropIfExists('g7pb_site_parts');
    }
};
