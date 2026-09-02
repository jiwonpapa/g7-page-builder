from pathlib import Path
from dataclasses import replace
import tempfile
import unittest
from tools.g7pb.browser_requirements import PAGE, NESTED, TEMPLATE, TEXT, CONTROLS, PARITY, STRUCTURE_THEME, DOCUMENT_BOUNDARY, SITE_SHELL, SITE_PART, STORE, MANAGER_STORE, MANAGER_INBOX, CATALOG_FRAME, CATALOG_FIELDS, CATALOG_CODEC, CATALOG_RESPONSIVE, CATALOG_CODE_SCOPES, scenarios_for
import re
import subprocess
from tools.g7pb.planner import build_plan
from tools.g7pb.model import Plan
from tools.g7pb.runner import digest_gate, execute


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

MANAGER_CODE = replace(MANAGER_STORE, titles=tuple(sorted(MANAGER_STORE.titles + MANAGER_INBOX.titles)))
EXTRACTED_MANAGER_SCOPES = {
    "useManagerStore.ts": MANAGER_STORE,
    "ManagerStoreDialogs.tsx": MANAGER_STORE,
    "useManagerBlockPacks.ts": MANAGER_STORE,
    "ManagerBlockPacksDialog.tsx": MANAGER_STORE,
    "ManagerInboxDialog.tsx": MANAGER_INBOX,
}


def catalog_roles(*roles):
    return replace(CATALOG_FRAME, titles=tuple(sorted({title for role in roles for title in role.titles})))


CATALOG_MIXED = catalog_roles(CATALOG_FRAME, CATALOG_FIELDS, CATALOG_CODEC)
CATALOG_STYLE = catalog_roles(CATALOG_FRAME, CATALOG_CODEC)
CATALOG_BREAKPOINTS = catalog_roles(CATALOG_CODEC, CATALOG_RESPONSIVE)
# Independent reviewed ownership list: a renamed/new source must not silently
# inherit a prefix-based exception or lose its corresponding code contract.
EXTRACTED_CATALOG_SCOPES = {
    **{"resources/js/editor/" + name: {CATALOG_MIXED} for name in (
        "catalogBlocks.tsx", "foundationCatalogBlocks.tsx", "phase2CatalogBlocks.tsx",
        "phase3CatalogBlocks.tsx", "phase4CatalogBlocks.tsx", "productionCatalogBlocks.tsx",
    )},
    **{"resources/js/editor/" + name: {CATALOG_CODEC} for name in (
        "foundationCatalogData.ts", "foundationCatalogCodec.ts", "phase2CatalogData.ts", "phase2CatalogCodec.ts",
        "phase3CatalogData.ts", "phase3CatalogCodec.ts", "phase4CatalogData.ts", "phase4CatalogCodec.ts",
        "productionCatalogData.ts", "productionCatalogCodec.ts", "catalogData.ts", "catalogCodec.ts", "catalogEditorTypes.ts",
    )},
    **{"resources/js/editor/" + name: {CATALOG_STYLE} for name in (
        "catalogAppearance.ts", "blockMotionData.ts", "elementAppearanceData.ts",
    )},
    "resources/js/editor/CatalogBlockFrame.tsx": {CATALOG_FRAME, TEXT_AND_CONTROLS},
    "resources/js/editor/blockMotion.tsx": {PAGE, CATALOG_STYLE},
    "resources/js/editor/canvasEditingContract.ts": {TEXT_AND_CONTROLS, CATALOG_STYLE},
    "resources/js/editor/catalogPreviews.tsx": {catalog_roles(CATALOG_FRAME, CATALOG_FIELDS), TEXT},
    "resources/js/editor/catalogFields.tsx": {CATALOG_FIELDS, TEXT},
    "resources/js/editor/CatalogGalleryThumbnail.tsx": {PAGE},
    "resources/js/editor/puckBlockCodec.ts": {PAGE, TEXT, STRUCTURE_THEME, CATALOG_CODEC},
    "resources/js/editor/responsiveBlockData.ts": {CATALOG_BREAKPOINTS},
    "resources/js/editor/responsiveBlockStyle.tsx": {CATALOG_BREAKPOINTS},
    "resources/js/blocks/externalEditorRegistryData.ts": {PAGE, CATALOG_CODEC},
    "resources/js/blocks/runtimeRegistry.ts": {PAGE, CATALOG_CODEC},
}


