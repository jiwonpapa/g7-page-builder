<?php

/** Read-only leased test-runtime fingerprint. Never emits database values or secrets. */
declare(strict_types=1);
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

/** Same full-row multiset digest, bounded by resources rather than row count.
 * No table or row is omitted. Budget failure makes reuse unavailable.
 * The optional resource sampler exists only for deterministic harness tests.
 */
function runtimeDatabaseFingerprint(array $tables, callable $readRows, ?callable $resources = null): string
{
    $resources ??= static fn (): array => [hrtime(true), memory_get_usage(true)];
    [$start, $memory] = $resources();
    $check = static function () use ($resources, $start, $memory): void {
        [$now, $used] = $resources();
        if ($now - $start > 25000000000) {
            throw new RuntimeException('Runtime snapshot time budget exceeded; reuse unavailable.');
        }
        if ($used - $memory > 64 * 1024 * 1024) {
            throw new RuntimeException('Runtime snapshot memory budget exceeded; reuse unavailable.');
        }
    };
    sort($tables, SORT_STRING);
    $state = hash_init('sha256');
    $count = 0;
    foreach ($tables as $table) {
        $check();
        if (! is_string($table) || ! preg_match('/^[A-Za-z0-9_]+$/D', $table)) {
            throw new RuntimeException('Unexpected runtime table identifier.');
        }
        $rows = [];
        foreach ($readRows($table) as $row) {
            if (++$count % 1024 === 0) {
                $check();
            }
            ksort($row);
            $rows[] = hash('sha256', serialize($row));
        }
        $check();
        sort($rows, SORT_STRING);
        hash_update($state, $table."\0");
        // Streaming the sorted hashes preserves the previous digest exactly,
        // without constructing a second concatenated copy of a large table.
        foreach ($rows as $rowHash) {
            hash_update($state, $rowHash);
        }
        unset($rows);
    }
    $check();
    return hash_final($state);
}

// Including the pure fingerprint in a harness must never bootstrap G7 or query DB.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) {
    return;
}

$root = getenv('G7PB_G7_ROOT') ?: '/var/www/g7';
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$pdo = DB::connection()->getPdo();
if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'mysql') {
    throw new RuntimeException('Runtime proof requires the supported MySQL fixture.');
}
$pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
$pdo->beginTransaction();
try {
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $state = runtimeDatabaseFingerprint($tables, static function (string $table) use ($pdo): iterable {
        $query = $pdo->query('SELECT * FROM `'.$table.'`');
        try {
            while ($row = $query->fetch(PDO::FETCH_ASSOC)) {
                yield $row;
            }
        } finally {
            $query->closeCursor();
        }
    });
    $pdo->rollBack();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $error;
}
$files = [];
foreach (['app', 'bootstrap', 'config', 'routes', 'resources', 'templates', 'plugins', 'modules'] as $folder) {
    if (! is_dir($root.'/'.$folder)) {
        continue;
    }
    $filter = new RecursiveCallbackFilterIterator(new RecursiveDirectoryIterator($root.'/'.$folder, FilesystemIterator::SKIP_DOTS),
        static fn (SplFileInfo $file): bool => ! in_array($file->getFilename(), ['.git', '.runtime', 'node_modules', 'vendor', 'storage', 'jiwonpapa-page_builder'], true) && ! $file->isLink());
    foreach (new RecursiveIteratorIterator($filter) as $file) {
        if ($file->isFile() && in_array($file->getExtension(), ['php', 'json', 'js', 'css', 'vue', 'ts'], true)) {
            $files[] = $file->getPathname();
        }
    }
}
foreach (['.env', 'composer.lock'] as $name) {
    if (is_file($root.'/'.$name)) {
        $files[] = $root.'/'.$name;
    }
}
sort($files, SORT_STRING);
$environment = hash_init('sha256');
hash_update($environment, PHP_VERSION);
foreach ($files as $file) {
    hash_update($environment, substr($file, strlen($root))."\0".hash_file('sha256', $file));
}
echo json_encode(['database' => $state, 'application' => hash_final($environment)], JSON_THROW_ON_ERROR)."\n";
