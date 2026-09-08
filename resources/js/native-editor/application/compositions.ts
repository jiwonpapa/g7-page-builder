import { NATIVE_COMPOSITION_SCHEMA } from '../domain/composition';
import type { NativeHost, NativeMediaResult } from '../ports/host';
import type { NativeCompositionLibrary } from '../ports/compositions';

export async function saveComposition(host: NativeHost, library: NativeCompositionLibrary, title: string, signal: AbortSignal): Promise<NativeMediaResult<null>> {
  if (!host.compositions || host.context.readonly || host.context.editMode !== 'route' || !title.trim() || [...title.trim()].length > 120)
    return { ok: false, reason: '이름과 현재 선택의 편집 권한을 확인해 주세요.' };
  const result = await host.compositions.export(signal);
  if (!result.ok || signal.aborted) return { ok: false, reason: '이 선택은 저장할 수 없습니다. 출처·구조·자산을 확인해 주세요.' };
  const saved = await library.save(title.trim(), result.data, signal);
  return signal.aborted ? { ok: false, reason: '선택이 바뀌어 요청을 종료했습니다.' } : saved.ok ? { ok: true, data: null } : saved;
}
export async function insertSavedComposition(host: NativeHost, library: NativeCompositionLibrary, id: string, target: string, signal: AbortSignal, index?: number): Promise<NativeMediaResult<null>> {
  const slot = host.collections?.find(item => item.id === target && item.editable && item.kind !== 'array');
  if (!host.compositions || host.context.readonly || host.context.editMode !== 'route' || !slot)
    return { ok: false, reason: '삽입할 수 있는 위치를 먼저 선택해 주세요.' };
  const position = index ?? slot.items.length;
  if (!Number.isSafeInteger(position) || position < 0 || position > slot.items.length) return { ok: false, reason: '삽입 순서가 바뀌었습니다. 위치를 다시 선택해 주세요.' };
  const loaded = await library.read(id, signal);
  if (signal.aborted) return { ok: false, reason: '선택이 바뀌어 삽입하지 않았습니다.' };
  if (!loaded.ok) return loaded;
  if (loaded.data.schemaVersion !== NATIVE_COMPOSITION_SCHEMA) return { ok: false, reason: '지원하지 않는 조합 버전입니다.' };
  const result = await host.compositions.insert(loaded.data.snapshot, target, position, signal);
  return result.kind === 'applied' ? { ok: true, data: null }
    : { ok: false, reason: '삽입하지 않았습니다. 현재 템플릿·구성 요소·이미지·허용 위치를 확인해 주세요.' };
}
