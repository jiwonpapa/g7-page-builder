<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('g7pb_documents', function (Blueprint $table): void {
            $table->timestamp('archived_at')->nullable()->after('is_home');
            $table->index('archived_at', 'g7pb_docs_archived_idx');
        });
    }

    public function down(): void
    {
        Schema::table('g7pb_documents', function (Blueprint $table): void {
            $table->dropIndex('g7pb_docs_archived_idx');
            $table->dropColumn('archived_at');
        });
    }
};
