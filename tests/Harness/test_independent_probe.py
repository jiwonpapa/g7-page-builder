from pathlib import Path
import tempfile
import unittest
from tools.g7pb.independent_probe import FILES, CONTROLLERS, gates
from tools.g7pb.planner import build_plan


class IndependentProbeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for path in (*FILES, *CONTROLLERS, "vite.puck-history.ts", "tsconfig.json", "package-lock.json"):
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("{}" if path.endswith(".json") else "")

    def test_exact_inputs_select_same_bounded_gates_in_all_phases(self):
        for phase in ("submission", "integration", "verification", "ci"):
            for path in FILES:
                plan = build_plan(self.root, [path], phase=phase)
                self.assertFalse(plan.unresolved, plan.unresolved)
                selected = {gate.name: gate for gate in plan.gates}
                self.assertEqual(set(selected), {"independent-probe:unit", "independent-probe:browser"})
                browser = selected["independent-probe:browser"]
                self.assertEqual(browser.deferred, phase == "submission")
                self.assertEqual(browser.execution, "controller")
                self.assertTrue(browser.runtime)
                self.assertFalse(browser.reusable)  # Fresh browser binary/OS state is not a static digest.
                self.assertEqual(browser.requires, ("node",))
                self.assertEqual(browser.depends_on, ("independent-probe:unit",))
                self.assertTrue(set(FILES).issubset(browser.inputs))
                self.assertNotIn("browser-assets", selected)  # No G7/Docker sync/build.

    def test_no_directory_exemption_or_product_dependency_exemption(self):
        for path in ("tests/IndependentEditor/unclaimed.ts", "package.json", "schemas/new.json"):
            self.assertTrue(build_plan(self.root, [path]).unresolved)
        self.assertEqual(gates(self.root, ["README.md"], "submission"), ((), ()))

    def test_missing_probe_dependency_fails_closed(self):
        (self.root / "tests/IndependentEditor/model.ts").unlink()
        plan = build_plan(self.root, [FILES[1]])
        self.assertIn("Missing independent probe input: tests/IndependentEditor/model.ts", plan.unresolved)
