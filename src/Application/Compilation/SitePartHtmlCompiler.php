<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;

final class SitePartHtmlCompiler
{
    public const COMPILER_VERSION = '0.3.0';

    public function compile(SitePartDocument $document, int $sourceRevision): SitePartArtifact
    {
        $sections = [];
        foreach ($document->blocks as $index => $block) {
            $type = $block['type'] ?? null;
            $props = $block['props'] ?? null;
            if (! is_string($type) || ! is_array($props)) {
                throw new DocumentCompileException("Site Part block {$index} is invalid.");
            }

            $sections[] = match ($type) {
                'site.header.navigation-01' => $this->compileHeaderNavigation($props),
                'site.header.announcement-01' => $this->compileAnnouncement($props),
                'site.footer.simple-01' => $this->compileSimpleFooter($props),
                'site.footer.columns-01' => $this->compileColumnsFooter($props),
                default => throw new DocumentCompileException("Site Part block {$index} is not supported."),
            };
        }

        $html = implode("\n", $sections);

        return new SitePartArtifact(
            kind: $document->kind,
            html: $html,
            artifactSha256: hash('sha256', self::COMPILER_VERSION."\n".$html),
            compilerVersion: self::COMPILER_VERSION,
            sourceRevision: $sourceRevision,
        );
    }

    /** @param array<string, mixed> $props */
    private function compileHeaderNavigation(array $props): string
    {
        $brand = $this->requiredString($props, 'brand_name', 120);
        $logo = $this->optionalString($props, 'logo_url', 2048) ?? '';
        $home = $this->requiredUrl($props, 'home_url');
        $variant = $this->optionalString($props, 'variant', 16) ?? 'solid';
        if (! in_array($variant, ['solid', 'transparent'], true)) {
            throw new DocumentCompileException('Header variant is invalid.');
        }
        if ($logo !== '') {
            $this->assertImageUrl($logo);
        }

        $navigation = $this->navigationLinks($props['navigation'] ?? [], 10, 8, 'Header navigation');
        $cta = $props['cta'] ?? null;
        if ($cta !== null && ! is_array($cta)) {
            throw new DocumentCompileException('Header CTA must be an object.');
        }
        $ctaLink = is_array($cta) ? $this->link($cta, 'Header CTA') : null;
        $sticky = (bool) ($props['sticky'] ?? true);
        $mobileMenu = (bool) ($props['mobile_menu'] ?? true);
        $mobileMenuStyle = $this->optionalString($props, 'mobile_menu_style', 24) ?? 'drawer-right';
        if (! in_array($mobileMenuStyle, ['dropdown', 'drawer-left', 'drawer-right'], true)) {
            throw new DocumentCompileException('Header mobile menu style is invalid.');
        }
        $brandContent = $logo === ''
            ? '<span>'.$this->escape($brand).'</span>'
            : '<img src="'.$this->attribute($logo).'" alt="'.$this->attribute($brand).'">';
        $navigationHtml = $this->navigation($navigation, '주 메뉴', 'g7pb-site-nav');
        $ctaHtml = $ctaLink === null ? '' : '<a class="g7pb-site-header__cta" href="'.$this->attribute($ctaLink['url']).'">'.$this->escape($ctaLink['label']).'</a>';
        $mobileHtml = '';
        if ($mobileMenu && ($navigation !== [] || $ctaLink !== null)) {
            $mobileLinks = $this->mobileNavigation($navigation);
            $mobileCta = $ctaLink === null ? '' : '<a class="g7pb-mobile-menu__cta" href="'.$this->attribute($ctaLink['url']).'">'.$this->escape($ctaLink['label']).'</a>';
            $close = $mobileMenuStyle === 'dropdown' ? '' : '<button class="g7pb-mobile-menu__close" type="button" aria-label="메뉴 닫기" data-g7pb-menu-close>&times;</button>';
            $backdrop = $mobileMenuStyle === 'dropdown' ? '' : '<button class="g7pb-mobile-menu__backdrop" type="button" aria-label="메뉴 닫기" data-g7pb-menu-backdrop hidden></button>';
            $mobileHtml = '<button class="g7pb-menu-toggle" type="button" aria-expanded="false" aria-controls="g7pb-mobile-navigation" aria-label="메뉴 열기" data-g7pb-menu-toggle><span></span></button>'
                .$backdrop.'<nav class="g7pb-mobile-menu g7pb-mobile-menu--'.$mobileMenuStyle.'" id="g7pb-mobile-navigation" aria-label="모바일 메뉴" data-g7pb-mobile-menu data-g7pb-menu-style="'.$mobileMenuStyle.'" hidden>'.$close.'<ul>'.$mobileLinks.'</ul>'.$mobileCta.'</nav>';
        }

        $classes = 'g7pb-site-header'.($sticky ? ' is-sticky' : '').($variant === 'transparent' ? ' is-transparent' : '');

        return '<header class="'.$classes.'" data-g7pb-site-header data-testid="page-builder-site-header"><div class="g7pb-site-header__inner">'
            .'<a class="g7pb-site-brand" href="'.$this->attribute($home).'">'.$brandContent.'</a>'.$navigationHtml.$ctaHtml.$mobileHtml.'</div></header>';
    }

