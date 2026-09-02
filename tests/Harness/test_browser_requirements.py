from pathlib import Path
import tempfile
import unittest
from tools.g7pb.browser_requirements import PAGE, TEXT, PARITY, SITE_PART, scenarios_for
from tools.g7pb.planner import build_plan


class BrowserRequirementsTests(unittest.TestCase):
    def test_existing_behavior_selected_without_modifying_spec(self):
        self.assertEqual(scenarios_for(["resources/js/editor/richTextEditing.tsx"]), (TEXT,))
        self.assertEqual(set(scenarios_for(["resources/js/editor/PuckEditorAdapter.tsx"])), {PAGE, TEXT})

    def test_sources_deduplicate_workflows_and_do_not_select_unrelated_store(self):
        self.assertEqual(scenarios_for(["resources/js/editor/fontSize.ts", "resources/js/editor/richTextEditing.tsx"]), (TEXT,))
        self.assertEqual(scenarios_for(["src/Application/Compilation/SitePartHtmlCompiler.php"]), (SITE_PART,))
        self.assertEqual(scenarios_for(["README.md", "tools/g7pb/planner.py"]), ())

    def test_layout_rendering_uses_real_parity_scenario(self):
        self.assertEqual(scenarios_for(["resources/js/editor/catalogBlocks.tsx"]), (PARITY,))
        self.assertEqual(scenarios_for(["resources/js/editor/layoutCatalogBlocks.tsx"]), (PAGE,))

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


if __name__ == "__main__":
    unittest.main()
