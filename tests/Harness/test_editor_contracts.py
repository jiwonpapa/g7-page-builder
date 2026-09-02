"""Exercise the real checker entrypoints; never run a product/browser fixture."""
import json
import os
from pathlib import Path
import subprocess
import unittest
import tempfile


ROOT = Path(__file__).resolve().parents[2]
CHECKERS = ("scripts/check-editor-acceptance-contract.mjs", "scripts/check-editor-layout-parity.mjs")
REGISTRATION = "scripts/lib/editorContractRegistration.mjs"
CSS_SOURCES = "scripts/lib/editorCssSources.mjs"


class EditorContractTests(unittest.TestCase):
    def registration(self, source, scripts=None):
        code = ("import {validateEditorTestRegistration as registration, validateFocusedUnitCommand as unit} from './" + REGISTRATION + "';"
                "const input=JSON.parse(process.argv[1]);"
                "console.log(JSON.stringify({registration:registration(input.source,'example.spec.ts'),unit:unit(input.scripts)}));")
        result = subprocess.run(["node", "--input-type=module", "-e", code,
                                 json.dumps({"source": source, "scripts": scripts or {"test:unit": "vitest run"}})],
                                cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_current_entrypoints_agree_with_isolated_unit_command(self):
        selected = json.loads(os.environ.get("G7PB_EDITOR_CONTRACT_CHECKERS", "{}"))
        if selected and set(selected) != set(CHECKERS):
            self.fail("Planner must declare every checker; missing checkers cannot be skipped")
        for script in CHECKERS:
            with self.subTest(script=script):
                target = Path(selected.get(script, ROOT / script))
                self.assertTrue(target.is_absolute() and target.is_file(), f"Missing declared checker: {target}")
                result = subprocess.run(["node", str(target), "--root", str(ROOT)], cwd=ROOT, text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_comments_and_skipped_tests_are_not_registered_behavior(self):
        for body in ("// test('fake', async () => {});", "test.skip('fake', async () => {});", "const text = `test('fake', () => {})`;"):
            result = self.registration("import {test} from '@playwright/test';\n" + body)
            self.assertTrue(result["registration"])

    def test_valid_alias_and_helper_refactor_keep_registration(self):
        result = self.registration("import {test as scenario} from '@playwright/test';\nconst operation=()=>1;\nscenario('example', async () => {operation();});")
        self.assertEqual(result, {"registration": [], "unit": []})

    def test_hidden_preflight_fails_without_requiring_old_shell_profiles(self):
        result = self.registration("import {test} from '@playwright/test';test('case',async()=>{});",
                                   {"test:unit": "npm run check && vitest run"})
        self.assertTrue(result["unit"])

    def css_graph(self, root, entries):
        code = ("import {readCssGraph,cssPropertyValues} from './" + CSS_SOURCES + "';"
                "const args=JSON.parse(process.argv[1]);try{const graph=await readCssGraph(args.root,args.entries);"
                "console.log(JSON.stringify({...graph,values:cssPropertyValues(graph.css,'.theme','--radius')}));}"
                "catch(error){console.log(JSON.stringify({error:error.message}));}")
        result = subprocess.run(["node", "--input-type=module", "-e", code, json.dumps({"root": str(root), "entries": entries})],
                                cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_css_imports_follow_shared_file_and_read_changed_values_without_stale_cache(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-css-imports-") as directory:
            root = Path(directory)
            (root / "tokens").mkdir()
            (root / "editor.css").write_text('@import url("./tokens/theme.css"); .editor {display:block;}')
            (root / "public.css").write_text('@import "./tokens/theme.css"; .viewer {display:block;}')
            shared = root / "tokens/theme.css"
            shared.write_text('.theme {--radius:1rem;}')
            for entry in ("editor.css", "public.css"):
                graph = self.css_graph(root, [entry])
                self.assertEqual(graph["files"], [entry, "tokens/theme.css"])
                self.assertEqual(graph["values"], ["1rem"])
            shared.write_text('.theme {--radius:.75rem;}')
            self.assertEqual(self.css_graph(root, ["editor.css"])["values"], [".75rem"])
            graph = self.css_graph(root, ["editor.css", "public.css"])
            self.assertEqual(len(graph["files"]), 3)

    def test_missing_circular_remote_and_escaping_css_imports_fail(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-css-import-errors-") as directory:
            root = Path(directory) / "subject"
            root.mkdir()
            entry = root / "editor.css"
            for statement, expected in (
                ('@import "./missing.css";', "Missing CSS import"),
                ('@import "./editor.css";', "Circular CSS import"),
                ('@import "https://example.test/theme.css";', "Unsupported CSS import"),
                ('@import "../outside.css";', "CSS import escapes root")):
                with self.subTest(statement=statement):
                    (root.parent / "outside.css").write_text('.outside {}')
                    entry.write_text(statement)
                    self.assertIn(expected, self.css_graph(root, ["editor.css"])["error"])

    def test_comments_are_not_imports_and_selector_declarations_ignore_file_order(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-css-import-comments-") as directory:
            root = Path(directory)
            (root / "editor.css").write_text('/* @import "missing.css"; */ .other {--radius:wrong;} .theme {--radius:1rem;}')
            self.assertEqual(self.css_graph(root, ["editor.css"])["values"], ["1rem"])


if __name__ == "__main__":
    unittest.main()
