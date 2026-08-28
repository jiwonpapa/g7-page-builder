<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCatalogService;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockFavoritePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockSchemaValidatorPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackState;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;
use PHPUnit\Framework\TestCase;

final class BlockPackContractTest extends TestCase
{
    public function test_data_pack_manifest_round_trips_without_runtime_code(): void
    {
        $manifest = BlockPackManifest::fromJson($this->fixture());

        self::assertSame('jiwonpapa/marketing-presets', $manifest->packId);
        self::assertSame('data', $manifest->kind);
        self::assertSame([], $manifest->blocks);
        self::assertCount(1, $manifest->presets);
        self::assertNull($manifest->runtime);
        self::assertSame($manifest->toArray(), BlockPackManifest::fromArray($manifest->toArray())->toArray());
    }

    public function test_builtin_core_manifest_registers_all_forty_five_definitions_and_presets(): void
    {
        $manifest = (new BuiltInBlockPackLoader)->load(dirname(__DIR__, 2));
        $registry = new BlockRegistry;
        $registry->register($manifest, enabled: true);

        self::assertSame('jiwonpapa/builtin-core', $manifest->packId);
        self::assertCount(45, $registry->definitions());
        self::assertCount(95, $registry->presets());
        self::assertNotNull($registry->definition('content.heading-01', 1));
        self::assertNotNull($registry->definition('content.rich-text-01', 1));
        self::assertNotNull($registry->definition('media.image-01', 1));
        self::assertNotNull($registry->definition('action.buttons-01', 1));
        self::assertNotNull($registry->definition('media.image-text-01', 1));
        self::assertNotNull($registry->definition('content.icon-list-01', 1));
        self::assertArrayHasKey('jiwonpapa/builtin-core:heading.section-intro', $registry->presets());
        self::assertArrayHasKey('jiwonpapa/builtin-core:icon-list.benefits', $registry->presets());
        self::assertNotNull($registry->definition('data.bar-chart-01', 1));
        self::assertNotNull($registry->definition('g7.board-recent-posts-01', 1));
        self::assertNotNull($registry->definition('g7.ecommerce-product-grid-01', 1));
        self::assertNotNull($registry->definition('g7.board-post-detail-01', 1));
        self::assertNotNull($registry->definition('g7.ecommerce-product-detail-01', 1));
        self::assertNotNull($registry->definition('form.inquiry-01', 1));
        self::assertNotNull($registry->definition('location.map-directions-01', 1));
        self::assertNotNull($registry->definition('trust.testimonials-01', 1));
        self::assertNotNull($registry->definition('content.faq-accordion-01', 1));
        self::assertNotNull($registry->definition('content.process-timeline-01', 1));
        self::assertNotNull($registry->definition('content.tabs-01', 1));
        self::assertNotNull($registry->definition('commerce.comparison-table-01', 1));
        self::assertNotNull($registry->definition('content.article-list-01', 1));
        self::assertNotNull($registry->definition('media.video-embed-01', 1));
        self::assertNotNull($registry->definition('content.divider-01', 1));
        self::assertNotNull($registry->definition('content.blockquote-01', 1));
        self::assertNotNull($registry->definition('content.notice-01', 1));
        self::assertNotNull($registry->definition('content.card-grid-01', 1));
        self::assertNotNull($registry->definition('navigation.breadcrumbs-01', 1));
        self::assertNotNull($registry->definition('navigation.anchor-menu-01', 1));
        self::assertNotNull($registry->definition('navigation.social-links-01', 1));
        self::assertNotNull($registry->definition('media.image-carousel-01', 1));
    }

    public function test_catalog_icons_do_not_fall_back_to_text_pseudo_elements(): void
    {
        $publicCss = file_get_contents(dirname(__DIR__, 2).'/resources/css/page-builder-public.css');
        self::assertIsString($publicCss);

        foreach (['bolt', 'code', 'globe', 'heart', 'layers', 'mobile', 'palette', 'shield', 'sparkles', 'star'] as $icon) {
            self::assertStringNotContainsString(".g7pb-icon--{$icon}::before", $publicCss);
        }
        self::assertStringNotContainsString("content: 'YT'", $publicCss);
        self::assertStringNotContainsString("content: 'IG'", $publicCss);
        self::assertStringContainsString('.g7pb-social-links__glyph', $publicCss);
    }

