import { devices, expect, test, type Page } from '@playwright/test';
import { build, loadConfigFromFile, type Rollup } from 'vite';
import react from '@vitejs/plugin-react';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { puckHistoryCorrection } from '../../vite.puck-history.js';
import { interFontAssets, INTER_DIST, localInterFonts } from '../../vite.inter-fonts.js';
import type { Behavior, DocumentV3, Node, LayoutTag } from '../../resources/js/documents/v3/types';
import type { TiptapEditorHTMLElement } from '@tiptap/core';
import type { mountStructureEditor } from '../../resources/js/editor/v3/mount';
import AxeBuilder from '@axe-core/playwright';
import type { Viewport } from '../../resources/js/documents/v3/validate';

declare global {
  interface Window {
    G7PBV3: { mountStructureEditor: typeof mountStructureEditor };
    v3Proof: { current: DocumentV3; saved: string | null; revision: number; dispose: () => void };
  }
}
let javascript = '', stylesheet = '';
let stylesheetPath = '';
const builtAssets = new Map<string, Buffer>();
const bundledPreviewAssets = new Map<string, { contentType: string; body: Buffer }>();
const fixture = JSON.parse(readFileSync(new URL('../Contract/document-v3.fixture.json', import.meta.url), 'utf8')) as DocumentV3;
const builtinCompositions = JSON.parse(readFileSync(new URL('../../resources/compositions/builtin-v3.json', import.meta.url), 'utf8')) as DocumentV3[];
let sizes = { javascript: 0, stylesheet: 0 };
test.beforeAll(async () => {
  // Build the actual editor module, not a second implementation. This isolated
  // port host is NOT the installed G7 entry or its authenticated storage path.
  // The dev container exports NODE_ENV=development. Keep JSX transform and
  // React runtime in the same production mode; restore the worker environment.
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let result: Awaited<ReturnType<typeof build>>;
  try {
    // Load the product build plugin through Vite's config loader (which owns
    // TS/ESM resolution). Filesystem-dependent browser proofs are non-reusable;
    // the candidate build fingerprint also includes vite.config.ts.
    const configured = await loadConfigFromFile({ command: 'build', mode: 'production' }, fileURLToPath(new URL('../../vite.config.ts', import.meta.url)));
    const catalog = configured?.config.plugins?.find(plugin => plugin && typeof plugin === 'object'
      && 'name' in plugin && plugin.name === 'g7pb-builtin-catalog-literals');
    if (!catalog) throw new Error('Missing product catalog build plugin');
    result = await build({ configFile: false, root: fileURLToPath(new URL('../..', import.meta.url)),
    plugins: [react(), puckHistoryCorrection(), catalog, localInterFonts()],
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
  const runtimeModules = output.flatMap(item => item.type === 'chunk' ? Object.keys(item.modules) : []);
  expect(runtimeModules.filter(path => /resources\/(js\/blocks|block-packs)\//.test(path))).toEqual([]);
  javascript = output.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
  for (const item of output) if (item.type === 'asset') builtAssets.set('/' + item.fileName, Buffer.from(item.source));
  stylesheetPath = [...builtAssets.keys()].find(path => path.endsWith('.css') && !path.startsWith('/fonts/')) ?? '';
  expect(stylesheetPath).not.toBe('');
  for (const [name, bytes] of interFontAssets(fileURLToPath(new URL('../..', import.meta.url)))) {
    expect(builtAssets.get('/' + INTER_DIST + '/' + name)?.equals(bytes)).toBe(true);
  }
  stylesheet = output.filter(item => item.type === 'asset').filter(item => item.fileName.endsWith('.css') && !item.fileName.startsWith('fonts/'))
    .map(item => typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source)).join('\n');
  sizes = { javascript: gzipSync(javascript).length, stylesheet: gzipSync(stylesheet).length };
  // Same 512,000-byte editor limit approved on 2026-10-13 and enforced by
  // check-frontend-budgets.mjs; this host may not hide its own dependency bytes.
  expect(sizes.javascript).toBeLessThanOrEqual(512_000);
  // CSS growth is observable, not a development gate. Keep the stylesheet
  // present and keep all computed-style, geometry, and interaction assertions.
  expect(stylesheet.trim()).not.toBe('');
  console.info('V3_EDITOR_CSS_SIZE', JSON.stringify({ raw: Buffer.byteLength(stylesheet), gzip: sizes.stylesheet, limit: null }));
});
async function open(page: Page, source?: DocumentV3, readonly = false, compositions?: DocumentV3[]) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'v3-editor.test') return route.abort('blockedbyclient');
    const previewAsset = bundledPreviewAssets.get(url.pathname);
    if (previewAsset) return route.fulfill(previewAsset);
    const asset = builtAssets.get(url.pathname);
    if (asset) return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.woff2') ? 'font/woff2' : 'text/plain', body: asset });
    if (url.pathname === '/image.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="#dbeafe"/></svg>' });
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0"><div id="editor"></div></body></html>' });
    return route.abort('blockedbyclient');
  });
  await page.goto('https://v3-editor.test/');
  await page.addStyleTag({ url: 'https://v3-editor.test' + stylesheetPath });
  await page.addScriptTag({ content: javascript });
  const initial = source ?? { ...fixture, blocks: [], assets: [{ ...fixture.assets[0], url: '/image.svg' }] } as DocumentV3;
  await page.evaluate(({ initial, readonly, compositions }) => {
    window.v3Proof = { current: initial, saved: null, revision: 1, dispose: () => {} };
    window.v3Proof.dispose = window.G7PBV3.mountStructureEditor(document.getElementById('editor')!, {
      document: initial, compositions, sessionId: crypto.randomUUID(), readonly, serverRevision: 1, nextId: () => crypto.randomUUID(),
      onChange: document => { window.v3Proof.current = document; },
      drafts: { save: async request => {
        if (request.expectedRevision !== window.v3Proof.revision) throw new Error('conflict 409');
        window.v3Proof.saved = request.json;
        return { documentId: request.documentId, revision: ++window.v3Proof.revision };
      } },
    });
  }, { initial, readonly, compositions });
  await expect(page.getByRole('main', { name: '독립 구조 편집기' })).toBeVisible();
  await expect(page.locator('iframe')).toBeVisible();
  await Promise.all(page.frames().map(frame => frame.evaluate(async () => { await document.fonts.ready; })));
}
const read = (page: Page) => page.evaluate(() => window.v3Proof.current);
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const layer = (page: Page, id: string) => page.getByTestId('layer-' + id);
const allNodes = (nodes: Node[]): Node[] => nodes.flatMap(node => [node, ...allNodes(node.slots.content ?? [])]);
async function connectBehavior(page: Page, behavior: Behavior) {
  const choose = (label: string, value: string) => page.getByLabel(label, { exact: true }).selectOption(value);
  await choose('동작 유형', behavior.kind);
  if ('label' in behavior) await page.getByLabel('동작 이름', { exact: true }).fill(behavior.label);
  if (behavior.kind === 'tabs') {
    await choose('탭 방향', behavior.orientation); await choose('탭 버튼 영역', behavior.tablist_id);
  }
  if (behavior.kind === 'disclosure') await choose('접기 방식', behavior.mode);
  if ('pairs' in behavior) {
    for (const [index, pair] of behavior.pairs.entries()) {
      await click(page, '연결 추가');
      if ('item_id' in pair && typeof pair.item_id === 'string') await choose((index + 1) + ' 항목 영역', pair.item_id);
      await choose((index + 1) + ' 동작 버튼', pair.trigger_id);
      await choose((index + 1) + ' 내용 영역', pair.panel_id);
      if ('expanded' in pair && typeof pair.expanded === 'boolean') await page.getByLabel((index + 1) + ' 처음에 펼침', { exact: true }).setChecked(pair.expanded);
    }
    if (behavior.kind === 'tabs') await choose('처음 표시할 내용', behavior.active_panel_id);
  } else {
    for (const [label, value] of [['슬라이드 표시 영역', behavior.viewport_id], ['슬라이드 트랙', behavior.track_id],
      ['처음 표시할 슬라이드', behavior.active_slide_id], ['이전 버튼', behavior.previous_id], ['다음 버튼', behavior.next_id],
      ['자동 재생 버튼', behavior.rotation_id ?? '']]) await choose(label, value);
    await page.getByLabel('처음부터 자동 재생', { exact: true }).setChecked(behavior.autoplay);
    await page.getByLabel('슬라이드 반복', { exact: true }).setChecked(behavior.loop);
    await page.getByLabel('전환 간격', { exact: true }).fill(String(behavior.interval_ms));
  }
}
test.describe(() => {
  test.use({ isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });
  test('v3 common icon insertion meaning history responsive styles and PHP parity without a catalog', async ({ page, context }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await open(page, undefined, false, []); await insert(page, '아이콘');
    const inserted = await read(page), id = inserted.blocks[0].instance_id;
    const selector = '[data-v3-node="' + id + '"]';
    await layer(page, id).click();
    await expect(page.frameLocator('iframe').locator(selector)).toHaveCSS('width', '24px');
    await expect(page.frameLocator('iframe').locator(selector)).toHaveAttribute('role', 'button');
    await expect(page.frameLocator('iframe').locator(selector)).toHaveAccessibleName('아이콘');
    await expect(page.frameLocator('iframe').locator(selector)).not.toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByLabel('아이콘 설명', { exact: true })).toBeDisabled();
    await page.getByLabel('장식용 아이콘', { exact: true }).uncheck();
    await click(page, '아이콘 적용');
    await expect(page.getByRole('alert')).toContainText('icon_label');
    expect(await read(page)).toEqual(inserted);
    await page.getByLabel('아이콘 설명', { exact: true }).fill('안내 <문자> "설명"');
    await page.getByLabel('아이콘 종류', { exact: true }).selectOption('star');
    await click(page, '아이콘 적용');
    await expect.poll(async () => (await read(page)).blocks[0].props).toEqual({ icon: 'star', label: '안내 <문자> "설명"', decorative: false });
    const meaningful = await read(page);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(inserted);
    await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(meaningful);
    await length(page, '너비', 48); await length(page, '높이', 32);
    await enable(page, '색상');
    await page.getByLabel('색상 형식', { exact: true }).selectOption({ label: 'hex' });
    await page.getByLabel('색상 값', { exact: true }).fill('#2255cc');
    await click(page, '디자인 적용');
    const styled = await read(page);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(meaningful);
    await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(styled);
    await canvasWidth(page, 360); await layer(page, id).click();
    await length(page, '너비', 20); await length(page, '높이', 20); await click(page, '디자인 적용');
    await expect.poll(async () => (await read(page)).blocks[0].responsive.mobile?.width).toEqual({ value: 20, unit: 'px' });
    expect((await read(page)).blocks[0].style).toEqual(styled.blocks[0].style);
    const authored = await read(page);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(styled);
    await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(authored);
    await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
    const saved = await page.evaluate(() => JSON.parse(window.v3Proof.saved!) as DocumentV3);
    expect(saved).toEqual(authored);
    await open(page, saved, false, []); await layer(page, id).click();
    const names = await page.getByLabel('아이콘 종류', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.getAttribute('value')));
    const schema = JSON.parse(readFileSync(new URL('../../schemas/page-builder-document-v3.schema.json', import.meta.url), 'utf8'));
    expect(names).toEqual(schema.$defs.node.properties.props.anyOf.find((rule: { properties?: { icon?: unknown } }) => rule.properties?.icon).properties.icon.enum);
    expect(names).toHaveLength(23);
    // New composition data arrives after the same editor bundle was built.
    const gallery = structuredClone(saved), original = gallery.blocks[0];
    if (original.type !== 'media.icon') throw new Error('Missing authored icon');
    gallery.blocks = names.map((name, index) => ({ ...structuredClone(original),
      instance_id: '00000000-0000-4000-8000-' + String(900 + index).padStart(12, '0'),
      props: { ...original.props, icon: name as typeof original.props.icon, decorative: index % 2 === 0 } }));
    const measure = (element: Element) => [...element.querySelectorAll<HTMLElement>('[data-v3-node]')].map(node => {
      const box = node.getBoundingClientRect(), svg = node.querySelector('svg')!, graphic = svg.getBoundingClientRect();
      return { id: node.dataset.v3Node, width: box.width, height: box.height, svgWidth: graphic.width, svgHeight: graphic.height,
        color: getComputedStyle(svg).color, stroke: getComputedStyle(svg).stroke, strokeWidth: getComputedStyle(svg).strokeWidth,
        role: node.getAttribute('role'), label: node.getAttribute('aria-label'), hidden: node.getAttribute('aria-hidden'),
        viewBox: svg.getAttribute('viewBox'), shapes: [...svg.children].map(child => {
          const shape = child as SVGGeometryElement, bounds = shape.getBBox();
          return { tag: shape.tagName, fill: getComputedStyle(shape).fill, length: shape.getTotalLength(),
            x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        }) };
    });
    for (const width of [1280, 768, 360]) {
      await open(page, gallery, false, []); await canvasWidth(page, width);
      const canvas = await page.frameLocator('iframe').locator('[data-v3-surface]').evaluate(measure);
      await click(page, '구조 미리보기');
      const preview = await page.getByTestId('v3-preview').evaluate(measure);
      const output = await context.newPage(); await output.setViewportSize({ width, height: 1000 });
      await output.route('**/*', route => route.abort());
      await output.setContent('<!doctype html><html lang="ko"><body style="margin:0">' + phpDraft(gallery, expectedViewport(width)) + '</body></html>');
      const php = await output.locator('[data-v3-surface]').evaluate(measure);
      expect(canvas).toHaveLength(23);
      for (const [index, node] of canvas.entries()) {
        expect(node.hidden).toBeNull();
        expect(node.role).toBe(index % 2 === 0 ? 'button' : 'img');
        expect(node.label).toBe(index % 2 === 0 ? original.name : original.props.label);
      }
      for (const other of [preview, php]) for (const [index, node] of other.entries()) {
        const { width: w, height, svgWidth, svgHeight, shapes, ...meaning } = node;
        const { width: cw, height: ch, svgWidth: sw, svgHeight: sh, shapes: cs, ...canvasMeaning } = canvas[index];
        // Editing controls belong to Puck. Authored semantics remain identical
        // between the non-interactive React preview and PHP output.
        expect(meaning).toEqual({ ...canvasMeaning, role: index % 2 === 0 ? null : 'img',
          label: index % 2 === 0 ? null : original.props.label, hidden: index % 2 === 0 ? 'true' : null });
        for (const delta of [w - cw, height - ch, svgWidth - sw, svgHeight - sh]) expect(Math.abs(delta)).toBeLessThanOrEqual(1);
        expect(shapes).toHaveLength(cs.length);
        for (const [n, shape] of shapes.entries()) {
          expect([shape.tag, shape.fill]).toEqual([cs[n].tag, cs[n].fill]);
          for (const key of ['length', 'x', 'y', 'width', 'height'] as const) expect(Math.abs(shape[key] - cs[n][key])).toBeLessThanOrEqual(0.01);
        }
      }
      expect(canvas.every(node => node.width === (width === 360 ? 20 : 48) && node.svgWidth === node.width && node.svgHeight === node.height)).toBe(true);
      expect(await read(page)).toEqual(gallery);
      await info.attach('common-icons-' + width, { contentType: 'application/json', body: JSON.stringify({ canvas, preview, php }) });
      await page.screenshot({ path: info.outputPath('common-icons-preview-' + width + '.png'), fullPage: true });
      await output.screenshot({ path: info.outputPath('common-icons-php-' + width + '.png'), fullPage: true });
      await output.close();
    }
    await open(page, saved, true, []); await layer(page, id).click();
    await expect(page.getByLabel('아이콘 종류', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '아이콘 적용', exact: true })).toBeDisabled();
    expect(await read(page)).toEqual(saved); expect(errors).toEqual([]);
  });
  test('v3 empty catalog builds an interactive composition from primitive insertions', async ({ page }, info) => {
    await open(page, undefined, false, []);
    const add = async (label: string, parent = 'root') => {
      await page.getByLabel('삽입 위치', { exact: true }).selectOption(parent);
      const before = new Set(allNodes((await read(page)).blocks).map(node => node.instance_id));
      await insert(page, label);
      return allNodes((await read(page)).blocks).find(node => !before.has(node.instance_id))!.instance_id;
    };
    const host = await add('섹션'), tablist = await add('컨테이너', host);
    const first = await add('동작 버튼', tablist), second = await add('동작 버튼', tablist);
    const firstPanel = await add('컨테이너', host); await add('본문', firstPanel);
    const secondPanel = await add('컨테이너', host); await add('제목', secondPanel);
    const before = await read(page);
    await layer(page, host).click();
    const behavior: Behavior = { kind: 'tabs', label: '직접 만든 구성', orientation: 'horizontal', tablist_id: tablist,
      active_panel_id: firstPanel, pairs: [{ trigger_id: first, panel_id: firstPanel }, { trigger_id: second, panel_id: secondPanel }] };
    await connectBehavior(page, behavior); await click(page, '동작 적용');
    await expect.poll(async () => (await read(page)).blocks[0].behavior).toEqual(behavior);
    const connected = await read(page);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
    await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(connected);
    await layer(page, first).click();
    await page.getByLabel('버튼 문구', { exact: true }).fill('첫 내용 <문자>'); await click(page, '버튼 문구 적용');
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(connected);
    await click(page, '다시 실행');
    const authored = await read(page);
    await click(page, '구조 미리보기');
    const preview = page.getByTestId('v3-preview');
    await expect(preview.locator('[data-v3-node="' + first + '"]')).toHaveText('첫 내용 <문자>');
    await preview.getByRole('tab').first().focus(); await page.keyboard.press('ArrowRight');
    await expect(preview.locator('[data-v3-node="' + second + '"]')).toHaveAttribute('aria-selected', 'true');
    await expect(preview.locator('[data-v3-node="' + secondPanel + '"]')).toBeVisible();
    expect(await read(page)).toEqual(authored);
    await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
    const saved = await page.evaluate(() => JSON.parse(window.v3Proof.saved!) as DocumentV3);
    expect(saved).toEqual(authored);
    await open(page, saved, false, []); await click(page, '구조 미리보기');
    await expect(page.getByTestId('v3-preview').locator('[data-v3-node="' + first + '"]')).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: info.outputPath('primitive-authored-tabs.png'), fullPage: true });
  });
  for (const kind of ['tabs', 'disclosure', 'carousel', 'nested'] as const) {
    test('v3 common behavior connections edit save reopen and match PHP output ' + kind, async ({ page, context }, info) => {
      const cases = JSON.parse(readFileSync(new URL('../Fixtures/document-v3-cases.json', import.meta.url), 'utf8')) as { behavior_fixtures: Record<typeof kind, Node[]> };
      // Ordinary data created after the product build. No composition registry or factory.
      const source: DocumentV3 = { ...structuredClone(fixture), blocks: structuredClone(cases.behavior_fixtures[kind]) };
      source.blocks[0].name = '새 동작 구성 ' + Date.now();
      // Leave the first button unstyled to catch native host defaults, and
      // independently prove authored appearance wins at every breakpoint.
      const styled = allNodes(source.blocks).filter(node => node.type === 'action.button')[1];
      styled.style = { background: { kind: 'solid', color: { kind: 'token', value: 'primary' } },
        color: { kind: 'token', value: 'surface' }, border_bottom: { width: 2, style: 'solid', color: { kind: 'token', value: 'accent' } } };
      styled.responsive.mobile = { background: { kind: 'solid', color: { kind: 'token', value: 'text' } } };
      styled.responsive.tablet = { background: { kind: 'linear', angle: 90, stops: [
        { offset: 0, color: { kind: 'token', value: 'primary' } }, { offset: 1, color: { kind: 'token', value: 'accent' } },
      ] } };
      const connections = allNodes(source.blocks).filter(node => node.behavior).map(node => ({ id: node.instance_id, behavior: structuredClone(node.behavior!) }));
      for (const node of allNodes(source.blocks)) delete node.behavior;
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const selector = (id: string) => '[data-v3-node="' + id + '"]';
      const measure = (element: Element) => {
        const origin = element.getBoundingClientRect();
        return [...element.querySelectorAll<HTMLElement>('[data-v3-node]')].map(node => {
          const box = node.getBoundingClientRect(), css = getComputedStyle(node);
          const shown = node.checkVisibility();
          return { id: node.dataset.v3Node, tag: node.tagName, text: node.textContent, shown, inert: node.inert,
            x: shown ? box.x - origin.x : 0, y: shown ? box.y - origin.y : 0, width: box.width, height: box.height,
            font: css.fontFamily, fontSize: css.fontSize, lineHeight: css.lineHeight, display: css.display,
            color: css.color, backgroundColor: css.backgroundColor, backgroundImage: css.backgroundImage,
            borders: ['top', 'right', 'bottom', 'left'].map(side => ['width', 'style', 'color'].map(property =>
              css.getPropertyValue('border-' + side + '-' + property))),
            textAlign: css.textAlign, boxShadow: css.boxShadow,
            role: node.getAttribute('role'), controls: node.getAttribute('aria-controls'), selected: node.getAttribute('aria-selected'),
            expanded: node.getAttribute('aria-expanded'), hidden: node.getAttribute('aria-hidden'), pressed: node.getAttribute('aria-pressed') };
        });
      };
      for (const width of [360, 768, 1280]) {
        await open(page, source, false, []); await canvasWidth(page, width);
        for (const { id, behavior } of connections) {
          const before = await read(page);
          await layer(page, id).click(); await connectBehavior(page, behavior); await click(page, '동작 적용');
          await expect.poll(async () => allNodes((await read(page)).blocks).find(node => node.instance_id === id)?.behavior).toEqual(behavior);
          const connected = await read(page);
          await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
          await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(connected);
        }
        const connected = await read(page);
        const button = allNodes(connected.blocks).find(node => node.type === 'action.button')!;
        await layer(page, button.instance_id).click(); await click(page, '본문 입력');
        // Puck's plain-text field activates on pointer/focus and uses
        // plaintext-only, unlike the separate Tiptap rich-text editor.
        const editable = page.frameLocator('iframe').locator(selector(button.instance_id) + ' [contenteditable]');
        await expect(editable).toBeVisible(); await editable.hover(); await editable.click();
        await expect(editable).toHaveAttribute('contenteditable', 'plaintext-only');
        await editable.fill('직접 입력 <문자> ' + width);
        await expect.poll(async () => allNodes((await read(page)).blocks).find(node => node.instance_id === button.instance_id)?.props).toEqual({ label: '직접 입력 <문자> ' + width });
        const edited = await read(page);
        await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(connected);
        await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(edited);
        await click(page, '구조 선택');
        const authored = await read(page);
        await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
        const saved = await page.evaluate(() => JSON.parse(window.v3Proof.saved!) as DocumentV3);
        expect(saved).toEqual(authored);
        await open(page, saved, false, []); await canvasWidth(page, width);
        await expect(page.frameLocator('iframe').locator(selector(button.instance_id))).toHaveText('직접 입력 <문자> ' + width);
        await page.emulateMedia({ reducedMotion: 'reduce' }); await click(page, '구조 미리보기');
        const preview = page.getByTestId('v3-preview');
        const output = await context.newPage(); output.on('pageerror', error => errors.push(error.message));
        await output.setViewportSize({ width, height: 1000 }); await output.emulateMedia({ reducedMotion: 'reduce' });
        const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
          + '<link rel="stylesheet" href="/public.css"><script defer src="/page-effects.iife.js"></script></head><body style="margin:0"><main class="g7pb-page">'
          + phpDraft(saved, expectedViewport(width)) + '</main></body></html>';
        await output.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin !== 'https://v3-output.test') return route.abort('blockedbyclient');
          if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
          const assets: Record<string, string> = { '/public.css': 'dist/css/page-builder-public.css',
            '/page-effects.iife.js': 'dist/js/page-effects.iife.js', '/page-sliders.iife.js': 'dist/js/page-sliders.iife.js' };
          if (assets[url.pathname]) return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript', body: readFileSync(assets[url.pathname]) });
          return route.abort('blockedbyclient');
        });
        await output.goto('https://v3-output.test/');
        const php = output.locator('[data-v3-surface]');
        for (const { id, behavior } of connections) {
          const attribute = behavior.kind === 'tabs' ? 'data-g7pb-tabs-ready' : behavior.kind === 'disclosure' ? 'data-g7pb-accordion-ready' : 'data-g7pb-slider-ready';
          await expect(preview.locator(selector(id))).toHaveAttribute(attribute, 'true');
          await expect(php.locator(selector(id))).toHaveAttribute(attribute, 'true');
        }
        const parity = async (phase: string) => {
          const actual = await preview.evaluate(measure), expected = await php.evaluate(measure);
          await info.attach(kind + '-' + width + '-' + phase, { contentType: 'application/json', body: JSON.stringify({ actual, expected }) });
          expect(actual.map(node => node.id)).toEqual(expected.map(node => node.id));
          for (let i = 0; i < actual.length; i++) {
            const { x, y, width: w, height, ...attributes } = actual[i];
            const { x: px, y: py, width: pw, height: ph, ...phpAttributes } = expected[i];
            expect(attributes, kind + ':' + actual[i].id).toEqual(phpAttributes);
            for (const delta of [x - px, y - py, w - pw, height - ph]) expect(Math.abs(delta)).toBeLessThanOrEqual(1);
          }
        };
        await parity('initial');
        // Nested connections are exercised before their outer tab hides them.
        for (const { behavior } of [...connections].reverse()) {
          for (const target of [preview, php]) {
            if (behavior.kind === 'tabs') {
              await target.locator(selector(behavior.pairs[0].trigger_id)).focus();
              await target.locator(selector(behavior.pairs[0].trigger_id)).press(behavior.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight');
              await expect(target.locator(selector(behavior.pairs[1].trigger_id))).toHaveAttribute('aria-selected', 'true');
            } else if (behavior.kind === 'disclosure') {
              await target.locator(selector(behavior.pairs[1].trigger_id)).press('Enter');
              await expect(target.locator(selector(behavior.pairs[1].trigger_id))).toHaveAttribute('aria-expanded', 'true');
            } else {
              await target.locator(selector(behavior.next_id)).click();
              const slides = allNodes(saved.blocks).find(node => node.instance_id === behavior.track_id)!.slots.content!;
              await expect(target.locator(selector(slides[1].instance_id))).toHaveAttribute('aria-hidden', 'false');
              await expect(target.locator(selector(slides[0].instance_id))).toHaveAttribute('aria-hidden', 'true');
              await expect(target.locator(selector(slides[1].instance_id))).toHaveJSProperty('inert', false);
              await expect(target.locator(selector(slides[0].instance_id))).toHaveJSProperty('inert', true);
            }
          }
          // Embla finishes its actual animation before geometry is compared.
          await expect.poll(async () => {
            const actual = await preview.evaluate(measure), expected = await php.evaluate(measure);
            return Math.max(...actual.flatMap((node, index) => ['x', 'y', 'width', 'height'].map(key => {
              const field = key as 'x' | 'y' | 'width' | 'height';
              return Math.abs(node[field] - expected[index][field]);
            })));
          }).toBeLessThanOrEqual(1);
          await parity('activated-' + behavior.kind);
        }
        expect(await read(page)).toEqual(saved);
        await page.screenshot({ path: info.outputPath(kind + '-preview-' + width + '.png'), fullPage: true });
        await output.screenshot({ path: info.outputPath(kind + '-php-' + width + '.png'), fullPage: true });
        await output.close(); await click(page, '구조 미리보기');
        await expect(page.frameLocator('iframe').locator(selector(button.instance_id))).toHaveText('직접 입력 <문자> ' + width);
        expect(await read(page)).toEqual(saved);
      }
      expect(errors).toEqual([]);
      await open(page, source, true, []); await layer(page, source.blocks[0].instance_id).click();
      await expect(page.getByLabel('동작 유형', { exact: true })).toBeDisabled();
      expect(await read(page)).toEqual(source);
    });
  }
});
test.describe(() => {
// SPEC-09 is desktop authoring at all canvas widths. Do not mix a Linux
// keyboard/platform with an iOS touch UA: Tiptap maps Ctrl+A to line start
// in that hybrid context. Existing device-context regression tests stay below.
test.use({ isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });
test('v3 unknown composition data edits in the same built bundle without registration', async ({ page }, info) => {
  // Created only after beforeAll builds the product. The product cannot know
  // this name, identity or nested layout, and is never rebuilt for this input.
  const source = structuredClone(fixture);
  source.document_id = '30000000-0000-4000-8000-000000000001';
  source.blocks[0].name = '새 구성 ' + Date.now();
  source.assets[0].url = '/image.svg';
  const root = source.blocks[0];
  root.style = { display: 'grid', columns: [{ fr: 2 }, { fr: 3 }], column_gap: { value: 17, unit: 'px' } };
  root.responsive = { mobile: { columns: [{ fr: 1 }], row_gap: { value: 23, unit: 'px' } } };
  for (const node of root.slots.content!) { node.style = {}; node.responsive = {}; }
  const frame: Node = { ...structuredClone(root), type: 'layout.container', instance_id: '30000000-0000-4000-8000-000000000002',
    name: '새 중첩 프레임', props: { tag: 'div' }, style: { display: 'flex', direction: 'column', row_gap: { value: 13, unit: 'px' } },
    responsive: {}, slots: { content: root.slots.content!.splice(2) } };
  root.slots.content!.push(frame);
  const flatten = (nodes: Node[]): Node[] => nodes.flatMap(node => [node, ...flatten(node.slots.content ?? [])]);
  const original = JSON.stringify(source), sourceIds = flatten(source.blocks).map(node => node.instance_id);
  for (const width of [360, 768, 1280]) {
    await open(page, undefined, false, [source]); await canvasWidth(page, width);
    await page.getByLabel('구성 검색', { exact: true }).fill(source.blocks[0].name);
    await expect(page.getByLabel('구성 선택', { exact: true }).locator('option')).toHaveCount(1);
    const empty = await read(page);
    await click(page, '구성 삽입');
    await expect.poll(async () => (await read(page)).blocks.length).toBe(1);
    const inserted = await read(page);
    expect(inserted.document_id).toBe(empty.document_id); expect(inserted.slug).toBe(empty.slug);
    expect(flatten(inserted.blocks).every(node => !sourceIds.includes(node.instance_id))).toBe(true);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(empty);
    await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(inserted);
    const text = flatten(inserted.blocks).find(node => node.type === 'content.text')!;
    await layer(page, text.instance_id).click();
    await length(page, '글자 크기', 21); await click(page, '디자인 적용');
    await click(page, '본문 입력');
    const target = page.frameLocator('iframe').locator('[data-v3-node="' + text.instance_id + '"]');
    await target.locator('[contenteditable]').click();
    const editable = target.locator('.tiptap[contenteditable="true"]');
    await expect(editable).toBeVisible(); await editable.click();
    const previousText = await editable.textContent();
    await editable.press('ControlOrMeta+A');
    await expect.poll(() => editable.evaluate(element => element.ownerDocument.getSelection()?.toString())).toBe(previousText);
    await page.keyboard.insertText('새 구성의 정확한 문구 ' + width);
    await expect.poll(async () => {
      const current = flatten((await read(page)).blocks).find(node => node.instance_id === text.instance_id);
      return current?.type === 'content.text' ? current.props.paragraphs.map(runs => runs.map(run => run.text).join('')).join('\n') : null;
    }).toBe('새 구성의 정확한 문구 ' + width);
    await click(page, '구조 선택'); await layer(page, text.instance_id).click();
    const edited = await read(page);
    await click(page, '복제');
    await expect.poll(async () => flatten((await read(page)).blocks).length).toBe(flatten(edited.blocks).length + 1);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(edited);
    await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
    const saved = await page.evaluate(() => JSON.parse(window.v3Proof.saved!) as DocumentV3);
    expect(saved).toEqual(edited);
    await open(page, saved, false, [source]); await canvasWidth(page, width);
    await expect(page.frameLocator('iframe').locator('[data-v3-node="' + text.instance_id + '"]')).toHaveText('새 구성의 정확한 문구 ' + width);
    await page.screenshot({ path: info.outputPath('unknown-composition-' + width + '.png'), fullPage: true });
    await info.attach('unknown-composition-' + width, { contentType: 'application/json', body: JSON.stringify(saved) });
  }
  expect(JSON.stringify(source)).toBe(original);
  await open(page, undefined, false, []);
  await expect(page.getByRole('button', { name: '구성 삽입', exact: true })).toBeDisabled();
  await insert(page, '제목');
  await expect.poll(async () => (await read(page)).blocks[0].type).toBe('content.heading');
});
});
const basicCompositionKeys = ['hero.poster', 'hero.product', 'hero.backdrop', 'hero.editorial', 'hero.device',
  'hero.balanced', 'hero.screenshot', 'hero.overlap', 'hero.offset', 'card.plain', 'card.outlined', 'image-text.left', 'image-text.right'];
