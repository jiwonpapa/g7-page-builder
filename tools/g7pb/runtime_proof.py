"""Resume only a completed, lease-owned chain with observed runtime continuity."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
from .environment import Runtime
from .process import run


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, staged = tempfile.mkstemp(prefix='checkpoint-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream)
        os.replace(staged, path)
    finally:
        if os.path.exists(staged):
            os.unlink(staged)


def observe(root, task):
    if not task or not (root / '.env.docker.local').is_file():
        raise ValueError('No leased Docker environment for resume proof')
    runtime = Runtime(root, 'docker', task)
    containers = run(runtime.compose + ['ps', '-q', 'dev'], cwd=root, capture_output=True, text=True, check=True, timeout=15).stdout.strip()
    if not containers or '\n' in containers:
        raise ValueError('Expected one leased runtime container')
    identity = run(['docker', 'inspect', '--format', '{{.Id}} {{.Image}} {{.State.StartedAt}}', containers],
                   capture_output=True, text=True, check=True, timeout=15).stdout.strip()
    state = json.loads(run(runtime.command(['php', 'scripts/runtime-state.php'], timeout=35), cwd=root,
                          capture_output=True, text=True, check=True, timeout=45).stdout)
    if set(state) != {'database', 'application'} or any(len(value) != 64 for value in state.values()):
        raise ValueError('Invalid runtime state fingerprint')
    files = []
    for prefix in ('src', 'resources', 'database', 'schemas', 'dist'):
        files.extend(p for p in (root / prefix).rglob('*') if p.is_file() and not p.is_symlink())
    files.extend(p for p in (root / 'config').glob('*') if p.is_file() and not p.name.startswith('design-architecture'))
    files.extend(root / p for p in ('module.php', 'module.json', 'composer.lock', 'package-lock.json', '.env.docker.local') if (root / p).is_file())
    digest = hashlib.sha256((identity + state['application']).encode())
    for path in sorted(files):
        digest.update(str(path.relative_to(root)).encode() + b'\0' + hashlib.sha256(path.read_bytes()).digest())
    return {'environment': digest.hexdigest(), 'state': state['database']}


class RuntimeProof:
    def __init__(self, root, task, receipts, observer=None):
        self.root, self.task = root, task
        self.path = receipts / 'runtime' / ((task or 'ci') + '.json')
        self.observer = observer or observe
        self.current = None
        self.saved = {}
        self.reason = 'no-runtime-checkpoint'

    def prepare(self):
        try:
            current = self.observer(self.root, self.task)
            saved = json.loads(self.path.read_text()) if self.path.is_file() else {}
            if (saved.get('version') != 1 or saved.get('inflight') or saved.get('current') != current):
                self.reason = 'runtime-state-changed-or-incomplete' if saved else 'no-runtime-checkpoint'
                saved = {'passed': {}}
            else:
                self.reason = 'checkpoint-has-no-matching-gate'
            self.current, self.saved = current, saved
            return True
        except Exception as error:
            # Failed observation disables reuse, never widens test scope.
            self.current, self.saved = None, {}
            self.reason = 'runtime-proof-unavailable:' + type(error).__name__
            return False

    def receipt(self, key):
        record = self.saved.get('passed', {}).get(key)
        if not record or record.get('status') != 'passed':
            return None
        evidence = record.get('evidence', {}).get('directory')
        if not evidence or not (self.root / evidence / 'execution.json').is_file():
            self.reason = 'runtime-evidence-missing'
            return None
        try:
            observed = json.loads((self.root / evidence / 'execution.json').read_text())
            if observed.get('key') != key or observed.get('status') != 'passed':
                return None
        except (OSError, ValueError):
            return None
        return record

    def started(self):
        if self.current is not None:
            atomic_json(self.path, {'version': 1, 'current': self.current, 'inflight': True,
                                    'passed': self.saved.get('passed', {})})

    def finished(self, record, *, restored=True):
        if self.current is None:
            return
        try:
            current = self.observer(self.root, self.task)
            passed = self.saved.get('passed', {}) if restored and current['environment'] == self.current['environment'] else {}
            if record['status'] == 'passed' and restored and current['environment'] == self.current['environment']:
                passed[record['key']] = record
            atomic_json(self.path, {'version': 1, 'current': current, 'inflight': not restored, 'passed': passed})
        except Exception:
            # Leave the inflight checkpoint: the next run cannot reuse it.
            self.reason = 'runtime-checkpoint-incomplete'
