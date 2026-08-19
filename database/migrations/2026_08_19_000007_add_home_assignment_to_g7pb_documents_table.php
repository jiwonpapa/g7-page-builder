<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('g7pb_documents', function (Blueprint $table): void {
            $table->boolean('is_home')->default(false)->after('active_publication_id');
            $table->index('is_home', 'g7pb_docs_home_idx');
        });
    }

    public function down(): void
    {
        Schema::table('g7pb_documents', function (Blueprint $table): void {
            $table->dropIndex('g7pb_docs_home_idx');
            $table->dropColumn('is_home');
        });
    }
};
