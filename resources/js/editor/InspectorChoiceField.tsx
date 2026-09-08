import React, { useId } from 'react';
import { AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalSpaceAround,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd } from 'lucide-react';

export interface InspectorChoice<TValue = string> {
  label: string;
  value: TValue;
  swatch?: string;
}

export function InspectorChoiceField<TValue>({
  value,
  onChange,
  readOnly,
  label,
  help,
  testId,
  options,
  swatches = false,
  alignment,
}: {
  value: TValue;
  onChange: (value: TValue) => void;
  readOnly?: boolean;
  label: string;
  help?: string;
  testId: string;
  options: readonly InspectorChoice<TValue>[];
  swatches?: boolean;
  alignment?: 'horizontal' | 'vertical';
}): React.ReactElement {
  const groupId = useId();
  const icons = alignment === 'horizontal'
    ? { left: AlignHorizontalJustifyStart, center: AlignHorizontalJustifyCenter, right: AlignHorizontalJustifyEnd, stretch: AlignHorizontalSpaceAround }
    : { start: AlignVerticalJustifyStart, center: AlignVerticalJustifyCenter, end: AlignVerticalJustifyEnd };
  const currentLabel = options.find((option) => Object.is(option.value, value))?.label;
  return <fieldset className={`g7pb-inspector-choice${swatches ? ' g7pb-inspector-choice--swatches' : ''}`} data-testid={testId} title={help} aria-description={help}>
    <legend>{label}{swatches ? <span className="g7pb-inspector-choice__current">{currentLabel}</span> : null}</legend>
    <div role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const Icon = alignment ? Object.entries(icons).find(([key]) => key === option.value)?.[1] : undefined;
        return <label key={index} title={option.label} data-selected={Object.is(value, option.value) ? 'true' : 'false'}>
        <input type="radio" name={groupId} value={String(option.value)} checked={Object.is(value, option.value)} aria-label={option.label}
          disabled={readOnly} onChange={() => onChange(option.value)} />
        {option.swatch ? <span className="g7pb-inspector-choice__swatch" style={{ '--g7pb-choice-swatch': option.swatch } as React.CSSProperties} aria-hidden="true" /> : null}
        {Icon ? <Icon size={17} aria-hidden="true" /> : null}
        <span hidden={swatches || Boolean(Icon)}>{option.label}</span>
      </label>;
      })}
    </div>
  </fieldset>;
}
