import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import inventory from '../../docs/productization/inventory.json';
import quality from '../../docs/productization/phase-6-quality.json';

const presetIds = [
  'hero.service-intro',
  'rich-text.article-intro',
  'image-text.company-story',
  'features.core-benefits',
  'card-grid.services',
  'cta.contact',
];
const pageKitIds = ['service-conversion', 'local-business', 'editorial-community'];
const expectedCriteria = [
  'copy', 'purpose', 'visual-hierarchy', 'imagery', 'content-change',
  'responsive', 'editing-completeness', 'accessibility', 'display-accuracy',
];
const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('phase 6 quality decision', () => {
  it('keeps exactly nine criteria and blocks release while human and final RC gates are pending', () => {
    expect(quality.criteria.map((criterion) => criterion.id)).toEqual(expectedCriteria);
    expect(quality.criteria.every((criterion) => criterion.human_status === 'pending')).toBe(true);
    expect(quality.items.map((item) => item.id).sort()).toEqual([...presetIds, ...pageKitIds].sort());
    expect(quality.items.every((item) => item.technical_status === 'rework-complete'
      && item.human_status === 'pending' && item.release_status === 'blocked')).toBe(true);
    expect(quality.release_status).toBe('blocked');
    expect(quality.blockers).toEqual([
      'human-copy-visual-rights-and-business-facts-approval',
      'phase-8-final-rc',
    ]);
  });

  it('binds preset status and Page Kit decisions to current sources without promoting the planning snapshot', () => {
    for (const id of presetIds) {
      expect(inventory.presets.find((item) => item.id === id)?.review_status, id)
        .toBe('technical-rework-complete-human-review-pending');
    }
    for (const id of pageKitIds) {
      const item = quality.items.find((candidate) => candidate.id === id)!;
      expect(item.kind, id).toBe('page-kit');
      expect(item.sha256, id).toBe(sha256(item.source));
      expect(inventory.page_kits.find((candidate) => candidate.id === id)?.review_status, id)
        .toBe('not-reviewed-under-v2');
    }
  });
});
