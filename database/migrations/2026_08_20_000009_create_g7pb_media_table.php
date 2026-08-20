<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_media', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('disk', 32)->default('public');
            $table->string('path', 500)->unique();
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('bytes');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index('created_at', 'g7pb_media_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_media');
    }
};