const repeatedCompositionKeys = ["buttons.primary-secondary","buttons.centered-actions","process.four-step","logo-cloud.partners","pricing.three-tier","team.leadership","gallery.project-scenes","testimonials.customer-proof","comparison.plans","articles.insights","events.upcoming","downloads.resource-center","card-grid.services","breadcrumbs.detail-page","logo-cloud.grid","logo-cloud.panel","pricing.cards","pricing.compact","pricing.editorial","team.grid","team.editorial","team.featured","gallery.grid","gallery.masonry","gallery.filmstrip","testimonials.grid","testimonials.spotlight","testimonials.split","testimonials.quote-hero","articles.list","articles.grid","articles.featured","articles.editorial","card-grid.grid","card-grid.rail","card-grid.editorial","card-grid.numbered","list.simple"];
const staticCompositionKeys = ['heading.section-intro', 'heading.compact-title', 'image.landscape', 'image.square', 'cta.contact',
  'bar-chart.quarterly', 'divider.section-break', 'blockquote.customer-voice', 'notice.service-info', 'cta.centered', 'cta.banner', 'cta.panel'];
function compositionId(key: string): string {
  const entry = builtinCompositions.find(source => source.slug === key.replaceAll('.', '-'));
  if (!entry) throw new Error('Missing canonical starter data: ' + key);
  return entry.document_id;
}
const bundledManifest = JSON.parse(readFileSync(new URL('../../resources/block-packs/builtin-core/manifest.json', import.meta.url), 'utf8')) as {
  presets: { preset_id: string; props: unknown }[] };
