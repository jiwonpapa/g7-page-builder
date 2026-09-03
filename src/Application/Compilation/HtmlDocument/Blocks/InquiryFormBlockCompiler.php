<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class InquiryFormBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.inquiry-form-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'formKind', 'submitLabel', 'successMessage', 'privacyLabel', 'showPhone', 'showSubject', 'appearance'], 'Inquiry form');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->properties->optionalRichTextString($props, 'description', 1000) ?? '';
        $kind = $this->properties->requiredString($props, 'formKind', 24);
        $submitLabel = $this->properties->requiredString($props, 'submitLabel', 80);
        $successMessage = $this->properties->requiredString($props, 'successMessage', 300);
        $privacyLabel = $this->properties->requiredString($props, 'privacyLabel', 300);
        $showPhone = $this->properties->requiredBoolean($props, 'showPhone');
        $showSubject = $this->properties->requiredBoolean($props, 'showSubject');
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($kind, ['inquiry', 'quote', 'reservation', 'application', 'newsletter'], true)) {
            throw new DocumentCompileException('Inquiry form kind is invalid.');
        }

        $phone = $showPhone ? '<label><span>전화번호</span><span data-g7pb-form-control="input" data-g7pb-control-type="tel" data-g7pb-control-name="phone" data-g7pb-control-maxlength="40" data-g7pb-control-autocomplete="tel"></span></label>' : '';
        $subject = $showSubject ? '<label class="g7pb-inquiry-form__wide"><span>문의 제목</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="subject" data-g7pb-control-maxlength="200"></span></label>' : '';

        return '<section class="g7pb-block g7pb-inquiry '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="inquiry-form">'
            .'<div class="g7pb-inquiry__intro">'.$this->markup->compileSectionHeading($eyebrow, $heading).($description === '' ? '' : ($this->richText->hasCanonicalRichTextMarkup($description) ? '<div class="g7pb-inquiry__description">'.$this->richText->sanitizeRichText($description).'</div>' : '<p>'.$this->escaper->formatText($description).'</p>')).'</div>'
            .'<div class="g7pb-inquiry-form" data-g7pb-inquiry-host data-g7pb-inquiry-form data-g7pb-form-action="/pages/__G7PB_PAGE_SLUG__/inquiries" data-g7pb-form-kind="'.$kind.'" data-g7pb-success-message="'.$this->escaper->escapeAttribute($successMessage).'" data-g7pb-privacy-label="'.$this->escaper->escapeAttribute($privacyLabel).'" data-g7pb-submit-label="'.$this->escaper->escapeAttribute($submitLabel).'" data-g7pb-show-phone="'.($showPhone ? 'true' : 'false').'" data-g7pb-show-subject="'.($showSubject ? 'true' : 'false').'">'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="form_kind" data-g7pb-control-value="'.$kind.'"></span>'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="block_instance_id"></span>'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="started_at"></span>'
            .'<label class="g7pb-inquiry-form__honeypot" aria-hidden="true"><span>웹사이트</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="website" data-g7pb-control-tabindex="-1" data-g7pb-control-autocomplete="off"></span></label>'
            .'<label><span>이름</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="name" data-g7pb-control-maxlength="120" data-g7pb-control-autocomplete="name" data-g7pb-control-required="true"></span></label>'
            .'<label><span>이메일</span><span data-g7pb-form-control="input" data-g7pb-control-type="email" data-g7pb-control-name="email" data-g7pb-control-maxlength="320" data-g7pb-control-autocomplete="email" data-g7pb-control-required="true"></span></label>'.$phone.$subject
            .'<label class="g7pb-inquiry-form__wide"><span>문의 내용</span><span data-g7pb-form-control="textarea" data-g7pb-control-name="message" data-g7pb-control-maxlength="5000" data-g7pb-control-rows="6" data-g7pb-control-required="true"></span></label>'
            .'<label class="g7pb-inquiry-form__consent"><span data-g7pb-form-control="input" data-g7pb-control-type="checkbox" data-g7pb-control-name="privacy" data-g7pb-control-value="1" data-g7pb-control-required="true"></span><span data-g7pb-privacy-copy>'.$this->escaper->escape($privacyLabel).'</span></label>'
            .'<div class="g7pb-inquiry-form__footer"><span data-g7pb-form-control="button" data-g7pb-control-type="submit" data-g7pb-submit-copy>'.$this->escaper->escape($submitLabel).'</span><p role="status" aria-live="polite" data-g7pb-form-status></p></div></div>'
            .'</section>';
    }
}
