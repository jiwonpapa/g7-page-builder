<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_site_kit_installations', function (Blueprint $table): void {
            $table->uuid('request_id')->primary();
            $table->char('fingerprint', 64);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->longText('result_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_site_kit_installations');
    }
};
