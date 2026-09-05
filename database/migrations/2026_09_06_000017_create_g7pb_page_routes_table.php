<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_page_routes', function (Blueprint $table): void {
            $table->uuid('document_id')->primary();
            $table->string('path', 240)->nullable()->unique();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
            $table->foreign('document_id')->references('id')->on('g7pb_documents')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_page_routes');
    }
};
