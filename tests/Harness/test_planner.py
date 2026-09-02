import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from tools.g7pb.planner import build_plan, changed_paths, python_inputs


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def test_docs_have_no_product_gate(self):
        plan = build_plan(self.root, ["README.md"])
        self.assertEqual(plan.gates, [])
        self.assertEqual(plan.unresolved, [])

    def test_unknown_never_falls_back_to_full(self):
        plan = build_plan(self.root, ["unclassified.dat"])
        self.assertTrue(plan.unresolved)
        self.assertFalse(plan.full)
        self.assertFalse(plan.gates)

    def test_version_number_is_not_full(self):
        self.write("package.json", json.dumps({"version": "2", "dependencies": {"a": "1"}}))
        with patch("tools.g7pb.planner.git", return_value=json.dumps({"version": "1", "dependencies": {"a": "1"}})):
            plan = build_plan(self.root, ["package.json"])
        self.assertEqual([g.name for g in plan.gates], ["version"])
        self.assertFalse(plan.unresolved)

    def test_dependency_version_is_not_treated_as_metadata(self):
        self.write("package-lock.json", json.dumps({"version": "2", "packages": {"": {"version": "2"}, "node_modules/a": {"version": "2"}}}))
        with patch("tools.g7pb.planner.git", return_value=json.dumps({"version": "1", "packages": {"": {"version": "1"}, "node_modules/a": {"version": "1"}}})):
            plan = build_plan(self.root, ["package-lock.json"])
        self.assertTrue(plan.unresolved)
        self.assertNotIn("full-product", [g.name for g in plan.gates])

    def test_php_without_related_tests_does_not_pass(self):
        self.write("src/Domain/Example.php", "<?php class Example {}")
        plan = build_plan(self.root, ["src/Domain/Example.php"])
        self.assertTrue(any("No related test" in e for e in plan.unresolved))

    def test_related_existing_test_need_not_be_modified(self):
        self.write("resources/js/title.ts", "export const title = 1")
        self.write("tests/Unit/title.test.ts", "import {title} from '../../resources/js/title'")
        plan = build_plan(self.root, ["resources/js/title.ts"])
        self.assertFalse(plan.unresolved)
        self.assertEqual({g.name for g in plan.gates}, {"unit:tests/Unit/title.test.ts", "typecheck", "architecture"})

    def test_normative_docs_select_structure_check_not_product_full(self):
        plan = build_plan(self.root, ["AGENTS.md", "docs/development-constitution.md"])
        self.assertEqual([g.name for g in plan.gates], ["architecture"])
        self.assertFalse(plan.requirements["browser"])
        self.assertFalse(plan.full)
        self.assertTrue(any(p.endswith("config/design-architecture.json") for p in plan.gates[0].inputs))

    def test_verified_controller_checks_the_owning_worktree(self):
        self.write("resources/js/title.ts", "export const title = 1")
        self.write("tests/Unit/title.test.ts", "import '../../resources/js/title'")
        gate = next(g for g in build_plan(self.root, ["resources/js/title.ts"]).gates if g.name == "architecture")
        self.assertEqual(gate.argv[gate.argv.index("--root") + 1], str(self.root.resolve()))
        self.assertTrue(Path(gate.argv[1]).is_absolute())
        self.assertNotEqual(Path(gate.argv[1]).parent.parent, self.root)
        self.assertIn("resources/js/title.ts", gate.inputs)
        self.assertTrue(any(Path(p).is_absolute() and p.endswith("design-architecture.json") for p in gate.inputs))

    def test_guard_change_executes_candidate_guard_in_owning_worktree(self):
        plan = build_plan(self.root, ["scripts/check-design-architecture.mjs", "config/design-architecture.json"])
        gate = next(g for g in plan.gates if g.name == "architecture")
        self.assertEqual(gate.argv[:2], ("node", "scripts/check-design-architecture.mjs"))
        self.assertNotIn("--root", gate.argv)
        self.assertIn("config/design-architecture.json", gate.inputs)
        self.assertIn("design-architecture-tests", [g.name for g in plan.gates])

    def test_php_source_requires_static_analysis_and_boundaries(self):
        self.write("src/Domain/Example.php", "<?php class Example {}")
        self.write("tests/UnitPhp/ExampleTest.php", "<?php class ExampleTest {}")
        plan = build_plan(self.root, ["src/Domain/Example.php"])
        self.assertTrue({"php-lint", "phpstan:core", "architecture"}.issubset(g.name for g in plan.gates))
        static = next(g for g in plan.gates if g.name == "phpstan:core")
        self.assertEqual(static.argv[-1], "src/Domain/Example.php")
        self.assertFalse(static.runtime)

    def test_related_transitive_import_is_selected_but_source_comment_is_not(self):
        self.write("resources/js/a.ts", "export const a = 1")
        self.write("resources/js/b.ts", "export {a} from './a'")
        self.write("tests/Unit/consumer.test.ts", "import '../../resources/js/b'")
        self.write("tests/Unit/unrelated.test.ts", "// a.ts is mentioned here")
        plan = build_plan(self.root, ["resources/js/a.ts"])
        names = {g.name for g in plan.gates}
        self.assertIn("unit:tests/Unit/consumer.test.ts", names)
        self.assertNotIn("unit:tests/Unit/unrelated.test.ts", names)

    def test_python_tracks_imports_not_unrelated_sources(self):
        self.write("tools/g7pb/a.py", "from .model import Gate")
        self.write("tools/g7pb/model.py", "class Gate: pass")
        self.write("tools/g7pb/unrelated.py", "pass")
        self.write("tests/Harness/test_a.py", "from tools.g7pb.a import Gate")
        inputs = python_inputs(self.root, "tests/Harness/test_a.py")
        self.assertIn("tools/g7pb/model.py", inputs)
        self.assertNotIn("tools/g7pb/unrelated.py", inputs)
        plan = build_plan(self.root, ["tools/g7pb/a.py"])
        self.assertEqual(len([g for g in plan.gates if g.name.startswith("python:")]), 1)

    def test_harness_only_browser_change_collects_only_that_spec(self):
        plan = build_plan(self.root, ["tests/E2E/a.spec.ts"])
        self.assertEqual(len(plan.gates), 1)
        self.assertEqual(plan.gates[0].argv, ("npx", "--no-install", "playwright", "test", "tests/E2E/a.spec.ts", "--list", "--reporter=line"))
        self.assertFalse(plan.gates[0].runtime)
        self.assertFalse(plan.requirements["browser"])

    def test_browser_with_product_change_requires_runtime(self):
        plan = build_plan(self.root, ["tests/E2E/a.spec.ts", "src/Changed.php"])
        gate = next(g for g in plan.gates if g.name.startswith("browser:"))
        self.assertTrue(gate.runtime)
        self.assertIn("--retries=0", gate.argv)

    def test_mapped_controller_input_is_in_the_success_key(self):
        self.write("tests/Harness/test_planner.py", "pass")
        self.write("tests/Harness/test_runner.py", "pass")
        plan = build_plan(self.root, ["Makefile", "scripts/quality-scoped.sh"])
        for gate in plan.gates:
            if gate.name.startswith("python:"):
                self.assertIn("Makefile", gate.inputs)
                self.assertIn("scripts/quality-scoped.sh", gate.inputs)

    def test_scripts_only_change_does_not_request_product_full(self):
        self.write("package.json", json.dumps({"version": "1", "scripts": {"test": "new"}}))
        self.write("tests/Harness/test_commands.py", "pass")
        with patch("tools.g7pb.planner.git", return_value=json.dumps({"version": "1", "scripts": {"test": "old"}})):
            plan = build_plan(self.root, ["package.json"])
        self.assertFalse(plan.unresolved)
        self.assertFalse(plan.full)
        self.assertIn("python:tests/Harness/test_commands.py", [g.name for g in plan.gates])

    def test_unit_key_tracks_transitive_sources_and_disables_dynamic_reuse(self):
        self.write("tests/Unit/a.test.ts", "import '../../resources/js/a';")
        self.write("resources/js/a.ts", "import './b';")
        self.write("resources/js/b.ts", "export const b = 1;")
        gate = build_plan(self.root, ["tests/Unit/a.test.ts"]).gates[0]
        self.assertIn("resources/js/b.ts", gate.inputs)
        self.assertTrue(gate.reusable)
        self.write("resources/js/b.ts", "readFileSync(name)")
        self.assertFalse(build_plan(self.root, ["tests/Unit/a.test.ts"]).gates[0].reusable)

    def test_full_requires_explicit_request(self):
        self.assertTrue(build_plan(self.root, ["database/migrations/a.php"]).unresolved)
        plan = build_plan(self.root, ["database/migrations/a.php"], full=True)
        self.assertFalse(plan.unresolved)
        self.assertIn("full-product", [g.name for g in plan.gates])

    def test_scope_uses_specified_base_and_deduplicates(self):
        with patch("tools.g7pb.planner.git", side_effect=["b\0a\0", "a\0c\0"]) as command:
            self.assertEqual(changed_paths(self.root, "pre-merge"), ["a", "b", "c"])
            self.assertIn("pre-merge", command.call_args_list[0].args)

    def test_python_fixture_output_literals_do_not_bind_to_installed_artifacts(self):
        self.write("tools/g7pb/fake.py", "OUTPUTS = ['dist/js/app.js', 'vendor/autoload.php', 'node_modules/.package-lock.json']")
        before = python_inputs(self.root, "tools/g7pb/fake.py")
        for path in ('dist/js/app.js', 'vendor/autoload.php', 'node_modules/.package-lock.json'):
            self.write(path, "installed bytes")
        self.assertEqual(before, python_inputs(self.root, "tools/g7pb/fake.py"))

    def test_tools_path_import_alias_selects_the_existing_release_test(self):
        self.write("tools/g7pb/artifacts.py", "pass")
        self.write("tests/Harness/test_release.py", "from g7pb import artifacts")
        plan = build_plan(self.root, ["tools/g7pb/artifacts.py"])
        self.assertFalse(plan.unresolved)
        self.assertIn("python:tests/Harness/test_release.py", [gate.name for gate in plan.gates])


if __name__ == "__main__":
    unittest.main()
