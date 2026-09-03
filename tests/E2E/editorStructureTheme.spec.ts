import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import { replacePuckRichTextField } from './support/richTextInput';
import {
  authenticateEditorInteractionAdmin,
  cleanupOwnedEditorInteractionDocument,
  createOwnedEditorInteractionDocument,
  editorInteractionApi,
  type OwnedEditorInteractionDocument,
} from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin/documents';
const EDITOR = '/modules/jiwonpapa-page_builder/admin/editor';
const COPY = {
  heroBody: '기본 배경의 본문은 페이지 테마를 따릅니다.',
  contactAddress: '부드러운 배경의 주소도 읽을 수 있습니다.',
  cardBody: '대비 구역 안의 카드는 배경과 글자색을 함께 유지합니다.',
  pricingName: '테마 코드 검증 플랜',
  pricingBody: '가격 카드의 배경과 글자색을 함께 검증합니다.',
  nestedHeading: '원래 중첩 제목',
  editedHeading: '수정한 중첩 제목',
  siblingBody: '다른 열의 내용은 그대로 남아 있습니다.',
};

function block(type: string, props: Record<string, unknown>, slots: Record<string, PageBuilderBlock[]> = {}): PageBuilderBlock {
  return { instance_id: crypto.randomUUID(), type, block_version: 1, props, slots };
}

function themeBlocks(): PageBuilderBlock[] {
  return [
    block('content.hero-centered-01', {
      eyebrow: 'THEME', title: '페이지 테마 검증', body: `<p>${COPY.heroBody}</p>`, alignment: 'left', layout: 'poster',
      appearance: { surface: 'default', spacing: 'compact' },
    }),
    block('content.contact-info-01', {
      heading: '연락처', address: COPY.contactAddress, phone: '02-0000-0000', email: 'theme@example.com',
      appearance: { surface: 'soft', spacing: 'compact' },
    }),
    block('content.features-grid-01', {
      title: '대비 배경의 카드', layout: 'grid',
      items: [
        { icon: 'sparkles', title: '첫 번째 카드', body: `<p>${COPY.cardBody}</p>` },
        { icon: 'shield', title: '두 번째 카드', body: '<p>독립 카드의 텍스트입니다.</p>' },
      ],
      appearance: { surface: 'contrast', spacing: 'compact' },
    }),
    block('commerce.pricing-tiers-01', {
      eyebrow: 'FIXTURE', heading: '가격 카드 테마 계약', layout: 'cards',
      plans: [COPY.pricingName, '두 번째 검증 플랜'].map((name, index) => ({
        name, price: `${index + 1}`, period: '월', description: index === 0 ? `<p>${COPY.pricingBody}</p>` : '<p>테스트 데이터</p>',
        features: ['검증 항목'], buttonLabel: '확인', buttonUrl: '/fixture', featured: false,
      })),
      appearance: { surface: 'default', spacing: 'compact' },
    }),
  ];
}

function nestedBlocks(): PageBuilderBlock[] {
  return [block('layout.section-01', { width: 'standard', spacing: 'compact' }, {
    content: [block('layout.columns-01', { columns: 2, ratio: '1:1', gap: 'normal' }, {
      column1: [block('content.heading-01', { eyebrow: '', heading: COPY.nestedHeading, level: 2, anchor: '' })],
      column2: [block('content.rich-text-01', { content: `<p>${COPY.siblingBody}</p>`, measure: 'standard' })],
    })],
  })];
}

async function resource(api: APIRequestContext, id: string): Promise<{ document: PageBuilderDocument; lock_version: number }> {
  const response = await api.get(`${API}/${id}`);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: { document?: PageBuilderDocument; lock_version?: number } };
  if (!payload.data?.document || typeof payload.data.lock_version !== 'number') throw new Error('Missing owned document resource.');
  return { document: payload.data.document, lock_version: payload.data.lock_version };
}

