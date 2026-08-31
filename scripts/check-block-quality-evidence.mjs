import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { assessQualityEvidence, createPendingEvidence, fingerprintEvidence } from './lib/blockQualityEvidence.ts';
import { collectBlockQualityInventory, compareEvidenceFingerprints } from './lib/blockQualityInventory.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = 'resources/block-packs/builtin-core';
const LEDGER = `${PACK}/quality-evidence.json`;
const LEGACY = `${PACK}/product-quality.json`;
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Always collect current PHP output; a saved fixture index is not current evidence. */
export function collectCurrentEvidence(root = ROOT) {
  const started = performance.now();
  const output = mkdtempSync(join(tmpdir(), 'g7pb-quality-evidence-'));
  let facts;
  try {
    const rendered = spawnSync('php', [join(root, 'scripts/render-block-thumbnail-fixtures.php'), output], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000,
    });
    if (rendered.status !== 0) throw new Error(`Current PHP renderer failed: ${rendered.error?.message ?? ''}\n${rendered.stdout}${rendered.stderr}`);
    facts = json(join(output, 'index.json'));
  } finally {
    // Only this invocation's uniquely created fixture directory is removed.
    rmSync(output, { recursive: true, force: true });
  }
  const renderMs = performance.now() - started;
  const inventory = collectBlockQualityInventory(root, facts);
  const current = inventory.items.map(item => fingerprintEvidence(item.catalog_id, item.inputs));
  const legacyRecord = json(join(root, LEGACY)).approval;
  const snapshot = createPendingEvidence(current, { source_path: LEGACY, record: legacyRecord });
  const legacySources = json(join(root, `${PACK}/thumbnails/generated/index.json`)).sources;
  const legacySourceChanges = facts.filter(item => legacySources[item.catalog_id] !== item.source_hash).map(item => item.catalog_id);
  return { inventory, current, snapshot, legacySourceChanges, renderMs, started };
}

export function checkQualityEvidence(root = ROOT, collected = collectCurrentEvidence(root)) {
  const { inventory, current, snapshot } = collected;
  const candidate = json(join(root, LEDGER));
  let assessment = assessQualityEvidence(candidate, current, {});
  const artifacts = {};
  const artifactErrors = [];
  const schemaValid = !assessment.errors.some(error => error.startsWith('schema:'));
  const actualRoot = realpathSync(root);
  if (schemaValid) {
    for (const item of candidate.items) {
      for (const decision of [...Object.values(item.reviews), ...Object.values(item.verifications)]) {
        for (const artifact of decision.evidence ?? []) {
          try {
            if (artifact.path.startsWith('/') || artifact.path.includes('\\') || artifact.path.split('/').some(part => part === '.' || part === '..')) throw new Error('unsafe path');
            const path = realpathSync(join(actualRoot, artifact.path));
            if (!path.startsWith(actualRoot + sep) || !lstatSync(path).isFile()) throw new Error('not a repository file');
            artifacts[artifact.path] = sha256(readFileSync(path));
          } catch {
            artifactErrors.push(`unreadable-artifact:${artifact.path}`);
          }
        }
      }
    }
    assessment = assessQualityEvidence(candidate, current, artifacts);
    if (candidate.legacy_review.source_path !== LEGACY || candidate.legacy_review.record_digest !== snapshot.legacy_review.record_digest) {
      artifactErrors.push('legacy-review-does-not-match-preserved-v1-record');
    }
  }
  const comparable = schemaValid && !assessment.errors.includes('duplicate-item');
  const impact = comparable ? compareEvidenceFingerprints(candidate.items, current) : null;
  const errors = [...assessment.errors, ...artifactErrors];
  const changedByScope = Object.fromEntries(['content', 'rights', 'render', 'editing'].map(scope => [scope, impact?.changed.filter(item => item.scopes.includes(scope)).length ?? null]));
  return {
    mode: 'shadow', schema_version: snapshot.schema_version, counts: inventory.counts,
    legacy_source_changes: collected.legacySourceChanges,
    impact, changed_by_scope: changedByScope, warnings: inventory.warnings,
    errors, pending_count: assessment.pending.length, ready: assessment.ready && errors.length === 0 && inventory.warnings.length === 0,
    shadow_valid: errors.length === 0,
    timings_ms: { renderer: Math.round(collected.renderMs), collector: inventory.elapsed_ms, total: Math.round(performance.now() - collected.started) },
  };
}

function main(args) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Quality evidence CLI requires Node 24.');
  if (args.some(arg => !['--json', '--snapshot', '--require-ready'].includes(arg))
    || (args.includes('--snapshot') && args.length !== 1)) throw new Error('Usage: node scripts/check-block-quality-evidence.mjs [--json] [--require-ready] | --snapshot');
  const collected = collectCurrentEvidence();
  if (args.includes('--snapshot')) {
    // Emits a proposal only: never writes a ledger, approval or successful verification.
    process.stdout.write(`${JSON.stringify(collected.snapshot, null, 2)}\n`);
    return;
  }
  const report = checkQualityEvidence(ROOT, collected);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(`BLOCK_QUALITY_EVIDENCE ${report.shadow_valid ? 'SHADOW_OK' : 'FAIL'}: ${report.counts.items} items; ${report.pending_count} pending; ready=${report.ready}\n`);
    process.stdout.write(`Changed scopes: ${JSON.stringify(report.changed_by_scope)}; ${report.timings_ms.total}ms\n`);
    for (const warning of report.warnings) process.stdout.write(`WARNING ${warning}\n`);
    for (const error of report.errors) process.stderr.write(`${error}\n`);
  }
  if (!report.shadow_valid || (args.includes('--require-ready') && !report.ready)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`BLOCK_QUALITY_EVIDENCE FAIL: ${error.message}\n`); process.exitCode = 1; }
}
