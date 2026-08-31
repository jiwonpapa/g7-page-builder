import { describe, expect, it } from 'vitest';
import legacyQuality from '../../resources/block-packs/builtin-core/product-quality.json';
import {
  assessQualityEvidence,
  createPendingEvidence,
  fingerprintEvidence,
  refreshQualityEvidence,
  type EvidenceInputs,
  type QualityEvidence,
} from '../../scripts/lib/blockQualityEvidence';

const ID = 'preset:jiwonpapa/builtin-core:cta.contact';
const artifact = { path: 'output/evidence/cta.json', sha256: 'a'.repeat(64) };
const artifacts = { [artifact.path]: artifact.sha256 };
const inputs: EvidenceInputs = {
  content: { purpose: '문의 안내', props: { heading: '제품 도입을 상담하세요', body: '담당자가 안내합니다.' } },
  rights: { assets: [{ path: 'service.webp', sha256: 'b'.repeat(64), provenance: 'owned-example' }] },
  render: { compiler: 'v1', css: 'c'.repeat(64), thumbnail: 'd'.repeat(64) },
  editing: { adapter: 'e'.repeat(64), fixture: 'empty-and-long-copy' },
};
const current = () => [fingerprintEvidence(ID, inputs)];
const pending = () => createPendingEvidence(current(), {
  source_path: 'resources/block-packs/builtin-core/product-quality.json', record: legacyQuality.approval,
});

describe('evidence refresh without automatic approval', () => {
  it('preserves unchanged decisions and exact provenance without mutating the old record', () => {
    const before = reviewed();
    const refreshed = refreshQualityEvidence(before, current(), artifacts);
    expect(refreshed).toEqual(before);
    expect(refreshed).not.toBe(before);
    refreshed.items[0]!.reviews.content = { status: 'pending' };
    expect(before.items[0]!.reviews.content.status).toBe('approved');
  });

  it.each([
    ['render', ['render', 'editing']],
    ['content', ['content', 'render', 'editing']],
    ['rights', ['content', 'rights', 'render', 'editing']],
    ['editing', ['editing']],
  ] as const)('resets only affected decisions for %s source changes', (scope, reset) => {
    const changed = structuredClone(inputs); changed[scope].newDependency = 'changed';
    const after = [fingerprintEvidence(ID, changed)];
    const before = reviewed();
    const refreshed = refreshQualityEvidence(before, after, artifacts);
    expect(refreshed.legacy_review).toEqual(before.legacy_review);
    const decisions = { ...refreshed.items[0]!.reviews, ...refreshed.items[0]!.verifications };
    for (const [name, decision] of Object.entries(decisions)) {
      expect(decision.status === 'pending').toBe((reset as readonly string[]).includes(name));
    }
    expect(assessQualityEvidence(refreshed, after, artifacts).errors).toEqual([]);
    expect(assessQualityEvidence(refreshed, after, artifacts).ready).toBe(false);
  });

  it('starts new catalog identities pending and omits removed identities only in the returned proposal', () => {
    const before = reviewed();
    const replacement = [fingerprintEvidence('block:new@1', inputs)];
    const result = refreshQualityEvidence(before, replacement, artifacts);
    expect(result.items.map(item => item.catalog_id)).toEqual(['block:new@1']);
    expect(assessQualityEvidence(result, replacement, artifacts).pending).toHaveLength(4);
    expect(before.items[0]!.catalog_id).toBe(ID);
  });

  it('does not erase rejected/failed decisions for unchanged sources', () => {
    const before = reviewed();
    Object.assign(before.items[0]!.reviews.content, { status: 'rejected', findings: ['잘못된 주장'] });
    Object.assign(before.items[0]!.verifications.render, { status: 'failed', findings: ['가로 넘침'] });
    const result = refreshQualityEvidence(before, current(), artifacts);
    expect(result).toEqual(before);
    expect(assessQualityEvidence(result, current(), artifacts).ready).toBe(false);
  });

  it('refuses refresh as a shortcut for deleted/changed evidence or corrupt provenance', () => {
    expect(() => refreshQualityEvidence(reviewed(), current(), {})).toThrow('missing-artifact');
    expect(() => refreshQualityEvidence(reviewed(), current(), { [artifact.path]: 'b'.repeat(64) })).toThrow('changed-artifact');
    const corrupt = reviewed(); corrupt.legacy_review.record.decision = 'changed';
    expect(() => refreshQualityEvidence(corrupt, current(), artifacts)).toThrow('legacy-review-integrity');
    const staleDecision = reviewed();
    Object.assign(staleDecision.items[0]!.reviews.content, { source_digest: 'b'.repeat(64) });
    expect(() => refreshQualityEvidence(staleDecision, current(), artifacts)).toThrow('stale-review');
  });

  it('rejects invalid schemas and empty, duplicate or malformed current inventory', () => {
    expect(() => refreshQualityEvidence({}, current(), artifacts)).toThrow('schema');
    expect(() => refreshQualityEvidence(reviewed(), [], artifacts)).toThrow('current');
    expect(() => refreshQualityEvidence(reviewed(), [...current(), ...current()], artifacts)).toThrow('current');
    const malformed = current(); malformed[0]!.source_digests.render = 'bad';
    expect(() => refreshQualityEvidence(reviewed(), malformed, artifacts)).toThrow('current');
    const duplicate = reviewed(); duplicate.items.push(duplicate.items[0]!);
    expect(() => refreshQualityEvidence(duplicate, current(), artifacts)).toThrow('duplicate');
  });
});

