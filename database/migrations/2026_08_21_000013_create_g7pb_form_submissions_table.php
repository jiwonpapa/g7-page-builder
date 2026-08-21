<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_form_submissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('page_slug', 160);
            $table->uuid('block_instance_id');
            $table->string('form_kind', 24);
            $table->json('payload_json');
            $table->string('email', 320);
            $table->string('subject', 200)->default('');
            $table->string('status', 16)->default('unread');
            $table->string('mail_status', 16)->default('pending');
            $table->text('mail_error')->nullable();
            $table->unsignedTinyInteger('mail_attempts')->default(0);
            $table->char('ip_hash', 64);
            $table->string('user_agent', 500)->default('');
            $table->timestamp('mail_sent_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent();
            $table->index(['status', 'created_at'], 'g7pb_form_status_created_idx');
            $table->index(['page_slug', 'created_at'], 'g7pb_form_page_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('g7pb_form_submissions');
    }
};
