import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootInquiryForms } from '../../resources/js/public/pageEffects';
import { disposeInquiryForms } from '../../resources/js/public/publicInquiryForms';
import { bootPageEffects, disposePageEffects, observePageEffects } from '../../resources/js/public/publicRuntime';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
const documents = new Set<Document>();
afterEach(() => { documents.forEach(disposeInquiryForms); documents.clear(); });

function fixture() {
  const root = document.implementation.createHTMLDocument('inquiry lifecycle'); documents.add(root);
  root.head.innerHTML = '<meta name="csrf-token" content="fixture-csrf">';
  root.body.innerHTML = '<section data-block-id="fixture-block"><form data-g7pb-inquiry-form action="https://example.test/inquiries"><input name="block_instance_id" type="hidden"><input name="started_at" type="hidden"><input name="name"><textarea name="message"></textarea><button type="submit">Send</button><p data-g7pb-form-status></p></form></section>';
  const form = root.querySelector('form')!;
  return { root, form, name: form.querySelector<HTMLInputElement>('input[name="name"]')!, message: form.querySelector('textarea')!,
    submit: form.querySelector('button')!, status: form.querySelector<HTMLElement>('[data-g7pb-form-status]')! };
}
const submitForm = (form: HTMLFormElement) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

function sessionFetcher(root: Document, post: () => Promise<Response>) {
  vi.spyOn(root, 'cookie', 'get').mockReturnValue('XSRF-TOKEN=fixture%2Bcsrf');
  return vi.fn<typeof fetch>(async url => url === '/sanctum/csrf-cookie' ? new Response(null, { status: 204 }) : post());
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

describe('public inquiry input lifetime', () => {
  it.each(['synchronous', 'observer-first'])('hands unsent input to an identical %s rendering only once', async schedule => {
    const { root, form, name, message } = fixture(); const markup = root.body.innerHTML;
    const fetcher = vi.fn<typeof fetch>(); bootInquiryForms(root, fetcher);
    name.value = 'Unsent visitor'; message.value = '두 줄\n문의';
    root.body.innerHTML = markup;
    if (schedule === 'observer-first') await Promise.resolve();
    bootInquiryForms(root, fetcher);
    const next = root.querySelector('form')!;
    expect(next).not.toBe(form);
    expect(next.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('Unsent visitor');
    expect(next.querySelector('textarea')!.value).toBe('두 줄\n문의');
    expect(next.elements.namedItem('started_at')).toHaveProperty('value', expect.stringMatching(/^\d+$/u));
    next.reset(); root.body.innerHTML = markup; bootInquiryForms(root, fetcher);
    expect(root.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['later-turn', 'dispose', 'action', 'owner', 'source', 'duplicates'])('does not transfer input across the %s boundary', async boundary => {
    const { root, name } = fixture(); const markup = root.body.innerHTML;
    const fetcher = vi.fn<typeof fetch>(); bootInquiryForms(root, fetcher); name.value = 'Private unsent content';
    if (boundary === 'dispose') disposeInquiryForms(root);
    root.body.innerHTML = boundary === 'later-turn' ? '' : markup;
    if (boundary === 'later-turn') {
      await new Promise(resolve => setTimeout(resolve, 10)); root.body.innerHTML = markup;
    }
    if (boundary === 'action') root.querySelector('form')!.action = 'https://example.test/other';
    if (boundary === 'owner') root.querySelector('section')!.dataset.blockId = 'another';
    if (boundary === 'source') root.querySelector('button')!.textContent = 'Changed source';
    if (boundary === 'duplicates') root.body.insertAdjacentHTML('beforeend', markup);
    bootInquiryForms(root, fetcher);
    for (const control of root.querySelectorAll<HTMLInputElement>('[name="name"]')) expect(control.value).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never transfers or retries a pending submission into a replacement form', async () => {
    const { root, form, name } = fixture(); const markup = root.body.innerHTML;
    const pending = deferred<Response>(); const fetcher = sessionFetcher(root, () => pending.promise);
    bootInquiryForms(root, fetcher); name.value = 'Already submitted'; submitForm(form);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    root.body.innerHTML = markup; bootInquiryForms(root, fetcher);
    pending.resolve(new Response('{}')); await pending.promise; await Promise.resolve();
    expect(root.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('');
    expect(root.querySelector('[data-g7pb-form-status]')!.textContent).toBe('');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('preserves typed text and privacy through actual React replacement and public hydration', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement('div'); document.body.append(container);
    const react = createRoot(container); const fetcher = vi.fn<typeof fetch>();
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(fetcher);
    const markup = '<div data-block-id="owned" data-g7pb-inquiry-host data-g7pb-inquiry-form data-g7pb-form-action="/pages/owned/inquiries">'
      + '<span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="name"></span>'
      + '<span data-g7pb-form-control="input" data-g7pb-control-type="checkbox" data-g7pb-control-name="privacy"></span>'
      + '<span data-g7pb-form-control="button" data-g7pb-control-type="submit">Send</span><p data-g7pb-form-status></p></div>';
    const render = () => act(async () => react.render(createElement('div', { dangerouslySetInnerHTML: { __html: markup } })));
    try {
      await render(); bootPageEffects(document, window); observePageEffects(document, window);
      const before = document.querySelector('form')!;
      (before.elements.namedItem('name') as HTMLInputElement).value = '실제 입력';
      (before.elements.namedItem('privacy') as HTMLInputElement).checked = true;
      await render();
      const after = document.querySelector('form')!;
      expect(after).not.toBe(before);
      expect((after.elements.namedItem('name') as HTMLInputElement).value).toBe('실제 입력');
      expect((after.elements.namedItem('privacy') as HTMLInputElement).checked).toBe(true);
      expect(fetcher).not.toHaveBeenCalled();
      const priorUrl = location.href;
      try {
        history.replaceState(null, '', '/different-page'); await render();
        expect(document.querySelector<HTMLInputElement>('[name="name"]')!.value).toBe('');
      } finally { history.replaceState(null, '', priorUrl); }
    } finally { disposePageEffects(document); await act(async () => react.unmount()); container.remove(); fetchSpy.mockRestore(); }
  });

  it('keeps edits made after the submitted snapshot when its response succeeds', async () => {
    const root = document.implementation.createHTMLDocument('inquiry');
    documents.add(root);
    root.head.innerHTML = '<meta name="csrf-token" content="fixture-csrf">';
    root.body.innerHTML = '<section data-block-id="fixture-block"><form data-g7pb-inquiry-form action="https://example.test/inquiries"><input name="block_instance_id" type="hidden"><input name="started_at" type="hidden"><input name="name"><textarea name="message"></textarea><button type="submit">Send</button><p data-g7pb-form-status></p></form></section>';
    const form = root.querySelector('form')!; const input = form.querySelector('input[name="name"]')!;
    const message = form.querySelector('textarea')!; const submit = form.querySelector('button')!;
    const pending = deferred<Response>();
    const fetcher = sessionFetcher(root, () => pending.promise);
    bootInquiryForms(root, fetcher);
    input.setAttribute('value', '');
    const name = form.elements.namedItem('name');
    if (!(name instanceof HTMLInputElement)) throw new Error('name control missing');
    name.value = 'A'; message.value = 'Submitted A';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    name.value = 'B'; name.dispatchEvent(new Event('input', { bubbles: true }));
    message.value = 'New B'; message.dispatchEvent(new Event('input', { bubbles: true }));
    pending.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(name.value).toBe('B'); expect(message.value).toBe('New B');
  });

  it('keeps the native FormData request and resets unchanged input with reusable hidden ownership values', async () => {
    const { root, form, name, message, submit } = fixture();
    const fetcher = sessionFetcher(root, async () => new Response('{}'));
    bootInquiryForms(root, fetcher); bootInquiryForms(root, fetcher);
    name.value = 'A'; message.value = 'Body A'; submitForm(form);
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toBe('https://example.test/inquiries');
    expect(options?.method).toBe('POST'); expect(options?.credentials).toBe('same-origin');
    expect(options?.headers).toEqual({ Accept: 'application/json', 'X-XSRF-TOKEN': 'fixture+csrf' });
    if (!(options?.body instanceof FormData)) throw new Error('native FormData required');
    expect(Object.fromEntries(options.body)).toEqual({ name: 'A', message: 'Body A', block_instance_id: 'fixture-block', started_at: expect.stringMatching(/^\d+$/u) });
    expect(name.value).toBe(''); expect(message.value).toBe('');
    expect(new FormData(form).get('block_instance_id')).toBe('fixture-block');
    expect(new FormData(form).get('started_at')).toMatch(/^\d+$/u);
  });

  it('initializes a missing G7 session and sends the decoded XSRF cookie', async () => {
    const { root, form, submit } = fixture(); root.head.innerHTML = '';
    let cookie = ''; vi.spyOn(root, 'cookie', 'get').mockImplementation(() => cookie);
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
      cookie = 'other=value; XSRF-TOKEN=encrypted%2Btoken%3D'; return new Response(null, { status: 204 });
    }).mockResolvedValue(new Response('{}'));
    bootInquiryForms(root, fetcher); submitForm(form);
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/sanctum/csrf-cookie', 'https://example.test/inquiries']);
    expect(fetcher.mock.calls[0][1]?.credentials).toBe('same-origin');
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Accept: 'application/json', 'X-XSRF-TOKEN': 'encrypted+token=' });
  });

  it('refreshes a retired session even when stale meta and cookie tokens remain', async () => {
    const { root, form, submit } = fixture();
    let cookie = 'XSRF-TOKEN=old'; vi.spyOn(root, 'cookie', 'get').mockImplementation(() => cookie);
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
      cookie = 'XSRF-TOKEN=current%3D'; return new Response(null, { status: 204 });
    }).mockResolvedValue(new Response('{}'));
    bootInquiryForms(root, fetcher); submitForm(form);
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/sanctum/csrf-cookie', 'https://example.test/inquiries']);
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Accept: 'application/json', 'X-XSRF-TOKEN': 'current=' });
    expect(root.querySelector('meta')?.content).toBe('fixture-csrf');
  });

  it.each(['missing', 'malformed', 'failure'])('keeps entered content when session setup has a %s token', async failure => {
    const { root, form, name, submit, status } = fixture();
    vi.spyOn(root, 'cookie', 'get').mockReturnValue(failure === 'malformed' ? 'XSRF-TOKEN=%E0%A4%A' : '');
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: failure === 'failure' ? 503 : 204 }));
    bootInquiryForms(root, fetcher); name.value = 'Keep my request'; submitForm(form);
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(name.value).toBe('Keep my request'); expect(status.textContent).toContain('접수 준비에 실패');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toBe('/sanctum/csrf-cookie');
  });

  it('does not submit a form disposed while its session request is pending', async () => {
    const { root, form } = fixture(); root.head.innerHTML = '';
    let cookie = ''; vi.spyOn(root, 'cookie', 'get').mockImplementation(() => cookie);
    const pending = deferred<Response>(); const fetcher = vi.fn<typeof fetch>(() => pending.promise);
    bootInquiryForms(root, fetcher); submitForm(form); disposeInquiryForms(root);
    cookie = 'XSRF-TOKEN=new'; pending.resolve(new Response(null, { status: 204 }));
    await pending.promise; await Promise.resolve(); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([200, 503])('does not let the disposed response %s reset or finish a reinstalled form request', async statusCode => {
    const { root, form, name, status, submit } = fixture();
    const old = deferred<Response>(); const next = deferred<Response>();
    const post = vi.fn<() => Promise<Response>>().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => next.promise);
    const fetcher = sessionFetcher(root, post);
    bootInquiryForms(root, fetcher); name.value = 'First'; submitForm(form);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    disposeInquiryForms(root); bootInquiryForms(root, fetcher);
    name.value = 'Second'; submitForm(form);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    old.resolve(new Response(JSON.stringify({ message: 'old error' }), { status: statusCode }));
    await old.promise;
    expect(name.value).toBe('Second'); expect(status.textContent).toBe('전송 중입니다…'); expect(submit.disabled).toBe(true);
    next.resolve(new Response('{}')); await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(name.value).toBe(''); expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it.each(['marker', 'submit-type', 'action', 'input', 'remove-reinsert'] as const)('rejects late form writes after its %s boundary changes', async boundary => {
    const { root, form, name, status, submit } = fixture(); const pending = deferred<Response>();
    const fetcher = sessionFetcher(root, () => pending.promise);
    bootInquiryForms(root, fetcher); name.value = 'Submitted'; submitForm(form);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    name.value = 'Keep current';
    if (boundary === 'marker') form.removeAttribute('data-g7pb-inquiry-form');
    if (boundary === 'submit-type') submit.type = 'button';
    if (boundary === 'action') form.action = 'https://example.test/other';
    if (boundary === 'input') { const input = name.cloneNode(true); name.replaceWith(input); }
    if (boundary === 'remove-reinsert') { form.remove(); root.body.append(form); }
    pending.resolve(new Response('{}'));
    await vi.waitFor(() => expect(form.dataset.g7pbFormReady).toBeUndefined());
    expect(name.value).toBe('Keep current'); expect(status.textContent).toBe('전송 중입니다…');
    expect(form.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe('Keep current');
  });

  it('coalesces repeated clicks during setup and never retries a rejected POST', async () => {
    const { root, form, name, submit, status } = fixture();
    const pending = deferred<Response>();
    const fetcher = sessionFetcher(root, () => pending.promise);
    bootInquiryForms(root, fetcher); name.value = 'Keep this request';
    submitForm(form); submitForm(form);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    submitForm(form);
    pending.resolve(new Response(JSON.stringify({ message: 'Session expired' }), { status: 419 }));
    await vi.waitFor(() => expect(submit.disabled).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(name.value).toBe('Keep this request'); expect(status.textContent).toBe('Session expired');
  });
});
