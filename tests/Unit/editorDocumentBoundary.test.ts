import { describe, expect, it } from 'vitest';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const { canonicalToPuck, canonicalBlockToPuck } = await import('../../resources/js/editor/puckBlockCodec');
const { assessEditorCandidate, historyAfterRejectedCommand } = await import('../../resources/js/editor/editorDocumentBoundary');

const heading = (): PageBuilderBlock => ({ instance_id: crypto.randomUUID(), type: 'content.heading-01', block_version: 1,
  props: { eyebrow: '', heading: 'Synthetic heading', level: 2, anchor: '' } });
const document = (blocks: PageBuilderBlock[]): PageBuilderDocument => ({ schema_version: 'g7-page-builder/v2',
  document_id: crypto.randomUUID(), slug: 'boundary-unit', locale: 'ko', mode: 'canvas', blocks });
const section = (count: number): PageBuilderBlock => ({ instance_id: crypto.randomUUID(), type: 'layout.section-01',
  block_version: 1, props: { width: 'standard', spacing: 'normal' }, slots: { content: Array.from({ length: count }, heading) } });

describe('canonical candidate boundary with synthetic structure only', () => {
  it.each([
    ['slot count', [section(201)], '한 구역의 블록 수'],
    ['node count', Array.from({ length: 501 }, heading), '문서의 블록 수'],
    ['root parent', [{ instance_id: crypto.randomUUID(), type: 'layout.stack-01', block_version: 1,
      props: { gap: 'normal' }, slots: { content: [] } }], '블록을 배치할 수 있는 위치'],
  ] satisfies Array<[string, PageBuilderBlock[], string]>)('rejects %s without mutating the accepted source', (_label, blocks, detail) => {
    const accepted = canonicalToPuck(document([section(1)]));
    const source = structuredClone(accepted);
    const candidate = { ...accepted.data, content: blocks.map(canonicalBlockToPuck) };
    const result = assessEditorCandidate(candidate, accepted.data, accepted.context, true);
    expect(result).toEqual({ accepted: false, message: expect.stringContaining(detail) });
    expect(accepted).toEqual(source);
  });

  it('commits a valid edit and permits selection-only data while read-only', () => {
    const accepted = canonicalToPuck(document([heading()]));
    expect(assessEditorCandidate(structuredClone(accepted.data), accepted.data, accepted.context, false))
      .toMatchObject({ accepted: true, changed: false });
    const changed = structuredClone(accepted.data);
    const item = changed.content[0];
    if (item.type !== 'Heading') throw new Error('Synthetic fixture must be Heading');
    item.props.heading = 'Valid replacement';
    expect(assessEditorCandidate(changed, accepted.data, accepted.context, true))
      .toMatchObject({ accepted: true, changed: true, document: { blocks: [{ props: { heading: 'Valid replacement' } }] } });
    expect(assessEditorCandidate(changed, accepted.data, accepted.context, false).accepted).toBe(false);
  });

  it('retains exact past and redo entries after a rejected native command', () => {
    const histories = ['past', 'current', 'future'].map((data) => ({ state: { data }, id: data }));
    expect(historyAfterRejectedCommand(histories, 1, { state: { data: 'current' }, id: 'repair' }))
      .toEqual({ histories, index: 1 });
  });

  it('retains a valid edit still waiting for the vendor history debounce', () => {
    const histories = ['past', 'current', 'future'].map((data) => ({ state: { data }, id: data }));
    const pending = { state: { data: 'valid pending edit' }, id: 'repair' };
    expect(historyAfterRejectedCommand(histories, 1, pending)).toEqual({ histories: [...histories.slice(0, 2), pending], index: 2 });
  });
});
