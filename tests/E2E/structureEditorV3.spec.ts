import { expect, test, type Page } from '@playwright/test';
import { build, type Rollup } from 'vite';
import react from '@vitejs/plugin-react';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { puckHistoryCorrection } from '../../vite.puck-history.js';
import type { DocumentV3 } from '../../resources/js/documents/v3/types';
import type { mountStructureEditor } from '../../resources/js/editor/v3/mount';

declare global {
  interface Window {
    G7PBV3: { mountStructureEditor: typeof mountStructureEditor };
    v3Proof: { current: DocumentV3; saved: string | null; revision: number; dispose: () => void };
  }
}
let javascript = '', stylesheet = '';
const fixture = JSON.parse(readFileSync(new URL('../Contract/document-v3.fixture.json', import.meta.url), 'utf8')) as DocumentV3;
let sizes = { javascript: 0, stylesheet: 0 };
test.beforeAll(async () => {
  // Build the actual editor module, not a second implementation. This isolated
  // port host is NOT the installed G7 entry or its authenticated storage path.
  // The dev container exports NODE_ENV=development. Keep JSX transform and
  // React runtime in the same production mode; restore the worker environment.
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let result: Awaited<ReturnType<typeof build>>;
  try { result = await build({ configFile: false, root: fileURLToPath(new URL('../..', import.meta.url)),
    plugins: [react(), puckHistoryCorrection(), { name: 'v3-proof-offline-font', enforce: 'pre',
      transform(source, id) {
        if (!id.endsWith('/@puckeditor/core/dist/index.css')) return;
        const font = '@import "https://rsms.me/inter/inter.css";';
        if (!source.startsWith(font)) throw new Error('Review changed Puck CSS font import');
        return source.replace(font, '/* Independent proof uses system fonts. */');
      } }],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: {
      entry: fileURLToPath(new URL('../../resources/js/editor/v3/mount.tsx', import.meta.url)),
      formats: ['iife'], name: 'G7PBV3', fileName: 'v3-editor',
    } },
  }); } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
  if ('close' in result) throw new Error('Unexpected build watcher');
  const output: Rollup.OutputBundle[keyof Rollup.OutputBundle][] = (Array.isArray(result) ? result.flatMap(item => item.output) : result.output);
  javascript = output.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
  stylesheet = output.filter(item => item.type === 'asset').filter(item => item.fileName.endsWith('.css'))
    .map(item => typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source)).join('\n');
  sizes = { javascript: gzipSync(javascript).length, stylesheet: gzipSync(stylesheet).length };
  // Do not raise the installed editor's limits or hide its bytes in this host.
  expect(sizes.javascript).toBeLessThanOrEqual(508_500);
  expect(sizes.stylesheet).toBeLessThanOrEqual(45_200);
});
async function open(page: Page, source?: DocumentV3, readonly = false) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'v3-editor.test') return route.abort('blockedbyclient');
    if (url.pathname === '/image.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="#dbeafe"/></svg>' });
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0"><div id="editor"></div></body></html>' });
    return route.abort('blockedbyclient');
  });
  await page.goto('https://v3-editor.test/');
  await page.addStyleTag({ content: stylesheet });
  await page.addScriptTag({ content: javascript });
  const initial = source ?? { ...fixture, blocks: [], assets: [{ ...fixture.assets[0], url: '/image.svg' }] } as DocumentV3;
  await page.evaluate(({ initial, readonly }) => {
    window.v3Proof = { current: initial, saved: null, revision: 1, dispose: () => {} };
    window.v3Proof.dispose = window.G7PBV3.mountStructureEditor(document.getElementById('editor')!, {
      document: initial, sessionId: crypto.randomUUID(), readonly, serverRevision: 1, nextId: () => crypto.randomUUID(),
      onChange: document => { window.v3Proof.current = document; },
      drafts: { save: async request => {
        if (request.expectedRevision !== window.v3Proof.revision) throw new Error('conflict 409');
        window.v3Proof.saved = request.json;
        return { documentId: request.documentId, revision: ++window.v3Proof.revision };
      } },
    });
  }, { initial, readonly });
  await expect(page.getByRole('main', { name: '독립 구조 편집기' })).toBeVisible();
  await expect(page.locator('iframe')).toBeVisible();
}
const read = (page: Page) => page.evaluate(() => window.v3Proof.current);
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const layer = (page: Page, id: string) => page.getByTestId('layer-' + id);
async function enable(page: Page, label: string) {
  const field = page.getByLabel(label + ' 지정', { exact: true });
  const details = field.locator('xpath=ancestor::details');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await field.check();
}
async function length(page: Page, label: string, value: number, unit = 'px') {
  await enable(page, label);
  await page.getByLabel(label + ' 형식', { exact: true }).selectOption({ label: unit });
  await page.getByLabel(label + ' 값', { exact: true }).fill(String(value));
}
function phpDraft(source: DocumentV3) {
  return execFileSync('php', ['-r', [
    'require "vendor/autoload.php";',
    '$schema=json_decode(file_get_contents("schemas/page-builder-document-v3.schema.json"),true,flags:JSON_THROW_ON_ERROR);',
    '$policy=json_decode(file_get_contents("schemas/design-policy-v3.json"),true,flags:JSON_THROW_ON_ERROR);',
    '$validator=new Modules\\Jiwonpapa\\PageBuilder\\Domain\\Documents\\V3\\Validator($schema,$policy);',
    'echo (new Modules\\Jiwonpapa\\PageBuilder\\Application\\Compilation\\V3\\DraftRenderer($validator))->render(stream_get_contents(STDIN));',
  ].join('')], { cwd: fileURLToPath(new URL('../..', import.meta.url)), input: JSON.stringify(source), encoding: 'utf8' });
}
async function insert(page: Page, label: string) {
  await click(page, label + ' 삽입');
  await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장할 변경 있음');
}

