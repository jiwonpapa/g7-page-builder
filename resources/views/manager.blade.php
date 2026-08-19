<!doctype html>
<html lang="{{ str_replace('_', '-', $locale) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>G7 Page Builder</title>
    <link rel="stylesheet" href="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder.css') }}">
</head>
<body class="g7pb-manager-shell">
    <div id="g7pb-manager"
         data-testid="page-builder-manager-root"
         data-g7pb-manager
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
    <script defer src="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/js/page-builder.iife.js') }}"></script>
</body>
</html>
