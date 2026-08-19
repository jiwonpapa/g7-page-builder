<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_preview_tokens', function (Blueprint $table): void {
            $table->char('token_hash', 64)->primary();
            $table->uuid('document_id');
            $table->unsignedInteger('revision');
            $table->timestamp('expires_at');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('expires_at', 'g7pb_preview_expires_idx');
            $table->foreign('document_id', 'g7pb_preview_document_fk')
                ->references('id')
                ->on('g7pb_documents')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_preview_tokens');
    }
};
