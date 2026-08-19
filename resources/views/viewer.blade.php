<!doctype html>
<html lang="{{ str_replace('_', '-', $page->locale) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="{{ $rootTestId === 'page-builder-preview-root' ? 'noindex,nofollow' : 'index,follow' }}">
    <title>{{ $page->title }}</title>
    @if (!empty($canonicalUrl))
        <link rel="canonical" href="{{ $canonicalUrl }}">
        <meta property="og:url" content="{{ $canonicalUrl }}">
        <meta property="og:title" content="{{ $page->title }}">
        <meta property="og:type" content="website">
    @endif
    <style>
        :root { color-scheme: light; font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #172033; background: #fff; }
        .g7pb-page { min-height: 100vh; overflow: hidden; }
        .g7pb-block { padding: clamp(3.5rem, 8vw, 8rem) max(1.25rem, calc((100vw - 72rem) / 2)); }
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
        .g7pb-hero__eyebrow { margin: 0; color: #4f46e5; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .g7pb-hero__title { max-width: 18ch; margin: 0; font-size: clamp(2.5rem, 7vw, 5.75rem); line-height: 1.02; letter-spacing: -.04em; }
        .g7pb-hero__body { max-width: 44rem; margin: 0; color: #526079; font-size: clamp(1rem, 2vw, 1.25rem); line-height: 1.75; }
        .g7pb-button { display: inline-flex; min-height: 3rem; align-items: center; justify-content: center; padding: .75rem 1.25rem; border-radius: 999px; font-weight: 700; text-decoration: none; }
        .g7pb-button--primary { color: #fff; background: #4f46e5; }
        .g7pb-button--secondary { color: #172033; border: 1px solid #b9c0cd; background: transparent; }
        .g7pb-hero__image { width: min(100%, 64rem); height: auto; border-radius: 1.5rem; }
        .g7pb-features { background: #f6f7fb; }
        .g7pb-features__title { margin: 0 0 2.5rem; font-size: clamp(2rem, 4vw, 3.5rem); letter-spacing: -.03em; }
        .g7pb-features__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }
        .g7pb-features__item { min-height: 100%; padding: 1.5rem; border: 1px solid #dde2ec; border-radius: 1.25rem; background: #fff; }
        .g7pb-features__item h3 { margin: 1rem 0 .5rem; }
        .g7pb-features__item p { margin: 0; color: #526079; line-height: 1.65; }
        .g7pb-features__icon { display: inline-block; width: 2rem; height: 2rem; border-radius: .65rem; background: #c7d2fe; }
        .g7pb-cta { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(16rem, .65fr); gap: clamp(2rem, 7vw, 7rem); align-items: end; }
        .g7pb-cta--light { background: #f3f1ed; }
        .g7pb-cta--dark { color: #fff; background: #172033; }
        .g7pb-cta__eyebrow, .g7pb-contact__eyebrow { margin: 0 0 .75rem; color: #4f46e5; font-size: .75rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
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
        .g7pb-hero.g7pb-surface--default, .g7pb-features.g7pb-surface--default, .g7pb-cta.g7pb-surface--default, .g7pb-contact.g7pb-surface--default { background: #fff; color: #172033; }
        .g7pb-hero.g7pb-surface--soft, .g7pb-features.g7pb-surface--soft, .g7pb-cta.g7pb-surface--soft, .g7pb-contact.g7pb-surface--soft { background: #f3f1ed; color: #172033; }
        .g7pb-hero.g7pb-surface--contrast, .g7pb-features.g7pb-surface--contrast, .g7pb-cta.g7pb-surface--contrast, .g7pb-contact.g7pb-surface--contrast { background: #172033; color: #fff; }
        @media (max-width: 700px) {
            .g7pb-cta, .g7pb-contact { grid-template-columns: 1fr; }
            .g7pb-cta__actions, .g7pb-contact__actions { grid-column: 1; }
        }
    </style>
</head>
<body>
    <main class="g7pb-page" data-testid="{{ $rootTestId }}" data-artifact-sha256="{{ $page->artifactSha256 }}">
        {!! $page->artifact !!}
    </main>
</body>
</html>
