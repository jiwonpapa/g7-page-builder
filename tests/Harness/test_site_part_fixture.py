"""Isolated SQLite and fake HTTP/CLI transport; never uses the shared runtime."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from tools.g7pb.runner import SITE_PART_SPECS

ROOT = Path(__file__).resolve().parents[2]
PHP_HELPER = ROOT / "tests/E2E/support/sitePartState.php"
TS_HELPER = ROOT / "tests/E2E/support/sitePartSetFixture.ts"

PHP_SETUP = r'''
require $argv[1];
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE sets (id TEXT PRIMARY KEY, title TEXT, locale TEXT, is_active INTEGER, updated_by TEXT, updated_at TEXT)');
$old = '00000000-0000-4000-8000-000000000001';
$owned = '00000000-0000-4000-8000-000000000002';
$other = '00000000-0000-4000-8000-000000000003';
$title = 'E2E-owned-11111111-1111-4111-8111-111111111111-0';
function addRow($db, $id, $title, $active) {
    $db->prepare('INSERT INTO sets VALUES (?,?,?,?,?,?)')->execute([$id, $title, 'ko', $active, '7', '2026-01-01 01:02:03']);
}
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function rejects($callback) {
    try { $callback(); } catch (RuntimeException $error) { return; }
    throw new RuntimeException('Expected rejection');
}
$read = function ($locale) use ($db) {
    $query = $db->prepare('SELECT id,title,locale,is_active,updated_by,updated_at FROM sets WHERE locale=? ORDER BY id');
    $query->execute([$locale]); return $query->fetchAll(PDO::FETCH_ASSOC);
};
$failWrite = false;
$write = function ($id, $values) use ($db, &$failWrite) {
    if ($failWrite && $values === ['is_active' => false]) throw new RuntimeException('Injected second write failure');
    $columns = implode(',', array_map(fn ($key) => $key.'=?', array_keys($values)));
    $db->prepare('UPDATE sets SET '.$columns.' WHERE id=?')->execute([...array_values($values), $id]);
};
$fixture = new SitePartFixtureState($read, $write);
$transaction = function ($callback) use ($db) {
    $db->beginTransaction();
    try { $callback(); $db->commit(); } catch (Throwable $error) { $db->rollBack(); throw $error; }
};
$register = function (&$state) use ($db, $fixture, $owned, $title) {
    $fixture->command($state, 'reserve', ['title' => $title]);
    addRow($db, $owned, $title, (int) !$db->query('SELECT count(*) FROM sets WHERE is_active=1')->fetchColumn());
    $fixture->command($state, 'register', ['id' => $owned]);
};
$activate = function (&$state, $checkpoint = true) use ($db, $fixture, $owned) {
    $fixture->command($state, 'prepare', ['id' => $owned]);
    $db->exec("UPDATE sets SET is_active=0,updated_by='9',updated_at='2026-09-02 02:03:04' WHERE is_active=1");
    $db->prepare("UPDATE sets SET is_active=1,updated_by='9',updated_at='2026-09-02 02:03:04' WHERE id=?")->execute([$owned]);
    if ($checkpoint) $fixture->command($state, 'checkpoint', []);
};
'''


class SitePartFixtureTests(unittest.TestCase):
    def php(self, body):
        result = subprocess.run(["php", "-r", PHP_SETUP + body, str(PHP_HELPER)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_php_capability_guard_matches_exact_runner_spec_registration(self):
        result = subprocess.run(["php", "-r", "require $argv[1]; echo json_encode(G7PB_SITE_PART_FIXTURE_SPECS);", str(PHP_HELPER)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), list(SITE_PART_SPECS))
        self.assertEqual(set(SITE_PART_SPECS), {"tests/E2E/globalSiteShellRoutes.spec.ts",
            "tests/E2E/sitePartLifecycle.spec.ts", "tests/E2E/pageBuilderLifecycle.spec.ts",
            "tests/E2E/siteShellProductQuality.spec.ts"})

    def test_require_is_inert_and_console_bootstrap_uses_selected_application(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "vendor").mkdir()
            (root / "bootstrap").mkdir()
            (root / "vendor/autoload.php").write_text("<?php $GLOBALS['bootstrap_order'] = ['autoload'];")
            (root / "bootstrap/app.php").write_text(r"""<?php
