<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('g7pb_revisions', function (Blueprint $table): void {
            $table->string('title', 255)->nullable()->after('schema_version');
        });

        $titles = DB::table('g7pb_documents')->pluck('title', 'id');

        foreach ($titles as $documentId => $title) {
            DB::table('g7pb_revisions')
                ->where('document_id', $documentId)
                ->whereNull('title')
                ->update(['title' => $title]);
        }
    }

    public function down(): void
    {
        Schema::table('g7pb_revisions', function (Blueprint $table): void {
            $table->dropColumn('title');
        });
    }
};
