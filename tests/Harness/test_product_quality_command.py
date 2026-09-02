"""Isolated command-contract tests; no product imports, render, build or deploy."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scripts/check-block-product-quality.mjs"
GENERATOR = "scripts/check-block-product-quality.mjs --candidate --verify-render-source"
PRIMITIVES = {
    "check:block-product-quality": "node scripts/check-block-product-quality.mjs",
    "check:block-quality-evidence": "node scripts/check-block-quality-evidence.mjs",
}


class ProductQualityCommandTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = SOURCE.read_text()
        start = source.index("function validateWiring(")
        end = source.index("\nexport function validateBlockProductQuality", start)
        cls.wiring = source[start:end]
        cls.node = shutil.which("node")
        if cls.node is None:
            raise AssertionError("Node is required for the isolated JavaScript command contract")

    def validate(self, scripts=None, generator=GENERATOR):
        # Evaluate the actual small wiring function, without importing the product
        # module (Ajv, manifests, image artifacts, PHP renderer and main stay unused).
        program = r"""
const fs = require('node:fs');
const { resolve } = require('node:path');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const reads = [];
const readFixture = path => {
  reads.push(path);
  if (path !== resolve('/fixture', 'scripts/generate-block-thumbnails.mjs')) {
    throw new Error(`Unexpected orchestration file read: ${path}`);
  }
  return input.generator;
};
const run = new Function('readFileSync', 'resolve', 'packageJson', input.wiring +
  '\nconst errors = []; validateWiring(errors, "/fixture", packageJson); return errors;');
process.stdout.write(JSON.stringify({ errors: run(readFixture, resolve, { scripts: input.scripts }), reads }));
"""
        result = subprocess.run(
            [self.node, "-e", program],
            input=json.dumps({"wiring": self.wiring, "scripts": scripts if scripts is not None else PRIMITIVES,
                              "generator": generator}),
            text=True, capture_output=True, timeout=10, check=True,
        )
        return json.loads(result.stdout)

    def test_independent_unit_and_python_controller_need_no_legacy_pretest_chain(self):
        scripts = dict(PRIMITIVES, **{
            "test:unit": "vitest run",
            "check": "python3 scripts/g7pb.py run --phase verification",
            "check:content": "python3 scripts/g7pb.py content check",
        })
        result = self.validate(scripts)
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["reads"], ["/fixture/scripts/generate-block-thumbnails.mjs"])

    def test_explicit_diagnostics_do_not_require_fresh_render_in_every_chain(self):
        scripts = dict(PRIMITIVES, **{
            "test:unit": "vitest run",
            "check": "npm run build && npm run check:block-product-quality -- --technical && "
                     "npm run check:content -- --kind block --all && npm run check:block-quality-evidence",
        })
        self.assertEqual(self.validate(scripts)["errors"], [])

    def test_product_and_evidence_primitives_cannot_be_removed_or_replaced(self):
        for name in PRIMITIVES:
            for replacement in (None, "true", PRIMITIVES[name] + " --candidate"):
                with self.subTest(command=name, replacement=replacement):
                    scripts = dict(PRIMITIVES)
                    if replacement is None:
                        scripts.pop(name)
                    else:
                        scripts[name] = replacement
                    errors = self.validate(scripts)["errors"]
                    self.assertEqual(len(errors), 1)
                    self.assertIn(name, errors[0])

    def test_thumbnail_candidate_and_render_source_guards_are_preserved(self):
        for missing in ("--candidate", "--verify-render-source"):
            with self.subTest(missing=missing):
                errors = self.validate(generator=GENERATOR.replace(missing, ""))["errors"]
                self.assertEqual(len(errors), 1)
                self.assertIn("썸네일", errors[0])


if __name__ == "__main__":
    unittest.main()
