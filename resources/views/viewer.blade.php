<!doctype html>
<html lang="{{ str_replace('_', '-', $page->locale) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @php
        $seoTitle = $page->seo?->title ?: $page->title;
        $seoDescription = $page->seo?->description ?: '';
        $seoImage = $page->seo?->ogImageUrl ?: '';
        $robots = $rootTestId === 'page-builder-preview-root' || $page->seo?->robots === 'noindex'
            ? 'noindex,nofollow'
            : 'index,follow';
    @endphp
    <meta name="robots" content="{{ $robots }}">
    <title>{{ $seoTitle }}</title>
    @if ($seoDescription !== '')
        <meta name="description" content="{{ $seoDescription }}">
    @endif
    @if (!empty($canonicalUrl))
        <link rel="canonical" href="{{ $canonicalUrl }}">
        <meta property="og:url" content="{{ $canonicalUrl }}">
        <meta property="og:title" content="{{ $seoTitle }}">
        <meta property="og:type" content="website">
        @if ($seoDescription !== '')
            <meta property="og:description" content="{{ $seoDescription }}">
        @endif
        @if ($seoImage !== '')
            <meta property="og:image" content="{{ str_starts_with($seoImage, '/') ? url($seoImage) : $seoImage }}">
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:image" content="{{ str_starts_with($seoImage, '/') ? url($seoImage) : $seoImage }}">
        @else
            <meta name="twitter:card" content="summary">
        @endif
        <meta name="twitter:title" content="{{ $seoTitle }}">
        @if ($seoDescription !== '')
            <meta name="twitter:description" content="{{ $seoDescription }}">
        @endif
    @endif
    <style>
        :root { color-scheme: light; font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #172033; background: #fff; }
        .g7pb-skip-link { position: fixed; z-index: 1000; top: .75rem; left: .75rem; padding: .75rem 1rem; color: #fff; background: #172033; transform: translateY(-180%); }
        .g7pb-skip-link:focus { transform: translateY(0); }
        .g7pb-site-header { position: relative; z-index: 50; width: 100%; border-bottom: 1px solid #e3e7ee; color: #172033; background: rgb(255 255 255 / 96%); backdrop-filter: blur(16px); }
        .g7pb-site-header.is-sticky { position: sticky; top: 0; }
        .g7pb-site-header.is-transparent { position: absolute; border-color: rgb(255 255 255 / 24%); color: #fff; background: linear-gradient(180deg, rgb(10 18 32 / 62%), transparent); backdrop-filter: none; }
        .g7pb-site-header.is-transparent.is-sticky { position: sticky; }
        .g7pb-site-announcement { position: relative; z-index: 55; padding: .65rem 1.25rem; text-align: center; }
        .g7pb-site-announcement p { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; justify-content: center; margin: 0; font-size: .82rem; font-weight: 700; }
        .g7pb-site-announcement a { color: inherit; font-weight: 850; text-underline-offset: .2rem; }
        .g7pb-site-announcement--brand { color: #fff; background: #2456df; }
        .g7pb-site-announcement--dark { color: #fff; background: #172033; }
        .g7pb-site-announcement--light { color: #172033; background: #eef1f6; }
        .g7pb-site-header__inner { display: grid; width: min(calc(100% - 2.5rem), 72rem); min-height: 4.75rem; grid-template-columns: auto 1fr auto; gap: 2rem; align-items: center; margin: 0 auto; }
        .g7pb-site-brand { display: inline-flex; min-width: 0; align-items: center; gap: .75rem; color: inherit; font-size: 1.05rem; font-weight: 850; letter-spacing: -.02em; text-decoration: none; }
        .g7pb-site-brand img { display: block; width: auto; max-width: 10rem; height: 2.25rem; object-fit: contain; }
        .g7pb-site-nav { justify-self: center; }
        .g7pb-site-nav > ul { display: flex; align-items: center; gap: clamp(1rem, 2.5vw, 2rem); margin: 0; padding: 0; list-style: none; }
        .g7pb-site-nav > ul > li { position: relative; }
        .g7pb-site-nav a { display: flex; gap: .35rem; align-items: center; color: inherit; font-size: .92rem; font-weight: 700; text-decoration: none; }
        .g7pb-site-nav a:hover, .g7pb-site-nav a:focus-visible { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: .35rem; }
        .g7pb-site-subnav { position: absolute; z-index: 70; top: calc(100% + 1rem); left: 50%; display: grid; min-width: 13rem; gap: .2rem; margin: 0; padding: .65rem; border: 1px solid #e1e5ec; border-radius: .85rem; color: #172033; background: #fff; box-shadow: 0 1.25rem 3rem rgb(15 23 42 / 16%); visibility: hidden; opacity: 0; transform: translate(-50%, -.35rem); transition: opacity 150ms ease, transform 150ms ease, visibility 150ms; list-style: none; }
        .g7pb-site-subnav::before { position: absolute; right: 0; bottom: 100%; left: 0; height: 1.1rem; content: ''; }
        .g7pb-site-subnav a { min-height: 2.65rem; padding: .55rem .7rem; border-radius: .55rem; white-space: nowrap; }
        .g7pb-site-subnav a:hover, .g7pb-site-subnav a:focus-visible { background: #f2f5fa; text-decoration: none; }
        .g7pb-site-nav li:hover > .g7pb-site-subnav, .g7pb-site-nav li:focus-within > .g7pb-site-subnav { visibility: visible; opacity: 1; transform: translate(-50%, 0); }
        .g7pb-site-header__cta { display: inline-flex; min-height: 2.75rem; align-items: center; padding: .6rem 1rem; border-radius: 999px; color: #fff; background: #2456df; font-size: .88rem; font-weight: 800; text-decoration: none; }
        .g7pb-site-header.is-transparent .g7pb-site-header__cta { color: #172033; background: #fff; }
        .g7pb-menu-toggle { display: none; width: 2.75rem; height: 2.75rem; padding: .65rem; border: 1px solid currentColor; border-radius: 999px; color: inherit; background: transparent; cursor: pointer; }
        .g7pb-menu-toggle span, .g7pb-menu-toggle::before, .g7pb-menu-toggle::after { display: block; width: 100%; height: 2px; border-radius: 2px; background: currentColor; content: ''; transition: transform 160ms ease, opacity 160ms ease; }
        .g7pb-menu-toggle span { margin: .3rem 0; }
        .g7pb-menu-toggle[aria-expanded='true'] span { opacity: 0; }
        .g7pb-menu-toggle[aria-expanded='true']::before { transform: translateY(.32rem) rotate(45deg); }
        .g7pb-menu-toggle[aria-expanded='true']::after { transform: translateY(-.32rem) rotate(-45deg); }
        .g7pb-mobile-menu { position: absolute; top: 100%; right: 0; left: 0; padding: 1rem 1.25rem 1.4rem; border-bottom: 1px solid #dfe4ec; color: #172033; background: #fff; box-shadow: 0 1.2rem 2.5rem rgb(15 23 42 / 14%); }
        .g7pb-mobile-menu[hidden] { display: none; }
        .g7pb-mobile-menu__backdrop { position: fixed; z-index: 49; inset: 0; border: 0; background: rgb(15 23 42 / 50%); backdrop-filter: blur(2px); }
        .g7pb-mobile-menu__backdrop[hidden] { display: none; }
        .g7pb-mobile-menu__close { display: none; width: 2.75rem; height: 2.75rem; margin: 0 0 1rem auto; border: 1px solid #d9dee8; border-radius: 999px; color: #172033; background: #fff; font-size: 1.5rem; cursor: pointer; }
        .g7pb-mobile-menu--drawer-left, .g7pb-mobile-menu--drawer-right { position: fixed; z-index: 60; top: 0; bottom: 0; left: auto; width: min(88vw, 24rem); overflow-y: auto; padding: 1.25rem 1.5rem 2rem; border: 0; }
        .g7pb-mobile-menu--drawer-left { right: auto; left: 0; }
        .g7pb-mobile-menu--drawer-right { right: 0; }
        .g7pb-mobile-menu--drawer-left:not([hidden]) { animation: g7pb-drawer-left-in 180ms ease-out both; }
        .g7pb-mobile-menu--drawer-right:not([hidden]) { animation: g7pb-drawer-right-in 180ms ease-out both; }
        .g7pb-mobile-menu--drawer-left .g7pb-mobile-menu__close, .g7pb-mobile-menu--drawer-right .g7pb-mobile-menu__close { display: grid; place-items: center; }
        .g7pb-mobile-menu ul { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
        .g7pb-mobile-menu li + li { border-top: 1px solid #edf0f4; }
        .g7pb-mobile-menu a { display: flex; min-height: 3.25rem; align-items: center; justify-content: space-between; color: inherit; font-weight: 750; text-decoration: none; }
        .g7pb-mobile-menu a::after { content: '→'; color: #7c879a; }
        .g7pb-mobile-menu__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
        .g7pb-mobile-menu__row > a::after { content: none; }
        .g7pb-mobile-menu__row button { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border: 0; border-radius: 999px; color: #344054; background: #f2f4f7; cursor: pointer; }
        .g7pb-mobile-menu__row button span { transition: transform 150ms ease; }
        .g7pb-mobile-menu__row button[aria-expanded='true'] span { transform: rotate(180deg); }
        .g7pb-mobile-subnav { margin: 0 0 .5rem .8rem !important; padding-left: .9rem !important; border-left: 2px solid #dce4f2; }
        .g7pb-mobile-subnav[hidden] { display: none; }
        .g7pb-mobile-subnav a { min-height: 2.8rem; color: #526071; font-size: .9rem; }
        .g7pb-mobile-menu .g7pb-mobile-menu__cta { justify-content: center; margin-top: .75rem; border-radius: .7rem; color: #fff; background: #2456df; }
        .g7pb-mobile-menu .g7pb-mobile-menu__cta::after { content: none; }
        @keyframes g7pb-drawer-left-in { from { opacity: 0; transform: translateX(-2rem); } to { opacity: 1; transform: translateX(0); } }
        @keyframes g7pb-drawer-right-in { from { opacity: 0; transform: translateX(2rem); } to { opacity: 1; transform: translateX(0); } }
        .g7pb-site-footer { padding: clamp(3rem, 7vw, 5.5rem) max(1.25rem, calc((100vw - 72rem) / 2)); color: #d6dce6; background: #111827; }
        .g7pb-site-footer__top { display: flex; gap: 2rem; align-items: start; justify-content: space-between; }
        .g7pb-site-footer .g7pb-site-brand { color: #fff; }
        .g7pb-site-footer nav ul { display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; margin: 0; padding: 0; list-style: none; }
        .g7pb-site-footer nav a { color: inherit; text-decoration: none; }
        .g7pb-site-footer__legal { margin: 3rem 0 0; padding-top: 1.25rem; border-top: 1px solid #2d3748; color: #919bad; font-size: .82rem; }
        .g7pb-site-footer__columns { display: grid; grid-template-columns: minmax(12rem, 1.5fr) repeat(4, minmax(8rem, 1fr)); gap: clamp(1.5rem, 4vw, 4rem); }
        .g7pb-site-footer--columns h2 { margin: 0 0 1rem; color: #fff; font-size: .82rem; }
        .g7pb-site-footer--columns ul { display: grid; gap: .7rem; margin: 0; padding: 0; list-style: none; }
        .g7pb-site-footer--columns a { color: inherit; text-decoration: none; }
        .g7pb-page { min-height: 100vh; overflow: hidden; }
        .g7pb-document-theme { --g7pb-theme-accent: #4f46e5; --g7pb-theme-accent-soft: #eef2ff; --g7pb-theme-accent-strong: #312e81; --g7pb-theme-radius: 1rem; --g7pb-theme-content-width: 72rem; --g7pb-theme-body-size: 1rem; font-size: var(--g7pb-theme-body-size); }
        .g7pb-theme-palette-blue { --g7pb-theme-accent: #2563eb; --g7pb-theme-accent-soft: #eff6ff; --g7pb-theme-accent-strong: #1e40af; }
        .g7pb-theme-palette-emerald { --g7pb-theme-accent: #059669; --g7pb-theme-accent-soft: #ecfdf5; --g7pb-theme-accent-strong: #065f46; }
        .g7pb-theme-palette-amber { --g7pb-theme-accent: #d97706; --g7pb-theme-accent-soft: #fffbeb; --g7pb-theme-accent-strong: #92400e; }
        .g7pb-theme-palette-rose { --g7pb-theme-accent: #e11d48; --g7pb-theme-accent-soft: #fff1f2; --g7pb-theme-accent-strong: #9f1239; }
        .g7pb-theme-palette-slate { --g7pb-theme-accent: #475569; --g7pb-theme-accent-soft: #f1f5f9; --g7pb-theme-accent-strong: #1e293b; }
        .g7pb-theme-font-system { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .g7pb-theme-font-modern { font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .g7pb-theme-font-serif { font-family: Georgia, "Noto Serif KR", "Times New Roman", serif; }
        .g7pb-theme-radius-sharp { --g7pb-theme-radius: .125rem; }
        .g7pb-theme-radius-round { --g7pb-theme-radius: 1.75rem; }
        .g7pb-theme-width-narrow { --g7pb-theme-content-width: 56rem; }
        .g7pb-theme-width-wide { --g7pb-theme-content-width: 88rem; }
        .g7pb-theme-scale-compact { --g7pb-theme-body-size: .9375rem; }
        .g7pb-theme-scale-large { --g7pb-theme-body-size: 1.125rem; }
        .g7pb-theme-mode-light { color-scheme: light; --g7pb-page-bg: #fff; --g7pb-page-text: #172033; --g7pb-page-muted: #526071; --g7pb-page-panel: #f3f1ed; --g7pb-page-border: #dfe2e8; }
        .g7pb-theme-mode-dark { color-scheme: dark; --g7pb-page-bg: #101620; --g7pb-page-text: #f4f7fb; --g7pb-page-muted: #b8c1cf; --g7pb-page-panel: #192231; --g7pb-page-border: #344155; background: var(--g7pb-page-bg); color: var(--g7pb-page-text); }
        @media (prefers-color-scheme: dark) { .g7pb-theme-mode-system { color-scheme: dark; --g7pb-page-bg: #101620; --g7pb-page-text: #f4f7fb; --g7pb-page-muted: #b8c1cf; --g7pb-page-panel: #192231; --g7pb-page-border: #344155; background: var(--g7pb-page-bg); color: var(--g7pb-page-text); } }
        .g7pb-theme-mode-dark .g7pb-surface--default { background: var(--g7pb-page-bg); color: var(--g7pb-page-text); }
        .g7pb-theme-mode-dark .g7pb-surface--soft { background: var(--g7pb-page-panel); color: var(--g7pb-page-text); }
        .g7pb-text-scale--compact { font-size: .9375em; }
        .g7pb-text-scale--large { font-size: 1.125em; }
        .g7pb-text-align--center { text-align: center; }
        .g7pb-text-align--right { text-align: right; }
        .g7pb-element-font--system { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .g7pb-element-font--modern { font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .g7pb-element-font--serif { font-family: Georgia, "Noto Serif KR", "Times New Roman", serif; }
        .g7pb-element-font--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .g7pb-element-size--small { font-size: .875em; }
        .g7pb-element-size--large { font-size: 1.2em; }
        .g7pb-element-size--xlarge { font-size: 1.45em; }
        .g7pb-element-weight--medium { font-weight: 500; }
        .g7pb-element-weight--semibold { font-weight: 650; }
        .g7pb-element-weight--bold { font-weight: 800; }
        .g7pb-element-align--center { display: block; text-align: center; }
        .g7pb-element-align--right { display: block; text-align: right; }
        .g7pb-element-tone--muted { color: var(--g7pb-page-muted, #64748b); }
        .g7pb-element-tone--accent { color: var(--g7pb-theme-accent, #2456df); }
        .g7pb-element-tone--contrast { color: var(--g7pb-page-bg, #fff); }
        .g7pb-block { padding: clamp(3.5rem, 8vw, 8rem) max(1.25rem, calc((100vw - var(--g7pb-theme-content-width)) / 2)); }
        .g7pb-surface--default { background: #fff; color: #172033; }
        .g7pb-surface--soft { background: #f3f1ed; color: #172033; }
        .g7pb-surface--contrast { background: #172033; color: #fff; }
        .g7pb-spacing--compact { padding-block: clamp(2.5rem, 6vw, 4.25rem); }
        .g7pb-spacing--normal { padding-block: clamp(3.5rem, 8vw, 8rem); }
        .g7pb-spacing--spacious { padding-block: clamp(5rem, 11vw, 9.5rem); }
        .g7pb-surface--contrast p:not(.g7pb-hero__eyebrow):not(.g7pb-cta__eyebrow):not(.g7pb-contact__eyebrow) { color: #cbd3df; }
        .g7pb-surface--contrast .g7pb-button--secondary { color: #fff; border-color: #758096; }
        .g7pb-surface--contrast .g7pb-contact__details,
        .g7pb-surface--contrast .g7pb-contact__details a { color: #fff; }
        .g7pb-hero { display: grid; gap: 1.5rem; align-items: center; }
        .g7pb-hero--center { text-align: center; justify-items: center; }
        .g7pb-hero__eyebrow { margin: 0; color: var(--g7pb-theme-accent); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .g7pb-hero__title { max-width: 18ch; margin: 0; font-size: clamp(2.5rem, 7vw, 5.75rem); line-height: 1.02; letter-spacing: -.04em; }
        .g7pb-hero__body { max-width: 44rem; margin: 0; color: #526079; font-size: clamp(1rem, 2vw, 1.25rem); line-height: 1.75; }
        .g7pb-button { display: inline-flex; min-height: 3rem; align-items: center; justify-content: center; padding: .75rem 1.25rem; border-radius: var(--g7pb-theme-radius); font-weight: 700; text-decoration: none; }
        .g7pb-button--primary { color: #fff; background: var(--g7pb-theme-accent); }
        .g7pb-button--secondary { color: #172033; border: 1px solid #b9c0cd; background: transparent; }
        .g7pb-hero__image { width: min(100%, 64rem); height: auto; border-radius: var(--g7pb-theme-radius); }
        .g7pb-features { background: #f6f7fb; }
        .g7pb-features__title { margin: 0 0 2.5rem; font-size: clamp(2rem, 4vw, 3.5rem); letter-spacing: -.03em; }
        .g7pb-features__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }
        .g7pb-features__item { min-height: 100%; padding: 1.5rem; border: 1px solid #dde2ec; border-radius: var(--g7pb-theme-radius); background: #fff; }
        .g7pb-features__item h3 { margin: 1rem 0 .5rem; }
        .g7pb-features__item p { margin: 0; color: #526079; line-height: 1.65; }
        .g7pb-features__icon { display: inline-block; width: 2rem; height: 2rem; border-radius: calc(var(--g7pb-theme-radius) * .6); background: var(--g7pb-theme-accent-soft); }
        .g7pb-cta { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(16rem, .65fr); gap: clamp(2rem, 7vw, 7rem); align-items: end; }
        .g7pb-cta--light { background: #f3f1ed; }
        .g7pb-cta--dark { color: #fff; background: #172033; }
        .g7pb-cta__eyebrow, .g7pb-contact__eyebrow { margin: 0 0 .75rem; color: var(--g7pb-theme-accent); font-size: .75rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .g7pb-cta--dark .g7pb-cta__eyebrow { color: #9ab2ff; }
        .g7pb-cta__heading, .g7pb-contact__heading h2 { max-width: 18ch; margin: 0; font-size: clamp(2.2rem, 5vw, 4.75rem); line-height: 1.04; letter-spacing: -.045em; }
        .g7pb-cta__body { max-width: 42rem; margin: 1.25rem 0 0; color: #5f6b7d; font-size: clamp(1rem, 2vw, 1.2rem); line-height: 1.7; }
        .g7pb-cta--dark .g7pb-cta__body { color: #cbd3df; }
        .g7pb-cta__actions, .g7pb-contact__actions { display: flex; flex-wrap: wrap; gap: .75rem; }
        .g7pb-cta--dark .g7pb-button--secondary { color: #fff; border-color: #758096; }
        .g7pb-contact { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, .7fr); gap: clamp(2rem, 7vw, 7rem); background: #fff; }
        .g7pb-contact__heading { align-self: start; }
        .g7pb-contact__details { display: grid; align-content: start; gap: .7rem; color: #344054; font-style: normal; }
        .g7pb-contact__details p { margin: 0 0 .8rem; white-space: normal; line-height: 1.75; }
        .g7pb-contact__details a { width: fit-content; color: #172033; font-size: 1.05rem; font-weight: 700; text-decoration-color: #a7b0bf; text-underline-offset: .25rem; }
        .g7pb-contact__actions { grid-column: 2; }
        .g7pb-inquiry, .g7pb-map { display: grid; grid-template-columns: minmax(0, .8fr) minmax(20rem, 1.2fr); gap: clamp(2rem, 6vw, 6rem); }
        .g7pb-inquiry__intro > p, .g7pb-map__intro > p { color: #5f6b7d; line-height: 1.7; }
        .g7pb-inquiry-form { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: clamp(1.25rem, 3vw, 2.25rem); border: 1px solid #dce2ec; border-radius: var(--g7pb-theme-radius); color: #172033; background: #fff; box-shadow: 0 1.5rem 4rem rgb(15 23 42 / 8%); }
        .g7pb-inquiry-form label { display: grid; gap: .4rem; color: #4b5565; font-size: .75rem; font-weight: 800; }
        .g7pb-inquiry-form input, .g7pb-inquiry-form textarea { width: 100%; min-height: 2.8rem; padding: .7rem .8rem; border: 1px solid #cbd4e1; border-radius: .55rem; font: inherit; background: #fff; }
        .g7pb-inquiry-form__wide, .g7pb-inquiry-form__consent, .g7pb-inquiry-form__footer { grid-column: 1 / -1; }
        .g7pb-inquiry-form__honeypot { position: absolute; left: -10000px; }
        .g7pb-inquiry-form__consent { display: flex !important; flex-direction: row; align-items: center; }
        .g7pb-inquiry-form__consent input { width: 1rem; min-height: 1rem; }
        .g7pb-inquiry-form__footer { display: flex; flex-wrap: wrap; gap: .75rem 1rem; align-items: center; }
        .g7pb-inquiry-form__footer button { min-height: 3rem; padding: .75rem 1.25rem; border: 0; border-radius: var(--g7pb-theme-radius); color: #fff; background: var(--g7pb-theme-accent); font-weight: 850; cursor: pointer; }
        .g7pb-inquiry-form__footer button:disabled { opacity: .55; cursor: wait; }
        .g7pb-inquiry-form__footer p { margin: 0; color: #465166; font-size: .85rem; }
        .g7pb-map address { display: grid; gap: .6rem; margin-top: 2rem; font-style: normal; }
        .g7pb-map__frame { min-height: 28rem; overflow: hidden; border: 1px solid #cad4e1; border-radius: var(--g7pb-theme-radius); background: #e9eef2; }
        .g7pb-map__frame iframe { display: block; width: 100%; height: 100%; min-height: 28rem; border: 0; }
        .g7pb-map__placeholder { display: grid; min-height: 28rem; place-items: center; color: #667085; background: repeating-linear-gradient(45deg, #edf1f4 0 20px, #e4e9ed 20px 40px); }
        .g7pb-section-heading { max-width: 48rem; margin-bottom: clamp(2rem, 5vw, 4rem); }
        .g7pb-section-heading h2 { margin: .65rem 0 0; font-size: clamp(2.1rem, 5vw, 4.25rem); line-height: 1.06; letter-spacing: -.045em; }
        .g7pb-section-eyebrow { margin: 0; color: var(--g7pb-theme-accent); font-size: .75rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .g7pb-dynamic__status { min-height: 1.5rem; margin: -2rem 0 2rem; color: #667085; }
        .g7pb-dynamic-posts { display: grid; border-top: 1px solid #d9dee8; }
        .g7pb-dynamic-posts article { border-bottom: 1px solid #d9dee8; }
        .g7pb-dynamic-posts a { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .5rem 1.5rem; padding: 1.25rem 0; color: inherit; text-decoration: none; }
        .g7pb-dynamic-posts a::after { grid-row: 1 / span 2; grid-column: 2; align-self: center; color: var(--g7pb-theme-accent); content: '→'; }
        .g7pb-dynamic-posts strong, .g7pb-dynamic-posts span { min-width: 0; }
        .g7pb-dynamic-posts span { color: #667085; font-size: .82rem; }
        .g7pb-dynamic-products { display: grid; gap: 1.25rem; }
        .g7pb-dynamic-products--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .g7pb-dynamic-products--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .g7pb-dynamic-products--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .g7pb-dynamic-products article { min-width: 0; }
        .g7pb-dynamic-products a { display: grid; gap: .7rem; color: inherit; text-decoration: none; }
        .g7pb-dynamic-products img, .g7pb-dynamic-products__placeholder { display: grid; width: 100%; aspect-ratio: 1 / 1; place-items: center; overflow: hidden; border-radius: var(--g7pb-theme-radius); background: #e5e9f0; object-fit: cover; }
        .g7pb-dynamic-products a > span:last-child { color: var(--g7pb-theme-accent-strong); font-weight: 800; }
        .g7pb-dynamic-pagination { display: flex; align-items: center; justify-content: center; gap: .75rem; margin-top: 2rem; }
        .g7pb-dynamic-pagination[hidden] { display: none; }
        .g7pb-dynamic-pagination button { min-height: 2.5rem; padding: .5rem .9rem; border: 1px solid var(--g7pb-page-border, #dfe2e8); border-radius: var(--g7pb-theme-radius); color: inherit; background: transparent; font: inherit; font-weight: 750; cursor: pointer; }
        .g7pb-dynamic-pagination button:disabled { opacity: .4; cursor: not-allowed; }
        .g7pb-dynamic-pagination span { min-width: 4rem; color: var(--g7pb-page-muted, #526071); text-align: center; }
        .g7pb-data-detail__content[aria-busy='true'] { min-height: 12rem; }
        .g7pb-data-detail__content article { display: grid; gap: 1rem; }
        .g7pb-data-detail__content h3 { margin: 0; font-size: clamp(1.8rem, 4vw, 3.4rem); line-height: 1.08; }
        .g7pb-data-detail__content p { max-width: 70ch; margin: 0; color: var(--g7pb-page-muted, #526071); line-height: 1.75; }
        .g7pb-data-detail__content a { justify-self: start; padding: .75rem 1rem; border-radius: var(--g7pb-theme-radius); color: #fff; background: var(--g7pb-theme-accent); font-weight: 800; text-decoration: none; }
        .g7pb-data-detail__meta { color: var(--g7pb-theme-accent) !important; font-size: .78rem; font-weight: 750; }
        .g7pb-post-detail .g7pb-data-detail__content img { width: 100%; max-height: 30rem; border-radius: var(--g7pb-theme-radius); object-fit: cover; }
        .g7pb-product-detail .g7pb-data-detail__content article { grid-template-columns: minmax(14rem, .8fr) minmax(0, 1fr); align-items: center; gap: clamp(1.5rem, 5vw, 4rem); }
        .g7pb-product-detail .g7pb-data-detail__content article > img, .g7pb-data-detail__placeholder { display: grid; width: 100%; aspect-ratio: 1 / 1; place-items: center; border-radius: var(--g7pb-theme-radius); background: #e5e9f0; object-fit: cover; }
        .g7pb-product-detail .g7pb-data-detail__content article > div { display: grid; gap: 1rem; }
        .g7pb-product-detail .g7pb-data-detail__content strong { font-size: 1.35rem; }
        .g7pb-media-placeholder { display: grid; width: 100%; height: 100%; min-height: 12rem; place-items: center; background: linear-gradient(145deg, #e9edf4, #dce3ee); color: #657187; font-size: .8rem; font-weight: 750; }
        .g7pb-surface--contrast .g7pb-media-placeholder { background: linear-gradient(145deg, #2b3950, #40516c); color: #dbe5f3; }
        .g7pb-hero-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, .9fr); align-items: center; gap: clamp(2rem, 7vw, 7rem); }
        .g7pb-hero-split--left .g7pb-hero-split__copy { order: 2; }
        .g7pb-hero-split__copy h1 { max-width: 13ch; margin: .8rem 0 1.25rem; font-size: clamp(2.6rem, 6vw, 5.25rem); line-height: 1.02; letter-spacing: -.055em; }
        .g7pb-hero-split__body { max-width: 38rem; color: #667085; font-size: 1.1rem; line-height: 1.75; }
        .g7pb-hero-split__media { aspect-ratio: 4 / 5; overflow: hidden; margin: 0; border-radius: var(--g7pb-theme-radius); background: #e7ebf2; }
        .g7pb-hero-split__media img { width: 100%; height: 100%; object-fit: cover; }
        .g7pb-hero-slider { overflow: hidden; }
        .g7pb-hero-slider__viewport { overflow: hidden; }
        .g7pb-hero-slider__track { display: flex; margin-left: -1.1rem; touch-action: pan-y pinch-zoom; }
        .g7pb-hero-slider__slide { display: grid; flex: 0 0 100%; min-width: 0; grid-template-columns: 1.1fr .9fr; min-height: 30rem; overflow: hidden; padding-left: 1.1rem; border: 1px solid rgb(255 255 255 / 16%); border-radius: 1rem; background: rgb(255 255 255 / 7%); }
        .g7pb-hero-slider__copy { align-self: center; padding: clamp(2rem, 6vw, 5rem); }
        .g7pb-hero-slider__copy h2 { margin: .8rem 0 1.1rem; font-size: clamp(2.5rem, 6vw, 5rem); line-height: 1.02; letter-spacing: -.055em; }
        .g7pb-hero-slider__copy p { max-width: 38rem; line-height: 1.7; }
        .g7pb-hero-slider__slide figure { min-height: 100%; margin: 0; }
        .g7pb-hero-slider__slide figure img { width: 100%; height: 100%; object-fit: cover; }
        .g7pb-hero-slider__controls { display: flex; align-items: center; justify-content: center; gap: .55rem; padding-top: 1rem; }
        .g7pb-hero-slider__controls button { min-width: 2.5rem; min-height: 2.5rem; border: 1px solid rgb(255 255 255 / 28%); border-radius: 999px; color: inherit; background: rgb(255 255 255 / 8%); cursor: pointer; }
        .g7pb-hero-slider__controls button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
        .g7pb-hero-slider__controls button:disabled { opacity: .35; cursor: default; }
        .g7pb-hero-slider__dots { display: flex; gap: .4rem; }
        .g7pb-hero-slider__dots button { min-width: .6rem; min-height: .6rem; padding: 0; border: 0; background: currentColor; opacity: .35; }
        .g7pb-hero-slider__dots button.is-active { width: 1.8rem; opacity: 1; }
        .g7pb-hero-slider__status { margin: .5rem 0 0; font-size: .75rem; text-align: center; opacity: .72; }
        .g7pb-logo-cloud { text-align: center; }
        .g7pb-logo-cloud h2 { margin: 0 0 2rem; color: #667085; font-size: 1rem; }
        .g7pb-logo-cloud ul { display: flex; flex-wrap: wrap; gap: 1rem 3rem; justify-content: center; margin: 0; padding: 0; list-style: none; }
        .g7pb-logo-cloud li { display: grid; min-width: 8rem; min-height: 3rem; place-items: center; color: #465166; font-size: 1.15rem; font-weight: 850; }
        .g7pb-logo-cloud__image { max-width: 7.5rem; max-height: 2.7rem; object-fit: contain; filter: grayscale(1); }
        .g7pb-stats__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); border-top: 1px solid #d9dee8; }
        .g7pb-stats__grid article { padding: 2rem 1.25rem; border-bottom: 1px solid #d9dee8; }
        .g7pb-stats__icon { display: block; width: 1.7rem; height: 1.7rem; color: var(--g7pb-theme-accent); }
        .g7pb-stats__icon::before { font-size: 1.5rem; }
        .g7pb-stats__icon--trend::before { content: '↗'; }
        .g7pb-stats__icon--users::before { content: '●●'; font-size: .85rem; letter-spacing: -.2rem; }
        .g7pb-stats__icon--target::before { content: '◎'; }
        .g7pb-stats__icon--chart::before { content: '▥'; }
        .g7pb-stats article > strong { display: block; margin-top: 1.7rem; font-size: clamp(2.2rem, 5vw, 4rem); letter-spacing: -.05em; }
        .g7pb-stats article h3 { margin: .4rem 0; font-size: 1rem; }
        .g7pb-stats article p { margin: 0; color: #667085; font-size: .85rem; line-height: 1.6; }
        .g7pb-pricing__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; align-items: stretch; }
        .g7pb-pricing__plan { position: relative; padding: 2rem; border: 1px solid #d8dee9; border-radius: var(--g7pb-theme-radius); background: rgb(255 255 255 / 72%); }
        .g7pb-pricing__plan--featured { border-color: var(--g7pb-theme-accent); box-shadow: inset 0 .3rem var(--g7pb-theme-accent); transform: translateY(-.5rem); }
        .g7pb-pricing__badge { position: absolute; top: 1rem; right: 1rem; padding: .3rem .6rem; border-radius: 99px; background: var(--g7pb-theme-accent-soft); color: var(--g7pb-theme-accent-strong); font-size: .7rem; font-weight: 800; }
        .g7pb-pricing__plan h3 { margin: 0; }
        .g7pb-pricing__price strong { font-size: 2.3rem; letter-spacing: -.045em; }
        .g7pb-pricing__plan ul { min-height: 9rem; padding: 1rem 0; list-style: none; }
        .g7pb-pricing__plan li { padding: .35rem 0; }
        .g7pb-pricing__plan li::before { content: '✓'; margin-right: .55rem; color: var(--g7pb-theme-accent); }
        .g7pb-team__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 1.5rem; }
        .g7pb-team article figure { aspect-ratio: 4 / 5; overflow: hidden; margin: 0 0 1rem; border-radius: .8rem; }
        .g7pb-team__image { width: 100%; height: 100%; object-fit: cover; font-size: 3rem; }
        .g7pb-team article h3 { margin: 0 0 .25rem; font-size: 1.25rem; }
        .g7pb-team article h3 a { color: inherit; }
        .g7pb-team article > strong { color: var(--g7pb-theme-accent); font-size: .85rem; }
        .g7pb-team article p { color: #667085; line-height: 1.65; }
        .g7pb-gallery__grid { display: grid; gap: .8rem; }
        .g7pb-gallery__grid--2 { grid-template-columns: repeat(2, 1fr); }
        .g7pb-gallery__grid--3 { grid-template-columns: repeat(3, 1fr); }
        .g7pb-gallery__grid--4 { grid-template-columns: repeat(4, 1fr); }
        .g7pb-gallery figure { margin: 0; }
        .g7pb-gallery__image { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: .7rem; }
        .g7pb-gallery figcaption { padding: .65rem .15rem; color: #667085; font-size: .85rem; }
        .g7pb-bar-chart figure { margin: 0; }
        .g7pb-bar-chart figcaption > p:last-child { color: #667085; line-height: 1.7; }
        .g7pb-bar-chart__plot { display: grid; gap: 1.2rem; }
        .g7pb-bar-chart label > span { display: flex; justify-content: space-between; margin-bottom: .45rem; font-size: .9rem; }
        .g7pb-bar-chart progress { width: 100%; height: 1.15rem; overflow: hidden; border: 0; border-radius: 99px; background: #dfe4ed; accent-color: #2563eb; }
        .g7pb-bar-chart progress[data-tone='indigo'] { accent-color: #4f46e5; }
        .g7pb-bar-chart progress[data-tone='emerald'] { accent-color: #059669; }
        .g7pb-bar-chart progress[data-tone='amber'] { accent-color: #d97706; }
        .g7pb-hero.g7pb-surface--default, .g7pb-features.g7pb-surface--default, .g7pb-cta.g7pb-surface--default, .g7pb-contact.g7pb-surface--default { background: #fff; color: #172033; }
        .g7pb-hero.g7pb-surface--soft, .g7pb-features.g7pb-surface--soft, .g7pb-cta.g7pb-surface--soft, .g7pb-contact.g7pb-surface--soft { background: #f3f1ed; color: #172033; }
        .g7pb-hero.g7pb-surface--contrast, .g7pb-features.g7pb-surface--contrast, .g7pb-cta.g7pb-surface--contrast, .g7pb-contact.g7pb-surface--contrast { background: #172033; color: #fff; }
        .g7pb-cta.g7pb-cta--dark { background: #172033; color: #fff; }
        .g7pb-theme-mode-dark .g7pb-block.g7pb-surface--default { background: var(--g7pb-page-bg); color: var(--g7pb-page-text); }
        .g7pb-theme-mode-dark .g7pb-block.g7pb-surface--soft { background: var(--g7pb-page-panel); color: var(--g7pb-page-text); }
        @media (prefers-color-scheme: dark) {
            .g7pb-theme-mode-system .g7pb-block.g7pb-surface--default { background: var(--g7pb-page-bg); color: var(--g7pb-page-text); }
            .g7pb-theme-mode-system .g7pb-block.g7pb-surface--soft { background: var(--g7pb-page-panel); color: var(--g7pb-page-text); }
        }
        .g7pb-testimonials__items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-block: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-testimonials blockquote { margin: 0; padding: 2rem; border-inline-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-testimonials blockquote:last-child { border-inline-end: 0; }
        .g7pb-testimonials__rating { color: #f59e0b !important; letter-spacing: .08em; }
        .g7pb-testimonials__quote { min-height: 5rem; font-size: 1.08rem; line-height: 1.72; }
        .g7pb-testimonials footer { display: flex; gap: .8rem; align-items: center; }
        .g7pb-testimonials footer figure { width: 2.9rem; height: 2.9rem; flex: 0 0 auto; overflow: hidden; margin: 0; border-radius: 50%; }
        .g7pb-testimonials__avatar { width: 100%; height: 100%; min-height: 0; object-fit: cover; }
        .g7pb-testimonials cite { display: grid; font-style: normal; }
        .g7pb-testimonials cite span { color: var(--g7pb-page-muted, #526071); font-size: .82rem; }
        .g7pb-testimonials--spotlight .g7pb-testimonials__items { grid-template-columns: 1fr; }
        .g7pb-testimonials--spotlight blockquote { border-inline-end: 0; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-faq { display: grid; grid-template-columns: minmax(14rem, .65fr) minmax(0, 1.35fr); gap: clamp(2rem, 6vw, 6rem); }
        .g7pb-faq .g7pb-section-heading { margin-bottom: 0; }
        .g7pb-faq details { border-block-start: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-faq details:last-child { border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-faq summary { display: flex; min-height: 4.6rem; align-items: center; justify-content: space-between; gap: 1rem; cursor: pointer; font-size: 1.05rem; font-weight: 780; list-style: none; }
        .g7pb-faq summary::-webkit-details-marker { display: none; }
        .g7pb-faq summary i { color: var(--g7pb-theme-accent); font-size: 1.5rem; font-style: normal; transition: transform 160ms ease; }
        .g7pb-faq details[open] summary i { transform: rotate(45deg); }
        .g7pb-faq details > div { padding: 0 2rem 1.5rem 0; color: var(--g7pb-page-muted, #526071); line-height: 1.75; }
        .g7pb-process ol { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); margin: 0; padding: 0; border-block-start: 1px solid var(--g7pb-page-border, #dfe2e8); list-style: none; }
        .g7pb-process li { position: relative; min-height: 15rem; padding: 1.5rem 1.5rem 2rem 0; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-process li::before { position: absolute; top: -4px; left: 0; width: .5rem; height: .5rem; border-radius: 50%; background: var(--g7pb-theme-accent); content: ''; }
        .g7pb-process__number { color: var(--g7pb-theme-accent); font-family: ui-monospace, monospace; }
        .g7pb-process h3 { margin: 2rem 0 .75rem; font-size: 1.25rem; }
        .g7pb-process li p { color: var(--g7pb-page-muted, #526071); line-height: 1.65; }
        .g7pb-process li a { color: var(--g7pb-theme-accent); font-weight: 800; text-decoration: none; }
        .g7pb-process--vertical ol { grid-template-columns: 1fr; }
        .g7pb-process--vertical li { min-height: auto; padding-left: 4rem; }
        .g7pb-tabs__list { display: flex; gap: 1rem; overflow-x: auto; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-tabs__list button { padding: .9rem .25rem; border: 0; border-block-end: 3px solid transparent; color: var(--g7pb-page-muted, #526071); background: none; font: inherit; font-weight: 800; white-space: nowrap; cursor: pointer; }
        .g7pb-tabs__list button[aria-selected='true'] { border-color: var(--g7pb-theme-accent); color: inherit; }
        .g7pb-tabs--pills .g7pb-tabs__list { gap: .5rem; border: 0; }
        .g7pb-tabs--pills .g7pb-tabs__list button { padding: .7rem 1rem; border: 0; border-radius: 999px; }
        .g7pb-tabs--pills .g7pb-tabs__list button[aria-selected='true'] { color: #fff; background: var(--g7pb-theme-accent); }
        .g7pb-tabs [role='tabpanel'] { min-height: 12rem; padding: 2.5rem 0; }
        .g7pb-tabs [role='tabpanel'] h3 { margin: 0 0 1rem; font-size: 1.75rem; }
        .g7pb-tabs [role='tabpanel'] p { max-width: 65ch; color: var(--g7pb-page-muted, #526071); line-height: 1.75; }
        .g7pb-comparison__scroll { overflow-x: auto; }
        .g7pb-comparison table { width: 100%; min-width: 44rem; border-collapse: collapse; text-align: left; }
        .g7pb-comparison th, .g7pb-comparison td { padding: 1rem; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-comparison thead th { border-block-start: 1px solid var(--g7pb-page-border, #dfe2e8); vertical-align: top; }
        .g7pb-comparison thead strong, .g7pb-comparison thead span { display: block; }
        .g7pb-comparison thead span { margin-top: .35rem; color: var(--g7pb-page-muted, #526071); font-size: .78rem; font-weight: 500; }
        .g7pb-comparison .is-highlighted { background: color-mix(in srgb, var(--g7pb-theme-accent) 9%, transparent); }
        .g7pb-visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; white-space: nowrap !important; }
        .g7pb-articles__items { border-block-start: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-articles article { display: grid; grid-template-columns: 10rem minmax(0, 1fr); gap: 1.5rem; padding: 1.5rem 0; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-articles article figure { aspect-ratio: 4 / 3; overflow: hidden; margin: 0; border-radius: var(--g7pb-theme-radius); }
        .g7pb-articles__image { width: 100%; height: 100%; min-height: 0; object-fit: cover; }
        .g7pb-articles__meta { display: flex; gap: .45rem; margin: 0; color: var(--g7pb-page-muted, #526071); font-size: .78rem; }
        .g7pb-articles h3 { margin: .55rem 0; font-size: 1.35rem; }
        .g7pb-articles h3 a { color: inherit; text-decoration: none; }
        .g7pb-articles article > div > p:not(.g7pb-articles__meta) { margin: 0 0 .7rem; color: var(--g7pb-page-muted, #526071); line-height: 1.65; }
        .g7pb-articles__link { color: var(--g7pb-theme-accent); font-weight: 800; text-decoration: none; }
        .g7pb-articles--grid .g7pb-articles__items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; border: 0; }
        .g7pb-articles--grid article { display: block; padding: 0 0 1.5rem; }
        .g7pb-articles--grid article figure { margin-bottom: 1rem; }
        .g7pb-video figure { margin: 0; }
        .g7pb-video__frame { overflow: hidden; border-radius: var(--g7pb-theme-radius); background: #080c14; }
        .g7pb-video__frame[data-ratio='16:9'] { aspect-ratio: 16 / 9; }
        .g7pb-video__frame[data-ratio='4:3'] { aspect-ratio: 4 / 3; }
        .g7pb-video__frame[data-ratio='1:1'] { aspect-ratio: 1; }
        .g7pb-video iframe { display: block; width: 100%; height: 100%; border: 0; }
        .g7pb-video figcaption { padding-top: 1rem; color: var(--g7pb-page-muted, #526071); line-height: 1.65; }
        .g7pb-logo-carousel .g7pb-section-heading, .g7pb-testimonial-slider .g7pb-section-heading { margin-bottom: 1.5rem; }
        .g7pb-logo-carousel .g7pb-hero-slider__slide { min-width: 22%; min-height: 8rem; flex: 0 0 22%; place-content: center; padding: 1.5rem; border-inline-end: 1px solid var(--g7pb-page-border, #dfe2e8); text-align: center; }
        .g7pb-logo-carousel .g7pb-hero-slider__controls button, .g7pb-testimonial-slider .g7pb-hero-slider__controls button { border-color: var(--g7pb-page-border, #dfe2e8); background: transparent; }
        .g7pb-logo-carousel__slide a { display: grid; place-items: center; color: inherit; text-decoration: none; }
        .g7pb-logo-carousel__image { width: min(9rem, 100%); height: 3.5rem; min-height: 0; object-fit: contain; filter: grayscale(1); opacity: .8; }
        .g7pb-testimonial-slider .g7pb-hero-slider__slide { min-width: 100%; min-height: 22rem; margin: 0; place-content: center; padding: clamp(2rem, 6vw, 5rem); border-block: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-testimonial-slider__rating { color: #f59e0b !important; letter-spacing: .1em; }
        .g7pb-testimonial-slider__quote { max-width: 26ch; margin: 1rem 0 2rem; font-size: clamp(1.6rem, 4vw, 3.2rem); line-height: 1.25; letter-spacing: -.035em; }
        .g7pb-testimonial-slider footer { display: flex; gap: .85rem; align-items: center; }
        .g7pb-testimonial-slider footer figure { width: 3rem; height: 3rem; overflow: hidden; margin: 0; border-radius: 50%; }
        .g7pb-testimonial-slider__avatar { width: 100%; height: 100%; min-height: 0; object-fit: cover; }
        .g7pb-testimonial-slider cite { display: grid; font-style: normal; }
        .g7pb-testimonial-slider cite span { color: var(--g7pb-page-muted, #526071); font-size: .82rem; }
        .g7pb-events ol, .g7pb-downloads ul { margin: 0; padding: 0; border-block-start: 1px solid var(--g7pb-page-border, #dfe2e8); list-style: none; }
        .g7pb-events li { display: grid; grid-template-columns: minmax(8rem, .35fr) minmax(0, 1fr); gap: 2rem; padding: 1.6rem 0; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-events time { display: grid; align-content: start; color: var(--g7pb-theme-accent); }
        .g7pb-events time strong { font-size: 1.1rem; }
        .g7pb-events article h3 { margin: .3rem 0 .7rem; font-size: 1.4rem; }
        .g7pb-events article > p:not(.g7pb-events__location) { color: var(--g7pb-page-muted, #526071); line-height: 1.7; }
        .g7pb-events__location { margin: 0; color: var(--g7pb-theme-accent); font-size: .75rem; font-weight: 800; text-transform: uppercase; }
        .g7pb-events a, .g7pb-downloads a { color: var(--g7pb-theme-accent); font-weight: 850; text-decoration: none; }
        .g7pb-events--timeline li { position: relative; padding-left: 2rem; }
        .g7pb-events--timeline li::before { position: absolute; top: 2rem; left: 0; width: .65rem; height: .65rem; border-radius: 50%; background: var(--g7pb-theme-accent); content: ''; }
        .g7pb-downloads li { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; gap: 1.25rem; align-items: center; padding: 1.5rem 0; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-downloads__type { display: grid; width: 3.5rem; aspect-ratio: 1; place-items: center; border: 1px solid var(--g7pb-page-border, #dfe2e8); color: var(--g7pb-theme-accent); font-size: .72rem; font-weight: 900; }
        .g7pb-downloads h3 { margin: 0 0 .35rem; }
        .g7pb-downloads p, .g7pb-downloads small { color: var(--g7pb-page-muted, #526071); }
        .g7pb-downloads p { margin: 0 0 .35rem; line-height: 1.6; }
        .g7pb-archive__tools { display: flex; gap: .75rem; margin-bottom: 1.5rem; }
        .g7pb-archive__tools label:first-child { flex: 1; }
        .g7pb-archive__tools input, .g7pb-archive__tools select { width: 100%; min-height: 3rem; padding: .7rem .9rem; border: 1px solid var(--g7pb-page-border, #dfe2e8); border-radius: var(--g7pb-theme-radius); color: inherit; background: transparent; font: inherit; }
        .g7pb-board-archive__items article[hidden] { display: none; }
        .g7pb-product-showcase__items { display: grid; grid-template-columns: 1.5fr repeat(2, minmax(0, 1fr)); gap: 1rem; }
        .g7pb-product-showcase__items article:first-child { grid-row: span 2; }
        .g7pb-product-showcase__items article a { height: 100%; }
        .g7pb-product-showcase--rail .g7pb-product-showcase__items { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; }
        .g7pb-product-showcase--rail .g7pb-product-showcase__items article { min-width: min(20rem, 80vw); grid-row: auto; scroll-snap-align: start; }
        .g7pb-heading-block__heading { max-width: 24ch; margin: 0; font-size: clamp(2rem, 5vw, 4.25rem); line-height: 1.06; letter-spacing: -.045em; }
        .g7pb-heading-block h3.g7pb-heading-block__heading { font-size: clamp(1.75rem, 4vw, 3.25rem); }
        .g7pb-heading-block h4.g7pb-heading-block__heading { font-size: clamp(1.45rem, 3vw, 2.4rem); }
        .g7pb-heading-block .g7pb-section-eyebrow { margin-bottom: .7rem; }
        .g7pb-heading-block.g7pb-text-align--center .g7pb-heading-block__heading, .g7pb-heading-block.g7pb-text-align--right .g7pb-heading-block__heading { margin-inline-start: auto; }
        .g7pb-heading-block.g7pb-text-align--center .g7pb-heading-block__heading { margin-inline-end: auto; }
        .g7pb-rich-text__content { color: var(--g7pb-page-muted, #526071); line-height: 1.8; }
        .g7pb-rich-text__content--narrow { max-width: 48ch; }
        .g7pb-rich-text__content--standard { max-width: 65ch; }
        .g7pb-rich-text__content--wide { max-width: 80ch; }
        .g7pb-rich-text__content { overflow-wrap: anywhere; }
        .g7pb-rich-text__content > :first-child { margin-top: 0; }
        .g7pb-rich-text__content > :last-child { margin-bottom: 0; }
        .g7pb-rich-text__content h2, .g7pb-rich-text__content h3, .g7pb-rich-text__content h4 { color: inherit; line-height: 1.2; letter-spacing: -.025em; }
        .g7pb-rich-text__content a { color: var(--g7pb-theme-accent); text-underline-offset: .2em; }
        .g7pb-rich-text.g7pb-text-align--center .g7pb-rich-text__content, .g7pb-rich-text.g7pb-text-align--right .g7pb-rich-text__content { margin-inline-start: auto; }
        .g7pb-rich-text.g7pb-text-align--center .g7pb-rich-text__content { margin-inline-end: auto; }
        .g7pb-image-block__figure { margin: 0; }
        .g7pb-image-block__link { display: block; color: inherit; }
        .g7pb-image-block__image { display: grid; width: 100%; height: auto; min-height: 16rem; place-items: center; border-radius: var(--g7pb-theme-radius); object-fit: cover; }
        .g7pb-image-block__figure--16-9 .g7pb-image-block__image { aspect-ratio: 16 / 9; height: auto; }
        .g7pb-image-block__figure--4-3 .g7pb-image-block__image { aspect-ratio: 4 / 3; height: auto; }
        .g7pb-image-block__figure--1-1 .g7pb-image-block__image { aspect-ratio: 1; height: auto; }
        .g7pb-image-block figcaption { padding-top: .85rem; color: var(--g7pb-page-muted, #526071); font-size: .9rem; line-height: 1.6; }
        .g7pb-buttons__items { display: flex; flex-wrap: wrap; gap: .75rem; }
        .g7pb-buttons__items--center { justify-content: center; }
        .g7pb-buttons__items--right { justify-content: flex-end; }
        .g7pb-buttons .g7pb-button--secondary { color: inherit; }
        .g7pb-button--text { padding-inline: .25rem; color: var(--g7pb-theme-accent); }
        .g7pb-buttons .g7pb-button:focus-visible, .g7pb-rich-text__content a:focus-visible, .g7pb-image-block__link:focus-visible { outline: 3px solid color-mix(in srgb, var(--g7pb-theme-accent) 55%, white); outline-offset: 3px; }
        .g7pb-image-text { display: grid; grid-template-columns: minmax(18rem, .9fr) minmax(0, 1.1fr); gap: clamp(2rem, 7vw, 7rem); align-items: center; }
        .g7pb-image-text--right .g7pb-image-text__media { order: 2; }
        .g7pb-image-text__media { aspect-ratio: 4 / 3; overflow: hidden; margin: 0; border-radius: var(--g7pb-theme-radius); background: var(--g7pb-theme-accent-soft); }
        .g7pb-image-text__image { display: grid; width: 100%; height: 100%; min-height: 18rem; place-items: center; object-fit: cover; }
        .g7pb-image-text__copy h2 { max-width: 18ch; margin: 0; font-size: clamp(2rem, 5vw, 4rem); line-height: 1.06; letter-spacing: -.045em; }
        .g7pb-image-text__copy .g7pb-section-eyebrow { margin-bottom: .7rem; }
        .g7pb-image-text__body { margin-top: 1.2rem; color: var(--g7pb-page-muted, #526071); line-height: 1.75; }
        .g7pb-image-text__body > :first-child { margin-top: 0; }
        .g7pb-image-text__body > :last-child { margin-bottom: 0; }
        .g7pb-image-text__copy > .g7pb-button { margin-top: 1.25rem; }
        .g7pb-icon-list__items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding: 0; border-block-start: 1px solid var(--g7pb-page-border, #dfe2e8); list-style: none; }
        .g7pb-icon-list--single .g7pb-icon-list__items { grid-template-columns: 1fr; }
        .g7pb-icon-list__item { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr); gap: 1rem; padding: 1.5rem 1.5rem 1.5rem 0; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-icon-list--two-column .g7pb-icon-list__item:nth-child(odd) { border-inline-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
        .g7pb-icon-list--two-column .g7pb-icon-list__item:nth-child(even) { padding-inline-start: 1.5rem; }
        .g7pb-icon-list__icon { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border-radius: 999px; color: var(--g7pb-theme-accent); background: var(--g7pb-theme-accent-soft); font-weight: 900; }
        .g7pb-icon-list__icon::before { content: '✓'; }
        .g7pb-icon-list__icon.g7pb-icon--bolt::before { content: '↯'; } .g7pb-icon-list__icon.g7pb-icon--code::before { content: '</>'; } .g7pb-icon-list__icon.g7pb-icon--globe::before { content: '◎'; }
        .g7pb-icon-list__icon.g7pb-icon--heart::before { content: '♥'; } .g7pb-icon-list__icon.g7pb-icon--layers::before { content: '▱'; } .g7pb-icon-list__icon.g7pb-icon--mobile::before { content: '▯'; }
        .g7pb-icon-list__icon.g7pb-icon--palette::before { content: '◒'; } .g7pb-icon-list__icon.g7pb-icon--shield::before { content: '◆'; } .g7pb-icon-list__icon.g7pb-icon--sparkles::before { content: '✦'; } .g7pb-icon-list__icon.g7pb-icon--star::before { content: '★'; }
        .g7pb-icon-list__item h3 { margin: 0 0 .45rem; font-size: 1.05rem; }
        .g7pb-icon-list__item p { margin: 0; color: var(--g7pb-page-muted, #526071); line-height: 1.65; }
        .g7pb-surface--contrast p.g7pb-section-eyebrow { color: #9ab2ff; }
        .g7pb-element-font--system { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
        .g7pb-element-font--modern { font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
        .g7pb-element-font--serif { font-family: Georgia, "Noto Serif KR", "Times New Roman", serif !important; }
        .g7pb-element-font--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
        .g7pb-element-size--small { font-size: .875em !important; }
        .g7pb-element-size--large { font-size: 1.2em !important; }
        .g7pb-element-size--xlarge { font-size: 1.45em !important; }
        .g7pb-element-weight--medium { font-weight: 500 !important; }
        .g7pb-element-weight--semibold { font-weight: 650 !important; }
        .g7pb-element-weight--bold { font-weight: 800 !important; }
        .g7pb-element-align--center { display: block !important; text-align: center !important; }
        .g7pb-element-align--right { display: block !important; text-align: right !important; }
        .g7pb-element-tone--muted { color: var(--g7pb-page-muted, #64748b) !important; }
        .g7pb-element-tone--accent { color: var(--g7pb-theme-accent, #2456df) !important; }
        .g7pb-element-tone--contrast { color: var(--g7pb-page-bg, #fff) !important; }
        .g7pb-motion-active .g7pb-block[data-g7pb-motion] { --g7pb-motion-distance: 1.5rem; --g7pb-motion-duration: 680ms; }
        .g7pb-motion-active .g7pb-block[data-g7pb-motion-intensity='subtle'] { --g7pb-motion-distance: .8rem; --g7pb-motion-duration: 520ms; }
        .g7pb-motion-active .g7pb-block[data-g7pb-motion-intensity='strong'] { --g7pb-motion-distance: 2.5rem; --g7pb-motion-duration: 880ms; }
        .g7pb-motion-active .g7pb-block[data-g7pb-motion='reveal'] { opacity: 0; transform: translate3d(0, var(--g7pb-motion-distance), 0); transition: opacity var(--g7pb-motion-duration) ease, transform var(--g7pb-motion-duration) cubic-bezier(.2,.7,.2,1); }
        .g7pb-motion-active .g7pb-block[data-g7pb-motion='reveal'].is-inview { opacity: 1; transform: translate3d(0, 0, 0); }
        .g7pb-motion-active [data-g7pb-motion='stagger'] [data-g7pb-motion-item] { opacity: 0; transform: translate3d(0, var(--g7pb-motion-distance), 0); transition: opacity var(--g7pb-motion-duration) ease var(--g7pb-motion-delay, 0ms), transform var(--g7pb-motion-duration) cubic-bezier(.2,.7,.2,1) var(--g7pb-motion-delay, 0ms); }
        .g7pb-motion-active [data-g7pb-motion='stagger'].is-inview [data-g7pb-motion-item] { opacity: 1; transform: translate3d(0, 0, 0); }
        .g7pb-motion-active [data-g7pb-motion='chart-draw'] progress[data-g7pb-motion-item] { transform: scaleX(0); transform-origin: left center; transition: transform var(--g7pb-motion-duration) cubic-bezier(.2,.7,.2,1); }
        .g7pb-motion-active [data-g7pb-motion='chart-draw'].is-inview progress[data-g7pb-motion-item] { transform: scaleX(1); }
        .g7pb-motion-active [data-g7pb-motion='parallax-soft'] { --g7pb-parallax-distance: 2rem; }
        .g7pb-motion-active [data-g7pb-motion='parallax-soft'][data-g7pb-motion-intensity='subtle'] { --g7pb-parallax-distance: 1rem; }
        .g7pb-motion-active [data-g7pb-motion='parallax-soft'][data-g7pb-motion-intensity='strong'] { --g7pb-parallax-distance: 3.25rem; }
        .g7pb-motion-active [data-g7pb-motion='parallax-soft'] .g7pb-motion-parallax-target { transform: translate3d(0, calc(var(--g7pb-motion-progress, 0) * var(--g7pb-parallax-distance)), 0) scale(1.035); will-change: transform; }
        @media (max-width: 700px) {
            .g7pb-cta, .g7pb-contact, .g7pb-inquiry, .g7pb-map { grid-template-columns: 1fr; }
            .g7pb-inquiry-form { grid-template-columns: 1fr; }
            .g7pb-inquiry-form > * { grid-column: 1; }
            .g7pb-cta__actions, .g7pb-contact__actions { grid-column: 1; }
            .g7pb-hero-split, .g7pb-hero-slider__slide, .g7pb-image-text { grid-template-columns: 1fr; }
            .g7pb-image-text--right .g7pb-image-text__media { order: initial; }
            .g7pb-hero-split--left .g7pb-hero-split__copy { order: initial; }
            .g7pb-hero-split__media { aspect-ratio: 16 / 10; }
            .g7pb-hero-slider__slide figure { min-height: 14rem; }
            .g7pb-gallery__grid--3, .g7pb-gallery__grid--4 { grid-template-columns: repeat(2, 1fr); }
            .g7pb-dynamic-products--3, .g7pb-dynamic-products--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .g7pb-pricing__plan--featured { transform: none; }
            .g7pb-testimonials__items, .g7pb-articles--grid .g7pb-articles__items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .g7pb-faq { grid-template-columns: 1fr; }
            .g7pb-logo-carousel .g7pb-hero-slider__slide { min-width: 34%; flex-basis: 34%; }
            .g7pb-product-showcase__items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .g7pb-product-showcase__items article:first-child { grid-row: auto; }
        }
        @media (max-width: 899px) {
            .g7pb-site-header__inner { width: min(calc(100% - 2rem), 72rem); min-height: 4.25rem; grid-template-columns: 1fr auto; }
            .g7pb-site-nav, .g7pb-site-header__inner > .g7pb-site-header__cta { display: none; }
            .g7pb-menu-toggle { display: block; }
            .g7pb-site-footer__top { display: grid; }
            .g7pb-site-footer__columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .g7pb-site-footer__columns > :first-child { grid-column: 1 / -1; }
            .g7pb-site-footer nav ul { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
            .g7pb-site-footer__columns { grid-template-columns: 1fr; }
            .g7pb-site-footer__columns > :first-child { grid-column: auto; }
            .g7pb-dynamic-products--2, .g7pb-dynamic-products--3, .g7pb-dynamic-products--4 { grid-template-columns: 1fr; }
            .g7pb-testimonials__items, .g7pb-articles--grid .g7pb-articles__items { grid-template-columns: 1fr; }
            .g7pb-testimonials blockquote { border-inline-end: 0; border-block-end: 1px solid var(--g7pb-page-border, #dfe2e8); }
            .g7pb-articles article { grid-template-columns: 5.5rem minmax(0, 1fr); }
            .g7pb-logo-carousel .g7pb-hero-slider__slide { min-width: 60%; flex-basis: 60%; }
            .g7pb-events li, .g7pb-downloads li { grid-template-columns: 1fr; gap: .65rem; }
            .g7pb-downloads__type { width: 3rem; }
            .g7pb-archive__tools { display: grid; }
            .g7pb-product-showcase__items { grid-template-columns: 1fr; }
            .g7pb-product-detail .g7pb-data-detail__content article { grid-template-columns: 1fr; }
            .g7pb-buttons__items { align-items: stretch; flex-direction: column; }
            .g7pb-buttons__items .g7pb-button { width: 100%; }
            .g7pb-icon-list__items { grid-template-columns: 1fr; }
            .g7pb-icon-list--two-column .g7pb-icon-list__item:nth-child(odd) { border-inline-end: 0; }
            .g7pb-icon-list--two-column .g7pb-icon-list__item:nth-child(even) { padding-inline-start: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
            .g7pb-block, .g7pb-block *, .g7pb-motion-parallax-target { animation: none !important; transition: none !important; transform: none !important; }
            .g7pb-mobile-menu, .g7pb-site-subnav { animation: none !important; transition: none !important; }
        }
    </style>
    @if (!empty($siteShell) || !empty($siteHeaderHtml) || str_contains($page->artifact, 'data-g7pb-motion=') || str_contains($page->artifact, 'data-g7pb-slider') || str_contains($page->artifact, 'data-g7pb-data-source=') || str_contains($page->artifact, 'data-g7pb-visibility-audience=') || str_contains($page->artifact, 'data-g7pb-inquiry-form') || str_contains($page->artifact, 'data-g7pb-accordion') || str_contains($page->artifact, 'data-g7pb-tabs'))
        <script defer src="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/js/page-effects.iife.js') }}"></script>
    @endif
</head>
<body>
    @if (!empty($siteShell) || !empty($siteHeaderHtml) || !empty($siteFooterHtml))
        <a class="g7pb-skip-link" href="#g7pb-main">본문 바로가기</a>
    @endif
    @if (!empty($siteHeaderHtml))
        {!! $siteHeaderHtml !!}
    @elseif (!empty($siteShell))
        <header class="g7pb-site-header {{ $siteShell->sticky ? 'is-sticky' : '' }} {{ $siteShell->headerVariant === 'transparent' ? 'is-transparent' : '' }}"
            data-g7pb-site-header data-testid="page-builder-site-header">
            <div class="g7pb-site-header__inner">
                <a class="g7pb-site-brand" href="{{ $siteShell->homeUrl }}">
                    @if ($siteShell->logoUrl !== '')
                        <img src="{{ $siteShell->logoUrl }}" alt="{{ $siteShell->brandName }}">
                    @else
                        <span>{{ $siteShell->brandName }}</span>
                    @endif
                </a>
                <nav class="g7pb-site-nav" aria-label="주 메뉴">
                    <ul>
                        @foreach ($siteShell->navigation as $item)
                            <li><a href="{{ $item['url'] }}">{{ $item['label'] }}</a></li>
                        @endforeach
                    </ul>
                </nav>
                @if ($siteShell->cta !== null)
                    <a class="g7pb-site-header__cta" href="{{ $siteShell->cta['url'] }}">{{ $siteShell->cta['label'] }}</a>
                @endif
                @if ($siteShell->navigation !== [] || $siteShell->cta !== null)
                    <button class="g7pb-menu-toggle" type="button" aria-expanded="false" aria-controls="g7pb-mobile-navigation"
                        aria-label="메뉴 열기" data-g7pb-menu-toggle><span></span></button>
                @endif
            </div>
            @if ($siteShell->navigation !== [] || $siteShell->cta !== null)
                @if ($siteShell->mobileMenuStyle !== 'dropdown')
                    <button class="g7pb-mobile-menu__backdrop" type="button" aria-label="메뉴 닫기" data-g7pb-menu-backdrop hidden></button>
                @endif
                <nav class="g7pb-mobile-menu g7pb-mobile-menu--{{ $siteShell->mobileMenuStyle }}" id="g7pb-mobile-navigation" aria-label="모바일 메뉴" data-g7pb-mobile-menu data-g7pb-menu-style="{{ $siteShell->mobileMenuStyle }}" hidden>
                    @if ($siteShell->mobileMenuStyle !== 'dropdown')
                        <button class="g7pb-mobile-menu__close" type="button" aria-label="메뉴 닫기" data-g7pb-menu-close>&times;</button>
                    @endif
                    <ul>
                        @foreach ($siteShell->navigation as $item)
                            <li><a href="{{ $item['url'] }}">{{ $item['label'] }}</a></li>
                        @endforeach
                    </ul>
                    @if ($siteShell->cta !== null)
                        <a class="g7pb-mobile-menu__cta" href="{{ $siteShell->cta['url'] }}">{{ $siteShell->cta['label'] }}</a>
                    @endif
                </nav>
            @endif
        </header>
    @endif
    <main id="g7pb-main" class="g7pb-page" data-testid="{{ $rootTestId }}" data-artifact-sha256="{{ $page->artifactSha256 }}">
        {!! $page->artifact !!}
    </main>
    @if (!empty($siteFooterHtml))
        {!! $siteFooterHtml !!}
    @elseif (!empty($siteShell))
        <footer class="g7pb-site-footer" data-testid="page-builder-site-footer">
            <div class="g7pb-site-footer__top">
                <a class="g7pb-site-brand" href="{{ $siteShell->homeUrl }}">{{ $siteShell->brandName }}</a>
                @if ($siteShell->showFooterNavigation && $siteShell->navigation !== [])
                    <nav aria-label="하단 메뉴"><ul>
                        @foreach ($siteShell->navigation as $item)
                            <li><a href="{{ $item['url'] }}">{{ $item['label'] }}</a></li>
                        @endforeach
                    </ul></nav>
                @endif
            </div>
            @if ($siteShell->footerText !== '')
                <p class="g7pb-site-footer__legal">{{ $siteShell->footerText }}</p>
            @endif
        </footer>
    @endif
</body>
</html>
