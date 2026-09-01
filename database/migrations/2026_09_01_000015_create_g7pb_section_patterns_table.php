<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_section_patterns', function (Blueprint $table): void {
            $table->uuid('pattern_id')->primary();
            $table->unsignedBigInteger('actor_id');
            $table->string('title', 120);
            $table->string('category', 64);
            $table->string('schema_version', 64);
            $table->string('source_document_schema', 64);
            $table->json('section_json');
            $table->json('required_blocks_json');
            $table->json('asset_references_json');
            $table->json('preview_json');
            $table->timestamps();
            $table->index(['actor_id', 'updated_at'], 'g7pb_section_patterns_actor_updated_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_section_patterns');
    }
};
