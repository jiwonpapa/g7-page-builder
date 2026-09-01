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
    const technical = `npm run check:block-product-quality -- --technical${key === 'test:unit' ? '' : ' --verify-render-source'}`;
    assert(commands.includes(technical), `${key} omits exact technical gate`);
    if (key === 'check') {
      const build = commands.indexOf('npm run build');
      assert(build >= 0 && build < commands.indexOf(technical), 'technical source check must follow build');
      assert(build < commands.indexOf('npm run check:block-quality-evidence'));
    }
  }
  assert.equal(value.scripts['test:block-quality-evidence'], 'bash tests/Harness/block-quality-evidence.test.sh');
  assert(value.scripts.check.split(' && ').includes('npm run test:block-quality-evidence'));
  assert(value.makefile.split('\n').includes('\tbash tests/Harness/block-quality-gate-wiring.test.sh'));
  for (const key of ['release', 'deploy']) {
    const lines = value[key].split('\n');
    const shadow = '(cd "$root" && npm run check:block-quality-evidence)';
    const technical = '(cd "$root" && npm run check:block-product-quality -- --technical --verify-render-source)';
    assert(lines.includes(shadow), `${key} omits evidence integrity gate`);
    assert(lines.includes(technical), `${key} omits automated product gate`);
    assert(!value[key].includes('--require-ready'), `${key} restored manual evidence readiness`);
    assert(!value[key].includes('--release)'), `${key} restored approval digest mode`);
    assert(lines.includes('(cd "$root" && npm run check:site-shell-product-quality)'), `${key} removed site-shell gate`);
    const sideEffect = key === 'release' ? lines.indexOf('mkdir -p "$output_dir"') : lines.indexOf('"$root/scripts/staging-doctor.sh"');
    assert(sideEffect > lines.indexOf(shadow), `${key} verifies only after side effects`);
    assert(sideEffect > lines.indexOf(technical), `${key} verifies only after side effects`);
  }
}
validate(source);
for (const mutate of [
  value => { value.scripts.check = value.scripts.check.replace('npm run check:block-quality-evidence', 'true'); },
  value => { value.scripts['test:unit'] = 'vitest run'; },
  value => { value.scripts['pretest:e2e:product'] = 'true'; },
  value => { value.release = value.release.replace('npm run check:block-quality-evidence)', 'true)'); },
  value => { value.deploy = value.deploy.replace('npm run check:block-quality-evidence)', 'true)'); },
  value => { value.release = value.release.replace('--technical --verify-render-source', '--candidate'); },
  value => { value.deploy = value.deploy.replace('--technical --verify-render-source', '--technical'); },
  value => { value.scripts.check = value.scripts.check.replace('--technical --verify-render-source', '--technical'); },
  value => { value.scripts['test:unit'] = value.scripts['test:unit'].replace('--technical', '--candidate'); },
  value => { value.scripts['pretest:e2e:product'] = value.scripts['pretest:e2e:product'].replace('--technical', '--technical || true'); },
  value => { value.scripts.check = value.scripts.check.replace('npm run build && ', '') + ' && npm run build'; },
  value => { value.scripts.check = value.scripts.check.replace('npm run build && ', ''); },
]) {
  const broken = structuredClone(source); mutate(broken);
  assert.throws(() => validate(broken));
}
console.log('BLOCK_QUALITY_GATE_WIRING OK: automated technical + evidence integrity gates; manual approval cannot block release; 12 mutations rejected; no deployment executed');
JS
