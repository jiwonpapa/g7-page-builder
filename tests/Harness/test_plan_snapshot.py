import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from tools.g7pb.model import Gate, Plan
from tools.g7pb.plan_snapshot import load, save
from tools.g7pb.planner import build_plan, changed_paths
from tools.g7pb.gitops import Git


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

    def test_renamed_files_have_the_same_scope_in_coordination_and_execution(self):
        def git(*args):
            return subprocess.check_output(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', *args], cwd=self.root, text=True).strip()
        git('commit', '-qm', 'base')
        base = git('rev-parse', 'HEAD')
        git('mv', 'a', 'renamed')
        git('commit', '-qm', 'rename')
        head = git('rev-parse', 'HEAD')
        (self.root / '.git/info/exclude').write_text('.runtime/\n')
        paths = Git(self.root).paths(base, head)
        self.assertEqual(paths, ['a', 'renamed'])
        self.assertEqual(changed_paths(self.root, base, head), paths)
        self.assertEqual(changed_paths(self.root, base), paths)
        plan = Plan(paths, [Gate('rename', ('check',), tuple(paths), 'rename fixture')])
        save(self.root, self.path, plan, base=base, head=head)
        self.assertEqual(load(self.root, self.path, base=base, head=head,
                              paths=changed_paths(self.root, base, head), phase='verification', full=False), plan)

    def test_rename_retains_both_scope_paths_and_selects_current_consumers(self):
        def git(*args):
            return subprocess.check_output(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', *args], cwd=self.root, text=True).strip()
        old, new = 'resources/js/Old.ts', 'resources/js/Current.ts'
        test = 'tests/Unit/current.test.ts'
        for name, content in [(old, 'export const value = 1;'), (test, "import '../../resources/js/Old';")]:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)
        git('add', 'resources', 'tests')
        git('commit', '-qm', 'base')
        base = git('rev-parse', 'HEAD')
        git('mv', old, new)
        (self.root / test).write_text("import '../../resources/js/Current';")
        git('add', 'tests')
        git('commit', '-qm', 'rename')
        paths = changed_paths(self.root, base, git('rev-parse', 'HEAD'))
        plan = build_plan(self.root, paths, base=base, phase='verification')
        self.assertIn(old, plan.paths)
        self.assertIn(new, plan.paths)
        self.assertFalse(plan.unresolved, plan.unresolved)
        self.assertIn('unit:' + test, [g.name for g in plan.gates])
