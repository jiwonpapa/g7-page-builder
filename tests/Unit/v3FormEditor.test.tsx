import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { formPresentation } from '../../resources/js/documents/v3/formPresentation';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { documentFromPuck, documentToPuck } from '../../resources/js/editor/v3/codec';
import { FormInspector } from '../../resources/js/editor/v3/FormInspector';
import { BindingInspector } from '../../resources/js/editor/v3/BindingInspector';
import { NodeRenderer, StructurePreview } from '../../resources/js/editor/v3/NodeRenderer';
import { hydrateTemplateRuntime, ensureSiteShellButtons } from '../../resources/js/public/publicHydration';
import { bootInquiryForms, disposeInquiryForms } from '../../resources/js/public/publicInquiryForms';
import type { DocumentV3 } from '../../resources/js/documents/v3/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
const { StructureEditor } = await import('../../resources/js/editor/v3/StructureEditor');
let root: Root | undefined;
afterEach(async () => { disposeInquiryForms(document); await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); document.head.querySelector('meta[name="csrf-token"]')?.remove(); });
const source = () => validateDocumentV3({ ...structuredClone(fixture), blocks: structuredClone(cases.form_binding.blocks) });
async function mount(element: React.ReactNode) {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element)); return host;
}
async function change(host: HTMLElement, name: string, value: string) {
  const input = host.querySelector<HTMLInputElement | HTMLSelectElement>('[aria-label="' + name + '"]');
  if (!input) throw new Error('Missing field ' + name);
  await act(async () => {
    Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(host: HTMLElement, title: string) {
  const button = [...host.querySelectorAll('button')].find(value => value.textContent === title);
  if (!button) throw new Error('Missing button ' + title);
  await act(async () => button.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
}
it('renders common controls with stable labels, fixed constraints and unchanged authored responsive styles', () => {
  const doc = source(), binding = doc.blocks[0].binding!, email = indexTree(doc).get(binding.fields[1].input_id)!.node;
  email.responsive.mobile = { font_size: { value: 24, unit: 'px' }, width: { value: 100, unit: '%' } };
  const before = JSON.stringify(doc);
  document.body.innerHTML = renderToStaticMarkup(<StructurePreview document={doc} viewport="mobile" />);
  expect(document.querySelector('form')?.style.display).toBe('contents');
  expect(document.querySelectorAll('input,textarea')).toHaveLength(6);
  for (const field of binding.fields) {
    const input = document.getElementById('node-' + field.input_id)!;
    expect(input.getAttribute('name')).toBe(field.name);
    expect(input.getAttribute('aria-labelledby')).toBe('node-' + field.label_id);
    expect(document.getElementById('node-' + field.label_id)?.getAttribute('for')).toBe(input.id);
  }
  const input = document.querySelector<HTMLInputElement>('input[name="email"]')!;
  expect(input.type).toBe('email'); expect(input.required).toBe(true); expect(input.maxLength).toBe(320);
  expect(input.style.fontSize).toBe('24px'); expect(input.style.width).toBe('100%');
  expect(document.querySelector<HTMLInputElement>('input[name="privacy"]')?.value).toBe('1');
  expect(document.querySelector('textarea')?.rows).toBe(6);
  expect(document.querySelector('button')?.type).toBe('button');
  expect(JSON.stringify(doc)).toBe(before);
});
it('keeps standalone controls accessible, leaves user values transient and blocks native input ownership while editing', () => {
  const doc = source(); delete doc.blocks[0].binding;
  const node = doc.blocks[0].slots.content![1], before = JSON.stringify(doc), projection = formPresentation(doc);
  document.body.innerHTML = renderToStaticMarkup(<NodeRenderer node={node} document={doc} {...projection} editing />);
  const input = document.querySelector('input')!;
  expect(input.getAttribute('aria-label')).toBe('name'); expect(input.name).toBe('');
  expect(input.readOnly).toBe(true); expect(input.tabIndex).toBe(-1);
  input.value = 'not a document field'; expect(JSON.stringify(doc)).toBe(before);
});
it('allows canvas selection events but cancels native checkbox activation only while editing', async () => {
  const doc = source(), node = indexTree(doc).get(doc.blocks[0].binding!.fields.find(field => field.name === 'privacy')!.input_id)!.node;
  const selected = vi.fn(), projection = formPresentation(doc);
  const host = await mount(<div onClick={selected}><NodeRenderer node={node} document={doc} {...projection} editing /></div>);
  const input = host.querySelector('input')!;
  await act(async () => input.click());
  expect(input.checked).toBe(false); expect(selected).toHaveBeenCalledTimes(1);
  await act(async () => root!.render(<NodeRenderer node={node} document={doc} {...projection} />));
  await act(async () => host.querySelector('input')!.click());
  expect(host.querySelector('input')!.checked).toBe(true);
});
it('round-trips plain label text through the existing Puck codec without interpreting markup or changing bindings', () => {
  const doc = source(), data = documentToPuck(doc), label = data.content[0].props.content[0];
  expect(label.type).toBe('Label'); label.props.body = '한글 <입력 안내>';
  const changed = documentFromPuck(data);
  expect(changed.blocks[0].slots.content![0].props).toEqual({ label: '한글 <입력 안내>' });
  expect(changed.blocks[0].binding).toEqual(doc.blocks[0].binding);
  expect(documentFromPuck(documentToPuck(changed))).toEqual(changed);
});
it('supports control drafts, kind selection, cancel, atomic validation errors and disabled submit', async () => {
  const doc = source(), node = doc.blocks[0].slots.content![3];
  if (node.type !== 'form.control') throw new Error('Expected input');
  const apply = vi.fn((command: Parameters<typeof executeDocumentCommand>[1]) => executeDocumentCommand(doc, command, () => ''));
  const host = await mount(<FormInspector node={node} disabled={false} apply={apply} />);
  await change(host, '입력 라벨 문구', '이메일 주소');
  await change(host, '입력 안내', 'name@example.com');
  await click(host, '입력 설정 적용');
  expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'content', id: node.instance_id, props: { ...node.props, label: '이메일 주소', placeholder: 'name@example.com' } });
  await change(host, '입력 종류', 'text'); await click(host, '입력 설정 적용');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('binding_control:');
  await click(host, '입력 설정 취소');
  expect(host.querySelector<HTMLInputElement>('[aria-label="입력 라벨 문구"]')?.value).toBe('email');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root!.render(<FormInspector node={node} disabled apply={apply} />));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(apply).toHaveBeenCalledTimes(2); expect(host.querySelector('fieldset')?.disabled).toBe(true);
});
it('edits a label through the same content command and cancels it with Escape', async () => {
  const node = source().blocks[0].slots.content![0]; if (node.type !== 'form.label') throw new Error('Expected label');
  const apply = vi.fn(), host = await mount(<FormInspector node={node} disabled={false} apply={apply} />);
  await change(host, '입력 라벨 문구', '작성자'); await click(host, '입력 설정 적용');
  expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'content', id: node.instance_id, props: { label: '작성자' } });
  await act(async () => host.querySelector('form')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
  expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('name');
});
it('edits fixed binding settings and disconnects without rewriting child elements', async () => {
  const doc = source(), node = doc.blocks[0], apply = vi.fn();
  const host = await mount(<BindingInspector node={node} document={doc} disabled={false} apply={apply} />);
  await change(host, '문의 분류', 'quote'); await change(host, '접수 완료 문구', '견적 요청 완료');
  await act(async () => host.querySelector<HTMLInputElement>('[aria-label="전화번호 포함"]')!.click());
  await click(host, '제출 연결 적용');
  expect(apply).toHaveBeenCalledWith({ kind: 'binding', id: node.instance_id, value: { ...node.binding,
    form_kind: 'quote', success_message: '견적 요청 완료', fields: node.binding!.fields.filter(field => field.name !== 'phone') } });
  await click(host, '제출 연결 취소'); await change(host, '제출 서비스', ''); await click(host, '제출 연결 적용');
  expect(apply).toHaveBeenLastCalledWith({ kind: 'binding', id: node.instance_id, value: null });
});
it('connects a container by selecting existing element IDs and shows atomic errors/readonly state', async () => {
  const doc = source(), original = structuredClone(doc.blocks[0].binding!); delete doc.blocks[0].binding;
  const node = doc.blocks[0], apply = vi.fn((command: Parameters<typeof executeDocumentCommand>[1]) => executeDocumentCommand(doc, command, () => ''));
  const host = await mount(<BindingInspector node={node} document={doc} disabled={false} apply={apply} />);
  await change(host, '제출 서비스', 'inquiry');
  const titles = { name: '이름', email: '이메일', message: '문의 내용', privacy: '개인정보 동의' };
  for (const [name, title] of Object.entries(titles)) {
    const field = original.fields.find(field => field.name === name)!;
    await change(host, title + ' 입력', field.input_id); await change(host, title + ' 라벨', field.label_id);
  }
  await change(host, '제출 버튼', original.submit_id); await change(host, '전송 상태 문구', original.status_id);
  await click(host, '제출 연결 적용');
  expect(apply.mock.results[0].value.document.blocks[0].binding.fields).toHaveLength(4);
  await change(host, '이메일 라벨', original.fields[0].label_id); await click(host, '제출 연결 적용');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('binding_duplicate:');
  await act(async () => root!.render(<BindingInspector node={node} document={doc} disabled apply={apply} />));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(apply).toHaveBeenCalledTimes(2);
});
it('uses the real editor single Undo and canonical save for binding edits', async () => {
  const doc = source(), changed = vi.fn<(value: DocumentV3) => void>();
  const save = vi.fn(async (request: { documentId: string; expectedRevision: number; json: string }) => ({ documentId: request.documentId, revision: 2 }));
  const host = await mount(<StructureEditor document={doc} sessionId="forms" serverRevision={1} drafts={{ save }}
    nextId={() => crypto.randomUUID()} iframeEnabled={false} onChange={changed} />);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="layer-' + doc.blocks[0].instance_id + '"]')!.click());
  await change(host, '제출 서비스', ''); await click(host, '제출 연결 적용');
  expect(changed.mock.calls.at(-1)![0].blocks[0].binding).toBeUndefined();
  // Unit tests load unpatched upstream Puck. Immediate Undo is verified against the built editor in E2E.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
  await click(host, '실행 취소'); expect(changed.mock.calls.at(-1)![0]).toEqual(doc);
  await click(host, '다시 실행'); await click(host, '저장');
  expect(JSON.parse(save.mock.calls[0][0].json).blocks[0].binding).toBeUndefined();
  expect(JSON.parse(save.mock.calls[0][0].json).blocks[0].slots).toEqual(doc.blocks[0].slots);
});

