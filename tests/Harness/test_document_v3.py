from pathlib import Path
import tempfile
import unittest
from tools.g7pb.planner import CONTRACT_FIXTURE_CONSUMERS, build_plan, contract_fixture_inputs


class DocumentV3ScopeTests(unittest.TestCase):
    def test_presentation_fixture_selects_its_exact_consumer_in_every_phase(self):
        fixture = "tests/Contract/document-v3-presentation.json"
        consumer = "tests/Unit/documentV3Presentation.test.ts"
        php_consumer = "tests/UnitPhp/DocumentV3PresentationTest.php"
        self.assertEqual(CONTRACT_FIXTURE_CONSUMERS[fixture], (consumer, php_consumer))
        self.assertIn(fixture, contract_fixture_inputs(consumer))
        self.assertIn(fixture, contract_fixture_inputs(php_consumer))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / fixture).parent.mkdir(parents=True)
            (root / fixture).write_text("[]")
            for phase in ("submission", "integration", "verification", "ci"):
                with self.subTest(phase=phase):
                    plan = build_plan(root, [fixture], phase=phase)
                    self.assertTrue(plan.unresolved)
                    self.assertTrue(any(consumer in reason for reason in plan.unresolved))
            (root / consumer).parent.mkdir(parents=True)
            (root / consumer).write_text("export {};")
            missing_php = build_plan(root, [fixture])
            self.assertTrue(any(php_consumer in reason for reason in missing_php.unresolved))
            (root / php_consumer).parent.mkdir(parents=True)
            (root / php_consumer).write_text("<?php")
            for phase in ("submission", "integration", "verification", "ci"):
                with self.subTest(phase=phase):
                    plan = build_plan(root, [fixture], phase=phase)
                    self.assertFalse(plan.unresolved, plan.unresolved)
                    self.assertFalse(plan.full)
                    gate = next(gate for gate in plan.gates if gate.name == "unit:" + consumer)
                    self.assertIn(fixture, gate.inputs)
                    php_gate = next(gate for gate in plan.gates if php_consumer in gate.argv)
                    self.assertIn(fixture, php_gate.inputs)
                    self.assertFalse(any(gate.name == "full-product" for gate in plan.gates))
            unknown = build_plan(root, ["tests/Contract/document-v3-unregistered.json"])
            self.assertTrue(any("Unclassified input" in reason for reason in unknown.unresolved))

    def test_shared_fixtures_have_both_language_consumers(self):
        for path in ("tests/Contract/document-v3.fixture.json", "tests/Fixtures/document-v3-cases.json"):
            self.assertEqual(CONTRACT_FIXTURE_CONSUMERS[path], (
                "tests/Unit/documentV3.test.ts", "tests/UnitPhp/DocumentV3Test.php") + ((
                "tests/Unit/documentV3Semantics.test.ts", "tests/UnitPhp/DocumentV3SemanticsTest.php")
                if path.endswith("document-v3-cases.json") else ()))
            for consumer in CONTRACT_FIXTURE_CONSUMERS[path]:
                self.assertIn(path, contract_fixture_inputs(consumer))

    def test_new_schemas_still_require_explicit_full_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for phase in ("submission", "integration", "verification", "ci"):
                for path in ("schemas/design-policy-v3.json", "schemas/page-builder-document-v3.schema.json"):
                    plan = build_plan(root, [path], phase=phase)
                    self.assertIn("Explicit shared runtime/contract scope required: " + path, plan.unresolved)
