import React from 'react';
import type { DocumentV3 } from '../../documents/v3/types';
import { record, type Rule } from '../../documents/v3/schema';
import { choiceLabel, choices, labelFor, matches, resolve, seed } from './inspectorFields';

export function InputButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className="g7pb-button g7pb-button--quiet" {...props} />;
}
/** Schema-derived controls, not an editable JSON/CSS text field. Drafts are validated by the command. */
export function TypedInput({ rule, value, label, change, assets = [] }: {
  rule: Rule; value: unknown; label: string; change: (value: unknown) => void; assets?: DocumentV3['assets'];
}) {
  const variants = choices(rule), current = resolve(rule);
  if (variants.length > 1) {
    let index = variants.findIndex(variant => matches(value, variant));
    if (index < 0 && record(value)) index = variants.findIndex(variant => Object.entries(variant.properties ?? {}).some(([key, field]) =>
      field && Object.hasOwn(field, 'const') && value[key] === field.const));
    index = Math.max(0, index);
    return <div><select aria-label={label + ' 형식'} value={index} onChange={event => change(seed(variants[Number(event.target.value)], value))}>
      {variants.map((variant, n) => <option key={n} value={n}>{choiceLabel(variant)}</option>)}
    </select><TypedInput rule={variants[index]} value={value} label={label} change={change} assets={assets} /></div>;
  }
  if (Object.hasOwn(current, 'const')) return null;
  if (current.type === 'object') {
    const object = record(value) ? value : {};
    return <div style={{ display: 'grid', gap: 5 }}>{Object.entries(current.properties ?? {}).map(([key, child]) => child &&
      <TypedInput key={key} rule={child} value={object[key]} label={label + ' ' + labelFor(key)}
        change={entry => change({ ...object, [key]: entry })} assets={assets} />)}</div>;
  }
  if (current.type === 'array') {
    const items = Array.isArray(value) ? value : [];
    return <div>{items.map((item, index) => <fieldset key={index} style={{ border: 0, padding: '6px 0', margin: 0 }}>
      <legend>{label} {index + 1}</legend>
      <TypedInput rule={current.items!} value={item} label={label + ' ' + (index + 1)} assets={assets}
        change={entry => change(items.map((old, n) => n === index ? entry : old))} />
      <InputButton disabled={items.length <= (current.minItems ?? 0)} aria-label={label + ' ' + (index + 1) + ' 삭제'}
        onClick={() => change(items.filter((_, n) => n !== index))}>삭제</InputButton>
    </fieldset>)}
      <InputButton disabled={items.length >= (current.maxItems ?? Infinity)} onClick={() => change([...items, seed(current.items!)])}>{label} 추가</InputButton>
    </div>;
  }
  if (current.type === 'boolean') return <label><input type="checkbox" checked={value === true} onChange={event => change(event.target.checked)} />{label}</label>;
  if (rule.$ref?.endsWith('/uuid')) return <label>{label}<select aria-label={label} value={typeof value === 'string' ? value : ''} onChange={event => change(event.target.value)}>
    <option value="">이미지 선택</option>{assets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.url}</option>)}
  </select></label>;
  return <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 95px', gap: 8, alignItems: 'center' }}>{label}
    <input aria-label={label} type={current.type === 'number' ? 'number' : 'text'} style={{ minWidth: 0, width: '100%' }}
      min={current.minimum} max={current.maximum} step={current.multipleOf ?? 'any'} maxLength={current.maxLength}
      value={typeof value === 'number' || typeof value === 'string' ? value : ''}
      onChange={event => change(current.type === 'number' ? event.target.value === '' ? '' : event.target.valueAsNumber : event.target.value)} />
  </label>;
}
