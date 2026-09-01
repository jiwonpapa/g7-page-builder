import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../resources/block-packs/builtin-core/manifest.json';
import inventory from '../../docs/productization/inventory.json';
import ledger from '../../docs/productization/phase-7-ledger.json';

type Check = 'no-root-links' | 'no-instruction-copy' | 'media-present' | 'sample-claims';
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
interface LedgerItem {
  id: string;
  decision: 'maintained' | 'modified' | 'consolidate-candidate' | 'blocked';
  reason: string;
  checks: Check[];
  human_status: 'pending';
  release_status: 'blocked';
}
interface PageKitLedgerItem extends LedgerItem {
  source: string;
}
interface Ledger {
  record_version: 'g7pb-phase-7-ledger/1';
  release_status: 'blocked';
  page_kits: PageKitLedgerItem[];
  batches: Array<{ id: string; items: LedgerItem[] }>;
}
const qualityLedger = ledger as Ledger;
const presets = new Map(manifest.presets.map((preset) => [preset.preset_id, preset]));
const forbiddenCopy = /알려\s*주세요|설명해\s*주세요|첫 번째 핵심 메시지|고객의 다음 행동을 더 분명하게|제품의 핵심 가치를 한 장면에/;

function values(value: Json, keyPattern: RegExp, key = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => values(item, keyPattern, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => values(child, keyPattern, childKey));
  }
  return typeof value === 'string' && keyPattern.test(key) ? [value] : [];
}

describe('phase 7 bounded preset quality ledger', () => {
  it('limits each batch to eight unique catalog presets and keeps release blocked', () => {
    expect(qualityLedger.record_version).toBe('g7pb-phase-7-ledger/1');
    expect(qualityLedger.release_status).toBe('blocked');
    const batchIds = qualityLedger.batches.map((batch) => batch.id);
    expect(new Set(batchIds).size).toBe(batchIds.length);
    const itemIds = qualityLedger.batches.flatMap((batch) => {
      expect(batch.items.length, batch.id).toBeGreaterThan(0);
      expect(batch.items.length, batch.id).toBeLessThanOrEqual(8);
      return batch.items.map((item) => item.id);
    });
    expect(new Set(itemIds).size).toBe(itemIds.length);
    for (const id of itemIds) expect(presets.has(id), id).toBe(true);
    expect(itemIds.toSorted()).toEqual(inventory.presets
      .filter((item) => item.batch.startsWith('7-'))
      .map((item) => item.id)
      .toSorted());
  });

  it('applies each processed item check without fabricating human or release approval', () => {
    for (const batch of qualityLedger.batches) {
      for (const item of batch.items) {
        expect(['maintained', 'modified', 'consolidate-candidate', 'blocked']).toContain(item.decision);
        expect(item.human_status, item.id).toBe('pending');
        expect(item.release_status, item.id).toBe('blocked');
        expect(item.reason.trim().length, item.id).toBeGreaterThan(0);
        expect(item.checks.length, item.id).toBeGreaterThan(0);
        const props = presets.get(item.id)!.props as Json;
        for (const check of item.checks) {
          if (check === 'no-root-links') expect(values(props, /(?:url|Url)$/), item.id).not.toContain('/');
          if (check === 'no-instruction-copy') expect(JSON.stringify(props), item.id).not.toMatch(forbiddenCopy);
          if (check === 'media-present') {
            const media = values(props, /(?:src|Src)$/);
            expect(media.length, item.id).toBeGreaterThan(0);
            expect(media.every((source) => source.trim().length > 0), item.id).toBe(true);
          }
          if (check === 'sample-claims') expect(JSON.stringify(props), item.id).toMatch(/샘플|예시|가상/);
        }
      }
    }
  });

  it('binds both remaining Page Kits to the same bounded checks and blocks release', () => {
    expect(qualityLedger.page_kits.map((item) => item.id).toSorted())
      .toEqual(['company-launch', 'event-launch']);
    for (const item of qualityLedger.page_kits) {
      expect(item.human_status, item.id).toBe('pending');
      expect(item.release_status, item.id).toBe('blocked');
      expect(item.reason.trim().length, item.id).toBeGreaterThan(0);
      const document = JSON.parse(readFileSync(resolve(item.source), 'utf8')) as Json;
      for (const check of item.checks) {
        if (check === 'no-root-links') expect(values(document, /(?:url|Url)$/), item.id).not.toContain('/');
        if (check === 'media-present') {
          const media = values(document, /(?:src|Src)$/);
          expect(media.length, item.id).toBeGreaterThan(0);
          expect(media.every((source) => source.trim().length > 0), item.id).toBe(true);
        }
        if (check === 'sample-claims') expect(JSON.stringify(document), item.id).toMatch(/샘플|예시|가상/);
      }
    }
  });
});
