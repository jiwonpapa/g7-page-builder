import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NativeMediaRequest } from '../../resources/js/native-editor/application/mediaRequest';
import { readNativeMedia } from '../../resources/js/adapters/gnuboard7/media';
import { NativeMediaPanel } from '../../resources/js/native-editor/ui/media';
import type { NativeContext, NativeHost } from '../../resources/js/native-editor/ports/host';
import type { NativeField } from '../../resources/js/native-editor/domain/fields';
const context: NativeContext = { templateIdentifier: 'theme', layoutName: 'page', editMode: 'route', sessionId: 'one', revision: 1, lockVersion: 1, readonly: false, nodeId: 'img', path: [0] };
const asset = { id: 2, layout_name: 'page', original_name: 'photo.png', url: '/photo.png', mime_type: 'image/png' };
const field: NativeField = { id: 'imgSrc', label: '이미지', kind: 'image', group: 'content', value: '/before.png', options: [], editable: true, custom: false, source: 'template-spec' };
it('passes context and cancellation to the official host media API and parses assets', async () => {
  const input = { list: vi.fn().mockResolvedValue({ ok: true, data: [asset] }), upload: vi.fn().mockResolvedValue({ ok: true, data: asset }) };
  const media = readNativeMedia(input, context)!; const controller = new AbortController(); const file = new File(['x'], 'photo.png');
  const result = await media.list('template', controller.signal);
  expect(input.list).toHaveBeenCalledWith({ expected: context, scope: 'template', signal: controller.signal });
  expect(result).toEqual({ ok: true, data: [{ id: 2, name: 'photo.png', url: '/photo.png', layoutName: 'page' }] });
  expect((await media.upload(file, controller.signal)).ok).toBe(true);
  expect(input.upload).toHaveBeenCalledWith({ expected: context, file, signal: controller.signal });
  expect(readNativeMedia(input, { ...context, readonly: true })).toBeNull();
});
it.each(['javascript:x', '//untrusted.test/a', '/bad\\path', 'data:image/png,x'])('rejects invalid media response URL %s', url => {
  const api = readNativeMedia({ list: async () => ({ ok: true, data: [{ ...asset, url }] }), upload: vi.fn() }, context)!;
  return expect(api.list('page', new AbortController().signal)).resolves.toMatchObject({ ok: false });
});
it('returns upload failure and drops late results after cancellation', async () => {
  const api = readNativeMedia({ list: vi.fn(), upload: async () => { throw Error('offline'); } }, context)!;
  expect((await api.upload(new File([], 'x'), new AbortController().signal)).ok).toBe(false);
  const pending = new NativeMediaRequest(); let finish!: (value: number) => void;
  const first = pending.run(() => new Promise<number>(resolve => { finish = resolve; }));
  pending.cancel(); finish(1); expect(await first).toBeNull();
  const next = pending.run(() => new Promise<number>(resolve => { finish = resolve; }));
  expect(await pending.run(async () => 3)).toBe(3); finish(2); expect(await next).toBeNull();
});
it('does not select an uploaded image automatically and closes without applying cancelled uploads', async () => {
  const input = { list: vi.fn().mockResolvedValue({ ok: true, data: [] }), upload: vi.fn().mockResolvedValue({ ok: true, data: asset }) };
  const applyField = vi.fn(() => ({ kind: 'applied' as const }));
  const host: NativeHost = { context, node: { id: 'img', name: 'Img', type: 'basic' }, fields: [field], media: readNativeMedia(input, context), applyField, applyText: vi.fn() };
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
  const click = async (text: string): Promise<void> => { const button = [...element.querySelectorAll('button')].find(b => b.textContent === text)!; await act(async () => button.click()); };
  async function upload(): Promise<void> {
    const fileInput = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [new File(['x'], 'photo.png')] });
    await act(async () => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
  }
  try {
    await act(() => root.render(<NativeMediaPanel host={host} field={field} />));
    await click('이미지 선택·업로드'); await upload();
    expect(element.textContent).toContain('업로드했습니다'); expect(applyField).not.toHaveBeenCalled();
    await click('선택'); expect(applyField).toHaveBeenCalledWith('imgSrc', '/photo.png'); applyField.mockClear();
    await click('이미지 선택·업로드');
    let finish!: (value: unknown) => void;
    input.upload.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await upload(); await click('취소·닫기');
    await act(async () => finish({ ok: true, data: asset }));
    expect(applyField).not.toHaveBeenCalled(); expect(element.textContent).not.toContain('photo.png');
  } finally { await act(() => root.unmount()); element.remove(); }
});

it('uses portable paths for same-origin attachments without laundering other origins or credentials', async () => {
  const values = [location.origin + '/storage/space%20name.png?v=2#image', 'https://cdn.example.test/image.png',
    location.origin + '//outside.test/image.png', 'https://user:pass@cdn.example.test/image.png'];
  const media = readNativeMedia({ list: async () => ({ ok: true, data: values.map((url, id) => ({ ...asset, id, url })) }), upload: vi.fn() }, context)!;
  const result = await media.list('page', new AbortController().signal);
  expect(result.ok && result.data.map(item => item.url)).toEqual(['/storage/space%20name.png?v=2#image', ...values.slice(1)]);
});
