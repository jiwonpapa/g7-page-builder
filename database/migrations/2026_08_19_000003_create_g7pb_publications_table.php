<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_publications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->unsignedInteger('source_revision');
            $table->string('title', 255);
            $table->string('slug', 120);
            $table->string('locale', 16);
            $table->string('compiler_version', 64);
            $table->string('target_engine_version', 64);
            $table->longText('artifact');
            $table->char('artifact_sha256', 64);
            $table->text('warnings_json')->nullable();
            $table->string('status', 16)->default('candidate');
            $table->char('token_hash', 64)->nullable()->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['document_id', 'status'], 'g7pb_pub_document_status_idx');
            $table->index(['status', 'slug'], 'g7pb_pub_status_slug_idx');
            $table->index('published_at', 'g7pb_pub_published_idx');
            $table->foreign('document_id', 'g7pb_pub_document_fk')
                ->references('id')
                ->on('g7pb_documents')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_publications');
    }
};
