import policy from '../../../../schemas/design-policy-v3.json';
import { jsonBytes, record, reject } from './schema';

export interface MigrationSnapshot { source_json: string; source_revision: number; source_schema: string; target_schema: 'g7-page-builder/v3'; publish: false }
/** Explicit preparation only: no mapping, persistence, publishing, or in-place conversion. */
export function prepareMigration(sourceJson: string, sourceRevision: number, expectedRevision: number, explicitChoice: boolean): MigrationSnapshot {
  if (!explicitChoice) reject('explicit_choice', '$');
  if (!Number.isSafeInteger(sourceRevision) || sourceRevision < 1 || sourceRevision !== expectedRevision) reject('source_revision', '$');
  if (new TextEncoder().encode(sourceJson).length > policy.migration.source_max_bytes) reject('byte_limit', '$');
  let source: unknown;
  try { source = JSON.parse(sourceJson); } catch { return reject('json', '$'); }
  jsonBytes(source, policy.limits.json_depth);
  if (!record(source) || typeof source.schema_version !== 'string' || !policy.migration.source_schemas.includes(source.schema_version)) reject('source_schema', '$');
  return { source_json: sourceJson, source_revision: sourceRevision, source_schema: source.schema_version, target_schema: 'g7-page-builder/v3', publish: false };
}
