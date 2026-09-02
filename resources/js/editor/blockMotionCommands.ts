import type { PuckAction } from '@puckeditor/core';
import { withEditorMotion } from '../blocks/externalEditorData';
import type { BlockMotion } from '../documents/types';
import { DEFAULT_BLOCK_MOTION } from './blockMotion';
import type { PuckEditorData } from './puckEditorTypes';

const MOTION_PRESET_FAMILIES: Readonly<Record<string, readonly BlockMotion['preset'][]>> = Object.freeze({
  Hero: ['parallax-soft', 'reveal'],
  HeroSplit: ['parallax-soft', 'reveal'],
  HeroSlider: ['parallax-soft', 'reveal'],
  Gallery: ['parallax-soft', 'stagger', 'reveal'],
  ImageCarousel: ['parallax-soft', 'reveal'],
  Features: ['stagger', 'reveal'],
  IconList: ['stagger', 'reveal'],
  CardGrid: ['stagger', 'reveal'],
  LogoCloud: ['stagger', 'reveal'],
  Pricing: ['stagger', 'reveal'],
  Team: ['stagger', 'reveal'],
  Testimonials: ['stagger', 'reveal'],
  ProcessTimeline: ['stagger', 'reveal'],
  ArticleList: ['stagger', 'reveal'],
  G7RecentPosts: ['stagger', 'reveal'],
  G7ProductGrid: ['stagger', 'reveal'],
  Stats: ['counter', 'stagger', 'reveal'],
  BarChart: ['chart-draw', 'reveal'],
});

export function recommendedMotionPlan(types: readonly string[]): BlockMotion[] {
  let previous: BlockMotion['preset'] | null = null;
  const occurrences = new Map<string, number>();
  const intensities: BlockMotion['intensity'][] = ['subtle', 'normal', 'normal', 'strong'];
  const staggers: BlockMotion['stagger_ms'][] = [60, 100, 160];

  return types.map((type, index) => {
    const options = MOTION_PRESET_FAMILIES[type] ?? ['reveal'];
    const occurrence = occurrences.get(type) ?? 0;
    occurrences.set(type, occurrence + 1);
    let preset = options[occurrence % options.length] ?? 'reveal';
    if (options.length > 1 && preset === previous) {
      preset = options[(options.indexOf(preset) + 1) % options.length] ?? preset;
    }
    previous = preset;
    return {
      ...DEFAULT_BLOCK_MOTION,
      preset,
      intensity: intensities[index % intensities.length] ?? 'normal',
      stagger_ms: staggers[index % staggers.length] ?? 100,
    };
  });
}

export function applyRecommendedMotions(data: PuckEditorData): PuckAction {
  const motionPlan = recommendedMotionPlan(data.content.map((block) => block.type));
  return {
    type: 'setData',
    data: {
      content: data.content.map((block, index) => withEditorMotion(block, motionPlan[index] ?? { ...DEFAULT_BLOCK_MOTION, preset: 'reveal' })),
    },
    recordHistory: true,
  };
}

export function clearMotions(data: PuckEditorData): PuckAction {
  return {
    type: 'setData',
    data: { content: data.content.map((block) => withEditorMotion(block, { ...DEFAULT_BLOCK_MOTION })) },
    recordHistory: true,
  };
}
