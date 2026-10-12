from pathlib import Path
import tempfile
import unittest
from tools.g7pb.planner import CONTRACT_FIXTURE_CONSUMERS, build_plan, contract_fixture_inputs


class DocumentV3ScopeTests(unittest.TestCase):
    def test_shared_fixtures_have_both_language_consumers(self):
        for path in ("tests/Contract/document-v3.fixture.json", "tests/Fixtures/document-v3-cases.json"):
            self.assertEqual(CONTRACT_FIXTURE_CONSUMERS[path], (
                "tests/Unit/documentV3.test.ts", "tests/UnitPhp/DocumentV3Test.php"))
            for consumer in CONTRACT_FIXTURE_CONSUMERS[path]:
                self.assertIn(path, contract_fixture_inputs(consumer))

    def test_new_schemas_still_require_explicit_full_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for phase in ("submission", "integration", "verification", "ci"):
                for path in ("schemas/design-policy-v3.json", "schemas/page-builder-document-v3.schema.json"):
                    plan = build_plan(root, [path], phase=phase)
                    self.assertIn("Explicit shared runtime/contract scope required: " + path, plan.unresolved)
