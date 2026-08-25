<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Layout\UserTemplateSiteShellDecorator;
use PHPUnit\Framework\TestCase;

final class UserTemplateSiteShellDecoratorTest extends TestCase
{
    public function test_only_the_supported_active_user_template_profile_is_eligible(): void
    {
        $decorator = new UserTemplateSiteShellDecorator;

        self::assertTrue($decorator->supports('sirsoft-basic', '1.1.1', 'user'));
        self::assertTrue($decorator->supports('sirsoft-basic', '1.9.0', 'user'));
        self::assertFalse($decorator->supports('sirsoft-basic', '2.0.0', 'user'));
        self::assertFalse($decorator->supports('sirsoft-basic', '1.1.1', 'admin'));
        self::assertFalse($decorator->supports('custom-user', '1.1.1', 'user'));
    }

    public function test_it_injects_one_progressive_shell_source_and_preserves_native_nodes_as_fallback(): void
    {
        $decorated = (new UserTemplateSiteShellDecorator)->decorate($this->layout());

        self::assertSame('native-content', $decorated['components'][0]['children'][5]['text']);
        self::assertSame('g7pb_site_shell', $decorated['data_sources'][1]['id']);
        self::assertSame(
            "/api/modules/jiwonpapa-page_builder/public/site-shell?locale={{_global.locale ?? 'ko'}}",
            $decorated['data_sources'][1]['endpoint'],
        );
        self::assertSame('progressive', $decorated['data_sources'][1]['loading_strategy']);
        self::assertFalse($decorated['data_sources'][1]['fallback']['data']['shell']['enabled']);

        $ids = $this->ids($decorated);
        self::assertContains('g7pb_global_site_header', $ids);
        self::assertContains('g7pb_global_site_footer', $ids);
        self::assertSame(1, count(array_keys($ids, 'g7pb_global_site_header', true)));
        self::assertSame(1, count(array_keys($ids, 'g7pb_global_site_footer', true)));

        foreach (['mobile_overlay', 'mobile_header', 'mobile_nav_drawer', 'desktop_header', 'footer'] as $id) {
            $node = $this->find($decorated, $id);
            self::assertIsArray($node);
            self::assertStringContainsString('!g7pb_site_shell?.data?.shell?.enabled', (string) $node['if']);
        }
        $mobileOverlay = $this->find($decorated, 'mobile_overlay');
        self::assertStringContainsString('_global.mobileMenuOpen', (string) $mobileOverlay['responsive']['portable']['if']);
    }

    public function test_it_is_idempotent_and_returns_the_exact_original_for_an_incompatible_tree(): void
    {
        $decorator = new UserTemplateSiteShellDecorator;
        $once = $decorator->decorate($this->layout());
        self::assertSame($once, $decorator->decorate($once));

        $missing = $this->layout();
        array_pop($missing['components'][0]['children']);
        self::assertSame($missing, $decorator->decorate($missing));

        $invalid = $this->layout();
        $invalid['components'][0]['children'][0]['if'] = ['unsafe'];
        self::assertSame($invalid, $decorator->decorate($invalid));
    }

    /** @return array<string, mixed> */
    private function layout(): array
    {
        return [
            'layout_name' => 'board/index',
            'data_sources' => [['id' => 'posts', 'type' => 'api']],
            'components' => [[
                'id' => 'user_layout_root',
                'type' => 'basic',
                'name' => 'Div',
                'children' => [
                    [
                        'id' => 'mobile_overlay', 'type' => 'basic', 'name' => 'Div', 'if' => '{{false}}',
                        'responsive' => ['portable' => ['if' => '{{_global.mobileMenuOpen}}']],
                    ],
                    ['id' => 'mobile_header', 'type' => 'basic', 'name' => 'Div'],
                    ['id' => 'mobile_nav_drawer', 'type' => 'basic', 'name' => 'Div'],
                    ['id' => 'desktop_header', 'type' => 'composite', 'name' => 'Header'],
                    ['id' => 'main_content', 'type' => 'basic', 'name' => 'Div', 'text' => 'native-content'],
                    ['id' => 'footer', 'type' => 'composite', 'name' => 'Footer'],
                ],
            ]],
        ];
    }

    /** @return list<string> */
    private function ids(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }
        $ids = is_string($value['id'] ?? null) ? [$value['id']] : [];
        foreach ($value as $child) {
            array_push($ids, ...$this->ids($child));
        }

        return $ids;
    }

    /** @return array<string, mixed>|null */
    private function find(mixed $value, string $id): ?array
    {
        if (! is_array($value)) {
            return null;
        }
        if (($value['id'] ?? null) === $id) {
            return $value;
        }
        foreach ($value as $child) {
            $found = $this->find($child, $id);
            if ($found !== null) {
                return $found;
            }
        }

        return null;
    }
}