$GLOBALS['bootstrap_order'][] = 'application';
return new class {
    public function make($contract) {
        if ($contract !== 'Illuminate\Contracts\Console\Kernel') throw new RuntimeException('Wrong kernel contract');
        $GLOBALS['bootstrap_order'][] = 'kernel';
        return new class { public function bootstrap() { $GLOBALS['bootstrap_order'][] = 'bootstrapped'; } };
    }
};
""")
            script = r"""
require $argv[1];
if (isset($GLOBALS['bootstrap_order'])) throw new RuntimeException('require unexpectedly booted runtime');
g7pbSitePartFixtureBootstrap($argv[2]);
if ($GLOBALS['bootstrap_order'] !== ['autoload','application','kernel','bootstrapped']) throw new RuntimeException('Wrong bootstrap order');
"""
            result = subprocess.run(["php", "-r", script, str(PHP_HELPER), str(root)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_direct_cli_fails_closed_with_clear_error_outside_local_runtime(self):
        result = subprocess.run(["php", str(PHP_HELPER)], env={"PATH": os.environ['PATH']}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("G7PB_SITE_PART_FIXTURE_FAILED: Direct fixture CLI requires", result.stderr)
        self.assertNotIn("PsySH", result.stderr)

    def test_restores_original_pointer_and_audit_without_document_tables(self):
        self.php(r'''
addRow($db, $old, 'Existing opaque content', 1);
$state = $fixture->begin('ko'); $baseline = $read('ko');
$register($state); $activate($state);
$transaction(function () use (&$state, $fixture) { $fixture->command($state, 'restore', []); });
check($read('ko')[0] === $baseline[0], 'Original audit values changed');
check(!$read('ko')[1]['is_active'], 'Owned set remains active');
$fixture->command($state, 'restore', []);
''')

    def test_create_autoactivation_restores_original_no_active_state(self):
        self.php(r'''
addRow($db, $old, 'Inactive existing set', 0);
$state = $fixture->begin('ko'); $register($state);
check($state['expected'][$owned]['is_active'], 'Creation should autoactivate');
$fixture->command($state, 'restore', []);
check((int) $db->query('SELECT count(*) FROM sets WHERE is_active=1')->fetchColumn() === 0, 'No-active baseline lost');
''')

    def test_unregistered_create_is_not_adopted_by_title_prefix(self):
        self.php(r'''
$state = $fixture->begin('ko');
$fixture->command($state, 'reserve', ['title' => $title]);
addRow($db, $owned, $title, 1);
$before = $read('ko');
rejects(function () use (&$state, $fixture) { $fixture->command($state, 'restore', []); });
check($before === $read('ko'), 'Unregistered row was changed');
''')

    def test_missing_checkpoint_and_external_audit_change_both_fail_without_writes(self):
        self.php(r'''
addRow($db, $old, 'Existing', 1);
$state = $fixture->begin('ko'); $register($state); $activate($state, false);
$before = $read('ko');
rejects(function () use (&$state, $fixture) { $fixture->command($state, 'restore', []); });
check($read('ko') === $before, 'Unconfirmed activation overwritten');
$fixture->command($state, 'checkpoint', []);
$db->prepare("UPDATE sets SET updated_by='88' WHERE id=?")->execute([$old]);
$before = $read('ko');
rejects(function () use (&$state, $fixture) { $fixture->command($state, 'restore', []); });
check($read('ko') === $before, 'External audit modification overwritten');
''')

    def test_new_active_missing_owned_and_duplicate_active_are_rejected(self):
        for mutation in ("$db->exec('DELETE FROM sets WHERE id='. $db->quote($owned));",
                         "addRow($db, $other, 'External', 1);",
                         "$db->exec('UPDATE sets SET is_active=0'); addRow($db, $other, 'External', 1);"):
            with self.subTest(mutation=mutation):
                self.php(r'''
addRow($db, $old, 'Existing', 1); $state = $fixture->begin('ko'); $register($state); $activate($state);
''' + mutation + r'''
$before = $read('ko');
rejects(function () use (&$state, $fixture) { $fixture->command($state, 'restore', []); });
check($read('ko') === $before, 'Concurrent state overwritten');
''')

    def test_restore_write_failure_rolls_back_all_changes(self):
        self.php(r'''
addRow($db, $old, 'Existing', 1); $state = $fixture->begin('ko'); $register($state); $activate($state);
$before = $read('ko'); $failWrite = true;
rejects(function () use (&$state, $fixture, $transaction) { $transaction(function () use (&$state, $fixture) { $fixture->command($state, 'restore', []); }); });
check($read('ko') === $before, 'Partial restore survived failed transaction');
check(!$state['restored'], 'Failed restore marked complete');
''')

    def test_fake_api_uses_only_owned_ids_and_always_publishes_fresh_documents(self):
        script = r'''
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('typescript'), Module = require('node:module');
const calls = [], commands = [];
require('node:child_process').execFileSync = (cmd, argv, options) => {
  assert.equal(cmd, 'php');
  assert.deepEqual(argv, [path.resolve('tests/E2E/support/sitePartState.php')]);
  commands.push([options.env.G7PB_SITE_PART_FIXTURE_ACTION, JSON.parse(options.env.G7PB_SITE_PART_FIXTURE_INPUT)]);
};
process.env.G7PB_SITE_PART_FIXTURE_SCOPE = 'isolated';
process.env.G7PB_SITE_PART_FIXTURE_TOKEN = 'isolated';
const filename = process.argv[1];
const moduleFixture = new Module(filename, module);
moduleFixture.paths = Module._nodeModulePaths(process.cwd());
moduleFixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, filename);
const id = '22222222-2222-4222-8222-222222222222';
const api = {};
for (const method of ['get','post','put']) api[method] = async (url, options) => {
  calls.push({method,url,data:options?.data});
  let data;
  if (url.endsWith('/site-part-sets')) data = {id, title:options.data.title, locale:'ko'};
  else if (method === 'get') {
    assert.equal(new URL(url,'http://fixture').searchParams.get('set_id'), id);
    data = {set_id:id, lock_version:1, document:{site_part_id:id}};
  } else if (url.endsWith('/draft')) data = {header:{lock_version:2},footer:{lock_version:2}};
  else if (url.endsWith('/publish')) data = {set:{id,locale:'ko'}};
  return {ok:()=>true,status:()=>200,json:async()=>({data})};
};
(async () => {
  const fixture = new moduleFixture.exports.SitePartSetFixture(api,'ko');
  let handler;
  await fixture.start({route: async (pattern, callback) => { handler = callback; }});
  fixture.restore();
  assert.deepEqual(commands.map(x=>x[0]), ['begin','reserve','register','prepare','checkpoint','restore']);
  assert.equal(calls.filter(x=>x.url.endsWith('/publish')).length, 1);
  const saved = calls.find(x=>x.method==='put').data;
  assert.equal(saved.header.document.blocks[0].props.brand_name,'Owned fixture');
  assert.equal(saved.footer.document.blocks[0].type,'site.footer.simple-01');
  assert.equal(saved.header.document.blocks[0].slots.systemControls.length,1);
  assert.equal(calls.filter(x=>x.method==='get').length,2);
  assert.throws(()=>fixture.prepareActivation('unowned'),/unowned/);
  let continued, aborted = false;
  const route = (method, body, query = '') => ({
    request: () => ({method:()=>method, url:()=>`http://fixture/api/modules/jiwonpapa-page_builder/admin/site-parts/header${query}`, postDataJSON:()=>body}),
    continue: async options => { continued = options; }, abort: async () => { aborted = true; },
  });
  await handler(route('GET', undefined, '?set_id='+id));
  assert.equal(new URL(continued.url).searchParams.get('set_id'),id);
  continued = 'not called';
  await handler(route('PUT', {set_id:id}));
  assert.equal(continued,undefined); // Original product body is sent without rewriting.
  await assert.rejects(handler(route('PUT', {})),/unowned or implicit/);
  assert.equal(aborted,true);
  const publicResponse = (locale, query = '') => ({url:()=> 'https://fixture/public/site-shell'+query, ok:()=>true,
    json:async()=>({data:{shell:{enabled:true,locale}}})});
  await moduleFixture.exports.assertPublicShellLocale(publicResponse('en'), 'en');
  await assert.rejects(moduleFixture.exports.assertPublicShellLocale(publicResponse('ko'), 'en'));
  await assert.rejects(moduleFixture.exports.assertPublicShellLocale(publicResponse('en','?locale=ko'), 'en'));
  const failed = new moduleFixture.exports.SitePartSetFixture({...api,post:async (url,options)=>url.endsWith('/publish')
    ? {ok:()=>false,status:()=>500} : api.post(url,options)}, 'ko');
  const beforeFailure = commands.length;
  try { await assert.rejects(failed.start()); } finally { failed.restore(); }
  assert.deepEqual(commands.slice(beforeFailure).map(x=>x[0]), ['begin','reserve','register','restore']);
})().catch(error=>{console.error(error);process.exitCode=1});
'''
        result = subprocess.run(["node", "-e", script, str(TS_HELPER)], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