test('v3 independent layers preserve recursive commands in one Puck Undo and canonical save/reopen', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await insert(page, '섹션');
  const section = (await read(page)).blocks[0].instance_id;
  await page.getByRole('combobox', { name: '삽입 위치' }).selectOption(section);
  for (const label of ['제목', '본문', '이미지', '링크']) await insert(page, label);
  const initial = await read(page), nodes = initial.blocks[0].slots.content!;
  expect(nodes.map(node => node.type)).toEqual(['content.heading', 'content.text', 'media.image', 'action.link']);
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-v3-node]')).toHaveCount(5);
  await layer(page, nodes[0].instance_id).click();
  await page.getByRole('textbox', { name: '레이어 이름' }).fill('주요 제목');
  await click(page, '이름 적용');
  await expect(layer(page, nodes[0].instance_id)).toHaveText('주요 제목');
  await layer(page, nodes[1].instance_id).click({ modifiers: ['Shift'] });
  const beforeGroup = await read(page);
  // Compare document coordinates inside the canvas, not the host breadcrumb's height.
  const geometry = () => Promise.all(nodes.slice(0, 2).map(node => frame.locator(`[data-v3-node="${node.instance_id}"]`)
    .evaluate(element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; })));
  const groupGeometry = await geometry();
  await click(page, '그룹');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content!.length).toBe(3);
  const group = (await read(page)).blocks[0].slots.content![0];
  expect(group.slots.content!.map(node => node.instance_id)).toEqual(nodes.slice(0, 2).map(node => node.instance_id));
  const groupedGeometry = await geometry();
  for (let index = 0; index < groupGeometry.length; index++) {
    const before = groupGeometry[index], after = groupedGeometry[index];
    if (!before || !after) throw new Error('Missing group geometry');
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before[key] - after[key]), `group ${key}`).toBeLessThanOrEqual(1);
  }
  await click(page, '실행 취소');
  await expect.poll(() => read(page)).toEqual(beforeGroup);
  await click(page, '다시 실행');
  await expect(layer(page, group.instance_id)).toBeVisible();
  const grouped = await read(page);
  await layer(page, section).click();
  await page.getByRole('combobox', { name: '삽입 위치' }).selectOption(group.instance_id);
  await click(page, '선택 위치로 이동');
  await expect(page.getByRole('status', { name: '편집 상태' })).toContainText('parent_cycle');
  expect(await read(page)).toEqual(grouped);
  await page.getByRole('combobox', { name: '삽입 위치' }).selectOption(section);
  await layer(page, group.instance_id).click();
  await click(page, '그룹 해제');
  await expect.poll(() => read(page)).toEqual(beforeGroup);
  await click(page, '복제');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content!.length).toBe(6);
  const duplicated = await read(page);
  const copied = duplicated.blocks[0].slots.content!.slice(2, 4);
  expect(copied.map(node => node.type)).toEqual(nodes.slice(0, 2).map(node => node.type));
  expect(new Set(duplicated.blocks[0].slots.content!.map(node => node.instance_id)).size).toBe(6);
  await click(page, '삭제');
  await expect.poll(() => read(page)).toEqual(beforeGroup);
  await click(page, '실행 취소');
  await expect.poll(() => read(page)).toEqual(duplicated);
  await click(page, '다시 실행');
  await expect.poll(() => read(page)).toEqual(beforeGroup);
  await insert(page, '컨테이너');
  const beforeMove = await read(page), container = beforeMove.blocks[0].slots.content!.at(-1)!;
  await layer(page, nodes[1].instance_id).click();
  await page.getByRole('combobox', { name: '삽입 위치' }).selectOption(container.instance_id);
  await click(page, '선택 위치로 이동');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content!.at(-1)!.slots.content?.[0]?.instance_id).toBe(nodes[1].instance_id);
  await click(page, '실행 취소');
  await expect.poll(() => read(page)).toEqual(beforeMove);
  await layer(page, container.instance_id).click();
  await click(page, '삭제');
  await expect.poll(() => read(page)).toEqual(beforeGroup);
  await page.getByRole('combobox', { name: '삽입 위치' }).selectOption(section);
  await layer(page, nodes[1].instance_id).click();
  await click(page, '위로');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].instance_id).toBe(nodes[1].instance_id);
  await page.getByRole('button', { name: '섹션 접기' }).click();
  await expect(layer(page, nodes[0].instance_id)).toHaveCount(0);
  await page.getByRole('button', { name: '섹션 펼치기' }).click();
  await layer(page, nodes[0].instance_id).click();
  await page.getByRole('navigation', { name: '조상 탐색' }).getByRole('button', { name: '섹션' }).click();
  await expect(layer(page, section)).toHaveAttribute('aria-pressed', 'true');
  const final = await read(page);
  await click(page, '저장');
  await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
  const saved = await page.evaluate(() => window.v3Proof.saved);
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved!)).toEqual(final);
  await open(page, JSON.parse(saved!));
  await expect(page.frameLocator('iframe').locator('[data-v3-node]')).toHaveCount(5);
  const canvasOrder = await page.frameLocator('iframe').locator('[data-v3-node]').evaluateAll(elements => elements.map(element => element.getAttribute('data-v3-node')));
  await click(page, '구조 미리보기');
  const previewOrder = await page.getByTestId('v3-preview').locator('[data-v3-node]').evaluateAll(elements => elements.map(element => element.getAttribute('data-v3-node')));
  expect(previewOrder).toEqual(canvasOrder);
  await page.getByTestId('v3-preview').locator('img').evaluateAll(async images => {
    await Promise.all(images.map(image => {
      if (!(image instanceof HTMLImageElement)) throw new Error('Expected an image');
      return image.decode();
    }));
  });
  expect(errors).toEqual([]);
  await info.attach('independent-port-evidence', { contentType: 'application/json', body: JSON.stringify({ sizes, saved: final, canvasOrder, previewOrder,
    boundary: 'Independent editor with injected test storage port, not G7 storage or published PHP output.' }) });
  await page.screenshot({ path: info.outputPath('v3-structure-reopened.png'), fullPage: true });
});

