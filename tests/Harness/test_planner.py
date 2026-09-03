import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from tools.g7pb.planner import BROWSER_HELPER_SPECS, build_plan, changed_paths, python_inputs, content_policy, checker_controller_root
from tools.g7pb.inputs import source_inputs
from tools.g7pb.runner import digest_gate


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def test_owned_site_part_helpers_select_only_three_registration_specs(self):
        php = "tests/E2E/support/sitePartState.php"
        helper = "tests/E2E/support/sitePartSetFixture.ts"
        self.write(php, "<?php class Fixture {}")
        self.write(helper, "export class Fixture {}")
        self.write("tests/Harness/test_site_part_fixture.py", "import unittest")
        specs = ("globalSiteShellRoutes", "sitePartLifecycle", "pageBuilderLifecycle")
        for spec in specs:
            self.write(f"tests/E2E/{spec}.spec.ts", "import './support/sitePartSetFixture'")
        plan = build_plan(self.root, [php, helper])
        self.assertFalse(plan.unresolved)
        browser = [gate for gate in plan.gates if gate.name.startswith("browser-registration:")]
        self.assertEqual({gate.name for gate in browser}, {"browser-registration:tests/E2E/" + spec + ".spec.ts" for spec in specs})
        self.assertTrue(all(php in gate.inputs and helper in gate.inputs for gate in browser))
        self.assertFalse(any(gate.runtime for gate in plan.gates))
        self.assertFalse(any(gate.name.startswith("content:") for gate in plan.gates))
        regression = next(g for g in plan.gates if g.name == "python:tests/Harness/test_site_part_fixture.py")
        self.assertIn(php, regression.inputs)
        self.assertEqual(regression.requires, ("node", "php"))

    def test_owned_fixture_inputs_follow_product_browser_gates_and_defer_submission(self):
        spec = "tests/E2E/pageBuilderLifecycle.spec.ts"
        self.write(spec, "test('owned', ()=>{})")
        # An explicit changed spec + product fixture selects real runtime later.
        self.write("resources/css/fixture.css", ".fixture { display:block }")
        for phase in ("submission", "integration"):
            plan = build_plan(self.root, [spec, "resources/css/fixture.css"], phase=phase)
            gate = next(g for g in plan.gates if g.name == "browser:" + spec)
            self.assertIn("tests/E2E/support/sitePartState.php", gate.inputs)
            self.assertIn("tests/E2E/support/sitePartSetFixture.ts", gate.inputs)
            self.assertEqual(gate.deferred, phase == "submission")
            self.assertIn("browser-assets", gate.depends_on)

    def test_rich_text_helper_selects_only_its_registered_consumer_specs(self):
        helper = "tests/E2E/support/richTextInput.ts"
        specs = BROWSER_HELPER_SPECS[helper]
        self.write(helper, "export const replacePuckRichTextField = () => {}")
        for spec in specs:
            self.write(spec, "import {replacePuckRichTextField} from './support/richTextInput'")
        for paths in ([helper], [helper, specs[0]]):
            with self.subTest(paths=paths):
                plan = build_plan(self.root, paths)
                self.assertFalse(plan.unresolved)
                self.assertFalse(plan.full)
                browser = [gate for gate in plan.gates if gate.name.startswith("browser-registration:")]
                self.assertEqual(len(browser), len(specs))
                self.assertEqual({gate.name for gate in browser}, {"browser-registration:" + spec for spec in specs})
                for gate in browser:
                    self.assertIn(helper, gate.inputs)
                    self.assertIn(gate.name.removeprefix("browser-registration:"), gate.inputs)
                    self.assertIn("--list", gate.argv)
                    self.assertNotIn("--grep", gate.argv)
                    self.assertFalse(gate.deferred)
                self.assertFalse(any(gate.runtime for gate in plan.gates))
                self.assertFalse(any(gate.name.startswith(("browser:", "content:")) for gate in plan.gates))

    def test_rich_text_helper_with_product_preserves_runtime_and_deferred_gates(self):
        helper = "tests/E2E/support/richTextInput.ts"
        specs = BROWSER_HELPER_SPECS[helper]
        source = "resources/js/title.ts"
        self.write(helper, "export const replacePuckRichTextField = () => {}")
        for spec in specs:
            self.write(spec, "import {replacePuckRichTextField} from './support/richTextInput'")
        self.write(source, "export const title = 1")
        self.write("tests/Unit/title.test.ts", "import '../../resources/js/title'")
        for phase in ("submission", "integration"):
            with self.subTest(phase=phase):
                plan = build_plan(self.root, [helper, source], phase=phase)
                self.assertFalse(plan.unresolved)
                self.assertFalse(plan.full)
                browser = [gate for gate in plan.gates if gate.name.startswith("browser:")]
                self.assertEqual(len(browser), len(specs))
                self.assertEqual({gate.name for gate in browser}, {"browser:" + spec for spec in specs})
                for gate in browser:
                    self.assertIn(helper, gate.inputs)
                    self.assertIn(gate.name.removeprefix("browser:"), gate.inputs)
                    self.assertIn("--retries=0", gate.argv)
                    self.assertNotIn("--list", gate.argv)
                    self.assertTrue(gate.runtime)
                    self.assertEqual(gate.deferred, phase == "submission")
                    self.assertIn("browser-assets", gate.depends_on)
                self.assertFalse(any(gate.name.startswith(("browser-registration:", "content:")) for gate in plan.gates))

    def test_rich_text_helper_registration_matches_actual_spec_dependency_consumers(self):
        repository = Path(__file__).resolve().parents[2]
        helper = "tests/E2E/support/richTextInput.ts"
        registered = BROWSER_HELPER_SPECS[helper]
        self.assertTrue((repository / helper).is_file())
        self.assertTrue(registered)
        self.assertEqual(len(registered), len(set(registered)))
        specs = {path.relative_to(repository).as_posix() for path in (repository / "tests/E2E").rglob("*")
                 if path.is_file() and path.name.endswith((".spec.ts", ".spec.tsx"))}
        self.assertTrue(set(registered).issubset(specs), "Every registered consumer must be a real spec")
        consumers = set()
        for spec in sorted(specs):
            # Read local import dependencies without running fixture I/O or a browser.
            dependencies = source_inputs(repository, spec, runtime=False)
            self.assertTrue(dependencies.reusable, f"Unresolved spec imports: {spec}")
            if helper in dependencies.files:
                consumers.add(spec)
        self.assertEqual(set(registered), consumers, "Helper registration must match its actual dependency consumers exactly")

    def test_unknown_browser_support_cannot_be_collected_as_zero_test_spec(self):
        self.write("tests/E2E/support/unknown.ts", "export const a=1")
        plan = build_plan(self.root, ["tests/E2E/support/unknown.ts"])
        self.assertTrue(any("owning browser scenario" in item for item in plan.unresolved))
        self.assertFalse(any(gate.name.startswith("browser") for gate in plan.gates))

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

    def test_registry_boundary_helper_selects_only_its_infrastructure_regression(self):
        helper = "scripts/lib/blockPackRegistryBoundary.mjs"
        self.write(helper, "export const check = true")
        self.write("tests/Harness/test_boundary_command.py", "pass")
        plan = build_plan(self.root, [helper])
        self.assertFalse(plan.unresolved)
        self.assertFalse(plan.full)
        self.assertEqual([gate.name for gate in plan.gates], ["python:tests/Harness/test_boundary_command.py", "syntax:" + helper])
        gate = plan.gates[0]
        self.assertFalse(gate.runtime)
        self.assertEqual(gate.requires, ("node", "php"))
        self.assertTrue({helper, "scripts/check-boundaries.sh", "package-lock.json"}.issubset(gate.inputs))

    def test_registry_guard_controller_input_changes_invalidate_architecture_receipt(self):
        helper = "scripts/lib/blockPackRegistryBoundary.mjs"
        source = "resources/js/fixture.ts"
        self.write(source, "export const title = 1")
        self.write("tests/Unit/fixture.test.ts", "import '../../resources/js/fixture'")
        controller = (self.root / "controller").resolve()
        (controller / helper).parent.mkdir(parents=True)
        (controller / helper).write_text("// first validated controller guard")
        with patch("tools.g7pb.planner.__file__", str(controller / "tools/g7pb/planner.py")):
            plan = build_plan(self.root, [source])
        gate = next(g for g in plan.gates if g.name == "architecture")
        self.assertEqual(gate.argv[:2], ("bash", str(controller / "scripts/check-boundaries.sh")))
        self.assertEqual(gate.argv[gate.argv.index("--root") + 1], str(self.root.resolve()))
        self.assertIn(str(controller / helper), gate.inputs)
        self.assertIn(source, gate.inputs)
        before = digest_gate(self.root, gate)
        self.write(helper, "// old subject guard is not executed")
        self.assertEqual(before, digest_gate(self.root, gate))
        (controller / helper).write_text("// changed validated controller guard")
        self.assertNotEqual(before, digest_gate(self.root, gate))

    def test_registry_candidate_guard_uses_subject_script_and_hashes_its_helper(self):
        helper = "scripts/lib/blockPackRegistryBoundary.mjs"
        source = "resources/js/fixture.ts"
        self.write(helper, "// proposed guard")
        self.write(source, "export const title = 1")
        self.write("tests/Unit/fixture.test.ts", "import '../../resources/js/fixture'")
        self.write("tests/Harness/test_boundary_command.py", "pass")
        plan = build_plan(self.root, [source, helper])
        self.assertFalse(plan.unresolved)
        gate = next(g for g in plan.gates if g.name == "architecture")
        self.assertEqual(gate.argv[:2], ("bash", "scripts/check-boundaries.sh"))
        self.assertNotIn("--root", gate.argv)
        self.assertIn(helper, gate.inputs)
        before = digest_gate(self.root, gate)
        self.write(helper, "// changed proposed guard")
        self.assertNotEqual(before, digest_gate(self.root, gate))

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

    def test_style_artifact_check_defers_after_build_without_reading_content_inventory(self):
        self.write("resources/css/page-builder-public.css", ".fixture {}")
        self.write("tests/E2E/editorStructureTheme.spec.ts", "test('code fixture',async()=>{});")
        for phase in ("submission", "integration", "verification", "ci"):
            with self.subTest(phase=phase), patch("tools.g7pb.planner.content_policy", side_effect=AssertionError("CSS must not load catalog")):
                plan = build_plan(self.root, ["resources/css/page-builder-public.css"], phase=phase)
            self.assertFalse(plan.unresolved)
            names = [g.name for g in plan.gates]
            artifact = next(g for g in plan.gates if g.name == "style-assets")
            browser = next(g for g in plan.gates if g.name.startswith("browser:"))
            self.assertEqual(artifact.argv, ("node", "scripts/check-assets.mjs"))
            self.assertTrue(artifact.runtime)
            self.assertEqual(artifact.deferred, phase == "submission")
            self.assertEqual(artifact.depends_on, ("browser-assets",))
            self.assertLess(names.index("browser-assets"), names.index(artifact.name))
            self.assertLess(names.index(artifact.name), names.index(browser.name))
            self.assertIn(artifact.name, browser.depends_on)
            self.assertEqual(names.count("browser-assets"), 1)
            self.assertFalse(any(name.startswith("content:") for name in names))
            self.assertFalse(any("editorLayoutParity" in name for name in names))
            self.assertNotIn("full-product", names)

    def test_candidate_policy_change_can_declare_new_style_ids_before_integration(self):
        self.write("tools/g7pb/content.py", "def select_changes(root, base, paths): return [{'kind':'style','ids':['candidate-style']}]\n"
                   "def plan(root, kind, ids): return {'requires_build': True}\n")
        self.write("tests/Harness/test_content.py", "pass")
        self.write("resources/store/source/page-kits/candidate/document.json", "{}")
        plan = build_plan(self.root, ["tools/g7pb/content.py", "resources/store/source/page-kits/candidate/document.json"])
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
        verified = self.root / "verified-controller"
        verified.mkdir()
        with patch("tools.g7pb.planner.checker_controller_root", return_value=verified), \
             patch("tools.g7pb.planner.editor_contract_inputs", return_value=["resources/js/editor/connected.tsx"]):
            plan = build_plan(self.root, [parity])
        gate = next(g for g in plan.gates if g.name == "python:tests/Harness/test_editor_contracts.py")
        selected = json.loads(dict(gate.env)["G7PB_EDITOR_CONTRACT_CHECKERS"])
        self.assertEqual(Path(selected[parity]), (self.root / parity).resolve())
        self.assertNotEqual(Path(selected[acceptance]), (self.root / acceptance).resolve())
        for file in selected.values():
            self.assertIn(file, gate.inputs)
        self.assertIn(str((self.root / helper).resolve()), gate.inputs)
        self.assertTrue(any(p.endswith("scripts/lib/editorContractRegistration.mjs") and Path(p).is_absolute() for p in gate.inputs))

    def test_editor_source_graph_and_legacy_fixture_changes_select_only_focused_contracts(self):
        helper = "scripts/lib/editorSourceGraph.mjs"
        source = "resources/js/editor/new/preview.tsx"
        for name in (helper, "scripts/lib/editorCssSources.mjs", "scripts/lib/editorContractRegistration.mjs",
                     "scripts/check-editor-acceptance-contract.mjs", "scripts/check-editor-layout-parity.mjs",
                     "tests/Harness/test_editor_contracts.py", "tests/Harness/editor-acceptance-contract.test.sh",
                     "tests/Harness/editor-layout-parity-contract.test.sh", "package-lock.json", source):
            self.write(name, "fixture")
        paths = [helper, "tests/Harness/editor-acceptance-contract.test.sh", "tests/Harness/editor-layout-parity-contract.test.sh"]
        with patch("tools.g7pb.planner.editor_contract_inputs", return_value=[source, "tsconfig.json", "package-lock.json"]) as inputs:
            plan = build_plan(self.root, paths)
        self.assertFalse(plan.unresolved)
        self.assertFalse(plan.full)
        self.assertFalse(any(gate.runtime or gate.name.startswith(("browser", "content:", "harness:")) for gate in plan.gates))
        gate = next(gate for gate in plan.gates if gate.name == "python:tests/Harness/test_editor_contracts.py")
        self.assertEqual(gate.requires, ("node",))
        self.assertTrue(gate.reusable)
        self.assertIn(source, gate.inputs)
        self.assertIn(str((self.root / helper).resolve()), gate.inputs)
        self.assertEqual(dict(gate.env)["G7PB_EDITOR_SOURCE_GRAPH"], str((self.root / helper).resolve()))
        self.assertTrue(all(call.args == (self.root, (self.root / helper).resolve()) for call in inputs.call_args_list))
        original = digest_gate(self.root, gate)
        self.write(source, "changed owner body")
        self.assertNotEqual(digest_gate(self.root, gate), original)
        self.write(source, "fixture")
        self.assertEqual(digest_gate(self.root, gate), original)
        self.write(helper, "changed graph implementation")
        self.assertNotEqual(digest_gate(self.root, gate), original)

    def test_unresolved_editor_inputs_fail_closed_without_full_or_cache_reuse(self):
        self.write("tests/Harness/test_editor_contracts.py", "pass")
        with patch("tools.g7pb.planner.checker_controller_root", return_value=self.root), \
             patch("tools.g7pb.planner.editor_contract_inputs", side_effect=ValueError("disconnected owner")):
            plan = build_plan(self.root, ["tests/Harness/test_editor_contracts.py"])
        self.assertFalse(plan.full)
        self.assertTrue(any("Editor contract source inputs required" in error for error in plan.unresolved))
        gate = next(gate for gate in plan.gates if gate.name == "python:tests/Harness/test_editor_contracts.py")
        self.assertFalse(gate.reusable)

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
