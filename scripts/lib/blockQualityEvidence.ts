import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../schemas/block-quality-evidence.schema.json' with { type: 'json' };

export type EvidenceJson = null | boolean | number | string | EvidenceJson[] | { [key: string]: EvidenceJson };
type JsonObject = { [key: string]: EvidenceJson };
type Scope = 'content' | 'rights' | 'render' | 'editing';
export type EvidenceInputs = Record<Scope, JsonObject>;
export interface EvidenceFingerprint {
  catalog_id: string;
  source_digests: Record<Scope, string>;
}
interface Artifact { path: string; sha256: string }
type Pending = { status: 'pending' };
type Review = Pending | {
  status: 'approved' | 'rejected'; source_digest: string;
  reviewer: { kind: 'maintainer'; name: string }; reviewed_at: string;
  findings: string[]; evidence: Artifact[];
};
type Verification = Pending | {
  status: 'passed' | 'failed'; source_digest: string; tool: string; checked_at: string;
  findings: string[]; evidence: Artifact[];
};
export interface QualityEvidence {
  schema_version: 'g7pb-block-quality-evidence/v2';
  legacy_review: { source_path: string; record_digest: string; record: JsonObject };
  items: Array<EvidenceFingerprint & {
    reviews: Record<'content' | 'rights', Review>;
    verifications: Record<'render' | 'editing', Verification>;
  }>;
}

const SCOPES: Scope[] = ['content', 'rights', 'render', 'editing'];
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile<QualityEvidence>(schema);

function canonical(value: EvidenceJson): EvidenceJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Evidence numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('Evidence dependencies must be plain JSON.');
  }
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key]!)]));
}

function digest(value: EvidenceJson): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

/** Sources are supplied by the dependency collector, never inferred from an approval. */
export function fingerprintEvidence(catalogId: string, inputs: EvidenceInputs): EvidenceFingerprint {
  if (!/^(?:block|preset):[^\s]+$/.test(catalogId)) throw new Error('A catalog ID is required.');
  for (const scope of SCOPES) {
    const source = inputs[scope];
    if (!source || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).length === 0) {
      throw new Error(`${scope} requires a nonempty dependency set.`);
    }
  }
  const hash = (scope: Scope, source: EvidenceJson): string => digest({
    version: 'g7pb-block-quality-evidence/v2', catalog_id: catalogId, scope, source,
  });
  const rights = hash('rights', inputs.rights);
  // Asset bytes/provenance can change the meaning of otherwise unchanged copy.
  const content = hash('content', { payload: inputs.content, rights });
  const render = hash('render', { payload: inputs.render, content, rights });
  // Until a narrower dependency map is proven, visual changes also require edit verification.
  const editing = hash('editing', { payload: inputs.editing, content, rights, render });
  return { catalog_id: catalogId, source_digests: { content, rights, render, editing } };
}

/** Migration preserves provenance, but creates no new review or verification decision. */
export function createPendingEvidence(
  items: EvidenceFingerprint[],
  legacy: { source_path: string; record: JsonObject },
): QualityEvidence {
  return {
    schema_version: 'g7pb-block-quality-evidence/v2',
    legacy_review: {
      source_path: legacy.source_path,
      record_digest: digest(legacy.record),
      record: structuredClone(legacy.record),
    },
    items: items.map(item => ({
      catalog_id: item.catalog_id, source_digests: { ...item.source_digests },
      reviews: { content: { status: 'pending' }, rights: { status: 'pending' } },
      verifications: { render: { status: 'pending' }, editing: { status: 'pending' } },
    })),
  };
}

/** Artifact digests must come from actual files. Missing entries are not evidence. */
export function assessQualityEvidence(
  candidate: unknown,
  current: EvidenceFingerprint[],
  artifactDigests: Readonly<Record<string, string>>,
): { errors: string[]; pending: string[]; ready: boolean } {
  const errors: string[] = [];
  const pending: string[] = [];
  if (!validate(candidate)) {
    return { errors: (validate.errors ?? []).map(error => `schema:${error.instancePath}:${error.message}`), pending, ready: false };
  }
  if (candidate.legacy_review.record_digest !== digest(candidate.legacy_review.record)) errors.push('legacy-review-integrity');
  const expected = new Map(current.map(item => [item.catalog_id, item]));
  if (expected.size !== current.length) errors.push('duplicate-current-item');
  const ids = candidate.items.map(item => item.catalog_id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate-item');
  if (JSON.stringify([...expected.keys()].sort()) !== JSON.stringify([...ids].sort())) errors.push('inventory-mismatch');

  const checkArtifacts = (evidence: Artifact[], id: string, scope: Scope): void => {
    for (const artifact of evidence) {
      const actual = artifactDigests[artifact.path];
      if (actual === undefined) errors.push(`missing-artifact:${id}:${scope}:${artifact.path}`);
      else if (actual !== artifact.sha256) errors.push(`changed-artifact:${id}:${scope}:${artifact.path}`);
    }
  };
  for (const item of candidate.items) {
    const source = expected.get(item.catalog_id);
    if (!source) continue;
    for (const scope of SCOPES) {
      const actual = source.source_digests[scope];
      if (!/^[a-f0-9]{64}$/.test(actual)) errors.push(`invalid-current-digest:${item.catalog_id}:${scope}`);
      if (item.source_digests[scope] !== actual) errors.push(`stale-source:${item.catalog_id}:${scope}`);
    }
    for (const scope of ['content', 'rights'] as const) {
      const review = item.reviews[scope];
      if (review.status === 'pending') { pending.push(`${item.catalog_id}:${scope}`); continue; }
      if (review.source_digest !== source.source_digests[scope]) errors.push(`stale-review:${item.catalog_id}:${scope}`);
      if (review.status === 'rejected') errors.push(`rejected-review:${item.catalog_id}:${scope}`);
      checkArtifacts(review.evidence, item.catalog_id, scope);
    }
    for (const scope of ['render', 'editing'] as const) {
      const verification = item.verifications[scope];
      if (verification.status === 'pending') { pending.push(`${item.catalog_id}:${scope}`); continue; }
      if (verification.source_digest !== source.source_digests[scope]) errors.push(`stale-verification:${item.catalog_id}:${scope}`);
      if (verification.status === 'failed') errors.push(`failed-verification:${item.catalog_id}:${scope}`);
      checkArtifacts(verification.evidence, item.catalog_id, scope);
    }
  }
  return { errors, pending, ready: errors.length === 0 && pending.length === 0 };
}
