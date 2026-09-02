"""Fail-closed acceptance of a selected Playwright execution report."""
import json
from pathlib import Path


def browser_verdict(path: Path, expected=()) -> dict:
    try:
        report = json.loads(path.read_text())
    except (OSError, ValueError) as error:
        raise ValueError("Browser result report is missing or invalid; no acceptance") from error
    if not isinstance(report, dict) or report.get("errors"):
        raise ValueError("Browser report contains errors")
    stats = report.get("stats", {})
    if not isinstance(stats, dict) or any(type(stats.get(key)) is not int for key in ("expected", "skipped", "unexpected", "flaky")):
        raise ValueError("Browser report has invalid execution counts")
    if stats["expected"] < 1 or any(stats[key] != 0 for key in ("skipped", "unexpected", "flaky")):
        raise ValueError("Required browser cases must execute and pass: zero, skipped, failed or flaky results are not acceptance")
    cases = []

    def visit(suites):
        if not isinstance(suites, list):
            raise ValueError("Invalid browser suites")
        for suite in suites:
            if not isinstance(suite, dict):
                raise ValueError("Invalid browser suite")
            for spec in suite.get("specs", []):
                if not spec.get("ok") or not spec.get("tests"):
                    raise ValueError("An expected browser test did not execute")
                for test in spec["tests"]:
                    results = test.get("results", [])
                    if (test.get("expectedStatus") != "passed" or test.get("status") != "expected" or not results
                        or any(result.get("status") != "passed" for result in results)
                        or any(annotation.get("type") in {"skip", "fixme", "fail"} for annotation in test.get("annotations", []))):
                        raise ValueError("Skipped, expected-failure or incomplete browser test cannot satisfy acceptance")
                    cases.append((test.get("projectName"), spec.get("title")))
            visit(suite.get("suites", []))

    try:
        visit(report.get("suites"))
    except (TypeError, AttributeError, KeyError) as error:
        raise ValueError("Invalid browser test results") from error
    if len(cases) != stats["expected"]:
        raise ValueError("Browser case list does not match execution counts")
    if any(cases.count(tuple(case)) != 1 for case in expected):
        raise ValueError("A required browser scenario/project did not execute exactly once")
    return {"passed": len(cases), "required": len(expected), "skipped": 0}
