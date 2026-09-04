import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chromium } from 'playwright';

const publicCss = readFileSync(resolve('resources/css/page-builder-public.css'), 'utf8');
const themeCss = readFileSync(resolve('resources/css/page-builder-theme.css'), 'utf8');
const editorCss = [
  'resources/css/page-builder-editor.css',
  'resources/css/page-builder-editor-canvas.css',
  'resources/css/page-builder-editor-blocks.css',
  'resources/css/page-builder-editor-catalog.css',
].map((path) => readFileSync(resolve(path), 'utf8')).join('\n');

describe('responsive content container gutters', () => {
  it.each([['public', publicCss], ['editor', editorCss]])('%s uses the containing box for content gutters', (_, css) => {
    // A 1216px G7 template inside a 2560px viewport must not get 576px gutters.
    expect(css).not.toMatch(/100vw\s*-\s*(?:var\(--g7pb-(?:preview|block|theme)-content-width|72rem)/);
    expect(css).toMatch(/calc\(\(100% - var\(--g7pb-/);
    expect(css).toMatch(/padding-right: max\(1\.25rem, calc\(100% - var\(--g7pb-/);
    expect(css).toMatch(/padding-left: max\(1\.25rem, calc\(100% - var\(--g7pb-/);
  });

  it('uses one 1280px shell token for the editor page, public header, footer, and standard blocks', () => {
    expect(editorCss).toContain('.g7pb-full-site-page--template { width: min(calc(100% - (var(--g7pb-page-gutter) * 2)), var(--g7pb-page-content-max)); margin-inline: auto; }');
    expect(publicCss).toContain('.g7pb-template-body { width: min(calc(100vw - (var(--g7pb-page-gutter) * 2)), var(--g7pb-page-content-max));');
    expect(themeCss).toMatch(/\.g7pb-template-body,\s*\.g7pb-document-theme\s*\{/);
    expect(publicCss).toContain('.g7pb-site-header__inner { display: grid; width: min(calc(100% - (var(--g7pb-page-gutter) * 2)), var(--g7pb-page-content-max));');
    expect(publicCss).toContain('.g7pb-container-width--standard { --g7pb-block-content-width: var(--g7pb-page-content-max); }');
    expect(publicCss).not.toMatch(/container-width--standard\s*\{[^}]*72rem/);
  });

  it('centers the template document on the shared shell instead of inheriting G7 host gutters', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      for (const width of [360, 768, 1280, 1440, 2560]) {
        await page.setViewportSize({ width, height: 1000 });
        const hostGutter = width < 640 ? 16 : 32;
        await page.setContent(`<!doctype html><html lang="ko"><head><style>${themeCss}\n${publicCss}</style></head><body style="margin:0">
          <main style="width:calc(100% - ${hostGutter * 2}px);margin-inline:auto">
            <div class="g7pb-template-body"><div class="g7pb-page g7pb-document-theme"><section class="g7pb-block g7pb-container-width--standard"><div>본문</div></section></div></div>
          </main></body></html>`);
        const geometry = await page.evaluate(() => {
          const body = document.querySelector('.g7pb-template-body')!.getBoundingClientRect();
          const content = document.querySelector('.g7pb-block > div')!.getBoundingClientRect();
          return { body: { left: body.left, width: body.width }, content: { left: content.left, width: content.width }, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        const shellWidth = Math.min(width - 40, 1280);
        expect(geometry.body.width, `viewport=${width}`).toBeCloseTo(shellWidth, 1);
        expect(geometry.body.left, `viewport=${width}`).toBeCloseTo((width - shellWidth) / 2, 1);
        expect(geometry.content.width, `viewport=${width}`).toBeCloseTo(shellWidth - 40, 1);
        expect(geometry.content.left, `viewport=${width}`).toBeCloseTo((width - shellWidth) / 2 + 20, 1);
        expect(geometry.overflow, `viewport=${width}`).toBe(0);
      }
    } finally {
      await browser.close();
    }
  }, 30000);

  it('responds to the actual G7 or nested column width independently of the viewport', () => {
    expect(publicCss).toContain('container: g7pb-content / inline-size;');
    expect(publicCss).toContain('@container g7pb-content (max-width: 900px)');
    expect(publicCss).toContain('.g7pb-hero-split, .g7pb-articles--editorial { grid-template-columns: minmax(0, 1fr); }');
    expect(publicCss).toContain('@container g7pb-content (max-width: 520px)');
    expect(publicCss).toContain('.g7pb-block > * { min-width: 0; }');
    expect(editorCss).toContain('.g7pb-preview-block > * { min-width: 0; }');
  });

  it('keeps hero and article content inside capped hosts from mobile through ultrawide', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const fixture = (hostWidth: number) => `<!doctype html><html lang="ko"><head><style>${publicCss}</style></head><body>
        <main style="width:min(calc(100% - 32px),${hostWidth}px);margin:auto">
          <div class="g7pb-document-theme g7pb-theme-width-wide">
            <section class="g7pb-block g7pb-container-width--inherit g7pb-hero-split g7pb-hero-split--layout-screenshot">
              <div class="g7pb-hero-split__copy"><h1>공개 프로젝트 안내</h1><p>다양한 화면에서 읽을 수 있는 프로젝트 소개입니다.</p></div>
              <figure class="g7pb-hero-split__media"></figure>
            </section>
            <section class="g7pb-block g7pb-container-width--inherit g7pb-articles g7pb-articles--editorial">
              <header class="g7pb-section-heading"><h2>G7 프로젝트</h2></header>
              <div class="g7pb-articles__items"><article><figure></figure><div><h3>G7 Page Builder</h3><p>코어를 수정하지 않고 일반 페이지와 랜딩페이지를 제작합니다.</p></div></article></div>
            </section>
          </div>
        </main></body></html>`;
      for (const hostWidth of [1216, 640]) {
        for (const width of [320, 360, 390, 768, 900, 1024, 1280, 1440, 1920, 2560, 2752, 3440, 3840]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.setContent(fixture(hostWidth));
          const geometry = await page.evaluate(() => {
            const host = document.querySelector('main')!.getBoundingClientRect();
            const sections = [...document.querySelectorAll<HTMLElement>('.g7pb-block')];
            const copy = document.querySelector('article > div')!.getBoundingClientRect();
            return { textWidth: copy.width, overflow: sections.map(section => Math.max(0, section.scrollWidth - section.clientWidth)), outside: sections.map(section => Math.max(0, section.getBoundingClientRect().right - host.right)) };
          });
          const label = `viewport=${width},host=${hostWidth}`;
          expect(geometry.textWidth, label).toBeGreaterThanOrEqual(120);
          expect(geometry.overflow, label).toEqual([0, 0]);
          expect(geometry.outside, label).toEqual([0, 0]);
        }
      }
    } finally {
      await browser.close();
    }
  }, 30000);
});
