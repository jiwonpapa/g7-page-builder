<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Additive only: historical source JSON is never compiled or rewritten here.
        Schema::create('g7pb_site_part_artifacts', function (Blueprint $table): void {
            $table->uuid('site_part_id');
            $table->unsignedInteger('source_revision');
            $table->string('kind', 16);
            $table->string('compiler_version', 64);
            $table->longText('html');
            $table->string('artifact_sha256', 64);
            $table->timestamp('created_at');
            $table->primary(['site_part_id', 'source_revision'], 'g7pb_part_artifact_pk');
            $table->foreign('site_part_id', 'g7pb_part_artifact_fk')
                ->references('id')->on('g7pb_site_parts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_site_part_artifacts');
    }
};
