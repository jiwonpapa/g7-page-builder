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
                $payload['blocks'][0]['slots'] = ['unknown' => []];
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

    public function test_image_text_composition_preserves_copy_media_link_order_and_rejects_bad_slots(): void
    {
        $payload = json_decode(file_get_contents(__DIR__.'/../Fixtures/layout-policy-cases.json'), true, flags: JSON_THROW_ON_ERROR)['imageText'];
        foreach (['left', 'right'] as $position) {
            $payload['blocks'][0]['props']['mediaPosition'] = $position;
            $html = $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7')->artifact;
            self::assertIsString($html);
            self::assertStringContainsString('g7pb-image-text--'.$position, $html);
            self::assertLessThan(strpos($html, '추가 목록'), strpos($html, '추가 배지'));
            self::assertLessThan(strpos($html, 'data-block-type="divider"'), strpos($html, '추가 목록'));
            self::assertLessThan(strpos($html, 'href="/contact"'), strpos($html, 'data-block-type="divider"'));
            self::assertSame(1, substr_count($html, 'href="/contact"'));
        }
        $payload['blocks'][0]['slots']['extra'][] = [
            ...$payload['blocks'][0]['slots']['extra'][2],
            'instance_id' => '00000000-0000-4000-8000-000000000107',
        ];
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('component_slot_limit:');
        PageBuilderDocument::fromArray($payload);
    }
    public function test_actions_have_one_owner_preserve_empty_state_and_compile_once(): void
    {
        $fixtures = json_decode(file_get_contents(__DIR__.'/../Fixtures/layout-policy-cases.json'), true, flags: JSON_THROW_ON_ERROR);
        foreach (['hero' => 'primaryCta', 'imageText' => 'primaryLink'] as $kind => $prop) {
            $payload = $fixtures[$kind];
            $link = $payload['blocks'][0]['props'][$prop];
            unset($payload['blocks'][0]['props'][$prop]);
            $payload['blocks'][0]['slots']['actions'] = [[
                'instance_id' => '00000000-0000-4000-8000-000000000109',
                'type' => 'action.buttons-01', 'block_version' => 1,
                'props' => ['items' => [[...$link, 'variant' => 'primary']], 'alignment' => 'center'],
            ]];
            $html = $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7')->artifact;
            self::assertIsString($html);
            self::assertSame(1, substr_count($html, 'href="/contact"'));
            self::assertStringContainsString('00000000-0000-4000-8000-000000000109', $html);
            $payload['blocks'][0]['slots']['actions'] = [];
            $empty = PageBuilderDocument::fromArray($payload);
            self::assertSame([], $empty->toArray()['blocks'][0]['slots']['actions']);
            $html = $this->builtInCompiler()->compile($empty, 1, 'html', 'g7-7.0.7')->artifact;
            self::assertIsString($html);
            self::assertStringNotContainsString('href="/contact"', $html);
            $payload['blocks'][0]['props'][$prop] = $link;
            try {
                PageBuilderDocument::fromArray($payload);
                self::fail('Dual action ownership accepted');
            } catch (\InvalidArgumentException $error) {
                self::assertStringContainsString('action_owner:', $error->getMessage());
            }
        }
    }

}
