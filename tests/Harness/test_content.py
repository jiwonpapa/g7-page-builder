"""Isolated fixtures: no product generation, browser, Docker or remote calls."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from tools.g7pb.content import PACK, KITS, catalog, check_store, main, plan, select, select_changes


class ContentSelectionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="g7pb-content-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.pack = {"pack_id": "test/core", "blocks": [
            {"block_id": "content.hero", "block_version": 1, "editor_component": "Hero"},
            {"block_id": "content.cta", "block_version": 1, "editor_component": "Cta"}],
            "presets": [{"preset_id": "hero.one", "block_id": "content.hero", "props": {"title": "One"}},
                        {"preset_id": "cta.one", "block_id": "content.cta", "props": {"title": "Two"}}]}
        self.kits = {"page_kit_version": "1.0.0", "kits": [{"slug": "alpha"}, {"slug": "beta"}]}
        self.write(PACK, self.pack)
        self.write(KITS, self.kits)

    def write(self, path, value):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(value) if not isinstance(value, str) else value, encoding="utf-8")

    def test_exact_targets_and_explicit_all(self):
        self.assertEqual(select(self.root, "kit", "alpha", False), ["alpha"])
        self.assertEqual(select(self.root, "kit", None, True), ["alpha", "beta"])
        self.assertEqual(select(self.root, "site-shell", "mobile", False), ["mobile"])

    def test_empty_unknown_duplicate_and_implicit_all_fail(self):
        for ids, all_items in [(None, False), ("", False), ("missing", False), ("alpha,alpha", False),
                               ("alpha,", False), (" alpha", False), ("alpha", True)]:
            with self.subTest(ids=ids, all_items=all_items), self.assertRaises(ValueError):
                select(self.root, "kit", ids, all_items)

    def test_invalid_inventory_fails_before_execution(self):
        self.write(KITS, {"kits": [{"slug": "alpha"}, {"slug": "alpha"}]})
        with self.assertRaises(ValueError):
            catalog(self.root)

    def test_kit_directory_and_screenshot_select_one(self):
        self.assertEqual(select_changes(self.root, "BASE", [
            "resources/store/source/page-kits/alpha/document.json",
            "resources/store/source/screenshots/alpha-mobile.webp"]), [{"kind": "kit", "ids": ["alpha"]}])

    def test_unknown_change_requires_explicit_ownership(self):
        for path in ["resources/store/source/page-kits/missing/document.json", "src/Unknown.php",
                     "resources/store/source/screenshots/unowned.webp"]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                select_changes(self.root, "BASE", [path])

    def test_manifest_change_selects_only_changed_preset(self):
        old = json.loads(json.dumps(self.pack))
        self.pack["presets"][0]["description"] = "Changed description"
        self.write(PACK, self.pack)
        with patch("tools.g7pb.content.subprocess.run", return_value=subprocess.CompletedProcess([], 0, json.dumps(old), "")) as run:
            result = select_changes(self.root, "BASE", [PACK])
        self.assertEqual(result, [{"kind": "preset", "ids": ["preset:test/core:hero.one"]}])
        self.assertEqual(run.call_args.args[0], ["git", "show", f"BASE:{PACK}"])

    def test_canonical_preset_props_also_select_its_block_thumbnail(self):
        old = json.loads(json.dumps(self.pack))
        self.pack["presets"][0]["props"]["title"] = "Changed"
        self.write(PACK, self.pack)
        with patch("tools.g7pb.content.subprocess.run", return_value=subprocess.CompletedProcess([], 0, json.dumps(old), "")):
            result = select_changes(self.root, "BASE", [PACK])
        self.assertEqual(result, [{"kind": "block", "ids": ["block:content.hero@1"]},
                                  {"kind": "preset", "ids": ["preset:test/core:hero.one"]}])

    def test_unmapped_shared_inputs_still_require_explicit_scope(self):
        for path in ["src/Application/Compilation/HtmlDocumentCompiler.php",
                     "resources/css/page-builder-editor-wysiwyg.css"]:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "select explicit --ids or --all"):
                select_changes(self.root, "BASE", [path])

    def test_shared_styles_select_presentation_contract_without_catalog_expansion(self):
        for path, ids in [
            ("resources/css/page-builder-core.css", ["editor-ui"]),
            ("resources/css/page-builder-editor.css", ["editor-ui", "page-theme"]),
            ("resources/css/page-builder-public.css", ["page-theme"]),
            ("resources/css/page-builder-theme.css", ["page-theme"]),
        ]:
            with self.subTest(path=path):
                self.assertEqual(select_changes(self.root, "BASE", [path]), [{"kind": "style", "ids": ids}])
        self.assertEqual(select_changes(self.root, "BASE", [
            "resources/css/page-builder-core.css", "resources/css/page-builder-theme.css",
        ]), [{"kind": "style", "ids": ["editor-ui", "page-theme"]}])

    def test_style_contract_checks_existing_assets_without_generating_or_claiming_browser_proof(self):
        before = sorted(str(path.relative_to(self.root)) for path in self.root.rglob("*"))
        with patch("tools.g7pb.content.subprocess.run") as run, contextlib.redirect_stdout(io.StringIO()) as output:
            status = main(["check", "--kind", "style", "--ids", "page-theme", "--root", str(self.root)])
        self.assertEqual(status, 0)
        self.assertEqual(run.call_args.args[0], ["node", "scripts/check-assets.mjs"])
        result = json.loads(output.getvalue())
        self.assertEqual(result["mode"], "existing-artifact-integrity")
        self.assertTrue(result["requires_build"])
        for flag in ["product_written", "ledger_written", "browser_executed", "source_build_verified", "catalog_render_verified"]:
            self.assertFalse(result[flag])
        self.assertEqual(result["browser_followup"], {"spec": "tests/E2E/editorStructureTheme.spec.ts", "project": "desktop"})
        self.assertEqual(before, sorted(str(path.relative_to(self.root)) for path in self.root.rglob("*")))

    def test_style_ids_are_exact_and_unknown_styles_do_not_expand_scope(self):
        self.assertEqual(select(self.root, "style", "editor-ui", False), ["editor-ui"])
        with self.assertRaisesRegex(ValueError, "Unknown style IDs"):
            select(self.root, "style", "all-content", False)
        with self.assertRaisesRegex(ValueError, "Unclassified content input"):
            select_changes(self.root, "BASE", ["resources/css/new-unknown.css"])

    def test_deleted_block_requires_explicit_inventory_scope(self):
        old = json.loads(json.dumps(self.pack))
        self.pack["blocks"].pop()
        self.pack["presets"].pop()
        self.write(PACK, self.pack)
        with patch("tools.g7pb.content.subprocess.run", return_value=subprocess.CompletedProcess([], 0, json.dumps(old), "")):
            with self.assertRaisesRegex(ValueError, "Deleted block IDs.*content.cta"):
                select_changes(self.root, "BASE", [PACK])

    def test_deleted_preset_requires_explicit_inventory_scope(self):
        old = json.loads(json.dumps(self.pack))
        self.pack["presets"].pop()
        self.write(PACK, self.pack)
        with patch("tools.g7pb.content.subprocess.run", return_value=subprocess.CompletedProcess([], 0, json.dumps(old), "")):
            with self.assertRaisesRegex(ValueError, "Deleted preset IDs.*cta.one"):
                select_changes(self.root, "BASE", [PACK])

    def test_deleted_kit_requires_explicit_inventory_scope(self):
        old = json.loads(json.dumps(self.kits))
        self.kits["kits"].pop()
        self.write(KITS, self.kits)
        with patch("tools.g7pb.content.subprocess.run", return_value=subprocess.CompletedProcess([], 0, json.dumps(old), "")):
            with self.assertRaisesRegex(ValueError, "Deleted kit IDs.*beta"):
                select_changes(self.root, "BASE", [KITS])

    def test_shared_kit_version_requires_explicit_scope(self):
        old = json.loads(json.dumps(self.kits))
        self.kits["page_kit_version"] = "1.0.1"
        self.write(KITS, self.kits)
        with patch("tools.g7pb.content.subprocess.run", return_value=subprocess.CompletedProcess([], 0, json.dumps(old), "")):
            with self.assertRaisesRegex(ValueError, "select explicit --ids or --all"):
                select_changes(self.root, "BASE", [KITS])

    def test_site_shell_does_not_implicitly_select_every_evidence_scope(self):
        with self.assertRaisesRegex(ValueError, "explicit evidence scope"):
            select_changes(self.root, "BASE", ["resources/js/public/siteShellControls.ts"])

    def test_check_keeps_explicit_ids_and_explicit_all_available(self):
        for selection, expected in [(["--ids", "block:content.hero@1"], "block:content.hero@1"),
                                    (["--all"], "block:content.hero@1,block:content.cta@1")]:
            with self.subTest(selection=selection), patch("tools.g7pb.content.subprocess.run") as run:
                with contextlib.redirect_stdout(io.StringIO()):
                    status = main(["check", "--kind", "block", *selection, "--root", str(self.root)])
                self.assertEqual(status, 0)
                command = run.call_args.args[0]
                self.assertEqual(command[command.index("--ids") + 1], expected)

    def test_editor_owner_selects_block_and_its_presets(self):
        self.write("resources/js/editor/Hero.tsx", "export const Hero = {}; // content.hero")
        result = select_changes(self.root, "BASE", ["resources/js/editor/Hero.tsx"])
        self.assertEqual(result, [{"kind": "block", "ids": ["block:content.hero@1"]},
                                  {"kind": "preset", "ids": ["preset:test/core:hero.one"]}])

    def test_inspect_does_not_execute_or_write(self):
        before = sorted(str(path.relative_to(self.root)) for path in self.root.rglob("*"))
        with patch("tools.g7pb.content.subprocess.run") as run, contextlib.redirect_stdout(io.StringIO()) as output:
            status = main(["inspect", "--kind", "kit", "--ids", "alpha", "--root", str(self.root)])
        self.assertEqual(status, 0)
        run.assert_not_called()
        self.assertEqual(json.loads(output.getvalue())["status"], "planned-not-executed")
        self.assertEqual(before, sorted(str(path.relative_to(self.root)) for path in self.root.rglob("*")))

    def test_technical_plan_never_generates_or_refreshes_ledger(self):
        result = plan(self.root, "block", ["block:content.hero@1"])
        self.assertIn("--ids", result["command"])
        self.assertIn("--technical", result["command"])
        self.assertNotIn("--refresh", result["command"])
        self.assertFalse(result["product_written"])
        self.assertFalse(result["browser_executed"])

    def test_store_check_uses_temporary_output_and_leaves_dist_unchanged(self):
        self.write("resources/store/dist/catalog.json", "catalog")
        self.write("resources/store/dist/artifacts/alpha.zip", "archive")
        outputs = []

        def fake_run(command, **kwargs):
            self.assertEqual(command[-2:], ["--kits", "alpha"])
            output = Path(command[command.index("--output-dir") + 1])
            outputs.append(output)
            self.assertFalse(output.is_relative_to(self.root))
            (output / "artifacts").mkdir()
            (output / "catalog.json").write_text("catalog")
            (output / "artifacts/alpha.zip").write_text("archive")

        result = check_store(self.root, ["alpha"], run=fake_run)
        self.assertEqual(result["files_checked"], 2)
        self.assertFalse(outputs[0].exists())
        self.assertEqual((self.root / "resources/store/dist/artifacts/alpha.zip").read_text(), "archive")

    def test_stale_store_fails_without_repair(self):
        self.write("resources/store/dist/catalog.json", "old")

        def fake_run(command, **kwargs):
            (Path(command[command.index("--output-dir") + 1]) / "catalog.json").write_text("new")

        with self.assertRaisesRegex(ValueError, "not modified"):
            check_store(self.root, ["alpha"], run=fake_run)
        self.assertEqual((self.root / "resources/store/dist/catalog.json").read_text(), "old")

    def test_empty_generated_output_is_not_a_pass(self):
        with self.assertRaisesRegex(ValueError, "no catalog"):
            check_store(self.root, ["alpha"], run=lambda *args, **kwargs: None)

    def test_selected_pipeline_wiring_is_bounded(self):
        repository = Path(__file__).resolve().parents[2]
        renderer = (repository / "scripts/render-block-thumbnail-fixtures.php").read_text()
        self.assertIn("Unknown renderer IDs", renderer)
        self.assertLess(renderer.index("! in_array($item['catalog_id'], $requestedIds, true)"), renderer.index("$compiler->compile($document"))
        evidence = (repository / "scripts/check-block-quality-evidence.mjs").read_text()
        self.assertIn("Technical rendering requires --ids", evidence)
        shell = (repository / "scripts/check-site-shell-product-quality.mjs").read_text()
        self.assertNotIn("release:${pkg.version}", shell)
        layout = (repository / "tests/E2E/editorLayoutParity.spec.ts").read_text()
        self.assertIn("G7PB_PAGE_KIT_IDS", layout)
        self.assertIn("test(`${scenario.label}: editor/preview layout`", layout)

    def test_php_renderer_compiles_only_selected_mock_item_with_stable_identity(self):
        repository = Path(__file__).resolve().parents[2]
        self.write("scripts/render-block-thumbnail-fixtures.php", (repository / "scripts/render-block-thumbnail-fixtures.php").read_text())
        self.write("dist/css/page-builder-public.css", "h1{color:black}")
        for item in self.pack["blocks"]:
            item["capabilities"] = []
        for item in self.pack["presets"]:
            item["block_version"] = 1
        self.write(PACK, self.pack)
        self.write("vendor/autoload.php", r'''<?php
namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks { class BlockRegistry { function register($value, $enabled) {} } }
namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks { class BuiltInBlockPackLoader { function load($root) { return null; } } }
namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents { class PageBuilderDocument { public $value; static function fromArray($value) { $doc = new self; $doc->value = $value; return $doc; } } }
namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation {
class HtmlDocumentCompiler { const TARGET_ENGINE_VERSION = 'mock'; function __construct($registry) {}
function compile($document, ...$arguments) { return (object) ['artifact' => '<h1>'.htmlspecialchars(json_encode($document->value)).'</h1>']; } }
}
''')
        command = ["php", str(self.root / "scripts/render-block-thumbnail-fixtures.php")]
        full = self.root / "mock-full"
        subprocess.run([*command, str(full)], check=True, capture_output=True)
        chosen = "preset:test/core:cta.one"
        scoped = self.root / "mock-scoped"
        subprocess.run([*command, str(scoped), "--ids", chosen], check=True, capture_output=True)
        entire = json.loads((full / "index.json").read_text())
        selection = json.loads((scoped / "index.json").read_text())
        self.assertEqual(selection, [item for item in entire if item["catalog_id"] == chosen])
        self.assertEqual(len(list(scoped.glob("*.html"))), 1)
        for invalid in ["", "unknown", chosen + "," + chosen]:
            failed = subprocess.run([*command, str(self.root / "mock-invalid"), "--ids", invalid], capture_output=True)
            self.assertNotEqual(failed.returncode, 0)
        self.assertFalse((self.root / "mock-invalid/index.json").exists())

    def shell_fingerprint_fixture(self):
        repository = Path(__file__).resolve().parents[2]
        script = "scripts/check-site-shell-product-quality.mjs"
        for path in (script, "scripts/lib/editorSourceGraph.mjs", "scripts/lib/editorCssSources.mjs"):
            self.write(path, (repository / path).read_text())
        (self.root / "node_modules").symlink_to(repository / "node_modules", target_is_directory=True)
        self.write("package.json", {"version": "1.0.0", "dependencies": {}, "devDependencies": {}})
        self.write("package-lock.json", {"version": "1.0.0", "packages": {"": {"version": "1.0.0"}}})
        self.write("tsconfig.json", {"compilerOptions": {"module": "ESNext", "verbatimModuleSyntax": True}})
        self.write("resources/js/public/pageEffects.ts", """
