import React from 'react';
import type { NativeCollection } from '../domain/tree';
import { Choice } from './Choice';

/** Positions belong to the current host snapshot; callers reset them when it changes. */
export function InsertionPosition({ collection, index, onChange, disabled }: {
  collection: NativeCollection; index: number; onChange: (index: number) => void; disabled?: boolean;
}): React.ReactElement {
  return <Choice label="삽입 순서" value={index} disabled={disabled} onChange={value => { if (typeof value === 'number') onChange(value); }}
    options={[...collection.items.map((item, position) => ({ value: position, label: `${position + 1}. ${item.label} 앞` })),
      { value: collection.items.length, label: collection.items.length ? '맨 뒤' : '첫 항목' }]} />;
}
