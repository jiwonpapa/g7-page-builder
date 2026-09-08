import { NativeContent } from './content';
import { NativeStructure } from './collection';
import React, { useEffect, useRef, useState } from 'react';
import { prepareNativeTextChange } from '../domain/textChange';
import type { NativeHost } from '../ports/host';
import type { NativeCompositionPanelProps } from '../ports/compositions';

export function NativeTextPanel({ host, loadCompositions }: { host: NativeHost | null;
  loadCompositions?: () => Promise<React.ComponentType<NativeCompositionPanelProps>> }): React.ReactElement {
  const [Library, setLibrary] = useState<React.ComponentType<NativeCompositionPanelProps> | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false); const [libraryError, setLibraryError] = useState('');
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
  return <div className="g7pb-native-form">
    <p className="g7pb-native-note">{host.context.layoutName} · {host.node.name}</p>
    {typeof host.node.text === 'string' && <form onSubmit={event => {
    event.preventDefault();
    const result = host.applyText(value);
    setMessage(result.kind === 'refused' ? '선택 항목이 바뀌었거나 편집할 수 없습니다. 다시 선택해 주세요.'
      : result.kind === 'applied' ? '적용했습니다. 상단 저장으로 반영하세요.' : '변경 사항이 없습니다.');
  }}>
    <label>문구<textarea aria-label="페이지 빌더 문구" value={value} disabled={!supported}
      onChange={event => setValue(event.target.value)} /></label>
    <button type="submit" disabled={!supported || value === text}>문구 적용</button>
    {!supported && <p className="g7pb-native-note">이 항목은 현재 문구 편집을 지원하지 않습니다.</p>}
    <p role="status">{message}</p>
  </form>}
    <NativeContent host={host} />
    <NativeStructure host={host} />
    {loadCompositions && <button type="button" disabled={loadingLibrary} aria-expanded={libraryOpen} onClick={() => {
      if (Library) { setLibraryOpen(value => !value); return; }
      setLoadingLibrary(true); setLibraryError('');
      void loadCompositions().then(component => {
        if (alive.current) { setLibrary(() => component); setLibraryOpen(true); }
      }).catch(() => { if (alive.current) setLibraryError('내 조합을 불러오지 못했습니다. 다시 눌러 주세요.'); })
        .finally(() => { if (alive.current) setLoadingLibrary(false); });
    }}>{loadingLibrary ? '내 조합 불러오는 중' : '내 조합 열기'}</button>}
    {libraryError && <p role="status">{libraryError}</p>}
    {Library && libraryOpen && <Library host={host} />}
    <p className="g7pb-native-note">상단 저장 시 공개 페이지에 반영됩니다.</p>
  </div>;
}
