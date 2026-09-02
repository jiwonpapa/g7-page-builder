import React, { useEffect, useState } from 'react';
import type { Config, CustomField, Field, Fields } from '@puckeditor/core';
import { BLOCK_CONTAINER_FIELDS } from './blockAppearance';
import type { CommonEditorProps, EditorComponents } from './puckEditorTypes';
import type { PageDesignProps } from './pageDesignTokens';
import { createResponsiveAppearanceField } from './responsiveBlockStyle';

export function StableSelectField<TValue extends string>({
  value, onChange, readOnly, testId, options, label, help,
}: {
  value: TValue;
  onChange: (value: TValue) => void;
  readOnly?: boolean;
  testId: string;
  options: readonly { label: string; value: TValue }[];
  label?: string;
  help?: string;
}): React.ReactElement {
  const [draftValue, setDraftValue] = useState(value);
  useEffect(() => setDraftValue(value), [value]);
  return <label className={label ? 'g7pb-design-field' : undefined}>
    {label ? <span>{label}</span> : null}
    {help ? <small>{help}</small> : null}
    <select className="g7pb-field-control" data-testid={testId} value={draftValue} disabled={readOnly}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.currentTarget.value);
        if (!selected) return;
        setDraftValue(selected.value);
        onChange(selected.value);
      }}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

const REQUIRED_FIELD_NAMES = new Set(['alt', 'imageAlt', 'avatarAlt']);
type FieldMap<Props> = { [Name in keyof Props]: Field<Props[Name]> };

function markRequiredField<Value>(name: string, field: Field<Value>): Field<Value> {
  if (!field) return field;
  const next = { ...field };
  if (REQUIRED_FIELD_NAMES.has(name) && typeof next.label === 'string' && !next.label.includes('(필수)')) {
    next.label = `${next.label} (필수)`;
  }
  if (next.type === 'array') next.arrayFields = markRequiredInspectorFields(next.arrayFields);
  return next;
}

export function markRequiredInspectorFields<Props>(fields: FieldMap<Props>): FieldMap<Props> {
  const next = { ...fields };
  for (const name in fields) next[name] = markRequiredField(name, fields[name]);
  return next;
}

function containerField<Value extends string>(
  name: string, field: { label: string; options: readonly { label: string; value: Value }[] },
): CustomField<Value | undefined> {
  return {
    type: 'custom', label: field.label,
    render: ({ value, onChange, readOnly }) => <StableSelectField
      value={value ?? field.options[0].value} onChange={onChange} readOnly={readOnly}
      testId={`page-builder-block-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`}
      options={field.options} />,
  };
}

const containerFields = {
  containerWidth: containerField('containerWidth', BLOCK_CONTAINER_FIELDS.containerWidth),
  containerAlign: containerField('containerAlign', BLOCK_CONTAINER_FIELDS.containerAlign),
  minHeight: containerField('minHeight', BLOCK_CONTAINER_FIELDS.minHeight),
  verticalAlign: containerField('verticalAlign', BLOCK_CONTAINER_FIELDS.verticalAlign),
  responsiveOverrides: createResponsiveAppearanceField(),
} satisfies Fields<CommonEditorProps>;

type Components = Config<EditorComponents, PageDesignProps>['components'];

function decorateComponent<Name extends keyof Components>(component: Components[Name]): Components[Name] {
  const fields = Object.assign({}, component.fields, containerFields);
  return { ...component, fields: markRequiredInspectorFields(fields) };
}

function eachOwnKey<Value extends object>(value: Value, apply: (key: Extract<keyof Value, string>) => void): void {
  for (const name in value) if (Object.hasOwn(value, name)) apply(name);
}

export function withBlockContainerFields(components: Components): Components {
  const next = { ...components };
  function decorate<Name extends keyof Components>(name: Name): void {
    if (!name.startsWith('Layout')) next[name] = decorateComponent(components[name]);
  }
  eachOwnKey(components, decorate);
  return next;
}
