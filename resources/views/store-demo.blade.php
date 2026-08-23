<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>{{ $title }} · G7 Page Builder 데모</title>
    <link rel="stylesheet" href="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder-public.css') }}">
    <style>
        :root { color-scheme: light; font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #172033; background: #fff; }
        .g7pb-store-demo-bar { position: relative; z-index: 20; display: flex; min-height: 3rem; align-items: center; justify-content: center; padding: .65rem 1rem; color: #fff; background: #172033; font-size: .78rem; font-weight: 750; text-align: center; }
        .g7pb-store-demo-bar strong { margin-right: .45rem; color: #9ab2ff; }
    </style>
</head>
<body>
    <header class="g7pb-store-demo-bar">
        <span><strong>Page Kit 실제 화면</strong>{{ $title }} · 샘플 링크와 폼은 데모에서 작동하지 않습니다.</span>
    </header>
    <main class="g7pb-page" data-testid="page-builder-store-demo-root">{!! $html !!}</main>
    <script src="{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/js/page-effects.iife.js') }}" defer></script>
</body>
</html>
