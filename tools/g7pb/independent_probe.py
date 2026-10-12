"""Exact IP1 experiment inputs; not a product dependency/full-gate exemption."""
from .model import Gate

PREFIX = "tests/IndependentEditor/"
FILES = tuple(PREFIX + name for name in (
    ".gitignore", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts",
    "index.html", "model.ts", "model.test.ts", "main.tsx", "Interactions.tsx", "probe.css",
    "probe.spec.ts", "playwright.config.ts", "verify.mjs",
))
CONTROLLERS = ("tools/g7pb/independent_probe.py", "tests/Harness/test_independent_probe.py")


def gates(root, paths, phase):
    if not set(paths).intersection(FILES):
        return (), ()
    inputs = (*FILES, *CONTROLLERS, "vite.puck-history.ts", "tsconfig.json", "package-lock.json")
    missing = tuple("Missing independent probe input: " + path for path in inputs if not (root / path).is_file())
    command = ("node", PREFIX + "verify.mjs")
    return (
        Gate("independent-probe:unit", (*command, "unit"), inputs,
             "Isolated strict types, transaction unit tests and import architecture", requires=("node",)),
        Gate("independent-probe:browser", (*command, "browser"), inputs,
             "IP1 production-bundle browser proof on disposable loopback server, never G7",
             runtime=True, requires=("node",), reusable=False, deferred=phase == "submission",
             execution="controller", depends_on=("independent-probe:unit",), timeout_seconds=300),
    ), missing
