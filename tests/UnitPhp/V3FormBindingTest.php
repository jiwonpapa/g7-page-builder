<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class V3FormBindingTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    public function test_shared_fixed_binding_contract_matches_typescript_without_mutation(): void
    {
        $fixture = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR)->form_binding;
        $validator = $this->validator();
        foreach ($fixture->cases as $case) {
            $document = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
            $document->blocks = unserialize(serialize($fixture->blocks));
            foreach ($case->changes as $change) {
                $cursor = &$document->blocks;
                $path = $change->path;
                $key = array_pop($path);
                foreach ($path as $part) {
                    if (is_array($cursor)) {
                        $cursor = &$cursor[$part];
                    } else {
                        $cursor = &$cursor->{$part};
                    }
                }
                if (is_array($cursor)) {
                    $cursor[$key] = $change->value;
                } else {
                    $cursor->{$key} = $change->value;
                }
                unset($cursor);
            }
            $json = json_encode($document, JSON_THROW_ON_ERROR);
            if ($case->valid) {
                self::assertEquals($document, $validator->validateJson($json), $case->name);
            } else {
                try {
                    $validator->validateJson($json);
                    self::fail($case->name.' was accepted');
                } catch (InvalidArgumentException $error) {
                    self::assertStringStartsWith($case->error.':', $error->getMessage(), $case->name);
                }
            }
            self::assertSame($json, json_encode($document, JSON_THROW_ON_ERROR));
        }
    }

    public function test_no_service_binding_does_not_change_legacy_v3_documents(): void
    {
        $document = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        self::assertInstanceOf(stdClass::class, $this->validator()->validateJson(json_encode($document, JSON_THROW_ON_ERROR)));
        $policy = json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($policy['bindings']['fields'], $this->validator()->formFields());
    }
}
