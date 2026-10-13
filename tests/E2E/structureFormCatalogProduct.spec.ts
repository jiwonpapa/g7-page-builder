import { devices, expect, test, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { DocumentV3, Node } from '../../resources/js/documents/v3/types';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';

test.use({ isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });
const endpoint = '/api/modules/jiwonpapa-page_builder/admin/documents';
const submissions = '/api/modules/jiwonpapa-page_builder/admin/form-submissions';
const catalog = JSON.parse(readFileSync(new URL('../../resources/compositions/builtin-v3.json', import.meta.url), 'utf8')) as DocumentV3[];
const slugs = ['inquiry-general', 'inquiry-quote', 'inquiry-reservation', 'inquiry-application', 'inquiry-newsletter'];
const nodes = (items: Node[]): Node[] => items.flatMap(node => [node, ...nodes(node.slots.content ?? [])]);

async function geometry(surface: Locator) {
  const sample = () => surface.evaluate(async element => {
    await element.ownerDocument.fonts.ready;
    const capture = () => {
      if (!element.isConnected) return null;
      const origin = element.getBoundingClientRect();
      return [...element.querySelectorAll<HTMLElement>('[data-v3-node]')].map(node => {
        const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
        return { id: node.dataset.v3Node, text: node.innerText, font: css.fontSize, display: css.display,
          box: [rect.x - origin.x, rect.y - origin.y, rect.width, rect.height] };
      });
    };
    const first = capture();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const second = capture();
    return first && second && JSON.stringify(first) === JSON.stringify(second) ? second : null;
  });
  const result: { value: Awaited<ReturnType<typeof sample>> } = { value: null };
  await expect.poll(async () => { result.value = await sample(); return result.value !== null; },
    { message: 'Measure attached output after fonts and two stable animation frames' }).toBe(true);
  if (!result.value) throw new Error('Form output did not become ready');
  return result.value;
}

for (const sourceSlug of slugs) test('authored form composition inserts edits reopens publishes and stores its inquiry ' + sourceSlug,
  async ({ page, context, browser }, info) => {
    // Local database proof must not deliver mail to a configured recipient.
    execFileSync('php', ['-r', 'require "/var/www/g7/vendor/autoload.php"; $app=require "/var/www/g7/bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); $recipient=config("g7-page-builder.forms.recipient"); if (is_string($recipient) && filter_var($recipient,FILTER_VALIDATE_EMAIL)!==false) { throw new RuntimeException("Inquiry test requires no configured mail recipient"); }'], { timeout: 30000, stdio: 'pipe' });
    const source = catalog.find(item => item.slug === sourceSlug);
    if (!source) throw new Error('Missing required inquiry composition ' + sourceSlug);
    const sourceBefore = JSON.stringify(source), originalNodes = nodes(source.blocks);
    const originalBinding = originalNodes.find(node => node.binding)?.binding;
    if (!originalBinding) throw new Error('Composition has no inquiry connection');
    const token = await authenticateEditorInteractionAdmin(context), api = await editorInteractionApi(token);
    const slug = `g7pb-form-catalog-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    let documentId: string | undefined, submissionId: string | undefined;
    const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
    const save = async () => {
      await click('저장'); await expect(page.getByTestId('structure-document-status')).toHaveText('초안 저장됨');
      const response = await api.get(`${endpoint}/${documentId}`); expect(response.ok()).toBe(true);
      return (await response.json()).data.document as DocumentV3;
    };
    const visitors = await browser.newContext({ ...devices['Desktop Chrome'], ignoreHTTPSErrors: true, locale: 'ko-KR' });
    const viewer = await visitors.newPage(), preview = await context.newPage();
    const errors: string[] = []; for (const target of [page, viewer, preview]) target.on('pageerror', error => errors.push(error.message));
    let previewPosts = 0; preview.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/inquiries')) previewPosts++; });
    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/modules/jiwonpapa-page_builder/admin/editor?editor=structure');
      await page.getByLabel('페이지 제목', { exact: true }).fill('구성 데이터 검증 ' + source.blocks[0].name);
      await page.getByLabel('기본 주소 이름', { exact: true }).fill(slug);
      await page.getByRole('combobox', { name: '페이지 출력 방식', exact: true }).selectOption('none');
      const creation = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === 'POST');
      await click('빈 페이지 만들기'); const created = await creation; expect(created.ok(), await created.text()).toBe(true);
      documentId = (await created.json()).data.document.document_id;
      await page.getByLabel('구성 검색', { exact: true }).fill(source.blocks[0].name);
      await page.getByLabel('구성 선택', { exact: true }).selectOption(source.document_id);
      await click('구성 삽입'); await expect(page.getByTestId(/^layer-/)).toHaveCount(originalNodes.length);
      await click('실행 취소'); await expect(page.getByTestId(/^layer-/)).toHaveCount(0);
      await click('다시 실행'); await expect(page.getByTestId(/^layer-/)).toHaveCount(originalNodes.length);
      const inserted = await save(), insertedNodes = nodes(inserted.blocks);
      expect(insertedNodes.every(node => !originalNodes.some(original => original.instance_id === node.instance_id))).toBe(true);
      const host = insertedNodes.find(node => node.binding)!;
      const binding = host.binding!, email = binding.fields.find(field => field.name === 'email')!;
      expect(binding.form_kind).toBe(originalBinding.form_kind);
      for (const field of binding.fields) {
        expect(insertedNodes.some(node => node.instance_id === field.input_id)).toBe(true);
        expect(insertedNodes.some(node => node.instance_id === field.label_id)).toBe(true);
      }
      const label = '회신 이메일 <안내>';
      await page.getByTestId('layer-' + email.label_id).click(); await click('본문 입력');
      const editable = page.frameLocator('iframe').locator(`[data-v3-node="${email.label_id}"] [contenteditable]`);
      await editable.hover(); await editable.click(); await expect(editable).toHaveAttribute('contenteditable', 'plaintext-only');
      await editable.fill(label); await click('구조 선택');
      await page.getByTestId('layer-' + email.input_id).click();
      await page.getByLabel('입력 안내', { exact: true }).fill('reply@example.invalid'); await click('입력 설정 적용');
      await click('모바일');
      const height = page.getByLabel('높이 지정', { exact: true }), group = height.locator('xpath=ancestor::details');
      if (await group.getAttribute('open') === null) await group.locator('summary').click();
      await height.check(); await page.getByLabel('높이 형식', { exact: true }).selectOption({ label: 'px' });
      await page.getByLabel('높이 값', { exact: true }).fill('56'); await click('디자인 적용');
      const input = page.frameLocator('iframe').locator(`[data-v3-node="${email.input_id}"]`);
      await expect(input).toHaveCSS('height', '56px');
      await click('실행 취소'); await expect(input).toHaveCSS('height', '48px');
      await click('다시 실행'); await expect(input).toHaveCSS('height', '56px');
      const saved = await save();
      expect(nodes(saved.blocks).find(node => node.instance_id === email.label_id)?.props).toEqual({ label });
      expect(nodes(saved.blocks).find(node => node.instance_id === email.input_id)?.responsive.mobile?.height).toEqual({ value: 56, unit: 'px' });
      await page.reload(); await page.getByTestId('layer-' + email.input_id).click();
      await expect(page.getByLabel('입력 안내', { exact: true })).toHaveValue('reply@example.invalid');
      await click('공개 미리보기 준비');
      const previewLink = page.getByRole('link', { name: '공개 미리보기 열기', exact: true }); await expect(previewLink).toBeVisible();
      const previewUrl = (await previewLink.getAttribute('href'))!;
      await click('발행 준비'); await expect(page.getByRole('dialog', { name: '이 버전을 공개할까요?' })).toBeVisible();
      await click('이 버전 발행');
      const publicLink = page.getByRole('link', { name: '공개 페이지 열기', exact: true }); await expect(publicLink).toBeVisible();
      const publicUrl = new URL((await publicLink.getAttribute('href'))!, process.env.G7PB_BASE_URL ?? 'https://g7pb.test').href;
      for (const [viewport, width] of [['PC · 공통값', 1280], ['태블릿', 768], ['모바일', 360]] as const) {
        await click(viewport); await page.getByLabel('작업면 확대', { exact: true }).selectOption('1');
        const canvas = await geometry(page.frameLocator('iframe').locator('[data-v3-surface]'));
        const captures = [];
        for (const [name, target, url] of [['preview', preview, previewUrl], ['public', viewer, publicUrl]] as const) {
          await target.setViewportSize({ width, height: 1000 }); expect((await target.goto(url))?.ok()).toBe(true);
          const surface = target.locator('[data-g7pb-v3-public]');
          await expect(surface.getByLabel(label, { exact: true })).toHaveAttribute('placeholder', 'reply@example.invalid');
          await expect(surface.getByLabel(label, { exact: true })).toHaveCSS('height', width === 360 ? '56px' : '48px');
          if (name === 'preview') {
            await expect(surface.locator('form')).toHaveCount(0); await expect(surface.locator('[data-g7pb-form-submit]')).toBeDisabled();
          } else await expect(surface.locator('form')).toHaveAttribute('data-g7pb-form-ready', 'true');
          const actual = await geometry(surface);
          expect(actual.map(({ box: _box, ...node }) => node)).toEqual(canvas.map(({ box: _box, ...node }) => node));
          for (const [index, node] of actual.entries()) for (let axis = 0; axis < 4; axis++) {
            expect(Math.abs(node.box[axis] - canvas[index].box[axis]), `${sourceSlug}/${name}/${width}/${node.id}/${axis}`).toBeLessThanOrEqual(1);
          }
          expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
          captures.push({ name, actual });
          await info.attach(`${sourceSlug}-${name}-${width}`, { body: await target.screenshot({ fullPage: true }), contentType: 'image/png' });
        }
        await info.attach(`${sourceSlug}-parity-${width}`, { body: JSON.stringify({ canvas, captures }), contentType: 'application/json' });
      }
      expect(previewPosts).toBe(0);
      const form = viewer.locator('form[data-g7pb-inquiry-form]');
      await form.locator('[name="name"]').fill('로컬 구성 검증');
      await form.locator('[name="email"]').fill('catalog-proof@example.invalid');
      await form.locator('[name="message"]').fill('실제 고객 요청이 아닌 로컬 카탈로그 검증입니다.');
      await form.locator('[name="privacy"]').check();
      await expect.poll(() => form.locator('[name="started_at"]').evaluate(element => Math.floor(Date.now() / 1000) - Number((element as HTMLInputElement).value))).toBeGreaterThanOrEqual(2);
      await expect(form.locator('[name="email"]')).toHaveValue('catalog-proof@example.invalid');
      const response = viewer.waitForResponse(result => result.request().method() === 'POST' && result.url().endsWith('/inquiries'));
      await form.locator('button[type="submit"]').click(); const receipt = await response;
      expect(receipt.status(), await receipt.text()).toBe(201); submissionId = (await receipt.json()).data.submission_id;
      await expect(form.locator('[data-g7pb-form-status]')).toHaveText(originalBinding.success_message);
      const inbox = (await (await api.get(submissions + '?status=all')).json()).data;
      const record = inbox.items.find((item: { id: string }) => item.id === submissionId);
      expect(record).toMatchObject({ page_slug: slug, block_instance_id: host.instance_id, form_kind: originalBinding.form_kind, status: 'unread' });
      const current = (await (await api.get(`${endpoint}/${documentId}`)).json()).data;
      expect(current.document).toEqual(saved); expect(current.active_artifact_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(source)).toBe(sourceBefore); expect(errors).toEqual([]);
      await info.attach('catalog-form-persistence', { body: JSON.stringify({ sourceSlug, documentId, submissionId, formKind: record.form_kind }), contentType: 'application/json' });
    } finally {
      await visitors.close(); await preview.close();
      try {
        if (submissionId) {
          const archived = await api.patch(submissions + '/' + submissionId, { data: { status: 'archived' } });
          expect(archived.ok(), await archived.text()).toBe(true);
        }
        if (documentId) {
          const current = (await (await api.get(`${endpoint}/${documentId}`)).json()).data; expect(current.document.slug).toBe(slug);
          const archived = await api.post(`${endpoint}/${documentId}/archive`, { data: { expected_lock_version: current.lock_version } });
          expect(archived.ok(), await archived.text()).toBe(true);
          await info.attach('owned-catalog-document-archived', { body: await archived.body(), contentType: 'application/json' });
        }
      } finally { await api.dispose(); }
    }
  });