const previewPrefix = '/modules/jiwonpapa-page_builder/store/previews/';
function collectPreviewAssets(value: unknown): void {
  if (typeof value === 'string' && value.startsWith(previewPrefix)) {
    const name = value.slice(previewPrefix.length);
    if (!/^[a-z0-9-]+\.(webp|png)$/.test(name)) throw new Error('Unexpected bundled preview asset: ' + name);
    bundledPreviewAssets.set(value, { contentType: name.endsWith('.png') ? 'image/png' : 'image/webp',
      body: readFileSync(new URL('../../resources/store/dist/previews/' + name, import.meta.url)) });
  } else if (Array.isArray(value)) value.forEach(collectPreviewAssets);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectPreviewAssets);
}
for (const key of [...repeatedCompositionKeys, ...staticCompositionKeys]) {
  const preset = bundledManifest.presets.find(preset => preset.preset_id === key);
  if (!preset) throw new Error('Missing bundled repeated preset: ' + key);
  collectPreviewAssets(preset.props);
}
collectPreviewAssets(builtinCompositions);
test('v3 semantic lists tables and figures preserve editing grammar and PHP parity', async ({ page, context }, info) => {
  interface TagTree { tag: LayoutTag | 'text'; children?: TagTree[] }
  const cases = JSON.parse(readFileSync(new URL('../Fixtures/document-v3-cases.json', import.meta.url), 'utf8')) as {
    semantics: { name: string; tree: TagTree[]; valid: boolean }[] };
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const seen = new Set<string>(), proofs: unknown[] = [];
  const flatten = (nodes: Node[]): Node[] => nodes.flatMap(node => [node, ...flatten(node.slots.content ?? [])]);
  const measure = (element: Element) => {
    const origin = element.getBoundingClientRect();
    return [...element.querySelectorAll('[data-v3-node]')].map(node => {
      const box = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { id: node.getAttribute('data-v3-node'), tag: node.tagName, text: node.textContent,
        x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height, display: css.display };
    });
  };
  for (const entry of cases.semantics.filter(entry => entry.valid)) {
    let sequence = 0;
    const nodes = (tree: TagTree[]): Node[] => tree.map(({ tag, children = [] }) => {
      seen.add(tag);
      const base = { instance_id: '00000000-0000-4000-8000-' + String(++sequence).padStart(12, '0'),
        block_version: 1 as const, name: tag, locked: false, style: {}, responsive: {} };
      return tag === 'text' ? { ...base, type: 'content.text', props: { paragraphs: [[{ text: '한글 목록과 비교표' }]] }, slots: {} }
        : { ...base, type: 'layout.container', props: { tag }, slots: { content: nodes(children) } };
    });
    const document: DocumentV3 = { ...structuredClone(fixture), blocks: nodes(entry.tree) };
    await open(page, document);
    const root = document.blocks[0], text = flatten(document.blocks).find(node => node.type === 'content.text');
    if (root.type === 'layout.container' && ['ul', 'ol', 'dl', 'table'].includes(root.props.tag)) {
      await page.getByLabel('삽입 위치', { exact: true }).selectOption(root.instance_id);
      await click(page, '제목 삽입');
      await expect(page.getByRole('status', { name: '편집 상태' })).toContainText('semantic_');
      expect(await read(page)).toEqual(document);
    }
    if (text) {
      await layer(page, text.instance_id).click(); await length(page, '글자 크기', 21); await click(page, '디자인 적용');
      const designed = await read(page);
      await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(document);
      await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(designed);
      await click(page, '본문 입력');
      const editable = page.frameLocator('iframe').locator('[data-v3-node="' + text.instance_id + '"] .tiptap[contenteditable="true"]');
      await expect(editable).toBeVisible(); await editable.fill('내용 변경 <안전한 문자>');
      await expect.poll(async () => flatten((await read(page)).blocks).find(node => node.instance_id === text.instance_id)?.props)
        .toEqual({ paragraphs: [[{ text: '내용 변경 <안전한 문자>' }]] });
    }
    await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
    const saved = await page.evaluate(() => JSON.parse(window.v3Proof.saved!) as DocumentV3);
    expect(saved).toEqual(await read(page));
    for (const width of [360, 768, 1280]) {
      await open(page, saved); await canvasWidth(page, width);
      const canvas = await page.frameLocator('iframe').locator('[data-v3-surface]').evaluate(measure);
      expect(canvas).toHaveLength(flatten(saved.blocks).length);
      await click(page, '구조 미리보기');
      const preview = await page.getByTestId('v3-preview').evaluate(measure);
      const output = await context.newPage(); await output.setViewportSize({ width, height: 1000 });
      await output.setContent('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + phpDraft(saved, expectedViewport(width)) + '</body></html>');
      const php = await output.locator('[data-v3-surface]').evaluate(measure);
      proofs.push({ name: entry.name, width, canvas, preview, php });
      await info.attach(entry.name + '-' + width, { contentType: 'application/json', body: JSON.stringify({ canvas, preview, php }) });
      for (const other of [preview, php]) {
        expect(other.map(node => node.id)).toEqual(canvas.map(node => node.id));
        for (let index = 0; index < canvas.length; index++) {
          for (const dimension of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(other[index][dimension] - canvas[index][dimension]), entry.name + ':' + width + ':' + index + ':' + dimension).toBeLessThanOrEqual(1);
          for (const property of ['tag', 'text', 'display'] as const) expect(other[index][property]).toEqual(canvas[index][property]);
        }
      }
      if (entry.name === 'full comparison table') {
        await page.screenshot({ path: info.outputPath('ip7-semantic-table-' + width + '.png'), fullPage: true });
        await output.screenshot({ path: info.outputPath('ip7-semantic-table-php-' + width + '.png'), fullPage: true });
      }
      await output.close();
    }
  }
  expect([...seen].sort()).toEqual(['ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'figure', 'figcaption', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'text', 'div'].sort());
  expect(errors).toEqual([]);
  await info.attach('ip7-semantic-parity', { contentType: 'application/json', body: JSON.stringify(proofs) });
});
for (const key of basicCompositionKeys) test('v3 composition internal edit save reopen and PHP parity ' + key, async ({ page, context }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  expect(await page.getByLabel('구성 선택', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.getAttribute('value')))).toEqual(builtinCompositions.map(source => source.document_id));
  const empty = await read(page);
  await page.getByLabel('구성 선택', { exact: true }).selectOption(compositionId(key)); await click(page, '구성 삽입');
  await expect.poll(async () => (await read(page)).blocks.length).toBe(1);
  const inserted = await read(page);
  const flatten = (nodes: DocumentV3['blocks']): DocumentV3['blocks'] => nodes.flatMap(node => [node, ...flatten(node.slots.content ?? [])]);
  const nodes = flatten(inserted.blocks);
  expect(nodes).toHaveLength(8);
  expect(new Set(nodes.map(node => node.instance_id)).size).toBe(8);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(empty);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(inserted);
  const heading = nodes.find(node => node.type === 'content.heading')!;
  await layer(page, heading.instance_id).click();
  await length(page, '글자 크기', 31); await click(page, '디자인 적용');
  await expect.poll(async () => flatten((await read(page)).blocks).find(node => node.instance_id === heading.instance_id)?.style.font_size).toEqual({ value: 31, unit: 'px' });
  const edited = await read(page);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(inserted);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(edited);
  await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
  const saved = await page.evaluate(() => JSON.parse(window.v3Proof.saved!) as DocumentV3);
  expect(saved).toEqual(edited);
  const evidence: unknown[] = [];
  const measure = (element: Element) => {
    const origin = element.getBoundingClientRect();
    return [...element.querySelectorAll('[data-v3-node]')].map(node => {
      const box = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { id: node.getAttribute('data-v3-node'), tag: node.tagName, text: node.textContent,
        x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height,
        css: Object.fromEntries(['display', 'position', 'font-size', 'font-family', 'line-height', 'color', 'opacity',
          'row-gap', 'column-gap', 'grid-template-columns', 'border-top-width', 'object-fit'].map(name => [name, css.getPropertyValue(name)])) };
    });
  };
  for (const width of [360, 768, 1280]) {
    await open(page, saved); await canvasWidth(page, width);
    const frame = page.frameLocator('iframe');
    await frame.locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const canvas = await frame.locator('[data-v3-surface]').evaluate(measure);
    await click(page, '구조 미리보기');
    await page.getByTestId('v3-preview').locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const preview = await page.getByTestId('v3-preview').evaluate(measure);
    const output = await context.newPage(); await output.setViewportSize({ width, height: 1000 });
    await output.route('**/*', route => {
      const asset = bundledPreviewAssets.get(new URL(route.request().url()).pathname);
      if (asset) return route.fulfill(asset);
      return route.request().url().endsWith('/image.svg')
        ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="#dbeafe"/></svg>' }) : route.abort();
    });
    await output.setContent('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="https://v3-editor.test/"></head><body style="margin:0">' + phpDraft(saved, expectedViewport(width)) + '</body></html>');
    await output.locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const php = await output.locator('[data-v3-surface]').evaluate(measure);
    await info.attach('ip7-composition-' + width, { contentType: 'application/json', body: JSON.stringify({ key, width, canvas, preview, php }) });
    for (const other of [preview, php]) {
      expect(other.map(node => node.id)).toEqual(canvas.map(node => node.id));
      for (let index = 0; index < canvas.length; index++) {
        for (const dimension of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(other[index][dimension] - canvas[index][dimension]), key + ':' + width + ':' + (other === preview ? 'preview' : 'php') + ':' + canvas[index].tag + ':' + index + ':' + dimension).toBeLessThanOrEqual(1);
        expect(other[index].css).toEqual(canvas[index].css);
        expect(other[index].tag).toBe(canvas[index].tag);
        expect(other[index].text).toBe(canvas[index].text);
      }
    }
    evidence.push({ key, width, canvas, preview, php });
    await page.screenshot({ path: info.outputPath('ip7-' + key + '-' + width + '.png'), fullPage: true });
    await output.close();
  }
  await open(page, saved, true);
  await expect(page.getByRole('button', { name: '구성 삽입', exact: true })).toBeDisabled();
  expect(await read(page)).toEqual(saved);
  expect(errors).toEqual([]);
  await info.attach('ip7-composition-proof', { contentType: 'application/json', body: JSON.stringify(evidence) });
});
for (const family of [
  { name: 'repeated', keys: repeatedCompositionKeys, label: '반복 구성' },
  { name: 'static', keys: staticCompositionKeys, label: '내용 구성' },
]) for (const key of family.keys) test('v3 ' + family.name + ' composition internal edit assets save reopen and PHP parity ' + key, async ({ page, context }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  expect(await page.getByLabel('구성 선택', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.getAttribute('value')))).toEqual(builtinCompositions.map(source => source.document_id));
  const empty = await read(page);
  await page.getByLabel('구성 선택', { exact: true }).selectOption(compositionId(key)); await click(page, '구성 삽입');
  await expect.poll(async () => (await read(page)).blocks.length).toBe(1);
  const inserted = await read(page);
  const flatten = (nodes: Node[]): Node[] => nodes.flatMap(node => [node, ...flatten(node.slots.content ?? [])]);
  const nodes = flatten(inserted.blocks);
  expect(new Set(nodes.map(node => node.instance_id)).size).toBe(nodes.length);
  expect(nodes.every(node => !node.locked)).toBe(true);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(empty);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(inserted);
  // Prefer an item-level leaf, not only the enclosing section heading.
  const inner = nodes.filter(node => ['content.text', 'content.heading', 'action.link'].includes(node.type)).at(-1)!;
  await layer(page, inner.instance_id).click();
  await length(page, '글자 크기', 23); await click(page, '디자인 적용');
  await expect.poll(async () => flatten((await read(page)).blocks).find(node => node.instance_id === inner.instance_id)?.style.font_size).toEqual({ value: 23, unit: 'px' });
  const styled = await read(page);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(inserted);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(styled);
  await click(page, '본문 입력');
  const content = page.frameLocator('iframe').locator('[data-v3-node="' + inner.instance_id + '"]');
  const activation = content.locator('[contenteditable]');
  await expect(activation).toBeVisible(); await activation.hover(); await activation.click();
  // Puck lazily mounts Tiptap on activation; its preceding rich-text placeholder
  // is also contenteditable but is not the canonical editing input.
  const editable = content.locator(inner.type === 'action.link' ? '[contenteditable]' : '.tiptap[contenteditable="true"]');
  await expect(editable).toBeVisible();
  await expect(editable).toHaveAttribute('contenteditable', /^(true|plaintext-only)$/);
  await editable.click(); await editable.press('ControlOrMeta+A');
  await page.keyboard.insertText('내부 항목 수정 <안전한 문자>');
  await expect.poll(async () => JSON.stringify(flatten((await read(page)).blocks).find(node => node.instance_id === inner.instance_id)?.props)).toContain('내부 항목 수정 <안전한 문자>');
  // Cross Puck's 200ms input/debounce window, then continue without refocusing.
  // A remounted slot used to revert text and silently discard the next input.
  await page.waitForTimeout(300);
  await expect(editable).toBeFocused();
  await page.keyboard.insertText(' 계속 입력');
  await expect.poll(async () => JSON.stringify(flatten((await read(page)).blocks).find(node => node.instance_id === inner.instance_id)?.props)).toContain('내부 항목 수정 <안전한 문자> 계속 입력');
  await page.waitForTimeout(300);
  await expect(editable).toBeFocused();
  const edited = await read(page);
  await click(page, '실행 취소');
  await expect.poll(async () => JSON.stringify(flatten((await read(page)).blocks).find(node => node.instance_id === inner.instance_id)?.props)).not.toContain('계속 입력');
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(edited);
  await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
  const saved = await page.evaluate(() => JSON.parse(window.v3Proof.saved!) as DocumentV3);
  expect(saved).toEqual(await read(page));
  const measure = (element: Element) => {
    const origin = element.getBoundingClientRect();
    return [...element.querySelectorAll('[data-v3-node]')].map(node => {
      const box = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { id: node.getAttribute('data-v3-node'), tag: node.tagName, text: node.textContent,
        src: node.getAttribute('src'), alt: node.getAttribute('alt'), href: node.getAttribute('href'),
        x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height,
        css: Object.fromEntries(['display', 'position', 'font-size', 'font-family', 'line-height', 'color', 'background-color', 'background-image',
          'row-gap', 'column-gap', 'grid-template-columns', 'border-top-width', 'object-fit'].map(name => [name, css.getPropertyValue(name)])) };
    });
  };
  for (const width of [360, 768, 1280]) {
    await open(page, saved); await canvasWidth(page, width);
    const frame = page.frameLocator('iframe');
    await frame.locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const canvas = await frame.locator('[data-v3-surface]').evaluate(measure);
    expect(canvas).toHaveLength(nodes.length);
    for (const node of canvas) {
      expect(node.x, key + ':' + width + ':' + node.id + ':left').toBeGreaterThanOrEqual(-1);
      expect(node.x + node.width, key + ':' + width + ':' + node.id + ':right').toBeLessThanOrEqual(width + 1);
    }
    await click(page, '구조 미리보기');
    await page.getByTestId('v3-preview').locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const preview = await page.getByTestId('v3-preview').evaluate(measure);
    const output = await context.newPage(); await output.setViewportSize({ width, height: 1000 });
    await output.route('**/*', route => {
      const asset = bundledPreviewAssets.get(new URL(route.request().url()).pathname);
      return asset ? route.fulfill(asset) : route.abort();
    });
    await output.setContent('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="https://v3-editor.test/"></head><body style="margin:0">' + phpDraft(saved, expectedViewport(width)) + '</body></html>');
    await output.locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const php = await output.locator('[data-v3-surface]').evaluate(measure);
    await info.attach('ip7-' + family.name + '-' + width, { contentType: 'application/json', body: JSON.stringify({ key, width, canvas, preview, php }) });
    for (const other of [preview, php]) {
      expect(other.map(node => node.id)).toEqual(canvas.map(node => node.id));
      for (let index = 0; index < canvas.length; index++) {
        for (const dimension of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(other[index][dimension] - canvas[index][dimension]), key + ':' + width + ':' + index + ':' + dimension).toBeLessThanOrEqual(1);
        for (const property of ['tag', 'text', 'css', 'src', 'alt', 'href'] as const) expect(other[index][property]).toEqual(canvas[index][property]);
      }
    }
    await page.screenshot({ path: info.outputPath('ip7-' + family.name + '-' + key + '-' + width + '.png'), fullPage: true });
    await output.close();
  }
  await open(page, saved, true);
  await expect(page.getByRole('button', { name: '구성 삽입', exact: true })).toBeDisabled();
  expect(await read(page)).toEqual(saved); expect(errors).toEqual([]);
});
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
function phpDraft(source: DocumentV3, viewport: Viewport = 'base') {
  return execFileSync('php', ['-r', [
    'require "vendor/autoload.php";',
    '$schema=json_decode(file_get_contents("schemas/page-builder-document-v3.schema.json"),true,flags:JSON_THROW_ON_ERROR);',
    '$policy=json_decode(file_get_contents("schemas/design-policy-v3.json"),true,flags:JSON_THROW_ON_ERROR);',
    '$validator=new Modules\\Jiwonpapa\\PageBuilder\\Domain\\Documents\\V3\\Validator($schema,$policy);',
    'echo (new Modules\\Jiwonpapa\\PageBuilder\\Application\\Compilation\\V3\\DraftRenderer($validator))->render(stream_get_contents(STDIN),$argv[1]);',
  ].join(''), viewport], { cwd: fileURLToPath(new URL('../..', import.meta.url)), input: JSON.stringify(source), encoding: 'utf8' });
}
async function insert(page: Page, label: string) {
  await click(page, label + ' 삽입');
  await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장할 변경 있음');
}

function geometryFixture(): DocumentV3 {
  const source = structuredClone(fixture), section = source.blocks[0];
  section.style = { position: 'relative', width: { value: 1100, unit: 'px' }, height: { value: 1200, unit: 'px' } };
  section.responsive = {};
  section.slots.content = [0, 1, 2].map((i) => ({
    ...structuredClone(fixture.blocks[0].slots.content![0]),
    instance_id: '00000000-0000-4000-8000-' + String(70 + i).padStart(12, '0'),
    type: 'content.heading' as const, props: { level: 2, runs: [{ text: '요소 ' + (i + 1) }] },
    name: '요소 ' + (i + 1), responsive: {},
    style: { position: 'absolute' as const, inset_left: { value: [80, 360, 680][i], unit: 'px' as const },
      inset_top: { value: 80, unit: 'px' as const }, width: { value: [160, 120, 160][i], unit: 'px' as const },
      height: { value: 80, unit: 'px' as const }, background: { kind: 'solid' as const, color: { kind: 'hex' as const, value: '#e6efff' } } },
  }));
  return source;
}
for (const zoom of [.5, 1, 2]) {
  test('v3 precise handles at ' + zoom * 100 + '% preserve CSS pixels cancel and one Undo', async ({ page }, info) => {
    const source = geometryFixture(), id = source.blocks[0].slots.content![0].instance_id;
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await open(page, source); await click(page, '정밀 조작');
    await page.getByLabel('작업면 확대', { exact: true }).selectOption(String(zoom));
    await page.getByLabel('스냅 가이드', { exact: true }).uncheck();
    await page.getByRole('region', { name: '작업면' }).evaluate(element => element.scrollTop = 40);
    const frame = page.frameLocator('iframe'), target = frame.locator('[data-v3-node="' + id + '"]');
    await target.click();
    await expect(page.getByRole('heading', { name: '선택 1개', exact: true })).toBeVisible();
    const handle = frame.locator('.moveable-control[data-direction="e"]');
    await expect(handle).toBeVisible();
    const before = await read(page), box = await handle.boundingBox();
    if (!box) throw Error('missing handle');
    await info.attach('ip5-handle-start', { body: JSON.stringify(await handle.evaluate(element => {
      const r = element.getBoundingClientRect();
      return { handle: element.outerHTML, rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        hit: element.ownerDocument.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 500) };
    })), contentType: 'application/json' });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40 * zoom, box.y + box.height / 2, { steps: 8 });
    expect(await read(page)).toEqual(before);
    await page.mouse.up();
    await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.width).toEqual({ value: 200, unit: 'px' });
    const changed = await read(page);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
    await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(changed);
    await target.click(); await expect(handle).toBeVisible();
    const cancelBox = await handle.boundingBox(); if (!cancelBox) throw Error('missing renewed handle');
    await page.mouse.move(cancelBox.x + 4, cancelBox.y + 4); await page.mouse.down();
    await page.mouse.move(cancelBox.x + 4 + 30 * zoom, cancelBox.y + 4, { steps: 5 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    expect(await read(page)).toEqual(changed);
    await expect.poll(() => target.evaluate(element => parseFloat(getComputedStyle(element).width))).toBe(200);
    const undoBox = await handle.boundingBox(); if (!undoBox) throw Error('missing pending Undo handle');
    await page.mouse.move(undoBox.x + undoBox.width / 2, undoBox.y + undoBox.height / 2); await page.mouse.down();
    await page.mouse.move(undoBox.x + undoBox.width / 2 + 30 * zoom, undoBox.y + undoBox.height / 2, { steps: 5 });
    await page.keyboard.press('ControlOrMeta+z'); await page.mouse.up();
    await expect.poll(() => read(page)).toEqual(before);
    await expect.poll(() => target.evaluate(element => parseFloat(getComputedStyle(element).width))).toBe(160);
    await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(changed);
    await page.getByLabel('비율 잠금', { exact: true }).check();
    await target.click(); const ratioBox = await handle.boundingBox(); if (!ratioBox) throw Error('ratio handle');
    await page.mouse.move(ratioBox.x + 4, ratioBox.y + 4); await page.mouse.down();
    await page.mouse.move(ratioBox.x + 4 + 20 * zoom, ratioBox.y + 4, { steps: 5 }); await page.mouse.up();
    await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.height).toEqual({ value: 88, unit: 'px' });
    await click(page, '저장');
    await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
    const saved = await page.evaluate(() => window.v3Proof.saved);
    if (!saved) throw Error('missing draft');
    await open(page, JSON.parse(saved)); await click(page, '정밀 조작');
    await page.getByLabel('작업면 확대', { exact: true }).selectOption(String(zoom));
    await page.getByRole('region', { name: '작업면' }).evaluate(element => element.scrollTop = 40);
    await frame.locator('[data-v3-node="' + id + '"]').click();
    await expect(handle).toBeVisible();
    const rendered = await target.evaluate(element => { const css = getComputedStyle(element); return { width: parseFloat(css.width), height: parseFloat(css.height) }; });
    expect(rendered).toEqual({ width: 220, height: 88 });
    await page.screenshot({ path: info.outputPath('ip5-zoom-' + zoom + '.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}
test('v3 multiple selection aligns distributes rotates and keeps keyboard and readonly boundaries', async ({ page }, info) => {
  const source = geometryFixture(), ids = source.blocks[0].slots.content!.map(node => node.instance_id);
  await open(page, source); await click(page, '정밀 조작');
  await page.getByLabel('작업면 확대', { exact: true }).selectOption('0.5');
  const frame = page.frameLocator('iframe'), node = (id: string) => frame.locator('[data-v3-node="' + id + '"]');
  await node(ids[0]).click(); await node(ids[1]).click({ modifiers: ['Shift'] }); await node(ids[2]).click({ modifiers: ['Shift'] });
  await expect(page.getByRole('heading', { name: '선택 3개', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: '선택 속성 상태' })).toHaveText('혼합값');
  const before = await read(page);
  await click(page, '가로 간격 균등');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![1].style.inset_left).toEqual({ value: 400, unit: 'px' });
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
  await click(page, '아래쪽 정렬');
  expect(await read(page)).toEqual(before);
  await click(page, '시계 15도');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content!.map(node => node.style.rotation)).toEqual([15, 15, 15]);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
  await node(ids[0]).click();
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.inset_left).toEqual({ value: 90, unit: 'px' });
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
  const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.filter(item => item.impact === 'critical' || item.impact === 'serious')).toEqual([]);
  await info.attach('ip5-accessibility', { body: JSON.stringify(accessibility), contentType: 'application/json' });
  await open(page, source, true);
  await expect(page.getByRole('button', { name: '정밀 조작', exact: true })).toBeDisabled();
  await expect(frame.locator('.moveable-control')).toHaveCount(0);
  const readOnlyBox = await frame.locator('[data-v3-node="' + ids[0] + '"]').boundingBox();
  if (!readOnlyBox) throw Error('missing readonly element');
  await page.mouse.click(readOnlyBox.x + 10, readOnlyBox.y + 10);
  await page.keyboard.press('Delete'); expect(await read(page)).toEqual(source);
});

test('v3 marquee group resize snap and pan preserve canonical history', async ({ page }, info) => {
  const source = geometryFixture(), nodes = source.blocks[0].slots.content!;
  await open(page, source); await click(page, '정밀 조작');
  await page.getByLabel('작업면 확대', { exact: true }).selectOption('0.5');
  const frame = page.frameLocator('iframe'), first = frame.locator('[data-v3-node="' + nodes[0].instance_id + '"]'),
    second = frame.locator('[data-v3-node="' + nodes[1].instance_id + '"]');
  const a = await first.boundingBox(), b = await second.boundingBox();
  if (!a || !b) throw Error('missing marquee targets');
  await page.mouse.move(a.x - 8, a.y - 8); await page.mouse.down();
  await page.mouse.move(b.x + b.width + 8, b.y + b.height + 8, { steps: 10 }); await page.mouse.up();
  await expect(page.getByRole('heading', { name: '선택 2개', exact: true })).toBeVisible();
  await page.getByLabel('스냅 가이드', { exact: true }).uncheck();
  const before = await read(page), handle = frame.locator('.moveable-control[data-direction="e"]');
  await expect(handle).toBeVisible();
  const h = await handle.boundingBox(); if (!h) throw Error('missing group handle');
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 40, h.y + h.height / 2, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.width).not.toEqual(nodes[0].style.width);
  const changed = await read(page);
  expect(changed.blocks[0].slots.content!.slice(0, 2).map(node => node.style.width))
    .toEqual([{ value: 192, unit: 'px' }, { value: 144, unit: 'px' }]);
  expect(changed.blocks[0].slots.content!.slice(0, 2).map(node => node.style.inset_left))
    .toEqual([{ value: 80, unit: 'px' }, { value: 416, unit: 'px' }]);
  expect(changed.blocks[0].slots.content![2]).toEqual(nodes[2]);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
  await first.click(); await page.getByLabel('스냅 가이드', { exact: true }).check();
  const snapHandle = await handle.boundingBox(); if (!snapHandle) throw Error('missing snap handle');
  await page.mouse.move(snapHandle.x + snapHandle.width / 2, snapHandle.y + snapHandle.height / 2); await page.mouse.down();
  await page.mouse.move(snapHandle.x + snapHandle.width / 2 + 58, snapHandle.y + snapHandle.height / 2, { steps: 8 });
  await expect(frame.locator('.moveable-guideline').first()).toBeVisible();
  await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.width).toEqual({ value: 280, unit: 'px' });
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
  await page.getByLabel('작업면 확대', { exact: true }).selectOption('2');
  await click(page, '화면 이동');
  const workspace = page.getByRole('region', { name: '작업면' });
  const scrollBefore = await workspace.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
  const area = await workspace.boundingBox(); if (!area) throw Error('missing workspace');
  await page.mouse.move(area.x + 250, area.y + 250); await page.mouse.down();
  await page.mouse.move(area.x + 170, area.y + 190, { steps: 8 }); await page.mouse.up();
  await expect.poll(() => workspace.evaluate(element => element.scrollLeft)).toBeGreaterThan(scrollBefore.x);
  await expect.poll(() => workspace.evaluate(element => element.scrollTop)).toBeGreaterThan(scrollBefore.y);
  expect(await read(page)).toEqual(before);
  await click(page, '화면 맞춤');
  await expect.poll(() => workspace.evaluate(element => element.scrollLeft)).toBe(0);
  expect(await read(page)).toEqual(before);
  await expect(page.getByRole('button', { name: '실행 취소', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('ip5-fit-workspace.png'), fullPage: true });
});

