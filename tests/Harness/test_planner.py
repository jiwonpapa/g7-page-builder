import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from tools.g7pb.planner import build_plan, changed_paths, python_inputs, content_policy, checker_controller_root


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def test_docs_have_no_product_gate(self):
        plan = build_plan(self.root, ["README.md"])
        self.assertEqual(plan.gates, [])
        self.assertEqual(plan.unresolved, [])

    def test_unknown_never_falls_back_to_full(self):
        plan = build_plan(self.root, ["unclassified.dat"])
        self.assertTrue(plan.unresolved)
        self.assertFalse(plan.full)
        self.assertFalse(plan.gates)

    def test_version_number_is_not_full(self):
        self.write("package.json", json.dumps({"version": "2", "dependencies": {"a": "1"}}))
        with patch("tools.g7pb.planner.git", return_value=json.dumps({"version": "1", "dependencies": {"a": "1"}})):
            plan = build_plan(self.root, ["package.json"])
        self.assertEqual([g.name for g in plan.gates], ["version"])
        self.assertFalse(plan.unresolved)

    def test_dependency_version_is_not_treated_as_metadata(self):
        self.write("package-lock.json", json.dumps({"version": "2", "packages": {"": {"version": "2"}, "node_modules/a": {"version": "2"}}}))
        with patch("tools.g7pb.planner.git", return_value=json.dumps({"version": "1", "packages": {"": {"version": "1"}, "node_modules/a": {"version": "1"}}})):
            plan = build_plan(self.root, ["package-lock.json"])
        self.assertTrue(plan.unresolved)
        self.assertNotIn("full-product", [g.name for g in plan.gates])

    def test_migration_selects_real_loading_integration_test_and_syntax_without_full(self):
        migration = "database/migrations/001_fixture.php"
        test = "tests/Integration/Gnuboard7/FixtureTest.php"
        self.write(migration, "<?php return new stdClass;")
        self.write(test, "<?php foreach(glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $file) require $file;")
        for phase in ("submission", "integration"):
            plan = build_plan(self.root, [migration], phase=phase)
            self.assertFalse(plan.unresolved)
            self.assertFalse(plan.full)
            self.assertEqual({g.name for g in plan.gates}, {"syntax:" + migration, "php:" + test})
            gate = next(g for g in plan.gates if g.name == "php:" + test)
            self.assertIn(migration, gate.inputs)
            self.assertEqual(gate.deferred, phase == "submission")
            self.assertTrue(gate.runtime)
            self.assertFalse(gate.reusable)
            self.assertFalse(plan.requirements["browser"])

    def test_unknown_migration_consumer_is_an_error_not_full(self):
        self.write("database/migrations/001_fixture.php", "<?php return new stdClass;")
        plan = build_plan(self.root, ["database/migrations/001_fixture.php"])
        self.assertTrue(plan.unresolved)
        self.assertFalse(plan.full)

    def test_php_without_related_tests_does_not_pass(self):
        self.write("src/Domain/Example.php", "<?php class Example {}")
        plan = build_plan(self.root, ["src/Domain/Example.php"])
        self.assertTrue(any("No related test" in e for e in plan.unresolved))

    def test_related_existing_test_need_not_be_modified(self):
        self.write("resources/js/title.ts", "export const title = 1")
        self.write("tests/Unit/title.test.ts", "import {title} from '../../resources/js/title'")
        plan = build_plan(self.root, ["resources/js/title.ts"])
        self.assertFalse(plan.unresolved)
        self.assertEqual({g.name for g in plan.gates}, {"unit:tests/Unit/title.test.ts", "typecheck", "architecture"})

    def test_normative_docs_select_structure_check_not_product_full(self):
        plan = build_plan(self.root, ["AGENTS.md", "docs/development-constitution.md"])
        self.assertEqual([g.name for g in plan.gates], ["architecture"])
        self.assertFalse(plan.requirements["browser"])
        self.assertFalse(plan.full)
        self.assertTrue(any(p.endswith("config/design-architecture.json") for p in plan.gates[0].inputs))

    def test_verified_controller_checks_the_owning_worktree(self):
        self.write("resources/js/title.ts", "export const title = 1")
        self.write("tests/Unit/title.test.ts", "import '../../resources/js/title'")
        gate = next(g for g in build_plan(self.root, ["resources/js/title.ts"]).gates if g.name == "architecture")
        self.assertEqual(gate.argv[gate.argv.index("--root") + 1], str(self.root.resolve()))
        self.assertTrue(Path(gate.argv[1]).is_absolute())
        self.assertNotEqual(Path(gate.argv[1]).parent.parent, self.root)
        self.assertIn("resources/js/title.ts", gate.inputs)
        self.assertTrue(any(Path(p).is_absolute() and p.endswith("design-architecture.json") for p in gate.inputs))

    def test_guard_change_executes_candidate_guard_in_owning_worktree(self):
        plan = build_plan(self.root, ["scripts/check-design-architecture.mjs", "config/design-architecture.json"])
        gate = next(g for g in plan.gates if g.name == "architecture")
        self.assertEqual(gate.argv[:2], ("node", "scripts/check-design-architecture.mjs"))
        self.assertNotIn("--root", gate.argv)
        self.assertIn("config/design-architecture.json", gate.inputs)
        self.assertIn("design-architecture-tests", [g.name for g in plan.gates])

    def test_php_source_requires_static_analysis_and_boundaries(self):
        self.write("src/Domain/Example.php", "<?php class Example {}")
        self.write("tests/UnitPhp/ExampleTest.php", "<?php class ExampleTest {}")
        plan = build_plan(self.root, ["src/Domain/Example.php"])
        self.assertTrue({"php-lint", "phpstan:core", "architecture"}.issubset(g.name for g in plan.gates))
        static = next(g for g in plan.gates if g.name == "phpstan:core")
        self.assertEqual(static.argv[-1], "src/Domain/Example.php")
        self.assertFalse(static.runtime)

    def test_related_transitive_import_is_selected_but_source_comment_is_not(self):
        self.write("resources/js/a.ts", "export const a = 1")
        self.write("resources/js/b.ts", "export {a} from './a'")
        self.write("tests/Unit/consumer.test.ts", "import '../../resources/js/b'")
        self.write("tests/Unit/unrelated.test.ts", "// a.ts is mentioned here")
        plan = build_plan(self.root, ["resources/js/a.ts"])
        names = {g.name for g in plan.gates}
        self.assertIn("unit:tests/Unit/consumer.test.ts", names)
        self.assertNotIn("unit:tests/Unit/unrelated.test.ts", names)

    def test_python_tracks_imports_not_unrelated_sources(self):
        self.write("tools/g7pb/a.py", "from .model import Gate")
        self.write("tools/g7pb/model.py", "class Gate: pass")
        self.write("tools/g7pb/unrelated.py", "pass")
        self.write("tests/Harness/test_a.py", "from tools.g7pb.a import Gate")
        inputs = python_inputs(self.root, "tests/Harness/test_a.py")
        self.assertIn("tools/g7pb/model.py", inputs)
        self.assertNotIn("tools/g7pb/unrelated.py", inputs)
        plan = build_plan(self.root, ["tools/g7pb/a.py"])
        self.assertEqual(len([g for g in plan.gates if g.name.startswith("python:")]), 1)

    def test_harness_only_browser_change_collects_only_that_spec(self):
        plan = build_plan(self.root, ["tests/E2E/a.spec.ts"])
        self.assertEqual(len(plan.gates), 2)
        self.assertEqual(plan.gates[1].name, "typecheck")
        self.assertEqual(plan.gates[0].argv, ("npx", "--no-install", "playwright", "test", "tests/E2E/a.spec.ts", "--list", "--reporter=line"))
        self.assertFalse(plan.gates[0].runtime)
        self.assertFalse(plan.requirements["browser"])

    def test_browser_with_product_change_requires_runtime(self):
        plan = build_plan(self.root, ["tests/E2E/a.spec.ts", "src/Changed.php"])
        gate = next(g for g in plan.gates if g.name.startswith("browser:"))
        self.assertTrue(gate.runtime)
        self.assertIn("--retries=0", gate.argv)

    def test_mapped_controller_input_is_in_the_success_key(self):
        self.write("tests/Harness/test_planner.py", "pass")
        self.write("tests/Harness/test_runner.py", "pass")
        plan = build_plan(self.root, ["Makefile", "scripts/quality-scoped.sh"])
        for gate in plan.gates:
            if gate.name.startswith("python:"):
                self.assertIn("Makefile", gate.inputs)
                self.assertIn("scripts/quality-scoped.sh", gate.inputs)

    def test_scripts_only_change_does_not_request_product_full(self):
        self.write("package.json", json.dumps({"version": "1", "scripts": {"test": "new"}}))
        self.write("tests/Harness/test_commands.py", "pass")
        with patch("tools.g7pb.planner.git", return_value=json.dumps({"version": "1", "scripts": {"test": "old"}})):
            plan = build_plan(self.root, ["package.json"])
        self.assertFalse(plan.unresolved)
        self.assertFalse(plan.full)
        self.assertIn("python:tests/Harness/test_commands.py", [g.name for g in plan.gates])

    def test_unit_key_tracks_transitive_sources_and_disables_dynamic_reuse(self):
        self.write("tests/Unit/a.test.ts", "import '../../resources/js/a';")
        self.write("resources/js/a.ts", "import './b';")
        self.write("resources/js/b.ts", "export const b = 1;")
        gate = build_plan(self.root, ["tests/Unit/a.test.ts"]).gates[0]
        self.assertIn("resources/js/b.ts", gate.inputs)
        self.assertTrue(gate.reusable)
        self.write("resources/js/b.ts", "readFileSync(name)")
        self.assertFalse(build_plan(self.root, ["tests/Unit/a.test.ts"]).gates[0].reusable)

    def test_full_requires_explicit_request(self):
        self.assertTrue(build_plan(self.root, ["database/migrations/a.php"]).unresolved)
        plan = build_plan(self.root, ["database/migrations/a.php"], full=True)
        self.assertFalse(plan.unresolved)
        self.assertIn("full-product", [g.name for g in plan.gates])

    def test_scope_uses_specified_base_and_deduplicates(self):
        with patch("tools.g7pb.planner.git", side_effect=["b\0a\0", "a\0c\0"]) as command:
            self.assertEqual(changed_paths(self.root, "pre-merge"), ["a", "b", "c"])
            self.assertIn("pre-merge", command.call_args_list[0].args)

    def test_python_fixture_output_literals_do_not_bind_to_installed_artifacts(self):
        self.write("tools/g7pb/fake.py", "OUTPUTS = ['dist/js/app.js', 'vendor/autoload.php', 'node_modules/.package-lock.json']")
        before = python_inputs(self.root, "tools/g7pb/fake.py")
        for path in ('dist/js/app.js', 'vendor/autoload.php', 'node_modules/.package-lock.json'):
            self.write(path, "installed bytes")
        self.assertEqual(before, python_inputs(self.root, "tools/g7pb/fake.py"))

    def test_tools_path_import_alias_selects_the_existing_release_test(self):
        self.write("tools/g7pb/artifacts.py", "pass")
        self.write("tests/Harness/test_release.py", "from g7pb import artifacts")
        plan = build_plan(self.root, ["tools/g7pb/artifacts.py"])
        self.assertFalse(plan.unresolved)
        self.assertIn("python:tests/Harness/test_release.py", [gate.name for gate in plan.gates])

    def browser_fixture(self):
        self.write("resources/js/editor/richTextEditing.tsx", "export const value = 1;")
        self.write("tests/Unit/richTextEditing.test.ts", "import '../../resources/js/editor/richTextEditing';")
        self.write("tests/E2E/editorInteractionQuality.spec.ts", "test('rich text', async()=>{});")

    def test_product_browser_has_one_ordered_candidate_build_in_all_phases(self):
        self.browser_fixture()
        for phase in ("submission", "integration", "verification", "ci"):
            with self.subTest(phase=phase):
                plan = build_plan(self.root, ["resources/js/editor/richTextEditing.tsx"], phase=phase)
                names = [g.name for g in plan.gates]
                assets = next(g for g in plan.gates if g.name == "browser-assets")
                browser = next(g for g in plan.gates if g.name.startswith("browser:"))
                self.assertEqual(names.count("browser-assets"), 1)
                self.assertLess(names.index(assets.name), names.index(browser.name))
                self.assertEqual(browser.depends_on, (assets.name,))
                self.assertEqual(assets.execution, "controller")
                self.assertEqual(assets.deferred, phase == "submission")
                self.assertEqual(assets.argv[assets.argv.index("--runtime") + 1], "local" if phase == "ci" else "docker")
                self.assertEqual(assets.argv[assets.argv.index("--root") + 1], str(self.root.resolve()))
                self.assertTrue(Path(assets.argv[2]).is_absolute())
                self.assertIn("resources/js/editor/richTextEditing.tsx", assets.inputs)
                self.assertTrue(any(p.endswith("tools/g7pb/environment.py") for p in assets.inputs))
                self.assertFalse(assets.reusable)  # build() owns artifact-aware reuse.
                self.assertNotIn("browser-runtime-sync", names)

    def test_changed_spec_scope_is_not_overwritten_by_source_mapping(self):
        self.browser_fixture()
        spec = "tests/E2E/editorInteractionQuality.spec.ts"
        plan = build_plan(self.root, ["resources/js/editor/richTextEditing.tsx", spec], phase="integration")
        browser = next(g for g in plan.gates if g.name == "browser:" + spec)
        self.assertNotIn("--grep", browser.argv)
        self.assertEqual(browser.depends_on, ("browser-assets",))
        self.assertEqual(plan.gates[-1], browser)

    def test_test_only_collection_does_not_prepare_runtime(self):
        plan = build_plan(self.root, ["tests/E2E/editorInteractionQuality.spec.ts"])
        self.assertFalse(any(g.runtime for g in plan.gates))
        self.assertNotIn("browser-assets", [g.name for g in plan.gates])

    def test_pc_only_registration_change_selects_focused_harness(self):
        self.write("tests/Harness/test_browser_registration.py", "pass")
        plan = build_plan(self.root, ["playwright.config.ts"])
        self.assertFalse(plan.unresolved)
        self.assertFalse(plan.requirements["browser"])
        self.assertEqual([g.name for g in plan.gates], ["python:tests/Harness/test_browser_registration.py", "typecheck"])
        self.assertTrue(plan.requirements["node"])

    def test_only_changed_content_policy_uses_candidate_subject_registry(self):
        self.write("tools/g7pb/content.py", "MARKER = 'candidate style policy'\n")
        candidate = content_policy(self.root, ["tools/g7pb/content.py"])
        self.assertEqual(candidate.MARKER, "candidate style policy")
        verified = content_policy(self.root, ["resources/css/page-builder-editor.css"])
        self.assertNotEqual(Path(verified.__file__).resolve(), (self.root / "tools/g7pb/content.py").resolve())
        self.assertFalse(hasattr(verified, "MARKER"))

    def test_style_artifact_check_defers_and_runs_only_after_candidate_build(self):
        from types import SimpleNamespace
        policy = SimpleNamespace(
            select_changes=lambda root, base, paths: [{"kind": "style", "ids": ["page-theme"]}],
            plan=lambda root, kind, ids: {"requires_build": True})
        self.browser_fixture()
        for phase in ("submission", "integration", "verification", "ci"):
            with self.subTest(phase=phase), patch("tools.g7pb.planner.content_policy", return_value=policy):
                plan = build_plan(self.root, ["resources/css/scoped-fixture.css", "resources/js/editor/richTextEditing.tsx"], phase=phase)
            # Unknown CSS browser fixtures may be unresolved, but ordering and
            # the artifact contract itself must remain explicit in the plan.
            names = [g.name for g in plan.gates]
            artifact = next(g for g in plan.gates if g.name.startswith("content:style:"))
            browser = next(g for g in plan.gates if g.name.startswith("browser:"))
            self.assertTrue(artifact.runtime)
            self.assertEqual(artifact.deferred, phase == "submission")
            self.assertEqual(artifact.depends_on, ("browser-assets",))
            self.assertLess(names.index("browser-assets"), names.index(artifact.name))
            self.assertLess(names.index(artifact.name), names.index(browser.name))
            self.assertIn(artifact.name, browser.depends_on)
            self.assertEqual(names.count("browser-assets"), 1)
            self.assertNotIn("full-product", names)

    def test_candidate_policy_change_can_declare_new_style_ids_before_integration(self):
        self.write("tools/g7pb/content.py", "def select_changes(root, base, paths): return [{'kind':'style','ids':['candidate-style']}]\n"
                   "def plan(root, kind, ids): return {'requires_build': True}\n")
        self.write("tests/Harness/test_content.py", "pass")
        self.write("resources/css/page-builder-manager.css", ".manager {}")
        self.write("tests/E2E/pageBuilderLifecycle.spec.ts", "test('case',async()=>{});")
        plan = build_plan(self.root, ["tools/g7pb/content.py", "resources/css/page-builder-manager.css"])
        self.assertFalse(plan.unresolved)
        self.assertIn("python:tests/Harness/test_content.py", [g.name for g in plan.gates])
        artifact = next(g for g in plan.gates if g.name == "content:style:candidate-style")
        self.assertTrue(artifact.deferred)
        self.assertIn("tools/g7pb/content.py", artifact.inputs)

    def test_non_build_content_checks_do_not_acquire_runtime_or_prepare_assets(self):
        from types import SimpleNamespace
        policy = SimpleNamespace(select_changes=lambda root, base, paths: [{"kind": "kit", "ids": ["landing"]}],
                                 plan=lambda root, kind, ids: {"mode": "technical"})
        with patch("tools.g7pb.planner.content_policy", return_value=policy):
            plan = build_plan(self.root, ["resources/store/source/page-kits/landing/document.json"])
        self.assertFalse(plan.unresolved)
        self.assertFalse(plan.gates[0].runtime)
        self.assertNotIn("browser-assets", [g.name for g in plan.gates])

    def test_editor_checkers_use_explicit_candidate_and_verified_controller_inputs(self):
        self.write("tests/Harness/test_editor_contracts.py", "pass")
        parity = "scripts/check-editor-layout-parity.mjs"
        acceptance = "scripts/check-editor-acceptance-contract.mjs"
        helper = "scripts/lib/editorCssSources.mjs"
        self.write(parity, "export const candidate = true;")
        self.write(helper, "export const readCssGraph = () => {};")
        plan = build_plan(self.root, [parity, helper])
        gate = next(g for g in plan.gates if g.name == "python:tests/Harness/test_editor_contracts.py")
        selected = json.loads(dict(gate.env)["G7PB_EDITOR_CONTRACT_CHECKERS"])
        self.assertEqual(Path(selected[parity]), (self.root / parity).resolve())
        self.assertNotEqual(Path(selected[acceptance]), (self.root / acceptance).resolve())
        for file in selected.values():
            self.assertIn(file, gate.inputs)
        self.assertIn(str((self.root / helper).resolve()), gate.inputs)
        self.assertTrue(any(p.endswith("scripts/lib/editorContractRegistration.mjs") and Path(p).is_absolute() for p in gate.inputs))

    def test_checker_bootstrap_identifies_same_git_common_local_checkout(self):
        self.write(".git", "gitdir: /shared/worktrees/subject")
        local = self.root / "verified-local"
        with patch("tools.g7pb.planner.git", side_effect=[str(local / ".git"), str(local)]):
            self.assertEqual(checker_controller_root(self.root, self.root), local.resolve())
        with patch("tools.g7pb.planner.git", side_effect=[str(local / ".git"), str(local / "different")]):
            with self.assertRaisesRegex(ValueError, "same-repository Local"):
                checker_controller_root(self.root, self.root)


if __name__ == "__main__":
    unittest.main()
