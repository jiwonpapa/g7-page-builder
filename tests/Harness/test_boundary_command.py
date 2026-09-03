"""Controller/subject dispatch and the live Block Pack registration boundary."""
from pathlib import Path
import json
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
BOUNDARY = "scripts/check-boundaries.sh"
REGISTRY_GUARD = "scripts/lib/blockPackRegistryBoundary.mjs"
REGISTRY = "resources/js/blocks/runtimeRegistry.ts"
CATALOG = "resources/js/blocks/builtinCatalog.ts"
LEAF = "resources/js/blocks/externalEditorRegistryData.ts"
REGISTRATION = """import { BUILTIN_BLOCK_DEFINITIONS } from './builtinCatalog';
const registrations = new Map();
const builtinEditorComponents = new Set(BUILTIN_BLOCK_DEFINITIONS.map((definition) => definition.editor_component));
function register(registration) {
  for (const block of registration.blocks) {
    if (!block.editor_component || builtinEditorComponents.has(block.editor_component)) {
      throw new Error('Builtin editor override');
    }
  }
  registrations.set(registration.pack_id, registration);
}
"""
BRIDGE = """if (typeof window !== 'undefined') {
  window.G7PageBuilderBlockPacks = { register };
}
"""
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
        (self.controller / REGISTRY_GUARD).parent.mkdir(parents=True)
        shutil.copy2(ROOT / REGISTRY_GUARD, self.controller / REGISTRY_GUARD)
        (self.controller / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
        for name in FIXTURE_FILES:
            target = self.subject / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        self.write_registry(REGISTRATION + BRIDGE)
        (self.subject / CATALOG).write_text("export const BUILTIN_BLOCK_DEFINITIONS = [{editor_component: 'Hero'}];\n")
        (self.subject / "src/Domain").mkdir(exist_ok=True)
        (self.subject / "src/Contracts").mkdir(exist_ok=True)
        self.guard = self.controller / "scripts/check-design-architecture.mjs"
        self.guard.write_text("console.log('GUARD ' + JSON.stringify(process.argv.slice(2)));\n")

    def write_registry(self, source):
        (self.subject / REGISTRY).write_text(source)

    def run_registry(self):
        return subprocess.run(["node", str(self.controller / REGISTRY_GUARD), "--root", str(self.subject)],
                              text=True, capture_output=True)

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
        (self.controller / REGISTRY).write_text(REGISTRATION + BRIDGE)
        shutil.copy2(self.subject / CATALOG, self.controller / CATALOG)
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

    def test_registry_named_import_extraction_preserves_live_guard(self):
        (self.subject / LEAF).write_text(REGISTRATION.replace("function register(", "export function registerExternalEditor("))
        self.write_registry("import {registerExternalEditor as checkedRegister} from './externalEditorRegistryData';\n"
                            + BRIDGE.replace("{ register }", "{ register: checkedRegister }"))
        result = self.run_registry()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        # The same candidate works under the verified controller shell.
        result = self.run_boundary()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_registry_bridge_and_validation_mutations_fail_closed(self):
        invalid = {
            "disconnected bridge": REGISTRATION + "function unused() {" + BRIDGE + "}",
            "comment only bridge": REGISTRATION + "/*" + BRIDGE + "*/",
            "unvalidated function": REGISTRATION + "function unsafe(value) {}\n" + BRIDGE.replace("{ register }", "{ register: unsafe }"),
            "shadowed function": REGISTRATION + BRIDGE.replace("  window.", "  const register = () => {};\n  window."),
            "spread override": REGISTRATION + BRIDGE.replace("{ register }", "{ register, ...unsafe }"),
            "comment guard": REGISTRATION.replace("builtinEditorComponents.has(block.editor_component)", "false /* builtinEditorComponents.has(block.editor_component) */") + BRIDGE,
            "isolated dummy": REGISTRATION.replace("builtinEditorComponents.has(block.editor_component)", "false") + "function unused(block) { if (builtinEditorComponents.has(block.editor_component)) throw Error(); }" + BRIDGE,
            "unrelated descriptor": REGISTRATION.replace("has(block.editor_component)", "has(registration.editor_component)") + BRIDGE,
            "dead condition": REGISTRATION.replace("builtinEditorComponents.has(block.editor_component)", "(false && builtinEditorComponents.has(block.editor_component))") + BRIDGE,
            "nonthrowing guard": REGISTRATION.replace("throw new Error('Builtin editor override');", "console.log('not rejected');") + BRIDGE,
            "caught rejection": REGISTRATION.replace("  for (", "  try { for (").replace("  registrations.set", "  } catch {}\n  registrations.set") + BRIDGE,
            "registration before guard": REGISTRATION.replace("  for (", "  registrations.set(registration.pack_id, registration);\n  for (").replace("  registrations.set(registration.pack_id, registration);\n}", "}") + BRIDGE,
            "external Set shadows intrinsic": "import {Set} from 'untrusted';\n" + REGISTRATION + BRIDGE,
            "empty set": REGISTRATION.replace("new Set(BUILTIN_BLOCK_DEFINITIONS.map((definition) => definition.editor_component))", "new Set()") + BRIDGE,
            "local fake catalog": REGISTRATION.replace("import { BUILTIN_BLOCK_DEFINITIONS } from './builtinCatalog';", "const BUILTIN_BLOCK_DEFINITIONS = [];") + BRIDGE,
            "cleared builtin set": REGISTRATION.replace("function register(registration) {", "function register(registration) {\n  builtinEditorComponents.clear();") + BRIDGE,
            # Given [safe descriptor, builtin descriptor], the second item must
            # also reach the throw; checking only the first then storing is unsafe.
            "break skips later builtin": REGISTRATION.replace("    }\n  }", "    }\n    break;\n  }") + BRIDGE,
            "nested break skips later builtin": REGISTRATION.replace("    }\n  }", "    }\n    if (registration.stop) break;\n  }") + BRIDGE,
            "has method overwritten": REGISTRATION.replace("function register(registration) {", "function register(registration) {\n  builtinEditorComponents.has = () => false;") + BRIDGE,
            "guard loop can skip": REGISTRATION.replace("    if (", "    if (registration.skip) continue;\n    if (") + BRIDGE,
        }
        for name, source in invalid.items():
            with self.subTest(name=name):
                self.write_registry(source)
                result = self.run_registry()
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn("Block Pack registry boundary:", result.stderr)

    def test_registry_missing_dependency_cycle_and_root_escape_fail(self):
        self.write_registry("import {register} from './externalEditorRegistryData';\n" + BRIDGE)
        missing = self.run_registry()
        self.assertNotEqual(missing.returncode, 0)
        self.assertIn("missing registration dependency", missing.stderr)
        (self.subject / LEAF).write_text("export {register} from './runtimeRegistry';")
        # A cycle of explicit runtime re-exports is not a usable register owner.
        self.write_registry("export {register} from './externalEditorRegistryData';\nimport {register} from './externalEditorRegistryData';\n" + BRIDGE)
        self.assertIn("cyclic registration binding", self.run_registry().stderr)
        outside = Path(self.temp.name) / "outside.ts"
        outside.write_text(REGISTRATION.replace("function register(", "export function register("))
        (self.subject / LEAF).unlink()
        (self.subject / LEAF).symlink_to(outside)
        self.assertIn("source escapes subject root", self.run_registry().stderr)

    def test_registry_rejection_is_not_satisfied_by_controller_or_fake_subject_guard(self):
        (self.controller / REGISTRY).parent.mkdir(parents=True)
        (self.controller / REGISTRY).write_text(REGISTRATION + BRIDGE)
        self.write_registry("// builtinEditorComponents\n" + BRIDGE)
        fake = self.subject / REGISTRY_GUARD
        fake.parent.mkdir(parents=True)
        fake.write_text("console.log('FAKE PASS');")
        result = self.run_boundary()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("FAKE PASS", result.stdout)
        self.assertNotIn("GUARD ", result.stdout)
        (self.controller / REGISTRY_GUARD).unlink()
        self.assertNotEqual(self.run_boundary().returncode, 0)

    def test_unknown_or_incomplete_argument_is_rejected(self):
        self.assertEqual(self.run_boundary("--files").returncode, 2)
        self.assertEqual(self.run_boundary("--skip-guard").returncode, 2)


if __name__ == "__main__":
    unittest.main()
