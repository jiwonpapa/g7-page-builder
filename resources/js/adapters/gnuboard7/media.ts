import type { NativeAsset, NativeContext, NativeMedia, NativeMediaResult } from '../../native-editor/ports/host';
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function localAssetUrl(value: string): string | null {
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    // G7's layout validator accepts local paths. Never strip a foreign origin, credentials, or a network-path prefix.
    return typeof location !== 'undefined' && url.origin === location.origin && !url.username && !url.password && !url.pathname.startsWith('//')
      ? url.pathname + url.search + url.hash : value;
  } catch { return null; }
}
function readAsset(input: unknown): NativeAsset | null {
  if (!record(input) || typeof input.id !== 'string' && typeof input.id !== 'number'
    || typeof input.original_name !== 'string' || typeof input.url !== 'string'
    || input.layout_name !== null && typeof input.layout_name !== 'string'
    || typeof input.mime_type !== 'string' || !input.mime_type.startsWith('image/')
    || !/^https?:\/\//i.test(input.url) && (!input.url.startsWith('/') || input.url.startsWith('//'))
    || /[\u0000-\u0020\u007f\\]/.test(input.url)) return null;
  const url = localAssetUrl(input.url);
  if (url === null) return null;
  return Object.freeze({ id: input.id, name: input.original_name, layoutName: input.layout_name, url });
}
export function readNativeMedia(input: unknown, expected: NativeContext): NativeMedia | null {
  if (!record(input) || typeof input.list !== 'function' || typeof input.upload !== 'function' || expected.readonly) return null;
  const { list, upload } = input;
  async function request<T>(call: () => unknown, signal: AbortSignal, parse: (v: unknown) => T | null): Promise<NativeMediaResult<T>> {
    if (signal.aborted) return { ok: false, reason: 'cancelled' };
    try {
      const response: unknown = await call();
      if (signal.aborted) return { ok: false, reason: 'cancelled' };
      if (record(response) && response.ok === true) {
        const data = parse(response.data);
        if (data !== null) return { ok: true, data };
      }
      return { ok: false, reason: '이미지를 불러오지 못했습니다. 권한과 연결을 확인해 주세요.' };
    } catch { return { ok: false, reason: '이미지 요청에 실패했습니다. 다시 시도해 주세요.' }; }
  }
  return {
    list(scope, signal) { return request(() => list({ expected, scope, signal }), signal, value => {
      if (!Array.isArray(value)) return null;
      const items = value.map(readAsset);
      return items.every((item): item is NativeAsset => item !== null) ? items : null;
    }); },
    upload(file, signal) { return request(() => upload({ expected, file, signal }), signal, readAsset); },
  };
}