function markers() {
  document.head.insertAdjacentHTML('beforeend', '<meta name="csrf-token" content="test-token">');
  document.body.innerHTML = '<div data-g7pb-v3-public><div style="display:contents" data-g7pb-v3-inquiry data-g7pb-inquiry-host data-g7pb-inquiry-form data-block-id="form-owner" data-g7pb-form-action="/pages/precision/inquiries" data-g7pb-success-message="접수 완료">'
    + '<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="block_instance_id"></span><span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="started_at"></span>'
    + '<label id="field-label" for="field-id">이름</label><span id="field-id" data-v3-node="field" style="width:100%;font-size:24px" data-g7pb-v3-style="width font-size" aria-labelledby="field-label" data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="name" data-g7pb-control-maxlength="120" data-g7pb-control-required=""></span>'
    + '<span id="submit-id" data-v3-node="submit" data-g7pb-form-submit data-g7pb-form-control="button" data-g7pb-control-type="submit">전송</span><div data-g7pb-form-status></div></div></div>';
}
it('hydrates native form controls once, preserves identity/styles/labels and reuses the existing CSRF/snapshot/reset runtime', async () => {
  markers(); hydrateTemplateRuntime(document); ensureSiteShellButtons(document); hydrateTemplateRuntime(document);
  document.head.querySelector('meta[name="csrf-token"]')?.remove();
  const cookie = vi.spyOn(document, 'cookie', 'get').mockReturnValue('XSRF-TOKEN=test%2Btoken');
  const form = document.querySelector('form')!, input = document.querySelector<HTMLInputElement>('[name="name"]')!, submit = document.querySelector('button')!;
  expect(form.style.display).toBe('contents'); expect(input.id).toBe('field-id'); expect(input.style.fontSize).toBe('24px');
  expect(input.dataset.g7pbV3Style).toBe('width font-size'); expect(input.getAttribute('aria-labelledby')).toBe('field-label');
  expect(input.required).toBe(true); expect(input.maxLength).toBe(120); expect(submit.type).toBe('submit');
  expect(submit.id).toBe('submit-id'); expect(submit.hasAttribute('data-g7pb-form-submit')).toBe(true);
  input.value = '홍길동';
  const fetcher = vi.fn<typeof fetch>(async url => url === '/sanctum/csrf-cookie'
    ? new Response(null, { status: 204 }) : new Response('{}', { status: 201 }));
  bootInquiryForms(document, fetcher); bootInquiryForms(document, fetcher);
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(document.querySelector('[data-g7pb-form-status]')?.textContent).toBe('접수 완료'));
  const posts = fetcher.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts).toHaveLength(1);
  const [url, options] = posts[0]; expect(String(url)).toContain('/pages/precision/inquiries');
  expect(options?.headers).toEqual({ Accept: 'application/json', 'X-XSRF-TOKEN': 'test+token' });
  expect(options?.body).toBeInstanceOf(FormData);
  if (!(options?.body instanceof FormData)) throw new Error('Expected FormData');
  expect(options.body.get('name')).toBe('홍길동'); expect(options.body.get('block_instance_id')).toBe('form-owner'); expect(input.value).toBe('');
  cookie.mockRestore();
});
for (const context of ['preview', 'site-part']) it('does not activate submissions without a live page service: ' + context, () => {
  markers(); const surface = document.querySelector('[data-g7pb-v3-public]')!;
  surface.setAttribute(context === 'preview' ? 'data-testid' : 'data-g7pb-element-site-part', context === 'preview' ? 'page-builder-preview-root' : 'footer');
  hydrateTemplateRuntime(document); hydrateTemplateRuntime(document);
  expect(document.querySelector('form')).toBeNull(); expect(document.querySelector('[data-g7pb-inquiry-form]')).toBeNull();
  expect(document.querySelector('button')?.disabled).toBe(true);
  expect(document.querySelector('button')?.title).toContain(context === 'preview' ? '미리보기' : '공통영역');
  const fetcher = vi.fn<typeof fetch>(); bootInquiryForms(document, fetcher); document.querySelector('button')?.click();
  expect(fetcher).not.toHaveBeenCalled();
});
