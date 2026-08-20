<?php

declare(strict_types=1);

$report = $argv[1] ?? dirname(__DIR__).'/output/coverage/php-clover.xml';
if (! is_file($report)) {
    fwrite(STDERR, "PHP coverage report not found: {$report}\n");
    exit(2);
}

$xml = simplexml_load_file($report);
if ($xml === false || ! isset($xml->project->metrics)) {
    fwrite(STDERR, "Invalid Clover coverage report: {$report}\n");
    exit(2);
}

/** @return float */
$coveragePercent = static function (SimpleXMLElement $metrics): float {
    $total = (int) $metrics['statements'];
    $covered = (int) $metrics['coveredstatements'];

    return $total === 0 ? 100.0 : ($covered / $total) * 100;
};

$requirements = [
    '__project__' => 61.0,
    'src/Application/Compilation/HtmlDocumentCompiler.php' => 87.0,
    'src/Application/PageBuilderService.php' => 96.0,
    'src/Infrastructure/Gnuboard7/Persistence/EloquentPageBuilderRepository.php' => 91.0,
];

$actual = ['__project__' => $coveragePercent($xml->project->metrics)];
foreach ($xml->xpath('//file') ?: [] as $file) {
    $name = str_replace('\\', '/', (string) $file['name']);
    foreach (array_keys($requirements) as $path) {
        if ($path !== '__project__' && str_ends_with($name, $path) && isset($file->metrics)) {
            $actual[$path] = $coveragePercent($file->metrics);
        }
    }
}

$failed = false;
foreach ($requirements as $path => $minimum) {
    if (! array_key_exists($path, $actual)) {
        fwrite(STDERR, "PHP coverage target missing: {$path}\n");
        $failed = true;

        continue;
    }

    $label = $path === '__project__' ? 'project' : $path;
    printf("PHP coverage %-82s %6.2f%% (minimum %.2f%%)\n", $label, $actual[$path], $minimum);
    if ($minimum > $actual[$path] + 0.00001) {
        $failed = true;
    }
}

exit($failed ? 1 : 0);