async function withOwnedDocument(
  page: Page, context: BrowserContext, project: string, blocks: PageBuilderBlock[],
  run: (api: APIRequestContext, owned: OwnedEditorInteractionDocument, seededDocument: PageBuilderDocument) => Promise<void>,
  tokens: PageBuilderDocument['tokens'] = {},
): Promise<void> {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const pageErrors: string[] = [];
  const watchErrors = (target: Page): void => { target.on('pageerror', (error) => pageErrors.push(error.message)); };
  watchErrors(page);
  context.on('page', watchErrors);
  let owned: OwnedEditorInteractionDocument | undefined;
  try {
    owned = await createOwnedEditorInteractionDocument(api, project);
    const current = await resource(api, owned.documentId);
    const document: PageBuilderDocument = {
      ...current.document, schema_version: 'g7-page-builder/v2', blocks,
      tokens: { ...current.document.tokens, 'design.color_mode': 'light', 'design.scale': 'large', ...tokens },
    };
    const seeded = await api.put(`${API}/${owned.documentId}/draft`, {
      data: { document, expected_lock_version: current.lock_version },
    });
    expect(seeded.ok(), `Fixture draft rejected (${seeded.status()})`).toBe(true);
    const seededDocument = (await resource(api, owned.documentId)).document;
    expect((await page.goto(`${EDITOR}?document=${owned.documentId}`))?.ok()).toBe(true);
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await run(api, owned, seededDocument);
    expect(pageErrors, 'Editor or compiled preview raised an uncaught browser exception.').toEqual([]);
  } catch (error) {
    if (!page.isClosed()) {
      const evidence = await Promise.allSettled([
        (async () => test.info().attach('editor-failure-screen', {
          body: await page.screenshot(), contentType: 'image/png',
        }))(),
        (async () => test.info().attach('editor-failure-aria', {
          body: await page.locator('body').ariaSnapshot(), contentType: 'text/plain',
        }))(),
      ]);
      const captureErrors = evidence.flatMap((result) => result.status === 'rejected' ? [String(result.reason)] : []);
      if (captureErrors.length) await test.info().attach('editor-failure-evidence-errors', {
        body: captureErrors.join('\n'), contentType: 'text/plain',
      });
    }
    throw error;
  } finally {
    context.off('page', watchErrors);
    // Stop editor timers before deleting only the document proven by its ownership journal.
    await page.close();
    try {
      if (owned) await cleanupOwnedEditorInteractionDocument(api, owned);
    } finally {
      await api.dispose();
    }
  }
}

async function save(page: Page): Promise<void> {
  const response = page.waitForResponse((candidate) => {
    const path = new URL(candidate.url()).pathname;
    return (candidate.request().method() === 'PUT' && path.endsWith('/draft'))
      || (candidate.request().method() === 'POST' && path.endsWith('/preview'));
  });
  await page.getByTestId('page-builder-save').click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}

function blockCount(blocks: PageBuilderBlock[], type: string): number {
  return blocks.reduce((count, item) => count + Number(item.type === type)
    + Object.values(item.slots ?? {}).reduce((children, slot) => children + blockCount(slot, type), 0), 0);
}

async function waitForAutosavedStackCount(page: Page, documentId: string, expected: number): Promise<void> {
  const response = await page.waitForResponse((candidate) => {
    if (candidate.request().method() !== 'PUT' || new URL(candidate.url()).pathname !== `${API}/${documentId}/draft`) return false;
    const request = candidate.request().postDataJSON() as { document?: PageBuilderDocument };
    return request.document?.document_id === documentId
      && blockCount(request.document.blocks, 'layout.columns-01') === 2
      && blockCount(request.document.blocks, 'layout.stack-01') === expected;
  });
  expect(response.ok(), `Autosave failed (${response.status()})`).toBe(true);
  const payload = await response.json() as { data?: { document?: PageBuilderDocument } };
  if (!payload.data?.document) throw new Error('Autosave returned no document.');
  expect(payload.data.document.document_id).toBe(documentId);
  expect(blockCount(payload.data.document.blocks, 'layout.columns-01')).toBe(2);
  expect(blockCount(payload.data.document.blocks, 'layout.stack-01')).toBe(expected);
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}

async function sample(locator: Locator): Promise<{ color: string; background: string; fontSize: string; rootFontSize: string }> {
  return locator.evaluate((element) => {
    const view = element.ownerDocument.defaultView;
    if (!view) throw new Error('Missing rendered document window.');
    let background = 'rgba(0, 0, 0, 0)';
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      background = view.getComputedStyle(parent).backgroundColor;
      if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') break;
    }
    return {
      color: view.getComputedStyle(element).color, background,
      fontSize: view.getComputedStyle(element).fontSize,
      rootFontSize: view.getComputedStyle(element.ownerDocument.documentElement).fontSize,
    };
  });
}

