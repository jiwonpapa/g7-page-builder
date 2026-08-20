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
        .g7pb-section-heading { max-width: 48rem; margin-bottom: clamp(2rem, 5vw, 4rem); }
        .g7pb-section-heading h2 { margin: .65rem 0 0; font-size: clamp(2.1rem, 5vw, 4.25rem); line-height: 1.06; letter-spacing: -.045em; }
        .g7pb-section-eyebrow { margin: 0; color: #4f46e5; font-size: .75rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .g7pb-media-placeholder { display: grid; width: 100%; height: 100%; min-height: 12rem; place-items: center; background: linear-gradient(145deg, #e9edf4, #dce3ee); color: #657187; font-size: .8rem; font-weight: 750; }
        .g7pb-surface--contrast .g7pb-media-placeholder { background: linear-gradient(145deg, #2b3950, #40516c); color: #dbe5f3; }
        .g7pb-hero-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, .9fr); align-items: center; gap: clamp(2rem, 7vw, 7rem); }
        .g7pb-hero-split--left .g7pb-hero-split__copy { order: 2; }
        .g7pb-hero-split__copy h1 { max-width: 13ch; margin: .8rem 0 1.25rem; font-size: clamp(2.6rem, 6vw, 5.25rem); line-height: 1.02; letter-spacing: -.055em; }
        .g7pb-hero-split__body { max-width: 38rem; color: #667085; font-size: 1.1rem; line-height: 1.75; }
        .g7pb-hero-split__media { aspect-ratio: 4 / 5; overflow: hidden; margin: 0; border-radius: 1rem; background: #e7ebf2; }
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
        .g7pb-stats__icon { display: block; width: 1.7rem; height: 1.7rem; color: #4f46e5; }
        .g7pb-stats__icon::before { font-size: 1.5rem; }
        .g7pb-stats__icon--trend::before { content: '↗'; }
        .g7pb-stats__icon--users::before { content: '●●'; font-size: .85rem; letter-spacing: -.2rem; }
        .g7pb-stats__icon--target::before { content: '◎'; }
        .g7pb-stats__icon--chart::before { content: '▥'; }
        .g7pb-stats article > strong { display: block; margin-top: 1.7rem; font-size: clamp(2.2rem, 5vw, 4rem); letter-spacing: -.05em; }
        .g7pb-stats article h3 { margin: .4rem 0; font-size: 1rem; }
        .g7pb-stats article p { margin: 0; color: #667085; font-size: .85rem; line-height: 1.6; }
        .g7pb-pricing__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; align-items: stretch; }
        .g7pb-pricing__plan { position: relative; padding: 2rem; border: 1px solid #d8dee9; border-radius: 1rem; background: rgb(255 255 255 / 72%); }
        .g7pb-pricing__plan--featured { border-color: #4f46e5; box-shadow: inset 0 .3rem #4f46e5; transform: translateY(-.5rem); }
        .g7pb-pricing__badge { position: absolute; top: 1rem; right: 1rem; padding: .3rem .6rem; border-radius: 99px; background: #e0e7ff; color: #3730a3; font-size: .7rem; font-weight: 800; }
        .g7pb-pricing__plan h3 { margin: 0; }
        .g7pb-pricing__price strong { font-size: 2.3rem; letter-spacing: -.045em; }
        .g7pb-pricing__plan ul { min-height: 9rem; padding: 1rem 0; list-style: none; }
        .g7pb-pricing__plan li { padding: .35rem 0; }
        .g7pb-pricing__plan li::before { content: '✓'; margin-right: .55rem; color: #4f46e5; }
        .g7pb-team__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 1.5rem; }
        .g7pb-team article figure { aspect-ratio: 4 / 5; overflow: hidden; margin: 0 0 1rem; border-radius: .8rem; }
        .g7pb-team__image { width: 100%; height: 100%; object-fit: cover; font-size: 3rem; }
        .g7pb-team article h3 { margin: 0 0 .25rem; font-size: 1.25rem; }
        .g7pb-team article h3 a { color: inherit; }
        .g7pb-team article > strong { color: #4f46e5; font-size: .85rem; }
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
            .g7pb-cta, .g7pb-contact { grid-template-columns: 1fr; }
            .g7pb-cta__actions, .g7pb-contact__actions { grid-column: 1; }
            .g7pb-hero-split, .g7pb-hero-slider__slide { grid-template-columns: 1fr; }
            .g7pb-hero-split--left .g7pb-hero-split__copy { order: initial; }
            .g7pb-hero-split__media { aspect-ratio: 16 / 10; }
            .g7pb-hero-slider__slide figure { min-height: 14rem; }
            .g7pb-gallery__grid--3, .g7pb-gallery__grid--4 { grid-template-columns: repeat(2, 1fr); }
            .g7pb-pricing__plan--featured { transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
            .g7pb-block, .g7pb-block *, .g7pb-motion-parallax-target { animation: none !important; transition: none !important; transform: none !important; }
        }
    </style>
    @if (str_contains($page->artifact, 'data-g7pb-motion=') || str_contains($page->artifact, 'data-g7pb-slider'))
        <script defer src="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/js/page-effects.iife.js') }}"></script>
    @endif
</head>
<body>
    <main class="g7pb-page" data-testid="{{ $rootTestId }}" data-artifact-sha256="{{ $page->artifactSha256 }}">
        {!! $page->artifact !!}
    </main>
</body>
</html>
