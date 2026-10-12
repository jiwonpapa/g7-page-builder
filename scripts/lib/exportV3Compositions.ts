/** Build-time, explicit export of the already implemented starter library.
 * Never imported by a browser entry. Not a converter for user documents.
 * After export, the canonical data is editable without these legacy factories.
 */
import { basicCompositionOptions, createBasicComposition } from '../../resources/js/blocks/v3/basicCompositions';
import { repeatedCompositionOptions, createRepeatedComposition } from '../../resources/js/blocks/v3/repeatedTemplates';
import { staticCompositionOptions, createStaticComposition } from '../../resources/js/blocks/v3/staticTemplates';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import type { DocumentV3 } from '../../resources/js/documents/v3/types';

export function exportStarterCompositions(reference: DocumentV3) {
  const base = structuredClone(validateDocumentV3(reference));
  base.blocks = [];
  let sequence = 0;
  const used = new Set([base.document_id, ...base.assets.map(asset => asset.asset_id)]);
  const nextId = (): string => {
    let id: string;
    do { id = '10000000-0000-4000-8000-' + String(++sequence).padStart(12, '0'); } while (used.has(id));
    used.add(id);
    return id;
  };
  const entries: { key: string; label: string; document: DocumentV3 }[] = [];
  function add(key: string, label: string, source: DocumentV3): void {
    entries.push({ key, label, document: structuredClone(validateDocumentV3({
      ...source, document_id: nextId(), slug: key.replaceAll('.', '-'), shell_mode: 'none',
    })) });
  }
  for (const [key, label] of basicCompositionOptions) {
    add(key, label, { ...base, blocks: [createBasicComposition(key, base, nextId)] });
  }
  for (const { key, label } of repeatedCompositionOptions) {
    add(key, label, createRepeatedComposition(key, base, nextId).source);
  }
  for (const { key, label } of staticCompositionOptions) {
    add(key, label, createStaticComposition(key, base, nextId).source);
  }
  return entries;
}
