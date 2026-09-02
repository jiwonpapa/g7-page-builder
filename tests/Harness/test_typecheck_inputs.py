"""TypeScript input/cache regressions on tiny synthetic projects only."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from tools.g7pb.typecheck_inputs import typecheck_inputs
from tools.g7pb.model import Gate, Plan
from tools.g7pb.runner import digest_gate, execute

ROOT = Path(__file__).resolve().parents[2]


class TypecheckInputTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="g7pb-types-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.write("package.json", {"scripts": {"typecheck": "tsc --noEmit"}})
        self.write("package-lock.json", {})
        self.write("tsconfig.json", {"compilerOptions": {"strict": True, "skipLibCheck": True, "types": [], "noEmit": True},
                                    "include": ["resources/js", "tests/**/*.ts", "vite.config.ts"]})
        self.write("resources/js/example.ts", "export const value = 1;")
        self.write("tests/Unit/example.test.ts", "import {value} from '../../resources/js/example'; const checked: number = value;")
        self.write("vite.config.ts", "export default {};")

    def write(self, path, value):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps(value) if isinstance(value, dict) else value)

    def gate(self):
        graph = typecheck_inputs(self.root)
        return Gate("typecheck", ("npm", "run", "typecheck"), graph.files, "test fixture", requires=("node",), reusable=graph.reusable)

    def test_configured_tests_config_and_command_definition_are_inputs(self):
        graph = typecheck_inputs(self.root)
        self.assertTrue(graph.reusable)
        self.assertTrue({"tests/Unit/example.test.ts", "vite.config.ts", "package.json", "tsconfig.json"} <= set(graph.files))
        gate = self.gate()
        key = digest_gate(self.root, gate)
        self.write("package.json", {"scripts": {"typecheck": "tsc --noEmit --project tsconfig.json"}})
        self.assertNotEqual(digest_gate(self.root, self.gate()), key)

    def test_relative_extends_keeps_paths_relative_to_the_defining_config(self):
        self.write("config/base.json", {"include": ["../resources/js"]})
        self.write("tsconfig.json", {"extends": "./config/base.json"})
        # Parent-relative source paths are deliberately not claimed as complete
        # until the installed compiler resolves them.
        graph = typecheck_inputs(self.root)
        self.assertIn("config/base.json", graph.files)
        self.assertFalse(graph.reusable)

    def test_unknown_alias_resolution_or_command_disables_only_reuse(self):
        for command in ("node custom-check.mjs", "tsc --build", "tsc --noEmit && echo extra"):
            self.write("package.json", {"scripts": {"typecheck": command}})
            self.assertFalse(typecheck_inputs(self.root).reusable)
        self.write("package.json", {"scripts": {"typecheck": "tsc --noEmit"}})
        self.write("tsconfig.json", {"extends": "external-tsconfig/base"})
        self.assertFalse(typecheck_inputs(self.root).reusable)

    def test_real_compiler_cache_rejects_new_test_type_error_and_reuses_unchanged_success(self):
        (self.root / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
        receipts = self.root / "receipts"
        def run(argv, **kwargs):
            return subprocess.run(argv, **kwargs, capture_output=True, text=True)
        def check():
            gate = self.gate()
            self.assertTrue(gate.reusable)
            return execute(self.root, Plan([], [gate]), receipts=receipts, executor=run)
        self.assertEqual(check()[1][0]["status"], "passed")
        self.assertEqual(check()[1][0]["status"], "reused")
        self.write("tests/Unit/example.test.ts", "import {value} from '../../resources/js/example'; const checked: string = value;")
        code, records = check()
        self.assertEqual(code, 2)
        self.assertEqual(records[0]["status"], "failed")


if __name__ == "__main__":
    unittest.main()
