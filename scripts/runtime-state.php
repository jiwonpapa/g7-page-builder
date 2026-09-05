<?php
/** Read-only leased test-runtime fingerprint. Never emits database values or secrets. */
declare(strict_types=1);
$root = getenv('G7PB_G7_ROOT') ?: '/var/www/g7';
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$pdo = Illuminate\Support\Facades\DB::connection()->getPdo();
if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'mysql') throw new RuntimeException('Runtime proof requires the supported MySQL fixture.');
$pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
$pdo->beginTransaction();
try {
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    sort($tables, SORT_STRING);
    $state = hash_init('sha256');
    $count = 0;
    foreach ($tables as $table) {
        if (!preg_match('/^[A-Za-z0-9_]+$/D', $table)) throw new RuntimeException('Unexpected runtime table identifier.');
        $rows = [];
        $query = $pdo->query('SELECT * FROM `'.$table.'`');
        while ($row = $query->fetch(PDO::FETCH_ASSOC)) {
            if (++$count > 200000) throw new RuntimeException('Runtime snapshot row budget exceeded; reuse unavailable.');
            ksort($row);
            $rows[] = hash('sha256', serialize($row));
        }
        sort($rows, SORT_STRING);
        hash_update($state, $table."\0".implode('', $rows));
    }
    $pdo->rollBack();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $error;
}
$files = [];
foreach (['app', 'bootstrap', 'config', 'routes', 'resources', 'templates', 'plugins', 'modules'] as $folder) {
    if (!is_dir($root.'/'.$folder)) continue;
    $filter = new RecursiveCallbackFilterIterator(new RecursiveDirectoryIterator($root.'/'.$folder, FilesystemIterator::SKIP_DOTS),
        static fn (SplFileInfo $file): bool => !in_array($file->getFilename(), ['.git', '.runtime', 'node_modules', 'vendor', 'storage', 'jiwonpapa-page_builder'], true) && !$file->isLink());
    foreach (new RecursiveIteratorIterator($filter) as $file) {
        if ($file->isFile() && in_array($file->getExtension(), ['php', 'json', 'js', 'css', 'vue', 'ts'], true)) $files[] = $file->getPathname();
    }
}
foreach (['.env', 'composer.lock'] as $name) if (is_file($root.'/'.$name)) $files[] = $root.'/'.$name;
sort($files, SORT_STRING);
$environment = hash_init('sha256');
hash_update($environment, PHP_VERSION);
foreach ($files as $file) hash_update($environment, substr($file, strlen($root))."\0".hash_file('sha256', $file));
echo json_encode(['database' => hash_final($state), 'application' => hash_final($environment)], JSON_THROW_ON_ERROR)."\n";
