<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class ContactBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.contact-info-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys(
            $props,
            ['heading', 'address', 'phone', 'email', 'cta', 'mapLink', 'appearance'],
            'Contact',
        );

        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $address = $this->properties->requiredString($props, 'address', 1000);
        $phone = $this->properties->requiredString($props, 'phone', 40);
        $email = $this->properties->requiredString($props, 'email', 320);
        $phoneHref = $this->urls->phoneHref($phone);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new DocumentCompileException('Contact email is invalid.');
        }

        $actions = [];
        $cta = $this->properties->optionalMap($props, 'cta');
        if ($cta !== null) {
            $actions[] = $this->markup->compileActionLink($cta, 'Contact CTA', 'g7pb-button g7pb-button--primary');
        }
        $mapLink = $this->properties->optionalMap($props, 'mapLink');
        if ($mapLink !== null) {
            $actions[] = $this->markup->compileActionLink($mapLink, 'Contact map link', 'g7pb-button g7pb-button--secondary');
        }

        $actionMarkup = $actions === []
            ? ''
            : '<div class="g7pb-contact__actions">'.implode('', $actions).'</div>';

        return '<section class="g7pb-block g7pb-contact '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="contact"><div class="g7pb-contact__heading"><p class="g7pb-contact__eyebrow">Contact</p><h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2></div><address class="g7pb-contact__details"><p>'.$this->escaper->formatText($address).'</p><a href="'.$this->escaper->escapeAttribute($phoneHref).'">'.$this->escaper->escape($phone).'</a><a href="'.$this->escaper->escapeAttribute('mailto:'.$email).'">'.$this->escaper->escape($email).'</a></address>'.$actionMarkup.'</section>';
    }
}