    /** @param array<string, mixed> $props */
    private function compileAnnouncement(array $props): string
    {
        $text = $this->requiredString($props, 'text', 240);
        $tone = $this->optionalString($props, 'tone', 16) ?? 'brand';
        if (! in_array($tone, ['brand', 'dark', 'light'], true)) {
            throw new DocumentCompileException('Announcement tone is invalid.');
        }
        $label = $this->optionalString($props, 'link_label', 80) ?? '';
        $url = $this->optionalString($props, 'link_url', 2048) ?? '';
        if (($label === '') !== ($url === '')) {
            throw new DocumentCompileException('Announcement link label and URL must be provided together.');
        }
        $link = '';
        if ($url !== '') {
            $this->assertUrl($url);
            $link = '<a href="'.$this->attribute($url).'">'.$this->escape($label).'</a>';
        }

        return '<aside class="g7pb-site-announcement g7pb-site-announcement--'.$tone.'" data-testid="page-builder-site-announcement"><p>'.$this->escape($text).$link.'</p></aside>';
    }

    /** @param array<string, mixed> $props */
    private function compileSimpleFooter(array $props): string
    {
        $brand = $this->requiredString($props, 'brand_name', 120);
        $home = $this->requiredUrl($props, 'home_url');
        $navigation = $this->links($props['navigation'] ?? [], 10, 'Footer navigation');
        $legal = $this->optionalString($props, 'footer_text', 500) ?? '';

        return '<footer class="g7pb-site-footer" data-testid="page-builder-site-footer"><div class="g7pb-site-footer__top">'
            .'<a class="g7pb-site-brand" href="'.$this->attribute($home).'">'.$this->escape($brand).'</a>'
            .$this->navigation($navigation, '하단 메뉴', '').'</div>'
            .($legal === '' ? '' : '<p class="g7pb-site-footer__legal">'.$this->escape($legal).'</p>').'</footer>';
    }

    /** @param array<string, mixed> $props */
    private function compileColumnsFooter(array $props): string
    {
        $brand = $this->requiredString($props, 'brand_name', 120);
        $home = $this->requiredUrl($props, 'home_url');
        $legal = $this->optionalString($props, 'legal_text', 500) ?? '';
        $columns = $props['columns'] ?? null;
        if (! is_array($columns) || count($columns) < 1 || count($columns) > 4) {
            throw new DocumentCompileException('Footer columns must contain between one and four groups.');
        }
        $compiledColumns = [];
        foreach (array_values($columns) as $index => $column) {
            if (! is_array($column)) {
                throw new DocumentCompileException("Footer column {$index} must be an object.");
            }
            $heading = $this->requiredString($column, 'heading', 80);
            $links = $this->links($column['links'] ?? [], 8, "Footer column {$index}");
            $items = implode('', array_map(
                fn (array $link): string => '<li><a href="'.$this->attribute($link['url']).'">'.$this->escape($link['label']).'</a></li>',
                $links,
            ));
            $compiledColumns[] = '<section><h2>'.$this->escape($heading).'</h2><ul>'.$items.'</ul></section>';
        }

        return '<footer class="g7pb-site-footer g7pb-site-footer--columns" data-testid="page-builder-site-footer"><div class="g7pb-site-footer__columns">'
            .'<div><a class="g7pb-site-brand" href="'.$this->attribute($home).'">'.$this->escape($brand).'</a></div>'
            .implode('', $compiledColumns).'</div>'
            .($legal === '' ? '' : '<p class="g7pb-site-footer__legal">'.$this->escape($legal).'</p>').'</footer>';
    }

    /** @return list<array{label: string, url: string}> */
    private function links(mixed $value, int $maximum, string $context): array
    {
        if (! is_array($value) || count($value) > $maximum) {
            throw new DocumentCompileException("{$context} is invalid.");
        }

        return array_values(array_map(
            fn (mixed $item): array => is_array($item)
                ? $this->link($item, $context)
                : throw new DocumentCompileException("{$context} link is invalid."),
            $value,
        ));
    }

    /**
     * @param  array<string, mixed>  $value
     * @return array{label: string, url: string}
     */
    private function link(array $value, string $context): array
    {
        $label = $this->requiredString($value, 'label', 80);
        $url = $this->requiredString($value, 'url', 2048);
        $this->assertUrl($url);

        return ['label' => $label, 'url' => $url];
    }