    public function test_data_pack_rejects_runtime_code(): void
    {
        $data = $this->fixtureArray();
        $data['runtime'] = [
            'provider' => 'untrusted.provider',
            'editor' => 'dist/editor.js',
            'styles' => [],
        ];

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('cannot declare runtime code');

        BlockPackManifest::fromArray($data);
    }

    public function test_pack_namespace_must_match_its_declared_publisher(): void
    {
        $data = $this->fixtureArray();
        $data['pack_id'] = 'impersonated/marketing-presets';

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('publisher must match publisher.id');

        BlockPackManifest::fromArray($data);
    }

    public function test_registry_enables_data_presets_only_when_their_definition_exists(): void
    {
        $registry = new BlockRegistry;
        $registry->register($this->coreManifest(), enabled: true);
        $registry->register(BlockPackManifest::fromJson($this->fixture()), enabled: true);

        self::assertNotNull($registry->definition('content.hero-centered-01', 1));
        self::assertArrayHasKey('jiwonpapa/marketing-presets:hero.launch-blue', $registry->presets());
    }

    public function test_registry_rejects_a_preset_for_an_unavailable_definition(): void
    {
        $registry = new BlockRegistry;

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('references an unavailable definition');

        $registry->register(BlockPackManifest::fromJson($this->fixture()), enabled: true);
    }

    public function test_registry_rejects_duplicate_enabled_block_definitions(): void
    {
        $registry = new BlockRegistry;
        $registry->register($this->coreManifest(), enabled: true);
        $duplicate = $this->coreManifest('vendor/duplicate-core', '1.0.0');

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('provided by multiple resolved Packs');

        $registry->register($duplicate, enabled: true);
    }

    public function test_pack_state_requires_disable_before_retirement(): void
    {
        self::assertTrue(BlockPackState::Enabled->canTransitionTo(BlockPackState::Disabled));
        self::assertTrue(BlockPackState::Disabled->canTransitionTo(BlockPackState::Retired));
        self::assertFalse(BlockPackState::Enabled->canTransitionTo(BlockPackState::Retired));
    }

    public function test_disabling_hides_new_insertions_but_keeps_existing_document_resolution(): void
    {
        $registry = new BlockRegistry;
        $registry->register($this->coreManifest(), enabled: true);

        $registry->disable('jiwonpapa/builtin-core');

        self::assertSame([], $registry->definitions());
        self::assertNotNull($registry->definition('content.hero-centered-01', 1));
    }

    public function test_compiler_and_schema_registries_dispatch_only_registered_keys(): void
    {
        $compilers = new BlockCompilerRegistry;
        $schemas = new BlockSchemaRegistry;
        $compilers->register(new class implements BlockTypeCompilerPort
        {
            public function key(): string
            {
                return 'builtin.hero-centered-01';
            }

            public function compile(array $props): string
            {
                return '<h1>'.htmlspecialchars((string) ($props['title'] ?? ''), ENT_QUOTES).'</h1>';
            }
        });
        $schemas->register(new class implements BlockSchemaValidatorPort
        {
            public function schemaRef(): string
            {
                return 'builtin:heroProps';
            }

            public function validate(array $props): void
            {
                if (! is_string($props['title'] ?? null) || $props['title'] === '') {
                    throw new \InvalidArgumentException('Hero title is required.');
                }
            }
        });

        $schemas->validate('builtin:heroProps', ['title' => '등록형 블록']);

        self::assertSame('<h1>등록형 블록</h1>', $compilers->compile('builtin.hero-centered-01', ['title' => '등록형 블록']));
        self::assertTrue($compilers->has('builtin.hero-centered-01'));
        self::assertTrue($schemas->has('builtin:heroProps'));
    }

