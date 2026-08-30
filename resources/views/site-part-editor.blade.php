<!doctype html>
<html lang="{{ str_replace('_', '-', $locale) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>{{ $kind === null ? '헤더·푸터' : ($kind === 'header' ? 'Header' : 'Footer') }} · G7 Page Builder</title>
    <link rel="stylesheet" href="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder-site-part.css') }}">
</head>
<body class="g7pb-editor-shell">
    <div hidden data-g7pb-runtime-config="{{ json_encode($siteRuntimeConfig ?? [], JSON_THROW_ON_ERROR) }}"></div>
    <div id="g7pb-site-part-editor"
         @if ($kind === null) data-g7pb-site-part-workspace @else data-g7pb-site-part-editor @endif
         data-testid="page-builder-site-part-editor-root"
         @if ($kind !== null) data-kind="{{ $kind }}" @endif
         data-locale="{{ $locale }}"></div>
    <script>
        (() => {
            const token = window.localStorage.getItem('auth_token');
            if (!token) {
                const redirect = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.replace(`/admin/login?redirect=${redirect}`);
            }
        })();
    </script>
    <script defer src="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/js/page-builder-site-part.iife.js') }}"></script>
</body>
</html>
