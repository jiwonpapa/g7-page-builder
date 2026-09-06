<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use App\Services\TemplateService;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Application\Store\SiteKitService;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\MediaAsset;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSiteKitInstallation;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\SitePartSetRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7PageRouteRegistry;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\BundledSiteKitSource;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;

final class SiteKitInstallationTest extends TestCase
{
    use CreatesBuiltInCompiler;

    private Capsule $db;

    private SiteKitService $kits;

    private G7PageRouteRegistry $paths;

    private int $mediaCreated = 0;

    /** @var list<string> */
    private array $mediaDeleted = [];

    /** @var array<string, string> */
    private array $addresses = ['about' => '/company/about', 'services' => '/company/services', 'contact' => '/company/contact'];

    private string $requestId = '12000000-0000-4000-8000-000000000001';

    protected function setUp(): void
    {
        $this->db = new Capsule;
        $this->db->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'foreign_key_constraints' => true]);
        $this->db->setAsGlobal();
        $this->db->bootEloquent();
        $container = $this->db->getContainer();
        $container->instance('db', $this->db->getDatabaseManager());
        $container->instance('db.schema', $this->db->getConnection()->getSchemaBuilder());
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $file) {
            (require $file)->up();
        }
        $templates = $this->createStub(TemplateService::class);
        $templates->method('getActiveTemplateIdentifier')->willReturn('sirsoft-basic');
        $templates->method('getRoutesDataWithModules')->willReturn(['success' => true, 'data' => ['routes' => [['path' => '/'], ['path' => '*/board/:slug']]]]);
        $this->paths = new G7PageRouteRegistry($templates);
        $compiler = $this->builtInCompiler();
        $media = $this->createStub(MediaPort::class);
        $media->method('store')->willReturnCallback(function (string $name, string $mime, string $contents, int $width, int $height): MediaAsset {
            $id = 'media-'.++$this->mediaCreated;

            return new MediaAsset($id, '/storage/'.$id.'.webp', $name, $mime, strlen($contents), $width, $height, new \DateTimeImmutable);
        });
        $media->method('delete')->willReturnCallback(function (string $id): void {
            self::assertSame(0, DB::table('g7pb_revisions')->where('document_json', 'like', '%/storage/'.$id.'.webp%')->count());
            $this->mediaDeleted[] = $id;
        });
        $this->kits = new SiteKitService(new BundledSiteKitSource, new EloquentSiteKitInstallation($this->paths),
            new PageBuilderService(new EloquentPageBuilderRepository, $compiler), new EloquentSitePartRepository,
            $compiler, new SitePartHtmlCompiler, $media, '0.33.1', '7.0.9');
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->db->getDatabaseManager()->disconnect();
    }

    public function test_preview_compiles_without_writes_and_reports_native_conflicts(): void
    {
        self::assertTrue($this->kits->preview('company-starter', $this->addresses)['can_install']);
        self::assertSame(0, DB::table('g7pb_documents')->count());
        self::assertSame(0, $this->mediaCreated);
        $result = $this->kits->preview('company-starter', [...$this->addresses, 'about' => '/board/notice']);
        self::assertFalse($result['can_install']);
        self::assertArrayHasKey('about', $result['issues']);
    }

    public function test_install_creates_inactive_drafts_and_retry_returns_same_receipt(): void
    {
        $first = $this->install();
        self::assertCount(3, $first['pages']);
        self::assertSame(3, DB::table('g7pb_documents')->count());
        self::assertSame(2, DB::table('g7pb_site_parts')->count());
        self::assertSame(0, DB::table('g7pb_publications')->count());
        self::assertFalse(SitePartSetRecord::query()->findOrFail($first['set_id'])->is_active);
        foreach ($first['pages'] as $page) {
            self::assertFalse($this->paths->get($page['document_id'])['active']);
        }
        self::assertSame($first, $this->install());
        self::assertSame(3, $this->mediaCreated);
        self::assertSame(1, DB::table('g7pb_site_kit_installations')->count());
        $header = (new EloquentSitePartRepository)->find('header', 'ko', $first['set_id']);
        self::assertSame('/company/services', $header?->document->blocks[0]['props']['navigation'][1]['url']);
    }

    public function test_late_failure_rolls_back_all_new_rows_and_allows_retry(): void
    {
        $existing = SitePartSetRecord::query()->create(['id' => '22000000-0000-4000-8000-000000000001',
            'title' => '테스트 사이트 · 12000000', 'locale' => 'ko', 'is_active' => true]);
        try {
            $this->install();
            self::fail('Duplicate set must fail after page creation.');
        } catch (\InvalidArgumentException) {
            self::assertSame(0, DB::table('g7pb_documents')->count());
            self::assertSame(0, DB::table('g7pb_revisions')->count());
            self::assertSame(0, DB::table('g7pb_page_routes')->count());
            self::assertSame(0, DB::table('g7pb_site_kit_installations')->count());
            self::assertSame(['media-3', 'media-2', 'media-1'], $this->mediaDeleted);
            self::assertTrue($existing->fresh()->is_active);
        }
        $existing->title = '원래 사이트';
        $existing->save();
        self::assertSame('draft', $this->install()['status']);
        self::assertTrue($existing->fresh()->is_active);
    }

    public function test_successful_request_cannot_be_reused_by_another_actor_or_changed_payload(): void
    {
        $this->install();
        foreach ([['changed', 1], ['테스트 사이트', 2]] as [$title, $actor]) {
            try {
                $this->kits->install('company-starter', '1.0.0', $title, $this->addresses, $this->requestId, $actor);
                self::fail('A different request reused a committed receipt.');
            } catch (\DomainException) {
                self::assertSame(3, DB::table('g7pb_documents')->count());
            }
        }
    }

    public function test_conflict_after_preview_keeps_the_existing_installation_unchanged(): void
    {
        self::assertTrue($this->kits->preview('company-starter', $this->addresses)['can_install']);
        $first = $this->install();
        try {
            $this->kits->install('company-starter', '1.0.0', '두 번째', $this->addresses, '12000000-0000-4000-8000-000000000002', 1);
            self::fail('Reserved addresses were reused.');
        } catch (\DomainException) {
            self::assertSame($first, $this->install());
            self::assertSame(3, DB::table('g7pb_documents')->count());
        }
    }

    /** @return array<string, mixed> */
    private function install(): array
    {
        return $this->kits->install('company-starter', '1.0.0', '테스트 사이트', $this->addresses, $this->requestId, 1);
    }
}
