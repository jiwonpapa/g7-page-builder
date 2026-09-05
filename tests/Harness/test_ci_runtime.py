import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from tools.g7pb.ci_runtime import prepare

ROOT = Path(__file__).resolve().parents[2]


class CIRuntimeTests(unittest.TestCase):
    def test_hosted_runtime_claims_before_mutation_and_defers_duplicate_build(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root/'.runtime/gnuboard7').mkdir(parents=True)
            (root/'.runtime/gnuboard7/artisan').touch()
            calls = []
            def fake(argv, **kwargs):
                calls.append((argv, kwargs))
                return subprocess.CompletedProcess(argv, 0)
            with patch.dict(os.environ, {'CI':'true','GITHUB_ACTIONS':'true','RUNNER_ENVIRONMENT':'github-hosted'}):
                prepare(root, 'ci-fixture', fake)
            self.assertIn('coord-start', calls[0][0])
            install = next(kwargs for argv, kwargs in calls if argv == ['bash','scripts/dev-install.sh'])
            self.assertEqual(install['env']['G7PB_INSTALL_ASSETS'], 'defer')
            self.assertTrue(all(kwargs['timeout'] > 0 for _, kwargs in calls))
            self.assertTrue(json.loads((root/'.runtime/harness/ci-runtime.json').read_text())['prepared'])

    def test_local_machine_and_unowned_runtime_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'CI':''}):
            with self.assertRaisesRegex(ValueError, 'isolated'):
                prepare(Path(directory), 'ci-fixture', lambda *_: self.fail('must not execute'))

    def test_workflow_bootstraps_before_plan_and_executes_saved_plan(self):
        workflow = (ROOT/'.github/workflows/ci.yml').read_text()
        self.assertLess(workflow.index('Prepare planning dependencies'), workflow.index('Resolve the same verification plan'))
        self.assertIn('--save-plan .runtime/ci-resolved.json', workflow)
        self.assertIn('--plan .runtime/ci-resolved.json', workflow)
        self.assertIn('ci_runtime prepare', workflow)
        self.assertNotIn('This hosted runner has no installed/authenticated', workflow)
        installer = (ROOT/'scripts/dev-install.sh').read_text()
        self.assertIn('G7PB_INSTALL_ASSETS', installer)
        self.assertNotIn('npm ci --no-audit --no-fund && npm run build', installer)
