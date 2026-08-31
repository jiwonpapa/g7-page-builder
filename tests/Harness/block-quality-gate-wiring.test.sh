#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const source = {
  scripts: JSON.parse(read('package.json')).scripts,
  makefile: read('Makefile'),
  release: read('scripts/release-package.sh'),
  deploy: read('scripts/deploy-staging.sh'),
};
function validate(value) {
  assert.equal(value.scripts['check:block-quality-evidence'], 'node scripts/check-block-quality-evidence.mjs');
  for (const key of ['check', 'test:unit', 'pretest:e2e:product']) {
    const commands = value.scripts[key].split(' && ');
    assert(commands.includes('npm run check:block-quality-evidence'), `${key} omits shadow check`);
    if (key === 'check') assert(commands.indexOf('npm run build') < commands.indexOf('npm run check:block-quality-evidence'));
  }
  assert.equal(value.scripts['test:block-quality-evidence'], 'bash tests/Harness/block-quality-evidence.test.sh');
  assert(value.scripts.check.split(' && ').includes('npm run test:block-quality-evidence'));
  assert(value.makefile.split('\n').includes('\tbash tests/Harness/block-quality-gate-wiring.test.sh'));
  for (const key of ['release', 'deploy']) {
    const lines = value[key].split('\n');
    const strict = '(cd "$root" && npm run check:block-quality-evidence -- --require-ready)';
    assert(lines.includes(strict), `${key} omits exact fail-closed gate`);
    assert(lines.includes('(cd "$root" && npm run check:block-product-quality -- --verify-render-source --release)'), `${key} removed legacy gate`);
    assert(lines.includes('(cd "$root" && npm run check:site-shell-product-quality)'), `${key} removed site-shell gate`);
    const sideEffect = key === 'release' ? lines.indexOf('mkdir -p "$output_dir"') : lines.indexOf('"$root/scripts/staging-doctor.sh"');
    assert(sideEffect > lines.indexOf(strict), `${key} verifies only after side effects`);
  }
}
validate(source);
for (const mutate of [
  value => { value.scripts.check = value.scripts.check.replace('npm run check:block-quality-evidence', 'true'); },
  value => { value.scripts['test:unit'] = 'vitest run'; },
  value => { value.scripts['pretest:e2e:product'] = 'true'; },
  value => { value.release = value.release.replace('--require-ready)', '--require-ready) || true'); },
  value => { value.deploy = value.deploy.replace('--require-ready', '--json'); },
  value => { value.release = value.release.replace('--verify-render-source --release', '--candidate'); },
]) {
  const broken = structuredClone(source); mutate(broken);
  assert.throws(() => validate(broken));
}
console.log('BLOCK_QUALITY_GATE_WIRING OK: development shadow + release readiness; no deployment executed');
JS
