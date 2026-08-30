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
echo json_encode($html, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