test('v3 canvas selection and native Puck drag use stable IDs and one reversible command', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  for (const label of ['제목', '본문', '링크']) await insert(page, label);
  const before = await read(page), [heading, text] = before.blocks;
  const frame = page.frameLocator('iframe');
  const headingButton = frame.getByRole('button', { name: '새 제목', exact: true });
  await headingButton.click();
  await expect(layer(page, heading.instance_id)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: '레이어 이름' })).toHaveValue('제목');
  const from = await headingButton.boundingBox();
  if (!from) throw new Error('Missing Puck draggable');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, from.y + from.height / 2 + 15, { steps: 5 });
  // Activation can shift the live target; measure after activation instead of dropping on its old neighbor.
  const to = await frame.locator('[data-v3-node="' + text.instance_id + '"]').boundingBox();
  if (!to) throw new Error('Missing live drop target');
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks.map(node => node.instance_id)).toEqual([text.instance_id, heading.instance_id, before.blocks[2].instance_id]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => read(page)).toEqual(before);
  await click(page, '다시 실행');
  await expect.poll(async () => (await read(page)).blocks[0].instance_id).toBe(text.instance_id);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('v3-canvas-drag.png'), fullPage: true });
});

test('v3 hidden locked clipboard and readonly states preserve source and assets', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await insert(page, '제목');
  const id = (await read(page)).blocks[0].instance_id;
  await layer(page, id).click();
  await click(page, '잠금');
  await expect(layer(page, id)).toHaveText('제목 · 잠김');
  const locked = await read(page);
  await click(page, '삭제');
  await expect(page.getByRole('status', { name: '편집 상태' })).toContainText('locked');
  expect(await read(page)).toEqual(locked);
  await click(page, '잠금 해제');
  await click(page, '숨김');
  await expect(page.frameLocator('iframe').locator('[data-v3-node]')).toHaveCount(0);
  await expect(layer(page, id)).toHaveText('제목 · 숨김');
  await click(page, '표시');
  await expect(page.frameLocator('iframe').locator('[data-v3-node]')).toHaveCount(1);
  await click(page, '복사');
  await click(page, '붙여넣기');
  await expect.poll(async () => (await read(page)).blocks.length).toBe(2);
  const pasted = await read(page);
  expect(pasted.blocks[1].instance_id).not.toBe(id);
  expect(pasted.assets).toHaveLength(1);
  await click(page, '실행 취소');
  await expect.poll(async () => (await read(page)).blocks.length).toBe(1);
  await click(page, '다시 실행');
  await expect.poll(() => read(page)).toEqual(pasted);
  await open(page, pasted, true);
  await expect(page.getByRole('button', { name: '제목 삽입' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  expect(await read(page)).toEqual(pasted);
  expect(errors).toEqual([]);
});

test('v3 precision Inspector and typed auto layout preserve one Undo and canonical save/reopen', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page); await insert(page, '섹션');
  const section = (await read(page)).blocks[0].instance_id;
  await page.getByLabel('삽입 위치', { exact: true }).selectOption(section);
  await insert(page, '제목'); await insert(page, '본문');
  await layer(page, section).click();
  const before = await read(page);
  await enable(page, '배치');
  await page.getByLabel('배치 형식', { exact: true }).selectOption({ label: 'flex' });
  await enable(page, '방향');
  await page.getByLabel('방향 형식', { exact: true }).selectOption({ label: 'row' });
  await length(page, '열 간격', 23);
  await length(page, '안쪽 위', 17);
  await click(page, '안쪽 위 값을 네 변에');
  expect(await read(page)).toEqual(before);
  await click(page, '디자인 적용');
  await expect.poll(async () => (await read(page)).blocks[0].style.display).toBe('flex');
  const styled = await read(page);
  expect(styled.blocks[0].style.padding_left).toEqual({ value: 17, unit: 'px' });
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-v3-node="' + section + '"]')).toHaveCSS('column-gap', '23px');
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(styled);
  // Omitted and zero remain distinct and reset is a reversible deletion.
  await length(page, '열 간격', 0); await click(page, '디자인 적용');
  await expect.poll(async () => (await read(page)).blocks[0].style.column_gap).toEqual({ value: 0, unit: 'px' });
  await page.getByLabel('열 간격 초기화', { exact: true }).click(); await click(page, '디자인 적용');
  await expect.poll(async () => Object.hasOwn((await read(page)).blocks[0].style, 'column_gap')).toBe(false);
  await click(page, '실행 취소');
  await expect.poll(async () => (await read(page)).blocks[0].style.column_gap?.value).toBe(0);
  // Arbitrary Grid tracks, not finite column presets.
  await page.getByLabel('배치 형식', { exact: true }).selectOption({ label: 'grid' });
  await enable(page, '열 트랙');
  await page.getByLabel('열 트랙 1 형식', { exact: true }).selectOption({ label: 'minmax' });
  await page.getByLabel('열 트랙 1 최소 형식', { exact: true }).selectOption({ label: 'px' });
  await page.getByLabel('열 트랙 1 최소 값', { exact: true }).fill('120');
  await page.getByLabel('열 트랙 1 최대 형식', { exact: true }).selectOption({ label: 'fr' });
  await page.getByLabel('열 트랙 1 최대 비율', { exact: true }).fill('1');
  await click(page, '열 트랙 추가');
  await page.getByLabel('열 트랙 2 형식', { exact: true }).selectOption({ label: 'fr' });
  await page.getByLabel('열 트랙 2 비율', { exact: true }).fill('2');
  await click(page, '디자인 적용');
  await expect.poll(async () => (await read(page)).blocks[0].style.columns).toEqual([{ min: { value: 120, unit: 'px' }, max: { fr: 1 } }, { fr: 2 }]);
  const final = await read(page); await click(page, '저장');
  await expect.poll(() => page.evaluate(() => window.v3Proof.saved)).not.toBeNull();
  const saved = await page.evaluate(() => window.v3Proof.saved!);
  expect(JSON.parse(saved)).toEqual(final);
  await open(page, JSON.parse(saved)); await layer(page, section).click();
  await expect(page.getByLabel('배치 형식', { exact: true }).locator('option:checked')).toHaveText('grid');
  expect(await read(page)).toEqual(final);
  expect(errors).toEqual([]);
  await info.attach('typed-inspector-document', { contentType: 'application/json', body: saved });
  await page.screenshot({ path: info.outputPath('v3-precision-inspector.png'), fullPage: true });
});

