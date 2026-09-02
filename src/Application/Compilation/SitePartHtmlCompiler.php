<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;

final class SitePartHtmlCompiler
{
    public const COMPILER_VERSION = '0.7.0';

    public function compile(SitePartDocument $document, int $sourceRevision): SitePartArtifact
    {
        try {
            $document->assertWritable();
        } catch (\InvalidArgumentException $exception) {
            throw new DocumentCompileException($exception->getMessage());
        }
        $primaryTypes = $document->kind === 'header'
            ? ['site.header.navigation-01']
            : ['site.footer.simple-01', 'site.footer.columns-01'];
        $primaryCount = count(array_filter(
            $document->blocks,
            static fn (array $block): bool => in_array($block['type'] ?? null, $primaryTypes, true),
        ));
        if ($primaryCount !== 1) {
            throw new DocumentCompileException('Site Part publication requires exactly one primary block.');
        }
        $sections = [];
        foreach ($document->blocks as $index => $block) {
            $type = $block['type'] ?? null;
            $props = $block['props'] ?? null;
            $slots = $block['slots'] ?? [];
            if (! is_string($type) || ! is_array($props) || ! is_array($slots)) {
                throw new DocumentCompileException("Site Part block {$index} is invalid.");
            }

            $sections[] = match ($type) {
                'site.header.navigation-01' => $this->compileHeaderNavigation($props, $slots, $document->locale),
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

    /**
     * @param  array<string, mixed>  $props
     * @param  array<string, mixed>  $slots
     */
    private function compileHeaderNavigation(array $props, array $slots, string $locale): string
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
        if (! in_array($mobileMenuStyle, ['dropdown', 'drawer-left', 'drawer-right', 'sheet-bottom'], true)) {
            throw new DocumentCompileException('Header mobile menu style is invalid.');
        }
        $responsive = $this->headerResponsivePresentation($props, $mobileMenuStyle);
        $responsiveAttributes = $this->headerResponsiveAttributes($responsive);
        $brandContent = $logo === ''
            ? '<span>'.$this->escape($brand).'</span>'
            : '<img src="'.$this->attribute($logo).'" alt="'.$this->attribute($brand).'">';
        $navigationHtml = $this->navigation($navigation, '주 메뉴', 'g7pb-site-nav')
            ?: '<div class="g7pb-site-nav" aria-hidden="true"></div>';
        $ctaHtml = $ctaLink === null ? '' : '<a class="g7pb-site-header__cta" href="'.$this->attribute($ctaLink['url']).'">'.$this->escape($ctaLink['label']).'</a>';
        $systemOptions = $this->systemControlOptions($slots);
        $systemControls = $this->systemControls($locale, $systemOptions);
        $mobileHtml = '';
        if ($mobileMenu && ($navigation !== [] || $ctaLink !== null || in_array(true, $systemOptions ?? [], true))) {
            $mobileLinks = $this->mobileNavigation($navigation);
            $mobileCta = $ctaLink === null ? '' : '<a class="g7pb-mobile-menu__cta" href="'.$this->attribute($ctaLink['url']).'">'.$this->escape($ctaLink['label']).'</a>';
            $close = '<span class="g7pb-mobile-menu__close" aria-label="메뉴 닫기" data-g7pb-menu-close>&times;</span>';
            $backdrop = '<span class="g7pb-mobile-menu__backdrop" aria-label="메뉴 닫기" data-g7pb-menu-backdrop '.$responsiveAttributes.' hidden></span>';
            $mobileOptions = $systemOptions === null ? '' : ' data-g7pb-system-controls data-g7pb-mobile-shell-options="'.$this->attribute(json_encode($systemOptions, JSON_THROW_ON_ERROR)).'" data-g7pb-shell-locale="'.$this->attribute($locale).'"';
            $mobileHtml = '<span class="g7pb-menu-toggle" aria-expanded="false" aria-controls="g7pb-mobile-navigation" aria-label="메뉴 열기" data-g7pb-menu-toggle><span></span></span>'
                .$backdrop.'<section class="g7pb-mobile-menu g7pb-mobile-menu--'.$mobileMenuStyle.'" id="g7pb-mobile-navigation" aria-label="전체 메뉴" data-g7pb-mobile-menu data-g7pb-unified-menu data-g7pb-menu-style="'.$responsive['mobile']['mobile_menu_style'].'" '.$responsiveAttributes.$mobileOptions.' hidden><div class="g7pb-mobile-menu__heading"><strong>전체 메뉴</strong>'.$close.'</div><div class="g7pb-mobile-account" data-g7pb-mobile-account></div><nav aria-label="모바일 메뉴"><ul>'.$mobileLinks.'</ul></nav>'.$mobileCta.'<div class="g7pb-mobile-settings" data-g7pb-mobile-settings></div></section>';
        }

        $classes = 'g7pb-site-header'.($sticky ? ' is-sticky' : '').($variant === 'transparent' ? ' is-transparent' : '');
        $actionsHtml = '<div class="g7pb-site-header__actions">'.$ctaHtml.$systemControls.$mobileHtml.'</div>';

        return '<header class="'.$classes.'" '.($mobileHtml !== '' ? 'data-g7pb-unified-header ' : '').$this->siteInfoAttribute($props).' data-g7pb-site-header data-testid="page-builder-site-header" '.$responsiveAttributes.'><div class="g7pb-site-header__inner">'
            .'<a class="g7pb-site-brand" href="'.$this->attribute($home).'">'.$brandContent.'</a>'.$navigationHtml.$actionsHtml.'</div></header>';
    }

    /** @param array{search: bool, account: bool, cart: bool, notifications: bool, theme: bool, locale: bool, currency: bool}|null $options */
    private function systemControls(string $locale, ?array $options): string
    {
        if ($options === null) {
            return '';
        }
        $english = str_starts_with(strtolower($locale), 'en');
        $labels = $english ? [
            'controls' => 'Site tools', 'search' => 'Search', 'search_placeholder' => 'Search',
            'notifications' => 'Notifications', 'cart' => 'Cart', 'theme' => 'Theme',
            'language' => 'Language', 'currency' => 'Currency', 'login' => 'Log in',
            'register' => 'Register', 'mypage' => 'My page', 'logout' => 'Log out',
        ] : [
            'controls' => '사이트 기능', 'search' => '검색', 'search_placeholder' => '통합 검색',
            'notifications' => '알림', 'cart' => '장바구니', 'theme' => '화면 모드',
            'language' => '언어', 'currency' => '통화', 'login' => '로그인',
            'register' => '회원가입', 'mypage' => '마이페이지', 'logout' => '로그아웃',
        ];

        $controls = '';
        if ($options['search']) {
            $controls .= '<span data-g7pb-system-search-host data-g7pb-label="'.$this->attribute($labels['search']).'" data-g7pb-placeholder="'.$this->attribute($labels['search_placeholder']).'"></span>';
        }
        if ($options['notifications']) {
            $controls .= '<a href="/mypage/notifications" data-g7pb-system-member hidden>'.$this->escape($labels['notifications']).'<span class="g7pb-system-badge" data-g7pb-system-notification-count hidden></span></a>';
        }
        if ($options['cart']) {
            $controls .= '<a href="/shop/cart" data-g7pb-system-cart>'.$this->escape($labels['cart']).'<span class="g7pb-system-badge" data-g7pb-system-cart-count hidden></span></a>';
        }
        if ($options['theme']) {
            $controls .= '<a href="#g7-action-theme" data-g7pb-system-theme>'.$this->escape($labels['theme']).'</a>';
        }
        if ($options['locale']) {
            $controls .= '<span data-g7pb-system-locale-host data-g7pb-label="'.$this->attribute($labels['language']).'"></span>';
        }
        if ($options['currency']) {
            $controls .= '<span data-g7pb-system-currency-host data-g7pb-label="'.$this->attribute($labels['currency']).'"></span>';
        }
        if ($options['account']) {
            $controls .= '<a href="/login" data-g7pb-system-guest>'.$this->escape($labels['login']).'</a>'
                .'<a href="/register" data-g7pb-system-guest data-g7pb-system-register>'.$this->escape($labels['register']).'</a>'
                .'<a href="/mypage" data-g7pb-system-member hidden>'.$this->escape($labels['mypage']).'</a>'
                .'<a href="#g7-action-logout" data-g7pb-system-member hidden>'.$this->escape($labels['logout']).'</a>';
        }

        return $controls === '' ? '' : '<nav class="g7pb-system-controls" aria-label="'.$this->attribute($labels['controls']).'" data-g7pb-system-controls data-g7pb-shell-locale="'.$this->attribute($locale).'" data-g7pb-shell-options="'.$this->attribute(json_encode($options, JSON_THROW_ON_ERROR)).'">'.$controls.'</nav>';
    }

    /**
     * @param  array<string, mixed>  $slots
     * @return array{search: bool, account: bool, cart: bool, notifications: bool, theme: bool, locale: bool, currency: bool}|null
     */
    private function systemControlOptions(array $slots): ?array
    {
        $this->assertOnlyKeys($slots, ['systemControls'], 'Header slots');
        if (! array_key_exists('systemControls', $slots)) {
            return ['search' => true, 'account' => true, 'cart' => true, 'notifications' => true, 'theme' => true, 'locale' => true, 'currency' => true];
        }
        $controls = $slots['systemControls'];
        if (! is_array($controls) || count($controls) > 1) {
            throw new DocumentCompileException('Header system controls slot is invalid.');
        }
        if ($controls === []) {
            return null;
        }
        $block = $controls[0] ?? null;
        if (! is_array($block) || ($block['type'] ?? null) !== 'site.header.system-controls-01'
            || ! is_array($block['props'] ?? null) || ! is_array($block['slots'] ?? null) || $block['slots'] !== []) {
            throw new DocumentCompileException('Header system controls block is invalid.');
        }
        $props = $block['props'];
        $keys = ['search', 'account', 'cart', 'notifications', 'theme', 'locale', 'currency'];
        $this->assertOnlyKeys($props, $keys, 'Header system controls');
        $options = [];
        foreach ($keys as $key) {
            if (array_key_exists($key, $props) && ! is_bool($props[$key])) {
                throw new DocumentCompileException("Header system controls {$key} must be boolean.");
            }
            $options[$key] = $props[$key] ?? true;
        }

        /** @var array{search: bool, account: bool, cart: bool, notifications: bool, theme: bool, locale: bool, currency: bool} $options */
        return $options;
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

        $responsiveAttributes = $this->footerResponsiveAttributes($this->footerResponsivePresentation($props, 2));

        $inherit = $this->siteInfoAttribute($props);

        return '<footer class="g7pb-site-footer" '.$inherit.' data-testid="page-builder-site-footer" '.$responsiveAttributes.'><div class="g7pb-site-footer__top">'
            .'<div><a class="g7pb-site-brand" href="'.$this->attribute($home).'">'.$this->escape($brand).'</a>'.$this->siteInfoDetails($inherit).'</div>'
            .$this->navigation($navigation, '하단 메뉴', '').'</div>'
            .($legal === '' || ($inherit !== '' && $legal === '사이트 정보를 입력해 주세요.') ? '' : '<p class="g7pb-site-footer__legal">'.$this->escape($legal).'</p>').'</footer>';
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

        $responsiveAttributes = $this->footerResponsiveAttributes($this->footerResponsivePresentation($props, 4));

        $inherit = $this->siteInfoAttribute($props);

        return '<footer class="g7pb-site-footer g7pb-site-footer--columns" '.$inherit.' data-testid="page-builder-site-footer" '.$responsiveAttributes.'><div class="g7pb-site-footer__columns">'
            .'<div><a class="g7pb-site-brand" href="'.$this->attribute($home).'">'.$this->escape($brand).'</a>'.$this->siteInfoDetails($inherit).'</div>'
            .implode('', $compiledColumns).'</div>'
            .($legal === '' || ($inherit !== '' && $legal === '사이트 정보를 입력해 주세요.') ? '' : '<p class="g7pb-site-footer__legal">'.$this->escape($legal).'</p>').'</footer>';
    }

    /** @param array<string, mixed> $props */
    private function siteInfoAttribute(array $props): string
    {
        if (array_key_exists('use_site_settings', $props) && ! is_bool($props['use_site_settings'])) {
            throw new DocumentCompileException('Site settings inheritance must be boolean.');
        }
        // Only untouched factory branding inherits automatically. Custom content wins.
        $inherit = $props['use_site_settings'] ?? (($props['brand_name'] ?? '') === '사이트 이름' && ($props['logo_url'] ?? '') === '');

        return $inherit ? 'data-g7pb-site-info="inherit"' : '';
    }

    private function siteInfoDetails(string $inherit): string
    {
        return $inherit === '' ? '' : '<p class="g7pb-site-description" data-g7pb-site-description hidden></p><nav class="g7pb-site-socials" aria-label="소셜 채널" data-g7pb-site-socials hidden></nav>';
    }

    /**
     * @param  array<string, mixed>  $props
     * @return array{tablet: array{density: string, alignment: string, show_cta: bool, mobile_menu_style: string}, mobile: array{density: string, alignment: string, show_cta: bool, mobile_menu_style: string}}
     */
    private function headerResponsivePresentation(array $props, string $mobileMenuStyle): array
    {
        $base = ['density' => 'comfortable', 'alignment' => 'spread', 'show_cta' => true, 'mobile_menu_style' => $mobileMenuStyle];
        if (! array_key_exists('responsive', $props)) {
            return [
                'tablet' => [...$base, 'show_cta' => false],
                'mobile' => [...$base, 'density' => 'compact', 'show_cta' => false],
            ];
        }

        $responsive = $this->responsiveObject($props['responsive'], 'Header responsive');
        $tablet = array_replace($base, $this->headerResponsiveOverride($responsive['tablet'] ?? [], 'Header tablet'));
        $mobile = array_replace($tablet, $this->headerResponsiveOverride($responsive['mobile'] ?? [], 'Header mobile'));

        return ['tablet' => $tablet, 'mobile' => $mobile];
    }

    /**
     * @param  array<string, mixed>  $props
     * @return array{tablet: array{density: string, alignment: string, show_navigation: bool, columns: int}, mobile: array{density: string, alignment: string, show_navigation: bool, columns: int}}
     */
    private function footerResponsivePresentation(array $props, int $desktopColumns): array
    {
        $base = ['density' => 'comfortable', 'alignment' => 'start', 'show_navigation' => true, 'columns' => $desktopColumns];
        if (! array_key_exists('responsive', $props)) {
            return [
                'tablet' => [...$base, 'columns' => 2],
                'mobile' => [...$base, 'density' => 'compact', 'columns' => 1],
            ];
        }

        $responsive = $this->responsiveObject($props['responsive'], 'Footer responsive');
        $tablet = array_replace($base, $this->footerResponsiveOverride($responsive['tablet'] ?? [], 'Footer tablet'));
        $mobile = array_replace($tablet, $this->footerResponsiveOverride($responsive['mobile'] ?? [], 'Footer mobile'));

        return ['tablet' => $tablet, 'mobile' => $mobile];
    }

    /** @return array<string, mixed> */
    private function responsiveObject(mixed $value, string $context): array
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            throw new DocumentCompileException("{$context} must be an object.");
        }
        $this->assertOnlyKeys($value, ['tablet', 'mobile'], $context);

        return $value;
    }

