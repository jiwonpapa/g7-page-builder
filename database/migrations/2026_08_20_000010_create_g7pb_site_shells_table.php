<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_site_shells', function (Blueprint $table): void {
            $table->string('locale', 16)->primary();
            $table->longText('config_json');
            $table->unsignedInteger('lock_version')->default(1);
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::table('g7pb_publications', function (Blueprint $table): void {
            $table->string('shell_mode', 16)->default('global')->after('locale');
        });
    }

    public function down(): void
    {
        Schema::table('g7pb_publications', function (Blueprint $table): void {
            $table->dropColumn('shell_mode');
        });
        Schema::dropIfExists('g7pb_site_shells');
    }
};
