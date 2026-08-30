<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use PHPUnit\Framework\TestCase;

final class SiteShellProductQualityTest extends TestCase
{
    /** @param array<string, mixed> $props */
    private function compile(string $kind, array $props): string
    {
        $document = new SitePartDocument('11111111-1111-4111-8111-111111111111', $kind, 'ko', [], [[
            'instance_id' => '22222222-2222-4222-8222-222222222222',
            'type' => $kind === 'header' ? 'site.header.navigation-01' : 'site.footer.simple-01',
            'block_version' => 1,
            'props' => [...['brand_name' => '사이트 이름', 'home_url' => '/', 'navigation' => []], ...$props],
            'slots' => [],
        ]]);

        return (new SitePartHtmlCompiler)->compile($document, 1)->html;
    }

    public function test_default_header_has_typed_system_options_and_no_persisted_auth_state(): void
    {
        $html = $this->compile('header', []);
        self::assertStringContainsString('data-g7pb-shell-options=', $html);
        self::assertStringContainsString('data-g7pb-site-info="inherit"', $html);
        self::assertStringContainsString('data-g7pb-menu-toggle', $html);
        self::assertStringContainsString('data-g7pb-unified-menu', $html);
        self::assertStringContainsString('data-g7pb-mobile-shell-options=', $html);
        self::assertStringNotContainsString('auth_token', $html);
        self::assertStringNotContainsString('is_admin', $html);
    }

    public function test_explicitly_disabled_mobile_menu_preserves_the_existing_contract(): void
    {
        self::assertStringNotContainsString('data-g7pb-menu-toggle', $this->compile('header', ['mobile_menu' => false]));
    }

    public function test_factory_footer_inherits_site_information_but_custom_content_is_preserved(): void
    {
        $html = $this->compile('footer', ['footer_text' => '사이트 정보를 입력해 주세요.']);
        self::assertStringContainsString('data-g7pb-site-socials', $html);
        self::assertStringNotContainsString('사이트 정보를 입력해 주세요.', $html);
        $custom = $this->compile('footer', ['brand_name' => '형님 사이트', 'footer_text' => '등록 사업자 123']);
        self::assertStringNotContainsString('data-g7pb-site-info', $custom);
        self::assertStringContainsString('형님 사이트', $custom);
        self::assertStringContainsString('등록 사업자 123', $custom);
        self::assertStringNotContainsString('data-g7pb-site-info', $this->compile('footer', ['use_site_settings' => false]));
    }

    public function test_site_information_binding_is_boolean_not_an_executable_expression(): void
    {
        $this->expectException(DocumentCompileException::class);
        $this->compile('header', ['use_site_settings' => 'currentUser.is_admin']);
    }
}
