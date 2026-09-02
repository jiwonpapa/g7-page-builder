import React from 'react';
import type { Field } from '@puckeditor/core';
import { PRESET_LABELS, normalizeBlockMotion } from './blockMotionData';
export { DEFAULT_BLOCK_MOTION, normalizeBlockMotion, motionPreviewAttributes } from './blockMotionData';

import type { BlockMotion, BlockMotionPreset } from '../documents/blockPresentation';

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
