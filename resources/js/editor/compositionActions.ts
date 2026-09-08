import type { PuckAction } from '@puckeditor/core';
import { canonicalBlockToPuck } from './puckBlockCodec';
import { assertEditorInsertion, editorItemLocations } from './puckEditorSelection';
import type { PuckEditorData } from './puckEditorTypes';

/** One replace transfers ownership and its original label/link in one Puck undo entry. */
export function enableCompositionActions(data: PuckEditorData, id: string, structureEnabled: boolean, childId: string): PuckAction {
  const location = editorItemLocations(data).find((entry) => entry.item.props.id === id);
  if (!structureEnabled || !location || (location.item.type !== 'Hero' && location.item.type !== 'ImageText') || location.item.props.actionsEnabled) {
    throw new Error('구조 편집이 가능한 Hero 또는 이미지 + 텍스트를 선택해 주세요.');
  }
  const item = location.item;
  const { primaryLabel, primaryUrl, elementStyles } = item.props;
  const hasButton = Boolean(primaryLabel || primaryUrl);
  const styles = { ...elementStyles };
  const buttonStyle = styles.primaryLabel;
  delete styles.primaryLabel;
  const child = canonicalBlockToPuck({ instance_id: childId, type: 'action.buttons-01', block_version: 1,
    props: { items: [{ label: primaryLabel, url: primaryUrl, variant: 'primary' }],
      alignment: item.type === 'Hero' ? item.props.alignment : 'left',
      ...(buttonStyle ? { appearance: { elements: { 'items.0.label': buttonStyle } } } : {}) } });
  // Validate the candidate slot using the same insertion rules as canvas and Outline.
  const candidate = structuredClone(data);
  const target = editorItemLocations(candidate).find((entry) => entry.item.props.id === id);
  if (!target || (target.item.type !== 'Hero' && target.item.type !== 'ImageText')) throw new Error('선택이 변경되었습니다.');
  target.item.props.actionsEnabled = true;
  if (hasButton) assertEditorInsertion(candidate, { zone: `${id}:actions`, index: 0 }, 'Buttons');
  return { type: 'replace', destinationIndex: location.selector.index, destinationZone: location.selector.zone,
    data: { ...item, props: { ...item.props, primaryLabel: '', primaryUrl: '', elementStyles: styles,
      actionsEnabled: true, actions: hasButton ? [child] : [] } },
    ui: { itemSelector: location.selector }, recordHistory: true };
}
