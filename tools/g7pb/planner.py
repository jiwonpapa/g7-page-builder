"""Shared change-to-check policy. Unknown inputs never become a full run."""
import ast
from dataclasses import replace
import importlib.util
import json
from pathlib import Path
import subprocess
from .model import Gate, Plan
from .inputs import source_inputs
from .typecheck_inputs import typecheck_inputs
from .type_import_changes import browser_sources
from .browser_requirements import BROWSER_ENVIRONMENT, scenarios_for
from .environment import build_inputs, sync_plan
from .runner import SITE_PART_SPECS, SITE_PART_HELPERS


DESIGN_INPUTS = (
    "scripts/check-design-architecture.mjs", "config/design-architecture.json", "config/design-architecture-debt.json",
    "scripts/lib/designArchitecturePolicy.mjs", "scripts/lib/designArchitectureTypeScript.mjs",
    "scripts/lib/designArchitecturePhp.mjs", "scripts/lib/designArchitectureCss.mjs",
)
# The guard validates the required document set; selection reads the same
# controller-owned configuration instead of maintaining another path list.
NORMATIVE_DOCS = frozenset(json.loads(
    (Path(__file__).resolve().parents[2] / "config/design-architecture.json").read_text()
)["normativeFiles"])
EDITOR_CHECKERS = {
    "scripts/check-editor-acceptance-contract.mjs": ("scripts/lib/editorContractRegistration.mjs", "scripts/lib/editorSourceGraph.mjs", "scripts/lib/editorCssSources.mjs"),
    "scripts/check-editor-layout-parity.mjs": ("scripts/lib/editorContractRegistration.mjs", "scripts/lib/editorSourceGraph.mjs", "scripts/lib/editorCssSources.mjs"),
}
BOUNDARY_INPUTS = ("scripts/check-boundaries.sh", "scripts/lib/blockPackRegistryBoundary.mjs")
EDITOR_SOURCE_GRAPH = "scripts/lib/editorSourceGraph.mjs"
BROWSER_HELPER_SPECS = {
    "tests/E2E/support/richTextInput.ts": (
        "tests/E2E/pageBuilderLifecycle.spec.ts", "tests/E2E/editorStructureTheme.spec.ts",
        "tests/E2E/editorCatalogCode.spec.ts",
    ),
}
BROWSER_CONSUMER_TEST = "tests/Harness/test_planner.py"
COMPILER_FACADE = "src/Application/Compilation/HtmlDocumentCompiler.php"
COMPILER_OWNERS = "src/Application/Compilation/HtmlDocument/"
COMPILER_COVERAGE = "scripts/check-php-coverage.php"
COMPILER_TEST = "tests/UnitPhp/HtmlDocumentCompilerTest.php"
STANDALONE_VIEWER = "resources/views/viewer.blade.php"


def compiler_family(root):
    # This directory exclusively owns code extracted from the original facade.
    return (COMPILER_FACADE, *sorted(p.relative_to(root).as_posix()
            for p in (root / COMPILER_OWNERS).rglob("*.php")))



def standalone_viewer_class_added(root, base):
    """One reviewed additive class; every other Blade byte remains unchanged."""
    root = root.resolve()
    file = root / STANDALONE_VIEWER
    if any((root / path).is_symlink() for path in (Path(STANDALONE_VIEWER), *Path(STANDALONE_VIEWER).parents)):
        return False
    try:
        before = subprocess.run(["git", "-C", str(root), "show", f"{base}:{STANDALONE_VIEWER}"],
                                capture_output=True, check=True, timeout=10).stdout
        after = file.read_bytes()
    except (OSError, subprocess.SubprocessError):
        return False
    prefix = b'<!doctype html>\n<html lang='
    marked = b'<!doctype html>\n<html class="g7pb-standalone-viewer" lang='
    return before.startswith(prefix) and after == marked + before[len(prefix):]


