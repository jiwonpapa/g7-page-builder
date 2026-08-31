#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkQualityEvidence, collectCurrentEvidence, proposeQualityEvidenceRefresh } from './scripts/check-block-quality-evidence.mjs';

const root = process.cwd();
const collected = collectCurrentEvidence(root);
const report = checkQualityEvidence(root, collected);
assert.equal(report.shadow_valid, true, JSON.stringify(report.errors));
assert.equal(report.counts.items, report.counts.definitions + report.counts.presets);
assert.equal(report.impact.changed.length, 0);

const directory = mkdtempSync(join(tmpdir(), 'g7pb-evidence-contract-'));
const ledgerPath = join(directory, 'resources/block-packs/builtin-core/quality-evidence.json');
const evidencePath = join(directory, 'proof/review.txt');
const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
const check = candidate => { write(ledgerPath, JSON.stringify(candidate)); return checkQualityEvidence(directory, collected); };
try {
  assert.equal(check(collected.snapshot).shadow_valid, true);
  assert.equal(check(collected.snapshot).ready, false, 'A pending shadow ledger is not product approval.');
  assert.equal(check(collected.snapshot).pending_count, collected.current.length * 4);
  assert.deepEqual(proposeQualityEvidenceRefresh(directory, collected), collected.snapshot);
  const reviewed = structuredClone(collected.snapshot);
  write(evidencePath, 'contract fixture only; not product review');
  const proof = { path: 'proof/review.txt', sha256: createHash('sha256').update(readFileSync(evidencePath)).digest('hex') };
  reviewed.items[0].reviews.content = {
    status: 'approved', source_digest: reviewed.items[0].source_digests.content,
    reviewer: { kind: 'maintainer', name: 'contract-test-fixture' }, reviewed_at: '2026-08-31T00:00:00Z',
    findings: [], evidence: [proof],
  };
  assert.equal(check(reviewed).shadow_valid, true);
  assert.deepEqual(proposeQualityEvidenceRefresh(directory, collected), reviewed);
  write(evidencePath, 'changed bytes');
  assert(check(reviewed).errors.some(error => error.startsWith('changed-artifact:')));
  assert.throws(() => proposeQualityEvidenceRefresh(directory, collected), /changed-artifact/);
  rmSync(evidencePath);
  assert(check(reviewed).errors.some(error => error.startsWith('missing-artifact:')));
  assert.throws(() => proposeQualityEvidenceRefresh(directory, collected), /unreadable/);
  reviewed.items[0].reviews.content.evidence[0].path = '../escape';
  assert(check(reviewed).errors.some(error => error.startsWith('schema:')));
  const stale = structuredClone(collected.snapshot);
  stale.items[0].source_digests.content = '0'.repeat(64);
  assert.equal(check(stale).changed_by_scope.content, 1);
  assert(check(stale).errors.some(error => error.startsWith('stale-source:')));
  const missing = structuredClone(collected.snapshot);
  missing.items.pop();
  assert(check(missing).errors.includes('inventory-mismatch'));
  const legacy = structuredClone(collected.snapshot);
  legacy.legacy_review.record.reviewed_at = '2000-01-01T00:00:00Z';
  assert(check(legacy).errors.includes('legacy-review-integrity'));
  assert.throws(() => proposeQualityEvidenceRefresh(directory, collected), /legacy-review-integrity/);
} finally {
  // Exact unique test directory only; no repository fixtures or evidence are removed.
  rmSync(directory, { recursive: true, force: true });
}
const pending = spawnSync(process.execPath, ['scripts/check-block-quality-evidence.mjs', '--require-ready', '--json'], { cwd: root, encoding: 'utf8' });
assert.equal(pending.status, report.ready ? 0 : 1);
assert.equal(JSON.parse(pending.stdout).ready, report.ready);
const refreshed = spawnSync(process.execPath, ['scripts/check-block-quality-evidence.mjs', '--refresh'], { cwd: root, encoding: 'utf8' });
assert.equal(refreshed.status, 0, refreshed.stderr);
assert.deepEqual(JSON.parse(refreshed.stdout), JSON.parse(readFileSync('resources/block-packs/builtin-core/quality-evidence.json', 'utf8')));
const invalid = spawnSync(process.execPath, ['scripts/check-block-quality-evidence.mjs', '--approve'], { cwd: root, encoding: 'utf8' });
assert.equal(invalid.status, 1);
console.log(`BLOCK_QUALITY_EVIDENCE_CONTRACT OK: ${report.counts.items} actual items; pending=${report.pending_count}; ready=${report.ready}`);
JS