test('v3 pointer movement rotation and mixed property changes each use one Undo', async ({ page }) => {
  const source = geometryFixture(), nodes = source.blocks[0].slots.content!;
  await open(page, source); await click(page, '정밀 조작');
  await page.getByLabel('작업면 확대', { exact: true }).selectOption('0.5');
  await page.getByLabel('스냅 가이드', { exact: true }).uncheck();
  const frame = page.frameLocator('iframe'), node = (index: number) => frame.locator('[data-v3-node="' + nodes[index].instance_id + '"]');
  await node(0).click();
  const first = await node(0).boundingBox(); if (!first) throw Error('missing draggable node');
  await page.mouse.move(first.x + 20, first.y + 20); await page.mouse.down();
  await page.mouse.move(first.x + 40, first.y + 30, { steps: 8 });
  expect(await read(page)).toEqual(source); await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.inset_left).toEqual({ value: 120, unit: 'px' });
  expect((await read(page)).blocks[0].slots.content![0].style.inset_top).toEqual({ value: 100, unit: 'px' });
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(source);
  await node(0).click();
  const rotation = frame.locator('.moveable-rotation-control'); await expect(rotation).toBeVisible();
  const r = await rotation.boundingBox(), target = await node(0).boundingBox();
  if (!r || !target) throw Error('missing rotation target');
  const cx = target.x + target.width / 2, cy = target.y + target.height / 2;
  const radius = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
  await page.mouse.move(cx + radius, cy, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => Math.abs((await read(page)).blocks[0].slots.content![0].style.rotation ?? 0)).toBeGreaterThan(10);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(source);
  await node(0).click(); await node(1).click({ modifiers: ['Shift'] });
  await expect(page.getByRole('heading', { name: '선택 2개', exact: true })).toBeVisible();
  const groupTarget = await node(0).boundingBox(); if (!groupTarget) throw Error('missing group drag target');
  await page.mouse.move(groupTarget.x + 20, groupTarget.y + 20); await page.mouse.down();
  await page.mouse.move(groupTarget.x + 40, groupTarget.y + 20, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content!.slice(0, 2).map(item => item.style.inset_left))
    .toEqual([{ value: 120, unit: 'px' }, { value: 400, unit: 'px' }]);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(source);
  await node(0).click(); await node(1).click({ modifiers: ['Shift'] });
  await page.getByLabel('일괄 속성', { exact: true }).selectOption('opacity');
  await page.getByLabel('일괄 값', { exact: true }).fill('0.5');
  await page.getByLabel('일괄 값', { exact: true }).press('ArrowLeft');
  expect(await read(page)).toEqual(source);
  await click(page, '선택 모두 적용');
  const changed = await read(page);
  expect(changed.blocks[0].slots.content!.slice(0, 2).map(item => item.style.opacity)).toEqual([.5, .5]);
  expect(changed.blocks[0].slots.content!.map(item => item.style.width)).toEqual(nodes.map(item => item.style.width));
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(source);
});