class BrowserRequirementsTests(unittest.TestCase):
    def test_manager_requests_select_synthetic_contracts_and_keep_page_workflow(self):
        for name, expected in EXTRACTED_MANAGER_SCOPES.items():
            with self.subTest(source=name):
                self.assertEqual(scenarios_for(["resources/js/manager/" + name]), (expected,))
                self.assertEqual(expected.projects, ("desktop",))
                self.assertEqual(expected.preset_prefixes, ())
                self.assertNotIn(STORE.spec, expected.arguments())
                self.assertTrue(all(value is None for _, value in expected.environment(Path("."))))
        selected = scenarios_for(["resources/js/manager/PageBuilderManager.tsx"])
        self.assertEqual(set(selected), {PAGE, MANAGER_CODE})
        self.assertEqual(scenarios_for(["resources/js/manager/" + name for name in EXTRACTED_MANAGER_SCOPES]), (MANAGER_CODE,))
        self.assertEqual(scenarios_for(["resources/js/store/types.ts"]), (STORE,))

    def test_document_manager_owners_retain_the_existing_page_contract(self):
        for name in ("useManagerDocuments.ts", "ManagerDocumentList.tsx", "ManagerDocumentDialogs.tsx",
                     "useManagerMetadata.ts", "ManagerMetadataDialog.tsx", "useManagerRevisions.ts",
                     "ManagerRevisionsDialogs.tsx", "managerDocumentPresentation.ts"):
            with self.subTest(source=name):
                self.assertEqual(scenarios_for(["resources/js/manager/" + name]), (PAGE,))

    def test_manager_owners_keep_related_units_and_require_their_runtime_scenario(self):
        owners = {**EXTRACTED_MANAGER_SCOPES, "PageBuilderManager.tsx": MANAGER_CODE}
        for name, expected in owners.items():
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = "resources/js/manager/" + name
                facade = "resources/js/manager/PageBuilderManager.tsx"
                unit = "tests/Unit/managerBehavior.test.tsx"
                scenarios = {expected, PAGE} if source == facade else {expected}
                files = {
                    facade: "export { fixture } from './" + name + "';",
                    source: "export const fixture = 1;",
                    unit: "import '../../" + facade + "';",
                    **{scenario.spec: "import {test} from '@playwright/test';" for scenario in scenarios},
                }
                for path, content in files.items():
                    target = root / path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(content)
                for phase in ("submission", "integration", "verification", "ci"):
                    with self.subTest(source=name, phase=phase):
                        plan = build_plan(root, [source], base="missing-reviewed-base", phase=phase)
                        self.assertFalse(plan.full)
                        self.assertEqual(plan.unresolved, [])
                        gates = {gate.name: gate for gate in plan.gates}
                        self.assertIn(source, gates["unit:" + unit].inputs)
                        self.assertIn("typecheck", gates)
                        self.assertFalse(any(key.startswith(("content:", "browser-registration:")) for key in gates))
                        self.assertEqual({key for key in gates if key.startswith("browser:")},
                                         {"browser:" + scenario.spec for scenario in scenarios})
                        for scenario in scenarios:
                            gate = gates["browser:" + scenario.spec]
                            self.assertTrue(gate.runtime)
                            self.assertEqual(gate.deferred, phase == "submission")
                            self.assertEqual(gate.depends_on, ("browser-assets",))
                            self.assertEqual(set(gate.browser_expectations), {("desktop", title) for title in scenario.titles})
                            self.assertIn(source, gate.inputs)
                            self.assertTrue(all(value is None for _, value in gate.env))

    def test_manager_spec_only_changes_collect_without_product_acceptance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            spec = root / MANAGER_STORE.spec
            spec.parent.mkdir(parents=True)
            spec.write_text("import {test} from '@playwright/test';")
            for phase in ("submission", "integration", "verification", "ci"):
                plan = build_plan(root, [MANAGER_STORE.spec], base="missing-reviewed-base", phase=phase)
                self.assertFalse(plan.full)
                self.assertEqual(plan.unresolved, [])
                gates = {gate.name: gate for gate in plan.gates}
                gate = gates["browser-registration:" + MANAGER_STORE.spec]
                self.assertIn("--list", gate.argv)
                self.assertFalse(gate.runtime)
                self.assertFalse(any(name.startswith(("browser:", "content:")) for name in gates))

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

    def test_responsive_code_scope_keeps_the_separate_php_parity_contract(self):
        self.assertEqual(scenarios_for(["resources/js/editor/responsiveBlockStyle.tsx"]), (CATALOG_BREAKPOINTS,))
        self.assertEqual(scenarios_for(["src/Application/Compilation/ElementAppearanceCompiler.php"]), (PARITY,))

    def test_sources_deduplicate_workflows_and_do_not_select_unrelated_store(self):
        self.assertEqual(scenarios_for(["resources/js/editor/fontSize.ts", "resources/js/editor/richTextEditing.tsx"]), (TEXT,))
        self.assertEqual(scenarios_for(["src/Application/Compilation/SitePartHtmlCompiler.php"]), (SITE_PART,))
        self.assertEqual(scenarios_for(["README.md", "tools/g7pb/planner.py"]), ())

    def test_layout_and_catalog_keep_separate_real_code_scenarios(self):
        self.assertEqual(scenarios_for(["resources/js/editor/catalogBlocks.tsx"]), (CATALOG_MIXED,))
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

    def test_catalog_owners_select_exact_roles_without_reading_presets(self):
        self.assertEqual(set(CATALOG_CODE_SCOPES), set(EXTRACTED_CATALOG_SCOPES))
        with tempfile.TemporaryDirectory() as directory:
            for source, expected in EXTRACTED_CATALOG_SCOPES.items():
                with self.subTest(source=source):
                    actual = scenarios_for([source])
                    self.assertEqual(set(actual), expected)
                    self.assertTrue({item.spec for item in actual}.isdisjoint({PARITY.spec, STORE.spec, MANAGER_STORE.spec}))
                    for scenario in actual:
                        self.assertEqual(scenario.projects, ("desktop",))
                        self.assertEqual(scenario.preset_prefixes, ())
                        self.assertTrue(all(value is None for _, value in scenario.environment(Path(directory))))
                        self.assertNotIn("ALL_PRESET_LAYOUT_GATE", " ".join(scenario.arguments()))
        for unknown in ("resources/js/editor/catalogCodecExtra.ts", "resources/js/editor/phase2CatalogDataExtra.ts",
                        "resources/js/blocks/externalEditorRegistryDataExtra.ts"):
            self.assertEqual(scenarios_for([unknown]), (PAGE,))

    def test_catalog_role_union_deduplicates_without_removing_existing_workflows(self):
        sources = list(EXTRACTED_CATALOG_SCOPES)
        expected = {PAGE, TEXT_AND_CONTROLS, STRUCTURE_THEME,
                    catalog_roles(CATALOG_FRAME, CATALOG_FIELDS, CATALOG_CODEC, CATALOG_RESPONSIVE)}
        self.assertEqual(set(scenarios_for(sources)), expected)
        self.assertEqual(scenarios_for([*sources, *reversed(sources)]), scenarios_for(sources))
        selected = scenarios_for(["resources/js/editor/richTextEditing.tsx", "resources/js/editor/canvasEditingContract.ts"])
        self.assertEqual(set(selected), {TEXT_AND_CONTROLS, CATALOG_STYLE})

    def test_catalog_owners_keep_units_typecheck_and_required_runtime_roles(self):
        for source, expected in EXTRACTED_CATALOG_SCOPES.items():
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                facade = "resources/js/editor/catalogFacade.ts"
                unit = "tests/Unit/catalogBehavior.test.ts"
                # Include a transitive consumer: changing a leaf must select
                # its established unit even when filenames do not correspond.
                relative = "../blocks/" if "/blocks/" in source else "./"
                files = {
                    source: "export const fixture = 1;",
                    facade: "export { fixture } from '" + relative + Path(source).name + "';",
                    unit: "import '../../resources/js/editor/catalogFacade';",
                    **{scenario.spec: "import {test} from '@playwright/test';" for scenario in expected},
                }
                for name, content in files.items():
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(content)
                for phase in ("submission", "integration", "verification", "ci"):
                    with self.subTest(source=source, phase=phase):
                        plan = build_plan(root, [source], base="missing-reviewed-base", phase=phase)
                        self.assertFalse(plan.full)
                        self.assertEqual(plan.unresolved, [])
                        gates = {gate.name: gate for gate in plan.gates}
                        self.assertIn(source, gates["unit:" + unit].inputs)
                        self.assertIn(facade, gates["unit:" + unit].inputs)
                        self.assertIn("typecheck", gates)
                        self.assertFalse(any(name.startswith(("content:", "browser-registration:")) for name in gates))
                        self.assertEqual({name for name in gates if name.startswith("browser:")},
                                         {"browser:" + scenario.spec for scenario in expected})
                        for scenario in expected:
                            gate = gates["browser:" + scenario.spec]
                            self.assertTrue(gate.runtime)
                            self.assertEqual(gate.deferred, phase == "submission")
                            self.assertEqual(gate.depends_on, ("browser-assets",))
                            self.assertIn(source, gate.inputs)
                            self.assertEqual(set(gate.browser_expectations), {("desktop", title) for title in scenario.titles})
                            self.assertTrue(all(value is None for _, value in gate.env))

    def test_catalog_spec_only_change_collects_and_missing_spec_blocks_product_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = "resources/js/editor/foundationCatalogCodec.ts"
            files = {
                source: "export const fixture = 1;",
                "tests/Unit/catalogCodec.test.ts": "import '../../resources/js/editor/foundationCatalogCodec';",
            }
            for name, content in files.items():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content)
            plan = build_plan(root, [source], phase="integration")
            self.assertIn("Missing required browser scenario: " + CATALOG_CODEC.spec, plan.unresolved)
            spec = root / CATALOG_CODEC.spec
            spec.parent.mkdir(parents=True, exist_ok=True)
            spec.write_text("import {test} from '@playwright/test';")
            for phase in ("submission", "integration", "verification", "ci"):
                with self.subTest(phase=phase):
                    plan = build_plan(root, [CATALOG_CODEC.spec], phase=phase)
                    self.assertFalse(plan.full)
                    self.assertEqual(plan.unresolved, [])
                    gates = {gate.name: gate for gate in plan.gates}
                    registration = gates["browser-registration:" + CATALOG_CODEC.spec]
                    self.assertIn("--list", registration.argv)
                    self.assertFalse(registration.runtime)
                    self.assertFalse(any(name.startswith(("browser:", "content:")) for name in gates))

    def test_rich_text_input_helper_change_collects_catalog_and_existing_consumers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            helper = "tests/E2E/support/richTextInput.ts"
            specs = {PAGE.spec, STRUCTURE_THEME.spec, CATALOG_FIELDS.spec}
            for name, content in {helper: "export const fixture = 1;",
                                  **{spec: "import {test} from '@playwright/test'; import './support/richTextInput';" for spec in specs}}.items():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content)
            plan = build_plan(root, [helper], phase="integration")
            self.assertEqual(plan.unresolved, [])
            gates = {gate.name: gate for gate in plan.gates}
            self.assertEqual({name for name in gates if name.startswith("browser-registration:")},
                             {"browser-registration:" + spec for spec in specs})
            self.assertFalse(any(name.startswith(("browser:", "content:")) for name in gates))
            for spec in specs:
                self.assertIn(helper, gates["browser-registration:" + spec].inputs)

    def test_consumer_audit_reruns_for_new_spec_import_and_transitive_input_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            audit = "tests/Harness/test_planner.py"
            helper = "tests/E2E/support/richTextInput.ts"
            bridge = "tests/E2E/support/bridge.ts"
            spec = "tests/E2E/unregistered.spec.ts"
            def write(name, body):
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(body)
            write(audit, "import unittest")
            write(helper, "export const fixture = 1;")
            for known in (PAGE.spec, STRUCTURE_THEME.spec, CATALOG_FIELDS.spec):
                write(known, "import './support/richTextInput';")
            calls = []
            # This fake executor checks receipt invalidation only. The real
            # test_planner consumer audit independently rejects wrong mappings.
            def executor(argv, **kwargs):
                calls.append(argv)
                return subprocess.CompletedProcess(argv, 0)
            def run_audit(changed):
                plan = build_plan(root, [changed], phase="integration")
                self.assertFalse(plan.full)
                self.assertEqual(plan.unresolved, [])
                self.assertFalse(any(gate.name.startswith(("browser:", "content:")) for gate in plan.gates))
                gate = next(gate for gate in plan.gates if gate.name == "python:" + audit)
                self.assertFalse(gate.runtime)
                result, records = execute(root, Plan([changed], [gate]), executor=executor, receipts=root / "receipts")
                self.assertEqual(result, 0)
                return gate, records[0]

            first, record = run_audit(helper)
            self.assertEqual(record["status"], "passed")
            _, reused = run_audit(helper)
            self.assertEqual(reused["status"], "reused")
            self.assertEqual(len(calls), 1)

            write(spec, "import {test} from '@playwright/test'; test('synthetic', () => {});")
            added, record = run_audit(spec)
            self.assertEqual(record["status"], "passed")
            self.assertIn(spec, added.inputs)
            self.assertNotEqual(digest_gate(root, first), digest_gate(root, added))
            added_key = digest_gate(root, added)

            write(bridge, "export {fixture} from './richTextInput';")
            write(spec, "import './support/bridge'; import {test} from '@playwright/test'; test('synthetic', () => {});")
            imported, record = run_audit(spec)
            self.assertEqual(record["status"], "passed")
            self.assertTrue({spec, bridge, helper}.issubset(imported.inputs))
            self.assertNotEqual(added_key, digest_gate(root, imported))
            imported_key = digest_gate(root, imported)

            write(helper, "export const fixture = 2;")
            changed, record = run_audit(helper)
            self.assertEqual(record["status"], "passed")
            self.assertNotEqual(imported_key, digest_gate(root, changed))
            self.assertEqual(len(calls), 4)
            _, reused = run_audit(helper)
            self.assertEqual(reused["status"], "reused")
            self.assertEqual(len(calls), 4)

    def test_unresolved_spec_imports_cannot_reuse_a_consumer_audit_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            audit = "tests/Harness/test_planner.py"
            spec = "tests/E2E/unregistered.spec.ts"
            for name, body in {audit: "import unittest", spec: "import './support/missing';"}.items():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(body)
            plan = build_plan(root, [spec], phase="integration")
            gate = next(gate for gate in plan.gates if gate.name == "python:" + audit)
            self.assertFalse(gate.reusable)
            self.assertIn(spec, gate.inputs)
            self.assertFalse(gate.runtime)

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
