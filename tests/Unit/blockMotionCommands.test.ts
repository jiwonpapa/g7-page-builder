import { describe, expect, it } from 'vitest';
import { applyRecommendedMotions, clearMotions, recommendedMotionPlan } from '../../resources/js/editor/blockMotionCommands';
import { DEFAULT_PAGE_DESIGN } from '../../resources/js/editor/pageDesignTokens';
import { DEFAULT_BLOCK_MOTION } from '../../resources/js/editor/blockMotion';
import type { PuckEditorData } from '../../resources/js/editor/puckEditorTypes';

function commandContent(command: ReturnType<typeof applyRecommendedMotions>) {
  if (command.type !== 'setData' || typeof command.data === 'function') throw new Error('Expected a data patch');
  return command.data.content;
}

describe('block motion commands', () => {
  it('builds a deterministic, varied and capability-aware recommended motion plan', () => {
    const types = ['Hero', 'Features', 'Heading', 'Stats', 'BarChart', 'Gallery', 'ArticleList'];
    const first = recommendedMotionPlan(types);
    const second = recommendedMotionPlan(types);

    expect(first).toEqual(second);
    expect(new Set(first.map((motion) => motion.preset)).size).toBeGreaterThanOrEqual(4);
    expect(first[3]?.preset).toBe('counter');
    expect(['chart-draw', 'reveal']).toContain(first[4]?.preset);
    expect(first.every((motion) => motion.trigger === 'once')).toBe(true);
    expect(recommendedMotionPlan(['LogoCarousel', 'TestimonialSlider']).map((motion) => motion.preset))
      .toEqual(['reveal', 'reveal']);
  });

  it('preserves raw external motion, reserved payload names and other metadata without mutating input', () => {
    const payload = { id: 'raw-id', puck: 'raw-puck', editMode: 'raw-edit', motion: { custom: 'pack-motion' } };
    const metadata = { visibility: { audience: 'member' as const }, emptySlotNames: ['body'],
      motion: { ...DEFAULT_BLOCK_MOTION, preset: 'counter' as const } };
    const data: PuckEditorData = { root: { props: { ...DEFAULT_PAGE_DESIGN } }, content: [
      { type: 'External_SyntheticMotion', props: { id: 'editor-id', payload, metadata } },
    ] };
    const before = structuredClone(data);
    const recommended = commandContent(applyRecommendedMotions(data));
    const cleared = commandContent(clearMotions(data));
    for (const [content, motion] of [[recommended, { ...DEFAULT_BLOCK_MOTION, preset: 'reveal', intensity: 'subtle', stagger_ms: 60 }], [cleared, DEFAULT_BLOCK_MOTION]] as const) {
      const item = content?.[0];
      expect(item).toEqual({ type: 'External_SyntheticMotion', props: { id: 'editor-id', payload,
        metadata: { ...metadata, motion } } });
      expect(item?.props.payload).toBe(payload);
      expect(item?.props.metadata.visibility).toBe(metadata.visibility);
    }
    expect(data).toEqual(before);
  });
});