test('v3 focus loss cancels and layout constraints preserve canonical history', async ({ page }) => {
  const source = geometryFixture(), id = source.blocks[0].slots.content![0].instance_id;
  const frame = page.frameLocator('iframe'), target = frame.locator('[data-v3-node="' + id + '"]');
  const prepare = async (document: DocumentV3, direction = 'e', dy = 0) => {
    await open(page, document); await click(page, '정밀 조작');
    await page.getByLabel('작업면 확대', { exact: true }).selectOption('0.5');
    await page.getByLabel('스냅 가이드', { exact: true }).uncheck(); await target.click();
    const handle = frame.locator('.moveable-control[data-direction="' + direction + '"]'); await expect(handle).toBeVisible();
    const box = await handle.boundingBox(); if (!box) throw Error('missing constraint handle');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + dy, { steps: 5 });
  };
  await prepare(source);
  await page.getByLabel('작업면 확대', { exact: true }).focus();
  await page.mouse.up();
  expect(await read(page)).toEqual(source);
  await expect.poll(() => target.evaluate(element => parseFloat(getComputedStyle(element).width))).toBe(160);
  await expect(page.getByRole('button', { name: '실행 취소', exact: true })).toBeDisabled();
  const constrained = structuredClone(source);
  constrained.blocks[0].slots.content![0].style.max_width = { value: 180, unit: 'px' };
  await prepare(constrained); await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.width).toEqual({ value: 180, unit: 'px' });
  await expect.poll(() => target.evaluate(element => parseFloat(getComputedStyle(element).width))).toBe(180);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(constrained);
  await expect(page.getByRole('button', { name: '실행 취소', exact: true })).toBeDisabled();
  const anchored = structuredClone(source), anchoredStyle = anchored.blocks[0].slots.content![0].style;
  anchoredStyle.inset_left = 'auto'; anchoredStyle.inset_top = 'auto';
  anchoredStyle.inset_right = { value: 860, unit: 'px' }; anchoredStyle.inset_bottom = { value: 1040, unit: 'px' };
  await prepare(anchored, 'se', 20); await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style).toEqual({
    ...source.blocks[0].slots.content![0].style, width: { value: 200, unit: 'px' }, height: { value: 120, unit: 'px' },
  });
  await expect.poll(() => target.evaluate(element => {
    if (!(element instanceof HTMLElement)) throw Error('Expected authored element');
    return [element.offsetLeft, element.offsetTop, element.offsetWidth, element.offsetHeight];
  })).toEqual([80, 80, 200, 120]);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(anchored);
  await expect(page.getByRole('button', { name: '실행 취소', exact: true })).toBeDisabled();
  const longPage = structuredClone(source);
  longPage.blocks[0].slots.content![0].style.inset_top = { value: 1000, unit: 'px' };
  await open(page, longPage); await click(page, '정밀 조작');
  await page.getByLabel('작업면 확대', { exact: true }).selectOption('2');
  await page.getByLabel('스냅 가이드', { exact: true }).uncheck();
  await expect.poll(() => page.locator('iframe').evaluate(element => {
    if (!(element instanceof HTMLIFrameElement)) throw Error('Expected owned iframe');
    return element.offsetHeight;
  })).toBeGreaterThanOrEqual(1200);
  await page.getByRole('region', { name: '작업면' }).evaluate(element => element.scrollTop = 1800);
  await target.click();
  const h = await frame.locator('.moveable-control[data-direction="e"]').boundingBox();
  if (!h) throw Error('missing scrolled page handle');
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 80, h.y + h.height / 2, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].style.width).toEqual({ value: 200, unit: 'px' });
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(longPage);
});

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
  for (const zoom of [.5, 1, 2]) {
  await open(page);
  await page.getByLabel('작업면 확대', { exact: true }).selectOption(String(zoom));
  for (const label of ['제목', '본문', '링크']) await insert(page, label);
  const before = await read(page), [heading, text] = before.blocks;
  const frame = page.frameLocator('iframe');
  const headingButton = frame.getByRole('button', { name: '새 제목', exact: true });
  await headingButton.click();
  await expect(layer(page, heading.instance_id)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: '레이어 이름' })).toHaveValue('제목');
  const from = await headingButton.boundingBox();
  if (!from) throw new Error('Missing Puck draggable');
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 35, from.y + from.height / 2 + 15, { steps: 5 });
  // Activation can shift the live target; measure after activation instead of dropping on its old neighbor.
  const to = await frame.locator('[data-v3-node="' + text.instance_id + '"]').boundingBox();
  if (!to) throw new Error('Missing live drop target');
  await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks.map(node => node.instance_id)).toEqual([text.instance_id, heading.instance_id, before.blocks[2].instance_id]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => read(page)).toEqual(before);
  await click(page, '다시 실행');
  await expect.poll(async () => (await read(page)).blocks[0].instance_id).toBe(text.instance_id);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('v3-canvas-drag-' + zoom + '.png'), fullPage: true });
  }
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
  await input.fill('한글 정밀 편집');
  await expect(input).toHaveText('한글 정밀 편집');
  await expect.poll(async () => (await read(page)).blocks[0].props).toEqual({ paragraphs: [[{ text: '한글 정밀 편집' }]] });
  const typed = await read(page);
  const selection = () => input.evaluate(element => {
    const editor = (element as TiptapEditorHTMLElement).editor;
    if (!editor) throw new Error('Missing Tiptap test element');
    const { from, to, empty } = editor.state.selection;
    const native = element.ownerDocument.getSelection();
    return { from, to, empty, collapsed: native?.isCollapsed, text: native?.toString() };
  });
  // Explicit pointer focus after fill represents selecting authored text. Native Home immediately
  // after synthetic fill is mistaken for a browser focus reset by ProseMirror's 200ms heuristic.
  const selectPrefix = async () => {
    await input.click();
    await expect.poll(selection).toMatchObject({ empty: true, collapsed: true });
    await page.keyboard.press('Home');
    await expect.poll(selection).toMatchObject({ from: 1, to: 1, empty: true, collapsed: true });
    for (const key of ['Shift+ArrowRight', 'Shift+ArrowRight']) await page.keyboard.press(key);
    await expect.poll(selection).toEqual({ from: 1, to: 3, empty: false, collapsed: false, text: '한글' });
  };
  await selectPrefix();
  const format = page.getByRole('toolbar', { name: '부분 서식' });
  await format.getByRole('button', { name: '굵게', exact: true }).click();
  await expect.poll(async () => JSON.stringify((await read(page)).blocks[0].props)).toContain('"bold":true');
  const bold = await read(page);
  expect(bold.blocks[0].props).toEqual({ paragraphs: [[{ text: '한글', bold: true }, { text: ' 정밀 편집' }]] });
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(typed);
  await expect(input.locator('[data-v3-bold="true"]')).toHaveCount(0);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(bold);
  await expect(input.locator('[data-v3-bold="true"]')).toHaveText('한글');
  await selectPrefix();
  await format.getByLabel('부분 색상', { exact: true }).fill('#2255ff');
  await format.getByRole('button', { name: '색상 적용', exact: true }).click();
  const colored = { text: '한글', bold: true, color: { kind: 'hex', value: '#2255ff' } };
  await expect.poll(async () => (await read(page)).blocks[0].props).toEqual({ paragraphs: [[colored, { text: ' 정밀 편집' }]] });
  const afterColor = await read(page);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(bold);
  await expect(input.locator('[data-v3-color]')).toHaveCount(0);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(afterColor);
  await expect(input.locator('[data-v3-color]')).toHaveText('한글');
  await selectPrefix();
  await format.getByLabel('부분 크기', { exact: true }).fill('20');
  await format.getByRole('button', { name: '크기 적용', exact: true }).click();
  const sized = { ...colored, font_size: { value: 20, unit: 'px' } };
  await expect.poll(async () => (await read(page)).blocks[0].props).toEqual({ paragraphs: [[sized, { text: ' 정밀 편집' }]] });
  await format.getByLabel('부분 링크', { exact: true }).fill('/about');
  await format.getByRole('button', { name: '링크 적용', exact: true }).click();
  await expect.poll(async () => (await read(page)).blocks[0].props).toEqual({ paragraphs: [[
    { ...sized, link: { url: '/about', new_tab: false } }, { text: ' 정밀 편집' },
  ]] });
  const firstParagraph = [{ ...sized, link: { url: '/about', new_tab: false } }, { text: ' 정밀 편집' }];
  await input.click();
  await expect.poll(selection).toMatchObject({ empty: true, collapsed: true });
  await page.keyboard.press('End');
  await expect.poll(selection).toMatchObject({ from: 9, to: 9, empty: true, collapsed: true });
  await page.keyboard.press('Enter'); await page.keyboard.type('Second line');
  await expect.poll(async () => (await read(page)).blocks[0].props).toEqual({ paragraphs: [firstParagraph, [{ text: 'Second line' }]] });
  // Chromium composition protocol exercises IME ownership, not a physical OS keyboard.
  const cdp = await context.newCDPSession(page);
  try {
    for (const text of ['ㅎ', '하', '한']) await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    await cdp.send('Input.insertText', { text: '한' });
    await page.keyboard.insertText('글 조합');
  } finally { await cdp.detach(); }
  await expect.poll(async () => JSON.stringify((await read(page)).blocks[0].props)).toContain('한글 조합');
  await page.keyboard.press('End');
  await input.evaluate(element => {
    const transfer = new DataTransfer(); transfer.setData('text/plain', ' 붙여넣기');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
  });
  await expect.poll(async () => JSON.stringify((await read(page)).blocks[0].props)).toContain('붙여넣기');
  const finalText = { paragraphs: [firstParagraph, [{ text: 'Second line한글 조합 붙여넣기' }]] };
  await expect.poll(async () => (await read(page)).blocks[0].props).toEqual(finalText);
  await click(page, '저장'); await expect.poll(() => page.evaluate(() => window.v3Proof.saved)).not.toBeNull();
  const saved = await page.evaluate(() => window.v3Proof.saved!), final = JSON.parse(saved);
  expect(final.blocks[0].props).toEqual(finalText);
  expect(saved).not.toContain('contentEditable'); expect(saved).not.toContain('<p>');
  await open(page, final, true);
  await layer(page, id).click();
  await expect(page.frameLocator('iframe').locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByLabel('문맥 도구', { exact: true })).toBeEmpty();
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
    await page.getByTestId('v3-preview').locator('img').evaluateAll(async items => Promise.all(items.map(item => (item as HTMLImageElement).decode())));
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

