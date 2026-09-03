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

final readonly class TeamBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.team-grid-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'members', 'layout', 'appearance'], 'Team');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $members = $props['members'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if ($layout !== null && ! in_array($layout, ['grid', 'portraits', 'editorial', 'featured'], true)) {
            throw new DocumentCompileException('Team layout is invalid.');
        }

        if (! is_array($members) || count($members) < 2 || count($members) > 8) {
            throw new DocumentCompileException('Team must contain between two and eight members.');
        }

        $compiled = [];
        foreach (array_values($members) as $index => $member) {
            if (! is_array($member)) {
                throw new DocumentCompileException("Team member {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($member, ['name', 'role', 'bio', 'imageSrc', 'imageAlt', 'profileUrl'], "Team member {$index}");
            $name = $this->properties->requiredString($member, 'name', 120);
            $role = $this->properties->requiredString($member, 'role', 160);
            $bio = $this->properties->optionalRichTextString($member, 'bio', 1000) ?? '';
            $imageSrc = $this->properties->optionalString($member, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($member, 'imageAlt', 300) ?? '';
            $profileUrl = $this->properties->optionalString($member, 'profileUrl', 2048) ?? '';
            $media = $this->markup->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name, 'g7pb-team__image', mb_substr($name, 0, 1));
            $memberName = '<h3>'.$this->escaper->escape($name).'</h3>';
            if ($profileUrl !== '') {
                $this->urls->assertAllowedUrl($profileUrl, "Team member {$index}");
                $memberName = '<h3><a href="'.$this->escaper->escapeAttribute($profileUrl).'">'.$this->escaper->escape($name).'</a></h3>';
            }
            $bioMarkup = $this->richText->hasCanonicalRichTextMarkup($bio)
                ? '<div class="g7pb-team__bio">'.$this->richText->sanitizeRichText($bio).'</div>'
                : '<p>'.$this->escaper->formatText($bio).'</p>';
            $compiled[] = '<article><figure>'.$media.'</figure>'.$memberName.'<strong>'.$this->escaper->escape($role).'</strong>'.$bioMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-team--layout-'.$layout;

        return '<section class="g7pb-block g7pb-team'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="team">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-team__grid">'.implode('', $compiled).'</div></section>';
    }
}
