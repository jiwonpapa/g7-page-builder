import React, { useId } from 'react';
import type { NativeValue } from '../domain/fields';
export function Choice({ label, value, options, disabled, onChange }: {
  label: string; value: NativeValue; options: Array<{ value: NativeValue; label: string }>;
  disabled?: boolean; onChange: (value: NativeValue) => void;
}): React.ReactElement {
  const id = useId();
  const index = options.findIndex(option => option.value === value);
  if (options.length > 5 || options.some(option => option.label.length > 16)) return <label>{label}
    <select aria-label={label} value={index} disabled={disabled} onChange={event => {
      const option = options[Number(event.target.value)]; if (option) onChange(option.value);
    }}><option value={-1} disabled>기본 / 기존 값</option>
      {options.map((option, i) => <option key={i} value={i}>{option.label}</option>)}
    </select></label>;
  return <fieldset className="g7pb-native-choice" disabled={disabled}><legend>{label}</legend>
    {options.map((option, i) => <label key={i}><input type="radio" name={id} checked={index === i}
      onChange={() => onChange(option.value)} />{option.label}</label>)}
  </fieldset>;
}
