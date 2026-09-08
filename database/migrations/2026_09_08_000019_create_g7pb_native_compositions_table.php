<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_native_compositions', function (Blueprint $table): void {
            $table->uuid('composition_id')->primary();
            $table->unsignedBigInteger('actor_id');
            $table->string('title', 120);
            $table->string('schema_version', 64);
            // Text preserves empty JSON objects and unknown host fields without array casts.
            $table->mediumText('snapshot_json');
            $table->timestamps();
            $table->index(['actor_id', 'created_at'], 'g7pb_native_compositions_actor_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_native_compositions');
    }
};
