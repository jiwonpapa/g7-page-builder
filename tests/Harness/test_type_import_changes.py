"""Synthetic code changes prove the narrow browser-selection exemption."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from tools.g7pb.type_import_changes import browser_sources
from tools.g7pb.planner import build_plan
from tools.g7pb.browser_requirements import PAGE

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/lib/typeImportChanges.mjs"


class TypeImportChangeTests(unittest.TestCase):
    def classify(self, before, after, path="resources/js/editor/catalogBlocks.tsx"):
        result = subprocess.run(["node", str(SCRIPT)], input=json.dumps([
            {"path": path, "before": before, "after": after}]), capture_output=True, text=True, check=True)
        return json.loads(result.stdout)

    def test_type_import_and_export_edits_only(self):
        for before, after in (
            ("import type {A} from './a'; export const n = 1;", "import type {A} from './b'; export const n = 1;"),
            ("import {run, type A} from './a'; run();", "import {run} from './a'; import type {A} from './b'; run();"),
            ("export type {A} from './a'; export const n = 1;", "export type {A} from './b'; export const n = 1;"),
        ):
            with self.subTest(before=before):
                self.assertEqual(self.classify(before, after), ["resources/js/editor/catalogBlocks.tsx"])

    def test_runtime_syntax_comments_and_parse_errors_keep_browser(self):
        for before, after in (
            ("import {run} from './a'; run();", "import {run} from './b'; run();"),
            ("import {type A} from './a'; export {};", "import {type A} from './b'; export {};"),
            ("import './a';", "import './b';"),
            ("export const n = 1;", "export const n = 2;"),
            ("export const n = <div>A</div>;", "export const n = <div>B</div>;"),
            ("/** @jsxImportSource react */ import type {A} from './a';", "/** @jsxImportSource other */ import type {A} from './a';"),
            ("interface A {n: number};", "interface A {n: string};"),
            ("const n = 1;", "import type {A} from './a'; const n = 1;"),
            ("import type {A} from './a'; /* @__PURE__ */ first(); second();",
             "import type {A} from './b'; first(); /* @__PURE__ */ second();"),
            ("import type {A} from './a';", "import type {A from './b';"),
        ):
            with self.subTest(before=before):
                self.assertEqual(self.classify(before, after), [])

    def test_classifier_regression_cache_includes_installed_typescript_contract(self):
        plan = build_plan(ROOT, ["tests/Harness/test_type_import_changes.py"])
        gate = next(gate for gate in plan.gates if gate.name == "python:tests/Harness/test_type_import_changes.py")
        self.assertIn("package-lock.json", gate.inputs)
        self.assertIn("scripts/lib/typeImportChanges.mjs", gate.inputs)

    def test_planner_preserves_type_units_and_architecture_without_preset_sweep(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-import-scope-") as directory:
            root = Path(directory)
            source = "resources/js/editor/importScopeFixture.tsx"
            files = {
                source: "import type {A} from '../documents/types'; export const value = 1;",
                "resources/js/documents/types.ts": "export interface A { value: string }",
                "resources/js/documents/builtinBlockContracts.ts": "export interface A { value: string }",
                "tests/Unit/importScopeFixture.test.ts": "import '../../resources/js/editor/importScopeFixture';",
                PAGE.spec: "import {test} from '@playwright/test';",
            }
            for path, content in files.items():
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-qm", "base"], check=True)
            (root / source).write_text(files[source].replace("../documents/types", "../documents/builtinBlockContracts"))
            for phase in ("submission", "integration", "verification", "ci"):
                plan = build_plan(root, [source], base="HEAD", phase=phase)
                names = {gate.name for gate in plan.gates}
                self.assertFalse(plan.full)
                self.assertEqual(plan.unresolved, [])
                self.assertIn("typecheck", names)
                self.assertIn("unit:tests/Unit/importScopeFixture.test.ts", names)
                self.assertIn("architecture", names)
                self.assertFalse(any(name.startswith("browser:") for name in names))
            (root / source).write_text(files[source].replace("value = 1", "value = 2"))
            # Runtime edits must retain the fixed generic-editor PAGE contract,
            # independently of the catalog's separately tested scenario mapping.
            for phase in ("submission", "integration", "verification", "ci"):
                with self.subTest(runtime_phase=phase):
                    runtime = build_plan(root, [source], base="HEAD", phase=phase)
                    self.assertFalse(runtime.full)
                    self.assertEqual(runtime.unresolved, [])
                    browser = [gate for gate in runtime.gates if gate.name.startswith("browser:")]
                    self.assertEqual({gate.name for gate in browser}, {"browser:" + PAGE.spec})
                    for gate in browser:
                        self.assertTrue(gate.runtime)
                        self.assertEqual(gate.deferred, phase == "submission")
                    self.assertFalse(any(gate.name.startswith(("browser-registration:", "content:")) for gate in runtime.gates))
            self.assertEqual(browser_sources(root, [source], "missing-ref"), [source])
            self.assertEqual(browser_sources(root, ["resources/js/documents/types.ts"], "HEAD"), ["resources/js/documents/types.ts"])
            with patch("tools.g7pb.type_import_changes.subprocess.run", side_effect=OSError("no tool")):
                self.assertEqual(browser_sources(root, [source], "HEAD"), [source])


if __name__ == "__main__":
    unittest.main()
