"""Input selection only; no npm, PHP, browser, build or deployment."""
import json
from pathlib import Path
import tempfile
import unittest
from tools.g7pb.inputs import source_inputs


class InputTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="g7pb-inputs-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)

    def write(self, name, source):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)

    def test_transitive_imports_json_and_cycles_exclude_unrelated_files(self):
        self.write("test.ts", "import { a } from './a'; import './facts.json';")
        self.write("a.ts", "export { b } from './nested';")
        self.write("nested/index.tsx", "import '../a';")
        self.write("facts.json", "{}")
        self.write("unrelated.ts", "throw new Error()")
        graph = source_inputs(self.root, "test.ts")
        self.assertTrue(graph.reusable)
        self.assertEqual(graph.files, ("a.ts", "facts.json", "nested/index.tsx", "test.ts"))

    def test_static_dynamic_import_and_js_typescript_resolution(self):
        self.write("test.ts", "const a = import('./a.js');")
        self.write("a.ts", "export const value = 1;")
        self.assertEqual(source_inputs(self.root, "test.ts").files, ("a.ts", "test.ts"))

    def test_unknown_dynamic_io_or_alias_disables_only_receipt_reuse(self):
        for source in ["import(name)", "readFileSync(path)", "import a from '@/a';"]:
            self.write("test.ts", source)
            graph = source_inputs(self.root, "test.ts")
            self.assertFalse(graph.reusable)
            self.assertEqual(graph.files, ("test.ts",))

    def test_missing_import_is_recorded_without_broad_fallback(self):
        self.write("test.ts", "import './deleted';")
        graph = source_inputs(self.root, "test.ts")
        self.assertEqual(graph.files, ("deleted", "test.ts"))
        self.assertFalse(graph.reusable)

    def test_external_package_is_not_treated_as_local_directory(self):
        self.write("test.ts", "import { test } from 'vitest';")
        self.assertTrue(source_inputs(self.root, "test.ts").reusable)

    def test_php_psr4_transitive_imports(self):
        self.write("composer.json", json.dumps({"autoload": {"psr-4": {"Project\\": "src/"}}}))
        self.write("test.php", "<?php use Project\\A;")
        self.write("src/A.php", "<?php use Project\\B;")
        self.write("src/B.php", "<?php final class B {}")
        graph = source_inputs(self.root, "test.php")
        self.assertTrue(graph.reusable)
        self.assertEqual(graph.files, ("composer.json", "src/A.php", "src/B.php", "test.php"))

    def test_php_dynamic_data_never_reuses_unproven_success(self):
        self.write("test.php", "<?php $data = file_get_contents($path);")
        self.assertFalse(source_inputs(self.root, "test.php").reusable)
