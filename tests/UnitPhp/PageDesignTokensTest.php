<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\DocumentThemeCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDesignTokens;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PageDesignTokensTest extends TestCase
{
    public function test_document_and_theme_use_the_same_validated_design_settings(): void
    {
        $values = ['design.color_mode' => 'dark', 'design.palette' => 'emerald', 'design.custom_color_1_light' => '#Aa00Ff', 'vendor.option' => true];
        $document = $this->document($values);
        $tokens = PageDesignTokens::fromArray($document->tokens);
        $theme = new DocumentThemeCompiler;

        self::assertSame($values, $document->toArray()['tokens']);
        self::assertSame('g7pb-document-theme g7pb-theme-mode-dark g7pb-theme-palette-emerald g7pb-theme-font-modern g7pb-theme-radius-soft g7pb-theme-width-standard g7pb-theme-scale-balanced g7pb-theme-custom-palette', $theme->className($tokens));
        self::assertStringContainsString('--g7pb-custom-tone-1-light:#aa00ff', $theme->customPaletteDeclarations($tokens));
        self::assertStringContainsString('--g7pb-custom-tone-4-dark:#fda4af', $theme->customPaletteDeclarations($tokens));
        self::assertStringNotContainsString('vendor.option', $theme->className($tokens));
    }

    public function test_absent_and_legacy_null_optional_values_keep_published_defaults(): void
    {
        $theme = new DocumentThemeCompiler;
        $defaults = PageDesignTokens::fromArray([]);
        $legacy = PageDesignTokens::fromArray(['design.color_mode' => null, 'design.custom_color_1_light' => null]);

        self::assertSame('', $theme->customPaletteDeclarations($defaults));
        self::assertStringContainsString('g7pb-theme-mode-light', $theme->className($legacy));
        self::assertStringContainsString('--g7pb-custom-tone-1-light:#2456df', $theme->customPaletteDeclarations($legacy));
        self::assertSame($defaults->presets(), $legacy->presets());
    }

    #[DataProvider('invalidDesignTokens')]
    public function test_invalid_known_design_values_are_rejected_when_constructing_the_document(string $name, mixed $value): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Page design token '.$name.' is invalid.');

        $this->document([$name => $value]);
    }

    /** @return iterable<string, array{string, mixed}> */
    public static function invalidDesignTokens(): iterable
    {
        yield 'unknown color mode' => ['design.color_mode', 'sepia'];
        yield 'boolean color mode' => ['design.color_mode', false];
        yield 'numeric color mode' => ['design.color_mode', 3];
        yield 'unknown palette' => ['design.palette', 'rainbow'];
        yield 'invalid legacy preset null' => ['design.palette', null];
        yield 'short custom hex' => ['design.custom_color_1_light', '#fff'];
        yield 'CSS expression' => ['design.custom_color_1_dark', 'var(--external)'];
        yield 'non-string custom color' => ['design.custom_color_4_dark', 123456];
    }

    public function test_unknown_scalar_tokens_remain_available_without_accepting_nested_payloads(): void
    {
        self::assertSame(['vendor.option' => 3], $this->document(['vendor.option' => 3])->tokens);
        $this->expectException(\InvalidArgumentException::class);
        PageDesignTokens::fromArray(['vendor.option' => ['unexpected' => true]]);
    }

    public function test_stored_color_values_remain_exact_and_cannot_change_the_immutable_value_object(): void
    {
        $values = ['design.color_mode' => 'sepia', 'vendor.option' => false];
        foreach (array_keys(PageDesignTokens::CUSTOM_COLOR_DEFAULTS) as $name) {
            $values[$name] = 'historical-invalid-color';
        }
        $stored = PageDesignTokens::fromStoredArray($values);
        self::assertSame($values, $stored->toArray());
        $copy = $stored->toArray();
        $copy['design.color_mode'] = 'light';
        self::assertSame($values, $stored->toArray());

        $this->expectException(\InvalidArgumentException::class);
        PageDesignTokens::fromArray($stored->toArray());
    }

    public function test_stored_recovery_does_not_relax_existing_presets_or_scalar_values(): void
    {
        $invalid = [
            ['design.palette' => 'rainbow'], ['design.font' => 'arbitrary'],
            ['design.radius' => 'arbitrary'], ['design.width' => 'arbitrary'],
            ['design.scale' => 'arbitrary'], ['design.palette' => null],
            ['design.color_mode' => []], ['design.custom_color_1_light' => []],
            ['vendor.option' => []], [0 => 'value'],
        ];
        foreach ($invalid as $values) {
            try {
                PageDesignTokens::fromStoredArray($values);
                self::fail('Stored recovery accepted an invalid existing contract.');
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    /** @param array<string, mixed> $tokens */
    private function document(array $tokens): PageBuilderDocument
    {
        return PageBuilderDocument::fromArray([
            'document_id' => '00000000-0000-4000-8000-000000000001',
            'schema_version' => 'g7-page-builder/v1',
            'slug' => 'design-policy',
            'mode' => 'canvas',
            'locale' => 'ko',
            'tokens' => $tokens,
            'blocks' => [],
        ]);
    }
}
