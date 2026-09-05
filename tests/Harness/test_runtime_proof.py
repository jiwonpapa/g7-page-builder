import json
from pathlib import Path
import tempfile
import unittest
from tools.g7pb.runtime_proof import RuntimeProof


class RuntimeProofTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = {'environment': 'build-1/container-1', 'state': 'db-1'}
        self.proof = RuntimeProof(self.root, 'owned', self.root/'receipts', lambda *_: dict(self.state))
        evidence = self.root/'output/playwright/fixture'
        evidence.mkdir(parents=True)
        self.record = {'key':'a', 'status':'passed', 'gate':'browser:a', 'evidence':{'directory':'output/playwright/fixture'}}
        (evidence/'execution.json').write_text(json.dumps(self.record))

    def passed(self):
        self.proof.prepare(); self.proof.started(); self.proof.finished(self.record)

    def test_known_failed_step_preserves_prior_success_for_resume(self):
        self.passed()
        self.proof.prepare(); self.proof.started()
        self.state['state'] = 'db-after-known-failure'
        self.proof.finished({'key':'b', 'status':'failed'})
        self.assertTrue(self.proof.prepare())
        self.assertEqual(self.proof.receipt('a'), self.record)
        self.assertIsNone(self.proof.receipt('b'))

    def test_unobserved_database_build_or_container_change_invalidates(self):
        for field in ('state', 'environment'):
            with self.subTest(field=field):
                self.passed()
                self.state[field] += '-external-change'
                self.proof.prepare()
                self.assertIsNone(self.proof.receipt('a'))

    def test_interruption_and_restore_failure_cannot_reuse(self):
        self.passed(); self.proof.prepare(); self.proof.started()
        self.proof.prepare()
        self.assertIsNone(self.proof.receipt('a'))
        self.passed(); self.proof.prepare(); self.proof.started()
        self.proof.finished(self.record, restored=False)
        self.proof.prepare()
        self.assertIsNone(self.proof.receipt('a'))

    def test_missing_evidence_or_observer_disables_reuse(self):
        self.passed()
        (self.root/'output/playwright/fixture/execution.json').unlink()
        self.proof.prepare()
        self.assertIsNone(self.proof.receipt('a'))
        self.proof.observer = lambda *_: (_ for _ in ()).throw(ValueError('unavailable'))
        self.assertFalse(self.proof.prepare())
