import React, { useState } from 'react';
import type { EmbedSource, Node } from '../../documents/v3/types';
import type { DesignCommand } from '../../documents/v3/designCommands';
import { InputButton, TypedInput } from './TypedInput';
const zoomLevels = [12, 14, 16, 18] as const;

/** Shared element settings; compositions add data, not another editor implementation. */
export function EmbedInspector({ node, disabled, apply }: {
  node: Extract<Node, { type: 'media.embed' }>; disabled: boolean; apply: (command: DesignCommand) => void;
}) {
  const [draft, setDraft] = useState(node.props), [error, setError] = useState('');
  const source = draft.source;
  const changeSource = (source: EmbedSource) => setDraft({ ...draft, source });
  return <form aria-label="영상·지도 설정" onSubmit={event => {
    event.preventDefault(); if (disabled) return;
    try { apply({ kind: 'content', id: node.instance_id, props: draft }); setError(''); }
    catch (value) { setError(value instanceof Error ? value.message : '값을 확인해 주세요.'); }
  }}><fieldset disabled={disabled} style={{ border: 0, padding: '12px 0', margin: 0 }}>
    <label>임베드 설명<input aria-label="임베드 설명" value={draft.title} maxLength={300}
      onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
    <label>제공자<select aria-label="임베드 제공자" value={source.provider} onChange={event => {
      const provider = event.target.value;
      if (provider === 'none') changeSource({ provider });
      if (provider === 'youtube' || provider === 'vimeo') changeSource({ provider, video_id: '' });
      if (provider === 'google' || provider === 'openstreetmap') changeSource({ provider, latitude: 0, longitude: 0, zoom: 14 });
    }}>
      {Object.entries({ none: '미설정', youtube: 'YouTube', vimeo: 'Vimeo', openstreetmap: 'OpenStreetMap', google: 'Google 지도' })
        .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {'video_id' in source && <label>영상 ID<input aria-label="영상 ID" value={source.video_id}
      onChange={event => changeSource({ ...source, video_id: event.target.value })} /></label>}
    {'latitude' in source && <>
      {([['latitude', '위도', 90], ['longitude', '경도', 180]] as const).map(([key, label, bound]) => <TypedInput key={key} label={label}
        rule={{ type: 'number', multipleOf: 0.000001, minimum: -bound, maximum: bound }} value={Number.isFinite(source[key]) ? source[key] : ''}
        change={value => changeSource({ ...source, [key]: typeof value === 'number' ? value : NaN })} />)}
      <label>지도 확대<select aria-label="지도 확대" value={source.zoom} onChange={event => {
        const zoom = zoomLevels.find(value => value === Number(event.target.value)); if (zoom !== undefined) changeSource({ ...source, zoom });
      }}>{zoomLevels.map(zoom => <option key={zoom} value={zoom}>{zoom}</option>)}</select></label>
    </>}
    <p>영상·지도는 미리보기에서 조작합니다.</p>
    <InputButton type="submit">임베드 적용</InputButton>
    <InputButton onClick={() => { setDraft(node.props); setError(''); }}>입력 취소</InputButton>
  </fieldset>{error && <p role="alert">{error}</p>}</form>;
}
