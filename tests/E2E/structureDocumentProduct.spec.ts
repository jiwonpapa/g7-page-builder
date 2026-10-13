import { devices, expect, test, type Locator } from '@playwright/test';
import type { DocumentV3 } from '../../resources/js/documents/v3/types';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';

test.use({ isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });
const documents = '/api/modules/jiwonpapa-page_builder/admin/documents';
const editor = '/modules/jiwonpapa-page_builder/admin/editor';

async function publicNodes(surface: Locator) {
  // Template hydration may replace the SSR surface after the locator resolves.
  // Reacquire only while detached/unready; never retry a parity disagreement.
  const sample = () => surface.evaluate(async element => {
    const doc = element.ownerDocument;
    await doc.fonts.ready;
    const images = [...element.querySelectorAll('img')];
    await Promise.all(images.map(image => image.decode().catch(() => {})));
    const capture = () => {
      if (!element.isConnected || doc.fonts.status !== 'loaded' || images.some(image => !image.complete || image.naturalWidth === 0)) return null;
      const origin = element.getBoundingClientRect();
      const nodes = [...element.querySelectorAll<HTMLElement>('[data-v3-node]')];
      const values = nodes.map(node => {
        const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
        return { id: node.dataset.v3Node, text: node.innerText, font: css.fontSize, display: css.display,
          box: [rect.x - origin.x, rect.y - origin.y, rect.width, rect.height] };
      });
      return nodes.every(node => node.isConnected) && values.every(value => value.font && value.display) ? values : null;
    };
    const first = capture();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const second = capture();
    return first && second && JSON.stringify(first) === JSON.stringify(second) ? second : null;
  });
  const measured: { value: Awaited<ReturnType<typeof sample>> } = { value: null };
  await expect.poll(async () => {
    measured.value = await sample();
    return measured.value !== null;
  }, { message: 'Measure attached, font/image-ready output stable across two frames' }).toBe(true);
  if (!measured.value) throw new Error('Public output was not ready for measurement');
  return measured.value;
}

