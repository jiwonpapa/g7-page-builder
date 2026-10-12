<!doctype html>
<html lang="{{ str_replace('_', '-', $locale) }}">
<head>
    @php
        $editorDist = base_path('modules/jiwonpapa-page_builder/dist');
        // This only selects a fixed bundle. The authenticated API owns document access.
        $structureEditor = request()->query('editor') === 'structure';
        $editorAsset = $structureEditor ? 'page-builder-structure' : 'page-builder-editor';
        $editorCssDigest = hash_file('sha256', $editorDist.'/css/'.$editorAsset.'.css');
        $editorJsDigest = hash_file('sha256', $editorDist.'/js/'.$editorAsset.'.iife.js');
    @endphp
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>G7 Page Builder</title>
    <link rel="stylesheet" href="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/css/'.$editorAsset.'.css') }}?v={{ $editorCssDigest }}">
</head>
<body class="g7pb-editor-shell">
    <div hidden data-g7pb-runtime-config="{{ json_encode($siteRuntimeConfig ?? [], JSON_THROW_ON_ERROR) }}"></div>
    <div id="g7pb-editor"
         data-testid="page-builder-editor-root"
         @if($structureEditor) data-g7pb-structure-editor @else data-g7pb-editor @endif
         data-document-id="{{ $documentId }}"
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
    <script defer src="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/js/'.$editorAsset.'.iife.js') }}?v={{ $editorJsDigest }}"></script>
</body>
</html>
