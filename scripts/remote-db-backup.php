<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;

if ($argc !== 3) {
    fwrite(STDERR, "Usage: remote-db-backup.php APP_ROOT DESTINATION\n");
    exit(2);
}

$appRoot = realpath($argv[1]);
$destination = $argv[2];

if ($appRoot === false || ! is_file($appRoot.'/artisan')) {
    fwrite(STDERR, "Invalid application root.\n");
    exit(2);
}

$destinationDirectory = realpath(dirname($destination));
if ($destinationDirectory === false || ! str_starts_with($destinationDirectory, '/home/g7devops/deploy-backups/')) {
    fwrite(STDERR, "Invalid backup destination.\n");
    exit(2);
}

require $appRoot.'/vendor/autoload.php';
$app = require $appRoot.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$connectionName = (string) config('database.default');
$connection = config('database.connections.'.$connectionName);
if (! is_array($connection) || ($connection['driver'] ?? null) !== 'mysql') {
    fwrite(STDERR, "Only MySQL-compatible staging databases are supported.\n");
    exit(2);
}

// Laravel read/write connections keep credentials under the selected side.
// Backups must follow the write connection because it is the migration source
// of truth. Top-level options (charset, socket, etc.) remain available.
$writeConnection = $connection['write'] ?? null;
if (is_array($writeConnection)) {
    $connection = array_replace($connection, $writeConnection);
}

$database = (string) ($connection['database'] ?? '');
$username = (string) ($connection['username'] ?? '');
$password = (string) ($connection['password'] ?? '');
$configuredHost = $connection['host'] ?? '127.0.0.1';
$host = is_array($configuredHost)
    ? (string) ($configuredHost[0] ?? '127.0.0.1')
    : (string) $configuredHost;
$port = (string) ($connection['port'] ?? '3306');

if ($database === '' || $username === '') {
    fwrite(STDERR, "Database configuration is incomplete.\n");
    exit(2);
}

$command = [
    '/usr/bin/mysqldump',
    '--single-transaction',
    '--quick',
    '--skip-lock-tables',
    '--default-character-set=utf8mb4',
    '--host='.$host,
    '--port='.$port,
    '--user='.$username,
    $database,
];
$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['file', $destination, 'wb'],
    2 => ['pipe', 'w'],
];
$process = proc_open($command, $descriptors, $pipes, $appRoot, [
    'HOME' => '/home/g7devops',
    'MYSQL_PWD' => $password,
    'PATH' => '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
]);

if (! is_resource($process)) {
    fwrite(STDERR, "Could not start mysqldump.\n");
    exit(1);
}

fclose($pipes[0]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[2]);
$exitCode = proc_close($process);

if ($exitCode !== 0 || ! is_file($destination) || filesize($destination) === 0) {
    @unlink($destination);
    fwrite(STDERR, 'Database backup failed: '.trim((string) $stderr)."\n");
    exit(1);
}

chmod($destination, 0600);
printf("Database backup created: %s bytes\n", filesize($destination));