def browser_consumer_inputs(root):
    """Inputs read by the helper registration audit, including unregistered specs."""
    inputs, reusable = set(), True
    for spec in sorted((root / "tests/E2E").rglob("*")):
        if not spec.is_file() or not spec.name.endswith((".spec.ts", ".spec.tsx")):
            continue
        path = spec.relative_to(root).as_posix()
        graph = source_inputs(root, path, runtime=False)
        inputs.update((path, *graph.files))
        reusable = reusable and graph.reusable
    return tuple(sorted(inputs)), reusable


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True)


def changed_paths(root, base, head=None):
    paths = git(root, "diff", "--name-only", "-z", base, *([head] if head else []), "--").split("\0")
    if head is None:
        paths += git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
    return sorted(set(filter(None, paths)))


def python_inputs(root, entry):
    """Follow local imports, not the entire repository tree."""
    found = set()
    def visit(path):
        if path in found or not (root / path).is_file():
            return
        found.add(path)
        try:
            tree = ast.parse((root / path).read_text())
        except SyntaxError:
            return
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                candidate = node.value
                if candidate.startswith(('tools/', 'scripts/', 'tests/', 'resources/', 'schemas/', 'config/')) and (root / candidate).is_file() and (root / candidate).resolve().is_relative_to(root.resolve()):
                    if candidate.endswith('.py'):
                        visit(candidate)
                    else:
                        found.add(candidate)
            modules = []
            if isinstance(node, ast.ImportFrom):
                prefix = "tools.g7pb." if node.level else ""
                module = prefix + (node.module or "")
                modules = [module] + [module.rstrip(".") + "." + a.name for a in node.names]
            elif isinstance(node, ast.Import):
                modules = [a.name for a in node.names]
            for module in modules:
                if module == 'g7pb' or module.startswith('g7pb.'):
                    module = 'tools.' + module
                if module.startswith("tools.g7pb."):
                    visit(module.replace(".", "/") + ".py")
    visit(entry)
    return tuple(sorted(found))


def related_tests(root, sources, changed, directory, suffixes):
    selected = set(changed)
    candidates = [p for p in (root / directory).rglob("*") if p.is_file() and p.name.endswith(suffixes)]
    graphs = {p: source_inputs(root, p.relative_to(root).as_posix()) for p in candidates}
    for source in sources:
        stem = Path(source).stem
        matches = [p.relative_to(root).as_posix() for p in candidates
                   if source in graphs[p].files or p.stem.lower() in {stem.lower() + ".test", stem.lower() + "test"}]
        if not matches:
            raise ValueError(f"No related test for {source}; add/declare a focused test")
        selected.update(matches)
    return sorted(selected)


def editor_contract_inputs(root, helper):
    result = subprocess.run(["node", str(helper), "--root", str(root.resolve()), "--inputs"],
                            capture_output=True, text=True, check=True, timeout=30)
    paths = json.loads(result.stdout)
    if not isinstance(paths, list) or not paths or not all(isinstance(path, str) and path
            and not Path(path).is_absolute() and (root / path).resolve().is_relative_to(root.resolve()) for path in paths):
        raise ValueError("Invalid editor source graph inputs")
    return sorted(set(paths))