function contrast(color: string, background: string): number {
  const luminance = (value: string): number => {
    const channels = value.match(/[\d.]+/g)?.map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Expected an opaque computed RGB color: ${value}`);
    const linear = channels.map((channel) => channel / 255).map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const a = luminance(color), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test.use({ trace: 'off', video: 'off' });

test.describe('Editor structure and theme contracts', () => {
  test.describe.configure({ retries: 0 });

  test('page themes retain readable child text in light, dark and system modes', async ({ page, context }, info) => {
    await withOwnedDocument(page, context, info.project.name, themeBlocks(), async (api, owned) => {
      const frame = page.frameLocator('iframe');
      const preview = await context.newPage();
      const states = [
        { mode: 'light', label: '라이트 테마', system: 'dark', expected: 'light' },
        { mode: 'dark', label: '다크 테마', system: 'light', expected: 'dark' },
        { mode: 'system', label: '기기 테마', system: 'light', expected: 'light' },
        { mode: 'system', label: '기기 테마', system: 'dark', expected: 'dark' },
      ] as const;
      try {
        for (const state of states) {
          await page.emulateMedia({ colorScheme: state.system });
          await preview.emulateMedia({ colorScheme: state.system });
          await page.getByRole('button', { name: state.label, exact: true }).click();
          const canvasTheme = frame.locator('.g7pb-document-theme');
          await expect(canvasTheme).toHaveClass(new RegExp(`g7pb-theme-mode-${state.mode}`));
          await expect(canvasTheme).toHaveCSS('color-scheme', state.expected);
          await save(page);
          const current = await resource(api, owned.documentId);
          expect(current.document.tokens?.['design.color_mode']).toBe(state.mode);
          const response = await api.post(`${API}/${owned.documentId}/preview`, {
            data: { expected_lock_version: current.lock_version },
          });
          expect(response.ok()).toBe(true);
          const payload = await response.json() as { data?: { preview_url?: string } };
          if (!payload.data?.preview_url) throw new Error('Missing compiled preview URL.');
          expect((await preview.goto(payload.data.preview_url))?.ok()).toBe(true);
          await expect(preview.locator('.g7pb-document-theme')).toHaveCSS('color-scheme', state.expected);
          for (const [surface, pageRoot] of [['canvas', canvasTheme], ['preview', preview.locator('.g7pb-document-theme')]] as const) {
            const tokens = await pageRoot.evaluate((element) => {
              const view = element.ownerDocument.defaultView;
              if (!view) throw new Error('Missing document theme window.');
              const style = view.getComputedStyle(element);
              return { bodyClass: element.ownerDocument.body.className, ownsEditorUI: element.ownerDocument.querySelector('.g7pb-root') !== null,
                primitive: style.getPropertyValue('--g7pb-neutral-0').trim(),
                ui: ['--g7pb-accent', '--g7pb-surface-strong', '--g7pb-focus-ring'].map((name) => style.getPropertyValue(name).trim()) };
            });
            expect(tokens.primitive).not.toBe('');
            expect(tokens.ownsEditorUI, `${surface} document: ${JSON.stringify(tokens)}`).toBe(false);
            expect(tokens.ui, `${surface}: UI roles must not become document theme defaults: ${JSON.stringify(tokens)}`).toEqual(['', '', '']);
          }
          const pairs = [
            [frame.getByText(COPY.heroBody, { exact: true }), preview.getByText(COPY.heroBody, { exact: true })],
            [frame.getByText(COPY.contactAddress, { exact: true }), preview.getByText(COPY.contactAddress, { exact: true })],
            [frame.getByText('theme@example.com', { exact: true }), preview.getByText('theme@example.com', { exact: true })],
            [frame.getByText(COPY.cardBody, { exact: true }), preview.getByText(COPY.cardBody, { exact: true })],
            [frame.getByText('첫 번째 카드', { exact: true }), preview.getByText('첫 번째 카드', { exact: true })],
            [frame.getByText(COPY.pricingName, { exact: true }), preview.getByText(COPY.pricingName, { exact: true })],
            [frame.getByText(COPY.pricingBody, { exact: true }), preview.getByText(COPY.pricingBody, { exact: true })],
          ];
          for (const [editorText, publicText] of pairs) {
            await expect(editorText).toBeVisible();
            await expect(publicText).toBeVisible();
            const [editorStyle, publicStyle] = await Promise.all([sample(editorText), sample(publicText)]);
            expect(editorStyle.color).toBe(publicStyle.color);
            expect(editorStyle.background).toBe(publicStyle.background);
            expect(contrast(editorStyle.color, editorStyle.background)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(publicStyle.color, publicStyle.background)).toBeGreaterThanOrEqual(4.5);
          }
          const [editorRoot, publicRoot] = await Promise.all([sample(canvasTheme), sample(preview.locator('.g7pb-document-theme'))]);
          expect(editorRoot.rootFontSize).toBe(publicRoot.rootFontSize);
          expect(editorRoot.fontSize).toBe(publicRoot.fontSize);
          expect(parseFloat(editorRoot.fontSize)).toBeCloseTo(parseFloat(editorRoot.rootFontSize) * 1.125);
          if (state.mode === 'dark') await page.screenshot({ path: info.outputPath('editor-theme-dark.png'), fullPage: false });
        }
      } finally {
        await preview.close();
      }
    });
  });

  test('keeps explicit typography and inline colors across editor and compiled preview under host styles', async ({ page, context }, info) => {
    const regular = block('content.heading-01', {
      eyebrow: '', heading: '사용자가 선택한 보통 제목', level: 2, anchor: '',
      appearance: { surface: 'default', spacing: 'compact', textAlign: 'right', elements: { heading: { weight: 'regular' } } },
    });
    const heading = block('content.heading-01', {
      eyebrow: '', heading: '기본 굵기 제목 <span data-g7pb-tone="custom1" data-g7pb-weight="medium" data-g7pb-font="mono" data-g7pb-font-size-rem="1.25">사용자 부분 설정</span>',
      level: 2, anchor: '',
    });
    const features = block('content.features-grid-01', {
      title: '기능 제목 행간', layout: 'grid',
      items: [
        { icon: 'sparkles', title: '검증 기능', body: '<p>합성 코드 검증 본문입니다.</p>' },
        { icon: 'shield', title: '두 번째 기능', body: '<p>독립 합성 본문입니다.</p>' },
      ],
    });
    const testimonials = block('trust.testimonials-01', {
      eyebrow: '대비 표면의 지정 색상', heading: '후기 서식 검증', layout: 'quote-hero',
      items: [
        { quote: '첫 후기의 지정 서체와 크기', name: '합성 A', role: '', company: '', avatarSrc: '', avatarAlt: '', rating: 5 },
        { quote: '두 번째 합성 후기', name: '합성 B', role: '', company: '', avatarSrc: '', avatarAlt: '', rating: 4 },
      ],
      appearance: { surface: 'contrast', elements: { eyebrow: { tone: 'accent' }, 'items.0.quote': { font: 'mono', fontSizeRem: 2 } } },
    });
    const stats = block('data.stats-icons-01', {
      eyebrow: '', heading: '수치 서식 검증', layout: 'editorial',
      items: [
        { icon: 'trend', value: '123', label: '합성 수치 A', detail: '' },
        { icon: 'users', value: '456', label: '합성 수치 B', detail: '' },
      ],
      appearance: { elements: { 'items.0.value': { font: 'mono', fontSizeRem: 2 } } },
    });
    const cta = block('content.cta-split-01', {
      eyebrow: '', heading: '어두운 CTA 서식 검증', body: '본문의 지정 색상', theme: 'dark', layout: 'split',
      appearance: { surface: 'contrast', elements: { body: { tone: 'accent' } } },
    });
    const tabs = block('content.tabs-01', {
      eyebrow: '', heading: '선택 탭 서식 검증', style: 'pills', initialTab: 0,
      items: [
        { label: '첫 탭', heading: '합성 패널 A', body: '합성 본문 A' },
        { label: '다음 탭', heading: '합성 패널 B', body: '합성 본문 B' },
      ],
      appearance: { elements: { 'items.0.label': { tone: 'accent' } } },
    });
    const comparison = block('commerce.comparison-table-01', {
      eyebrow: '', heading: '비교 열 굵기 검증', highlightColumn: -1,
      columns: [
        { title: '기본 굵기 열', description: '' }, { title: '보통 굵기 열', description: '' },
        { title: '중간 굵기 열', description: '' }, { title: '굵은 열', description: '' },
      ],
      rows: [{ feature: '합성 항목', values: ['하나', '둘', '셋', '넷'] }],
      appearance: { surface: 'default', spacing: 'compact', elements: {
        'columns.1.title': { weight: 'regular' }, 'columns.2.title': { weight: 'medium' },
        'columns.3.title': { weight: 'bold' },
      } },
    });
    await withOwnedDocument(page, context, info.project.name, [regular, heading, features, testimonials, stats, cta, tabs, comparison], async (api, owned, seededDocument) => {
      const seededComparison = seededDocument.blocks.find(item => item.instance_id === comparison.instance_id);
      if (!seededComparison) throw new Error('Missing seeded comparison block.');
      expect(seededComparison.props.appearance).toEqual(comparison.props.appearance);
      const frame = page.frameLocator('iframe');
      const strongWeights = ['900', '400', '500', '800'];
      const expectStrongEditorWeights = async (): Promise<void> => {
        for (const [index, weight] of strongWeights.entries()) {
          const field = frame.locator(`[data-block-id="${comparison.instance_id}"] [data-g7pb-inline-field="columns.${index}.title"]`);
          await expect(field).toHaveCSS('display', 'block');
          await expect(field.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true');
          await expect(field.locator('.ProseMirror > p')).toHaveCount(1);
          for (const node of [field, field.locator('.ProseMirror'), field.locator('.ProseMirror > p')]) {
            await expect(node).toHaveCSS('font-weight', weight);
          }
        }
      };
      const editorHeading = (id: string) => frame.locator(`[data-block-id="${id}"] [data-g7pb-heading-level]`).first();
      const regularHeading = editorHeading(regular.instance_id);
      const defaultHeading = editorHeading(heading.instance_id);
      const featureHeading = editorHeading(features.instance_id);
      for (const field of [regularHeading, defaultHeading, featureHeading]) {
        await expect(field.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true');
      }
      await expectStrongEditorWeights();
      // A real content edit makes this save exercise canonical serialization,
      // while the independently styled headings must retain their settings.
      const featureBody = frame.locator(`[data-block-id="${features.instance_id}"] [data-g7pb-inline-field="items.0.body"] .ProseMirror`);
      await replacePuckRichTextField(page, featureBody, '편집 후에도 제목의 부분 서식을 보존합니다.', 'typography companion body');
      await save(page);
      const current = await resource(api, owned.documentId);
      const response = await api.post(`${API}/${owned.documentId}/preview`, {
        data: { expected_lock_version: current.lock_version },
      });
      expect(response.ok()).toBe(true);
      const payload = await response.json() as { data?: { preview_url?: string } };
      if (!payload.data?.preview_url) throw new Error('Missing compiled preview URL.');
      const preview = await context.newPage();
      try {
        expect((await preview.goto(payload.data.preview_url))?.ok()).toBe(true);
        await expectStrongEditorWeights();
        for (const [index, weight] of strongWeights.entries()) {
          const published = preview.locator(`[data-block-id="${comparison.instance_id}"] thead tr > th:nth-child(${index + 2}) > strong`);
          await expect(published).toHaveCount(1);
          await expect(published).toHaveCSS('font-weight', weight);
        }
        // These are competing host defaults, not desired product styles. The
        // outside sentinel proves both the conflict and host non-interference.
        for (const body of [frame.locator('body'), preview.locator('body')]) {
          await body.evaluate((element) => {
            const doc = element.ownerDocument;
            const style = doc.createElement('style');
            style.textContent = 'h1, h2, h3, h4 { font-weight: 300; line-height: 2; }';
            doc.head.append(style);
            const sentinel = doc.createElement('h2');
            sentinel.dataset.typographyHostSentinel = 'true';
            sentinel.textContent = 'Host typography sentinel';
            element.append(sentinel);
          });
          const sentinel = body.locator('[data-typography-host-sentinel]');
          await expect(sentinel).toHaveCSS('font-weight', '300');
          const ratio = await sentinel.evaluate((element) => {
            const view = element.ownerDocument.defaultView;
              if (!view) throw new Error('Missing document theme window.');
              const style = view.getComputedStyle(element);
            return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
          });
          expect(ratio).toBe(2);
        }
        const publicHeading = (id: string) => preview.locator(`[data-block-id="${id}"] h2`);
        for (const [editor, published, weight] of [
          [regularHeading, publicHeading(regular.instance_id), '400'],
          [defaultHeading, publicHeading(heading.instance_id), '700'],
          [featureHeading, publicHeading(features.instance_id), '700'],
        ] as const) {
          await expect(editor).toHaveCSS('font-weight', weight);
          await expect(editor.locator('.ProseMirror')).toHaveCSS('font-weight', weight);
          await expect(published).toHaveCSS('font-weight', weight);
          const leaf = editor.locator('.ProseMirror > p');
          await expect(leaf).toHaveCount(1);
          for (const side of ['top', 'right', 'bottom', 'left']) {
            await expect(leaf).toHaveCSS(`margin-${side}`, '0px');
          }
          for (const property of ['font-family', 'font-feature-settings', 'font-kerning', 'font-size',
            'font-variant-ligatures', 'font-weight', 'color', 'line-height', 'letter-spacing', 'text-align',
            'overflow-wrap', 'white-space', 'word-break']) {
            const inherited = await editor.evaluate((element, name) => element.ownerDocument.defaultView!.getComputedStyle(element).getPropertyValue(name), property);
            await expect(leaf).toHaveCSS(property, inherited);
          }
        }
        await expect(regularHeading).toHaveCSS('text-align', 'right');
        await expect(publicHeading(regular.instance_id)).toHaveCSS('text-align', 'right');
        await expect(featureHeading).toHaveCSS('line-height', 'normal');
        await expect(featureHeading).toHaveCSS('max-width', 'none');
        await expect(publicHeading(features.instance_id)).toHaveCSS('line-height', 'normal');
        // Family layout defaults stay below explicit field typography.
        for (const field of [
          frame.locator(`[data-block-id="${testimonials.instance_id}"] [data-g7pb-inline-field="items.0.quote"]`),
          preview.locator(`[data-block-id="${testimonials.instance_id}"] blockquote:first-child .g7pb-testimonials__quote`),
          frame.locator(`[data-block-id="${stats.instance_id}"] [data-g7pb-inline-field="items.0.value"]`),
          preview.locator(`[data-block-id="${stats.instance_id}"] article:first-child > strong`),
        ]) {
          await expect(field).toHaveCount(1);
          await expect(field).toHaveCSS('font-family', /ui-monospace/);
          const style = await sample(field);
          expect(parseFloat(style.fontSize)).toBeCloseTo(parseFloat(style.rootFontSize) * 2);
        }
        for (const field of [
          frame.locator(`[data-block-id="${testimonials.instance_id}"] [data-g7pb-inline-field="eyebrow"]`),
          preview.locator(`[data-block-id="${testimonials.instance_id}"] p.g7pb-section-eyebrow`),
          frame.locator(`[data-block-id="${cta.instance_id}"] [data-g7pb-inline-field="body"]`),
          preview.locator(`[data-block-id="${cta.instance_id}"] .g7pb-cta__body`),
          frame.locator(`[data-block-id="${tabs.instance_id}"] [data-g7pb-inline-field="items.0.label"]`),
          preview.locator(`[data-block-id="${tabs.instance_id}"] button[role="tab"][aria-selected="true"]`),
        ]) {
          await expect(field).toHaveCount(1);
          await expect(field).toHaveCSS('color', 'rgb(37, 99, 235)');
        }
        const inline = [defaultHeading.locator('[data-g7pb-tone="custom1"]'), publicHeading(heading.instance_id).locator('[data-g7pb-tone="custom1"]')];
        for (const span of inline) {
          await expect(span).toHaveCount(1);
          await expect(span).toHaveText('사용자 부분 설정');
          await expect(span).toHaveAttribute('data-g7pb-font-size-rem', '1.25');
          await expect(span).toHaveCSS('color', 'rgb(18, 52, 86)');
          await expect(span).toHaveCSS('font-weight', '500');
          await expect(span).toHaveCSS('font-family', /ui-monospace/);
          const style = await sample(span);
          expect(parseFloat(style.fontSize)).toBeCloseTo(parseFloat(style.rootFontSize) * 1.25);
          expect(contrast(style.color, style.background)).toBeGreaterThanOrEqual(4.5);
        }
        // Saving through the real editor must preserve the supported inline
        // settings in canonical data as well as in the compiled browser output.
        const saved = (await resource(api, owned.documentId)).document.blocks.find(item => item.instance_id === heading.instance_id);
        expect(saved?.props.heading).toContain('data-g7pb-tone="custom1"');
        expect(saved?.props.heading).toContain('data-g7pb-weight="medium"');
        expect(saved?.props.heading).toContain('data-g7pb-font="mono"');
        expect(saved?.props.heading).toContain('data-g7pb-font-size-rem="1.25"');
        const savedComparison = current.document.blocks.find(item => item.instance_id === comparison.instance_id);
        // Compare with the actual server seed: request middleware canonicalizes
        // empty eyebrow/description strings to null before the editor loads.
        expect(savedComparison?.props).toEqual(seededComparison.props);
        // Reentry uses the saved document, not the original seeded DOM.
        await page.reload();
        await expect(defaultHeading.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true');
        await expect(regularHeading).toHaveCSS('font-weight', '400');
        const reenteredSpan = defaultHeading.locator('[data-g7pb-font-size-rem="1.25"]');
        await expect(reenteredSpan).toHaveCSS('color', 'rgb(18, 52, 86)');
        await expect(reenteredSpan).toHaveCSS('font-weight', '500');
        await expect(reenteredSpan).toHaveCSS('font-family', /ui-monospace/);
        const reenteredStyle = await sample(reenteredSpan);
        expect(parseFloat(reenteredStyle.fontSize)).toBeCloseTo(parseFloat(reenteredStyle.rootFontSize) * 1.25);
        await expectStrongEditorWeights();
      } finally {
        await preview.close();
      }
    }, { 'design.palette': 'blue', 'design.custom_color_1_light': '#123456', 'design.custom_color_1_dark': '#abcdef' });
  });

  test('nested selection edits and inserts within the selected parent', async ({ page, context }, info) => {
    await withOwnedDocument(page, context, info.project.name, nestedBlocks(), async (api, owned) => {
      const frame = page.frameLocator('iframe');
      const columns = frame.getByTestId('page-builder-layout-columns');
      const stacks = frame.getByTestId('page-builder-layout-stack');
      const heading = frame.locator('[data-g7pb-inline-field="heading"][contenteditable], [data-g7pb-inline-field="heading"] [contenteditable]');
      await expect(heading).toHaveCount(1);
      await replacePuckRichTextField(page, heading, COPY.editedHeading, 'nested heading');
      await expect(frame.getByText(COPY.siblingBody, { exact: true })).toBeVisible();
      // Editing inline text need not select its Puck container. Select each
      // structure explicitly through Outline's visible row button.
      await page.getByRole('navigation').getByText('Outline', { exact: true }).click();
      const sectionRow = page.locator('[data-puck-layer-tree-id]')
        .filter({ has: page.getByRole('button', { name: 'Section · 구조 컨테이너', exact: true }) });
      await sectionRow.getByRole('button', { name: 'Section · 구조 컨테이너', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Section · 구조 컨테이너', exact: true })).toBeVisible();
      const insertSection = page.getByRole('group', { name: 'Section 구조 추가', exact: true });
      await expect(insertSection).toBeVisible();
      await expect(page.getByTestId('page-builder-save-section-pattern')).toBeEnabled();
      const expandSection = sectionRow.locator(':scope > div').first().getByRole('button', { name: 'Expand', exact: true });
      if (await expandSection.isVisible()) await expandSection.click();
      await insertSection.getByRole('button', { name: '2열', exact: true }).click();
      await expect(columns).toHaveCount(2);
      await expect(heading).toHaveText(COPY.editedHeading);
      const columnsInOutline = page.getByRole('button', { name: 'Columns · 1/2/3열', exact: true })
        .and(page.locator('[data-puck-layer-tree-id] button'));
      await expect(columnsInOutline).toHaveCount(2);
      await columnsInOutline.nth(1).click();
      await expect(page.getByRole('heading', { name: 'Columns · 1/2/3열', exact: true })).toBeVisible();
      const insertStack = page.getByRole('group', { name: '열별 Stack 추가', exact: true });
      await expect(insertStack).toBeVisible();
      const stackInsertedAndSaved = waitForAutosavedStackCount(page, owned.documentId, 1);
      await Promise.all([stackInsertedAndSaved, insertStack.getByRole('button', { name: '1열', exact: true }).click()]);
      await expect(columns.nth(1).getByTestId('page-builder-layout-stack')).toHaveCount(1);
      await expect(columns.first().getByTestId('page-builder-layout-stack')).toHaveCount(0);
      const newColumnsRow = columnsInOutline.nth(1).locator('xpath=ancestor::li[@data-puck-layer-tree-id][1]');
      const expandColumns = newColumnsRow.locator(':scope > div').first().getByRole('button', { name: 'Expand', exact: true });
      if (await expandColumns.isVisible()) await expandColumns.click();
      await newColumnsRow.getByRole('button', { name: 'Stack · 세로 흐름', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Stack · 세로 흐름', exact: true })).toBeVisible();
      const stackDeletedAndSaved = waitForAutosavedStackCount(page, owned.documentId, 0);
      await Promise.all([stackDeletedAndSaved,
        page.getByTestId('page-builder-layout-delete').getByRole('button', { name: '구조 삭제', exact: true }).click()]);
      await expect(stacks).toHaveCount(0);
      // Puck coalesces rapid edits in its history window. This verifies undo
      // between acknowledged autosaved states, not one history entry per rapid command.
      await page.getByRole('button', { name: 'undo', exact: true }).click();
      await expect(stacks).toHaveCount(1);
      await expect(columns).toHaveCount(2);
      await expect(heading).toHaveText(COPY.editedHeading);
      await save(page);
      const saved = await resource(api, owned.documentId);
      const children = saved.document.blocks[0].slots?.content;
      expect(saved.document.blocks).toHaveLength(1);
      expect(children).toHaveLength(2);
      expect(children?.[0].slots?.column1[0].props.heading).toContain(COPY.editedHeading);
      expect(children?.[0].slots?.column2[0].props.content).toContain(COPY.siblingBody);
      expect(children?.[1].slots?.column1[0].type).toBe('layout.stack-01');
      await page.reload();
      await expect(page.getByTestId('page-builder-editor')).toBeVisible();
      await expect(columns).toHaveCount(2);
      await expect(stacks).toHaveCount(1);
      await expect(heading).toHaveText(COPY.editedHeading);
      await expect(frame.getByText(COPY.siblingBody, { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('editor-nested-structure.png'), fullPage: false });
    });
  });

  test('pattern dialog owns an opaque portal surface', async ({ page, context }, info) => {
    await withOwnedDocument(page, context, info.project.name, nestedBlocks(), async (api, owned) => {
      await page.getByTestId('page-builder-section-patterns').click();
      const portal = page.locator('[data-g7pb-portal-surface="true"]');
      const dialog = portal.getByRole('dialog', { name: '내 패턴', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await expect(dialog).toHaveCSS('color', 'rgb(23, 32, 51)');
      await expect(dialog).toHaveCSS('box-sizing', 'border-box');
      const portalGeometry = await portal.evaluate((element) => ({ height: element.getBoundingClientRect().height, viewport: window.innerHeight }));
      expect(portalGeometry.height).toBeLessThan(portalGeometry.viewport);
      const close = dialog.getByRole('button', { name: '닫기', exact: true });
      await expect(close).toHaveCSS('font-family', await page.locator('.g7pb-root').evaluate((element) => getComputedStyle(element).fontFamily));
      const colors = await sample(dialog);
      expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5);
      const applicationAccent = await page.locator('.g7pb-root').evaluate((element) => getComputedStyle(element).getPropertyValue('--g7pb-accent').trim());
      expect(applicationAccent).not.toBe('');
      expect(await portal.evaluate((element) => getComputedStyle(element).getPropertyValue('--g7pb-accent').trim())).toBe(applicationAccent);
      const closeColors = await sample(close);
      expect(contrast(closeColors.color, closeColors.background)).toBeGreaterThanOrEqual(4.5);
      await test.info().attach('editor-ui-opaque-portal', { body: await page.screenshot(), contentType: 'image/png' });
      await close.click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId('page-builder-editor')).toBeVisible();

      const draftPath = `${API}/${owned.documentId}/draft`;
      const origin = new URL(page.url()).origin;
      const draftRoute = (url: URL): boolean => url.origin === origin && url.pathname === draftPath;
      let releaseSave = (): void => {};
      let notifySave = (): void => {};
      const pendingSave = new Promise<void>((resolve) => { releaseSave = resolve; });
      const saveRequested = new Promise<void>((resolve) => { notifySave = resolve; });
      let rejectedSaves = 0;
      const rejectDraft = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'PUT') { await route.continue(); return; }
        const input = route.request().postDataJSON() as { document: PageBuilderDocument };
        expect(input.document.document_id).toBe(owned.documentId);
        expect(input.document.tokens?.['design.color_mode']).toBe('dark');
        rejectedSaves += 1;
        if (rejectedSaves === 1) { notifySave(); await pendingSave; }
        await route.fulfill({ status: 422, json: { success: false, message: 'Synthetic draft save rejected', code: 'G7PB_SYNTHETIC_SAVE_REJECTED' } });
      };
      await page.route(draftRoute, rejectDraft);
      try {
        // Real editing makes the draft dirty; clean Save can only generate a preview.
        await page.getByRole('button', { name: '다크 테마', exact: true }).click();
        await saveRequested;
        await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saving');
        await expect(page.getByTestId('page-builder-save')).toBeDisabled();
        await expect(page.getByTestId('page-builder-publish')).toBeDisabled();
        releaseSave();
        const notice = page.getByRole('alert').filter({ hasText: 'Synthetic draft save rejected' });
        await expect(notice).toBeVisible();
        await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'error');
        for (const control of [notice.locator('span'), notice.getByRole('button', { name: '다시 저장', exact: true }), notice.getByRole('button', { name: '알림 닫기', exact: true })]) {
          const style = await sample(control);
          expect(contrast(style.color, style.background)).toBeGreaterThanOrEqual(4.5);
        }
        await test.info().attach('editor-ui-readable-save-error', { body: await page.screenshot(), contentType: 'image/png' });
        const retryResponse = page.waitForResponse((response) => draftRoute(new URL(response.url())) && response.request().method() === 'PUT');
        await notice.getByRole('button', { name: '다시 저장', exact: true }).click();
        expect((await retryResponse).status()).toBe(422);
        expect(rejectedSaves).toBe(2);
        await expect(notice).toBeVisible();
        await notice.getByTestId('page-builder-message-dismiss').click();
        await expect(notice).toHaveCount(0);
        await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'error');
      } finally {
        releaseSave();
        await page.unroute(draftRoute, rejectDraft);
      }
      await save(page);
      expect((await resource(api, owned.documentId)).document.tokens?.['design.color_mode']).toBe('dark');
    });
  });
});
