<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\DraftRenderer;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\FormMarkup;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\HtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class V3FormMarkupTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    private function source(): stdClass
    {
        $source = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $source->blocks = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR)->form_binding->blocks;

        return $source;
    }

    public function test_all_shells_keep_safe_identity_labels_constraints_and_fixed_action_without_source_mutation(): void
    {
        $validator = $this->validator();
        foreach (['template', 'builder', 'none'] as $shell) {
            $source = $this->source();
            $source->shell_mode = $shell;
            $source->blocks[0]->binding->success_message = '접수 <완료> "안내"';
            $source->blocks[0]->slots->content[1]->props->placeholder = '이름 <입력>';
            $before = json_encode($source, JSON_THROW_ON_ERROR);
            $document = ValidatedDocument::fromJson($before, $validator);
            $result = (new HtmlCompiler($validator))->compile($document, 2, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
            self::assertIsString($result->artifact);
            $html = $result->artifact;
            self::assertDoesNotMatchRegularExpression('/<(form|input|textarea|button)\b/', $html);
            self::assertStringContainsString('data-g7pb-v3-inquiry="" data-block-id="'.$source->blocks[0]->instance_id.'" data-g7pb-form-kind="inquiry"', $html);
            self::assertStringContainsString('data-g7pb-form-action="/pages/precision/inquiries"', $html);
            self::assertStringContainsString('data-g7pb-success-message="접수 &lt;완료&gt; &quot;안내&quot;"', $html);
            self::assertStringContainsString('data-g7pb-control-placeholder="이름 &lt;입력&gt;"', $html);
            self::assertStringContainsString('data-g7pb-control-name="started_at"', $html);
            self::assertStringContainsString('data-g7pb-control-name="website"', $html);
            self::assertSame(4, substr_count($html, 'data-g7pb-control-required=""'));
            self::assertStringContainsString('data-g7pb-control-type="submit"', $html);
            self::assertStringNotContainsString('data-g7pb-runtime-button', $html);
            foreach ($source->blocks[0]->binding->fields as $field) {
                self::assertStringContainsString('for="node-'.$field->input_id.'"', $html);
                self::assertStringContainsString('aria-labelledby="node-'.$field->label_id.'"', $html);
                self::assertStringContainsString('data-g7pb-control-name="'.$field->name.'"', $html);
            }
            self::assertSame($before, json_encode($source, JSON_THROW_ON_ERROR));
        }
    }

    public function test_draft_and_unbound_controls_have_accessible_labels_but_no_live_form_submission(): void
    {
        $source = $this->source();
        foreach (['base', 'tablet', 'mobile'] as $viewport) {
            $html = (new DraftRenderer($this->validator()))->render(json_encode($source, JSON_THROW_ON_ERROR), $viewport);
            self::assertStringContainsString('<input', $html);
            self::assertStringContainsString('<textarea', $html);
            self::assertStringContainsString('<label', $html);
            self::assertStringContainsString('type="button"', $html);
            self::assertStringNotContainsString('<form', $html);
            self::assertStringNotContainsString('data-g7pb-inquiry-form', $html);
            self::assertStringContainsString('maxlength="320"', $html);
        }
        unset($source->blocks[0]->binding);
        $html = (new DraftRenderer($this->validator()))->render(json_encode($source, JSON_THROW_ON_ERROR));
        self::assertStringContainsString('aria-label="name"', $html);
        self::assertStringNotContainsString('aria-labelledby=', $html);
        self::assertStringNotContainsString('name="email"', $html);
    }

    public function test_input_typography_inherits_in_unassigned_responsive_layers_without_erasing_authored_styles(): void
    {
        $node = $this->source()->blocks[0]->slots->content[1];
        self::assertSame('inherit', FormMarkup::styles($node, [])['font-size']);
        self::assertSame('18px', FormMarkup::styles($node, ['font-size' => '18px'])['font-size']);
        $styles = ['--g7pb-v3-base-font-size' => 'initial', '--g7pb-v3-mobile-font-size' => '24px', 'font-size' => 'var(--g7pb-v3-current-font-size, revert)'];
        self::assertSame('var(--g7pb-v3-current-font-size, inherit)', FormMarkup::styles($node, $styles)['font-size']);
        self::assertSame('24px', FormMarkup::styles($node, $styles)['--g7pb-v3-mobile-font-size']);
        $label = $this->source()->blocks[0]->slots->content[0];
        self::assertSame('pre-wrap', FormMarkup::styles($label, [])['white-space']);
    }
}