def content_policy(root, paths):
    from . import content
    # The candidate policy must be testable before the verified controller can
    # know its new IDs. Product-only tasks keep the verified controller policy.
    if "tools/g7pb/content.py" not in paths or Path(content.__file__).resolve() == (root / "tools/g7pb/content.py").resolve():
        return content
    spec = importlib.util.spec_from_file_location("g7pb_candidate_content", root / "tools/g7pb/content.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def checker_controller_root(subject, controller):
    if subject.resolve() != controller.resolve() or not (subject / ".git").exists():
        return controller
    common = Path(git(subject, "rev-parse", "--git-common-dir").strip())
    common = (subject / common).resolve() if not common.is_absolute() else common.resolve()
    local = common.parent
    if Path(git(local, "rev-parse", "--show-toplevel").strip()).resolve() != local:
        raise ValueError("Cannot identify the same-repository Local checker controller")
    return local


def build_plan(root: Path, paths: list[str], *, base="HEAD", phase="submission", full=False):
    root = Path(root)
    controller_root = Path(__file__).resolve().parents[2]
    plan = Plan(sorted(set(paths)), full=full, phase=phase)
    gates = {}
    consumer_graph = None
    def consumer_inputs():
        nonlocal consumer_graph
        if consumer_graph is None:
            consumer_graph = browser_consumer_inputs(root)
        return consumer_graph
    def add(name, argv, inputs, reason, requires=(), runtime=False, reusable=True, env=(), execution="runtime", depends_on=(), browser_expectations=()):
        prior = gates.get(name)
        inputs = set(inputs) | (set(prior.inputs) if prior else set())
        gates[name] = Gate(name, tuple(argv), tuple(sorted(inputs)), reason, runtime, tuple(env), tuple(requires), reusable,
                           runtime and phase == "submission", execution, tuple(depends_on), tuple(browser_expectations))
    def python_test(path, cause=""):
        if not (root / path).is_file():
            plan.unresolved.append(f"Missing infrastructure test: {path}")
            return
        requires = ("node", "php") if Path(path).name == "test_boundary_command.py" else ("node",) if Path(path).name in {"test_editor_contracts.py", "test_browser_registration.py", "test_typecheck_inputs.py", "test_type_import_changes.py"} else ()
        if Path(path).name == "test_php_coverage.py":
            requires = ("php",)
        environment, controller_inputs, reusable = (), [], True
        if Path(path).name == "test_php_coverage.py":
            controller_inputs.extend((COMPILER_COVERAGE, COMPILER_TEST, "Makefile", ".github/workflows/ci.yml"))
        if path == BROWSER_CONSUMER_TEST:
            files, reusable = consumer_inputs()
            controller_inputs.extend(files)
        if Path(path).name == "test_boundary_command.py":
            controller_inputs.extend((*BOUNDARY_INPUTS, "package-lock.json"))
        if Path(path).name == "test_type_import_changes.py":
            controller_inputs.append("package-lock.json")
        if Path(path).name == "test_site_part_fixture.py":
            requires = ("node", "php")
            controller_inputs.extend((*SITE_PART_HELPERS, "package-lock.json"))
        if Path(path).name == "test_editor_contracts.py":
            verified = checker_controller_root(root, controller_root)
            selected = {}
            for script, helpers in EDITOR_CHECKERS.items():
                inputs = (script, *helpers)
                candidate = any(item in plan.paths for item in inputs)
                policy_root = root if candidate else verified
                if not candidate and (policy_root / ".git").exists():
                    git(policy_root, "ls-files", "--error-unmatch", *inputs)
                    git(policy_root, "diff", "--quiet", "HEAD", "--", *inputs)
                selected[script] = str((policy_root / script).resolve())
                controller_inputs.extend(str((policy_root / item).resolve()) for item in inputs)
            source_helper = Path(selected[next(iter(EDITOR_CHECKERS))]).parent / "lib/editorSourceGraph.mjs"
            environment = (("G7PB_EDITOR_CONTRACT_CHECKERS", json.dumps(selected, sort_keys=True)),
                           ("G7PB_EDITOR_SOURCE_GRAPH", str(source_helper)))
            try:
                controller_inputs.extend(editor_contract_inputs(root, source_helper))
            except (OSError, ValueError, subprocess.SubprocessError) as error:
                plan.unresolved.append(f"Editor contract source inputs required: {error}")
                reusable = False
        add("python:" + path, ["python3", "-B", "-m", "unittest", "discover", "-s", "tests/Harness", "-p", Path(path).name],
            [*python_inputs(root, path), *controller_inputs, *([cause] if cause else [])], "Changed Python module or dependency", requires,
            reusable=reusable and Path(path).name != "test_boundary_command.py", env=environment)
    # The Node architecture regression invokes the real Python planner. Its
    # transitive Python/config inputs must select and invalidate that check too.
    design_python_inputs = python_inputs(root, "tools/g7pb/planner.py")
    def design_tests():
        add("design-architecture-tests", ["node", "--test", "tests/Harness/design-architecture.test.mjs"],
            [*DESIGN_INPUTS, *design_python_inputs, "tests/Harness/design-architecture.test.mjs", "package-lock.json"],
            "Architecture contract regression", ("node", "php"))
    py_tests = sorted(p.relative_to(root).as_posix() for p in (root / "tests/Harness").glob("test_*.py"))
    ts_sources, ts_tests, php_sources, php_tests, css, content, viewer_styles = [], [], [], [], [], [], []
    migrations = []
    mapping = {
        "Makefile": ("planner", "runner", "php_coverage"), "scripts/quality-scoped.sh": ("planner", "runner"),
        "scripts/coord-harness.sh": ("coord",) if (root / "tests/Harness/test_coord.py").exists() else ("planner",),
        ".github/workflows/ci.yml": ("environment", "php_coverage"), "scripts/dev-sync-module.sh": ("environment",),
        "tests/Harness/verification-policy.test.sh": ("planner", "runner"),
        "scripts/check-block-product-quality.mjs": ("product_quality_command",),
        "scripts/check-boundaries.sh": ("boundary_command",),
        COMPILER_COVERAGE: ("php_coverage",),
        "scripts/lib/blockPackRegistryBoundary.mjs": ("boundary_command",),
        "scripts/check-editor-acceptance-contract.mjs": ("editor_contracts",),
        "scripts/check-editor-layout-parity.mjs": ("editor_contracts",),
        "scripts/lib/editorContractRegistration.mjs": ("editor_contracts",),
        "scripts/lib/editorCssSources.mjs": ("editor_contracts",),
        "scripts/lib/editorSourceGraph.mjs": ("editor_contracts",),
        "tests/Harness/editor-acceptance-contract.test.sh": ("editor_contracts",),
        "tests/Harness/editor-layout-parity-contract.test.sh": ("editor_contracts",),
        "scripts/lib/typeImportChanges.mjs": ("type_import_changes",),
        "playwright.config.ts": ("browser_registration",),
    }
    command_contracts = {"tests/Harness/" + name for name in (
        "block-quality-evidence.test.sh", "block-quality-gate-wiring.test.sh", "block-product-quality-contract.test.sh")}
    product_changed = any(p.startswith(("src/", "resources/", "database/", "schemas/", "config/")) for p in plan.paths)
    release_scripts = {"release-package.sh", "deploy-staging.sh", "remote-deploy-staging.sh", "smoke-staging.sh", "staging-doctor.sh", "remote-staging-doctor.sh"}
    content_scripts = {"build-official-store.php", "render-block-thumbnail-fixtures.php", "generate-block-thumbnails.mjs", "check-official-store-build.sh", "check-block-quality-evidence.mjs", "check-block-product-quality.mjs", "check-site-shell-product-quality.mjs"}
    for path in plan.paths:
        file = root / path
        if path.endswith(".py"):
            if file.exists():
                add("syntax:" + path, ["python3", "-B", "-c", "import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())", path], [path], "Changed Python syntax")
            affected = [t for t in py_tests if path == t or path in python_inputs(root, t)]
            if path == "scripts/g7pb.py" or path.endswith("/cli.py"):
                affected = py_tests
            if path.startswith("tools/g7pb/") and Path(path).name != "__init__.py" and not affected:
                affected = [f"tests/Harness/test_{Path(path).stem}.py"]
            for test in affected:
                python_test(test, path)
            if path in design_python_inputs:
                design_tests()
        elif path in DESIGN_INPUTS or path == "tests/Harness/design-architecture.test.mjs":
            design_tests()
        elif path in mapping:
            for name in mapping[path]:
                python_test(f"tests/Harness/test_{name}.py", path)
        elif path in command_contracts:
            python_test("tests/Harness/test_commands.py", path)
        elif path.startswith("scripts/") and Path(path).name in release_scripts:
            python_test("tests/Harness/test_release.py", path)
        elif path.startswith("scripts/") and (Path(path).name in content_scripts or path.startswith("scripts/lib/")):
            python_test("tests/Harness/test_content.py", path)
        elif path.startswith("tests/Harness/") and path.endswith(".sh"):
            if file.exists():
                add("harness:" + path, ["bash", path], [path, "scripts/coord-harness.sh", *python_inputs(root, "tools/g7pb/coord.py")], "Changed harness regression")
        elif path.startswith("tests/E2E/"):
            # A new spec can become a helper consumer without touching the
            # dispatch map. Recheck that map when its actual input graph changes.
            # Minimal isolated planner fixtures need not declare this repository
            # audit; deleting the real test is handled by the missing-test gate.
            if BROWSER_CONSUMER_TEST in py_tests and (
                    path.endswith((".spec.ts", ".spec.tsx")) or path in consumer_inputs()[0]):
                python_test(BROWSER_CONSUMER_TEST, path)
            if path == "tests/E2E/editorStructureTheme.spec.ts" and "tests/Harness/test_editor_contracts.py" in py_tests:
                python_test("tests/Harness/test_editor_contracts.py", path)
            selected_specs = SITE_PART_SPECS if path in SITE_PART_HELPERS else BROWSER_HELPER_SPECS.get(path, ())
            if path.endswith((".spec.ts", ".spec.tsx")):
                selected_specs = (path,)
            if path in SITE_PART_HELPERS:
                python_test("tests/Harness/test_site_part_fixture.py", path)
                if file.suffix == ".php":
                    add("syntax:" + path, ["php", "-l", path], [path], "Test-owned fixture PHP syntax", ("php",))
            if not selected_specs:
                plan.unresolved.append(f"Select the owning browser scenario for {path}")
            for spec in selected_specs:
                inputs = [*source_inputs(root, spec).files, spec, "playwright.config.ts", "package-lock.json"]
                if spec in SITE_PART_SPECS:
                    inputs.extend(SITE_PART_HELPERS)
                # Test-registration refactors do not claim that the product ran.
                if product_changed and not full:
                    add("browser:" + spec, ["npx", "--no-install", "playwright", "test", spec, "--retries=0"], inputs, "Changed browser scenario and product", ("node", "php", "g7", "browser"), True, env=BROWSER_ENVIRONMENT)
                elif not full:
                    add("browser-registration:" + spec, ["npx", "--no-install", "playwright", "test", spec, "--list", "--reporter=line"], inputs, "Harness-only test collection; NOT product/browser acceptance", ("node",), reusable=False)
        elif path.startswith("tests/Unit/") and path.endswith((".test.ts", ".test.tsx")):
            ts_tests.append(path)
        elif path.startswith(("tests/UnitPhp/", "tests/Integration/")) and path.endswith(".php"):
            php_tests.append(path)
        elif path.startswith("resources/js/") and path.endswith((".ts", ".tsx")):
            ts_sources.append(path)
        elif path.startswith("src/") and path.endswith(".php"):
            php_sources.append(path)
        elif path.startswith("database/migrations/") and path.endswith(".php"):
            if not full:
                migrations.append(path)
            add("syntax:" + path, ["php", "-l", path], [path], "Changed migration syntax", ("php",))
        elif path.endswith(".css"):
            css.append(path)
        elif path.startswith(("resources/store/", "resources/block-packs/")):
            content.append(path)
        elif path in {"package.json", "package-lock.json", "module.json"}:
            scripts_changed = False
            try:
                old = json.loads(git(root, "show", f"{base}:{path}"))
                current = json.loads(file.read_text())
                scripts_changed = path == "package.json" and old.get("scripts") != current.get("scripts")
                # Only the product's own version is metadata; dependency versions matter.
                for value in (old, current):
                    value.pop("version", None)
                    if path == "package.json":
                        value.pop("scripts", None)
                    if path == "package-lock.json":
                        value.get("packages", {}).get("", {}).pop("version", None)
                if old != current and not full:
                    plan.unresolved.append(f"Dependency/module change needs explicit full scope: {path}")
            except (ValueError, subprocess.CalledProcessError):
                plan.unresolved.append(f"Cannot compare metadata: {path}")
            add("version", ["node", "scripts/check-version-policy.mjs"], ["module.json", "package.json", "package-lock.json", "CHANGELOG.md", "scripts/check-version-policy.mjs"], "Release metadata consistency", ("node",))
            if scripts_changed:
                python_test("tests/Harness/test_commands.py", path)
        elif path.endswith(".md"):
            continue
        elif path == STANDALONE_VIEWER and not full and standalone_viewer_class_added(root, base):
            viewer_styles.append(path)
        elif path.startswith(("database/", "resources/routes/", "resources/layouts/", "resources/views/", "schemas/", "config/", "docker/")) or path in {"module.php", "compose.yaml", "composer.json", "composer.lock"}:
            if not full:
                plan.unresolved.append(f"Explicit shared runtime/contract scope required: {path}")
        else:
            plan.unresolved.append(f"Unclassified input (no full fallback): {path}")
        if path == COMPILER_COVERAGE:
            add("syntax:" + path, ["php", "-l", path], [path], "Coverage checker syntax", ("php",))
        if path.endswith(".sh") and file.exists():
            add("syntax:" + path, ["bash", "-n", path], [path], "Changed shell syntax")
        if path.endswith(".mjs") and file.exists():
            add("syntax:" + path, ["node", "--check", path], [path], "Changed JavaScript syntax", ("node",))
    try:
        ts_tests = related_tests(root, ts_sources, ts_tests, "tests/Unit", (".test.ts", ".test.tsx"))
        php_tests = related_tests(root, [*php_sources, *migrations], php_tests, "tests", ("Test.php",))
    except ValueError as error:
        plan.unresolved.append(str(error))
    for test in ts_tests:
        graph = source_inputs(root, test)
        add("unit:" + test, ["npx", "--no-install", "vitest", "run", test], [*graph.files, *ts_sources, "package-lock.json", "vite.config.ts", "tsconfig.json"], "Related unit behavior", ("node",), reusable=graph.reusable)
    if ts_sources or ts_tests or any(p.startswith("tests/E2E/") and p.endswith((".ts", ".tsx")) or p == "playwright.config.ts" for p in plan.paths):
        graph = typecheck_inputs(root)
        add("typecheck", ["npm", "run", "typecheck"], graph.files, "TypeScript command and configured type graph", ("node",), reusable=graph.reusable)
    design_targets = [p for p in plan.paths if p in NORMATIVE_DOCS or p in DESIGN_INPUTS
                      or (p.startswith(("resources/js/", "resources/css/", "src/")) and p.endswith((".ts", ".tsx", ".js", ".php", ".css")))]
    if design_targets:
        product_sources = any(p.startswith(("resources/", "src/")) for p in design_targets)
        # A task changing the guard must exercise its proposed guard/rules. An
        # older product worktree instead uses the verified controller's rules.
        policy_root = root if any(p in (*DESIGN_INPUTS, *BOUNDARY_INPUTS) for p in plan.paths) else controller_root
        external_controller = policy_root.resolve() != root.resolve()
        def controller_file(path):
            return str(policy_root / path) if external_controller else path
        command = (["bash", controller_file("scripts/check-boundaries.sh")] if product_sources
                   else ["node", controller_file("scripts/check-design-architecture.mjs")])
        if external_controller:
            command.extend(["--root", str(root.resolve())])
        command.extend(["--files", ",".join(design_targets)])
        # Boundary checks read project sources; cheap static scans are not browser/full gates.
        boundary_inputs = [p.relative_to(root).as_posix() for prefix in ("src", "resources/js", "resources/css")
                           for p in (root / prefix).rglob("*") if p.is_file()]
        add("architecture", command, [*design_targets, *(controller_file(p) for p in (*DESIGN_INPUTS, *NORMATIVE_DOCS)), *boundary_inputs,
                                      *(controller_file(p) for p in BOUNDARY_INPUTS), controller_file("package-lock.json"), "module.php", "package-lock.json"],
            "Changed implementation or normative architecture policy", ("node", "php"))
    artifact_names = set()
    if css:
        add("css", ["npx", "--no-install", "stylelint", *css], [*css, "stylelint.config.mjs", "package-lock.json"], "Changed CSS only", ("node",))
        if not full:
            # Styles are code inputs. Their artifact check must not discover or
            # validate catalog content just to reach check-assets.
            add("style-assets", ["node", "scripts/check-assets.mjs"],
                [*css, "scripts/check-assets.mjs", "package-lock.json"], "Built CSS/JS artifact integrity",
                ("node", "php", "g7", "browser"), True, reusable=False)
            artifact_names.add("style-assets")
    compiler_changed = any(p == COMPILER_FACADE or p.startswith(COMPILER_OWNERS) or p == COMPILER_TEST for p in plan.paths)
    php_graphs = {test: source_inputs(root, test) for test in php_tests}
    family = compiler_family(root) if compiler_changed else ()
    covered_tests = [test for test, graph in php_graphs.items() if not full and compiler_changed
                     and (test == COMPILER_TEST or set(family).intersection(graph.files))]
    for test, graph in php_graphs.items():
        if test in covered_tests:
            continue  # One Xdebug execution owns both these assertions and their coverage.
        g7 = test.startswith("tests/Integration/")
        argv = (["vendor/bin/phpunit"] + (["--bootstrap", "tests/Integration/bootstrap.php"] if g7 else [])
                + ([] if full else ["--exclude-group", "content-catalog"]) + [test])
        add("php:" + test, argv, [*graph.files, *php_sources, "composer.lock", "phpunit.xml.dist"], "Related PHP behavior", ("php", "g7") if g7 else ("php",), g7, graph.reusable)
    if covered_tests:
        graphs = [php_graphs[test] for test in covered_tests]
        g7 = any(test.startswith("tests/Integration/") for test in covered_tests)
        if g7:
            graphs.append(source_inputs(root, "tests/Integration/bootstrap.php"))
        add("php-compiler-coverage", ["php", COMPILER_COVERAGE, "--run-compiler",
            *[part for test in covered_tests for part in ("--test", test)]],
            [COMPILER_COVERAGE, *family, *php_sources, *[p for graph in graphs for p in graph.files],
             "composer.json", "composer.lock", "phpunit.xml.dist"],
            "Compiler code assertions and facade/family 87% Xdebug coverage; scoped content-catalog exclusion",
            ("php", "g7") if g7 else ("php",), True, reusable=all(graph.reusable for graph in graphs),
            env=(("XDEBUG_MODE", "coverage"),))
    if php_sources:
        add("php-lint", ["vendor/bin/pint", "--test", *php_sources], [*php_sources, "composer.lock"], "Changed PHP style", ("php",))
        for adapter in (False, True):
            selected = [p for p in php_sources if p.startswith(("src/Infrastructure/", "src/Providers/", "src/routes/")) == adapter]
            if not selected:
                continue
            config = "phpstan-g7.neon.dist" if adapter else "phpstan.neon.dist"
            argv = ["vendor/bin/phpstan", "analyse", "-c", config, "--memory-limit=1G", "--no-progress"]
            if adapter:
                argv.append("--autoload-file=/var/www/g7/vendor/autoload.php")
            argv.extend(selected)
            inputs = [p.relative_to(root).as_posix() for p in (root / "src").rglob("*.php")]
            add("phpstan:g7" if adapter else "phpstan:core", argv, [*inputs, config, "composer.json", "composer.lock"],
                "Changed PHP types and dependency contracts", ("php", "g7") if adapter else ("php",), adapter)
    if not full:
        for scenario in scenarios_for([*browser_sources(root, ts_sources, base), *php_sources, *css, *viewer_styles]):
            if not (root / scenario.spec).is_file():
                plan.unresolved.append(f"Missing required browser scenario: {scenario.spec}")
                continue
            name = "browser:" + scenario.spec
            # A changed spec requests all its tests. Source mapping must not
            # overwrite that explicit scope with a narrower title/preset filter.
            expectations = tuple((project, title) for project in scenario.projects for title in scenario.titles)
            if name in gates:
                gates[name] = replace(gates[name], browser_expectations=tuple(sorted(set(gates[name].browser_expectations + expectations))))
                continue
            try:
                environment = scenario.environment(root)
            except (ValueError, OSError, KeyError) as error:
                plan.unresolved.append(f"Browser target selection required: {error}")
                continue
            add(name, scenario.arguments(),
                [*plan.paths, *source_inputs(root, scenario.spec).files, "playwright.config.ts", "package-lock.json", "tools/g7pb/browser_requirements.py"],
                "Existing user workflow affected by product source changes", ("node", "php", "g7", "browser"), True, env=environment, browser_expectations=expectations)
    if content:
        try:
            policy = content_policy(root, plan.paths)
            for item in policy.select_changes(root, base, content):
                kind, ids = item["kind"], item["ids"]
                if not ids:
                    raise ValueError(f"Empty content target: {kind}")
                required_build = policy.plan(root, kind, ids).get("requires_build", False)
                if not isinstance(required_build, bool):
                    raise ValueError(f"Invalid requires_build contract for {kind}")
                name = "content:" + kind + ":" + ",".join(ids)
                add(name, ["python3", "-B", "scripts/g7pb.py", "content", "check", "--kind", kind, "--ids", ",".join(ids)],
                    [*content, *python_inputs(root, "tools/g7pb/content.py")], "Changed content and declared consumers",
                    ("node", "php", "g7", "browser") if required_build else ("node", "php"), required_build, reusable=False)
                if required_build:
                    artifact_names.add(name)
        except (ImportError, ValueError, OSError) as error:
            plan.unresolved.append(f"Content selection required: {error}")
    if full:
        add("full-product", ["make", "quality-gate"], plan.paths, "Explicit full runtime/RC scope", ("node", "php", "g7", "browser"), True)
    browser_gates = [replace(gate, inputs=tuple(sorted(set(gate.inputs) | set(SITE_PART_HELPERS) | set(python_inputs(root, "tools/g7pb/runner.py")))))
                     if name.removeprefix("browser:") in SITE_PART_SPECS else gate
                     for name, gate in gates.items() if name.startswith("browser:")]
    artifacts = [gate for name, gate in gates.items() if name in artifact_names]
    plan.gates = [gate for name, gate in gates.items() if not name.startswith("browser:") and name not in artifact_names]
    if browser_gates or artifacts:
        # The controller orchestrates the installed runtime; never execute its
        # Docker-aware environment command inside Docker a second time. build()
        # verifies source/env AND existing artifact hashes before reusing assets.
        runtime = "local" if phase == "ci" else "docker"
        command = ["python3", "-B", str(controller_root / "scripts/g7pb.py"), "environment"]
        controller_inputs = [str(controller_root / p) for p in python_inputs(controller_root, "tools/g7pb/environment.py")]
        inputs = [*build_inputs(root), "package.json", "package-lock.json", ".npmrc", *controller_inputs]
        before = []
        selected_sync = sync_plan(plan.paths)
        if selected_sync["actions"]:
            add("browser-runtime-sync", [*command, "sync", "--root", str(root.resolve()), "--runtime", runtime,
                "--paths", *plan.paths, "--apply"], [*plan.paths, *controller_inputs],
                "Apply only changed G7 declarations/views before browser execution", ("node", "php", "g7", "browser"),
                True, reusable=False, execution="controller")
            before.append(gates["browser-runtime-sync"])
        add("browser-assets", [*command, "build", "--root", str(root.resolve()), "--runtime", runtime, "--apply"], inputs,
            "Require candidate source/env/dist fingerprint before browser execution; reuse only matching assets",
            ("node", "g7", "browser"), True, reusable=False, execution="controller", depends_on=[g.name for g in before])
        plan.gates.extend([*before, gates["browser-assets"]])
        plan.gates.extend(replace(gate, depends_on=("browser-assets",)) for gate in artifacts)
        plan.gates.extend(replace(gate, depends_on=("browser-assets", *sorted(artifact_names))) for gate in browser_gates)
    return plan
