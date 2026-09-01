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
    <link rel="stylesheet" href="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder-public.css') }}">
    @if (!empty($siteShell) || !empty($siteHeaderHtml) || str_contains($page->artifact, 'data-g7pb-motion=') || str_contains($page->artifact, 'data-g7pb-slider') || str_contains($page->artifact, 'data-g7pb-data-source=') || str_contains($page->artifact, 'data-g7pb-visibility-audience=') || str_contains($page->artifact, 'data-g7pb-inquiry-form') || str_contains($page->artifact, 'data-g7pb-accordion') || str_contains($page->artifact, 'data-g7pb-tabs') || str_contains($page->artifact, 'data-g7pb-runtime-icon') || str_contains($page->artifact, 'data-g7pb-embed') || str_contains($page->artifact, 'data-g7pb-form-control') || str_contains($page->artifact, 'data-g7pb-runtime-button'))
        <script defer src="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/js/page-effects.iife.js') }}"></script>
    @endif
</head>
<body>
    @if (!empty($siteRuntimeConfig))
        <div hidden data-g7pb-runtime-config="{{ json_encode($siteRuntimeConfig, JSON_THROW_ON_ERROR) }}"></div>
    @endif
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
