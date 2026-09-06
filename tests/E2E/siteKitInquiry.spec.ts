import { devices, expect, test, type APIResponse } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';
import { parseSiteKitReceipt } from '../../resources/js/api/siteKit';

const API = '/api/modules/jiwonpapa-page_builder/admin';
test.use({ ...devices['Desktop Chrome'], locale: 'ko-KR' });
test('accepts an anonymous kit inquiry without a preexisting CSRF session and shows it in the manager', async ({ page, context, browser }, info) => {
  // Read the actual Laravel configuration before creating a local inquiry. Never
  // deliver a test message to an externally configured recipient.
  execFileSync('php', ['-r', 'require "/var/www/g7/vendor/autoload.php"; $app=require "/var/www/g7/bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); $recipient=config("g7-page-builder.forms.recipient"); if (is_string($recipient) && filter_var($recipient,FILTER_VALIDATE_EMAIL)!==false) { throw new RuntimeException("Inquiry test requires no configured mail recipient"); }'], { timeout: 30000, stdio: 'pipe' });
  const token = await authenticateEditorInteractionAdmin(context), api = await editorInteractionApi(token);
  const read = async (response: APIResponse) => {
    expect(response.ok()).toBe(true); const payload = await response.json(); expect(payload.success).toBe(true); return payload.data;
  };
  const stamp = Date.now();
  const paths = Object.fromEntries(['about', 'services', 'process', 'contact'].map(key => [key, `/kit-inquiry-${stamp}/${key}`]));
  const receipt = parseSiteKitReceipt(await read(await api.post(`${API}/site-kits/install`, { data: {
    kit_id: 'professional-services', kit_version: '0.1.0', title: `상담 접수 검증 ${stamp}`, paths, request_id: randomUUID(),
  } })));
  await writeFile(info.outputPath('owned-installation.json'), JSON.stringify(receipt, null, 2));
  const contact = receipt.pages.find(item => item.key === 'contact');
  if (!contact) throw new Error('Installed inquiry page is missing.');
  const current = await read(await api.get(`${API}/documents/${contact.document_id}`));
  expect(typeof current.lock_version).toBe('number');
  const prepared = await read(await api.post(`${API}/documents/${contact.document_id}/publications/prepare`, { data: { expected_lock_version: current.lock_version } }));
  expect(typeof prepared.publication_token).toBe('string');
  await read(await api.post(`${API}/publications/${prepared.publication_token}/commit`, { data: {} }));
  const visitors = await browser.newContext({ ...devices['Desktop Chrome'], ignoreHTTPSErrors: true, locale: 'ko-KR' });
  try {
    const visitor = await visitors.newPage(); await visitor.goto(new URL(contact.path, process.env.G7PB_BASE_URL ?? 'https://g7pb.test').href);
    await visitor.waitForLoadState('networkidle');
    const form = visitor.locator('form[data-g7pb-inquiry-form]'); await expect(form).toBeVisible();
    expect(await visitor.evaluate(() => Boolean(document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content))).toBe(false);
    expect(await visitor.evaluate(() => document.cookie.includes('XSRF-TOKEN='))).toBe(false);
    await form.getByLabel('이름', { exact: true }).fill('로컬 킷 검증');
    await form.getByLabel('이메일', { exact: true }).fill('kit-test@example.invalid');
    const subject = `사이트 킷 접수 확인 ${stamp}`;
    await form.getByLabel('문의 제목', { exact: true }).fill(subject);
    await form.getByLabel('문의 내용', { exact: true }).fill('로컬 검증용 접수입니다. 실제 고객 요청이 아닙니다.');
    await form.locator('input[name="privacy"]').check();
    await expect.poll(() => form.locator('input[name="started_at"]').evaluate(input => Math.floor(Date.now() / 1000) - Number(input instanceof HTMLInputElement ? input.value : 0))).toBeGreaterThanOrEqual(2);
    const sessionResponse = visitor.waitForResponse(response => response.url().endsWith('/sanctum/csrf-cookie'));
    const submissionResponse = visitor.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/inquiries'));
    await form.getByRole('button', { name: '상담 요청 보내기', exact: true }).click();
    expect((await sessionResponse).status()).toBe(204);
    const response = await submissionResponse; expect(response.status()).toBe(201);
    expect(response.request().headers()['x-xsrf-token']).toBeTruthy();
    const submission = (await response.json()).data.submission_id;
    expect(typeof submission).toBe('string');
    await expect(form.locator('[data-g7pb-form-status]')).toContainText('접수');
    const inbox = await read(await api.get(`${API}/form-submissions?status=all`));
    const record = inbox.items.find((item: { id: string }) => item.id === submission);
    expect(record.subject).toBe(subject); expect(record.status).toBe('unread'); expect(record.mail_status).toBe('failed');
    await writeFile(info.outputPath('owned-inquiry.json'), JSON.stringify({ id: submission, subject, status: record.status, mail_status: record.mail_status }, null, 2));
    await visitor.screenshot({ path: info.outputPath('inquiry-received.png'), fullPage: true });
    await page.goto('/modules/jiwonpapa-page_builder/admin');
    await page.getByRole('button', { name: '문의함', exact: true }).click();
    await expect(page.getByText(subject, { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath('manager-inquiry.png'), fullPage: true });
  } finally { await visitors.close(); await api.dispose(); }
});
