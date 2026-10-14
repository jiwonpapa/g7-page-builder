import React from 'react';
import type { DataControls, DataControlRole, DocumentV3 } from '../../documents/v3/types';
import { dataControlCandidates, dataControlRoles } from '../../documents/v3/dataControls';
import schema from '../../../../schemas/page-builder-document-v3.schema.json';

const labels: Record<DataControlRole, string> = { search_id: '검색 입력', filter_id: '분류 필터 입력', previous_id: '이전 페이지 버튼', next_id: '다음 페이지 버튼', status_id: '현재 페이지 텍스트' };
export function DataControlsInspector({ document, value, change }: { document: DocumentV3; value?: DataControls; change: (value: DataControls | undefined) => void }) {
  const current = value ?? { page_size: 3 }, rule = schema.$defs.data_controls.properties.page_size;
  return <fieldset><legend>목록 조작 요소 연결</legend>
    <p>목록 원형 밖의 일반 텍스트 입력·버튼·본문을 선택합니다. 요소의 배치·문구·스타일은 공통 편집을 사용합니다.</p>
    {dataControlRoles.map(role => <label key={role}>{labels[role]}<select value={current[role] ?? ''} onChange={event => {
      const next = { ...current };
      if (event.target.value) next[role] = event.target.value; else delete next[role];
      change(dataControlRoles.some(key => next[key]) ? next : undefined);
    }}><option value="">연결하지 않음</option>{dataControlCandidates(document, role).map(node => <option key={node.instance_id} value={node.instance_id}>{node.name} · {node.instance_id.slice(-6)}</option>)}</select></label>)}
    <label>페이지당 항목 수<input type="number" min={rule.minimum} max={rule.maximum} step="1" disabled={!value} value={current.page_size}
      onChange={event => change({ ...current, page_size: Number(event.target.value) })} /></label>
    <p>페이지 조작은 이전·다음·현재 페이지 세 요소를 모두 연결합니다. 검색과 분류 필터는 불러온 목록 안에서 동작하며 필터 입력에는 사용 가능한 분류를 제안합니다. 연결한 요소는 함께 묶어 복제·저장해 주세요.</p>
  </fieldset>;
}
