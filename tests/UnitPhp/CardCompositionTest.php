<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;

final class CardCompositionTest extends TestCase
{
    use CreatesBuiltInCompiler;

    private function payload(): array
    {
        $data = json_decode(file_get_contents(__DIR__.'/../Fixtures/layout-policy-cases.json'), true, flags: JSON_THROW_ON_ERROR)['imageText'];
        $data['blocks'][0]['type'] = 'content.card-01';
        $data['blocks'][0]['props'] = ['variant' => 'outlined'];
        $data['blocks'][0]['slots'] = ['media' => [], 'body' => [$data['blocks'][0]['slots']['extra'][0]], 'actions' => []];

        return $data;
    }

    public function test_compiles_only_valid_card_slots_without_an_outer_link(): void
    {
        $payload = $this->payload();
        foreach (['plain', 'outlined'] as $variant) {
            $payload['blocks'][0]['props']['variant'] = $variant;
            $html = $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7')->artifact;
            self::assertStringContainsString('g7pb-single-card--'.$variant, $html);
            self::assertStringContainsString('data-card-slot="body"', $html);
            self::assertStringNotContainsString('<a ', $html);
        }
    }

    public function test_rejects_wrong_children_duplicates_and_slot_names_before_save(): void
    {
        $source = $this->payload();
        foreach (['duplicate', 'media', 'invented'] as $mutation) {
            $payload = $source;
            if ($mutation === 'duplicate') {
                $copy = $payload['blocks'][0]['slots']['body'][0];
                $copy['instance_id'] = '00000000-0000-4000-8000-000000000908';
                $payload['blocks'][0]['slots']['body'][] = $copy;
            } else {
                $payload['blocks'][0]['slots'][$mutation] = $payload['blocks'][0]['slots']['body'];
                $payload['blocks'][0]['slots']['body'] = [];
            }
            try {
                PageBuilderDocument::fromArray($payload);
                self::fail('Invalid Card was accepted');
            } catch (\InvalidArgumentException $error) {
                self::assertStringContainsString($mutation === 'duplicate' ? 'component_slot_limit:' : ($mutation === 'media' ? 'parent:' : 'slot:'), $error->getMessage());
            }
        }
    }

    public function test_rejects_a_full_card_link_or_unknown_variant(): void
    {
        $source = $this->payload();
        foreach ([['variant' => 'unknown'], ['variant' => 'plain', 'url' => '/wrong']] as $props) {
            $payload = $source;
            $payload['blocks'][0]['props'] = $props;
            try {
                $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
                self::fail('Invalid Card props accepted');
            } catch (DocumentCompileException $error) {
                self::assertNotEmpty($error->getMessage());
            }
        }
    }
}
