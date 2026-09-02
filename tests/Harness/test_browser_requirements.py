from pathlib import Path
import tempfile
import unittest
from tools.g7pb.browser_requirements import PAGE, NESTED, TEXT, CONTROLS, PARITY, STRUCTURE_THEME, DOCUMENT_BOUNDARY, SITE_SHELL, SITE_PART, CATALOG_PREFIXES, scenarios_for
import json
import re
from tools.g7pb.planner import build_plan


class BrowserRequirementsTests(unittest.TestCase):
    def test_existing_behavior_selected_without_modifying_spec(self):
        self.assertEqual(scenarios_for(["resources/js/editor/richTextEditing.tsx"]), (TEXT,))
        self.assertEqual(set(scenarios_for(["resources/js/editor/PuckEditorAdapter.tsx"])), {PAGE, TEXT, STRUCTURE_THEME, DOCUMENT_BOUNDARY})

    def test_document_transactions_and_shared_styles_use_code_fixtures_not_preset_sweeps(self):
        self.assertEqual(set(scenarios_for(["resources/js/editor/main.tsx"])), {PAGE, DOCUMENT_BOUNDARY})
        for path in ("resources/js/editor/PuckDocumentBoundary.tsx", "resources/js/editor/editorDocumentBoundary.ts", "resources/js/editor/draftPersistence.ts"):
            self.assertEqual(scenarios_for([path]), (DOCUMENT_BOUNDARY,))
        for path in ("resources/css/page-builder-public.css", "resources/css/page-builder-theme.css", "resources/css/page-builder-core.css"):
            self.assertEqual(scenarios_for([path]), (STRUCTURE_THEME,))
        self.assertEqual(SITE_SHELL.projects, ("desktop",))

    def test_block_appearance_selects_theme_and_text_without_preset_input(self):
        selected = scenarios_for(["resources/js/editor/blockAppearance.ts"])
        self.assertEqual(set(selected), {STRUCTURE_THEME, TEXT})
        self.assertNotIn(PARITY.spec, {scenario.spec for scenario in selected})
        # A code contract must not read the preset manifest or inherit a manual
        # catalog selector, even when no content files exist at the subject root.
        with tempfile.TemporaryDirectory() as directory:
            for scenario in selected:
                with self.subTest(spec=scenario.spec):
                    self.assertEqual(scenario.projects, ("desktop",))
                    self.assertEqual(scenario.preset_prefixes, ())
                    self.assertNotIn("ALL_PRESET_LAYOUT_GATE", " ".join(scenario.arguments()))
                    environment = dict(scenario.environment(Path(directory)))
                    self.assertIsNone(environment["G7PB_PRESET_IDS"])
                    self.assertIsNone(environment["G7PB_PAGE_KIT_IDS"])
                    self.assertTrue(all(value is None for value in environment.values()))

    def test_block_appearance_scope_keeps_other_style_parity_contracts(self):
        for path in ("resources/js/editor/responsiveBlockStyle.tsx",
                     "src/Application/Compilation/ElementAppearanceCompiler.php"):
            with self.subTest(source=path):
                self.assertEqual(scenarios_for([path]), (PARITY,))

    def test_sources_deduplicate_workflows_and_do_not_select_unrelated_store(self):
        self.assertEqual(scenarios_for(["resources/js/editor/fontSize.ts", "resources/js/editor/richTextEditing.tsx"]), (TEXT,))
        self.assertEqual(scenarios_for(["src/Application/Compilation/SitePartHtmlCompiler.php"]), (SITE_PART,))
        self.assertEqual(scenarios_for(["README.md", "tools/g7pb/planner.py"]), ())

    def test_layout_rendering_uses_real_parity_scenario(self):
        catalog = scenarios_for(["resources/js/editor/catalogBlocks.tsx"])[0]
        self.assertEqual(catalog.spec, PARITY.spec)
        self.assertEqual(catalog.preset_prefixes, CATALOG_PREFIXES["catalogBlocks.tsx"])
        self.assertEqual(set(scenarios_for(["resources/js/editor/layoutCatalogBlocks.tsx"])), {NESTED, STRUCTURE_THEME})

    def test_missing_required_scenario_does_not_silently_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "resources/js/editor/richTextEditing.tsx"
            source.parent.mkdir(parents=True)
            source.write_text("export const richTextEditing = 1;")
            test = root / "tests/Unit/richTextEditing.test.ts"
            test.parent.mkdir(parents=True)
            test.write_text("import '../../resources/js/editor/richTextEditing';")
            plan = build_plan(root, [source.relative_to(root).as_posix()])
            self.assertIn("Missing required browser scenario: " + TEXT.spec, plan.unresolved)
            self.assertFalse(plan.full)

    def test_submission_defers_browser_but_integration_requires_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, content in {
                "resources/js/editor/richTextEditing.tsx": "export const value = 1;",
                "tests/Unit/richTextEditing.test.ts": "import '../../resources/js/editor/richTextEditing';",
                TEXT.spec: "import {test} from '@playwright/test'; test('edit', async()=>{});",
            }.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
            for phase in ("submission", "integration", "verification", "ci"):
                plan = build_plan(root, ["resources/js/editor/richTextEditing.tsx"], phase=phase)
                gate = next(g for g in plan.gates if g.name == "browser:" + TEXT.spec)
                self.assertTrue(plan.requirements["browser"])
                self.assertEqual(gate.deferred, phase == "submission")
                self.assertTrue(gate.runtime)

    def test_nested_command_never_selects_temporary_home_or_all_presets(self):
        selected = scenarios_for(["resources/js/editor/layoutEditorCommands.ts"])
        self.assertEqual(set(selected), {NESTED, STRUCTURE_THEME})
        self.assertIn("--grep", NESTED.arguments())
        self.assertNotIn("temporary home", NESTED.arguments()[-1])

    def test_typed_puck_helpers_select_only_their_existing_code_workflows(self):
        expected = {
            "resources/js/editor/blockInspectorFields.tsx": (PAGE,),
            "resources/js/editor/puckLayoutData.ts": (NESTED, STRUCTURE_THEME),
        }
        with tempfile.TemporaryDirectory() as directory:
            for path, scenarios in expected.items():
                with self.subTest(path=path):
                    selected = scenarios_for([path])
                    self.assertEqual(set(selected), set(scenarios))
                    for scenario in selected:
                        self.assertEqual(scenario.projects, ("desktop",))
                        self.assertEqual(scenario.preset_prefixes, ())
                        self.assertTrue(all(value is None for _, value in scenario.environment(Path(directory))))
                        self.assertNotIn("ALL_PRESET_LAYOUT_GATE", " ".join(scenario.arguments()))
            together = scenarios_for([*expected, "resources/js/editor/layoutEditorCommands.ts"])
            self.assertEqual(len(together), 2)
            lifecycle = next(scenario for scenario in together if scenario.spec == PAGE.spec)
            self.assertEqual(set(lifecycle.titles), set(PAGE.titles + NESTED.titles))

    def test_typed_puck_helpers_require_units_and_defer_only_runtime_execution(self):
        for source in ("resources/js/editor/blockInspectorFields.tsx", "resources/js/editor/puckLayoutData.ts"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                unit = "tests/Unit/" + Path(source).stem + ".test.ts"
                files = {source: "export const fixture = 1;", unit: "import '../../" + source + "';"}
                files.update({scenario.spec: "import {test} from '@playwright/test';" for scenario in scenarios_for([source])})
                for name, content in files.items():
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(content)
                for phase in ("submission", "integration", "verification", "ci"):
                    with self.subTest(source=source, phase=phase):
                        plan = build_plan(root, [source], phase=phase)
                        self.assertFalse(plan.full)
                        self.assertIn("unit:" + unit, {gate.name for gate in plan.gates})
                        browsers = [gate for gate in plan.gates if gate.name.startswith("browser:")]
                        self.assertEqual({gate.name for gate in browsers}, {"browser:" + item.spec for item in scenarios_for([source])})
                        self.assertTrue(all(gate.runtime for gate in browsers))
                        self.assertTrue(all(gate.deferred == (phase == "submission") for gate in browsers))

    def test_shared_helpers_select_ten_named_presets_and_no_page_kit(self):
        root = Path(__file__).resolve().parents[2]
        environment = dict(PARITY.environment(root))
        self.assertEqual(len(environment["G7PB_PRESET_IDS"].split(",")), 10)
        self.assertIsNone(environment["G7PB_PAGE_KIT_IDS"])
        self.assertIsNone(environment["G7PB_PARITY_CANDIDATE_DIST"])
        self.assertFalse(re.search(PARITY.arguments()[-1], "PAGE_KIT_LAYOUT_GATE: unrelated: editor/preview layout"))

    def test_each_catalog_selects_only_declared_families_and_unions_without_duplicates(self):
        root = Path(__file__).resolve().parents[2]
        manifest = json.loads((root / "resources/block-packs/builtin-core/manifest.json").read_text())
        for name, prefixes in CATALOG_PREFIXES.items():
            with self.subTest(catalog=name):
                scenario = scenarios_for(["resources/js/editor/" + name])[0]
                actual = set(dict(scenario.environment(root))["G7PB_PRESET_IDS"].split(","))
                expected = {p["preset_id"] for p in manifest["presets"] if p["preset_id"].split(".")[0] in prefixes}
                self.assertEqual(actual, expected)
                self.assertLess(len(actual), len(manifest["presets"]))
        selected = scenarios_for(["resources/js/editor/richTextEditing.tsx", "resources/js/editor/canvasEditingContract.ts"])
        self.assertEqual(len(selected), 1)
        self.assertEqual(set(selected[0].titles), set(TEXT.titles + CONTROLS.titles))

    def test_missing_preset_selector_is_an_error_not_full_catalog_fallback(self):
        from dataclasses import replace
        with self.assertRaisesRegex(ValueError, "No declared parity preset"):
            replace(PARITY, preset_prefixes=("unknown-preset-family",)).environment(Path(__file__).resolve().parents[2])

    def test_compiler_collaborators_have_separate_behavior_scopes(self):
        self.assertEqual(scenarios_for(["src/Application/Compilation/RichTextSanitizer.php"]), (TEXT,))
        self.assertEqual(scenarios_for(["src/Application/Compilation/CompilationUrlPolicy.php"]), (PAGE,))
        self.assertEqual(scenarios_for(["src/Application/Compilation/ElementAppearanceCompiler.php"]), (PARITY,))


if __name__ == "__main__":
    unittest.main()
