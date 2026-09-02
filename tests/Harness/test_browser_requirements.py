from pathlib import Path
from dataclasses import replace
import tempfile
import unittest
from tools.g7pb.browser_requirements import PAGE, NESTED, TEMPLATE, TEXT, CONTROLS, PARITY, STRUCTURE_THEME, DOCUMENT_BOUNDARY, SITE_SHELL, SITE_PART, CATALOG_PREFIXES, scenarios_for
import json
import re
from tools.g7pb.planner import build_plan


TEXT_AND_CONTROLS = replace(TEXT, titles=tuple(sorted(TEXT.titles + CONTROLS.titles)))
EXTRACTED_EDITING_SCOPES = {
    "blockGalleryModel.ts": {PAGE},
    "BlockGalleryControls.tsx": {PAGE},
    "EditorHeaderControls.tsx": {PAGE, CONTROLS, STRUCTURE_THEME},
    "CanvasContextControls.tsx": {PAGE, TEXT_AND_CONTROLS},
    "SelectedBlockActionBar.tsx": {PAGE, TEXT_AND_CONTROLS},
    "useSelectedActionBarSafeZone.ts": {TEXT_AND_CONTROLS},
    "canvasItemCommands.ts": {PAGE, TEXT},
    "blockMotionCommands.ts": {PAGE},
    "BlockCatalogContext.ts": {PAGE},
    "useEditorViewport.ts": {TEXT_AND_CONTROLS},
    "useCanvasEditingUi.ts": {PAGE, TEXT_AND_CONTROLS},
    "usePageBuilderResources.ts": {PAGE},
    "usePageBuilderSession.ts": {PAGE, TEXT, STRUCTURE_THEME, DOCUMENT_BOUNDARY},
    "richTextModel.ts": {TEXT},
    "richTextSelection.tsx": {TEXT},
    "richTextCommands.ts": {TEXT},
    "richTextFloatingLayer.tsx": {TEXT_AND_CONTROLS},
    "richTextInlineMenu.tsx": {TEXT_AND_CONTROLS},
}