    public function test_catalog_search_category_and_favorites_cover_definitions_and_presets(): void
    {
        $registry = new BlockRegistry;
        $registry->register($this->coreManifest(), enabled: true);
        $registry->register(BlockPackManifest::fromJson($this->fixture()), enabled: true);
        $favorites = new class implements BlockFavoritePort
        {
            /** @var array<int, list<string>> */
            public array $items = [];

            public function blockIdsFor(int $actorId): array
            {
                return $this->items[$actorId] ?? [];
            }

            public function setFavorite(int $actorId, string $blockId, bool $favorite): void
            {
                $current = array_fill_keys($this->items[$actorId] ?? [], true);
                if ($favorite) {
                    $current[$blockId] = true;
                } else {
                    unset($current[$blockId]);
                }
                $this->items[$actorId] = array_keys($current);
            }
        };
        $catalog = new BlockCatalogService($registry, $favorites);

        self::assertCount(2, $catalog->list(7));
        self::assertCount(1, $catalog->list(7, query: '출시'));
        self::assertCount(2, $catalog->list(7, category: 'hero'));

        $catalog->setFavorite(7, 'preset:jiwonpapa/marketing-presets:hero.launch-blue', true);
        $favoriteItems = $catalog->list(7, favoritesOnly: true);

        self::assertCount(1, $favoriteItems);
        self::assertSame('preset', $favoriteItems[0]->kind);
        self::assertSame('Hero', $favoriteItems[0]->editorComponent);
        self::assertSame('출시 안내 히어로', $favoriteItems[0]->label['ko']);
    }

    public function test_catalog_refuses_favoriting_an_unavailable_item(): void
    {
        $registry = new BlockRegistry;
        $registry->register($this->coreManifest(), enabled: true);
        $favorites = new class implements BlockFavoritePort
        {
            public function blockIdsFor(int $actorId): array
            {
                return [];
            }

            public function setFavorite(int $actorId, string $blockId, bool $favorite): void {}
        };

        $this->expectException(\DomainException::class);
        (new BlockCatalogService($registry, $favorites))->setFavorite(1, 'block:missing.block@1', true);
    }

    private function fixture(): string
    {
        $contents = file_get_contents(dirname(__DIR__).'/Contract/block-pack-data-v1.fixture.json');
        self::assertIsString($contents);

        return $contents;
    }

    /** @return array<string, mixed> */
    private function fixtureArray(): array
    {
        $data = json_decode($this->fixture(), true, 64, JSON_THROW_ON_ERROR);
        self::assertIsArray($data);

        return $data;
    }

    private function coreManifest(
        string $packId = 'jiwonpapa/builtin-core',
        string $packVersion = '0.6.0',
    ): BlockPackManifest {
        [$publisherId] = explode('/', $packId, 2);

        return BlockPackManifest::fromArray([
            'manifest_version' => BlockPackManifest::VERSION,
            'pack_id' => $packId,
            'pack_version' => $packVersion,
            'kind' => 'code',
            'publisher' => ['id' => $publisherId, 'name' => '지원소프트'],
            'compatibility' => [
                'page_builder' => '>=0.6.0 <1.0.0',
                'php' => '>=8.5',
                'g7' => '>=7.0.7',
            ],
            'blocks' => [[
                'block_id' => 'content.hero-centered-01',
                'block_version' => 1,
                'category' => 'hero',
                'label' => ['ko' => '히어로'],
                'description' => ['ko' => '핵심 메시지를 보여줍니다.'],
                'thumbnail' => 'assets/hero.webp',
                'schema_ref' => 'builtin:heroProps',
                'editor_component' => 'Hero',
                'compiler' => 'builtin.hero-centered-01',
                'capabilities' => [],
            ]],
            'presets' => [],
            'runtime' => [
                'provider' => 'builtin.core',
                'editor' => 'dist/js/page-builder.iife.js',
                'styles' => ['dist/css/page-builder.css'],
            ],
            'files' => [],
        ]);
    }
}