test('v3 canvas text and partial formats share Puck history and preserve readonly input', async ({ page, context }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page); await insert(page, '본문');
  await click(page, '본문 입력');
  const id = (await read(page)).blocks[0].instance_id;
  const frame = page.frameLocator('iframe'), node = frame.locator('[data-v3-node="' + id + '"]');
  await node.dblclick();
  const input = node.locator('.tiptap[contenteditable="true"]');
  await expect(input).toBeVisible();
  await input.click(); await input.press('ControlOrMeta+a'); await page.keyboard.insertText('한글 정밀 편집');
  await expect.poll(async () => JSON.stringify((await read(page)).blocks[0].props)).toContain('한글 정밀 편집');
  const typed = await read(page);
  await input.press('ControlOrMeta+a');
  await frame.getByRole('toolbar', { name: '부분 서식' }).getByRole('button', { name: '굵게', exact: true }).click();
  await expect.poll(async () => JSON.stringify((await read(page)).blocks[0].props)).toContain('"bold":true');
  const bold = await read(page);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(typed);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(bold);
  await input.click(); await input.press('End'); await input.press('Enter'); await input.pressSequentially('Second line');
  await expect.poll(async () => {
    const current = (await read(page)).blocks[0]; return current.type === 'content.text' ? current.props.paragraphs.length : 0;
  }).toBe(2);
  // Chromium composition protocol exercises IME ownership, not a physical OS keyboard.
  const cdp = await context.newCDPSession(page);
  try {
    for (const text of ['ㅎ', '하', '한']) await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    await cdp.send('Input.insertText', { text: '한' });
    await page.keyboard.insertText('글 조합');
  } finally { await cdp.detach(); }
  await expect.poll(async () => JSON.stringify((await read(page)).blocks[0].props)).toContain('한글 조합');
  await input.press('End');
  await input.evaluate(element => {
    const transfer = new DataTransfer(); transfer.setData('text/plain', ' 붙여넣기');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
  });
  await expect.poll(async () => JSON.stringify((await read(page)).blocks[0].props)).toContain('붙여넣기');
  await click(page, '저장'); await expect.poll(() => page.evaluate(() => window.v3Proof.saved)).not.toBeNull();
  const saved = await page.evaluate(() => window.v3Proof.saved!), final = JSON.parse(saved);
  expect(saved).not.toContain('contentEditable'); expect(saved).not.toContain('<p>');
  await open(page, final, true);
  await layer(page, id).click();
  await expect(page.frameLocator('iframe').locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '디자인 적용', exact: true })).toBeDisabled();
  expect(await read(page)).toEqual(final); expect(errors).toEqual([]);
  await info.attach('canonical-richtext', { contentType: 'application/json', body: saved });
  await page.screenshot({ path: info.outputPath('v3-richtext-reopened.png'), fullPage: true });
});

