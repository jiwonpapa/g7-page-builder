"""Result contracts only; no browser, runtime or content rendering."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from tools.g7pb.browser_verdict import browser_verdict


def report():
    return {"errors": [], "stats": {"expected": 1, "skipped": 0, "unexpected": 0, "flaky": 0},
            "suites": [{"specs": [{"title": "required", "ok": True, "tests": [{"projectName": "desktop",
                        "expectedStatus": "passed", "status": "expected", "results": [{"status": "passed"}]}]}]}]}


class BrowserVerdictTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="g7pb-verdict-")
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "result.json"

    def validate(self, value, expected=()):
        self.path.write_text(json.dumps(value))
        return browser_verdict(self.path, expected)

    def test_expected_case_project_must_actually_pass(self):
        self.assertEqual(self.validate(report(), (("desktop", "required"),))["passed"], 1)
        for expected in ((("mobile", "required"),), (("desktop", "missing"),)):
            with self.assertRaisesRegex(ValueError, "required browser scenario"):
                self.validate(report(), expected)

    def test_zero_skip_failure_flaky_and_missing_report_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing or invalid"):
            browser_verdict(self.path)
        for key in ("expected", "skipped", "unexpected", "flaky"):
            value = report()
            value["stats"][key] = 0 if key == "expected" else 1
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.validate(value)

    def test_expected_failure_or_missing_execution_cannot_be_green(self):
        for patch in ({"expectedStatus": "failed"}, {"results": []}, {"results": [{"status": "skipped"}]},
                      {"annotations": [{"type": "fixme"}]}):
            value = report()
            value["suites"][0]["specs"][0]["tests"][0].update(patch)
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                self.validate(value)

    def test_report_count_cannot_disagree_with_actual_cases(self):
        value = report()
        value["stats"]["expected"] = 2
        with self.assertRaisesRegex(ValueError, "counts"):
            self.validate(value)
        value = report()
        value["suites"][0]["specs"].append(copy.deepcopy(value["suites"][0]["specs"][0]))
        value["stats"]["expected"] = 2
        with self.assertRaisesRegex(ValueError, "exactly once"):
            self.validate(value, (("desktop", "required"),))


if __name__ == "__main__":
    unittest.main()
