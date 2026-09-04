"""Synthetic CSS source/CLI fixtures; no build, browser, catalog or runtime."""
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
        for name in ("page-builder-manager", "page-builder-editor", "page-builder-site-part", "page-builder-public"):
            self.write(f"dist/css/{name}.css", ".fixture {display:block;}")
        for name in ("page-builder-manager", "page-builder-editor", "page-builder-site-part", "page-effects", "page-sliders"):
            self.write(f"dist/js/{name}.iife.js", "void 0;")
        self.write("resources/views/viewer.blade.php", "<!doctype html><html></html>")

    @staticmethod
    def payload(label, count):
        return "".join(hashlib.sha256(f"{label}-{index}".encode()).hexdigest() for index in range(count))

    def test_full_command_rejects_split_family_total_over_original_limit(self):
        self.full_fixture()
        self.split(2)
        for owner in OWNERS[:2]:
            self.write(owner, "/*" + "x" * 91_000 + "*/")
        result = self.run_checker()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Editor CSS family budget exceeded", result.stderr)

    def test_full_command_rejects_manager_selector_hidden_in_extracted_owner(self):
        self.full_fixture()
        self.split(1)
        self.write(OWNERS[0], ".g7pb-manager-toolbar {display:block;}")
        result = self.run_checker()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Manager-only selectors", result.stderr)


    def test_source_mode_counts_unique_connected_owners_without_dist(self):
        self.split()
        # Duplicate edges do not duplicate the source budget.
        self.write(OWNERS[0], f'@import "./{Path(OWNERS[1]).name}";\n.g7pb-title {{color:red;}}')
        result = self.run_checker("--editor-source-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(set(report["sources"]), {ENTRY, *OWNERS})
        self.assertEqual(report["bytes"], sum((self.root / path).stat().st_size for path in (ENTRY, *OWNERS)))
        self.assertEqual(report["limit"], 180_000)
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

    def test_full_command_rejects_main_public_bundle_over_unchanged_limit_and_source_mode_skips_dist(self):
        self.full_fixture()
        good = self.run_checker()
        self.assertEqual(good.returncode, 0, good.stderr)
        self.write("resources/css/page-builder-core.css", "x" * 18_001)
        raw = self.run_checker()
        self.assertNotEqual(raw.returncode, 0, raw.stdout)
        self.assertIn("18001/18000 raw bytes", raw.stderr)
        self.write("resources/css/page-builder-core.css", ".fixture {}")
        # A deterministic incompressible-like fixture exercises the existing JS
        # limit; source-only must never run that unrelated artifact gate.
        self.write("dist/js/page-effects.iife.js", self.payload("main-over", 1_000))
        gzip = self.run_checker()
        self.assertNotEqual(gzip.returncode, 0, gzip.stdout)
        self.assertIn("dist/js/page-effects.iife.js=", gzip.stderr)
        self.assertIn("/24000 gzip bytes", gzip.stderr)
        source = self.run_checker("--editor-source-only")
        self.assertEqual(source.returncode, 0, source.stderr)

    def test_full_command_rejects_optional_slider_bundle_over_its_own_limit(self):
        self.full_fixture()
        self.write("dist/js/page-sliders.iife.js", self.payload("slider-over", 500))
        result = self.run_checker()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("dist/js/page-sliders.iife.js=", result.stderr)
        self.assertIn("/12000 gzip bytes", result.stderr)

    def test_full_command_rejects_combined_public_runtime_without_moving_the_debt(self):
        self.full_fixture()
        # Each artifact is below its own limit, while a slider page would load
        # more than the aggregate allowance. Moving bytes out of the main IIFE
        # must not turn the old exception green by itself.
        self.write("dist/js/page-effects.iife.js", self.payload("main", 620))
        self.write("dist/js/page-sliders.iife.js", self.payload("slider", 305))
        result = self.run_checker()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Public runtime combined budget exceeded", result.stderr)
        self.assertIn("/34000 gzip bytes", result.stderr)


if __name__ == "__main__":
    unittest.main()
