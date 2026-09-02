"""Command contracts only: no product render, collection, build, browser or deploy.

Content/evidence behavior stays in test_content.py and the quality Vitest suites.
These contracts are valid before or after the content/release tasks integrate;
they never import those tasks or infer a product approval from command wiring.
"""
import copy
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
CONTENT = "python3 scripts/g7pb.py content"
FULL_GATES = [
    "npm run check:version",
    "npm run check:store -- --all",
    "npm run check:editor-acceptance",
    "npm run check:editor-layout-parity",
    "npm run typecheck",
    "npm run lint:css",
    "npm run test:coverage",
    "npm run check:g7-budget",
    "npm run check:boundaries",
    "npm run build",
    "npm run check:block-product-quality -- --technical",
    "npm run check:content -- --kind block --all",
    "npm run check:content -- --kind preset --all",
    "npm run check:block-quality-evidence",
    "npm run test:commands",
    "npm run check:assets",
    "npm run check:frontend-budgets",
]
PRODUCT_SPECS = [
    "pageBuilderLifecycle", "sitePartLifecycle", "globalSiteShellRoutes",
    "officialStore", "publicQuality", "blockCatalogQuality", "editorPerformance",
    "editorInteractionQuality", "editorLayoutParity",
]
MANUAL_ALIASES = {
    "build:store": "php scripts/build-official-store.php",
    "generate:block-library": "node scripts/sync-builtin-layout-presets.mjs && npm run build && npm run generate:block-thumbnails",
    "generate:block-thumbnails": "node scripts/generate-block-thumbnails.mjs",
    "check:store": "bash scripts/check-official-store-build.sh",
    "check:block-product-quality": "node scripts/check-block-product-quality.mjs",
    "check:block-quality-evidence": "node scripts/check-block-quality-evidence.mjs",
    "check:site-shell-product-quality": "node scripts/check-site-shell-product-quality.mjs",
    "test:e2e:site-shell": "node scripts/check-site-shell-product-quality.mjs --run",
    "test:block-quality-evidence": "bash tests/Harness/block-quality-evidence.test.sh",
}
WRAPPERS = {
    "block-quality-evidence.test.sh": "EvidenceCommandTests",
    "block-quality-gate-wiring.test.sh": "CommandWiringTests",
    "block-product-quality-contract.test.sh": "ProductCommandTests",
}


def scripts():
    return json.loads((ROOT / "package.json").read_text())["scripts"]


def chain(value):
    """The declared full path must be a fail-fast chain, never a masked check."""
    parts = value.split(" && ")
    for part in parts:
        tokens = shlex.split(part)
        if not tokens or any(token in {"&&", "||", ";", "|"} for token in tokens):
            raise ValueError("Expected a fail-fast command chain")
    return parts


def require_full(value):
    if chain(value) != FULL_GATES:
        raise ValueError("Full check must preserve every explicit, ordered gate exactly once")


def require_isolated_unit(value):
    if value.get("test:unit") != "vitest run":
        raise ValueError("Unit entry must only run Vitest and forward selected test arguments")
    if any(name in value for name in ("pretest:unit", "posttest:unit", "pretest:e2e:product", "posttest:e2e:product")):
        raise ValueError("Unit/product E2E lifecycle hooks must not hide additional checks")


class CommandWiringTests(unittest.TestCase):
    def test_unit_and_product_e2e_have_no_hidden_full_checks(self):
        value = scripts()
        require_isolated_unit(value)
        expected = "playwright test " + " ".join(f"tests/E2E/{name}.spec.ts" for name in PRODUCT_SPECS)
        self.assertEqual(chain(value["test:e2e:product"]), [expected, "npm run test:e2e:site-shell"])

    def test_full_check_preserves_explicit_inventory_and_required_product_gates(self):
        require_full(scripts()["check"])

    def test_missing_duplicate_reordered_or_masked_full_gate_fails(self):
        for gate in FULL_GATES:
            broken = [item for item in FULL_GATES if item != gate]
            with self.subTest(missing=gate), self.assertRaises(ValueError):
                require_full(" && ".join(broken))
        for broken in [FULL_GATES + [FULL_GATES[0]], list(reversed(FULL_GATES)),
                       ["true" if "--kind block" in item else item for item in FULL_GATES]]:
            with self.subTest(broken=broken), self.assertRaises(ValueError):
                require_full(" && ".join(broken))
        for replacement in ["--technical || true", "--technical --verify-render-source", "--release"]:
            with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                require_full(scripts()["check"].replace("--technical", replacement))

    def test_reintroduced_unit_or_e2e_preflight_fails(self):
        original = scripts()
        for key, command in [("test:unit", "npm run check:block-quality-evidence && vitest run"),
                             ("pretest:unit", "npm run check"),
                             ("pretest:e2e:product", "npm run check:content -- --kind block --all")]:
            candidate = copy.deepcopy(original)
            candidate[key] = command
            with self.subTest(key=key), self.assertRaises(ValueError):
                require_isolated_unit(candidate)

    def test_compatibility_wrappers_forward_selection_and_exit_status(self):
        # Run only a uniquely owned recorder, never Python's actual test command.
        with tempfile.TemporaryDirectory(prefix="g7pb-command-wrapper-") as temporary:
            tool = Path(temporary) / "python3"
            tool.write_text(f"#!{sys.executable}\nimport json, os, sys\n"
                            "print(json.dumps(sys.argv[1:]))\n"
                            "raise SystemExit(int(os.environ['COMMAND_TEST_STATUS']))\n")
            tool.chmod(0o755)
            for wrapper, group in WRAPPERS.items():
                for status in (0, 17):
                    env = {**os.environ, "PATH": temporary + os.pathsep + os.environ.get("PATH", ""),
                           "COMMAND_TEST_STATUS": str(status)}
                    result = subprocess.run(["bash", str(ROOT / "tests/Harness" / wrapper), "-v"],
                                            cwd=temporary, env=env, text=True, capture_output=True, check=False)
                    with self.subTest(wrapper=wrapper, status=status):
                        self.assertEqual(result.returncode, status, result.stderr)
                        self.assertEqual(json.loads(result.stdout),
                                         ["-B", str(ROOT / "tests/Harness/test_commands.py"), group, "-v"])


