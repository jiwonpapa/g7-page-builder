import { NATIVE_COMPOSITION_SCHEMA, object, readCompositionSummary, readSavedComposition } from '../../native-editor/domain/composition';
import type { NativeCompositionLibrary } from '../../native-editor/ports/compositions';
import type { NativeMediaResult } from '../../native-editor/ports/host';

const endpoint = '/api/modules/jiwonpapa-page_builder/admin/native-compositions';
/** G7's observed Sanctum browser transport; no private G7 import or page document API. */
export function compositionLibrary(): NativeCompositionLibrary {
  const token = (): string | null => { try { return localStorage.getItem('auth_token'); } catch { return null; } };
  async function request<T>(path: string, signal: AbortSignal, parse: (value: unknown) => T | null, method = 'GET', data?: object): Promise<NativeMediaResult<T>> {
    const auth = token();
    if (!auth || signal.aborted) return { ok: false, reason: '관리자 로그인이 필요합니다.' };
    try {
      const response = await fetch(endpoint + path, { method, signal, credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth },
        ...(data ? { body: JSON.stringify(data) } : {}) });
      const body: unknown = await response.json();
      if (signal.aborted || token() !== auth) return { ok: false, reason: '로그인 또는 선택이 바뀌었습니다.' };
      if (!response.ok || !object(body) || body.success !== true) return { ok: false, reason:
        response.status === 401 ? '관리자 로그인이 필요합니다.' : response.status === 403 ? '조합 관리 권한이 없습니다.'
          : response.status === 404 ? '조합이 없거나 접근할 수 없습니다.' : '조합 요청을 완료하지 못했습니다. 다시 시도해 주세요.' };
      const value = parse(body.data);
      return value === null ? { ok: false, reason: '조합 응답 형식이 올바르지 않습니다.' } : { ok: true, data: value };
    } catch { return { ok: false, reason: '조합 요청이 중단됐습니다. 다시 시도해 주세요.' }; }
  }
  return {
    page: (page, signal) => request('?page=' + page, signal, value => {
      if (!object(value) || !Array.isArray(value.items) || value.items.length > 30 || typeof value.has_more !== 'boolean') return null;
      const items = value.items.map(readCompositionSummary);
      return items.some(item => item === null) ? null : { items: items.filter(item => item !== null), hasMore: value.has_more };
    }),
    read: (id, signal) => request('/' + encodeURIComponent(id), signal, value => {
      const item = readSavedComposition(value); return item?.id === id ? item : null;
    }),
    save: (title, snapshot, signal) => request('', signal, readCompositionSummary, 'POST', { title, snapshot, schema_version: NATIVE_COMPOSITION_SCHEMA }),
    async delete(id, signal) {
      const result = await request('/' + encodeURIComponent(id), signal, value => object(value) && value.id === id ? true : null, 'DELETE');
      return result.ok ? { ok: true, data: null } : result;
    },
  };
}