import { value } from './publicRuntime';
import './siteShellControls';
import './mobileNavigation';
import '../../css/page-builder-public.css';
export const bootPageEffects = () => value;
""")
        self.write("resources/js/public/publicRuntime.ts", "export { value } from './publicValues';")
        self.write("resources/js/public/publicValues.ts", "export const value = 'original';")
        self.write("resources/js/public/siteShellControls.ts", "export const controls = true;")
        self.write("resources/js/public/mobileNavigation.ts", "import './mobileNavigation.css'; export const mobile = true;")
        self.write("resources/js/public/mobileNavigation.css", ".navigation {display:block}")
        self.write("resources/css/page-builder-public.css", "@import './page-builder-theme.css';")
        self.write("resources/css/page-builder-theme.css", ":root {--fixture: red}")
        command = ["node", str(self.root / script)]
        described = subprocess.run([*command, "--describe-inputs"], cwd=self.root, check=True, capture_output=True, text=True)
        for paths in json.loads(described.stdout).values():
            for path in paths:
                # Real graph helpers, config and sources must stay executable.
                if not (self.root / path).exists():
                    self.write(path, "fixture")
        return command

    def shell_fingerprints(self, command):
        result = subprocess.run([*command, "--fingerprints"], cwd=self.root, check=True, capture_output=True, text=True)
        return json.loads(result.stdout)

    def test_shell_scope_digest_ignores_release_number_and_unrelated_editor_input(self):
        command = [*self.shell_fingerprint_fixture(), "--ids", "mobile"]
        before = self.shell_fingerprints(command)
        self.write("package.json", {"version": "1.0.1", "dependencies": {}, "devDependencies": {}})
        self.write("package-lock.json", {"version": "1.0.1", "packages": {"": {"version": "1.0.1"}}})
        self.write("resources/js/editor/SitePartEditor.tsx", "unrelated editor fixture")
        self.assertEqual(before, self.shell_fingerprints(command))
        self.write("resources/js/public/mobileNavigation.ts", "export const mobile = 'changed';")
        self.assertNotEqual(before, self.shell_fingerprints(command))
        self.assertFalse(before["browser_executed"])

    def test_shell_scope_digest_tracks_extracted_helper_without_rebuilding_dist(self):
        command = self.shell_fingerprint_fixture()
        before = self.shell_fingerprints(command)
        artifacts = {str(path): path.read_bytes() for path in (self.root / "dist").rglob("*") if path.is_file()}
        self.write("resources/js/public/publicValues.ts", "export const value = 'changed helper';")
        after = self.shell_fingerprints(command)
        for scope in ("shell", "mobile", "editor"):
            with self.subTest(scope=scope):
                self.assertNotEqual(before["fingerprints"][scope], after["fingerprints"][scope],
                                    "A connected public helper changed while dist stayed fixed")
        self.assertEqual(artifacts, {str(path): path.read_bytes() for path in (self.root / "dist").rglob("*") if path.is_file()})
        self.assertTrue(after["current_sources_checked"])
        self.assertFalse(after["browser_executed"])

    def test_shell_scope_inputs_follow_runtime_reexports_css_and_compiler_config_only(self):
        command = self.shell_fingerprint_fixture()
        self.write("tsconfig.json", {"extends": "./tsconfig.public.json"})
        self.write("tsconfig.public.json", {"compilerOptions": {"module": "ESNext", "verbatimModuleSyntax": True}})
        self.write("resources/js/public/publicRuntime.ts", """
