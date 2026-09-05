"""Hand one resolved plan to execution; reject changed scope, policy, or inputs."""
from dataclasses import fields
import hashlib
import json
from pathlib import Path
import subprocess
from .model import Gate, Plan


def fingerprint(root, plan):
    names = set(plan.paths)
    names.update(name for gate in plan.gates for name in gate.inputs)
    names.update(str(p.relative_to(root)) for p in (root / 'tools/g7pb').glob('*.py'))
    names.update(('scripts/g7pb.py', 'config/design-architecture.json'))
    files = {}
    for name in sorted(names):
        path = root / name
        files[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else 'missing'
    # Scope and membership changes invalidate selection without executing it again.
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root)
    return hashlib.sha256(json.dumps(files, sort_keys=True).encode() + tracked
                          + json.dumps(plan.to_dict(), sort_keys=True).encode()).hexdigest()


def save(root, path, plan, *, base, head):
    record = {'version': 1, 'root': str(root.resolve()), 'base': base, 'head': head,
              'fingerprint': fingerprint(root, plan), 'plan': plan.to_dict()}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')


def load(root, path, *, base, head, paths, phase, full):
    record = json.loads(path.read_text())
    if (record.get('version'), record.get('root'), record.get('base'), record.get('head')) != (1, str(root.resolve()), base, head):
        raise ValueError('Saved plan checkout/base/head changed; resolve this scope again')
    data = record['plan']
    if (data['paths'], data['phase'], data['full']) != (paths, phase, full):
        raise ValueError('Saved plan scope/phase changed; resolve this scope again')
    gates = []
    allowed = {field.name for field in fields(Gate)}
    for item in data['gates']:
        if set(item) != allowed:
            raise ValueError('Saved gate schema changed')
        item = dict(item)
        for name in ('argv', 'inputs', 'requires', 'depends_on'):
            item[name] = tuple(item[name])
        for name in ('env', 'browser_expectations'):
            item[name] = tuple(tuple(pair) for pair in item[name])
        gates.append(Gate(**item))
    plan = Plan(paths, gates, data['unresolved'], full, phase)
    if fingerprint(root, plan) != record['fingerprint']:
        raise ValueError('Saved plan inputs changed; resolve this scope again (no checks executed)')
    return plan