for (const shell of ['none', 'template', 'builder'] as const) test(`publishes generic elements through the installed UI with explicit confirmation and preserves the live version ${shell}`, async ({ page, context }, info) => {
  const token = await authenticateEditorInteractionAdmin(context), api = await editorInteractionApi(token);
  const slug = `g7pb-public-${shell}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let ownedId: string | undefined;
  const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
  const viewer = await context.newPage(), preview = await context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${editor}?editor=structure`);
    await page.getByLabel('페이지 제목', { exact: true }).fill('공통 요소의 공개 출력 ' + shell);
    await page.getByLabel('기본 주소 이름', { exact: true }).fill(slug);
    await page.getByRole('combobox', { name: '페이지 출력 방식', exact: true }).selectOption(shell);
    const creating = page.waitForResponse(response => response.url().endsWith(documents) && response.request().method() === 'POST');
    await click('빈 페이지 만들기');
    const response = await creating; expect(response.ok(), await response.text()).toBe(true);
    ownedId = (await response.json()).data.document.document_id;
    await click('제목 삽입');
    const layer = page.getByTestId(/^layer-/); await expect(layer).toHaveCount(1);
    const id = (await layer.getAttribute('data-testid'))!.slice('layer-'.length);
    await layer.click();
    const fontGroup = page.getByLabel('글자 크기 지정', { exact: true }).locator('xpath=ancestor::details');
    if (await fontGroup.getAttribute('open') === null) await fontGroup.locator('summary').click();
    await page.getByLabel('글자 크기 지정', { exact: true }).check();
    await page.getByLabel('글자 크기 형식', { exact: true }).selectOption({ label: 'px' });
    await page.getByLabel('글자 크기 값', { exact: true }).fill('27'); await click('디자인 적용');
    await click('모바일');
    if (await fontGroup.getAttribute('open') === null) await fontGroup.locator('summary').click();
    await page.getByLabel('글자 크기 지정', { exact: true }).check();
    await page.getByLabel('글자 크기 형식', { exact: true }).selectOption({ label: 'px' });
    await page.getByLabel('글자 크기 값', { exact: true }).fill('21'); await click('디자인 적용');
    await click('공개 미리보기 준비');
    const previewLink = page.getByRole('link', { name: '공개 미리보기 열기', exact: true }); await expect(previewLink).toBeVisible();
    const previewUrl = (await previewLink.getAttribute('href'))!;
    await expect(page.getByTestId('structure-document-status')).toHaveText('초안 저장됨');
    let current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
    expect(current.active_artifact_sha256).toBeNull();
    await click('발행 준비');
    const dialog = page.getByRole('dialog', { name: '이 버전을 공개할까요?' }); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
    current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
    expect(current.active_artifact_sha256).toBeNull();
    await click('발행 준비'); await expect(dialog).toBeVisible();
    await info.attach(`publication-confirm-${shell}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    await click('이 버전 발행');
    const publicLink = page.getByRole('link', { name: '공개 페이지 열기', exact: true }); await expect(publicLink).toBeVisible();
    const publicUrl = (await publicLink.getAttribute('href'))!;
    current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
    expect(current.active_artifact_sha256).toMatch(/^[a-f0-9]{64}$/);
    const liveHash = current.active_artifact_sha256;
    for (const [label, width, font] of [['PC · 공통값', 1280, '27px'], ['태블릿', 768, '27px'], ['모바일', 360, '21px']] as const) {
      await click(label); await click('화면 맞춤');
      await expect(page.frameLocator('iframe').locator(`[data-v3-node="${id}"]`)).toHaveCSS('font-size', font);
      await viewer.setViewportSize({ width, height: 1000 }); await preview.setViewportSize({ width, height: 1000 });
      expect((await viewer.goto(publicUrl))?.ok()).toBe(true); expect((await preview.goto(previewUrl))?.ok()).toBe(true);
      const publicSurface = viewer.locator('[data-g7pb-v3-public]'), previewSurface = preview.locator('[data-g7pb-v3-public]');
      await expect(publicSurface.locator(`[data-v3-node="${id}"]`)).toHaveCSS('font-size', font);
      const actual = await publicNodes(publicSurface), expected = await publicNodes(previewSurface);
      expect(actual.map(({ box: _box, ...node }) => node)).toEqual(expected.map(({ box: _box, ...node }) => node));
      for (let index = 0; index < actual.length; index++) for (let axis = 0; axis < 4; axis++) {
        expect(Math.abs(actual[index].box[axis] - expected[index].box[axis]), `${shell}/${width}/${id}/${axis}`).toBeLessThanOrEqual(1);
      }
      await info.attach(`public-output-${shell}-${width}`, { body: await viewer.screenshot(), contentType: 'image/png' });
    }
    // New input remains a draft; neither save nor preview silently replaces live output.
    await click('본문 삽입'); await click('저장');
    await expect(page.getByTestId('structure-document-status')).toHaveText('초안 저장됨');
    current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
    expect(current.active_artifact_sha256).toBe(liveHash); expect(current.document.blocks).toHaveLength(2);
    await viewer.reload(); await expect(viewer.locator('[data-g7pb-v3-public] [data-v3-node]')).toHaveCount(1);
    await page.reload(); await expect(page.getByTestId(/^layer-/)).toHaveCount(2);
    await info.attach(`canonical-publication-${shell}`, { body: JSON.stringify(current), contentType: 'application/json' });
  } finally {
    await viewer.close(); await preview.close();
    try {
      if (ownedId) {
        const current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
        expect(current.document.slug).toBe(slug);
        const result = await api.post(`${documents}/${ownedId}/archive`, { data: { expected_lock_version: current.lock_version } });
        expect(result.ok(), await result.text()).toBe(true);
        await info.attach('owned-document-archived', { body: await result.body(), contentType: 'application/json' });
      }
    } finally { await api.dispose(); }
  }
});

for (const shell of ['none', 'template', 'builder'] as const) test(`publishes common icons with authored sizing meaning and safe hydration ${shell}`, async ({ page, context }, info) => {
  const token = await authenticateEditorInteractionAdmin(context), api = await editorInteractionApi(token);
  const slug = `g7pb-icons-${shell}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let ownedId: string | undefined;
  const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
  const viewer = await context.newPage(), preview = await context.newPage();
  const length = async (label: string, value: number) => {
    const field = page.getByLabel(label + ' 지정', { exact: true }), details = field.locator('xpath=ancestor::details');
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
    await field.check(); await page.getByLabel(label + ' 형식', { exact: true }).selectOption({ label: 'px' });
    await page.getByLabel(label + ' 값', { exact: true }).fill(String(value));
  };
  const sample = async (surface: Locator) => surface.locator('[data-v3-node]').evaluateAll(nodes => nodes.map(node => {
    const svg = node.querySelector('svg')!, box = node.getBoundingClientRect(), graphic = svg.getBoundingClientRect();
    return { id: node.getAttribute('data-v3-node'), role: node.getAttribute('role'), label: node.getAttribute('aria-label'),
      hidden: node.getAttribute('aria-hidden'), color: getComputedStyle(svg).color, viewBox: svg.getAttribute('viewBox'),
      stroke: getComputedStyle(svg).stroke, strokeWidth: getComputedStyle(svg).strokeWidth,
      shapes: [...svg.children].map(child => ({ tag: child.tagName, attributes: Object.fromEntries([...child.attributes]
        .filter(attribute => attribute.name !== 'class').map(attribute => [attribute.name, attribute.value])) })),
      size: [box.width, box.height, graphic.width, graphic.height] };
  }));
  try {
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`${editor}?editor=structure`);
    await page.getByLabel('페이지 제목', { exact: true }).fill('공통 아이콘 공개 검증 ' + shell);
    await page.getByLabel('기본 주소 이름', { exact: true }).fill(slug);
    await page.getByRole('combobox', { name: '페이지 출력 방식', exact: true }).selectOption(shell);
    const creating = page.waitForResponse(response => response.url().endsWith(documents) && response.request().method() === 'POST');
    await click('빈 페이지 만들기'); const response = await creating;
    expect(response.ok(), await response.text()).toBe(true); ownedId = (await response.json()).data.document.document_id;
    const identities: string[] = [];
    for (const [index, icon] of ['star', 'check', 'target'].entries()) {
      await page.getByLabel('삽입 위치', { exact: true }).selectOption('root'); await click('아이콘 삽입');
      const layers = page.getByTestId(/^layer-/); await expect(layers).toHaveCount(index + 1);
      const layer = layers.nth(index); identities.push((await layer.getAttribute('data-testid'))!.slice('layer-'.length));
      await layer.click(); await page.getByLabel('아이콘 종류', { exact: true }).selectOption(icon);
      if (index !== 1) {
        await page.getByLabel('장식용 아이콘', { exact: true }).uncheck();
        await page.getByLabel('아이콘 설명', { exact: true }).fill('안내 <문자> ' + icon);
      }
      await click('아이콘 적용');
    }
    await page.getByTestId('layer-' + identities[0]).click();
    await length('너비', 48); await length('높이', 32); await click('디자인 적용');
    await click('모바일'); await length('너비', 20); await length('높이', 20); await click('디자인 적용');
    await click('저장'); await expect(page.getByTestId('structure-document-status')).toHaveText('초안 저장됨');
    const before = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
    expect(before.document.blocks.map((node: { props: unknown }) => node.props)).toEqual([
      { icon: 'star', label: '안내 <문자> star', decorative: false },
      { icon: 'check', label: '', decorative: true },
      { icon: 'target', label: '안내 <문자> target', decorative: false },
    ]);
    await page.reload(); await expect(page.getByTestId(/^layer-/)).toHaveCount(3);
    await click('공개 미리보기 준비');
    const previewLink = page.getByRole('link', { name: '공개 미리보기 열기', exact: true }); await expect(previewLink).toBeVisible();
    const previewUrl = (await previewLink.getAttribute('href'))!;
    await click('발행 준비'); await expect(page.getByRole('dialog', { name: '이 버전을 공개할까요?' })).toBeVisible();
    await click('이 버전 발행');
    const publicLink = page.getByRole('link', { name: '공개 페이지 열기', exact: true }); await expect(publicLink).toBeVisible();
    const publicUrl = (await publicLink.getAttribute('href'))!;
    for (const [label, width] of [['PC · 공통값', 1280], ['태블릿', 768], ['모바일', 360]] as const) {
      await click(label); await page.getByLabel('작업면 확대', { exact: true }).selectOption('1');
      const canvas = page.frameLocator('iframe').locator('[data-v3-surface]');
      await expect(canvas.locator('svg')).toHaveCount(3);
      const expected = await sample(canvas);
      expect(expected[0].size).toEqual(width === 360 ? [20, 20, 20, 20] : [48, 32, 48, 32]);
      expect(expected[0]).toMatchObject({ role: 'img', label: '안내 <문자> star', hidden: null });
      expect(expected[1]).toMatchObject({ role: 'button', label: '아이콘', hidden: null, size: [24, 24, 24, 24] });
      expect(expected[2]).toMatchObject({ role: 'img', label: '안내 <문자> target', hidden: null });
      await click('구조 미리보기');
      const authoredSurface = page.getByTestId('v3-preview'); await expect(authoredSurface.locator('svg')).toHaveCount(3);
      const authored = await sample(authoredSurface);
      expect(authored.map(({ size: _size, ...node }) => node)).toEqual(expected.map(({ size: _size, ...node }, index) =>
        index === 1 ? { ...node, role: null, label: null, hidden: 'true' } : node));
      for (const [index, node] of authored.entries()) for (let axis = 0; axis < 4; axis++) {
        expect(Math.abs(node.size[axis] - expected[index].size[axis]), `canvas/preview/${shell}/${width}/${index}/${axis}`).toBeLessThanOrEqual(1);
      }
      await click('구조 미리보기');
      const captures = [];
      for (const [name, target, url] of [['preview', preview, previewUrl], ['public', viewer, publicUrl]] as const) {
        await target.setViewportSize({ width, height: 1000 }); expect((await target.goto(url))?.ok()).toBe(true);
        const surface = target.locator('[data-g7pb-v3-public]'); await expect(surface.locator('svg')).toHaveCount(3);
        await expect(surface.locator('[data-g7pb-runtime-icon]')).toHaveCount(0);
        await expect(surface.locator('script,iframe')).toHaveCount(0);
        const actual = await sample(surface);
        expect(actual.map(({ size: _size, ...node }) => node)).toEqual(authored.map(({ size: _size, ...node }) => node));
        for (const [index, node] of actual.entries()) for (let axis = 0; axis < 4; axis++) {
          expect(Math.abs(node.size[axis] - expected[index].size[axis]), `${shell}/${width}/${index}/${axis}`).toBeLessThanOrEqual(1);
        }
        captures.push({ name, actual });
        await info.attach(`icons-${shell}-${name}-${width}`, { body: await target.screenshot(), contentType: 'image/png' });
      }
      await info.attach(`icons-${shell}-measurements-${width}`, { body: JSON.stringify({ canvas: expected, authored, captures }), contentType: 'application/json' });
    }
    const current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
    expect(current.document).toEqual(before.document); expect(current.active_artifact_sha256).toMatch(/^[a-f0-9]{64}$/);
    await info.attach('published-common-icons-source', { body: JSON.stringify(current), contentType: 'application/json' });
  } finally {
    await viewer.close(); await preview.close();
    try {
      if (ownedId) {
        const current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
        expect(current.document.slug).toBe(slug);
        const result = await api.post(`${documents}/${ownedId}/archive`, { data: { expected_lock_version: current.lock_version } });
        expect(result.ok(), await result.text()).toBe(true);
        await info.attach('owned-document-archived', { body: await result.body(), contentType: 'application/json' });
      }
    } finally { await api.dispose(); }
  }
});

