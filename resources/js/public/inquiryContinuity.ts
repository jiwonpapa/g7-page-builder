/** Ephemeral handoff between two identical PB inquiry renderings, never storage.
 * The caller owns the render checkpoint and must discard unmatched snapshots.
 */
type Input = HTMLInputElement | HTMLTextAreaElement;
interface Value { value: string; checked: boolean }
export interface InquiryDraft { identity: string; values: Value[] }

function controls(form: HTMLFormElement): Input[] {
  return [...form.elements].filter((element): element is Input =>
    element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement
      && ['text', 'email', 'tel', 'checkbox'].includes(element.type));
}

/** Captured before runtime status/disabled/ready changes. It includes the whole
 * compiled form, so a changed binding, label, style or revision marker rejects
 * the transfer even when the public URL and stable form ID happen to match.
 */
export function inquiryIdentity(form: HTMLFormElement): string {
  const source = form.cloneNode(true);
  if (!(source instanceof HTMLFormElement)) throw new Error('Inquiry form required');
  source.removeAttribute('data-g7pb-form-ready');
  return JSON.stringify([form.ownerDocument.location?.href ?? form.ownerDocument.URL,
    form.action, form.closest<HTMLElement>('[data-block-id]')?.dataset.blockId ?? '', source.outerHTML]);
}

export function snapshotInquiry(form: HTMLFormElement, identity: string): InquiryDraft | null {
  const fields = controls(form);
  const dirty = fields.some(field => field.value !== field.defaultValue
    || field instanceof HTMLInputElement && field.checked !== field.defaultChecked);
  return dirty ? { identity, values: fields.map(field => ({ value: field.value,
    checked: field instanceof HTMLInputElement && field.checked })) } : null;
}

export function restoreInquiry(form: HTMLFormElement, draft: InquiryDraft): boolean {
  const fields = controls(form);
  if (!form.isConnected || inquiryIdentity(form) !== draft.identity || fields.length !== draft.values.length) return false;
  // No event dispatch, submit, request, hidden token restoration or source write.
  fields.forEach((field, index) => {
    field.value = draft.values[index].value;
    if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = draft.values[index].checked;
  });
  return true;
}