class EvidenceCommandTests(unittest.TestCase):
    def test_default_evidence_alias_is_diagnostic_without_collection_or_refresh(self):
        value = scripts()
        self.assertEqual(value["check:block-quality-evidence"], MANUAL_ALIASES["check:block-quality-evidence"])
        self.assertEqual(value["test:block-quality-evidence"], MANUAL_ALIASES["test:block-quality-evidence"])
        for command in chain(value["check"]):
            self.assertNotIn("--require-ready", command)
            self.assertNotIn("--refresh", command)
            self.assertNotIn("--snapshot", command)
            self.assertNotIn("--release", command)

    def test_selected_content_entry_has_no_implicit_all_or_generation(self):
        value = scripts()
        self.assertEqual(value["content"], CONTENT)
        self.assertEqual(value["check:content"], CONTENT + " check")
        for kind, target in [("kit", "sample-kit"), ("block", "block:content.hero@1"),
                             ("preset", "preset:builtin/core:hero.one"), ("site-shell", "mobile")]:
            # npm's -- appends these exact arguments; no shell default broadens them.
            command = shlex.split(value["check:content"]) + ["--kind", kind, "--ids", target]
            self.assertEqual(command, ["python3", "scripts/g7pb.py", "content", "check", "--kind", kind, "--ids", target])
            self.assertNotIn("--all", command)

    def test_contract_suite_does_not_execute_a_product_command(self):
        self.assertEqual(scripts()["test:commands"],
                         "python3 -B -m unittest discover -s tests/Harness -p test_commands.py")
        for wrapper, group in WRAPPERS.items():
            source = (ROOT / "tests/Harness" / wrapper).read_text()
            self.assertIn(f'exec python3 -B "$root/tests/Harness/test_commands.py" {group} "$@"', source)
            for forbidden in ("collectCurrentEvidence", "--refresh", "npm run", "node scripts/", "--verify-render-source"):
                self.assertNotIn(forbidden, source)


class ProductCommandTests(unittest.TestCase):
    def test_manual_generation_and_audit_aliases_remain_explicit(self):
        value = scripts()
        for name, command in MANUAL_ALIASES.items():
            with self.subTest(name=name):
                self.assertEqual(value[name], command)

    def test_full_check_keeps_catalog_contract_and_current_render_checks_separate(self):
        commands = chain(scripts()["check"])
        build = commands.index("npm run build")
        for gate in ["npm run check:block-product-quality -- --technical",
                     "npm run check:content -- --kind block --all",
                     "npm run check:content -- --kind preset --all"]:
            self.assertGreater(commands.index(gate), build)
            self.assertEqual(commands.count(gate), 1)
        self.assertNotIn("--verify-render-source", scripts()["check"])
        self.assertFalse(any("generate:" in item or "build:store" in item for item in commands))

    def test_package_lock_and_module_versions_stay_aligned(self):
        package = json.loads((ROOT / "package.json").read_text())
        lock = json.loads((ROOT / "package-lock.json").read_text())
        module = json.loads((ROOT / "module.json").read_text())
        self.assertEqual(package["version"], module["version"])
        self.assertEqual(package["version"], lock["version"])
        self.assertEqual(package["version"], lock["packages"][""]["version"])
        for key in ("dependencies", "devDependencies", "engines"):
            self.assertEqual(package[key], lock["packages"][""][key])


if __name__ == "__main__":
    unittest.main()
