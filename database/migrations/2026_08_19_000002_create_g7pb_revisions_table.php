<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_revisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->unsignedInteger('revision');
            $table->string('schema_version', 64);
            $table->longText('document_json');
            $table->unsignedBigInteger('author_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['document_id', 'revision'], 'g7pb_revision_number_unique');
            $table->foreign('document_id', 'g7pb_revision_document_fk')
                ->references('id')
                ->on('g7pb_documents')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_revisions');
    }
};
