"""Prepare the existing Docker fixture only on an isolated GitHub-hosted runner."""
import argparse
import json
import os
from pathlib import Path
import subprocess
from .process import run
from .state import task_id


def prepare(root, task, executor=run):
    task_id(task)
    if not (os.environ.get('CI') == 'true' and os.environ.get('GITHUB_ACTIONS') == 'true'
            and os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted'):
        raise ValueError('CI runtime preparation requires an isolated GitHub-hosted runner')
    if not (root / '.runtime/gnuboard7/artisan').is_file():
        raise ValueError('Pinned G7 checkout is required before preparing the runtime')
    marker = root / '.runtime/harness/ci-runtime.json'
    if (root / '.env.docker.local').exists() and not marker.exists():
        raise ValueError('Refusing to adopt an existing unowned development runtime')
    def call(argv, **kwargs):
        return executor(argv, cwd=root, check=True, timeout=1800, **kwargs)
    if not marker.exists():
        call(['make', 'coord-start', 'TASK=' + task, 'AREAS=integration,runtime', 'PROFILE=mixed'])
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(json.dumps({'task': task, 'prepared': False}))
    elif json.loads(marker.read_text()).get('task') != task:
        raise ValueError('CI runtime belongs to a different task')
    call(['make', 'runtime-guard', 'TASK=' + task])
    call(['mkcert', '-install'])
    call(['bash', 'scripts/dev-bootstrap.sh'])
    compose = ['docker', 'compose', '--project-name', 'g7pb-dev', '--env-file', '.env.docker.local', '-f', 'compose.yaml']
    call([*compose, 'up', '-d', '--no-build'])
    # Installation uses the official installer. Selected browser-assets owns the
    # one required build and its receipt; installation must not build it twice.
    call(['bash', 'scripts/dev-install.sh'], env={**os.environ, 'G7PB_INSTALL_ASSETS': 'defer', 'TASK': task})
    marker.write_text(json.dumps({'task': task, 'prepared': True}))
    print('CI_RUNTIME_READY task=' + task, flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('prepare',))
    parser.add_argument('--task', required=True)
    args = parser.parse_args(argv)
    root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    prepare(root, args.task)
    return 0
