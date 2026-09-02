"""Exercise the real checker entrypoints; never run a product/browser fixture."""
import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]
CHECKERS = ("scripts/check-editor-acceptance-contract.mjs", "scripts/check-editor-layout-parity.mjs")
REGISTRATION = "scripts/lib/editorContractRegistration.mjs"


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
        for script in CHECKERS:
            with self.subTest(script=script):
                result = subprocess.run(["node", script], cwd=ROOT, text=True, capture_output=True)
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


if __name__ == "__main__":
    unittest.main()