async function canvasWidth(page: Page, width: number) {
  await page.getByLabel('캔버스 폭', { exact: true }).fill(String(width));
  await click(page, '폭 적용');
  await expect(page.locator('[data-v3-workspace]')).toHaveAttribute('data-v3-viewport', expectedViewport(width));
  await expect.poll(() => page.locator('iframe').evaluate(element => element.getBoundingClientRect().width)).toBe(width);
}
const expectedViewport = (width: number): Viewport => width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'base';
function responsiveFixture(): DocumentV3 {
  const source = structuredClone(fixture), section = source.blocks[0];
  source.assets[0].url = '/image.svg';
  section.style = { display: 'flex', direction: 'row', wrap: 'wrap', column_gap: { value: 20, unit: 'px' }, position: 'relative' };
  section.responsive = { tablet: { direction: 'column', row_gap: { value: 12, unit: 'px' } },
    mobile: { display: 'grid', columns: [{ fr: 1 }, { fr: 1 }], column_gap: { value: 0, unit: 'px' }, row_gap: { value: 8, unit: 'px' } } };
  section.slots.content!.forEach(node => { node.style = {}; node.responsive = {}; });
  const [heading, image] = section.slots.content!;
  heading.style = { width: { value: 200, unit: 'px' }, font_size: { value: 20, unit: 'px' } };
  heading.responsive = { tablet: { width: { value: 180, unit: 'px' } },
    mobile: { width: { value: 120, unit: 'px' }, column_start: 2, row_start: 1 } };
  image.style = { width: { value: 80, unit: 'px' }, height: { value: 40, unit: 'px' }, object_fit: 'contain' };
  image.responsive.mobile = { hidden: true };
  section.slots.content![3].responsive.mobile = { column_start: 1, row_start: 1 };
  return source;
}
test('v3 responsive Inspector inherits resets and reopens independent viewport values', async ({ page }, info) => {
  const source = responsiveFixture(), id = source.blocks[0].slots.content![0].instance_id;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, source); await layer(page, id).click();
  await click(page, '모바일');
  await length(page, '너비', 130); await click(page, '디자인 적용');
  let current = await read(page);
  expect(current.blocks[0].slots.content![0].responsive.mobile?.width).toEqual({ value: 130, unit: 'px' });
  expect(current.blocks[0].slots.content![0].style).toEqual(source.blocks[0].slots.content![0].style);
  await click(page, '태블릿');
  await expect(page.getByLabel('너비 값', { exact: true })).toHaveValue('180');
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(source);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(current);
  await click(page, 'PC · 공통값');
  await length(page, '너비', 240); await click(page, '디자인 적용');
  await click(page, '모바일');
  await page.getByLabel('너비 초기화', { exact: true }).click(); await click(page, '디자인 적용');
  await expect(page.getByLabel('너비 상속', { exact: true })).toContainText('240');
  await expect(page.frameLocator('iframe').locator('[data-v3-node="' + id + '"]')).toHaveCSS('width', '240px');
  await enable(page, '불투명도'); await page.getByLabel('불투명도', { exact: true }).fill('0');
  await click(page, '디자인 적용');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].responsive.mobile?.opacity).toBe(0);
  await click(page, '숨김'); await expect(page.frameLocator('iframe').locator('[data-v3-node="' + id + '"]')).toHaveCount(0);
  await click(page, '표시');
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].responsive.mobile?.hidden).toBe(false);
  // Whole-layer reset is a draft until Apply and leaves tablet/common unchanged.
  current = await read(page); await click(page, '현재 화면 스타일 초기화'); expect(await read(page)).toEqual(current);
  await click(page, '디자인 적용');
  let reset = await read(page);
  const node = reset.blocks[0].slots.content![0];
  expect(node.responsive.mobile).toBeUndefined();
  expect(node.responsive.tablet).toEqual(source.blocks[0].slots.content![0].responsive.tablet);
  expect(node.style.width).toEqual({ value: 240, unit: 'px' });
  // Switching width also abandons an uncommitted Inspector draft, without Undo.
  await length(page, '너비', 99); await click(page, '태블릿'); await click(page, '모바일');
  expect(await read(page)).toEqual(reset);
  await expect(page.getByLabel('너비 상속', { exact: true })).toContainText('240');
  await layer(page, source.blocks[0].instance_id).click();
  await length(page, '열 간격', 7);
  await page.getByLabel('열 트랙 2 비율', { exact: true }).fill('2');
  await click(page, '디자인 적용');
  await expect.poll(async () => (await read(page)).blocks[0].responsive.mobile?.columns).toEqual([{ fr: 1 }, { fr: 2 }]);
  await expect(page.frameLocator('iframe').locator('[data-v3-node="' + source.blocks[0].instance_id + '"]')).toHaveCSS('column-gap', '7px');
  await click(page, '태블릿'); await enable(page, '방향');
  await page.getByLabel('방향 형식', { exact: true }).selectOption({ label: 'row' });
  await length(page, '행 간격', 0); await click(page, '디자인 적용');
  await expect.poll(async () => (await read(page)).blocks[0].responsive.tablet?.direction).toBe('row');
  expect((await read(page)).blocks[0].style).toEqual(source.blocks[0].style);
  reset = await read(page);
  await click(page, '저장'); await expect(page.getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
  const saved = await page.evaluate(() => window.v3Proof.saved!); expect(JSON.parse(saved)).toEqual(reset);
  await open(page, JSON.parse(saved)); await click(page, '모바일'); await layer(page, id).click();
  await expect(page.getByLabel('너비 상속', { exact: true })).toContainText('240');
  await open(page, JSON.parse(saved), true); await click(page, '모바일'); await layer(page, id).click();
  await expect(page.getByLabel('너비 지정', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '숨김', exact: true })).toBeDisabled();
  expect(await read(page)).toEqual(reset); expect(errors).toEqual([]);
  await info.attach('ip6-independent-overrides', { contentType: 'application/json', body: saved });
});
test('v3 responsive handles and mixed edits keep viewport ownership and one Undo', async ({ page }, info) => {
  const source = geometryFixture(), section = source.blocks[0], ids = section.slots.content!.map(node => node.instance_id);
  section.style.width = 'fill'; section.style.height = { value: 400, unit: 'px' };
  section.slots.content!.forEach((node, index) => {
    node.responsive.mobile = { width: { value: 60, unit: 'px' }, height: { value: 60, unit: 'px' },
      inset_left: { value: 10 + 95 * index, unit: 'px' }, inset_top: { value: 30, unit: 'px' } };
  });
  await open(page, source); await click(page, '모바일'); await click(page, '정밀 조작');
  await page.getByLabel('스냅 가이드', { exact: true }).uncheck();
  const frame = page.frameLocator('iframe'), node = (id: string) => frame.locator('[data-v3-node="' + id + '"]');
  await node(ids[0]).click();
  const handle = frame.locator('.moveable-control[data-direction="e"]');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox(); if (!box) throw Error('mobile resize handle');
  await page.mouse.move(box.x + 4, box.y + 4); await page.mouse.down();
  await page.mouse.move(box.x + 44, box.y + 4, { steps: 8 }); expect(await read(page)).toEqual(source);
  await page.mouse.up();
  await expect.poll(async () => (await read(page)).blocks[0].slots.content![0].responsive.mobile?.width).toEqual({ value: 100, unit: 'px' });
  const resized = await read(page);
  expect(resized.blocks[0].slots.content![0].style).toEqual(section.slots.content![0].style);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(source);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(resized);
  // The host changes width while the pointer is still held: no cross-width commit.
  await node(ids[0]).click(); const pending = await handle.boundingBox(); if (!pending) throw Error('pending handle');
  await page.mouse.move(pending.x + 4, pending.y + 4); await page.mouse.down();
  await page.mouse.move(pending.x + 24, pending.y + 4, { steps: 5 });
  await page.getByRole('button', { name: '태블릿', exact: true }).evaluate(element => (element as HTMLButtonElement).click());
  await page.mouse.up(); expect(await read(page)).toEqual(resized);
  await click(page, '모바일');
  await layer(page, ids[0]).click(); await layer(page, ids[1]).click({ modifiers: ['Shift'] });
  await page.getByLabel('일괄 속성', { exact: true }).selectOption('opacity');
  await page.getByLabel('일괄 값', { exact: true }).fill('.5'); await click(page, '선택 모두 적용');
  const mixed = await read(page);
  expect(mixed.blocks[0].slots.content!.slice(0, 2).map(node => node.responsive.mobile?.opacity)).toEqual([.5, .5]);
  expect(mixed.blocks[0].slots.content!.slice(0, 2).map(node => node.style.opacity)).toEqual([undefined, undefined]);
  await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(resized);
  await click(page, '다시 실행'); await expect.poll(() => read(page)).toEqual(mixed);
  await click(page, '선택 속성 초기화'); await expect.poll(() => read(page)).toEqual(resized);
  await expect(page.getByLabel('읽기 순서 안내', { exact: true })).toContainText('Tab');
  await page.screenshot({ path: info.outputPath('ip6-mobile-handles.png'), fullPage: true });
});
test('v3 responsive canvases keep structure and direct text editing at all three widths', async ({ page }, info) => {
  for (const width of [360, 768, 1280]) {
    await open(page); await canvasWidth(page, width);
    for (const label of ['제목', '본문', '링크']) await insert(page, label);
    const before = await read(page), [heading, text] = before.blocks;
    const frame = page.frameLocator('iframe');
    const headingButton = frame.getByRole('button', { name: '새 제목', exact: true });
    await headingButton.click();
    const from = await headingButton.boundingBox(); if (!from) throw Error('responsive draggable');
    await page.mouse.move(from.x + 20, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(from.x + 35, from.y + from.height / 2 + 15, { steps: 5 });
    const to = await frame.locator('[data-v3-node="' + text.instance_id + '"]').boundingBox(); if (!to) throw Error('responsive target');
    await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 20 }); await page.mouse.up();
    await expect.poll(async () => (await read(page)).blocks.map(node => node.instance_id)).toEqual([text.instance_id, heading.instance_id, before.blocks[2].instance_id]);
    await click(page, '실행 취소'); await expect.poll(() => read(page)).toEqual(before);
    await click(page, '본문 입력');
    const target = frame.locator('[data-v3-node="' + heading.instance_id + '"]');
    await target.dblclick(); await target.locator('.tiptap[contenteditable="true"]').fill('화면 ' + width + ' 직접 입력');
    await expect.poll(async () => (await read(page)).blocks[0].props).toEqual({ level: 2, runs: [{ text: '화면 ' + width + ' 직접 입력' }] });
    const typed = await read(page);
    await click(page, 'PC · 공통값'); expect(await read(page)).toEqual(typed);
    await click(page, '구조 미리보기');
    await expect(page.getByTestId('v3-preview').getByRole('heading', { name: '화면 ' + width + ' 직접 입력' })).toBeVisible();
    await info.attach('ip6-shared-structure-' + width, { contentType: 'application/json', body: JSON.stringify(typed) });
  }
});
test('v3 responsive boundary canvas preview and PHP output preserve layout and DOM semantics', async ({ page, context }, info) => {
  const source = responsiveFixture(), ids = source.blocks[0].slots.content!.map(node => node.instance_id);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const evidence: unknown[] = [];
  const measure = (element: Element) => {
    const surface = element.getBoundingClientRect();
    return [...element.querySelectorAll('[data-v3-node]')].map(node => {
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { id: node.getAttribute('data-v3-node'), tag: node.tagName, text: node.textContent,
        level: node.getAttribute('aria-level'), href: node.getAttribute('href'), alt: node.getAttribute('alt'),
        x: rect.x - surface.x, y: rect.y - surface.y, width: rect.width, height: rect.height,
        css: Object.fromEntries(['display', 'position', 'flex-direction', 'flex-wrap', 'row-gap', 'column-gap',
          'grid-template-columns', 'font-size', 'line-height', 'opacity', 'object-fit'].map(key => [key, css.getPropertyValue(key)])) };
    });
  };
  for (const width of [360, 639, 640, 768, 1023, 1024, 1280]) {
    await open(page, source); await canvasWidth(page, width);
    const viewport = expectedViewport(width), frame = page.frameLocator('iframe');
    await frame.locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const canvas = await frame.locator('[data-v3-surface]').evaluate(measure);
    const expectedIds = [source.blocks[0].instance_id, ...ids.filter((_, i) => viewport !== 'mobile' || i !== 1)];
    expect(canvas.map(node => node.id)).toEqual(expectedIds);
    expect(canvas[0].css.display).toBe(viewport === 'mobile' ? 'grid' : 'flex');
    if (viewport === 'mobile') {
      await expect(page.getByLabel('읽기 순서 안내', { exact: true })).toContainText('Tab');
      expect(canvas[0].css['grid-template-columns'].split(' ')).toHaveLength(2);
      expect(canvas[0].css['column-gap']).toBe('0px');
    } else expect(canvas[0].css['flex-direction']).toBe(viewport === 'tablet' ? 'column' : 'row');
    await click(page, '구조 미리보기');
    await page.getByTestId('v3-preview').locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const preview = await page.getByTestId('v3-preview').evaluate(measure);
    const output = await context.newPage(); await output.setViewportSize({ width, height: 1000 });
    await output.route('**/*', route => route.request().url().endsWith('/image.svg')
      ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="#dbeafe"/></svg>' }) : route.abort());
    await output.setContent('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="https://v3-editor.test/"></head><body style="margin:0">' + phpDraft(source, viewport) + '</body></html>');
    await expect.poll(() => output.evaluate(() => window.innerWidth)).toBe(width);
    await output.locator('img').evaluateAll(async elements => Promise.all(elements.map(element => (element as HTMLImageElement).decode())));
    const php = await output.locator('[data-v3-surface]').evaluate(measure);
    for (const candidate of [preview, php]) {
      expect(candidate.map(node => node.id)).toEqual(canvas.map(node => node.id));
      for (let i = 0; i < canvas.length; i++) {
        for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(candidate[i][key] - canvas[i][key]), width + ':' + key + ':' + canvas[i].id).toBeLessThanOrEqual(1);
        for (const key of ['tag', 'text', 'level', 'href', 'alt', 'css'] as const) expect(candidate[i][key]).toEqual(canvas[i][key]);
      }
    }
    // Native focus follows source DOM, regardless of visual Grid/Flex placement.
    const linkHrefs = await output.locator('a').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    const focused: (string | null)[] = [];
    for (let i = 0; i < linkHrefs.length; i++) { await output.keyboard.press('Tab'); focused.push(await output.evaluate(() => document.activeElement?.getAttribute('href') ?? null)); }
    expect(focused).toEqual(linkHrefs);
    evidence.push({ width, viewport, canvas, preview, php, focused });
    if ([360, 768, 1280].includes(width)) {
      await page.screenshot({ path: info.outputPath('ip6-preview-' + width + '.png'), fullPage: true });
      await output.screenshot({ path: info.outputPath('ip6-php-' + width + '.png'), fullPage: true });
    }
    await output.close();
  }
  expect(errors).toEqual([]);
  await info.attach('ip6-boundary-parity', { contentType: 'application/json', body: JSON.stringify(evidence) });
});
