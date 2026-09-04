<?php

declare(strict_types=1);

const G7PB_SITE_PART_FIXTURE_SPECS = [
    'tests/E2E/globalSiteShellRoutes.spec.ts',
    'tests/E2E/sitePartLifecycle.spec.ts',
    'tests/E2E/pageBuilderLifecycle.spec.ts',
    'tests/E2E/siteShellProductQuality.spec.ts',
];

/** Test-owned pointer journal. Readers/writers never access document JSON or revisions. */
final class SitePartFixtureState
{
    public function __construct(private Closure $read, private Closure $write) {}

    private function rows(string $locale): array
    {
        $rows = ($this->read)($locale);
        $result = [];
        $active = 0;
        foreach ($rows as $row) {
            $row = (array) $row;
            $row['is_active'] = (bool) $row['is_active'];
            $row['updated_by'] = $row['updated_by'] === null ? null : (string) $row['updated_by'];
            $result[$row['id']] = $row;
            $active += (int) $row['is_active'];
        }
        if ($active > 1) throw new RuntimeException('Multiple active sets; no restoration attempted.');
        ksort($result);
        return $result;
    }

    private function unchanged(array $expected, array $actual): void
    {
        if ($expected !== $actual) throw new RuntimeException('Site Part pointer/audit CAS mismatch; journal retained.');
    }

    public function begin(string $locale): array
    {
        if (!preg_match('/^[a-z]{2}(?:[-_][A-Za-z]{2})?$/D', $locale)) throw new InvalidArgumentException('Invalid fixture locale.');
        $rows = $this->rows($locale);
        return ['locale' => $locale, 'baseline' => $rows, 'expected' => $rows, 'owned' => [], 'pending_create' => null, 'activation' => null, 'restored' => false];
    }

    public function command(array &$state, string $action, array $input): void
    {
        if ($state['restored']) {
            if ($action === 'restore') return;
            throw new RuntimeException('Fixture session already restored.');
        }
        $rows = $this->rows($state['locale']);
        if ($action === 'checkpoint') {
            $target = $state['activation'];
            if (!is_string($target) || !isset($state['owned'][$target])) throw new RuntimeException('No owned activation intent.');
            $before = $state['expected'];
            if (array_keys($before) !== array_keys($rows) || !$rows[$target]['is_active']) throw new RuntimeException('Activation did not select the owned set.');
            foreach ($before as $id => $row) {
                if ($row['is_active'] || $id === $target) {
                    $row['is_active'] = $id === $target;
                    $row['updated_by'] = $rows[$target]['updated_by'];
                    $row['updated_at'] = $rows[$target]['updated_at'];
                }
                $this->unchanged($row, $rows[$id]);
            }
            $state['expected'] = $rows;
            $state['activation'] = null;
            return;
        }
        if ($action === 'register') {
            $id = $input['id'] ?? '';
            if (!preg_match('/^[a-f0-9-]{36}$/D', $id) || isset($state['expected'][$id]) || !isset($rows[$id])) throw new RuntimeException('API-created UUID is not a new set.');
            if (!is_string($state['pending_create']) || $rows[$id]['title'] !== $state['pending_create']) throw new RuntimeException('API-created UUID does not match the reserved fixture title.');
            $new = $rows[$id];
            unset($rows[$id]);
            $this->unchanged($state['expected'], $rows);
            // Creation may activate its own new set only when no active set existed.
            $hadActive = array_filter($rows, fn ($row) => $row['is_active']);
            if ($new['is_active'] !== !$hadActive) throw new RuntimeException('Unexpected create activation state.');
            $state['owned'][$id] = $new;
            $rows[$id] = $new;
            ksort($rows);
            $state['expected'] = $rows;
            $state['pending_create'] = null;
            return;
        }
        $this->unchanged($state['expected'], $rows);
        if ($action === 'reserve') {
            if ($state['pending_create'] !== null || $state['activation'] !== null) throw new RuntimeException('Unfinished fixture operation.');
            $title = $input['title'] ?? '';
            if (!preg_match('/^E2E-owned-[a-f0-9-]{36}-[0-9]+$/D', $title)) throw new RuntimeException('Invalid reserved title.');
            $state['pending_create'] = $title;
        } elseif ($action === 'prepare') {
            $id = $input['id'] ?? '';
            if (!isset($state['owned'][$id]) || $state['pending_create'] !== null || $state['activation'] !== null) throw new RuntimeException('Activation requires an idle owned set.');
            $state['activation'] = $id;
        } elseif ($action === 'restore') {
            // An unfinished API operation is safe only if the metadata stayed
            // exactly at its previous checkpoint. Never infer ownership by prefix.
            foreach ($state['baseline'] as $id => $row) {
                if ($row['is_active']) ($this->write)($id, ['is_active' => true, 'updated_by' => $row['updated_by'], 'updated_at' => $row['updated_at']]);
            }
            foreach ($state['owned'] as $id => $row) {
                ($this->write)($id, ['is_active' => false]);
            }
            $state['restored'] = true;
        } else {
            throw new InvalidArgumentException('Unknown fixture action.');
        }
    }
}

