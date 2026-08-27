<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('g7pb_site_part_sets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('locale', 16);
            $table->string('title');
            $table->boolean('is_active')->default(false);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->unique(['locale', 'title'], 'g7pb_site_part_set_locale_title_unique');
            $table->index(['locale', 'is_active'], 'g7pb_site_part_set_active_index');
        });

        Schema::table('g7pb_site_parts', function (Blueprint $table): void {
            $table->uuid('set_id')->nullable()->after('id');
        });

        $now = new DateTimeImmutable;
        $locales = DB::table('g7pb_site_parts')->select('locale')->distinct()->pluck('locale');
        foreach ($locales as $locale) {
            if (! is_string($locale)) {
                continue;
            }
            $setId = $this->uuidV4();
            DB::table('g7pb_site_part_sets')->insert([
                'id' => $setId,
                'locale' => $locale,
                'title' => '기본 세트',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('g7pb_site_parts')->where('locale', $locale)->update(['set_id' => $setId]);
        }

        Schema::table('g7pb_site_parts', function (Blueprint $table): void {
            $table->dropUnique('g7pb_site_part_kind_locale_unique');
            $table->unique(['set_id', 'kind'], 'g7pb_site_part_set_kind_unique');
            $table->index(['locale', 'set_id'], 'g7pb_site_part_locale_set_index');
            $table->foreign('set_id', 'g7pb_site_part_set_fk')
                ->references('id')->on('g7pb_site_part_sets')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        $hasMultipleSets = DB::table('g7pb_site_parts')
            ->select('kind', 'locale', DB::raw('COUNT(*) as aggregate'))
            ->groupBy('kind', 'locale')
            ->having('aggregate', '>', 1)
            ->exists();
        if ($hasMultipleSets) {
            throw new RuntimeException('여러 Header·Footer 세트가 남아 있어 이전 단일 Site Part 스키마로 롤백할 수 없습니다.');
        }

        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            $rows = DB::table('g7pb_site_parts')->get();
            Schema::disableForeignKeyConstraints();
            Schema::create('g7pb_site_parts_rollback', function (Blueprint $table): void {
                $this->legacySitePartsTable($table);
            });
            foreach ($rows as $row) {
                DB::table('g7pb_site_parts_rollback')->insert([
                    'id' => $row->id,
                    'kind' => $row->kind,
                    'locale' => $row->locale,
                    'title' => $row->title,
                    'lock_version' => $row->lock_version,
                    'current_revision' => $row->current_revision,
                    'active_revision' => $row->active_revision,
                    'published_at' => $row->published_at,
                    'created_by' => $row->created_by,
                    'updated_by' => $row->updated_by,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ]);
            }
            Schema::drop('g7pb_site_parts');
            Schema::rename('g7pb_site_parts_rollback', 'g7pb_site_parts');
            Schema::dropIfExists('g7pb_site_part_sets');
            Schema::enableForeignKeyConstraints();

            return;
        }

        Schema::table('g7pb_site_parts', function (Blueprint $table): void {
            $table->dropForeign('g7pb_site_part_set_fk');
        });
        Schema::table('g7pb_site_parts', function (Blueprint $table): void {
            $table->dropUnique('g7pb_site_part_set_kind_unique');
            $table->dropIndex('g7pb_site_part_locale_set_index');
            $table->dropColumn('set_id');
            $table->unique(['kind', 'locale'], 'g7pb_site_part_kind_locale_unique');
        });
        Schema::dropIfExists('g7pb_site_part_sets');
    }

    private function legacySitePartsTable(Blueprint $table): void
    {
        $table->uuid('id')->primary();
        $table->string('kind', 16);
        $table->string('locale', 16);
        $table->string('title');
        $table->unsignedInteger('lock_version')->default(1);
        $table->unsignedInteger('current_revision')->default(1);
        $table->unsignedInteger('active_revision')->nullable();
        $table->timestamp('published_at')->nullable();
        $table->unsignedBigInteger('created_by')->nullable();
        $table->unsignedBigInteger('updated_by')->nullable();
        $table->timestamps();
        $table->unique(['kind', 'locale'], 'g7pb_site_part_kind_locale_unique');
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20),
        );
    }
};
