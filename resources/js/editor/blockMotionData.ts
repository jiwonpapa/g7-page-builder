import type { BlockMotion, BlockMotionPreset } from '../documents/blockPresentation';

export const DEFAULT_BLOCK_MOTION: BlockMotion = {
  preset: 'none',
  intensity: 'normal',
  trigger: 'once',
  stagger_ms: 100,
};

export const PRESET_LABELS: Record<BlockMotionPreset, string> = {
  none: '효과 없음',
  reveal: '부드럽게 나타나기',
  stagger: '항목 순차 등장',
  'parallax-soft': '소프트 패럴랙스',
  counter: '숫자 카운트업',
  'chart-draw': '그래프 그리기',
};

export function normalizeBlockMotion(value: unknown): BlockMotion {
  const record = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const preset = typeof record.preset === 'string' && Object.hasOwn(PRESET_LABELS, record.preset)
    ? record.preset as BlockMotionPreset
    : DEFAULT_BLOCK_MOTION.preset;

  return {
    preset,
    intensity: record.intensity === 'subtle' || record.intensity === 'strong'
      ? record.intensity
      : 'normal',
    trigger: record.trigger === 'repeat' ? 'repeat' : 'once',
    stagger_ms: record.stagger_ms === 60 || record.stagger_ms === 160 ? record.stagger_ms : 100,
  };
}

export function motionPreviewAttributes(value: unknown): Record<string, string | number> {
  const motion = normalizeBlockMotion(value);

  return motion.preset === 'none'
    ? {}
    : {
        'data-g7pb-motion': motion.preset,
        'data-g7pb-motion-intensity': motion.intensity,
        'data-g7pb-motion-trigger': motion.trigger,
        'data-g7pb-motion-stagger': motion.stagger_ms,
      };
}
