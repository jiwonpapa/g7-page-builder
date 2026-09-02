"""Collect real Playwright registrations; never open a browser or mutate G7."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from tools.g7pb.browser_requirements import PAGE, NESTED, TEXT, CONTROLS, PARITY

ROOT = Path(__file__).resolve().parents[2]
PC_ONLY = ("editorInteractionQuality", "editorPerformance", "editorStructureTheme", "pageBuilderLifecycle", "sitePartLifecycle")


def registered_tests(report):
    def walk(suite):
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                yield (Path(spec["file"]).name, spec["title"], test["projectName"])
        for child in suite.get("suites", []):
            yield from walk(child)
    return list(walk(report))


def collect(root, arguments=(), environment=None):
    process_env = {**os.environ, **(environment or {})}
    process_env = {key: value for key, value in process_env.items() if value is not None}
    result = subprocess.run([str(ROOT / "node_modules/.bin/playwright"), "test", *arguments, "--list", "--reporter=json"],
                            cwd=root, env=process_env, text=True, capture_output=True)
    if result.returncode:
        raise ValueError(f"Playwright collection failed: {result.stderr} {result.stdout}")
    report = json.loads(result.stdout)
    if report.get("errors"):
        raise ValueError(f"Playwright collection errors: {report['errors']}")
    return registered_tests(report)


class BrowserRegistrationTests(unittest.TestCase):
    def test_editor_workflows_register_on_desktop_and_responsive_fixture_on_three_projects(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-browser-registration-") as directory:
            root = Path(directory)
            (root / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
            (root / "playwright.config.ts").write_text((ROOT / "playwright.config.ts").read_text())
            specs = root / "tests/E2E"
            specs.mkdir(parents=True)
            for name in (*PC_ONLY, "editorLayoutParity"):
                (specs / (name + ".spec.ts")).write_text("import {test} from '@playwright/test'; test('registration fixture', async()=>{});")
            actual = collect(root)
            for name in PC_ONLY:
                self.assertEqual([project for file, _, project in actual if file == name + ".spec.ts"], ["desktop"], name)
            self.assertEqual({project for file, _, project in actual if file == "editorLayoutParity.spec.ts"}, {"desktop", "tablet", "mobile"})
            self.assertEqual(len(actual), len(PC_ONLY) + 3)

    def test_focused_existing_titles_collect_exactly_the_reviewed_scenarios(self):
        scenarios = (PAGE, NESTED, TEXT, CONTROLS, PARITY)
        import re
        titles = {title for scenario in scenarios for title in scenario.titles}
        pattern = "(?:" + "|".join(re.escape(title) for title in sorted(titles)) + ")$"
        arguments = [*sorted({scenario.spec for scenario in scenarios}), "--project=desktop", "--grep", pattern]
        actual = collect(ROOT, arguments, dict(PARITY.environment(ROOT)))
        self.assertEqual(len(actual), len(titles))
        self.assertEqual({title for _, title, _ in actual}, titles)
        self.assertEqual({project for _, _, project in actual}, {"desktop"})


if __name__ == "__main__":
    unittest.main()
