from pathlib import Path
import subprocess
import tempfile
import unittest
from tools.g7pb.model import Gate, Plan
from tools.g7pb.runner import execute


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "a").write_text("one")
        self.receipts = self.root / "receipts"
        self.calls = []

    def executor(self, argv, **kwargs):
        self.calls.append(argv)
        return subprocess.CompletedProcess(argv, 0)

    def run_plan(self, gates, executor=None):
        return execute(self.root, Plan(["a"], gates), receipts=self.receipts, executor=executor or self.executor)

    def gate(self, name="a", argv=("check",), inputs=("a",)):
        return Gate(name, argv, inputs, "test")

    def test_success_reused_across_submission_integration(self):
        self.run_plan([self.gate()])
        (self.root / "unrelated").write_text("new")
        _, records = self.run_plan([self.gate()])
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(records[0]["status"], "reused")

    def test_changed_input_reruns_only_affected_gate(self):
        (self.root / "b").write_text("fixed")
        gates = [self.gate(), self.gate("b", inputs=("b",))]
        self.run_plan(gates)
        (self.root / "a").write_text("two")
        _, records = self.run_plan(gates)
        self.assertEqual([r["status"] for r in records], ["passed", "reused"])
        self.assertEqual(len(self.calls), 3)

    def test_different_selected_tests_do_not_share_receipt(self):
        self.run_plan([self.gate(argv=("check", "first"))])
        self.run_plan([self.gate(argv=("check", "first", "second"))])
        self.assertEqual(len(self.calls), 2)

    def test_failure_has_no_retry_and_resume_reuses_success(self):
        gates = [self.gate(), self.gate("failing", ("fail",)), self.gate("later", ("later",))]
        def fail(argv, **kwargs):
            self.calls.append(argv)
            return subprocess.CompletedProcess(argv, int(argv == ["fail"]))
        code, _ = self.run_plan(gates, fail)
        self.assertEqual(code, 1)
        self.assertEqual(self.calls, [["check"], ["fail"]])
        self.run_plan(gates)
        self.assertEqual(self.calls, [["check"], ["fail"], ["fail"], ["later"]])

    def test_unresolved_plan_executes_nothing(self):
        with self.assertRaises(ValueError):
            execute(self.root, Plan(["a"], [self.gate()], ["missing mapping"]), receipts=self.receipts, executor=self.executor)
        self.assertEqual(self.calls, [])

    def test_no_checks_is_not_product_pass(self):
        self.assertEqual(self.run_plan([]), (0, []))
        self.assertEqual(list(self.receipts.glob("*.json")), [])

    def test_changed_input_during_execution_cannot_create_success(self):
        def mutate(argv, **kwargs):
            (self.root / "a").write_text("changed during execution")
            return subprocess.CompletedProcess(argv, 0)
        with self.assertRaisesRegex(ValueError, "Inputs changed"):
            self.run_plan([self.gate()], mutate)
        self.assertEqual(list(self.receipts.glob("*.json")), [])

    def test_incomplete_input_graph_disables_reuse_not_scope(self):
        gate = Gate("dynamic", ("one-test",), ("a",), "dynamic input", reusable=False)
        self.run_plan([gate])
        self.run_plan([gate])
        self.assertEqual(self.calls, [["one-test"], ["one-test"]])
        self.assertEqual(list(self.receipts.glob("*.json")), [])

    def test_submission_deferral_is_not_a_success_receipt(self):
        gate = Gate("browser", ("browser",), ("a",), "required integration", runtime=True, deferred=True)
        code, records = execute(self.root, Plan(["a"], [gate], phase="submission"), receipts=self.receipts, executor=self.executor)
        self.assertEqual(code, 0)
        self.assertEqual(records, [{"gate": "browser", "status": "deferred", "executions": 0}])
        self.assertEqual(self.calls, [])
        self.assertEqual(list(self.receipts.glob("*.json")), [])

    def test_integration_cannot_accept_a_deferred_runtime_gate(self):
        gate = Gate("browser", ("browser",), ("a",), "required", runtime=True, deferred=True)
        for phase in ("integration", "verification", "ci"):
            with self.subTest(phase=phase), self.assertRaisesRegex(ValueError, "Only submission"):
                execute(self.root, Plan(["a"], [gate], phase=phase), receipts=self.receipts, executor=self.executor)

    def test_non_runtime_gate_cannot_be_deferred(self):
        gate = Gate("types", ("types",), ("a",), "required", deferred=True)
        with self.assertRaisesRegex(ValueError, "Only submission"):
            execute(self.root, Plan(["a"], [gate], phase="submission"), receipts=self.receipts, executor=self.executor)


if __name__ == "__main__":
    unittest.main()