test('v3 editor preview and PHP draft output agree within one CSS pixel', async ({ page, context }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const source = structuredClone(fixture);
  source.assets[0].url = '/image.svg';
  const evidence: unknown[] = [];
  for (const display of ['grid', 'flex'] as const) {
    source.blocks[0].style.display = display;
    if (display === 'flex') {
      source.blocks[0].style.direction = 'column';
      source.blocks[0].slots.content![0].style.width = 'fill';
    }
    await open(page, source);
    await click(page, '본문 입력');
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('[data-v3-node]')).toHaveCount(5);
    await expect(frame.locator('.tiptap')).toHaveCount(2);
    await frame.locator('img').evaluateAll(async items => Promise.all(items.map(item => (item as HTMLImageElement).decode())));
    const measure = (element: Element) => {
      const surface = element.getBoundingClientRect();
      return [...element.querySelectorAll('[data-v3-node]')].map(node => {
        const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
        return { id: node.getAttribute('data-v3-node'), x: rect.x - surface.x, y: rect.y - surface.y, width: rect.width, height: rect.height,
          css: Object.fromEntries(['display', 'position', 'font-size', 'line-height', 'letter-spacing', 'font-weight', 'color', 'padding-top', 'padding-left',
            'margin-top', 'border-top-width', 'border-top-color', 'border-top-left-radius', 'opacity', 'box-shadow', 'background-image',
            'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows'].map(key => [key, css.getPropertyValue(key)])) };
      });
    };
    const surface = frame.locator('[data-v3-surface]');
    const width = await surface.evaluate(element => element.getBoundingClientRect().width);
    const canvas = await surface.evaluate(measure);
    await click(page, '구조 미리보기');
    const preview = await page.getByTestId('v3-preview').evaluate(measure);
    const output = await context.newPage();
    await output.route('**/*', route => route.request().url().endsWith('/image.svg')
      ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="#dbeafe"/></svg>' })
      : route.abort());
    await output.setViewportSize({ width: Math.ceil(width), height: 1000 });
    const html = phpDraft(source);
    await output.setContent('<!doctype html><html lang="ko"><head><base href="https://v3-editor.test/"></head><body style="margin:0">' + html + '</body></html>');
    await output.locator('[data-v3-surface]').evaluate((element, width) => { if (element instanceof HTMLElement) element.style.width = width + 'px'; }, width);
    await output.locator('img').evaluateAll(async items => Promise.all(items.map(item => (item as HTMLImageElement).decode())));
    const php = await output.locator('[data-v3-surface]').evaluate(measure);
    await info.attach('parity-' + display, { contentType: 'application/json', body: JSON.stringify({ width, canvas, preview, php }) });
    for (const [name, candidate] of [['preview', preview], ['PHP', php]] as const) {
      expect(candidate.map(node => node.id)).toEqual(canvas.map(node => node.id));
      for (let index = 0; index < canvas.length; index++) {
        for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(canvas[index][key] - candidate[index][key]), display + ' ' + name + ' ' + canvas[index].id + ' ' + key).toBeLessThanOrEqual(1);
        expect(candidate[index].css, display + ' ' + name + ' ' + canvas[index].id).toEqual(canvas[index].css);
      }
    }
    evidence.push({ display, width, canvas, preview, php });
    await page.screenshot({ path: info.outputPath('v3-' + display + '-preview.png'), fullPage: true });
    await output.screenshot({ path: info.outputPath('v3-' + display + '-php.png'), fullPage: true });
    await output.close();
  }
  expect(errors).toEqual([]);
  await info.attach('editor-preview-php-parity', { contentType: 'application/json', body: JSON.stringify(evidence) });
});
