<?php

declare(strict_types=1);

const COMPILER_FACADE = 'src/Application/Compilation/HtmlDocumentCompiler.php';
const COMPILER_OWNERS = 'src/Application/Compilation/HtmlDocument';

/** @return list<string> */
function compilerCoverageSources(string $root): array
{
    $files = [COMPILER_FACADE];
    $directory = $root.'/'.COMPILER_OWNERS;
    if (is_link($directory) || (file_exists($directory) && ! is_dir($directory))) {
        throw new RuntimeException('Compiler owner path must be a directory');
    }
    if (is_dir($directory)) {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
        foreach ($iterator as $file) {
            if ($file->isLink()) throw new RuntimeException('Linked compiler coverage source: '.$file->getPathname());
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = substr($file->getPathname(), strlen($root) + 1);
            }
        }
    }
    foreach ($files as $file) {
        $actual = realpath($root.'/'.$file);
        if ($actual !== $root.'/'.$file || ! is_file($actual)) {
            throw new RuntimeException('Missing or redirected compiler coverage source: '.$file);
        }
    }
    sort($files);

    return $files;
}

/** Prove only the narrow extracted constant-table shape, never infer it from missing coverage. */
function declarationOnlyCompilerOwner(string $source): bool
{
    try {
        $tokens = array_values(array_filter(PhpToken::tokenize($source, TOKEN_PARSE),
            fn (PhpToken $token): bool => ! $token->is([T_OPEN_TAG, T_WHITESPACE, T_COMMENT, T_DOC_COMMENT])));
    } catch (ParseError) {
        return false;
    }
    $index = 0;
    if (($tokens[$index]->id ?? null) === T_DECLARE) {
        $declaration = array_map(fn (PhpToken $token): string => $token->text, array_slice($tokens, 0, 7));
        if ($declaration !== ['declare', '(', 'strict_types', '=', '1', ')', ';']) return false;
        $index += 7;
    }
    if (($tokens[$index]->id ?? null) === T_NAMESPACE) {
        $index++;
        if (! ($tokens[$index] ?? null)?->is([T_STRING, T_NAME_QUALIFIED])) return false;
        $index++;
        if (($tokens[$index++]->text ?? null) !== ';') return false;
    }
    if (($tokens[$index]->id ?? null) === T_FINAL) $index++;
    if (($tokens[$index++]->id ?? null) !== T_CLASS || ($tokens[$index++]->id ?? null) !== T_STRING
        || ($tokens[$index++]->text ?? null) !== '{') return false;
    $constants = 0;
    while (isset($tokens[$index]) && $tokens[$index]->text !== '}') {
        while (($tokens[$index] ?? null)?->is([T_PUBLIC, T_PROTECTED, T_PRIVATE, T_FINAL])) $index++;
        if (($tokens[$index++]->id ?? null) !== T_CONST) return false;
        // Typed constants are allowed; inheritance, traits, properties and methods are not.
        if (in_array($tokens[$index]->text ?? '', ['array', 'string', 'int', 'float', 'bool'], true)
            && ($tokens[$index + 1]->id ?? null) === T_STRING) $index++;
        if (($tokens[$index++]->id ?? null) !== T_STRING || ($tokens[$index++]->text ?? null) !== '=') return false;
        $depth = 0; $literal = false;
        while (isset($tokens[$index]) && $tokens[$index]->text !== ';') {
            $token = $tokens[$index++];
            if ($token->text === '[') { $depth++; continue; }
            if ($token->text === ']') { if (--$depth < 0) return false; continue; }
            if ($token->text === ',' && $depth > 0) continue;
            if ($token->is([T_DOUBLE_ARROW]) || in_array($token->text, ['+', '-'], true)) continue;
            if ($token->is([T_CONSTANT_ENCAPSED_STRING, T_LNUMBER, T_DNUMBER])
                || ($token->id === T_STRING && in_array(strtolower($token->text), ['true', 'false', 'null'], true))) {
                $literal = true; continue;
            }
            return false;
        }
        if ($depth !== 0 || (! $literal && ($tokens[$index - 1]->text ?? '') !== ']')
            || ($tokens[$index++]->text ?? null) !== ';') return false;
        $constants++;
    }

    return $constants > 0 && ($tokens[$index++]->text ?? null) === '}' && ! isset($tokens[$index]);
}