class BrowserRequirementsTests(unittest.TestCase):
    def test_existing_behavior_selected_without_modifying_spec(self):
        self.assertEqual(scenarios_for(["resources/js/editor/richTextEditing.tsx"]), (TEXT,))
        self.assertEqual(set(scenarios_for(["resources/js/editor/PuckEditorAdapter.tsx"])), {PAGE, TEXT, STRUCTURE_THEME, DOCUMENT_BOUNDARY})

    def test_extracted_editor_render_boundaries_keep_their_own_behavior_scope(self):
        text_and_controls = replace(TEXT, titles=tuple(sorted(TEXT.titles + CONTROLS.titles)))
        expected = {
            "puckEditorConfig.tsx": {PAGE, TEXT, STRUCTURE_THEME},
            "puckBuiltinPreviews.tsx": {PAGE, TEXT, STRUCTURE_THEME},
            "previewContent.ts": {PAGE, TEXT},
            "FullSiteCanvas.tsx": {TEMPLATE, TEXT},
            "puckEditorContexts.ts": {text_and_controls, STRUCTURE_THEME},
        }
        with tempfile.TemporaryDirectory() as directory:
            for name, contracts in expected.items():
                with self.subTest(source=name):
                    selected = scenarios_for(["resources/js/editor/" + name])
                    self.assertEqual(set(selected), contracts)
                    self.assertNotIn(PARITY.spec, {scenario.spec for scenario in selected})
                    for scenario in selected:
                        self.assertEqual(scenario.projects, ("desktop",))
                        self.assertEqual(scenario.preset_prefixes, ())
                        self.assertTrue(all(value is None for _, value in scenario.environment(Path(directory))))
                        self.assertNotIn("ALL_PRESET_LAYOUT_GATE", " ".join(scenario.arguments()))

    def test_render_split_deduplicates_titles_without_losing_adapter_transactions(self):
        sources = ["resources/js/editor/" + name for name in (
            "puckEditorConfig.tsx", "puckBuiltinPreviews.tsx", "previewContent.ts",
            "FullSiteCanvas.tsx", "puckEditorContexts.ts",
        )]
        selected = {scenario.spec: scenario for scenario in scenarios_for(sources)}
        self.assertEqual(set(selected), {PAGE.spec, TEXT.spec, STRUCTURE_THEME.spec})
        self.assertEqual(set(selected[PAGE.spec].titles), set(PAGE.titles + TEMPLATE.titles))
        self.assertEqual(set(selected[TEXT.spec].titles), set(TEXT.titles + CONTROLS.titles))
        self.assertEqual(selected[STRUCTURE_THEME.spec], STRUCTURE_THEME)
        together = {scenario.spec: scenario for scenario in scenarios_for([
            *sources, "resources/js/editor/PuckEditorAdapter.tsx",
        ])}
        self.assertEqual(together, {**selected, DOCUMENT_BOUNDARY.spec: DOCUMENT_BOUNDARY})
        self.assertTrue(all(not scenario.preset_prefixes for scenario in together.values()))

    def test_new_render_source_uses_transitive_unit_and_requires_runtime_only_at_integration(self):
        for name in ("puckEditorConfig.tsx", "puckBuiltinPreviews.tsx", "previewContent.ts",
                     "FullSiteCanvas.tsx", "puckEditorContexts.ts"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = "resources/js/editor/" + name
                facade = "resources/js/editor/PuckEditorAdapter.tsx"
                unit = "tests/Unit/existingEditorSurface.test.tsx"
                scenarios = scenarios_for([source])
                files = {
                    source: "export const fixture = 1;",
                    facade: "export { fixture } from './" + name + "';",
                    unit: "import '../../resources/js/editor/PuckEditorAdapter';",
                    **{scenario.spec: "import {test} from '@playwright/test';" for scenario in scenarios},
                }
                for path, content in files.items():
                    file = root / path
                    file.parent.mkdir(parents=True, exist_ok=True)
                    file.write_text(content)
                for phase in ("submission", "integration", "verification", "ci"):
                    with self.subTest(source=name, phase=phase):
                        plan = build_plan(root, [source], phase=phase)
                        self.assertFalse(plan.full)
                        gates = {gate.name: gate for gate in plan.gates}
                        self.assertIn("unit:" + unit, gates)
                        self.assertIn(source, gates["unit:" + unit].inputs)
                        self.assertIn(facade, gates["unit:" + unit].inputs)
                        browsers = {key: gate for key, gate in gates.items() if key.startswith("browser:")}
                        self.assertEqual(set(browsers), {"browser:" + scenario.spec for scenario in scenarios})
                        self.assertFalse(any(key.startswith("content:") for key in gates))
                        for gate in browsers.values():
                            self.assertTrue(gate.runtime)
                            self.assertEqual(gate.deferred, phase == "submission")
                            self.assertIn(source, gate.inputs)
                            self.assertEqual(gate.depends_on, ("browser-assets",))
                            self.assertTrue(all(value is None for _, value in gate.env))

    def test_new_render_source_without_related_unit_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = "resources/js/editor/puckBuiltinPreviews.tsx"
            path = root / source
            path.parent.mkdir(parents=True)
            path.write_text("export const fixture = 1;")
            plan = build_plan(root, [source])
            self.assertIn("No related test for " + source + "; add/declare a focused test", plan.unresolved)
            self.assertFalse(plan.full)

    def test_extracted_editing_sources_keep_exact_code_only_workflows(self):
        with tempfile.TemporaryDirectory() as directory:
            for name, expected in EXTRACTED_EDITING_SCOPES.items():
                with self.subTest(source=name):
                    selected = scenarios_for(["resources/js/editor/" + name])
                    self.assertEqual(set(selected), expected)
                    self.assertNotIn(PARITY.spec, {item.spec for item in selected})
                    for scenario in selected:
                        self.assertEqual(scenario.projects, ("desktop",))
                        self.assertEqual(scenario.preset_prefixes, ())
                        self.assertTrue(all(value is None for _, value in scenario.environment(Path(directory))))
                        self.assertNotIn("ALL_PRESET_LAYOUT_GATE", " ".join(scenario.arguments()))
                        self.assertTrue(set(scenario.titles).isdisjoint(TEMPLATE.titles))
        # The retained facade/default rule and the actual shell owner are not
        # widened or stripped of their existing behavior contracts.
        self.assertEqual(scenarios_for(["resources/js/editor/richTextEditing.tsx"]), (TEXT,))
        self.assertEqual(set(scenarios_for(["resources/js/editor/FullSiteCanvas.tsx"])), {TEMPLATE, TEXT})

    def test_extracted_editing_workflows_union_without_duplicate_or_missing_titles(self):
        sources = ["resources/js/editor/" + name for name in EXTRACTED_EDITING_SCOPES]
        selected = scenarios_for(sources)
        self.assertEqual(set(selected), {PAGE, TEXT_AND_CONTROLS, STRUCTURE_THEME, DOCUMENT_BOUNDARY})
        self.assertEqual(scenarios_for([*reversed(sources), *sources]), selected)
        self.assertEqual(scenarios_for([*sources, "resources/js/editor/PuckEditorAdapter.tsx"]), selected)
        with_shell = {item.spec: item for item in scenarios_for([
            *sources, "resources/js/editor/puckEditorContexts.ts", "resources/js/editor/FullSiteCanvas.tsx",
        ])}
        self.assertEqual(set(with_shell[PAGE.spec].titles), set(PAGE.titles + TEMPLATE.titles))
        self.assertEqual(with_shell[TEXT.spec], TEXT_AND_CONTROLS)
        self.assertEqual(with_shell[STRUCTURE_THEME.spec], STRUCTURE_THEME)
        self.assertEqual(with_shell[DOCUMENT_BOUNDARY.spec], DOCUMENT_BOUNDARY)

    def test_new_editing_sources_keep_transitive_units_and_product_runtime_with_unknown_base(self):
        for name, expected in EXTRACTED_EDITING_SCOPES.items():
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = "resources/js/editor/" + name
                facade = "resources/js/editor/" + ("richTextEditing.tsx" if name.startswith("richText") else "PuckEditorAdapter.tsx")
                unit = "tests/Unit/existingEditorBehavior.test.tsx"
                files = {
                    source: "export const fixture = 1;",
                    facade: "export { fixture } from './" + name + "';",
                    unit: "import '../../" + facade + "';",
                    **{scenario.spec: "import {test} from '@playwright/test';" for scenario in expected},
                }
                for path, content in files.items():
                    target = root / path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(content)
                # A new source or unavailable baseline must not be mistaken for
                # an import-only edit or a harness-only collection request.
                for phase in ("submission", "integration", "verification", "ci"):
                    with self.subTest(source=name, phase=phase):
                        plan = build_plan(root, [source], base="missing-reviewed-base", phase=phase)
                        self.assertFalse(plan.full)
                        gates = {gate.name: gate for gate in plan.gates}
                        related = gates["unit:" + unit]
                        self.assertIn(source, related.inputs)
                        self.assertIn(facade, related.inputs)
                        self.assertIn("typecheck", gates)
                        self.assertTrue(plan.requirements["browser"])
                        self.assertFalse(any(key.startswith(("content:", "browser-registration:")) for key in gates))
                        browsers = {key: gate for key, gate in gates.items() if key.startswith("browser:")}
                        self.assertEqual(set(browsers), {"browser:" + scenario.spec for scenario in expected})
                        self.assertIn("browser-assets", gates)
                        self.assertEqual(gates["browser-assets"].deferred, phase == "submission")
                        for scenario in expected:
                            gate = browsers["browser:" + scenario.spec]
                            self.assertTrue(gate.runtime)
                            self.assertEqual(gate.deferred, phase == "submission")
                            self.assertNotIn("--list", gate.argv)
                            self.assertIn(source, gate.inputs)
                            self.assertEqual(gate.depends_on, ("browser-assets",))
                            self.assertEqual(set(gate.browser_expectations), {
                                (project, title) for project in scenario.projects for title in scenario.titles})
                            self.assertTrue(all(value is None for _, value in gate.env))

    def test_new_editing_source_missing_units_or_required_scenario_is_rejected(self):
        for name in EXTRACTED_EDITING_SCOPES:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = "resources/js/editor/" + name
                target = root / source
                target.parent.mkdir(parents=True)
                target.write_text("export const fixture = 1;")
                plan = build_plan(root, [source], phase="integration")
                self.assertIn("No related test for " + source + "; add/declare a focused test", plan.unresolved)
                for scenario in EXTRACTED_EDITING_SCOPES[name]:
                    self.assertIn("Missing required browser scenario: " + scenario.spec, plan.unresolved)
                self.assertFalse(plan.full)

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