/** Called only by the leased Local runner / its browser child after G7 bootstrap. */
function g7pbSitePartFixtureCommand(): void
{
    $module = realpath(dirname(__DIR__, 3));
    $relative = getenv('G7PB_SITE_PART_FIXTURE_SCOPE') ?: '';
    $token = getenv('G7PB_SITE_PART_FIXTURE_TOKEN') ?: '';
    $action = getenv('G7PB_SITE_PART_FIXTURE_ACTION') ?: '';
    $payload = json_decode(getenv('G7PB_SITE_PART_FIXTURE_INPUT') ?: '{}', true, 512, JSON_THROW_ON_ERROR);
    $path = realpath($module.'/'.$relative);
    if (!app()->environment('local') || gethostname() !== 'g7pb-dev'
        || !preg_match('#^output/playwright/gates/[a-zA-Z0-9._-]+/[a-f0-9]{64}/[a-f0-9]{32}/site-part-state.json$#D', $relative)
        || !$path || !str_starts_with($path, $module.'/output/playwright/gates/') || strlen($token) !== 64) {
        throw new RuntimeException('Site Part fixture requires a scoped Local runtime capability.');
    }
    $stream = fopen($path.'.lock', 'c');
    if (!$stream || !flock($stream, LOCK_EX)) throw new RuntimeException('Cannot lock fixture journal.');
    try {
        $journal = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!hash_equals($journal['token_hash'] ?? '', hash('sha256', $token)) || ($journal['closed'] ?? true)
            || !in_array($journal['spec'] ?? '', G7PB_SITE_PART_FIXTURE_SPECS, true)) {
            throw new RuntimeException('Invalid or closed fixture capability.');
        }
        $session = $payload['session'] ?? '';
        if ($action !== 'restore-all' && !preg_match('/^[a-f0-9-]{36}$/D', $session)) throw new RuntimeException('Invalid fixture session.');
        $updated = $journal;
        try {
            \Illuminate\Support\Facades\DB::transaction(function () use (&$updated, $session, $action, $payload): void {
                $state = new SitePartFixtureState(
                    fn ($locale) => \Illuminate\Support\Facades\DB::table('g7pb_site_part_sets')->where('locale', $locale)->orderBy('id')->lockForUpdate()
                        ->get(['id', 'title', 'locale', 'is_active', 'updated_by', 'updated_at'])->all(),
                    fn ($id, $values) => \Illuminate\Support\Facades\DB::table('g7pb_site_part_sets')->where('id', $id)->update($values),
                );
                if ($action === 'begin') {
                    foreach ($updated['sessions'] as $item) if (!$item['restored']) throw new RuntimeException('Another fixture session is still active.');
                    if (isset($updated['sessions'][$session])) throw new RuntimeException('Fixture session already exists.');
                    $updated['sessions'][$session] = $state->begin($payload['locale'] ?? '');
                } elseif ($action === 'restore-all') {
                    foreach ($updated['sessions'] as &$item) $state->command($item, 'restore', []);
                    $updated['closed'] = true;
                } else {
                    if (!isset($updated['sessions'][$session])) throw new RuntimeException('Unknown fixture session.');
                    $state->command($updated['sessions'][$session], $action, $payload);
                }
            });
            $journal = $updated;
        } catch (Throwable $error) {
            $journal['errors'][] = ['action' => $action, 'session' => $session, 'message' => $error->getMessage()];
            throw $error;
        } finally {
            $encoded = json_encode($journal, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n";
            $staged = $path.'.'.bin2hex(random_bytes(12)).'.tmp';
            $output = fopen($staged, 'x');
            if (!$output) throw new RuntimeException('Cannot stage fixture journal; previous journal retained.');
            try {
                if (fwrite($output, $encoded) !== strlen($encoded) || !fflush($output) || !fsync($output)) throw new RuntimeException('Cannot persist fixture journal; previous journal retained.');
            } finally { fclose($output); }
            if (!rename($staged, $path)) throw new RuntimeException('Cannot replace fixture journal; previous journal retained.');
        }
    } finally {
        flock($stream, LOCK_UN);
        fclose($stream);
    }
}


/** Boot the real console application without the interactive Tinker/PsySH layer. */
function g7pbSitePartFixtureBootstrap(string $g7Root): void
{
    if (!defined('LARAVEL_START')) define('LARAVEL_START', microtime(true));
    require $g7Root.'/vendor/autoload.php';
    $app = require $g7Root.'/bootstrap/app.php';
    // G7 CoreServiceProvider registers extension autoload during this bootstrap.
    $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
}

// Requiring this file exposes the state machine to isolated tests only. Direct
// execution keeps the same Local capability checks as every fixture command.
if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        $g7Root = getenv('G7PB_G7_ROOT') ?: '/var/www/g7';
        if (gethostname() !== 'g7pb-dev' || realpath($g7Root) !== '/var/www/g7'
            || !getenv('G7PB_SITE_PART_FIXTURE_SCOPE') || !getenv('G7PB_SITE_PART_FIXTURE_TOKEN')) {
            throw new RuntimeException('Direct fixture CLI requires a scoped Local G7 runtime.');
        }
        g7pbSitePartFixtureBootstrap($g7Root);
        g7pbSitePartFixtureCommand();
    } catch (Throwable $error) {
        fwrite(STDERR, 'G7PB_SITE_PART_FIXTURE_FAILED: '.$error->getMessage().PHP_EOL);
        exit(1);
    }
}