/** @return array{int, int} */
function coverageCounts(SimpleXMLElement $metrics): array
{
    $total = (string) $metrics['statements'];
    $covered = (string) $metrics['coveredstatements'];
    if (! ctype_digit($total) || ! ctype_digit($covered)
        || (float) $total > PHP_INT_MAX || (float) $covered > (float) $total) {
        throw new RuntimeException('Invalid Clover statement counts');
    }

    return [(int) $total, (int) $covered];
}

function checkCoverage(string $report, string $root, bool $compilerOnly): int
{
    if (! is_file($report)) {
        throw new RuntimeException('PHP coverage report not found: '.$report);
    }
    $source = file_get_contents($report);
    if ($source === false || stripos($source, '<!DOCTYPE') !== false) {
        throw new RuntimeException('Invalid Clover coverage report: '.$report);
    }
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($source, SimpleXMLElement::class, LIBXML_NONET);
    if ($xml === false || ! isset($xml->project->metrics)) {
        throw new RuntimeException('Invalid Clover coverage report: '.$report);
    }
    $family = compilerCoverageSources($root);
    $requirements = [COMPILER_FACADE => 87.0, 'compiler-family' => 87.0];
    if (! $compilerOnly) {
        $requirements = ['project' => 61.0, ...$requirements,
            'src/Application/PageBuilderService.php' => 96.0,
            'src/Infrastructure/Gnuboard7/Persistence/EloquentPageBuilderRepository.php' => 91.0];
    }
    $wanted = array_fill_keys([...$family, ...array_keys($requirements)], true);
    $actual = ['project' => coverageCounts($xml->project->metrics)];
    foreach ($xml->xpath('//file') ?: [] as $file) {
        $name = str_replace('\\', '/', (string) $file['name']);
        $resolved = realpath(str_starts_with($name, '/') ? $name : $root.'/'.$name);
        $relative = is_string($resolved) && str_starts_with($resolved, $root.'/')
            ? substr($resolved, strlen($root) + 1) : $name;
        if (! isset($wanted[$relative])) {
            continue;
        }
        if (isset($actual[$relative]) || count($file->metrics) !== 1) {
            throw new RuntimeException('Duplicate or missing Clover metrics: '.$relative);
        }
        if (realpath($root.'/'.$relative) !== $root.'/'.$relative) {
            throw new RuntimeException('Redirected coverage target: '.$relative);
        }
        $actual[$relative] = coverageCounts($file->metrics);
    }
    $actual['compiler-family'] = [0, 0];
    foreach ($family as $file) {
        if (! isset($actual[$file]) || $actual[$file][0] === 0) {
            if ($file === COMPILER_FACADE || ! declarationOnlyCompilerOwner((string) file_get_contents($root.'/'.$file))) {
                throw new RuntimeException('PHP coverage target missing or empty executable owner: '.$file);
            }
            $actual[$file] = [0, 0];
            printf("PHP coverage declaration-only %-65s 0 statements (source verified)\n", $file);
        }
        $actual['compiler-family'][0] += $actual[$file][0];
        $actual['compiler-family'][1] += $actual[$file][1];
    }
    $failed = false;
    foreach ($requirements as $path => $minimum) {
        if (! isset($actual[$path])) {
            throw new RuntimeException('PHP coverage target missing: '.$path);
        }
        [$total, $covered] = $actual[$path];
        if ($total === 0) {
            throw new RuntimeException('Empty PHP coverage target: '.$path);
        }
        $percent = ($covered / $total) * 100;
        printf("PHP coverage %-82s %6.2f%% (%d/%d; minimum %.2f%%)\n", $path, $percent, $covered, $total, $minimum);
        $failed = $failed || $minimum > $percent + 0.00001;
    }

    return $failed ? 1 : 0;
}

