import React from 'react';

export interface InspectorChoice<TValue extends string = string> {
  label: string;
  value: TValue;
  swatch?: string;
}

export function InspectorChoiceField<TValue extends string>({
  value,
  onChange,
  readOnly,
  label,
  help,
  testId,
  options,
  swatches = false,
}: {
  value: TValue;
  onChange: (value: TValue) => void;
  readOnly?: boolean;
  label: string;
  help?: string;
  testId: string;
  options: readonly InspectorChoice<TValue>[];
  swatches?: boolean;
}): React.ReactElement {
  return <fieldset className={`g7pb-inspector-choice${swatches ? ' g7pb-inspector-choice--swatches' : ''}`} data-testid={testId}>
    <legend>{label}</legend>
    {help ? <p>{help}</p> : null}
    <div role="radiogroup" aria-label={label}>
      {options.map((option) => <label key={option.value} data-selected={value === option.value ? 'true' : 'false'}>
        <input type="radio" name={testId} value={option.value} checked={value === option.value}
          disabled={readOnly} onChange={() => onChange(option.value)} />
        {option.swatch ? <span className="g7pb-inspector-choice__swatch" style={{ '--g7pb-choice-swatch': option.swatch } as React.CSSProperties} aria-hidden="true" /> : null}
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}
