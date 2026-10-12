import { BUILTIN_BLOCK_DEFINITIONS, BUILTIN_BLOCK_PRESETS } from '../builtinCatalog';
import type { PageBuilderBlock } from '../../documents/types';
import { record } from '../../documents/v3/schema';
import { compositionContracts, sitePartContracts, structuralContracts, type CompositionContract, type TemplateScope } from './catalogEntries';

const contracts = new Map([...compositionContracts, ...structuralContracts, ...sitePartContracts].map(row => [row.blockId, row]));
export function compositionContract(type: string, version: number): CompositionContract | undefined {
  const row = contracts.get(type);
  return row?.version === version ? row : undefined;
}
export interface CatalogCoverage {
  missingBlocks: string[];
  orphanMappings: string[];
  invalidPresets: string[];
  runtimeMismatches: string[];
}
/** Independent of converter/UI status: a complete map does not mean editable. */
export function compositionCoverage(): CatalogCoverage {
  const definitions = new Map(BUILTIN_BLOCK_DEFINITIONS.map(row => [row.block_id, row]));
  return {
    missingBlocks: BUILTIN_BLOCK_DEFINITIONS.filter(row => !compositionContract(row.block_id, row.block_version)).map(row => row.block_id),
    orphanMappings: compositionContracts.filter(row => !definitions.has(row.blockId)).map(row => row.blockId),
    invalidPresets: BUILTIN_BLOCK_PRESETS.filter(preset => {
      const row = compositionContract(preset.block_id, preset.block_version);
      return !row || !definitions.has(preset.block_id) || Object.keys(preset.props).some(key => !Object.hasOwn(row.fields, key));
    }).map(row => row.preset_id),
    runtimeMismatches: BUILTIN_BLOCK_DEFINITIONS.filter(definition => {
      const expected = definition.capabilities.filter(capability => capability !== 'editor.compatibility-only').slice().sort();
      const declared = [...(compositionContract(definition.block_id, definition.block_version)?.runtime ?? [])].sort();
      return JSON.stringify(expected) !== JSON.stringify(declared);
    }).map(row => row.block_id),
  };
}
export interface CompositionDiagnostic { path: string; code: 'unknown_block' | 'unknown_field' | 'unknown_slot' | 'source_shape' | 'source_scope' | 'source_limit' }
/** Mapping preflight only. Call existing source validation BEFORE converting values.
 * Never normalizes, discards fields, reads remote data, or mutates a source document.
 */
export function inspectCompositionSource(blocks: readonly PageBuilderBlock[], scope: 'page' | 'header' | 'footer'): CompositionDiagnostic[] {
  const diagnostics: CompositionDiagnostic[] = [];
  const seen = new Set<object>();
  let count = 0;
  const visit = (value: unknown, path: string, expectedScope: TemplateScope, depth: number): void => {
    if (!record(value)) { diagnostics.push({ path, code: 'source_shape' }); return; }
    if (seen.has(value) || depth > 16 || ++count > 500) { diagnostics.push({ path, code: 'source_limit' }); return; }
    seen.add(value);
    const row = typeof value.type === 'string' && typeof value.block_version === 'number'
      ? compositionContract(value.type, value.block_version) : undefined;
    if (!row) { diagnostics.push({ path, code: 'unknown_block' }); return; }
    if (row.scope !== expectedScope) diagnostics.push({ path, code: 'source_scope' });
    for (const key of Object.keys(value)) {
      if (!['instance_id', 'type', 'block_version', 'props', 'slots', 'motion', 'visibility', 'responsive'].includes(key)) diagnostics.push({ path: `${path}.${key}`, code: 'unknown_field' });
    }
    if (!record(value.props)) diagnostics.push({ path: `${path}.props`, code: 'source_shape' });
    else for (const key of Object.keys(value.props)) {
      if (!Object.hasOwn(row.fields, key)) diagnostics.push({ path: `${path}.props.${key}`, code: 'unknown_field' });
    }
    if (value.slots !== undefined) {
      if (!record(value.slots)) diagnostics.push({ path: `${path}.slots`, code: 'source_shape' });
      else for (const [slot, children] of Object.entries(value.slots)) {
        const slotPath = `${path}.slots.${slot}`;
        if (!row.slots.includes(slot)) diagnostics.push({ path: slotPath, code: 'unknown_slot' });
        else if (!Array.isArray(children)) diagnostics.push({ path: slotPath, code: 'source_shape' });
        else for (let index = 0; index < children.length; index++) {
          visit(children[index], `${slotPath}.${index}`, slot === 'systemControls' ? 'header-control' : expectedScope, depth + 1);
          if (count > 500) break;
        }
      }
    }
    seen.delete(value);
  };
  for (let index = 0; index < blocks.length; index++) {
    visit(blocks[index], `blocks.${index}`, scope, 1);
    if (count > 500) break;
  }
  return diagnostics;
}