test('creates an empty page in the installed generic editor and preserves nested edits through authenticated save and reload', async ({ page, context }, testInfo) => {
  const token = await authenticateEditorInteractionAdmin(context), api = await editorInteractionApi(token);
  const slug = `g7pb-product-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let ownedId: string | undefined;
  const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const loadedScripts: string[] = [];
    page.on('request', request => { if (request.resourceType() === 'script') loadedScripts.push(request.url()); });
    const catalogResponse = page.waitForResponse(response => /\/data\/builtin-v3-[\w-]+\.json$/.test(response.url()));
    await page.goto(`${editor}?editor=structure`);
    const catalog = await catalogResponse;
    expect(catalog.ok()).toBe(true); expect(await catalog.json()).toHaveLength(63);
    await expect(page.getByTestId('structure-document-host')).toBeVisible();
    await page.getByLabel('페이지 제목', { exact: true }).fill('블록 없는 공통 요소 편집');
    await page.getByLabel('기본 주소 이름', { exact: true }).fill(slug);
    await page.getByRole('combobox', { name: '페이지 출력 방식', exact: true }).selectOption('none');
    const creating = page.waitForResponse(response => response.url().endsWith(documents) && response.request().method() === 'POST');
    await click('빈 페이지 만들기');
    const createdResponse = await creating;
    expect(createdResponse.ok(), await createdResponse.text()).toBe(true);
    const created = (await createdResponse.json()).data;
    ownedId = created.document.document_id;
    expect(created.document.schema_version).toBe('g7-page-builder/v3');
    expect(created.document.blocks).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`document=${ownedId}&editor=structure$`));
    await testInfo.attach('owned-document', { body: JSON.stringify({ documentId: ownedId, slug }), contentType: 'application/json' });
    await expect(page.getByRole('main', { name: '독립 구조 편집기' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '구성 선택', exact: true }).locator('option')).toHaveCount(63);
    expect(loadedScripts.some(url => url.includes('/page-builder-structure.iife.js'))).toBe(true);
    expect(loadedScripts.some(url => url.includes('/page-builder-editor.iife.js'))).toBe(false);
    await click('컨테이너 삽입');
    const layers = page.getByTestId(/^layer-/);
    await expect(layers).toHaveCount(1);
    const containerId = (await layers.first().getAttribute('data-testid'))!.slice('layer-'.length);
    await page.getByLabel('삽입 위치', { exact: true }).selectOption(containerId);
    await click('제목 삽입'); await expect(layers).toHaveCount(2);
    const headingId = (await layers.last().getAttribute('data-testid'))!.slice('layer-'.length);
    await click('실행 취소'); await expect(layers).toHaveCount(1);
    await click('다시 실행'); await expect(layers).toHaveCount(2);
    await page.getByTestId('layer-' + headingId).click();
    await click('본문 입력');
    const content = page.frameLocator('iframe').locator(`[data-v3-node="${headingId}"]`);
    await content.locator('[contenteditable]').click();
    const text = content.locator('.tiptap[contenteditable="true"]');
    await expect(text).toBeVisible(); await text.click(); await text.press('ControlOrMeta+A');
    await page.keyboard.insertText('등록 없이 만든 한글 제목');
    await expect(text).toHaveText('등록 없이 만든 한글 제목');
    await click('구조 선택');
    const saveResponse = page.waitForResponse(response => response.url().endsWith(`${documents}/${ownedId}/draft`) && response.request().method() === 'PUT');
    await click('저장');
    const response = await saveResponse; expect(response.ok(), await response.text()).toBe(true);
    const saved = (await response.json()).data;
    const source = saved.document as DocumentV3;
    expect(source.blocks).toHaveLength(1);
    const heading = source.blocks[0].slots.content?.[0];
    expect(heading?.instance_id).toBe(headingId);
    expect(heading?.type).toBe('content.heading');
    expect(JSON.stringify(heading?.props)).toContain('등록 없이 만든 한글 제목');
    await expect(page.getByTestId('structure-document-status')).toHaveText('초안 저장됨');
    await page.reload();
    await expect(page.getByTestId('layer-' + headingId)).toBeVisible();
    await expect(page.frameLocator('iframe').locator(`[data-v3-node="${headingId}"]`)).toHaveText('등록 없이 만든 한글 제목');
    for (const [label, width] of [['PC · 공통값', 1280], ['태블릿', 768], ['모바일', 360]] as const) {
      await click(label); await click('화면 맞춤');
      await expect(page.locator('[data-v3-workspace]')).toHaveCSS('width', width + 'px');
      // The installed host's stylesheet arrives asynchronously in Puck's frame.
      // Once mirrored, chrome must remain transparent over the white workspace.
      const frame = page.frameLocator('iframe');
      const mirroredStyle = frame.locator('link[rel="stylesheet"][href*="page-builder-structure.css"]');
      await expect(mirroredStyle).toHaveCount(1);
      await expect.poll(() => mirroredStyle.evaluate(link => 'sheet' in link && link.sheet !== null)).toBe(true);
      await expect(frame.locator('html')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(frame.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('[data-v3-workspace]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await testInfo.attach(`product-canvas-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    }
    const reopened = await api.get(`${documents}/${ownedId}`);
    expect(reopened.ok()).toBe(true);
    expect((await reopened.json()).data.document).toEqual(source);
    await testInfo.attach('ui-created-canonical-source', { body: JSON.stringify(source), contentType: 'application/json' });
    // The old bookmark must dispatch from authenticated source version, not auto-convert.
    await page.goto(`${editor}?document=${ownedId}`);
    await expect(page).toHaveURL(new RegExp(`document=${ownedId}&editor=structure$`));
    await expect(page.getByTestId('layer-' + headingId)).toBeVisible();
  } finally {
    try {
      if (ownedId) {
        const current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
        expect(current.document.slug).toBe(slug); expect(current.document.document_id).toBe(ownedId);
        const archived = await api.post(`${documents}/${ownedId}/archive`, { data: { expected_lock_version: current.lock_version } });
        expect(archived.ok(), await archived.text()).toBe(true);
        await testInfo.attach('owned-document-archived', { body: await archived.body(), contentType: 'application/json' });
      }
    } finally { await api.dispose(); }
  }
});