// Test-only review fixture; production migration must never manufacture approval.
function reviewed(): QualityEvidence {
  const snapshot = pending();
  const item = snapshot.items[0]!;
  for (const scope of ['content', 'rights'] as const) {
    item.reviews[scope] = { status: 'approved', source_digest: item.source_digests[scope],
      reviewer: { kind: 'maintainer', name: 'Test reviewer' }, reviewed_at: '2026-08-31T00:00:00Z',
      findings: [], evidence: [artifact] };
  }
  for (const scope of ['render', 'editing'] as const) {
    item.verifications[scope] = { status: 'passed', source_digest: item.source_digests[scope],
      tool: 'fixture-browser', checked_at: '2026-08-31T00:00:00Z', findings: [], evidence: [artifact] };
  }
  return snapshot;
}

describe('separated block quality evidence v2', () => {
  it('preserves the exact legacy review without upgrading any v2 decision', () => {
    const snapshot = pending();
    expect(snapshot.legacy_review.record).toEqual(legacyQuality.approval);
    const result = assessQualityEvidence(snapshot, current(), artifacts);
    expect(result.errors).toEqual([]);
    expect(result.pending).toEqual(['content', 'rights', 'render', 'editing'].map(scope => `${ID}:${scope}`));
    expect(result.ready).toBe(false);
    snapshot.legacy_review.record.decision = 'rejected';
    expect(legacyQuality.approval.decision).toBe('approved');
    expect(assessQualityEvidence(snapshot, current(), artifacts).errors.join('\n')).toContain('legacy-review-integrity');
  });

  it('accepts current independent reviews and real evidence digests', () => {
    expect(assessQualityEvidence(reviewed(), current(), artifacts)).toEqual({ errors: [], pending: [], ready: true });
  });

  it('keeps semantic/rights reviews reusable for CSS-only changes but invalidates visual evidence', () => {
    const changed = structuredClone(inputs);
    changed.render.css = 'new-css';
    const before = current()[0]!;
    const after = fingerprintEvidence(ID, changed);
    expect(after.source_digests.content).toBe(before.source_digests.content);
    expect(after.source_digests.rights).toBe(before.source_digests.rights);
    expect(after.source_digests.render).not.toBe(before.source_digests.render);
    expect(after.source_digests.editing).not.toBe(before.source_digests.editing);
    const result = assessQualityEvidence(reviewed(), [after], artifacts);
    expect(result.ready).toBe(false);
    expect(result.errors.some(error => error.endsWith(':content'))).toBe(false);
    expect(result.errors.some(error => error.endsWith(':rights'))).toBe(false);
    expect(result.errors.join('\n')).toContain(`stale-verification:${ID}:render`);
  });

  it.each(['content', 'rights', 'render', 'editing'] as const)('detects changed or previously unknown %s dependencies', scope => {
    const changed = structuredClone(inputs);
    changed[scope].previouslyUnknownDependency = 'changed';
    const result = assessQualityEvidence(reviewed(), [fingerprintEvidence(ID, changed)], artifacts);
    expect(result.ready).toBe(false);
    expect(result.errors.join('\n')).toContain(`stale-source:${ID}:${scope}`);
  });

  it('treats changed asset bytes/provenance as rights and content changes', () => {
    const changed = structuredClone(inputs);
    changed.rights.assets = [{ path: 'service.webp', sha256: 'f'.repeat(64), provenance: 'replaced' }];
    const before = current()[0]!.source_digests;
    const after = fingerprintEvidence(ID, changed).source_digests;
    expect(after.rights).not.toBe(before.rights);
    expect(after.content).not.toBe(before.content);
    expect(after.render).not.toBe(before.render);
  });

  it('canonicalizes object keys but preserves ordered content', () => {
    const reordered = { ...inputs, content: { props: inputs.content.props!, purpose: inputs.content.purpose! } };
    expect(fingerprintEvidence(ID, reordered)).toEqual(current()[0]);
    const first = fingerprintEvidence(ID, { ...inputs, content: { items: ['one', 'two'] } });
    const second = fingerprintEvidence(ID, { ...inputs, content: { items: ['two', 'one'] } });
    expect(first.source_digests.content).not.toBe(second.source_digests.content);
  });

  it('rejects deleted or changed evidence artifacts', () => {
    expect(assessQualityEvidence(reviewed(), current(), {}).errors.join('\n')).toContain('missing-artifact');
    expect(assessQualityEvidence(reviewed(), current(), { [artifact.path]: 'f'.repeat(64) }).errors.join('\n')).toContain('changed-artifact');
  });

  it('rejects a stale individual review even when current inventory digests are copied over', () => {
    const snapshot = reviewed();
    const review = snapshot.items[0]!.reviews.content;
    if (review.status === 'pending') throw new Error('Expected test review');
    review.source_digest = 'f'.repeat(64);
    expect(assessQualityEvidence(snapshot, current(), artifacts).errors.join('\n')).toContain('stale-review');
  });

  it('rejects duplicate, missing and unexpected inventory rather than relying on counts', () => {
    const snapshot = reviewed();
    snapshot.items.push(structuredClone(snapshot.items[0]!));
    expect(assessQualityEvidence(snapshot, current(), artifacts).errors.join('\n')).toContain('duplicate-item');
    expect(assessQualityEvidence(reviewed(), [...current(), ...current()], artifacts).errors.join('\n')).toContain('duplicate-current-item');
    expect(assessQualityEvidence(reviewed(), [fingerprintEvidence('block:new@1', inputs)], artifacts).errors.join('\n')).toContain('inventory-mismatch');
  });

  it('retains failed/rejected decisions and unresolved findings as blockers', () => {
    const snapshot = reviewed();
    const review = snapshot.items[0]!.reviews.rights;
    const verification = snapshot.items[0]!.verifications.render;
    if (review.status === 'pending' || verification.status === 'pending') throw new Error('Expected test evidence');
    review.status = 'rejected'; review.findings = ['출처 미확인'];
    verification.status = 'failed'; verification.findings = ['모바일 넘침'];
    const result = assessQualityEvidence(snapshot, current(), artifacts);
    expect(result.ready).toBe(false);
    expect(result.errors.join('\n')).toContain('rejected-review');
    expect(result.errors.join('\n')).toContain('failed-verification');
  });

  it.each([
    (snapshot: QualityEvidence) => { snapshot.schema_version = 'unsupported' as QualityEvidence['schema_version']; },
    (snapshot: QualityEvidence) => { Object.assign(snapshot.items[0]!.reviews.content, { findings: ['unresolved'] }); },
    (snapshot: QualityEvidence) => { Object.assign(snapshot.items[0]!.reviews.content, { reviewer: { kind: 'codex-assisted', name: 'not human approval' } }); },
    (snapshot: QualityEvidence) => { Object.assign(snapshot.items[0]!.reviews.content, { reviewed_at: 'invalid' }); },
    (snapshot: QualityEvidence) => { Object.assign(snapshot.items[0]!.reviews.content, { evidence: [{ ...artifact, path: '../escape.json' }] }); },
    (snapshot: QualityEvidence) => { Object.assign(snapshot.items[0]!.verifications.render, { evidence: [] }); },
  ])('fails closed on invalid evidence schema %#', mutate => {
    const snapshot = reviewed(); mutate(snapshot);
    const result = assessQualityEvidence(snapshot, current(), artifacts);
    expect(result.ready).toBe(false);
    expect(result.errors.join('\n')).toContain('schema:');
  });

  it('requires nonempty explicit dependency sets and valid JSON values', () => {
    expect(fingerprintEvidence(ID, { ...inputs, content: { disabled: false, optional: null, count: 2 } }).source_digests.content).toMatch(/^[a-f0-9]{64}$/);
    expect(() => fingerprintEvidence(ID, { ...inputs, content: {} })).toThrow('nonempty');
    expect(() => fingerprintEvidence(ID, { ...inputs, content: null } as unknown as EvidenceInputs)).toThrow('nonempty');
    expect(() => fingerprintEvidence(ID, { ...inputs, content: [] } as unknown as EvidenceInputs)).toThrow('nonempty');
    expect(() => fingerprintEvidence(ID, { ...inputs, content: { invalid: Number.NaN } })).toThrow('finite');
    expect(() => fingerprintEvidence(ID, { ...inputs, content: { invalid: undefined } } as unknown as EvidenceInputs)).toThrow('JSON');
    expect(() => fingerprintEvidence(ID, { ...inputs, content: { invalid: new Date() } } as unknown as EvidenceInputs)).toThrow('JSON');
    expect(() => fingerprintEvidence('', inputs)).toThrow('catalog');
  });

  it('does not trust malformed current digests or an empty inventory', () => {
    const malformed = current();
    malformed[0]!.source_digests.render = 'not-a-digest';
    expect(assessQualityEvidence(reviewed(), malformed, artifacts).errors.join('\n')).toContain('invalid-current-digest');
    expect(assessQualityEvidence(createPendingEvidence([], pending().legacy_review), [], artifacts).ready).toBe(false);
  });
});
