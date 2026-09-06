import React, { useEffect, useId, useState } from 'react';
import type { Field } from '@puckeditor/core';
import { loadRouteTargetOptions, type RouteTargetOption } from './RouteUrlField';

function BoardSourceField({ value, onChange, readOnly }: {
  value?: string; onChange: (value: string) => void; readOnly?: boolean;
}): React.ReactElement {
  const id = useId();
  const [options, setOptions] = useState<RouteTargetOption[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setState('loading');
    void loadRouteTargetOptions('board').then((items) => {
      if (!current) return;
      setOptions(items.filter(item => /^[a-z0-9][a-z0-9_-]{0,79}$/.test(item.value)));
      setState('ready');
    }).catch(() => { if (current) setState('error'); });
    return () => { current = false; };
  }, [attempt]);
  const missing = Boolean(value) && !options.some(option => option.value === value);
  return <div className="g7pb-route-field">
    <label htmlFor={id}>연결 게시판</label>
    <select id={id} className="g7pb-field-control" value={value ?? ''} onChange={event => onChange(event.target.value)}
      disabled={readOnly || state !== 'ready' || options.length === 0} aria-describedby={`${id}-status`}>
      <option value="">게시판을 선택해 주세요</option>
      {missing && <option value={value}>저장된 게시판 · {value}</option>}
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <p id={`${id}-status`} role="status">{state === 'loading' ? '게시판을 불러오는 중입니다.'
      : state === 'error' ? '게시판을 불러오지 못했습니다. G7 게시판 기능과 접근 권한을 확인해 주세요.'
        : options.length === 0 ? '선택할 수 있는 게시판이 없습니다.'
          : missing ? '저장된 게시판을 찾을 수 없습니다. 연결할 게시판을 다시 선택해 주세요.'
            : '선택한 게시판의 최신 글을 표시합니다. 실제 공개 여부는 G7 게시판 권한을 따릅니다.'}</p>
    {state !== 'loading' && <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setAttempt(value => value + 1)}>목록 새로고침</button>}
  </div>;
}

export function createG7BoardSourceField(): Field<string | undefined> {
  return { type: 'custom', label: '연결 게시판', render: ({ value, onChange, readOnly }) =>
    <BoardSourceField value={value} onChange={onChange} readOnly={readOnly} /> };
}
