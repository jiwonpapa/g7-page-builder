<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_block_favorites', function (Blueprint $table): void {
            $table->unsignedBigInteger('actor_id');
            $table->string('catalog_id', 256);
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['actor_id', 'catalog_id'], 'g7pb_block_favorites_pk');
            $table->index('catalog_id', 'g7pb_block_favorites_catalog_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_block_favorites');
    }
};
