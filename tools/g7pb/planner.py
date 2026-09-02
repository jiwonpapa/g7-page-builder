"""Shared change-to-check policy. Unknown inputs never become a full run."""
import ast
from dataclasses import replace
import json
from pathlib import Path
import subprocess
from .model import Gate, Plan
from .inputs import source_inputs
from .browser_requirements import BROWSER_ENVIRONMENT, scenarios_for
from .environment import build_inputs, sync_plan


DESIGN_INPUTS = (
    "scripts/check-design-architecture.mjs", "config/design-architecture.json", "config/design-architecture-debt.json",
    "scripts/lib/designArchitecturePolicy.mjs", "scripts/lib/designArchitectureTypeScript.mjs",
    "scripts/lib/designArchitecturePhp.mjs", "scripts/lib/designArchitectureCss.mjs",
)
NORMATIVE_DOCS = {
    "AGENTS.md", "docs/architecture.md", "docs/development-constitution.md",
    "docs/productization/editing-policy.md", "docs/productization/requirements.md",
    "docs/quality-harness.md", "docs/worktree-coordination.md",
}


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


def build_plan(root: Path, paths: list[str], *, base="HEAD", phase="submission", full=False):
    root = Path(root)
    controller_root = Path(__file__).resolve().parents[2]
    plan = Plan(sorted(set(paths)), full=full, phase=phase)
    gates = {}
    def add(name, argv, inputs, reason, requires=(), runtime=False, reusable=True, env=(), execution="runtime", depends_on=()):
        prior = gates.get(name)
        inputs = set(inputs) | (set(prior.inputs) if prior else set())
        gates[name] = Gate(name, tuple(argv), tuple(sorted(inputs)), reason, runtime, tuple(env), tuple(requires), reusable,
                           runtime and phase == "submission", execution, tuple(depends_on))
    def python_test(path, cause=""):
        if not (root / path).is_file():
            plan.unresolved.append(f"Missing infrastructure test: {path}")
            return
        requires = ("node", "php") if Path(path).name == "test_boundary_command.py" else ("node",) if Path(path).name in {"test_editor_contracts.py", "test_browser_registration.py"} else ()
        add("python:" + path, ["python3", "-B", "-m", "unittest", "discover", "-s", "tests/Harness", "-p", Path(path).name],
            [*python_inputs(root, path), *([cause] if cause else [])], "Changed Python module or dependency", requires,
            reusable=Path(path).name not in {"test_editor_contracts.py", "test_boundary_command.py"})
    py_tests = sorted(p.relative_to(root).as_posix() for p in (root / "tests/Harness").glob("test_*.py"))
    ts_sources, ts_tests, php_sources, php_tests, css, content = [], [], [], [], [], []
    mapping = {
        "Makefile": ("planner", "runner"), "scripts/quality-scoped.sh": ("planner", "runner"),
        "scripts/coord-harness.sh": ("coord",) if (root / "tests/Harness/test_coord.py").exists() else ("planner",),
        ".github/workflows/ci.yml": ("environment",), "scripts/dev-sync-module.sh": ("environment",),
        "tests/Harness/verification-policy.test.sh": ("planner", "runner"),
        "scripts/check-block-product-quality.mjs": ("product_quality_command",),
        "scripts/check-boundaries.sh": ("boundary_command",),
        "scripts/check-editor-acceptance-contract.mjs": ("editor_contracts",),
        "scripts/check-editor-layout-parity.mjs": ("editor_contracts",),
        "scripts/lib/editorContractRegistration.mjs": ("editor_contracts",),
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
        elif path in DESIGN_INPUTS or path == "tests/Harness/design-architecture.test.mjs":
            add("design-architecture-tests", ["node", "--test", "tests/Harness/design-architecture.test.mjs"],
                [*DESIGN_INPUTS, "tests/Harness/design-architecture.test.mjs", "package-lock.json"], "Architecture contract regression", ("node", "php"))
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
            if file.suffix in {".ts", ".tsx"}:
                # Test-registration refactors do not claim that the product ran.
                if product_changed and not full:
                    add("browser:" + path, ["npx", "--no-install", "playwright", "test", path, "--retries=0"], [path, "playwright.config.ts", "package-lock.json"], "Changed browser scenario and product", ("node", "php", "g7", "browser"), True, env=BROWSER_ENVIRONMENT)
                elif not full:
                    add("browser-registration:" + path, ["npx", "--no-install", "playwright", "test", path, "--list", "--reporter=line"], [path, "playwright.config.ts", "package-lock.json"], "Harness-only test collection; NOT product/browser acceptance", ("node",), reusable=False)
            else:
                plan.unresolved.append(f"Select the owning browser scenario for {path}")
        elif path.startswith("tests/Unit/") and path.endswith((".test.ts", ".test.tsx")):
            ts_tests.append(path)
        elif path.startswith(("tests/UnitPhp/", "tests/Integration/")) and path.endswith(".php"):
            php_tests.append(path)
        elif path.startswith("resources/js/") and path.endswith((".ts", ".tsx")):
            ts_sources.append(path)
        elif path.startswith("src/") and path.endswith(".php"):
            php_sources.append(path)
        elif path.endswith(".css"):
            css.append(path)
            content.append(path)
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
        elif path.startswith(("database/", "resources/routes/", "resources/layouts/", "resources/views/", "schemas/", "config/", "docker/")) or path in {"module.php", "compose.yaml", "composer.json", "composer.lock"}:
            if not full:
                plan.unresolved.append(f"Explicit shared runtime/contract scope required: {path}")
        else:
            plan.unresolved.append(f"Unclassified input (no full fallback): {path}")
        if path.endswith(".sh") and file.exists():
            add("syntax:" + path, ["bash", "-n", path], [path], "Changed shell syntax")
        if path.endswith(".mjs") and file.exists():
            add("syntax:" + path, ["node", "--check", path], [path], "Changed JavaScript syntax", ("node",))
    try:
        ts_tests = related_tests(root, ts_sources, ts_tests, "tests/Unit", (".test.ts", ".test.tsx"))
        php_tests = related_tests(root, php_sources, php_tests, "tests", ("Test.php",))
    except ValueError as error:
        plan.unresolved.append(str(error))
    for test in ts_tests:
        graph = source_inputs(root, test)
        add("unit:" + test, ["npx", "--no-install", "vitest", "run", test], [*graph.files, *ts_sources, "package-lock.json", "vite.config.ts", "tsconfig.json"], "Related unit behavior", ("node",), reusable=graph.reusable)
    if ts_sources:
        inputs = [p.relative_to(root).as_posix() for p in (root / "resources/js").rglob("*") if p.suffix in {".ts", ".tsx"}]
        add("typecheck", ["npm", "run", "typecheck"], [*inputs, "tsconfig.json", "package-lock.json"], "TypeScript type graph", ("node",))
    design_targets = [p for p in plan.paths if p in NORMATIVE_DOCS or p in DESIGN_INPUTS
                      or (p.startswith(("resources/js/", "resources/css/", "src/")) and p.endswith((".ts", ".tsx", ".js", ".php", ".css")))]
    if design_targets:
        product_sources = any(p.startswith(("resources/", "src/")) for p in design_targets)
        # A task changing the guard must exercise its proposed guard/rules. An
        # older product worktree instead uses the verified controller's rules.
        policy_root = root if any(p in DESIGN_INPUTS for p in plan.paths) else controller_root
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
        add("architecture", command, [*design_targets, *(controller_file(p) for p in DESIGN_INPUTS), *boundary_inputs,
                                      controller_file("scripts/check-boundaries.sh"), controller_file("package-lock.json"), "module.php", "package-lock.json"],
            "Changed implementation or normative architecture policy", ("node", "php"))
    if css:
        add("css", ["npx", "--no-install", "stylelint", *css], [*css, "stylelint.config.mjs", "package-lock.json"], "Changed CSS only", ("node",))
    for test in php_tests:
        g7 = test.startswith("tests/Integration/")
        argv = ["vendor/bin/phpunit"] + (["--bootstrap", "tests/Integration/bootstrap.php"] if g7 else []) + [test]
        graph = source_inputs(root, test)
        add("php:" + test, argv, [*graph.files, *php_sources, "composer.lock", "phpunit.xml.dist"], "Related PHP behavior", ("php", "g7") if g7 else ("php",), g7, graph.reusable)
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
        for scenario in scenarios_for([*ts_sources, *php_sources, *css]):
            if not (root / scenario.spec).is_file():
                plan.unresolved.append(f"Missing required browser scenario: {scenario.spec}")
                continue
            name = "browser:" + scenario.spec
            # A changed spec requests all its tests. Source mapping must not
            # overwrite that explicit scope with a narrower title/preset filter.
            if name in gates:
                continue
            try:
                environment = scenario.environment(root)
            except (ValueError, OSError, KeyError) as error:
                plan.unresolved.append(f"Browser target selection required: {error}")
                continue
            add(name, scenario.arguments(),
                [*plan.paths, *source_inputs(root, scenario.spec).files, "playwright.config.ts", "package-lock.json", "tools/g7pb/browser_requirements.py"],
                "Existing user workflow affected by product source changes", ("node", "php", "g7", "browser"), True, env=environment)
    if content:
        try:
            from .content import select_changes
            for item in select_changes(root, base, content):
                kind, ids = item["kind"], item["ids"]
                if not ids:
                    raise ValueError(f"Empty content target: {kind}")
                add("content:" + kind + ":" + ",".join(ids), ["python3", "-B", "scripts/g7pb.py", "content", "check", "--kind", kind, "--ids", ",".join(ids)], [*content, *python_inputs(root, "tools/g7pb/content.py")], "Changed content and declared consumers", ("node", "php"), reusable=False)
        except (ImportError, ValueError) as error:
            plan.unresolved.append(f"Content selection required: {error}")
    if full:
        add("full-product", ["make", "quality-gate"], plan.paths, "Explicit full runtime/RC scope", ("node", "php", "g7", "browser"), True)
    browser_gates = [gate for name, gate in gates.items() if name.startswith("browser:")]
    plan.gates = [gate for name, gate in gates.items() if not name.startswith("browser:")]
    if browser_gates:
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
        plan.gates.extend(replace(gate, depends_on=("browser-assets",)) for gate in browser_gates)
    return plan
