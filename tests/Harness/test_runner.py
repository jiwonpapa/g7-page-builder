from pathlib import Path
from dataclasses import replace
from unittest.mock import patch
import json
import subprocess
import tempfile
import unittest
from tools.g7pb.model import Gate, Plan
from tools.g7pb.runner import digest_gate, execute
from tools.g7pb.state import CoordError


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

    def runtime_pair(self, *, deferred=False):
        assets = Gate("browser-assets", ("python3", "environment", "build"), ("a",), "candidate assets",
                      runtime=True, execution="controller", deferred=deferred)
        browser = Gate("browser:selected", ("npx", "playwright", "test"), ("a",), "behavior",
                       runtime=True, depends_on=(assets.name,), deferred=deferred,
                       env=(("G7PB_PRESET_IDS", "hero.service-intro"), ("G7PB_PAGE_KIT_IDS", None)))
        return assets, browser

    def test_controller_build_precedes_container_browser_and_selectors_reach_container(self):
        assets, browser = self.runtime_pair()
        with patch.dict("os.environ", {"CI": ""}), patch("tools.g7pb.runner.subprocess.run") as guard:
            code, records = execute(self.root, Plan(["a"], [assets, browser]), task="owner", receipts=self.receipts, executor=self.executor)
        self.assertEqual(code, 0)
        self.assertEqual(self.calls[0], list(assets.argv))
        self.assertEqual(self.calls[1][:2], ["docker", "compose"])
        evidence = records[1]["evidence"]
        self.assertEqual(self.calls[1][-10:], ["env", "-u", "G7PB_PAGE_KIT_IDS", "G7PB_PRESET_IDS=hero.service-intro",
                         "PLAYWRIGHT_HTML_OUTPUT_DIR=" + evidence["report"], "npx", "playwright", "test", "--output", evidence["results"]])
        self.assertFalse(Path(evidence["report"]).is_absolute())
        self.assertTrue(evidence["directory"].startswith("output/playwright/gates/owner/"))
        self.assertEqual([r["gate"] for r in records], [assets.name, browser.name])
        self.assertEqual(guard.call_count, 2)
        self.assertEqual(list(self.receipts.glob("*.json")), [])

    def test_failed_asset_preparation_prevents_browser_without_retry(self):
        assets, browser = self.runtime_pair()
        def failure(argv, **kwargs):
            self.calls.append(argv)
            return subprocess.CompletedProcess(argv, 2)
        with patch.dict("os.environ", {"CI": ""}), patch("tools.g7pb.runner.subprocess.run"):
            code, records = execute(self.root, Plan(["a"], [assets, browser]), task="owner", receipts=self.receipts, executor=failure)
        self.assertEqual(code, 2)
        self.assertEqual(self.calls, [list(assets.argv)])
        self.assertEqual(len(records), 1)

    def test_invalid_or_out_of_order_dependencies_execute_nothing(self):
        assets, browser = self.runtime_pair()
        for gates in ([browser, assets], [browser], [assets, assets]):
            with self.subTest(gates=gates), self.assertRaisesRegex(ValueError, "dependency"):
                self.run_plan(gates)
        self.assertEqual(self.calls, [])

    def test_submission_defers_build_and_browser_together(self):
        gates = self.runtime_pair(deferred=True)
        code, records = execute(self.root, Plan(["a"], list(gates), phase="submission"), receipts=self.receipts, executor=self.executor)
        self.assertEqual(code, 0)
        self.assertEqual([r["status"] for r in records], ["deferred", "deferred"])
        self.assertEqual(self.calls, [])
        self.assertFalse((self.root / "output").exists())

    def test_local_browser_attempts_preserve_failures_without_changing_digest_or_scope(self):
        browser = replace(self.runtime_pair()[1], depends_on=(), requires=("browser",))
        later = replace(browser, name="browser:later", argv=(*browser.argv, "later.spec.ts"))
        expected_key = digest_gate(self.root, browser)
        observed = []
        failing = True
        def capture(argv, **kwargs):
            observed.append((argv, kwargs["env"]))
            output = self.root / argv[-1]
            output.mkdir(parents=True)
            (output / "failure.txt").write_text("first failure" if failing else "retry result")
            return subprocess.CompletedProcess(argv, int(failing))
        with patch.dict("os.environ", {"CI": "true", "G7PB_BASE_URL": "http://fixture.invalid",
                                       "PLAYWRIGHT_HTML_OUTPUT_DIR": "/foreign/report"}):
            code, first = execute(self.root, Plan(["a"], [browser, later]), receipts=self.receipts, executor=capture)
            self.assertEqual(code, 1)
            self.assertEqual(len(observed), 1)
            failing = False
            code, second = execute(self.root, Plan(["a"], [browser, later]), receipts=self.receipts, executor=capture)
        self.assertEqual(code, 0)
        self.assertEqual([record["status"] for record in first + second], ["failed", "passed", "passed"])
        self.assertEqual(first[0]["key"], second[0]["key"])
        self.assertEqual(digest_gate(self.root, browser), expected_key)
        self.assertEqual(len({record["evidence"]["directory"] for record in first + second}), 3)
        for record, (argv, environment) in zip(first + second, observed):
            evidence = record["evidence"]
            self.assertEqual(argv[-2:], ["--output", evidence["results"]])
            self.assertEqual(environment["PLAYWRIGHT_HTML_OUTPUT_DIR"], evidence["report"])
            saved = json.loads((self.root / evidence["directory"] / "execution.json").read_text())
            self.assertEqual(saved["status"], record["status"])
            self.assertEqual(saved["key"], record["key"])
        self.assertEqual((self.root / first[0]["evidence"]["results"] / "failure.txt").read_text(), "first failure")
        self.assertEqual(list(self.receipts.glob("*.json")), [])

    def test_invalid_task_cannot_create_evidence_or_execute_a_guard(self):
        for task in ("../escape", "/absolute", "nested/task", "with space", ".", "..", "x"):
            with self.subTest(task=task), patch("tools.g7pb.runner.subprocess.run") as guard, self.assertRaises(CoordError):
                execute(self.root, Plan(["a"], list(self.runtime_pair())), task=task,
                        receipts=self.receipts, executor=self.executor)
            guard.assert_not_called()
        self.assertFalse((self.root / "output").exists())
        self.assertEqual(self.calls, [])

    def test_evidence_does_not_follow_an_output_symlink_outside_checkout(self):
        with tempfile.TemporaryDirectory() as foreign:
            (self.root / "output").symlink_to(foreign, target_is_directory=True)
            browser = replace(self.runtime_pair()[1], depends_on=())
            with patch.dict("os.environ", {"CI": "true"}), self.assertRaisesRegex(ValueError, "inside the checkout"):
                self.run_plan([browser])
            self.assertEqual(list(Path(foreign).iterdir()), [])
        self.assertEqual(self.calls, [])

    def test_browser_collection_remains_a_reusable_non_runtime_check(self):
        gate = self.gate("browser:collection", ("npx", "playwright", "test", "--list"))
        self.run_plan([gate])
        self.run_plan([gate])
        self.assertEqual(self.calls, [list(gate.argv)])
        self.assertFalse((self.root / "output").exists())

    def test_deferred_build_cannot_support_non_deferred_browser(self):
        assets, browser = self.runtime_pair()
        with self.assertRaisesRegex(ValueError, "predecessor did not pass"):
            execute(self.root, Plan(["a"], [replace(assets, deferred=True), browser], phase="submission"),
                    receipts=self.receipts, executor=self.executor)
        self.assertEqual(self.calls, [])

    def test_runtime_preparation_needs_lease_and_ci_browser_runtime(self):
        assets, browser = self.runtime_pair()
        assets = replace(assets, requires=("browser",))
        with patch.dict("os.environ", {"CI": ""}), self.assertRaisesRegex(ValueError, "Runtime lease"):
            self.run_plan([assets, browser])
        with patch.dict("os.environ", {"CI": "true", "G7PB_BASE_URL": ""}), self.assertRaisesRegex(ValueError, "CI browser runtime"):
            self.run_plan([assets, browser])
        self.assertEqual(self.calls, [])

    def test_build_reuses_exact_artifacts_and_rebuilds_changed_source_or_dist_before_browser(self):
        import json
        from tools.g7pb.environment import BUILD_OUTPUTS, build
        from tests.Harness.test_environment import FakeRuntime
        source = self.root / "resources/js/app.ts"
        source.parent.mkdir(parents=True)
        source.write_text("first candidate")
        (self.root / "package.json").write_text(json.dumps({"scripts": {"build": "vite"}}))
        (self.root / "package-lock.json").write_text(json.dumps({"packages": {"": {}}}))
        runtime = FakeRuntime(self.root)
        original = runtime.call
        def prepare(argv, capture=False):
            result = original(argv, capture)
            if argv == ["npm", "run", "build"]:
                for name in BUILD_OUTPUTS:
                    (self.root / name).write_text(source.read_text())
            return result
        runtime.call = prepare
        statuses = []
        def executor(argv, **kwargs):
            if argv[0] == "python3":
                statuses.append(build(runtime, True)["build"])
            else:
                self.assertEqual((self.root / BUILD_OUTPUTS[0]).read_text(), source.read_text())
            return subprocess.CompletedProcess(argv, 0)
        gates = [replace(g, inputs=("resources/js/app.ts",)) for g in self.runtime_pair()]
        with patch.dict("os.environ", {"CI": ""}), patch("tools.g7pb.runner.subprocess.run"):
            def check():
                code, _ = execute(self.root, Plan(["resources/js/app.ts"], gates), task="owner", receipts=self.receipts, executor=executor)
                self.assertEqual(code, 0)
            check()
            check()
            source.write_text("second candidate")
            check()
            (self.root / BUILD_OUTPUTS[0]).write_text("stale or foreign dist")
            check()
        self.assertEqual(statuses, ["built", "reused", "built", "built"])
        self.assertEqual(runtime.commands.count(["npm", "run", "build"]), 3)


if __name__ == "__main__":
    unittest.main()
