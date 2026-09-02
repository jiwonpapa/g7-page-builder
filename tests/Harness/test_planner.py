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
        self.assertEqual({g.name for g in plan.gates}, {"unit:tests/Unit/title.test.ts", "typecheck"})

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

    def test_browser_change_selects_only_that_spec(self):
        plan = build_plan(self.root, ["tests/E2E/a.spec.ts"])
        self.assertEqual(len(plan.gates), 1)
        self.assertEqual(plan.gates[0].argv, ("npx", "playwright", "test", "tests/E2E/a.spec.ts", "--retries=0"))

    def test_full_requires_explicit_request(self):
        self.assertTrue(build_plan(self.root, ["database/migrations/a.php"]).unresolved)
        plan = build_plan(self.root, ["database/migrations/a.php"], full=True)
        self.assertFalse(plan.unresolved)
        self.assertIn("full-product", [g.name for g in plan.gates])

    def test_scope_uses_specified_base_and_deduplicates(self):
        with patch("tools.g7pb.planner.git", side_effect=["b\0a\0", "a\0c\0"]) as command:
            self.assertEqual(changed_paths(self.root, "pre-merge"), ["a", "b", "c"])
            self.assertIn("pre-merge", command.call_args_list[0].args)


if __name__ == "__main__":
    unittest.main()
