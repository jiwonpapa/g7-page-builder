"""Boundary command dispatch only; the guard itself owns AST behavior tests."""
from pathlib import Path
import json
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
BOUNDARY = "scripts/check-boundaries.sh"
FIXTURE_FILES = (
    "module.php", "src/routes/api.php", "src/Providers/PageBuilderServiceProvider.php",
    "src/Infrastructure/Gnuboard7/Http/Controllers/AdminDocumentController.php",
    "src/Infrastructure/Gnuboard7/Persistence/EloquentPageBuilderRepository.php",
    "src/Infrastructure/BlockPacks/ZipBlockPackArchiveAdapter.php",
    "src/Infrastructure/BlockPacks/Ed25519BlockPackSignatureVerifier.php",
    "src/Infrastructure/BlockPacks/GitHubReleaseSourceAdapter.php",
    "src/Application/Blocks/GitHubBlockPackService.php", "resources/js/blocks/runtimeRegistry.ts",
)


class BoundaryCommandTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="g7pb-boundary-command-")
        self.addCleanup(self.temp.cleanup)
        self.controller = Path(self.temp.name) / "controller"
        self.subject = Path(self.temp.name) / "subject"
        (self.controller / "scripts").mkdir(parents=True)
        shutil.copy2(ROOT / BOUNDARY, self.controller / BOUNDARY)
        for name in FIXTURE_FILES:
            target = self.subject / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        (self.subject / "src/Domain").mkdir(exist_ok=True)
        (self.subject / "src/Contracts").mkdir(exist_ok=True)
        self.guard = self.controller / "scripts/check-design-architecture.mjs"
        self.guard.write_text("console.log('GUARD ' + JSON.stringify(process.argv.slice(2)));\n")

    def run_boundary(self, *args):
        return subprocess.run(["bash", str(self.controller / BOUNDARY), "--root", str(self.subject), *args],
                              text=True, capture_output=True)

    def test_verified_controller_passes_subject_and_selection_to_guard(self):
        # Forbidden controller content must not contaminate subject validation.
        (self.controller / "src").mkdir()
        (self.controller / "src/bad.php").write_text("G7Core.__runtime")
        result = self.run_boundary("--files", "resources/js/blocks/runtimeRegistry.ts")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        argv = json.loads(next(line.removeprefix("GUARD ") for line in result.stdout.splitlines() if line.startswith("GUARD ")))
        self.assertEqual(argv, ["--files", "resources/js/blocks/runtimeRegistry.ts", "--root", str(self.subject.resolve())])

    def test_full_boundary_entry_also_calls_guard_once(self):
        for name in FIXTURE_FILES:
            target = self.controller / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        result = subprocess.run(["bash", str(self.controller / BOUNDARY)], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stdout.count("GUARD []"), 1)

    def test_subject_violation_fails_before_guard(self):
        (self.subject / "resources/js/bad.ts").write_text("G7Core.__runtime")
        result = self.run_boundary()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Forbidden G7 frontend internal dependency", result.stderr)
        self.assertNotIn("GUARD ", result.stdout)

    def test_guard_failure_and_missing_guard_are_not_masked(self):
        self.guard.write_text("process.exit(7);\n")
        self.assertEqual(self.run_boundary().returncode, 7)
        self.guard.unlink()
        self.assertNotEqual(self.run_boundary().returncode, 0)

    def test_unknown_or_incomplete_argument_is_rejected(self):
        self.assertEqual(self.run_boundary("--files").returncode, 2)
        self.assertEqual(self.run_boundary("--skip-guard").returncode, 2)


if __name__ == "__main__":
    unittest.main()
