import React, { useState } from 'react';
import type { DataConnection, Node } from '../../documents/v3/types';
import { designPolicyV3 } from '../../documents/v3/validate';
import type { DocumentCommand } from '../../documents/v3/designCommands';
import { InputButton } from './TypedInput';

const sources: Record<DataConnection['source'], string> = { posts: '게시글 목록', 'post-archive': '게시글 아카이브', 'post-detail': '게시글 상세', products: '상품 목록', 'product-showcase': '상품 쇼케이스', 'product-detail': '상품 상세' };
export function DataInspector({ node, disabled, apply }: { node: Node; disabled: boolean; apply: (command: DocumentCommand) => void }) {
  const [value, setValue] = useState<DataConnection>(node.data ?? { source: 'posts', feed: 'recent', period: 'week', limit: 6, board_slug: '', post_id: 1, product_key: '', audience: 'all', fields: [] });
  const [error, setError] = useState('');
  if (node.type !== 'layout.container' || node.props.tag !== 'div') return null;
  const descendants: Node[] = [];
  const collect = (items: Node[]): void => { for (const child of items) { descendants.push(child); collect(child.slots.content ?? []); } };
  collect(node.slots.content ?? []);
  const eligible = !node.system && !node.behavior && !node.binding && node.slots.content?.length === 1;
  return <section aria-label="동적 데이터 연결" style={{ borderTop: '1px solid var(--g7pb-border)', marginTop: 16, paddingTop: 16 }}>
    <h2 style={{ fontSize: 15 }}>동적 데이터 연결</h2>
    <p>내부 구성 하나를 반복할 원형으로 사용합니다. 원형의 구조·스타일은 공통 요소 편집으로 수정하고 실제 값은 G7이 제공합니다.</p>
    <fieldset disabled={disabled || !eligible}>
      <label>데이터 종류<select value={value.source} onChange={event => {
        const source = event.target.value;
        if (Object.hasOwn(sources, source)) { const typed = source as DataConnection['source']; setValue({ ...value, source: typed, feed: typed.startsWith('product') ? 'latest' : 'recent' }); }
      }}>{(Object.keys(sources) as DataConnection['source'][]).map(source => <option key={source} value={source}>{sources[source]}</option>)}</select></label>
      <label>목록 원천<select value={value.feed} onChange={event => {
        const feed = event.target.value;
        if (designPolicyV3.data.feeds[value.source].includes(feed)) setValue({ ...value, feed: feed as DataConnection['feed'] });
      }}>{designPolicyV3.data.feeds[value.source].map(feed => <option key={feed}>{feed}</option>)}</select></label>
      <label>인기 기간<select value={value.period} onChange={event => { const period = event.target.value; if (['today', 'week', 'month', 'year'].includes(period)) setValue({ ...value, period: period as DataConnection['period'] }); }}>
        {['today', 'week', 'month', 'year'].map(period => <option key={period}>{period}</option>)}</select></label>
      <label>개수<select value={value.limit} onChange={event => { const limit = Number(event.target.value); if ([3, 4, 6, 8, 12].includes(limit)) setValue({ ...value, limit: limit as DataConnection['limit'] }); }}>
        {[3, 4, 6, 8, 12].map(limit => <option key={limit}>{limit}</option>)}</select></label>
      <label>게시판 slug<input value={value.board_slug} onChange={event => setValue({ ...value, board_slug: event.target.value })} /></label>
      <label>게시글 ID<input type="number" min="1" value={value.post_id} onChange={event => setValue({ ...value, post_id: Number(event.target.value) })} /></label>
      <label>상품 키<input value={value.product_key} onChange={event => setValue({ ...value, product_key: event.target.value })} /></label>
      <label>열람 대상<select value={value.audience} onChange={event => { const audience = event.target.value; if (['all', 'guest', 'member'].includes(audience)) setValue({ ...value, audience: audience as DataConnection['audience'] }); }}>
        <option value="all">전체</option><option value="guest">비회원</option><option value="member">회원</option></select></label>
      {descendants.flatMap(target => (['text', 'image', 'link'] as const).filter(property => designPolicyV3.data.properties[property].includes(target.type)).map(property => {
        const field = value.fields.find(field => field.node_id === target.instance_id && field.property === property);
        return <label key={target.instance_id + property}>{target.name} · {property}<select value={field?.field ?? ''} onChange={event => {
          const name = event.target.value, fields = value.fields.filter(field => field.node_id !== target.instance_id || field.property !== property);
          if (name && designPolicyV3.data.fields[property].includes(name)) fields.push({ node_id: target.instance_id, property, field: name as DataConnection['fields'][number]['field'] });
          setValue({ ...value, fields });
        }}><option value="">작성한 값 유지</option>{designPolicyV3.data.fields[property].map(name => <option key={name}>{name}</option>)}</select></label>;
      }))}
      <InputButton onClick={() => { try { apply({ kind: 'data', id: node.instance_id, value }); setError(''); } catch (error) { setError(error instanceof Error ? error.message : '데이터를 연결하지 못했습니다.'); } }}>데이터 연결 적용</InputButton>
    </fieldset>
    {node.data && <InputButton disabled={disabled} onClick={() => apply({ kind: 'data', id: node.instance_id, value: null })}>데이터 연결 해제</InputButton>}
    {!eligible && <p role="status">동작 없는 div 컨테이너 안에 반복할 구성 하나를 넣어 주세요.</p>}
    <p>최소 한 필드를 연결해야 합니다. 실행 서비스가 없거나 권한이 없으면 공개 화면에 안내하며 원본과 마지막 발행본은 보존합니다.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
