import { expect, test, request, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type React from 'react';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';
import { nativeComponentManifest, nativeEditorSpec } from '../../resources/js/native-components/spec';

const template = 'jiwonpapa-native_lab';
const endpoint = `/api/admin/templates/${template}/layouts/native_lab`;
const mediaEndpoint = `/api/admin/templates/${template}/layout-attachments`;
type Node = { id: string; name: string; type: string; text?: string; props?: Record<string, unknown>; children?: Node[]; [key: string]: unknown };
type Layout = { version: string; layout_name: string; meta: Record<string, unknown>; state: Record<string, unknown>; data_sources: Array<Record<string, unknown>>; components: Node[] };
const node = (id: string, name: string, children?: Node[]): Node => ({ id, name, type: 'basic', ...(children ? { children } : {}) });
function fixture(mode: 'data-source' | 'local-state' = 'data-source'): Layout {
  return { version: '1.0.0', layout_name: 'native_lab', meta: { title: 'NE3 native lab', seo: { enabled: false } },
    state: { preserved: 'local state', ...(mode === 'local-state' ? { items: [{ name: 'First row' }, { name: 'Second row' }] } : {}) },
    data_sources: [{ id: 'items', type: 'static', data: [{ name: 'First row' }, { name: 'Second row' }] }], components: [
      { ...node('lab-root', 'Div'), children: [
        { id: 'lab-slider', name: 'PageBuilderSlider', type: 'composite', props: { autoplay: true, interval: 1000, slides: [
          { id: 'slide-a', src: '', alt: '', caption: 'First slide' }, { id: 'slide-b', src: '', alt: '', caption: 'Second slide' },
        ] } },
        { id: 'lab-cells', name: 'NativeCells', type: 'composite', props: { cards: [{ id: 'card-a', cellChildren: [
          node('cell-box', 'Div', [{ ...node('cell-text', 'P'), text: 'Cell original', future: { keep: true } }]),
        ] }] } },
        { ...node('lab-repeat', 'Div'), iteration: { source: mode === 'local-state' ? '{{_local.items}}' : '{{items}}', item_var: 'item', index_var: 'idx' }, children: [
          node('lab-repeat-body', 'Div', [{ ...node('lab-bound', 'P'), text: '{{item.name}}' },
            { ...node('lab-literal', 'P'), text: 'Repeated literal' }]),
        ] },
      ] },
    ] };
}
// A technical template fixture uses the observed template IIFE registry and the public cell renderer.
// Product code contains neither this template nor a global registration shortcut.
function templateExports(): void {
  const win = window as unknown as { React: typeof React; JiwonpapaNativeComponents: { PageBuilderSlider: React.ComponentType };
    JiwonpapaNativeLab: Record<string, unknown>; G7Core: { renderItemChildren: (children: unknown[], context: object, map: object, key: string) => React.ReactNode } };
  const el = win.React.createElement;
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => el('div', props, children);
  const P = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement => el('p', props, children);
  const NativeCells = ({ cards, editorAttrs }: { cards: Array<{ id: string; cellChildren: unknown[] }>; editorAttrs?: object }): React.ReactElement =>
    el('div', { ...editorAttrs, className: 'native-lab-cells' }, cards.map(card =>
      el('div', { key: card.id, 'data-cell-id': card.id }, win.G7Core.renderItemChildren(card.cellChildren, {}, { Div, P }, card.id))));
  win.JiwonpapaNativeLab = { Div, P, NativeCells, PageBuilderSlider: win.JiwonpapaNativeComponents.PageBuilderSlider };
}
function installFiles(baseURL: string): string {
  expect(new URL(baseURL).hostname, 'Local runtime fixture only').toBe('g7pb.test');
  const root = process.env.G7PB_NATIVE_LAB_ROOT ?? (existsSync('/var/www/g7/artisan') ? '/var/www/g7' : resolve('.runtime/gnuboard7'));
  expect(existsSync(join(root, 'artisan'))).toBe(true);
  const baseSpec = {
    templateId: template, version: '1.0.0', styleSystem: 'none',
    componentCapabilities: {
      Div: { propControls: [], styleControls: [] }, P: { propControls: [], styleControls: [], textEditable: true },
      NativeCells: { propControls: [], styleControls: [], nodeEditor: { kind: 'array-cell-tree', params: {
        arrayProp: 'cards', idField: 'id', cellChildrenProp: 'cellChildren', cellChildComponent: 'Div', itemLabel: '셀',
        newItem: { id: '', cellChildren: [] },
      } } }, ...nativeEditorSpec.componentCapabilities,
    }, controls: nativeEditorSpec.controls,
    nesting: { draggable: ['Div', 'P', 'NativeCells', 'PageBuilderSlider'], containers: { Div: { accepts: ['Div', 'P', 'NativeCells', 'PageBuilderSlider'] } } },
    componentPalette: { groups: [{ label: '검증 요소', kind: 'design', components: ['Div', 'P', 'PageBuilderSlider'] }], entries: {
      Div: { label: 'Div', defaultNode: { type: 'basic', name: 'Div', children: [] } },
      P: { label: 'P', defaultNode: { type: 'basic', name: 'P', text: '새 문단' } }, ...nativeEditorSpec.componentPalette.entries,
    } },
  };
  const manifest = { templateId: template, version: '0.1.0', components: {
    basic: ['Div', 'P'].map(name => ({ name, type: 'basic', path: 'lab-fixture', props: {} })),
    composite: [...nativeComponentManifest.components.composite, { name: 'NativeCells', type: 'composite', path: 'lab-fixture', props: {} }], layout: [],
  } };
  const metadata = { identifier: template, vendor: 'jiwonpapa', name: { ko: 'NE3 검증 전용', en: 'NE3 contract lab' }, version: '0.1.0',
    license: 'MIT', description: { ko: '편집 계약 검증 전용', en: 'Native editor contract fixture' }, type: 'user', hidden: true,
    locales: ['ko', 'en'], author: { name: 'jiwonpapa' }, g7_version: '>=7.0.10', dependencies: { modules: {}, plugins: {} },
    error_config: { layouts: Object.fromEntries(['401', '403', '404', '500', '503', 'maintenance'].map(code => [code, 'native_lab'])) },
    assets: { css: ['dist/css/components.css'], js: ['dist/js/components.iife.js'] },
    components: { basic: ['div', 'p'], composite: ['PageBuilderSlider', 'NativeCells'], layout: [] },
  };
  const files: Record<string, string> = {
    'lang/ko.json': JSON.stringify({ lab: 'NE3 검증' }), 'lang/en.json': JSON.stringify({ lab: 'NE3 lab' }),
    'template.json': JSON.stringify(metadata), 'components.json': JSON.stringify(manifest), 'editor-spec.json': JSON.stringify(baseSpec),
    'routes.json': JSON.stringify({ version: '1.0.0', routes: [{ path: '/native-lab', layout: 'native_lab', auth_required: false, meta: { title: 'NE3 lab' } }] }),
    'layouts/native_lab.json': JSON.stringify(fixture()),
    'dist/js/components.iife.js': readFileSync('dist/js/page-builder-native-components.iife.js', 'utf8') + '\n;(' + templateExports.toString() + ')();',
    'dist/css/components.css': readFileSync('dist/css/page-builder-native-components.css', 'utf8')
      + '\n#lab-root {padding:24px} #lab-root div {padding:12px} #lab-root > div, #lab-root > section {margin-block:24px;padding:16px;border:1px solid currentColor} .native-lab-cells p {padding:12px}',

  };
  for (const directory of [join(root, 'templates/_bundled', template), join(root, 'templates', template)]) {
    const marker = join(directory, '.g7pb-native-lab-owner');
    if (existsSync(directory)) expect(existsSync(marker), 'Never overwrite an unowned template').toBe(true);
    else if (directory === join(root, 'templates', template)) continue; // install through the existing G7 API
    mkdirSync(directory, { recursive: true }); writeFileSync(marker, 'NAT-03');
    for (const [name, contents] of Object.entries(files)) { mkdirSync(dirname(join(directory, name)), { recursive: true }); writeFileSync(join(directory, name), contents); }
  }
  return root;
}
async function read(api: APIRequestContext): Promise<{ content: string; lock_version: number }> {
  const response = await api.get(endpoint); expect(response.ok(), await response.text()).toBe(true);
  return (await response.json() as { data: { content: string; lock_version: number } }).data;
}
async function put(api: APIRequestContext, layout: Layout): Promise<void> {
  const current = await read(api);
  const response = await api.put(endpoint, { data: { content: JSON.stringify(layout), expected_lock_version: current.lock_version } });
  expect(response.ok(), await response.text()).toBe(true);
}
async function save(page: Page): Promise<void> {
  const saved = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT');
  await page.getByTestId('g7le-toolbar-save').click(); const response = await saved; expect(response.ok(), await response.text()).toBe(true);
}
async function select(page: Page, id: string): Promise<void> {
  const path = await page.locator(`[data-editor-id="${id}"]`).first().getAttribute('data-editor-path');
  expect(path).toBeTruthy(); await page.getByTestId('g7le-dnd-handle-' + path).click({ position: { x: 5, y: 5 } });
  await page.getByRole('radio', { name: '삽입·구성', exact: true }).check();
}
function collection(page: Page, label: string): Locator {
  return page.locator('.g7pb-native-collection').filter({ has: page.locator(':scope > summary', { hasText: label }) }).first();
}
function rows(slot: Locator): Locator { return slot.locator(':scope > ol > li'); }
async function editField(item: Locator, label: string, value: string): Promise<void> {
  await item.locator(':scope > details > summary').click();
  await item.getByRole('textbox', { name: label, exact: true }).fill(value);
  await item.getByRole('button', { name: label + ' 적용', exact: true }).click();
}
async function activeTemplate(api: APIRequestContext): Promise<string> {
  const response = await api.get('/api/admin/templates?type=user&status=active&include_hidden=1');
  expect(response.ok()).toBe(true);
  const data = await response.json() as { data: { data: Array<{ identifier: string }> } };
  expect(data.data.data).toHaveLength(1); return data.data.data[0]!.identifier;
}
async function activate(api: APIRequestContext, id: string): Promise<void> {
  const response = await api.post('/api/admin/templates/activate', { data: { template_name: id } });
  expect(response.ok(), await response.text()).toBe(true);
}

for (const mode of ['data-source', 'local-state'] as const) {
test('native companion edits array images cell trees and iteration templates then runs a public slider: ' + mode, async ({ page, context, baseURL }, info) => {
  test.setTimeout(180_000); await page.setViewportSize({ width: 1600, height: 1000 });
  const root = installFiles(baseURL!);
  const token = await authenticateEditorInteractionAdmin(context); const api = await editorInteractionApi(token);
  const existing = await api.get(endpoint);
  if (!existing.ok()) {
    const installed = await api.post('/api/admin/templates/install', { data: { template_name: template } });
    expect(installed.ok(), await installed.text()).toBe(true);
    writeFileSync(join(root, 'templates', template, '.g7pb-native-lab-owner'), 'NAT-03');
  }
  const original = await activeTemplate(api); const errors: string[] = []; const uploads: number[] = [];
  const journal = info.outputPath('native-ne3-lab-activation.json'); mkdirSync(dirname(journal), { recursive: true });
  writeFileSync(journal, JSON.stringify({ original, candidate: template, state: 'prepared' }));
  page.on('pageerror', error => errors.push(error.message));
  const network: string[] = [];
  page.on('requestfailed', req => network.push(new URL(req.url()).pathname + ': ' + req.failure()?.errorText));
  try {
    await activate(api, template); writeFileSync(journal, JSON.stringify({ original, candidate: template, state: 'active' }));
    await put(api, fixture(mode));
    await page.goto(`/admin/layout-editor/${template}?route=%2Fnative-lab`);
    await page.getByRole('button', { name: '한국어', exact: true }).click();
    await expect(page.locator('[data-editor-id="lab-slider"]')).toHaveAttribute('data-editing', 'true');
    await expect(page.locator('[data-editor-id="lab-slider"] figure:visible')).toHaveCount(2);
    await select(page, 'lab-slider');
    const slides = collection(page, 'PageBuilderSlider · 슬라이드');
    await expect(rows(slides)).toHaveCount(2);
    await slides.getByRole('button', { name: '항목 추가', exact: true }).click(); await expect(rows(slides)).toHaveCount(3);
    await page.getByTestId('g7le-toolbar-undo').click(); await expect(rows(slides)).toHaveCount(2);
    await page.getByTestId('g7le-toolbar-redo').click(); await expect(rows(slides)).toHaveCount(3);
    await rows(slides).nth(2).getByRole('button', { name: / 삭제$/ }).click();
    await rows(slides).nth(0).getByRole('button', { name: / 복제$/ }).click(); await expect(rows(slides)).toHaveCount(3);
    await rows(slides).nth(1).getByRole('button', { name: / 아래로$/ }).click();
    await rows(slides).nth(2).getByRole('button', { name: / 삭제$/ }).click();
    await editField(rows(slides).nth(0), '설명', 'Edited slide');
    const multipart = await request.newContext({ baseURL, ignoreHTTPSErrors: true, extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
    const uploaded = await multipart.post(mediaEndpoint, { multipart: { layout_name: 'native_lab', file: {
      name: 'native-ne3-image.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64'),
    } } });
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
    const attachment = (await uploaded.json() as { data: { id: number; url: string } }).data; uploads.push(attachment.id); await multipart.dispose();
    const localImage = new URL(attachment.url, page.url()); expect(localImage.origin).toBe(new URL(page.url()).origin);
    attachment.url = localImage.pathname + localImage.search + localImage.hash;
    await rows(slides).nth(0).locator(':scope > details > summary').click();
    await rows(slides).nth(0).getByRole('button', { name: '이미지 선택·업로드', exact: true }).click();
    await rows(slides).nth(0).getByRole('button', { name: /native-ne3-image/ }).click();
    await expect(page.locator('[data-editor-id="lab-slider"] img')).toHaveCount(1);
    await save(page);
    const savedSlides = JSON.parse((await read(api)).content) as Layout;
    expect(savedSlides.components[0]!.children![0]!.props).toEqual({ autoplay: true, interval: 1000, slides: [
      { id: 'slide-a', src: attachment.url, alt: '', caption: 'Edited slide' }, { id: 'slide-b', src: '', alt: '', caption: 'Second slide' },
    ] });
    expect(savedSlides.components[0]!.children!.slice(1)).toEqual(fixture(mode).components[0]!.children!.slice(1));

    await page.getByTestId('g7le-overlay-info-button').click();
    await page.getByTestId('g7le-context-menu-edit-props').click();
    const properties = page.getByTestId('g7le-property-modal');
    await properties.getByTestId('g7le-segment-false').click();
    await properties.getByTestId('g7le-segment-3000').click();
    await properties.getByTestId('g7le-property-modal-done').click(); await save(page);
    const changedSettings = JSON.parse((await read(api)).content) as Layout;
    expect(changedSettings.components[0]!.children![0]!.props).toMatchObject({ autoplay: false, interval: 3000 });
    await page.getByTestId('g7le-overlay-info-button').click();
    await page.getByTestId('g7le-context-menu-edit-props').click();
    await properties.getByTestId('g7le-segment-true').click(); await properties.getByTestId('g7le-segment-1000').click();
    await properties.getByTestId('g7le-property-modal-done').click(); await save(page);
    expect(JSON.parse((await read(api)).content)).toEqual(savedSlides);

    await select(page, 'lab-cells');
    const cell = collection(page, 'NativeCells / 1 / Div · 자식'); await expect(rows(cell)).toHaveCount(1);
    await cell.getByRole('radio', { name: 'P', exact: true }).check(); await cell.getByRole('button', { name: '항목 추가', exact: true }).click();
    await expect(rows(cell)).toHaveCount(2);
    await page.getByTestId('g7le-toolbar-undo').click(); await expect(rows(cell)).toHaveCount(1);
    await page.getByTestId('g7le-toolbar-redo').click(); await expect(rows(cell)).toHaveCount(2);
    await editField(rows(cell).nth(1), '문구', 'Cell inserted');
    await rows(cell).nth(1).getByRole('button', { name: 'P 위로', exact: true }).click();
    await rows(cell).nth(0).getByRole('button', { name: 'P 복제', exact: true }).click();
    await rows(cell).nth(1).getByRole('button', { name: 'P 삭제', exact: true }).click();
    await save(page); await page.reload(); await expect(page.locator('.native-lab-cells')).toContainText('Cell inserted');
    const savedCells = JSON.parse((await read(api)).content) as Layout;
    const cards = savedCells.components[0]!.children![1]!.props!.cards as Array<{ cellChildren: Node[] }>;
    expect(cards[0]!.cellChildren[0]!.children![0]!.text).toBe('Cell inserted');
    expect(cards[0]!.cellChildren[0]!.children![1]).toEqual({ ...node('cell-text', 'P'), text: 'Cell original', future: { keep: true } });
    expect(savedCells.components[0]!.children![0]).toEqual(savedSlides.components[0]!.children![0]);
    expect(savedCells.components[0]!.children![2]).toEqual(fixture(mode).components[0]!.children![2]);

    // The editor's documented URL enters the real iteration-template state; no private store is accessed.
    await page.goto(`/admin/layout-editor/${template}?edit=__iteration__%2F0.2&host=native_lab`);
    await page.getByRole('button', { name: '한국어', exact: true }).click();
    await select(page, 'lab-repeat-body');
    await expect(page.getByRole('heading', { name: '반복 템플릿 구성', exact: true })).toBeVisible();
    await expect(page.locator('[data-editor-id="lab-repeat-body"]')).toHaveCount(1);
    const repeated = collection(page, 'Div · 자식'); await expect(rows(repeated)).toHaveCount(2);
    await rows(repeated).nth(0).locator(':scope > details > summary').click();
    await expect(rows(repeated).nth(0).getByRole('textbox', { name: '문구', exact: true })).toBeDisabled();
    await repeated.getByRole('radio', { name: 'P', exact: true }).check(); await repeated.getByRole('button', { name: '항목 추가', exact: true }).click();
    await expect(rows(repeated)).toHaveCount(3);
    await page.getByTestId('g7le-toolbar-undo').click(); await expect(rows(repeated)).toHaveCount(2);
    await page.getByTestId('g7le-toolbar-redo').click(); await expect(rows(repeated)).toHaveCount(3);
    await editField(rows(repeated).nth(2), '문구', 'Repeated insertion'); await save(page);
    const result = JSON.parse((await read(api)).content) as Layout;
    expect(result.components[0]!.children!.slice(0, 2)).toEqual(savedCells.components[0]!.children!.slice(0, 2));
    expect(result.components[0]!.children![2]!.iteration).toEqual(fixture(mode).components[0]!.children![2]!.iteration);
    expect(result.components[0]!.children![2]!.children![0]!.children!.slice(0, 2)).toEqual(fixture(mode).components[0]!.children![2]!.children![0]!.children);
    await page.reload(); await select(page, 'lab-repeat-body'); await expect(rows(repeated)).toHaveCount(3);
    await page.screenshot({ path: info.outputPath('native-ne3-iteration.png'), fullPage: true });

    await page.goto('about:blank');
    await page.goto('/native-lab'); const slider = page.getByRole('region', { name: '슬라이드', exact: true });
    await expect(slider).toBeVisible(); await expect(slider).not.toHaveAttribute('data-editing');
    await expect(slider.locator('figure:not([hidden])')).toContainText('Second slide', { timeout: 4000 });
    await slider.focus(); await slider.press('Home'); await expect(slider.locator('figure:not([hidden])')).toContainText('Edited slide');
    await page.waitForTimeout(1200); await expect(slider.locator('figure:not([hidden])')).toContainText('Edited slide');
    await slider.press('End'); await expect(slider.locator('figure:not([hidden])')).toContainText('Second slide');
    await expect(page.getByText('Repeated insertion', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Cell inserted', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('native-ne3-public-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(slider).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('native-ne6-public-tablet.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload();
    await expect(slider.getByRole('button', { name: '자동 재생 시작' })).toBeDisabled();
    await expect(slider.locator('figure:not([hidden])')).toContainText('Edited slide'); await page.waitForTimeout(1200);
    await expect(slider.locator('figure:not([hidden])')).toContainText('Edited slide');
    await slider.getByRole('button', { name: '다음 슬라이드' }).click(); await expect(slider.locator('figure:not([hidden])')).toContainText('Second slide');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('native-ne3-public-mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
    await info.attach('NAT-03-native-storage-and-runtime', { body: Buffer.from(JSON.stringify({ pageErrors: errors, result, template,
      proof: ['template-manifest-renderer', 'merged-spec-array-image', 'cell-tree', 'iteration-template', 'undo-redo-save-reopen', 'public-autoplay-keyboard-reduced-motion'] }, null, 2)), contentType: 'application/json' });
  } catch (error) {
    const details = page.getByText('Show error details', { exact: true });
    if (await details.isVisible()) { await details.click(); console.error(await page.locator('pre').allTextContents()); }
    console.error(JSON.stringify({ errors, network }));
    await page.screenshot({ path: info.outputPath('native-ne3-companion-failure.png'), fullPage: true }); throw error;
  } finally {
    await page.goto('about:blank');
    if (await activeTemplate(api) !== original) await activate(api, original);
    expect(await activeTemplate(api)).toBe(original); writeFileSync(journal, JSON.stringify({ original, candidate: template, state: 'restored' }));
    for (const id of uploads) { const response = await api.delete('/api/admin/templates/layout-attachments/' + id); expect(response.ok(), await response.text()).toBe(true); }
    await api.dispose();
  }
});

}
