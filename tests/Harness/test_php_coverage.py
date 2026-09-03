"""Synthetic Clover/command contracts only; never executes product tests."""
from pathlib import Path
import json
import subprocess
import tempfile
import unittest
from xml.sax.saxutils import quoteattr


ROOT = Path(__file__).resolve().parents[2]
CHECKER = "scripts/check-php-coverage.php"
FACADE = "src/Application/Compilation/HtmlDocumentCompiler.php"
OWNER = "src/Application/Compilation/HtmlDocument/FixtureRenderer.php"
SERVICE = "src/Application/PageBuilderService.php"
REPOSITORY = "src/Infrastructure/Gnuboard7/Persistence/EloquentPageBuilderRepository.php"


class PhpCoverageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="g7pb-php-coverage-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write(CHECKER, (ROOT / CHECKER).read_text())
        self.write(FACADE, "<?php final class Compiler {}")
        self.write(SERVICE, "<?php final class Service {}")
        self.write(REPOSITORY, "<?php final class Repository {}")

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        return target

    def report(self, rows=None, project=(100, 100)):
        rows = rows or [(FACADE, 100, 100), (SERVICE, 100, 96), (REPOSITORY, 100, 91)]
        metrics = lambda total, covered: f'<metrics statements="{total}" coveredstatements="{covered}"/>'
        xml = '<coverage><project>' + metrics(*project)
        xml += ''.join(f'<file name={quoteattr(str(self.root / name))}>{metrics(total, covered)}</file>'
                       for name, total, covered in rows)
        return self.write("clover.xml", xml + '</project></coverage>')

    def check(self, *args):
        return subprocess.run(["php", str(self.root / CHECKER), str(self.root / "clover.xml"), *args],
                              text=True, capture_output=True, cwd=self.root)

    def test_family_rejects_missing_extracted_owner(self):
        self.write(OWNER, "<?php final class FixtureRenderer {}")
        self.report()
        result = self.check()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(OWNER, result.stderr)

    def test_family_uses_weighted_statements_not_facade_or_percentage_average(self):
        self.write(OWNER, "<?php final class FixtureRenderer {}")
        self.report([(FACADE, 10, 10), (OWNER, 90, 0), (SERVICE, 100, 96), (REPOSITORY, 100, 91)])
        result = self.check()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("compiler-family", result.stdout)

    def test_facade_and_family_must_independently_meet_eighty_seven(self):
        self.write(OWNER, "<?php final class FixtureRenderer { function run() { return 1; } }")
        for facade, owner, expected in [(87, 87, 0), (86, 100, 1), (100, 73, 1)]:
            with self.subTest(facade=facade, owner=owner):
                self.report([(FACADE, 100, facade), (OWNER, 100, owner)])
                result = self.check("--compiler")
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        self.report([(FACADE, 100, 87), (OWNER, 900, 783)])
        result = self.check("--compiler")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("870/1000", result.stdout)

    def test_default_full_policy_preserves_other_targets(self):
        self.report()
        self.assertEqual(self.check().returncode, 0)
        for rows, project in [([(FACADE, 100, 100), (SERVICE, 100, 95), (REPOSITORY, 100, 91)], (100, 100)),
                              ([(FACADE, 100, 100), (SERVICE, 100, 96), (REPOSITORY, 100, 90)], (100, 100)),
                              ([(FACADE, 100, 100), (SERVICE, 100, 96), (REPOSITORY, 100, 91)], (100, 60))]:
            self.report(rows, project)
            self.assertNotEqual(self.check().returncode, 0)
            self.assertEqual(self.check("--compiler").returncode, 0)
        makefile = (ROOT / "Makefile").read_text()
        full = makefile.split("quality-php-coverage:", 1)[1].split("\n\n", 1)[0]
        self.assertIn("tests/UnitPhp tests/Integration --coverage-clover", full)
        self.assertNotIn("--exclude-group", full)
        self.assertIn("XDEBUG_MODE=coverage", full)

    def test_rejects_duplicate_malformed_zero_or_forged_target(self):
        for rows in [[(FACADE, 100, 87), (FACADE, 100, 100)], [(FACADE, 0, 0)],
                     [(FACADE, "missing", 0)], [(FACADE, 100, 101)], [(FACADE, 100, -1)],
                     [("copy/" + FACADE, 100, 100)]]:
            with self.subTest(rows=rows):
                self.report(rows)
                self.assertNotEqual(self.check("--compiler").returncode, 0)
        self.write("clover.xml", "<!DOCTYPE coverage><coverage><project><metrics statements='1' coveredstatements='1'/></project></coverage>")
        self.assertNotEqual(self.check().returncode, 0)

    def test_only_proven_constant_declarations_may_be_empty_or_absent_from_clover(self):
        constant = "<?php declare(strict_types=1); namespace Fixture; final class Types { public const array TYPES = ['a' => 'b', 'nested' => [true, 2]]; }"
        self.write(OWNER, constant)
        for rows in [[(FACADE, 100, 100)], [(FACADE, 100, 100), (OWNER, 0, 0)]]:
            self.report(rows)
            result = self.check("--compiler")
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("declaration-only", result.stdout)
            self.assertIn("source verified", result.stdout)
        invalid = [constant + " echo 1;", constant.replace("public const", "public function run() { return 1; } public const"),
                   "<?php // final class Fake { const X = 1; }\n echo 1;",
                   "<?php final class Fake { public const X = 'safe'; public $value = 1; }",
                   "<?php final class Fake { use HiddenTrait; const X = 1; }",
                   "<?php final class Fake extends HiddenParent { const X = 1; }",
                   "<?php final class Fake { const X = Hidden::VALUE; }"]
        for source in invalid:
            with self.subTest(source=source):
                self.write(OWNER, source)
                self.report([(FACADE, 100, 100), (OWNER, 0, 0)])
                self.assertNotEqual(self.check("--compiler").returncode, 0)

    def test_source_inventory_rejects_linked_file_and_directory(self):
        self.report()
        outside = self.write("outside/Hidden.php", "<?php function hidden() { return 1; }")
        for directory in (False, True):
            path = self.root / (OWNER if not directory else "src/Application/Compilation/HtmlDocument/linked")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.symlink_to(outside.parent if directory else outside, target_is_directory=directory)
            result = self.check()
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertIn("Linked compiler", result.stderr)
            path.unlink()  # Only this test's own TemporaryDirectory fixture.

    def test_read_only_run_plan_uses_explicit_tests_xdebug_mode_and_unique_output_placeholder(self):
        test = "tests/UnitPhp/ExampleTest.php"
        self.write(test, "<?php final class ExampleTest {}")
        command = ["php", str(self.root / CHECKER), "--plan-compiler", "--test", test]
        result = subprocess.run(command, capture_output=True, text=True, cwd=self.root)
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)
        self.assertEqual(plan["sources"], [FACADE])
        self.assertEqual(plan["command"][1:], ['-d', 'pcov.enabled=0', 'vendor/bin/phpunit', '-c', 'phpunit.xml.dist',
            '--exclude-group', 'content-catalog', '--fail-on-empty-test-suite', '--fail-on-skipped',
            '--fail-on-incomplete', '--fail-on-risky', '--coverage-filter', 'src/Application/Compilation',
            '--coverage-clover', '<unique-report>/clover.xml', test])
        integration = "tests/Integration/Gnuboard7/FixtureTest.php"
        self.write(integration, "<?php final class FixtureTest {}")
        result = subprocess.run(command + ['--test', integration], capture_output=True, text=True, cwd=self.root)
        self.assertIn('--bootstrap', json.loads(result.stdout)['command'])
        for invalid in ['../secret.php', test + ';exit', 'tests/UnitPhp/AbsentTest.php']:
            result = subprocess.run(command + ['--test', invalid], capture_output=True, text=True, cwd=self.root)
            self.assertNotEqual(result.returncode, 0)
        result = subprocess.run(command + ['--test', test], capture_output=True, text=True, cwd=self.root)
        self.assertNotEqual(result.returncode, 0)

    def test_run_without_xdebug_cannot_accept_an_existing_report(self):
        # -n guarantees no extension driver, regardless of developer PHP config.
        self.report()
        test = "tests/UnitPhp/ExampleTest.php"
        self.write(test, "<?php final class ExampleTest {}")
        result = subprocess.run(['php', '-n', str(self.root / CHECKER), '--run-compiler', '--test', test],
                                capture_output=True, text=True, cwd=self.root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('requires Xdebug', result.stderr)
        self.assertFalse((self.root / 'output').exists())

    def test_ci_prepares_xdebug_only_for_the_selected_compiler_gate(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text()
        self.assertIn("coverage = any(gate['name'] == 'php-compiler-coverage' for gate in plan['gates'])", workflow)
        self.assertIn("coverage: ${{ steps.plan.outputs.compiler_coverage == 'true' && 'xdebug' || 'none' }}", workflow)
        self.assertIn("if: steps.plan.outputs.browser == 'true'", workflow)
        self.assertNotIn('coverage: pcov', workflow)

    def test_preset_group_marks_only_the_existing_sweep_without_changing_its_body(self):
        source = (ROOT / 'tests/UnitPhp/HtmlDocumentCompilerTest.php').read_text()
        self.assertEqual(source.count("#[Group('content-catalog')]"), 1)
        self.assertIn("#[Group('content-catalog')]\n    public function test_all_builtin_presets_compile_as_typed_documents()", source)
        self.assertIn("self::assertCount(95, $manifest['presets']);", source)
        self.assertIn("foreach (array_values($manifest['presets']) as $index => $preset)", source)


if __name__ == "__main__":
    unittest.main()
