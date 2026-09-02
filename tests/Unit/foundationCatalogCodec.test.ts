// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canonicalFoundationBlockToPuck, foundationPuckBlockToCanonical } from '../../resources/js/editor/foundationCatalogCodec';
import { DEFAULT_BLOCK_MOTION } from '../../resources/js/editor/blockMotionData';
import { HEADING_BLOCK_TYPE, IMAGE_TEXT_BLOCK_TYPE } from '../../resources/js/documents/builtinBlockContracts';
import type { PageBuilderBlock } from '../../resources/js/documents/types';

describe('Foundation data conversion without an editor runtime', () => {
  it('retains per-block fallback and appearance ownership while rejecting array-shaped appearance', () => {
    const props = { eyebrow: '', heading: 'Sentinel', level: 2, anchor: '' };
    const block: PageBuilderBlock = { instance_id: '123e4567-e89b-42d3-a456-426614174030',
      type: HEADING_BLOCK_TYPE, block_version: 1, props, slots: {} };
    const before = structuredClone(block);
    const converted = canonicalFoundationBlockToPuck(block);
    if (!converted) throw new Error('Missing conversion');
    expect(converted.props).toMatchObject({ surface: 'default', spacing: 'compact', motion: DEFAULT_BLOCK_MOTION });
    expect(foundationPuckBlockToCanonical(converted.type, { ...converted.props }, false))
      .toEqual({ type: HEADING_BLOCK_TYPE, props });
    expect(foundationPuckBlockToCanonical(converted.type, { ...converted.props }, true)?.props.appearance)
      .toEqual({ surface: 'default', spacing: 'compact' });
    const arrayAppearance = Object.assign([], { surface: 'contrast', spacing: 'spacious' });
    expect(canonicalFoundationBlockToPuck({ ...block, props: { ...props, appearance: arrayAppearance } })?.props)
      .toMatchObject({ surface: 'default', spacing: 'compact' });
    expect(block).toEqual(before);
  });

  it('preserves motion, nested fields and element styles across the pure boundary', () => {
    const block: PageBuilderBlock = { instance_id: '123e4567-e89b-42d3-a456-426614174031',
      type: IMAGE_TEXT_BLOCK_TYPE, block_version: 1, props: { eyebrow: '', heading: 'Sentinel', body: '<p>Body</p>',
        image: { src: 'https://example.test/image.png', alt: 'Sentinel' }, mediaPosition: 'right',
        primaryLink: { label: 'Action', url: '/sentinel' },
        appearance: { surface: 'default', spacing: 'normal', elements: { heading: { weight: 'bold' } } },
      }, motion: { preset: 'stagger', intensity: 'strong', trigger: 'repeat', stagger_ms: 160 }, slots: {} };
    const before = structuredClone(block);
    const converted = canonicalFoundationBlockToPuck(block);
    if (!converted) throw new Error('Missing conversion');
    expect(converted.props.motion).toEqual(block.motion);
    expect(foundationPuckBlockToCanonical(converted.type, { ...converted.props }, true))
      .toEqual({ type: block.type, props: block.props });
    expect(block).toEqual(before);
    expect(canonicalFoundationBlockToPuck({ ...block, type: 'unsupported' })).toBeNull();
    expect(foundationPuckBlockToCanonical('Unsupported', {}, false)).toBeNull();
  });
});
