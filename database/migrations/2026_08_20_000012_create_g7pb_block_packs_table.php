<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_block_packs', function (Blueprint $table): void {
            $table->string('pack_id', 129);
            $table->string('pack_version', 64);
            $table->string('kind', 16);
            $table->string('state', 24);
            $table->longText('manifest_json');
            $table->string('source', 16);
            $table->string('source_reference', 512);
            $table->string('source_uri', 1000)->nullable();
            $table->char('archive_sha256', 64)->nullable();
            $table->timestamp('installed_at');
            $table->unsignedBigInteger('installed_by')->nullable();
            $table->timestamp('updated_at');
            $table->primary(['pack_id', 'pack_version'], 'g7pb_block_packs_pk');
            $table->index(['pack_id', 'state'], 'g7pb_block_packs_state_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_block_packs');
    }
};
