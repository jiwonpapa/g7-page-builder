import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from tools.g7pb.model import Gate, Plan
from tools.g7pb.plan_snapshot import load, save


class PlanSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(['git', 'init', '-q', self.temp.name], check=True)
        (self.root / 'a').write_text('one')
        subprocess.run(['git', 'add', 'a'], cwd=self.root, check=True)
        self.plan = Plan(['a'], [Gate('a', ('check',), ('a',), 'fixture')])
        self.path = self.root / '.runtime/resolved.json'
        save(self.root, self.path, self.plan, base='before', head='after')

    def read(self, **kwargs):
        return load(self.root, self.path, **dict(base='before', head='after', paths=['a'], phase='verification', full=False, **kwargs))

    def test_round_trip_preserves_exact_execution_contract(self):
        self.assertEqual(self.read(), self.plan)

    def test_changed_input_rejects_before_execution(self):
        (self.root / 'a').write_text('two')
        with self.assertRaisesRegex(ValueError, 'inputs changed'):
            self.read()

    def test_new_tracked_member_rejects_old_selection(self):
        (self.root / 'new').write_text('new test')
        subprocess.run(['git', 'add', 'new'], cwd=self.root, check=True)
        with self.assertRaisesRegex(ValueError, 'inputs changed'):
            self.read()

    def test_changed_scope_and_corrupt_schema_rejected(self):
        with self.assertRaises(ValueError):
            load(self.root, self.path, base='wrong', head='after', paths=['a'], phase='verification', full=False)
        data = json.loads(self.path.read_text())
        data['plan']['gates'][0]['unrecognized'] = True
        self.path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'schema changed'):
            self.read()
