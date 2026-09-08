<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;

final class HeroCompositionTest extends TestCase
{
    use CreatesBuiltInCompiler;

    public function test_declared_children_compile_in_order_and_keep_the_original_cta(): void
    {
        $payload = json_decode(file_get_contents(__DIR__.'/../Fixtures/layout-policy-cases.json'), true, flags: JSON_THROW_ON_ERROR)['hero'];
        foreach ([null, 'product', 'balanced'] as $layout) {
            if ($layout !== null) {
                $payload['blocks'][0]['props']['layout'] = $layout;
            }
            $document = PageBuilderDocument::fromArray($payload);
            $html = $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7')->artifact;
            self::assertIsString($html);
            self::assertStringContainsString('추가 배지', $html);
            self::assertLessThan(strpos($html, '추가 목록'), strpos($html, '추가 배지'));
            self::assertLessThan(strpos($html, 'href="/contact"'), strpos($html, '추가 목록'));
            self::assertSame(1, substr_count($html, 'href="/contact"'));
            self::assertStringContainsString('00000000-0000-4000-8000-000000000103', $html);
        }
    }

    public function test_duplicate_and_unsupported_children_are_rejected_on_the_server(): void
    {
        $source = json_decode(file_get_contents(__DIR__.'/../Fixtures/layout-policy-cases.json'), true, flags: JSON_THROW_ON_ERROR)['hero'];
        foreach (['duplicate', 'type', 'slot'] as $mutation) {
            $payload = $source;
            if ($mutation === 'duplicate') {
                $copy = $payload['blocks'][0]['slots']['extra'][0];
                $copy['instance_id'] = '00000000-0000-4000-8000-000000000105';
                $payload['blocks'][0]['slots']['extra'][] = $copy;
            } elseif ($mutation === 'type') {
                $payload['blocks'][0]['slots']['extra'][0] = [
                    'instance_id' => '00000000-0000-4000-8000-000000000105',
                    'type' => 'content.heading-01', 'block_version' => 1, 'props' => ['heading' => '제목'],
                ];
            } else {
                $payload['blocks'][0]['slots'] = ['actions' => []];
            }
            try {
                PageBuilderDocument::fromArray($payload);
                self::fail('Invalid Hero composition was accepted: '.$mutation);
            } catch (\InvalidArgumentException $error) {
                self::assertStringContainsString(match ($mutation) {
                    'duplicate' => 'component_slot_limit:', 'type' => 'parent:', default => 'slot:',
                }, $error->getMessage());
            }
        }
    }
}
