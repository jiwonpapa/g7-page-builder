import { NativeContent } from './content';
import { NativeStructure } from './collection';
import React, { useEffect, useRef, useState } from 'react';
import { prepareNativeTextChange } from '../domain/textChange';
import type { NativeHost } from '../ports/host';
import type { NativeCompositionPanelProps } from '../ports/compositions';
import { Choice } from './Choice';

export function NativeTextPanel({ host, loadCompositions }: { host: NativeHost | null;
  loadCompositions?: () => Promise<React.ComponentType<NativeCompositionPanelProps>> }): React.ReactElement {
  const [Library, setLibrary] = useState<React.ComponentType<NativeCompositionPanelProps> | null>(null);
  const [mode, setMode] = useState('detail'); const [libraryError, setLibraryError] = useState('');
  const [loadingLibrary, setLoadingLibrary] = useState(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const text = typeof host?.node.text === 'string' ? host.node.text : '';
  const [value, setValue] = useState(text);
  const [message, setMessage] = useState('');
  const key = host ? JSON.stringify(host.context) : '';
  useEffect(() => { setValue(text); setMessage(''); }, [key, text]);
  if (!host) return <p className="g7pb-native-note">페이지에서 편집할 항목을 선택해 주세요.</p>;
  const supported = !host.context.readonly && host.context.editMode === 'route'
    && prepareNativeTextChange(host.node, text, text).status === 'unchanged';
  function openLibrary(): void {
    if (Library || loadingLibrary || !loadCompositions) return;
    setLoadingLibrary(true); setLibraryError('');
    void loadCompositions().then(component => {
      if (alive.current) setLibrary(() => component);
    }).catch(() => { if (alive.current) setLibraryError('내 조합을 불러오지 못했습니다. 다시 시도해 주세요.'); })
      .finally(() => { if (alive.current) setLoadingLibrary(false); });
  }
  return <div className="g7pb-native-form">
    <p className="g7pb-native-note">선택 항목: <strong>{host.node.name}</strong>{host.context.readonly ? ' · 읽기 전용' : ''}</p>
    <Choice label="편집 도구" value={mode} options={[
      { value: 'detail', label: '상세 편집' }, { value: 'structure', label: '삽입·구성' }, { value: 'library', label: '내 조합' },
    ]} onChange={value => { if (typeof value === 'string') { setMode(value); if (value === 'library') openLibrary(); } }} />
    {mode === 'detail' && <section aria-label="선택 항목 상세 편집">
    {typeof host.node.text === 'string' && <form onSubmit={event => {
    event.preventDefault();
    const result = host.applyText(value);
    setMessage(result.kind === 'refused' ? '선택 항목이 바뀌었거나 편집할 수 없습니다. 다시 선택해 주세요.'
      : result.kind === 'applied' ? '적용했습니다. 상단 저장으로 반영하세요.' : '변경 사항이 없습니다.');
  }}>
    <label>문구<textarea aria-label="페이지 빌더 문구" value={value} disabled={!supported}
      onChange={event => setValue(event.target.value)} /></label>
    <button type="submit" disabled={!supported || value === text}>문구 적용</button>
    <button type="button" disabled={value === text} onClick={() => { setValue(text); setMessage('입력을 취소했습니다.'); }}>문구 입력 취소</button>
    {!supported && <p className="g7pb-native-note">이 항목은 현재 문구 편집을 지원하지 않습니다.</p>}
    <p role="status">{message}</p>
  </form>}
    <NativeContent host={host} />
    {typeof host.node.text !== 'string' && !host.fields.length && <p className="g7pb-native-note">이 항목의 상세 필드가 제공되지 않았습니다. 삽입·구성에서 허용된 내부 구성을 확인하세요.</p>}
    </section>}
    {mode === 'structure' && <NativeStructure host={host} />}
    {mode === 'library' && <>
      {!loadCompositions && <p role="status">이 환경에서는 내 조합을 제공하지 않습니다.</p>}
      {loadingLibrary && <p role="status">내 조합 불러오는 중</p>}
      {libraryError && <div><p role="status">{libraryError}</p><button type="button" onClick={openLibrary}>내 조합 다시 시도</button></div>}
      {Library && <Library host={host} />}
    </>}
    <details className="g7pb-native-guide"><summary>상단 저장 시 공개 페이지에 반영됩니다</summary>
      <p>여기서 적용한 변경은 저장 전 편집 내용입니다. G7 상단의 페이지 설정에서 페이지 이름을, 왼쪽 페이지 목록에서 주소를 확인하세요.</p>
      <p>미리보기로 확인한 뒤 상단 저장을 누르면 공개 페이지에 반영됩니다. 적용한 변경은 상단 실행 취소로 되돌릴 수 있습니다.</p>
    </details>
  </div>;
}
