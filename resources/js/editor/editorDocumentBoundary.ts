import type { PageBuilderDocument } from '../documents/types';
import { LayoutPolicyError } from '../documents/layoutPolicy';
import { puckToCanonical } from './puckBlockCodec';
import type { PuckAdapterContext } from './puckDocumentAdapter';
import type { PuckEditorData } from './puckEditorTypes';

export type EditorCandidate =
  | { accepted: true; document: PageBuilderDocument; changed: boolean }
  | { accepted: false; message: string };

export function sameEditorData(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

/** No candidate reaches the canonical owner before conversion and policy validation. */
export function assessEditorCandidate(
  candidate: PuckEditorData, accepted: PuckEditorData, context: PuckAdapterContext, canEdit: boolean,
): EditorCandidate {
  try {
    const document = puckToCanonical(candidate, context);
    const changed = !sameEditorData(document, puckToCanonical(accepted, context));
    if (changed && !canEdit) return { accepted: false, message: '읽기 전용에서는 문서를 변경할 수 없습니다. 이전 내용을 유지했습니다.' };
    return { accepted: true, document, changed };
  } catch (error) {
    const detail = error instanceof LayoutPolicyError
      ? ({ slot_limit: '한 구역의 블록 수', node_limit: '문서의 블록 수', depth_limit: '중첩 깊이',
        parent: '블록을 배치할 수 있는 위치', byte_limit: '문서 크기' }[error.code] ?? '문서 구조')
      : '문서 형식';
    return { accepted: false, message: `${detail} 제한에 맞지 않아 변경하지 않았습니다. 이전 내용과 선택을 유지했습니다.` };
  }
}

/** Keep the original past/future; retain a valid edit still awaiting Puck's debounce. */
export function historyAfterRejectedCommand<T extends { state: { data?: unknown } }>(
  original: T[], index: number, recovered: T,
): { histories: T[]; index: number } {
  if (sameEditorData(original[index]?.state.data, recovered.state.data)) return { histories: original, index };
  const histories = [...original.slice(0, index + 1), recovered];
  return { histories, index: histories.length - 1 };
}
