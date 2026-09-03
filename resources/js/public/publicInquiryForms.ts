interface InquiryMount {
  form: HTMLFormElement;
  fetcher: typeof fetch;
  inputs: Element[];
  action: string;
  blockId: string;
  status: HTMLElement | null;
  submit: HTMLButtonElement | null;
  dispose: () => void;
}
interface InquiryRuntime {
  root: Document;
  mounts: Map<HTMLFormElement, InquiryMount>;
  observer: MutationObserver;
}
const runtimes = new WeakMap<Document, InquiryRuntime>();

function inputs(form: HTMLFormElement): Element[] { return Array.from(form.elements); }
function matches(mount: InquiryMount): boolean {
  return mount.form.isConnected && mount.form.ownerDocument.contains(mount.form)
    && mount.form.matches('[data-g7pb-inquiry-form]')
    && mount.form.action === mount.action
    && (mount.form.closest<HTMLElement>('[data-block-id]')?.dataset.blockId ?? '') === mount.blockId
    && mount.form.querySelector('[data-g7pb-form-status]') === mount.status
    && mount.form.querySelector('button[type="submit"]') === mount.submit
    && inputs(mount.form).length === mount.inputs.length
    && inputs(mount.form).every((input, index) => input === mount.inputs[index]);
}
function reconcile(runtime: InquiryRuntime, records: MutationRecord[]): void {
  for (const [form, mount] of runtime.mounts) {
    if (!matches(mount) || records.some(record => Array.from(record.removedNodes).some(node => node.contains(form)))) {
      runtime.mounts.delete(form); mount.dispose();
    }
  }
}
function runtimeFor(root: Document): InquiryRuntime {
  const existing = runtimes.get(root);
  if (existing) { reconcile(existing, existing.observer.takeRecords()); return existing; }
  const observer = new MutationObserver(records => reconcile(runtime, records));
  const runtime: InquiryRuntime = { root, mounts: new Map(), observer };
  observer.observe(root, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['data-g7pb-inquiry-form', 'data-block-id', 'action', 'type'] }); runtimes.set(root, runtime);
  return runtime;
}

export function disposeInquiryForms(root: Document = document): void {
  const runtime = runtimes.get(root); if (!runtime) return;
  runtimes.delete(root); runtime.observer.disconnect();
  for (const mount of runtime.mounts.values()) mount.dispose();
  runtime.mounts.clear();
}

function sameSubmission(before: FormData, after: FormData): boolean {
  const left = Array.from(before.entries()); const right = Array.from(after.entries());
  return left.length === right.length && left.every(([key, value], index) => {
    const [otherKey, other] = right[index];
    if (key !== otherKey || typeof value !== typeof other) return false;
    if (typeof value === 'string' || typeof other === 'string') return value === other;
    return value === other || (value.name === '' && other.name === '' && value.size === 0 && other.size === 0);
  });
}

export function bootInquiryForms(root: Document = document, fetcher: typeof fetch = fetch): void {
  const runtime = runtimeFor(root);
  const csrf = root.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
  for (const form of root.querySelectorAll<HTMLFormElement>('[data-g7pb-inquiry-form]')) {
    const previous = runtime.mounts.get(form);
    if (previous?.fetcher === fetcher) continue;
    previous?.dispose();
    const blockId = form.closest<HTMLElement>('[data-block-id]')?.dataset.blockId ?? '';
    const blockInput = form.elements.namedItem('block_instance_id');
    const startedInput = form.elements.namedItem('started_at');
    const status = form.querySelector<HTMLElement>('[data-g7pb-form-status]');
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    let active = true; let pending = false;
    const restoreHidden = (): void => {
      if (blockInput instanceof HTMLInputElement) blockInput.value = blockId;
      if (startedInput instanceof HTMLInputElement) startedInput.value = String(Math.floor(Date.now() / 1000));
    };
    restoreHidden();
    const current = (): boolean => {
      reconcile(runtime, runtime.observer.takeRecords());
      return active && runtimes.get(root) === runtime && runtime.mounts.get(form) === mount && matches(mount);
    };
    const handler = (event: Event): void => {
      event.preventDefault();
      if (!current() || pending || !form.reportValidity() || !blockId || submit?.disabled) return;
      const snapshot = new FormData(form);
      pending = true;
      if (status) status.textContent = '전송 중입니다…';
      if (submit) submit.disabled = true;
      void (async () => {
        try {
          const response = await fetcher(form.action, { method: 'POST', credentials: 'same-origin', body: snapshot,
            headers: { Accept: 'application/json', ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}) } });
          if (!current()) return;
          const payload: unknown = await response.json().catch(() => null);
          if (!current()) return;
          const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : undefined;
          if (!response.ok) throw new Error(typeof message === 'string' ? message : '문의 전송에 실패했습니다.');
          if (sameSubmission(snapshot, new FormData(form))) { form.reset(); restoreHidden(); }
          if (status) status.textContent = form.dataset.g7pbSuccessMessage || '문의가 접수되었습니다.';
        } catch (error: unknown) {
          if (current() && status) status.textContent = error instanceof Error ? error.message : '문의 전송에 실패했습니다.';
        } finally {
          if (current()) { pending = false; if (submit) submit.disabled = false; }
        }
      })();
    };
    const mount: InquiryMount = { form, fetcher, blockId, action: form.action, inputs: inputs(form), status, submit,
      dispose: () => { active = false; form.removeEventListener('submit', handler); if (pending && submit) submit.disabled = false; delete form.dataset.g7pbFormReady; } };
    runtime.mounts.set(form, mount);
    form.addEventListener('submit', handler); form.dataset.g7pbFormReady = 'true';
  }
}
