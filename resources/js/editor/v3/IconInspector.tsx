import React, { useState } from 'react';
import type { Node } from '../../documents/v3/types';
import type { DesignCommand } from '../../documents/v3/designCommands';
import { catalogIconNames, isCatalogIconName } from '../catalogIcon';
import { InputButton } from './TypedInput';

/** An element capability, independent of the composition containing it. */
export function IconInspector({ node, disabled, apply }: {
  node: Extract<Node, { type: 'media.icon' }>; disabled: boolean; apply: (command: DesignCommand) => void;
}) {
  const [draft, setDraft] = useState(node.props), [error, setError] = useState('');
  return <form aria-label="아이콘 의미" onSubmit={event => {
    event.preventDefault();
    try { apply({ kind: 'content', id: node.instance_id, props: draft }); setError(''); }
    catch (value) { setError(value instanceof Error ? value.message : '아이콘 설정을 확인해 주세요.'); }
  }}><fieldset disabled={disabled} style={{ border: 0, padding: '12px 0', margin: 0 }}>
    <label>아이콘 종류<select aria-label="아이콘 종류" value={draft.icon} onChange={event => {
      const icon = event.target.value; if (isCatalogIconName(icon)) setDraft({ ...draft, icon });
    }}>{catalogIconNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    <label><input type="checkbox" checked={draft.decorative} onChange={event => setDraft({ ...draft, decorative: event.target.checked })} />장식용 아이콘</label>
    <label>아이콘 설명<input aria-label="아이콘 설명" value={draft.label} disabled={draft.decorative}
      onChange={event => setDraft({ ...draft, label: event.target.value })} /></label>
    <p>크기와 색상은 공통 디자인에서 변경합니다. 의미가 있는 아이콘은 설명이 필요합니다.</p>
    <InputButton type="submit">아이콘 적용</InputButton>
  </fieldset>{error && <p role="alert">{error}</p>}</form>;
}
