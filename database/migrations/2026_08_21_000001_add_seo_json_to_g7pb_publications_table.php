<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('g7pb_publications', function (Blueprint $table): void {
            $table->json('seo_json')->nullable()->after('warnings_json');
        });
    }

    public function down(): void
    {
        Schema::table('g7pb_publications', function (Blueprint $table): void {
            $table->dropColumn('seo_json');
        });
    }
};
