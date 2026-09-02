import React from 'react';
import type { Field } from '@puckeditor/core';

import type { BlockMotion, BlockMotionPreset } from '../documents/blockPresentation';

export const DEFAULT_BLOCK_MOTION: BlockMotion = {
  preset: 'none',
  intensity: 'normal',
  trigger: 'once',
  stagger_ms: 100,
};

const PRESET_LABELS: Record<BlockMotionPreset, string> = {
  none: '효과 없음',
  reveal: '부드럽게 나타나기',
  stagger: '항목 순차 등장',
  'parallax-soft': '소프트 패럴랙스',
  counter: '숫자 카운트업',
  'chart-draw': '그래프 그리기',
};

const INTENSITY_OPTIONS: Array<{ label: string; value: BlockMotion['intensity'] }> = [
  { label: '약하게', value: 'subtle' },
  { label: '기본', value: 'normal' },
  { label: '강하게', value: 'strong' },
];

const TRIGGER_OPTIONS: Array<{ label: string; value: BlockMotion['trigger'] }> = [
  { label: '한 번', value: 'once' },
  { label: '다시 보일 때마다', value: 'repeat' },
];

const STAGGER_OPTIONS: Array<{ label: string; value: BlockMotion['stagger_ms'] }> = [
  { label: '빠르게', value: 60 },
  { label: '기본', value: 100 },
  { label: '천천히', value: 160 },
];

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

function MotionField({
  value,
  onChange,
  readOnly,
  allowedPresets,
}: {
  value: BlockMotion;
  onChange: (value: BlockMotion) => void;
  readOnly?: boolean;
  allowedPresets: readonly BlockMotionPreset[];
}): React.ReactElement {
  const motion = normalizeBlockMotion(value);
  const update = (patch: Partial<BlockMotion>): void => onChange({ ...motion, ...patch });

  return (
    <div className="g7pb-motion-field" data-testid="page-builder-motion-controls">
      <label>
        효과
        <select
          data-testid="page-builder-motion-preset"
          value={motion.preset}
          disabled={readOnly}
          onChange={(event) => update({ preset: event.target.value as BlockMotionPreset })}
        >
          {allowedPresets.map((preset) => (
            <option key={preset} value={preset}>{PRESET_LABELS[preset]}</option>
          ))}
        </select>
      </label>
      {motion.preset !== 'none' && (
        <>
          <label>
            강도
            <select
              data-testid="page-builder-motion-intensity"
              value={motion.intensity}
              disabled={readOnly}
              onChange={(event) => update({ intensity: event.target.value as BlockMotion['intensity'] })}
            >
              {INTENSITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            실행
            <select
              data-testid="page-builder-motion-trigger"
              value={motion.trigger}
              disabled={readOnly}
              onChange={(event) => update({ trigger: event.target.value as BlockMotion['trigger'] })}
            >
              {TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {motion.preset === 'stagger' && (
            <label>
              순차 간격
              <select
                data-testid="page-builder-motion-stagger"
                value={motion.stagger_ms}
                disabled={readOnly}
                onChange={(event) => update({ stagger_ms: Number(event.target.value) as BlockMotion['stagger_ms'] })}
              >
                {STAGGER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <p>검증된 프리셋만 공개 페이지에 적용됩니다. 움직임 줄이기 설정에서는 자동 해제됩니다.</p>
    </div>
  );
}

export function createMotionField(allowedPresets: readonly BlockMotionPreset[]): Field<BlockMotion> {
  return {
    type: 'custom',
    label: '스크롤 효과',
    render: ({ value, onChange, readOnly }) => (
      <MotionField
        value={normalizeBlockMotion(value)}
        onChange={onChange}
        readOnly={readOnly}
        allowedPresets={allowedPresets}
      />
    ),
  };
}