    /** @return array<string, mixed> */
    private function headerResponsiveOverride(mixed $value, string $context): array
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            throw new DocumentCompileException("{$context} override must be an object.");
        }
        $this->assertOnlyKeys($value, ['density', 'alignment', 'show_cta', 'mobile_menu_style'], $context);
        $this->assertEnumWhenPresent($value, 'density', ['compact', 'comfortable', 'spacious'], $context);
        $this->assertEnumWhenPresent($value, 'alignment', ['start', 'center', 'spread'], $context);
        $this->assertEnumWhenPresent($value, 'mobile_menu_style', ['dropdown', 'drawer-left', 'drawer-right', 'sheet-bottom'], $context);
        if (array_key_exists('show_cta', $value) && ! is_bool($value['show_cta'])) {
            throw new DocumentCompileException("{$context} show_cta must be boolean.");
        }

        return $value;
    }

    /** @return array<string, mixed> */
    private function footerResponsiveOverride(mixed $value, string $context): array
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            throw new DocumentCompileException("{$context} override must be an object.");
        }
        $this->assertOnlyKeys($value, ['density', 'alignment', 'show_navigation', 'columns'], $context);
        $this->assertEnumWhenPresent($value, 'density', ['compact', 'comfortable', 'spacious'], $context);
        $this->assertEnumWhenPresent($value, 'alignment', ['start', 'center'], $context);
        if (array_key_exists('show_navigation', $value) && ! is_bool($value['show_navigation'])) {
            throw new DocumentCompileException("{$context} show_navigation must be boolean.");
        }
        if (array_key_exists('columns', $value) && (! is_int($value['columns']) || ! in_array($value['columns'], [1, 2, 4], true))) {
            throw new DocumentCompileException("{$context} columns is invalid.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $value
     * @param  list<string>  $allowed
     */
    private function assertOnlyKeys(array $value, array $allowed, string $context): void
    {
        $unknown = array_diff(array_keys($value), $allowed);
        if ($unknown !== []) {
            throw new DocumentCompileException("{$context} contains unsupported fields.");
        }
    }

    /**
     * @param  array<string, mixed>  $value
     * @param  list<string>  $allowed
     */
    private function assertEnumWhenPresent(array $value, string $key, array $allowed, string $context): void
    {
        if (array_key_exists($key, $value) && (! is_string($value[$key]) || ! in_array($value[$key], $allowed, true))) {
            throw new DocumentCompileException("{$context} {$key} is invalid.");
        }
    }

    /**
     * @param  array{tablet: array{density: string, alignment: string, show_cta: bool, mobile_menu_style: string}, mobile: array{density: string, alignment: string, show_cta: bool, mobile_menu_style: string}}  $responsive
     */
    private function headerResponsiveAttributes(array $responsive): string
    {
        return 'data-g7pb-tablet-density="'.$responsive['tablet']['density'].'" '
            .'data-g7pb-tablet-alignment="'.$responsive['tablet']['alignment'].'" '
            .'data-g7pb-tablet-cta="'.($responsive['tablet']['show_cta'] ? 'show' : 'hide').'" '
            .'data-g7pb-tablet-menu-style="'.$responsive['tablet']['mobile_menu_style'].'" '
            .'data-g7pb-mobile-density="'.$responsive['mobile']['density'].'" '
            .'data-g7pb-mobile-alignment="'.$responsive['mobile']['alignment'].'" '
            .'data-g7pb-mobile-cta="'.($responsive['mobile']['show_cta'] ? 'show' : 'hide').'" '
            .'data-g7pb-mobile-menu-style="'.$responsive['mobile']['mobile_menu_style'].'"';
    }

    /**
     * @param  array{tablet: array{density: string, alignment: string, show_navigation: bool, columns: int}, mobile: array{density: string, alignment: string, show_navigation: bool, columns: int}}  $responsive
     */
    private function footerResponsiveAttributes(array $responsive): string
    {
        return 'data-g7pb-tablet-density="'.$responsive['tablet']['density'].'" '
            .'data-g7pb-tablet-alignment="'.$responsive['tablet']['alignment'].'" '
            .'data-g7pb-tablet-navigation="'.($responsive['tablet']['show_navigation'] ? 'show' : 'hide').'" '
            .'data-g7pb-tablet-columns="'.$responsive['tablet']['columns'].'" '
            .'data-g7pb-mobile-density="'.$responsive['mobile']['density'].'" '
            .'data-g7pb-mobile-alignment="'.$responsive['mobile']['alignment'].'" '
            .'data-g7pb-mobile-navigation="'.($responsive['mobile']['show_navigation'] ? 'show' : 'hide').'" '
            .'data-g7pb-mobile-columns="'.$responsive['mobile']['columns'].'"';
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
                .'<span aria-expanded="false" aria-controls="'.$submenuId.'" aria-label="'.$this->attribute($link['label'].' 하위 메뉴 열기').'" data-g7pb-submenu-toggle><span aria-hidden="true">⌄</span></span></div>'
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
