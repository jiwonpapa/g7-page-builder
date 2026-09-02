import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { assessQualityEvidence, createPendingEvidence, fingerprintEvidence, refreshQualityEvidence } from './lib/blockQualityEvidence.ts';
import { collectBlockQualityInventory, compareEvidenceFingerprints } from './lib/blockQualityInventory.ts';
import { collectBlockQualityStates } from './lib/blockQualityStates.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = 'resources/block-packs/builtin-core';
const LEDGER = `${PACK}/quality-evidence.json`;
const LEGACY = `${PACK}/product-quality.json`;
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Current output is collected only for an explicitly selected set. */
export function collectCurrentEvidence(root = ROOT, selectedIds) {
  if (!Array.isArray(selectedIds) || !selectedIds.length || new Set(selectedIds).size !== selectedIds.length) throw new Error('Current rendering requires explicit nonempty unique IDs.');
  const started = performance.now();
  const output = mkdtempSync(join(tmpdir(), 'g7pb-quality-evidence-'));
  let facts;
  try {
    const rendered = spawnSync('php', [join(root, 'scripts/render-block-thumbnail-fixtures.php'), output, '--ids', selectedIds.join(',')], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000,
    });
    if (rendered.status !== 0) throw new Error(`Current PHP renderer failed: ${rendered.error?.message ?? ''}\n${rendered.stdout}${rendered.stderr}`);
    facts = json(join(output, 'index.json'));
  } finally {
    // Only this invocation's uniquely created fixture directory is removed.
    rmSync(output, { recursive: true, force: true });
  }
  const renderMs = performance.now() - started;
  const allStates = collectBlockQualityStates(root);
  const states = { ...allStates, items: allStates.items.filter(item => selectedIds.includes(item.catalog_id)) };
  const inventory = collectBlockQualityInventory(root, facts, allStates, selectedIds);
  const current = inventory.items.map(item => fingerprintEvidence(item.catalog_id, item.inputs));
  const legacyRecord = json(join(root, LEGACY)).approval;
  const snapshot = createPendingEvidence(current, { source_path: LEGACY, record: legacyRecord });
  const legacySources = json(join(root, `${PACK}/thumbnails/generated/index.json`)).sources;
  const legacySourceChanges = facts.filter(item => legacySources[item.catalog_id] !== item.source_hash).map(item => item.catalog_id);
  return { inventory, current, snapshot, legacySourceChanges, renderMs, started, states, selectedIds };
}

function inspectCandidate(root, collected) {
  const { current, snapshot } = collected;
  const stored = json(join(root, LEDGER));
  const candidate = collected.selectedIds && Array.isArray(stored.items)
    ? { ...stored, items: stored.items.filter(item => collected.selectedIds.includes(item.catalog_id)) } : stored;
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
  return { candidate, assessment, artifacts, artifactErrors, schemaValid };
}

export function proposeQualityEvidenceRefresh(root = ROOT, collected) {
  if (!collected) throw new Error('Refresh requires an explicit collected selection; it is never run automatically.');
  const { candidate, artifacts, artifactErrors } = inspectCandidate(root, collected);
  if (artifactErrors.length) throw new Error(`Cannot refresh unreadable/corrupt evidence: ${artifactErrors.join(', ')}`);
  return refreshQualityEvidence(candidate, collected.current, artifacts);
}

