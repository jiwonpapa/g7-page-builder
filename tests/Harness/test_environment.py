"""Environment regressions: no Docker, network, install, or product build calls."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from g7pb import environment as env


class FakeRuntime(env.Runtime):
    def __init__(self, root):
        super().__init__(root, "local")
        self.commands = []
        self.version = "test-tools-1"
        self.fail = False
        self.missing_outputs = False

    def identity(self, kind):
        return {"runtime": self.kind, "tools": self.version, "kind": kind}

    def call(self, argv, capture=False):
        self.commands.append(argv)
        if self.fail:
            raise subprocess.CalledProcessError(1, argv)
        if argv in env.INSTALL.values():
            kind = "npm" if argv[0] == "npm" else "composer"
            if not self.missing_outputs:
                for name in env.SENTINELS[kind]:
                    path = self.root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text('{"installed": true}')
        elif argv == ["npm", "run", "build"] and not self.missing_outputs:
            for name in env.BUILD_OUTPUTS:
                path = self.root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture build")
        return ""


class EnvironmentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="g7pb-environment-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.runtime = FakeRuntime(self.root)
        self.write("package.json", {"version": "1.0.0", "dependencies": {"x": "1"}})
        self.write("package-lock.json", {"version": "1.0.0", "packages": {"": {"version": "1.0.0"}, "node_modules/x": {"version": "1"}}})
        self.write("composer.json", {"require": {"php": "^8.5"}})
        self.write("composer.lock", {"packages": []})

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value) if isinstance(value, dict) else value)

    def test_dependency_plan_does_not_install_or_write_receipts(self):
        plan = env.prepare(self.runtime, ["npm"])
        self.assertEqual(plan[0]["status"], "required")
        self.assertEqual(self.runtime.commands, [])
        self.assertFalse((self.root / ".runtime").exists())

    def test_same_inputs_reuse_and_unrelated_source_does_not_reinstall(self):
        self.assertEqual(env.prepare(self.runtime, ["npm"], True)[0]["status"], "installed")
        self.write("resources/js/editor/example.ts", "export const value = 1;")
        self.assertEqual(env.prepare(self.runtime, ["npm"], True)[0]["status"], "reused")
        self.assertEqual(self.runtime.commands, [env.INSTALL["npm"]])

    def test_version_label_does_not_reinstall(self):
        env.prepare(self.runtime, ["npm"], True)
        self.write("package.json", {"version": "1.0.1", "dependencies": {"x": "1"}})
        self.write("package-lock.json", {"version": "1.0.1", "packages": {"": {"version": "1.0.1"}, "node_modules/x": {"version": "1"}}})
        self.assertEqual(env.prepare(self.runtime, ["npm"], True)[0]["status"], "reused")

    def test_dependency_tool_or_installed_metadata_change_invalidates(self):
        env.prepare(self.runtime, ["npm"], True)
        self.write("package-lock.json", {"packages": {"node_modules/x": {"version": "2"}}})
        self.assertEqual(env.prepare(self.runtime, ["npm"], True)[0]["status"], "installed")
        self.runtime.version = "test-tools-2"
        self.assertEqual(env.prepare(self.runtime, ["npm"], True)[0]["status"], "installed")
        self.write("node_modules/.package-lock.json", {"tampered": True})
        self.assertEqual(env.prepare(self.runtime, ["npm"], True)[0]["status"], "installed")
        self.assertEqual(len(self.runtime.commands), 4)

    def test_missing_metadata_invalidates_and_php_only_does_not_install_npm(self):
        env.prepare(self.runtime, ["composer"], True)
        (self.root / "vendor/autoload.php").unlink()
        self.assertEqual(env.prepare(self.runtime, ["composer"], True)[0]["status"], "installed")
        self.assertTrue(all(command[0] == "composer" for command in self.runtime.commands))

    def test_failed_or_empty_install_has_no_success_receipt(self):
        self.runtime.fail = True
        with self.assertRaises(subprocess.CalledProcessError):
            env.prepare(self.runtime, ["npm"], True)
        self.assertEqual(env.read_state(self.root), {})
        self.runtime.fail = False
        self.runtime.missing_outputs = True
        with self.assertRaisesRegex(ValueError, "no success recorded"):
            env.prepare(self.runtime, ["npm"], True)
        self.assertEqual(env.read_state(self.root), {})

    def test_build_reuse_checks_actual_inputs_and_dist_not_repository_sha(self):
        self.write("resources/js/editor/example.ts", "export const value = 1;")
        self.write("schemas/layout-policy-v1.json", {"policy": 1})
        self.assertEqual(env.build(self.runtime, True)["build"], "built")
        self.write("README.md", "unrelated docs")
        self.assertEqual(env.build(self.runtime, True)["build"], "reused")
        self.write("schemas/layout-policy-v1.json", {"policy": 2})
        self.assertEqual(env.build(self.runtime, True)["build"], "built")
        self.write(env.BUILD_OUTPUTS[0], "different artifact")
        self.assertEqual(env.build(self.runtime, True)["build"], "built")
        self.assertEqual(self.runtime.commands.count(["npm", "run", "build"]), 3)
        self.assertEqual(self.runtime.commands.count(env.INSTALL["npm"]), 1)

    def test_build_zero_outputs_is_not_success(self):
        env.prepare(self.runtime, ["npm"], True)
        self.runtime.missing_outputs = True
        with self.assertRaisesRegex(ValueError, "no success recorded"):
            env.build(self.runtime, True)
        self.assertNotIn("local:build", env.read_state(self.root))

    def test_build_environment_file_change_invalidates_without_install(self):
        env.build(self.runtime, True)
        self.write(".env.production", "VITE_API_PREFIX=/changed")
        self.assertEqual(env.build(self.runtime, True)["build"], "built")
        self.assertEqual(self.runtime.commands.count(env.INSTALL["npm"]), 1)

    def test_parallel_preparation_fails_without_unbounded_wait(self):
        with env.state_lock(self.root):
            with self.assertRaisesRegex(ValueError, "already running"):
                with env.state_lock(self.root):
                    self.fail("the second writer must not acquire the lock")

    def test_sync_no_effect_for_css_docs_or_ordinary_php(self):
        for path in ["resources/css/editor.css", "README.md", "src/Domain/Document.php"]:
            self.assertEqual(env.sync_plan([path])["actions"], [], path)

    def test_sync_selects_only_related_public_operations(self):
        names = lambda paths: [a["name"] for a in env.sync_plan(paths)["actions"]]
        self.assertEqual(names(["database/migrations/001.php"]), ["migrate"])
        self.assertEqual(names(["resources/layouts/user/page.json"]), ["layouts", "template-cache"])
        self.assertEqual(names(["module.json"]), ["autoload", "declarative", "application-cache", "module-cache", "registry"])
        self.assertEqual(names(["resources/routes/user.json"]), ["declarative", "application-cache", "module-cache"])
        self.assertFalse(any("seo:clear" in a["argv"] for a in env.sync_plan(["module.json"])["actions"]))

    def test_runtime_configuration_reports_rebuild_and_restart_is_explicit(self):
        result = env.sync_plan(["docker/php/99-g7pb.ini"])
        self.assertEqual(result["actions"], [])
        self.assertEqual(result["requires_runtime_rebuild"], ["docker/php/99-g7pb.ini"])
        self.assertEqual(env.sync_plan([], True)["actions"][0]["name"], "fpm")

    def test_sync_plan_is_readonly_and_requires_scope(self):
        with patch.object(env.Runtime, "call") as calls, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(env.main(["sync", "--root", str(self.root), "--paths", "module.json"]), 0)
            calls.assert_not_called()
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(env.main(["sync", "--root", str(self.root)]), 2)
        self.assertFalse((self.root / ".runtime").exists())

    def test_docker_mutation_guard_runs_before_selected_action(self):
        calls = []
        with patch.object(env.Runtime, "call", side_effect=lambda argv, capture=False: calls.append(argv)), contextlib.redirect_stdout(io.StringIO()):
            code = env.main(["sync", "--root", str(self.root), "--runtime", "docker", "--task", "owned-task",
                             "--paths", "database/migrations/001.php", "--apply"])
        self.assertEqual(code, 0)
        self.assertEqual(calls[0], ["bash", "scripts/coord-harness.sh", "runtime-guard", "--task", "owned-task"])
        self.assertEqual(len(calls), 2)
        self.assertIn("migrate", calls[1])

    def test_failed_guard_does_not_mutate(self):
        with patch.object(env.Runtime, "call", side_effect=subprocess.CalledProcessError(1, ["guard"])) as calls, contextlib.redirect_stderr(io.StringIO()):
            code = env.main(["sync", "--root", str(self.root), "--runtime", "docker", "--task", "wrong-task",
                             "--paths", "module.json", "--apply"])
        self.assertEqual(code, 2)
        self.assertEqual(calls.call_count, 1)

    def test_ci_uses_single_common_plan_and_conditional_setup(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        self.assertIn("branches: [main]", workflow)
        self.assertIn("cancel-in-progress: true", workflow)
        self.assertIn("fetch-depth: 0", workflow)
        self.assertEqual(workflow.count("scripts/g7pb.py plan --base"), 1)
        self.assertEqual(workflow.count("scripts/g7pb.py run --base"), 1)
        self.assertNotIn("npm run check", workflow)
        self.assertNotIn("composer check", workflow)
        self.assertIn("if: steps.plan.outputs.node == 'true'", workflow)
        self.assertIn("if: steps.plan.outputs.g7 == 'true'", workflow)
        wrapper = (ROOT / "scripts/dev-sync-module.sh").read_text()
        self.assertLessEqual(len(wrapper.splitlines()), 6)
        self.assertNotIn("--apply", wrapper)


if __name__ == "__main__":
    unittest.main()
