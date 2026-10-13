import React, { useState } from 'react';
import type { EmbedSource, Node } from '../../documents/v3/types';
import type { DesignCommand } from '../../documents/v3/designCommands';
import { InputButton } from './TypedInput';

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
    catch (value) { setError(value instanceof Error ? value.message : '영상·지도 설정을 확인해 주세요.'); }
  }}><fieldset disabled={disabled} style={{ border: 0, padding: '12px 0', margin: 0 }}>
    <label>임베드 설명<input aria-label="임베드 설명" value={draft.title} maxLength={300}
      onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
    <label>제공자<select aria-label="임베드 제공자" value={source.provider} onChange={event => {
      const provider = event.target.value;
      if (provider === 'none') changeSource({ provider });
      if (provider === 'youtube' || provider === 'vimeo') changeSource({ provider, video_id: '' });
      if (provider === 'google' || provider === 'openstreetmap') changeSource({ provider, latitude: 0, longitude: 0, zoom: 14 });
    }}>
      <option value="none">미설정</option><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option>
      <option value="openstreetmap">OpenStreetMap</option><option value="google">Google 지도</option>
    </select></label>
    {'video_id' in source && <label>영상 ID<input aria-label="영상 ID" value={source.video_id}
      onChange={event => changeSource({ ...source, video_id: event.target.value })} /></label>}
    {'latitude' in source && <>
      {(['latitude', 'longitude'] as const).map(key => <label key={key}>{key === 'latitude' ? '위도' : '경도'}<input
        aria-label={key === 'latitude' ? '위도' : '경도'} type="number" step="0.000001" value={Number.isFinite(source[key]) ? source[key] : ''}
        min={key === 'latitude' ? -90 : -180} max={key === 'latitude' ? 90 : 180}
        onChange={event => changeSource({ ...source, [key]: event.target.valueAsNumber })} /></label>)}
      <label>지도 확대<select aria-label="지도 확대" value={source.zoom} onChange={event => {
        const zoom = Number(event.target.value); if (zoom === 12 || zoom === 14 || zoom === 16 || zoom === 18) changeSource({ ...source, zoom });
      }}>{[12, 14, 16, 18].map(zoom => <option key={zoom} value={zoom}>{zoom}</option>)}</select></label>
    </>}
    <p>캔버스에서는 요소의 위치와 크기를 편집합니다. 외부 콘텐츠 조작은 미리보기에서 확인합니다.</p>
    <InputButton type="submit">임베드 적용</InputButton>
    <InputButton onClick={() => { setDraft(node.props); setError(''); }}>입력 취소</InputButton>
  </fieldset>{error && <p role="alert">{error}</p>}</form>;
}