/** @param list<string> $tests @return list<string> */
function compilerCoverageCommand(string $root, array $tests, string $report): array
{
    if ($tests === [] || count(array_unique($tests)) !== count($tests)) {
        throw new RuntimeException('Compiler coverage requires unique explicit related tests');
    }
    $command = [PHP_BINARY, '-d', 'pcov.enabled=0', 'vendor/bin/phpunit', '-c', 'phpunit.xml.dist',
        '--exclude-group', 'content-catalog', '--fail-on-empty-test-suite', '--fail-on-skipped',
        '--fail-on-incomplete', '--fail-on-risky', '--coverage-filter', 'src/Application/Compilation',
        '--coverage-clover', $report];
    foreach ($tests as $test) {
        if (! preg_match('~^tests/(UnitPhp|Integration)/[A-Za-z0-9_/]+Test\.php$~D', $test)
            || str_contains($test, '..') || realpath($root.'/'.$test) !== $root.'/'.$test || ! is_file($root.'/'.$test)) {
            throw new RuntimeException('Invalid compiler coverage test: '.$test);
        }
    }
    if (array_any($tests, fn (string $test): bool => str_starts_with($test, 'tests/Integration/'))) {
        $command = [...$command, '--bootstrap', 'tests/Integration/bootstrap.php'];
    }

    return [...$command, ...$tests];
}

/** @param list<string> $tests */
function runCompilerCoverage(string $root, array $tests): int
{
    compilerCoverageSources($root);
    // Pcov is useful locally, but is not evidence for the required Xdebug gate.
    if (! extension_loaded('xdebug') || ! function_exists('xdebug_info') || ! in_array('coverage', xdebug_info('mode'), true)) {
        throw new RuntimeException('Compiler coverage requires Xdebug with XDEBUG_MODE=coverage');
    }
    $directory = $root.'/output/coverage/compiler-'.bin2hex(random_bytes(12));
    $report = $directory.'/clover.xml';
    $command = compilerCoverageCommand($root, $tests, $report);
    if (! mkdir($directory, 0777, true)) {
        throw new RuntimeException('Cannot create unique compiler coverage evidence');
    }
    file_put_contents($directory.'/inputs.json', json_encode(['sources' => compilerCoverageSources($root), 'tests' => $tests,
        'driver' => phpversion('xdebug'), 'command' => $command], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n");
    printf("PHP_COMPILER_COVERAGE evidence=%s driver=xdebug\n", $directory);
    $process = proc_open($command, [STDIN, STDOUT, STDERR], $pipes, $root);
    if (! is_resource($process)) {
        throw new RuntimeException('Cannot start compiler coverage tests');
    }
    $code = proc_close($process);
    if ($code !== 0) {
        return $code > 0 ? $code : 1;
    }

    return checkCoverage($report, $root, true);
}

try {
    $root = dirname(__DIR__);
    $report = null;
    $mode = 'full';
    $tests = [];
    for ($index = 1; $index < $argc; $index++) {
        $argument = $argv[$index];
        if ($argument === '--root') {
            $root = realpath($argv[++$index] ?? '') ?: throw new RuntimeException('Invalid coverage root');
        } elseif (in_array($argument, ['--compiler', '--run-compiler', '--plan-compiler'], true)) {
            if ($mode !== 'full') throw new RuntimeException('Duplicate coverage mode');
            $mode = substr($argument, 2);
        } elseif ($argument === '--test') {
            $tests[] = $argv[++$index] ?? '';
        } elseif ($report === null && ! str_starts_with($argument, '-')) {
            $report = $argument;
        } else {
            throw new RuntimeException('Unknown coverage argument: '.$argument);
        }
    }
    if ($mode === 'plan-compiler') {
        echo json_encode(['sources' => compilerCoverageSources($root),
            'command' => compilerCoverageCommand($root, $tests, '<unique-report>/clover.xml')], JSON_THROW_ON_ERROR)."\n";
        exit(0);
    }
    if ($mode === 'run-compiler') exit(runCompilerCoverage($root, $tests));
    if ($tests !== []) throw new RuntimeException('Tests require --run-compiler or --plan-compiler');
    exit(checkCoverage($report ?? $root.'/output/coverage/php-clover.xml', $root, $mode === 'compiler'));
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage()."\n");
    exit(2);
}
