import envelope from '../../../../schemas/site-part-v2.schema.json';
import documentSchema from '../../../../schemas/page-builder-document-v3.schema.json';
import { jsonBytes, reject, validateRule } from './schema';
import { designPolicyV3, validateDocumentV3 } from './validate';
import type { DocumentV3 } from './types';

/** Only ownership differs from a page. Elements, assets, commands and history do not. */
export interface ElementSitePart {
  schema_version: 'g7-page-builder/site-part/v2';
  kind: 'header' | 'footer';
  content: DocumentV3;
}

// Resolve this one checked-in reference locally; never fetch a user-provided schema.
const rule = { ...envelope, properties: { ...envelope.properties, content: documentSchema } };

export function validateElementSitePart(value: unknown): ElementSitePart {
  if (envelope.properties.content.$ref !== documentSchema.$id) reject('schema', '$.content');
  if (jsonBytes(value, designPolicyV3.limits.json_depth + 1) > designPolicyV3.limits.utf8_bytes) reject('byte_limit', '$');
  validateRule(value, rule, documentSchema.$defs);
  const part = value as ElementSitePart;
  const content = validateDocumentV3(part.content);
  if (content.shell_mode !== 'none') reject('site_part_shell', '$.content.shell_mode');
  if (Object.hasOwn(content, 'seo')) reject('site_part_seo', '$.content.seo');
  return part;
}

/** Reattach an edited canonical tree without changing its owning Site Part. */
export function withSitePartContent(source: ElementSitePart, value: unknown): ElementSitePart {
  const current = validateElementSitePart(source);
  const content = validateDocumentV3(value);
  if (content.document_id !== current.content.document_id || content.locale !== current.content.locale
    || content.slug !== current.content.slug) reject('site_part_identity', '$.content');
  return validateElementSitePart({ ...current, content: structuredClone(content) });
}