    /** @param list<array{label: string, url: string, children?: list<array{label: string, url: string}>}> $links */
    private function navigation(array $links, string $label, string $class): string
    {
        if ($links === []) {
            return '';
        }
        $items = implode('', array_map(
            function (array $link): string {
                $children = $link['children'] ?? [];
                $submenu = '';
                $class = '';
                $indicator = '';
                if ($children !== []) {
                    $class = ' class="has-children"';
                    $indicator = '<span aria-hidden="true">⌄</span>';
                    $submenuItems = implode('', array_map(
                        fn (array $child): string => '<li><a href="'.$this->attribute($child['url']).'">'.$this->escape($child['label']).'</a></li>',
                        $children,
                    ));
                    $submenu = '<ul class="g7pb-site-subnav">'.$submenuItems.'</ul>';
                }

                return '<li'.$class.'><a href="'.$this->attribute($link['url']).'">'.$this->escape($link['label']).$indicator.'</a>'.$submenu.'</li>';
            },
            $links,
        ));

        return '<nav'.($class === '' ? '' : ' class="'.$class.'"').' aria-label="'.$this->attribute($label).'"><ul>'.$items.'</ul></nav>';
    }

    /**
     * @param  list<array{label: string, url: string, children?: list<array{label: string, url: string}>}>  $links
     */
    private function mobileNavigation(array $links): string
    {
        $items = [];
        foreach ($links as $index => $link) {
            $children = $link['children'] ?? [];
            if ($children === []) {
                $items[] = '<li><a href="'.$this->attribute($link['url']).'">'.$this->escape($link['label']).'</a></li>';

                continue;
            }
            $submenuId = 'g7pb-mobile-submenu-'.substr(hash('sha256', $link['url'].':'.$index), 0, 10);
            $submenuItems = implode('', array_map(
                fn (array $child): string => '<li><a href="'.$this->attribute($child['url']).'">'.$this->escape($child['label']).'</a></li>',
                $children,
            ));
            $items[] = '<li class="has-children"><div class="g7pb-mobile-menu__row"><a href="'.$this->attribute($link['url']).'">'.$this->escape($link['label']).'</a>'
                .'<button type="button" aria-expanded="false" aria-controls="'.$submenuId.'" aria-label="'.$this->attribute($link['label'].' 하위 메뉴 열기').'" data-g7pb-submenu-toggle><span aria-hidden="true">⌄</span></button></div>'
                .'<ul class="g7pb-mobile-subnav" id="'.$submenuId.'" data-g7pb-mobile-submenu hidden>'.$submenuItems.'</ul></li>';
        }

        return implode('', $items);
    }

    /**
     * @return list<array{label: string, url: string, children?: list<array{label: string, url: string}>}>
     */
    private function navigationLinks(mixed $value, int $maximum, int $childMaximum, string $context): array
    {
        if (! is_array($value) || count($value) > $maximum) {
            throw new DocumentCompileException("{$context} is invalid.");
        }

        $links = [];
        foreach (array_values($value) as $index => $item) {
            if (! is_array($item) || array_diff(array_keys($item), ['label', 'url', 'children']) !== []) {
                throw new DocumentCompileException("{$context} link {$index} is invalid.");
            }
            $link = $this->link($item, $context);
            $children = $this->links($item['children'] ?? [], $childMaximum, "{$context} child {$index}");
            foreach (($item['children'] ?? []) as $child) {
                if (is_array($child) && array_key_exists('children', $child)) {
                    throw new DocumentCompileException("{$context} supports only two menu levels.");
                }
            }
            $links[] = $children === [] ? $link : [...$link, 'children' => $children];
        }

        return $links;
    }

    /** @param array<string, mixed> $data */
    private function requiredUrl(array $data, string $key): string
    {
        $url = $this->requiredString($data, $key, 2048);
        $this->assertUrl($url);

        return $url;
    }

    /** @param array<string, mixed> $data */
    private function requiredString(array $data, string $key, int $maximum): string
    {
        $value = $this->optionalString($data, $key, $maximum);
        if ($value === null || $value === '') {
            throw new DocumentCompileException("Site Part {$key} is required.");
        }

        return $value;
    }

    /** @param array<string, mixed> $data */
    private function optionalString(array $data, string $key, int $maximum): ?string
    {
        $value = $data[$key] ?? null;
        if ($value === null) {
            return null;
        }
        if (! is_string($value) || mb_strlen($value) > $maximum) {
            throw new DocumentCompileException("Site Part {$key} is invalid.");
        }

        return trim($value);
    }

    private function assertUrl(string $url): void
    {
        if ($url === '' || strlen($url) > 2048) {
            throw new DocumentCompileException('Site Part URL is invalid.');
        }
        if (($url[0] === '/' && ! str_starts_with($url, '//')) || $url[0] === '#') {
            return;
        }
        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (! is_string($scheme) || ! in_array(strtolower($scheme), ['http', 'https', 'mailto', 'tel'], true)) {
            throw new DocumentCompileException('Site Part URL scheme is not allowed.');
        }
    }

    private function assertImageUrl(string $url): void
    {
        if ($url !== '' && $url[0] === '/' && ! str_starts_with($url, '//')) {
            return;
        }
        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (! is_string($scheme) || ! in_array(strtolower($scheme), ['http', 'https'], true)) {
            throw new DocumentCompileException('Site Part image URL scheme is not allowed.');
        }
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function attribute(string $value): string
    {
        return $this->escape($value);
    }
}
