<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;

final class DocumentV3BehaviorsTest extends TestCase
{
    public function test_shared_behavior_cases_and_lossless_roundtrip(): void
    {
        $validator = new Validator(
            json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR),
        );
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach ($cases->behavior_cases as $case) {
            $value = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
            $value->blocks = json_decode(json_encode($cases->behavior_fixtures->{$case->fixture}, JSON_THROW_ON_ERROR), flags: JSON_THROW_ON_ERROR);
            foreach ($case->patches as $patch) {
                $target = &$value;
                $path = $patch->path;
                $key = array_pop($path);
                foreach ($path as $part) {
                    if (is_array($target)) {
                        $target = &$target[$part];
                    } else {
                        $target = &$target->{$part};
                    }
                }
                if ($patch->remove ?? false) {
                    if (is_array($target)) {
                        unset($target[$key]);
                    } else {
                        unset($target->{$key});
                    }
                } elseif (is_array($target)) {
                    $target[$key] = $patch->value;
                } else {
                    $target->{$key} = $patch->value;
                }
                unset($target);
            }
            $json = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($case->valid) {
                self::assertSame($json, json_encode($validator->validateJson($json), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $case->name);
            } else {
                try {
                    $validator->validateJson($json);
                    self::fail($case->name.' was accepted');
                } catch (InvalidArgumentException $error) {
                    self::assertStringStartsWith($case->error.':', $error->getMessage(), $case->name);
                }
            }
            self::assertSame($json, json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $case->name.' mutated input');
        }
    }
}
