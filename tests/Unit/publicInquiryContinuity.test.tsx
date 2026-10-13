import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { hydrateTemplateRuntime } from '../../resources/js/public/publicHydration';
import { bootInquiryForms, disposeInquiryForms } from '../../resources/js/public/publicInquiryForms';
import { inquiryIdentity, restoreInquiry, snapshotInquiry } from '../../resources/js/public/inquiryContinuity';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { disposeInquiryForms(document); await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks(); });

const markup = '<div data-block-id="owned-form" data-g7pb-inquiry-host data-g7pb-inquiry-form data-g7pb-form-action="/pages/owned/inquiries">'
  + '<span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="name" data-g7pb-control-value=""></span>'
  + '<span data-g7pb-form-control="input" data-g7pb-control-type="checkbox" data-g7pb-control-name="privacy" data-g7pb-control-value="1"></span>'
  + '<span data-g7pb-form-control="button" data-g7pb-control-type="submit">Send</span>'
  + '<p data-g7pb-form-status>Enter your request</p></div>';

it('preserves an idle visitor input when the host renders the same compiled HTML again', async () => {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<div dangerouslySetInnerHTML={{ __html: markup }} />));
  const fetcher = vi.fn<typeof fetch>();
  const mount = () => { hydrateTemplateRuntime(document); bootInquiryForms(document, fetcher); };
  mount();
  const previous = document.querySelector<HTMLFormElement>('form')!;
  const identity = inquiryIdentity(previous);
  const name = previous.elements.namedItem('name') as HTMLInputElement;
  name.value = 'Visitor input'; name.dispatchEvent(new Event('input', { bubbles: true }));
  (previous.elements.namedItem('privacy') as HTMLInputElement).click();
  await act(async () => root!.render(<div dangerouslySetInnerHTML={{ __html: markup }} />));
  const draft = snapshotInquiry(previous, identity)!;
  hydrateTemplateRuntime(document);
  const current = document.querySelector<HTMLFormElement>('form')!;
  expect(current).not.toBe(previous);
  expect((current.elements.namedItem('name') as HTMLInputElement).value).toBe('');
  expect(restoreInquiry(current, draft)).toBe(true);
  bootInquiryForms(document, fetcher);
  expect((current.elements.namedItem('name') as HTMLInputElement).value).toBe('Visitor input');
  expect((current.elements.namedItem('privacy') as HTMLInputElement).checked).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
});

function fixture() {
  document.body.innerHTML = markup; hydrateTemplateRuntime(document);
  const form = document.querySelector<HTMLFormElement>('form')!, identity = inquiryIdentity(form);
  const name = form.elements.namedItem('name') as HTMLInputElement;
  name.value = 'Unsent request';
  return { form, name, identity, draft: snapshotInquiry(form, identity)! };
}

it.each(['action', 'owner', 'label', 'style', 'route', 'source-revision'])('rejects changed %s without partial writes', kind => {
  const { draft } = fixture(); document.body.innerHTML = markup; hydrateTemplateRuntime(document);
  const form = document.querySelector<HTMLFormElement>('form')!;
  const priorUrl = location.href;
  if (kind === 'action') form.action = '/pages/another/inquiries';
  else if (kind === 'owner') form.dataset.blockId = 'another-form';
  else if (kind === 'label') form.querySelector('p')!.textContent = 'New source content';
  else if (kind === 'style') form.style.padding = '20px';
  else if (kind === 'route') history.replaceState(null, '', '/another-page');
  else form.dataset.sourceRevision = '2';
  try {
    const before = form.outerHTML;
    expect(restoreInquiry(form, draft)).toBe(false); expect(form.outerHTML).toBe(before);
    expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('');
  } finally { history.replaceState(null, '', priorUrl); }
});

it('does not capture explicit reset input or restore into detached nodes', () => {
  const { form, identity, draft } = fixture(); form.reset();
  expect(snapshotInquiry(form, identity)).toBeNull(); form.remove();
  expect(restoreInquiry(form, draft)).toBe(false);
});

it('keeps textarea and checkbox values but never carries hidden session values or passwords', () => {
  document.body.innerHTML = '<form data-block-id="owned"><input name="name"><textarea name="message"></textarea><input name="privacy" type="checkbox"><input name="token" type="hidden" value="fresh"><input type="password" name="password"></form>';
  const form = document.querySelector<HTMLFormElement>('form')!, identity = inquiryIdentity(form);
  const sourceMarkup = form.outerHTML;
  (form.elements.namedItem('message') as HTMLTextAreaElement).value = '안녕하세요\n문의 내용';
  (form.elements.namedItem('privacy') as HTMLInputElement).checked = true;
  (form.elements.namedItem('token') as HTMLInputElement).value = 'obsolete';
  (form.elements.namedItem('password') as HTMLInputElement).value = 'private';
  const draft = snapshotInquiry(form, identity)!;
  form.outerHTML = sourceMarkup;
  const replacement = document.querySelector<HTMLFormElement>('form')!;
  expect(restoreInquiry(replacement, draft)).toBe(true);
  expect((replacement.elements.namedItem('message') as HTMLTextAreaElement).value).toBe('안녕하세요\n문의 내용');
  expect((replacement.elements.namedItem('privacy') as HTMLInputElement).checked).toBe(true);
  expect((replacement.elements.namedItem('token') as HTMLInputElement).value).toBe('fresh');
  expect((replacement.elements.namedItem('password') as HTMLInputElement).value).toBe('');
});
