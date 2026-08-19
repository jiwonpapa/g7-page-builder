<?php

$moduleRoot = dirname(__DIR__, 2);
$g7AutoloadCandidates = [
    $moduleRoot.'/.runtime/gnuboard7/vendor/autoload.php',
    dirname($moduleRoot, 2).'/vendor/autoload.php',
];

foreach ($g7AutoloadCandidates as $autoload) {
    if (is_file($autoload)) {
        require_once $autoload;
        break;
    }
}

require_once $moduleRoot.'/vendor/autoload.php';