export function checkQualityEvidence(root = ROOT, collected) {
  if (!collected) throw new Error('Current evidence requires an explicit collected selection.');
  const { inventory, current, snapshot } = collected;
  const { candidate, assessment, artifactErrors, schemaValid } = inspectCandidate(root, collected);
  const comparable = schemaValid && !assessment.errors.includes('duplicate-item');
  const impact = comparable ? compareEvidenceFingerprints(candidate.items, current) : null;
  const errors = [...assessment.errors, ...artifactErrors];
  const changedByScope = Object.fromEntries(['content', 'rights', 'render', 'editing'].map(scope => [scope, impact?.changed.filter(item => item.scopes.includes(scope)).length ?? null]));
  return {
    mode: 'shadow', schema_version: snapshot.schema_version, counts: inventory.counts,
    legacy_source_changes: collected.legacySourceChanges,
    state_fixtures: { items: collected.states.items.length,
      required: collected.states.items.reduce((sum, item) => sum + item.bindings.filter(binding => binding.applicable).length, 0),
      not_applicable: collected.states.items.reduce((sum, item) => sum + item.bindings.filter(binding => !binding.applicable).length, 0),
      executed_product_scenarios: 'not-inferred-from-fixture-registration' },
    impact, changed_by_scope: changedByScope, warnings: inventory.warnings,
    errors, pending_count: assessment.pending.length, ready: assessment.ready && errors.length === 0 && inventory.warnings.length === 0,
    shadow_valid: errors.length === 0,
    timings_ms: { renderer: Math.round(collected.renderMs), collector: inventory.elapsed_ms, total: Math.round(performance.now() - collected.started) },
  };
}

export function inspectStoredEvidence(root = ROOT, selectedIds) {
  const stored = json(join(root, LEDGER));
  const items = Array.isArray(stored.items) ? stored.items.filter(item => !selectedIds || selectedIds.includes(item.catalog_id)) : [];
  const snapshot = createPendingEvidence([], { source_path: LEGACY, record: json(join(root, LEGACY)).approval });
  const collected = { current: items, selectedIds, snapshot };
  const { assessment, artifactErrors } = inspectCandidate(root, collected);
  const failures = [...assessment.errors, ...artifactErrors];
  if (selectedIds?.some(id => !items.some(item => item.catalog_id === id))) failures.push('inventory-mismatch');
  return { mode: 'diagnostic', source_policy: 'scoped-inputs/v1', current_sources_checked: false,
    status: failures.length ? 'invalid' : 'stored-integrity-valid', errors: failures,
    pending_count: assessment.pending.length, stored_ready: assessment.ready,
    ready: null, release_authorized: false,
    note: 'Stored v2 decisions are preserved. Their older input policy is not migrated or treated as current product evidence.' };
}

function main(args) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Quality evidence CLI requires Node 24.');
  let selectedIds;
  let technical = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--json') continue;
    if (args[index] === '--technical' && !technical) { technical = true; continue; }
    if (args[index] === '--ids' && selectedIds === undefined) { selectedIds = (args[++index] ?? '').split(','); continue; }
    throw new Error('Usage: check-block-quality-evidence.mjs [--json] [--ids id,id] [--technical]. Generation and ledger refresh are separate explicit operations.');
  }
  const manifest = json(join(ROOT, `${PACK}/manifest.json`));
  const available = [...manifest.blocks.map(item => `block:${item.block_id}@${item.block_version}`), ...manifest.presets.map(item => `preset:${manifest.pack_id}:${item.preset_id}`)];
  if (selectedIds && (!selectedIds.length || new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !available.includes(id)))) throw new Error('Unknown, empty or duplicate evidence target.');
  if (technical && !selectedIds) throw new Error('Technical rendering requires --ids; full collection is never implicit.');
  const diagnostic = inspectStoredEvidence(ROOT, selectedIds);
  let report = diagnostic;
  if (technical) {
    const collected = collectCurrentEvidence(ROOT, selectedIds);
    const current = checkQualityEvidence(ROOT, collected);
    report = { mode: 'technical', ids: selectedIds, status: collected.legacySourceChanges.length ? 'failed' : 'passed',
      current_sources_checked: true, source_policy: 'scoped-inputs/v1',
      technical_errors: collected.legacySourceChanges.map(id => `stale-thumbnail:${id}`),
      diagnostic: { ...diagnostic, impact: current.impact, input_policy_comparison: 'diagnostic-only-not-a-release-gate' },
      release_authorized: false, ledger_written: false, counts: collected.inventory.counts };
    if (report.technical_errors.length) process.exitCode = 1;
  }
  // Integrity errors remain real errors; review pending/policy migration never request regeneration.
  if (diagnostic.errors.length) process.exitCode = 1;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`BLOCK_QUALITY_EVIDENCE FAIL: ${error.message}\n`); process.exitCode = 1; }
}
