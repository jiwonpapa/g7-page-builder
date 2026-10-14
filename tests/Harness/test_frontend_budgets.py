"""Synthetic asset measurement/CLI fixtures; no build, browser or runtime."""
import json
import os
import hashlib
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
CHECKER = "scripts/check-frontend-budgets.mjs"
CSS_READER = "scripts/lib/editorCssSources.mjs"
ENTRY = "resources/css/page-builder-editor.css"
OWNERS = tuple(f"resources/css/page-builder-editor-{role}.css" for role in
               ("chrome", "library", "controls", "canvas", "blocks", "catalog", "appearance"))
SHARED = ("resources/css/page-builder-core.css", "resources/css/page-builder-theme.css",
          "resources/css/page-builder-editor-wysiwyg.css", "resources/css/page-builder-site-shell.css",
          "resources/js/public/mobileNavigation.css")


class FrontendBudgetTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="g7pb-editor-budget-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.checker = Path(os.environ.get("G7PB_FRONTEND_BUDGET_CHECKER", str(ROOT / CHECKER)))
        # Keep the controller import dependencies beside the copied real checker.
        for name in (CHECKER, CSS_READER):
            origin = self.checker if name == CHECKER else self.checker.parent / "lib/editorCssSources.mjs"
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origin, target)
        (self.root / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
        self.write(ENTRY, ".g7pb-editor {display:block;}\n")

    def write(self, name, source):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source)

    def run_checker(self, *args):
        return subprocess.run(["node", str(self.root / CHECKER), *args], cwd=self.root,
                              capture_output=True, text=True)

    def split(self, count=7):
        self.write(ENTRY, "".join(f'@import "./{Path(owner).name}";\n' for owner in OWNERS[:count]))
        for index, owner in enumerate(OWNERS[:count]):
            self.write(owner, f".g7pb-fixture-{index} {{display:block;}}\n")

    def full_fixture(self):
        for name in ("page-builder-core", "page-builder-manager", "page-builder-editor-wysiwyg",
                     "page-builder-site-part", "page-builder-public", "page-builder-site-shell"):
            self.write(f"resources/css/{name}.css", ".fixture {display:block;}")
        self.write("resources/css/page-builder-manager.css", "@media (max-width: 720px) {.g7pb-store-card {display:block;}}")
        for name in ("page-builder-manager", "page-builder-editor", "page-builder-structure", "page-builder-site-part", "page-builder-public"):
            self.write(f"dist/css/{name}.css", ".fixture {display:block;}")
        for name in ("page-builder-manager", "page-builder-editor", "page-builder-structure", "page-builder-site-part", "page-effects", "page-sliders"):
            self.write(f"dist/js/{name}.iife.js", "void 0;")
        self.write("resources/views/viewer.blade.php", "<!doctype html><html></html>")

    @staticmethod
    def payload(label, count):
        return "".join(hashlib.sha256(f"{label}-{index}".encode()).hexdigest() for index in range(count))

    def test_all_editor_entries_report_growth_without_a_gzip_ceiling(self):
        for entry, warning in (("editor", 512000), ("structure", 512000), ("site-part", 410000)):
            with self.subTest(entry=entry):
                self.full_fixture()
                path = f"dist/js/page-builder-{entry}.iife.js"
                source = self.payload(entry, 16000)
                self.write(path, source)
                result = self.run_checker()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"{path}={len(source.encode())} raw / ", result.stdout)
                self.assertIn("gzip bytes (reported; no size ceiling)", result.stdout)
                self.assertIn(f"JS size advisory: {path} exceeds historical {warning} gzip bytes; non-blocking", result.stdout)

    def test_small_editor_entries_are_measured_without_advisories(self):
        self.full_fixture()
        result = self.run_checker()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("JS size advisory:", result.stdout)
        for entry in ("editor", "structure", "site-part"):
            self.assertIn(f"dist/js/page-builder-{entry}.iife.js=7 raw / ", result.stdout)

    def test_all_javascript_artifacts_remain_required_and_nonempty(self):
        for name in ("page-builder-editor", "page-builder-structure", "page-builder-site-part",
                     "page-builder-manager", "page-effects", "page-sliders"):
            with self.subTest(entry=name):
                self.full_fixture()
                path = f"dist/js/{name}.iife.js"
                (self.root / path).unlink()
                missing = self.run_checker()
                self.assertNotEqual(missing.returncode, 0)
                self.assertIn("ENOENT", missing.stderr)
                self.assertIn(path, missing.stderr)
                self.write(path, " \n")
                result = self.run_checker()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"Empty JavaScript artifact: {path}", result.stderr)

    def test_manager_growth_is_measured_and_never_blocks(self):
        self.full_fixture()
        self.write("dist/js/page-builder-manager.iife.js", self.payload("manager-over", 4000))
        result = self.run_checker()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("dist/js/page-builder-manager.iife.js=", result.stdout)
        self.assertIn("JS size advisory: dist/js/page-builder-manager.iife.js exceeds historical 90000 gzip bytes; non-blocking", result.stdout)

    def test_full_command_reports_split_family_growth_without_a_ceiling(self):
        self.full_fixture()
        self.split(2)
        for owner in OWNERS[:2]:
            self.write(owner, "/*" + "x" * 91_000 + "*/")
        result = self.run_checker()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Editor CSS family=", result.stdout)
        self.assertIn("CSS size advisory: Editor CSS family=", result.stdout)
        self.assertIn("non-blocking", result.stdout)

    def test_full_command_rejects_manager_selector_hidden_in_extracted_owner(self):
        self.full_fixture()
        self.split(1)
        self.write(OWNERS[0], ".g7pb-manager-toolbar {display:block;}")
        result = self.run_checker()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Manager-only selectors", result.stderr)

    def test_public_css_reports_growth_without_a_source_or_gzip_ceiling(self):
        self.full_fixture()
        # Exceed both historical limits and the unapproved 21,000-byte proposal.
        # Valid CSS with deterministic content, not an infinite/very high ceiling.
        source = ".fixture {--measurement: '" + self.payload("public-css", 2000) + "';}"
        measured = subprocess.run(["node", "--input-type=module", "-e",
                                  "import {gzipSync} from 'node:zlib'; import {readFileSync} from 'node:fs'; "
                                  "console.log(gzipSync(readFileSync(0)).length);"],
                                 input=source, capture_output=True, text=True, check=True)
        raw, gzip = len(source.encode()), int(measured.stdout)
        self.assertGreater(raw, 105_000)
        self.assertGreater(gzip, 21_000)
        for path in ("resources/css/page-builder-public.css", "dist/css/page-builder-public.css"):
            self.write(path, source)
        result = self.run_checker()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"resources/css/page-builder-public.css={raw} raw bytes (reported; no size ceiling)", result.stdout)
        self.assertIn(f"dist/css/page-builder-public.css={gzip} gzip bytes (reported; no size ceiling)", result.stdout)

    def test_public_css_files_remain_required_without_a_size_ceiling(self):
        for path in ("resources/css/page-builder-public.css", "dist/css/page-builder-public.css"):
            with self.subTest(path=path):
                self.full_fixture()
                (self.root / path).unlink()
                result = self.run_checker()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("ENOENT", result.stderr)
                self.assertIn(path, result.stderr)

    def test_all_css_sources_and_bundles_report_growth_without_blocking(self):
        source = "/*" + self.payload("css-observation", 4000) + "*/"
        paths = [f"resources/css/page-builder-{name}.css" for name in
                 ("core", "manager", "editor", "editor-wysiwyg", "site-part", "site-shell")]
        paths += [f"dist/css/page-builder-{name}.css" for name in ("manager", "editor", "structure", "site-part")]
        for path in paths:
            with self.subTest(path=path):
                self.full_fixture()
                self.write(ENTRY, ".g7pb-editor {display:block;}")
                suffix = "@media (max-width: 720px) {.g7pb-store-card {display:block;}}" if path == "resources/css/page-builder-manager.css" else ""
                self.write(path, source + suffix)
                result = self.run_checker()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"{path}=", result.stdout)
                self.assertIn(f"CSS size advisory: {path}", result.stdout)
                self.assertIn("reported; no size ceiling", result.stdout)

    def test_basic_element_shared_source_is_measured_without_a_ceiling(self):
        path = "resources/css/page-builder-basic-elements.css"
        self.write(ENTRY, '@import "./page-builder-basic-elements.css";')
        self.write(path, "/*" + "x" * 1996 + "*/")
        passed = self.run_checker("--editor-source-only")
        self.assertEqual(passed.returncode, 0, passed.stderr)
        self.assertIn(path, json.loads(passed.stdout)["inputs"])
        self.write(path, "/*" + "x" * 1997 + "*/")
        grown = self.run_checker("--editor-source-only")
        self.assertEqual(grown.returncode, 0, grown.stderr)
        report = json.loads(grown.stdout)
        self.assertIsNone(report["limit"])
        self.assertIn({"path": path, "bytes": 2001, "warningThreshold": 2000}, report["measurements"])
        self.assertTrue(any(path in warning and "non-blocking" in warning for warning in report["warnings"]))

    def test_source_mode_counts_unique_connected_owners_without_dist(self):
        self.split()
        # Duplicate edges do not duplicate the source budget.
        self.write(OWNERS[0], f'@import "./{Path(OWNERS[1]).name}";\n.g7pb-title {{color:red;}}')
        result = self.run_checker("--editor-source-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(set(report["sources"]), {ENTRY, *OWNERS})
        self.assertEqual(report["bytes"], sum((self.root / path).stat().st_size for path in (ENTRY, *OWNERS)))
        self.assertIsNone(report["limit"])
        self.assertEqual(report["warningThreshold"], 180_100)
        self.assertEqual(report["warnings"], [])
        self.assertFalse((self.root / "dist").exists())

    def test_shared_imports_are_inputs_but_not_added_to_editor_raw_budget(self):
        imports = []
        for path in SHARED:
            self.write(path, "/*" + "shared" * 40_000 + "*/")
            imports.append(f'@import "{os.path.relpath(self.root / path, (self.root / ENTRY).parent)}";')
        self.write(ENTRY, "\n".join(imports) + "\n.g7pb-editor {display:block;}")
        result = self.run_checker("--editor-source-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["sources"], [ENTRY])
        self.assertEqual(report["bytes"], (self.root / ENTRY).stat().st_size)
        self.assertEqual(set(report["inputs"]), {ENTRY, *OWNERS, *SHARED})
        inputs = self.run_checker("--editor-source-inputs")
        self.assertEqual(inputs.returncode, 0, inputs.stderr)
        self.assertEqual(json.loads(inputs.stdout), report["inputs"])

    def test_each_owner_rejects_manager_selectors_but_not_comments_or_string_values(self):
        self.split()
        forbidden = ("store-card", "manager-toolbar", "document-row", "document-list", "revision-row")
        for index, owner in enumerate(OWNERS):
            with self.subTest(owner=owner):
                self.write(owner, f'@media (width > 1px) {{.g7pb-{forbidden[index % len(forbidden)]} {{display:block;}}}}')
                result = self.run_checker("--editor-source-only")
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn("Manager-only selectors", result.stderr)
                self.assertIn(owner, result.stderr)
                self.write(owner, '/* .g7pb-manager-toolbar {} */ .g7pb-editor::after {content:".g7pb-store-card";}')
        result = self.run_checker("--editor-source-only")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_clean_entry_cannot_hide_disconnected_approved_owner(self):
        self.write(OWNERS[-1], ".g7pb-manager-toolbar {display:block;}")
        for mode in ("--editor-source-only", "--editor-source-inputs"):
            with self.subTest(mode=mode):
                result = self.run_checker(mode)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn("not connected to its entry", result.stderr)
                self.assertIn(OWNERS[-1], result.stderr)

    def test_actual_unknown_missing_cyclic_and_escaping_imports_fail_closed(self):
        self.write("resources/css/unknown-owner.css", ".g7pb-editor {display:block;}")
        self.write(OWNERS[0], '@import "./page-builder-editor.css";')
        with tempfile.TemporaryDirectory(prefix="g7pb-outside-budget-") as outside:
            outside_path = Path(outside) / "outside.css"
            outside_path.write_text(".g7pb-editor {}")
            target = os.path.relpath(outside_path, (self.root / ENTRY).parent)
            cases = (
                ('@import "./unknown-owner.css";', "Unclassified editor CSS import"),
                ('@import "./missing.css";', "Missing CSS import"),
                (f'@import "./{Path(OWNERS[0]).name}";', "Circular CSS import"),
                (f'@import "{target}";', "CSS import escapes root"),
            )
            for source, error in cases:
                with self.subTest(error=error):
                    self.write(ENTRY, source)
                    result = self.run_checker("--editor-source-only")
                    self.assertNotEqual(result.returncode, 0, result.stdout)
                    self.assertIn(error, result.stderr)

    def test_main_public_bundle_growth_is_advisory_and_source_mode_skips_dist(self):
        self.full_fixture()
        good = self.run_checker()
        self.assertEqual(good.returncode, 0, good.stderr)
        self.write("resources/css/page-builder-core.css", "x" * 18_001)
        raw = self.run_checker()
        self.assertEqual(raw.returncode, 0, raw.stderr)
        self.assertIn("resources/css/page-builder-core.css=18001 raw bytes (reported; no size ceiling)", raw.stdout)
        self.write("resources/css/page-builder-core.css", ".fixture {}")
        # Deterministic growth exceeds the former threshold, without a new cap.
        self.write("dist/js/page-effects.iife.js", self.payload("main-over", 1_000))
        gzip = self.run_checker()
        self.assertEqual(gzip.returncode, 0, gzip.stderr)
        self.assertIn("dist/js/page-effects.iife.js=", gzip.stdout)
        self.assertIn("JS size advisory: dist/js/page-effects.iife.js exceeds historical 24000 gzip bytes; non-blocking", gzip.stdout)
        source = self.run_checker("--editor-source-only")
        self.assertEqual(source.returncode, 0, source.stderr)

    def test_optional_slider_growth_is_advisory(self):
        self.full_fixture()
        self.write("dist/js/page-sliders.iife.js", self.payload("slider-over", 500))
        result = self.run_checker()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("dist/js/page-sliders.iife.js=", result.stdout)
        self.assertIn("JS size advisory: dist/js/page-sliders.iife.js exceeds historical 12000 gzip bytes; non-blocking", result.stdout)

    def test_combined_public_runtime_growth_is_measured_and_advisory(self):
        self.full_fixture()
        # Aggregate growth remains visible even below individual old thresholds.
        # Node builds may use different zlib implementations. Size the synthetic
        # samples with the executing Node, then assert the test's preconditions.
        # All former thresholds are advisory, not replacement hard limits.
        script = """
          const {gzipSync} = require('node:zlib');
          const {readFileSync} = require('node:fs');
          const data = readFileSync(0);
          const target = Number(process.argv[1]);
          let low = 0, high = data.length;
          while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (gzipSync(data.subarray(0, mid)).length <= target) low = mid;
            else high = mid - 1;
          }
          const source = data.subarray(0, low);
          process.stdout.write(JSON.stringify({source: source.toString(), bytes: gzipSync(source).length}));
        """
        measured = []
        for label, target, limit in (("main", 23_000, 24_000), ("slider", 11_500, 12_000)):
            result = subprocess.run(["node", "-e", script, str(target)], input=self.payload(label, 1_500),
                                    capture_output=True, text=True, check=True, timeout=30)
            sample = json.loads(result.stdout)
            self.assertGreaterEqual(sample["bytes"], target - 100)
            self.assertLess(sample["bytes"], limit)
            measured.append(sample["bytes"])
            bundle = "page-effects" if label == "main" else "page-sliders"
            self.write(f"dist/js/{bundle}.iife.js", sample["source"])
        self.assertGreater(sum(measured), 34_000)
        result = self.run_checker()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"Public runtime combined={sum(measured)} gzip bytes (reported; no size ceiling;", result.stdout)
        self.assertIn("JS size advisory: Public runtime combined exceeds historical 34000 gzip bytes; non-blocking", result.stdout)


if __name__ == "__main__":
    unittest.main()