export { value } from './publicValues';
import type { Unused } from './typeOnly';
// import './commentOnly';
const documentation = "import './stringOnly'";
""")
        disconnected = ["resources/js/public/" + name + ".ts" for name in ("typeOnly", "commentOnly", "stringOnly", "unconnected")]
        for path in disconnected:
            self.write(path, "export type Unused = string;")
        described = subprocess.run([*command, "--describe-inputs"], cwd=self.root, check=True, capture_output=True, text=True)
        inputs = json.loads(described.stdout)
        self.assertEqual(set(inputs), {"shell", "mobile", "editor"})
        for scope, paths in inputs.items():
            with self.subTest(scope=scope):
                for path in ["resources/js/public/publicRuntime.ts", "resources/js/public/publicValues.ts",
                             "resources/css/page-builder-theme.css", "tsconfig.json", "tsconfig.public.json",
                             "scripts/check-site-shell-product-quality.mjs", "scripts/lib/editorSourceGraph.mjs",
                             "scripts/lib/editorCssSources.mjs"]:
                    self.assertIn(path, paths)
                self.assertTrue(set(disconnected).isdisjoint(paths))
        before = self.shell_fingerprints(command)
        for path in disconnected:
            self.write(path, "export type Unused = number;")
        self.assertEqual(before, self.shell_fingerprints(command))
        for path, value in [
            ("resources/css/page-builder-theme.css", ":root {--fixture: blue}"),
            ("tsconfig.public.json", {"compilerOptions": {"module": "ESNext", "verbatimModuleSyntax": False}}),
        ]:
            with self.subTest(changed=path):
                before = self.shell_fingerprints(command)
                self.write(path, value)
                after = self.shell_fingerprints(command)
                for scope in inputs:
                    self.assertNotEqual(before["fingerprints"][scope], after["fingerprints"][scope])

    def test_shell_scope_fingerprints_fail_closed_for_unresolved_public_imports(self):
        command = self.shell_fingerprint_fixture()
        for source, error in [
            ("export { value } from './missing';", "Missing editor source import"),
            ("import './pageEffects'; export const value = 1;", "Circular editor source import"),
            ("const target = './publicValues'; import(target); export const value = 1;", "Dynamic editor source import"),
            ("import '../../../../outside.ts'; export const value = 1;", "Editor source escapes root"),
        ]:
            with self.subTest(error=error):
                self.write("resources/js/public/publicRuntime.ts", source)
                failed = subprocess.run([*command, "--fingerprints"], cwd=self.root, capture_output=True, text=True)
                self.assertNotEqual(failed.returncode, 0)
                self.assertIn(error, failed.stderr)
                self.assertNotIn("current_sources_checked", failed.stdout)

    def test_shell_scope_fingerprints_fail_closed_for_unresolved_css_imports(self):
        command = self.shell_fingerprint_fixture()
        for source, error in [
            ("@import './missing.css';", "Missing CSS import"),
            ("@import './page-builder-public.css';", "Circular CSS import"),
            ("@import url(var(--stylesheet));", "Unsupported CSS import"),
        ]:
            with self.subTest(error=error):
                self.write("resources/css/page-builder-theme.css", source)
                failed = subprocess.run([*command, "--fingerprints"], cwd=self.root, capture_output=True, text=True)
                self.assertNotEqual(failed.returncode, 0)
                self.assertIn(error, failed.stderr)
                self.assertNotIn("current_sources_checked", failed.stdout)


if __name__ == "__main__":
    unittest.main()
