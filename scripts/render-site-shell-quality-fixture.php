<?php

require dirname(__DIR__).'/vendor/autoload.php';

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;

// Browser contract fixture: real production compiler and production JS/CSS, synthetic personas only.
$compiler = new SitePartHtmlCompiler;
$blocks = [
    'header' => ['type' => 'site.header.navigation-01', 'props' => ['brand_name' => 'Quality Site', 'home_url' => '/', 'navigation' => [['label' => '소개', 'url' => '/about']], 'mobile_menu' => true]],
    'footer' => ['type' => 'site.footer.simple-01', 'props' => ['brand_name' => '사이트 이름', 'home_url' => '/', 'navigation' => [['label' => '개인정보처리방침', 'url' => '/privacy']], 'footer_text' => '검증용 사이트 정보']],
];
$html = [];
foreach ($blocks as $kind => $block) {
    $document = new SitePartDocument('11111111-1111-4111-8111-111111111111', $kind, 'ko', [], [[
        ...$block, 'instance_id' => '22222222-2222-4222-8222-222222222222', 'block_version' => 1, 'slots' => [],
    ]]);
    $html[$kind] = $compiler->compile($document, 1)->html;
}
if (in_array('--mobile', $argv, true)) {
    $navigation = [];
    for ($index = 1; $index <= 10; $index++) {
        $navigation[] = ['label' => '서비스 '.$index.' · 길이가 긴 메뉴 이름도 줄바꿈으로 표시합니다', 'url' => '/service-'.$index, 'children' => [['label' => '상세 안내 '.$index, 'url' => '/detail-'.$index]]];
    }
    foreach (['drawer-right', 'drawer-left', 'dropdown', 'sheet-bottom', 'empty'] as $style) {
        $document = new SitePartDocument('11111111-1111-4111-8111-111111111111', 'header', 'ko', [], [[
            'instance_id' => '22222222-2222-4222-8222-222222222222', 'type' => 'site.header.navigation-01', 'block_version' => 1,
            'props' => ['brand_name' => 'Quality Site', 'home_url' => '/', 'navigation' => $style === 'empty' ? [] : $navigation, 'mobile_menu_style' => $style === 'empty' ? 'drawer-right' : $style], 'slots' => [],
        ]]);
        $html['mobile'][$style] = $compiler->compile($document, 1)->html;
    }
}
echo json_encode($html, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
