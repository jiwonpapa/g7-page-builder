<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('slug', 120)->unique();
            $table->string('title', 255);
            $table->string('mode', 16)->default('canvas');
            $table->string('locale', 16)->default('ko');
            $table->unsignedInteger('lock_version')->default(1);
            $table->unsignedInteger('current_revision')->default(1);
            $table->uuid('active_publication_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->index('active_publication_id', 'g7pb_docs_active_pub_idx');
            $table->index('updated_at', 'g7pb_docs_updated_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_documents');
    }
};
