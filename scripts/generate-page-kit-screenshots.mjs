import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demos = resolve(root, 'resources/store/dist/demos');
const previews = resolve(root, 'resources/store/dist/previews');
const output = resolve(root, process.env.G7PB_SCREENSHOT_OUTPUT ?? 'resources/store/source/screenshots');
const publicCss = resolve(root, 'dist/css/page-builder-public.css');
const effectsJs = resolve(root, 'dist/js/page-effects.iife.js');
const slidersJs = resolve(root, 'dist/js/page-sliders.iife.js');
const evidenceOutput = resolve(
  root,
  process.env.G7PB_PAGE_KIT_REPORT ?? 'output/playwright/page-kit-layout-report.json',
);
const externalBaseUrl = process.env.G7PB_BASE_URL?.replace(/\/$/, '');
const pageKitManifest = JSON.parse(await readFile(resolve(root, 'resources/store/source/page-kits/manifest.json'), 'utf8'));
if (pageKitManifest.manifest_version !== 'g7pb-page-kits/v1'
  || !Array.isArray(pageKitManifest.kits) || pageKitManifest.kits.length === 0) {
  throw new Error('Official Page Kit manifest is invalid.');
}
const slugs = pageKitManifest.kits.map((kit) => kit.slug);
const titles = Object.fromEntries(pageKitManifest.kits.map((kit) => [kit.slug, kit.title.ko]));
const viewports = [
  { name: 'desktop', width: 1425, height: 1000 },
  { name: 'tablet', width: 805, height: 1000 },
  { name: 'mobile', width: 375, height: 812 },
];
const requestedSlug = process.env.G7PB_PAGE_KIT_SLUG;
const requestedViewport = process.env.G7PB_PAGE_KIT_VIEWPORT;
const selectedSlugs = requestedSlug ? slugs.filter((slug) => slug === requestedSlug) : slugs;
const selectedViewports = requestedViewport
  ? viewports.filter((viewport) => viewport.name === requestedViewport)
  : viewports;
if (selectedSlugs.length === 0 || selectedViewports.length === 0) {
  throw new Error('Requested Page Kit slug or viewport is not supported.');
}

const typeFor = (path) => ({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
}[extname(path)] ?? 'application/octet-stream');

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    let path;
    if (pathname === '/assets/page-builder-public.css') path = publicCss;
    else if (pathname === '/assets/page-effects.iife.js') path = effectsJs;
    else if (pathname === '/assets/page-sliders.iife.js') path = slidersJs;
    else if (pathname.startsWith('/modules/jiwonpapa-page_builder/store/previews/')) {
      path = resolve(previews, pathname.split('/').at(-1) ?? '');
    } else if (/^\/store\/demos\/[a-z0-9-]+$/.test(pathname)) {
      const slug = pathname.split('/').at(-1);
      const fragment = await readFile(resolve(demos, `${slug}.html`), 'utf8');
      const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/page-builder-public.css"><style>:root{color-scheme:light;font-family:Inter,Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;color:#172033;background:#fff}.g7pb-store-demo-bar{position:relative;z-index:20;display:flex;min-height:3rem;align-items:center;justify-content:center;padding:.65rem 1rem;color:#fff;background:#172033;font-size:.78rem;font-weight:750;text-align:center}.g7pb-store-demo-bar strong{margin-right:.45rem;color:#9ab2ff}.g7pb-motion-active [data-g7pb-motion],.g7pb-motion-active [data-g7pb-motion] [data-g7pb-motion-item]{opacity:1!important;transform:none!important}</style></head><body><header class="g7pb-store-demo-bar"><span><strong>Page Kit 실제 화면</strong>${titles[slug]} · 샘플 링크와 폼은 데모에서 작동하지 않습니다.</span></header><main class="g7pb-page">${fragment}</main><script src="/assets/page-effects.iife.js" defer></script></body></html>`;
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    } else {
      response.writeHead(404).end();
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': typeFor(path), 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'capture server error');
  }
});

await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Page Kit capture server did not start.');

const browser = await chromium.launch({ headless: true });
const report = [];
try {
  await mkdir(output, { recursive: true });
  for (const slug of selectedSlugs) {
    for (const viewport of selectedViewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        ignoreHTTPSErrors: true,
      });
      const runtimeErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
      page.on('requestfailed', (request) => runtimeErrors.push(
        `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`,
      ));
      const pageUrl = externalBaseUrl
        ? `${externalBaseUrl}/modules/jiwonpapa-page_builder/store/demos/${slug}`
        : `http://127.0.0.1:${address.port}/store/demos/${slug}`;
      await page.goto(pageUrl, { waitUntil: 'networkidle' });
      await page.locator('img').evaluateAll(async (images) => {
        for (const image of images) {
          image.loading = 'eager';
          if (!image.complete) await new Promise((resolveImage) => image.addEventListener('load', resolveImage, { once: true }));
          await image.decode().catch(() => undefined);
        }
      });
      const motionBlocks = page.locator('.g7pb-block[data-g7pb-motion]');
      for (let index = 0; index < await motionBlocks.count(); index += 1) {
        const block = motionBlocks.nth(index);
        await block.scrollIntoViewIfNeeded();
        const handle = await block.elementHandle();
        if (!handle) throw new Error('Motion block disappeared during Page Kit audit.');
        await page.waitForFunction((element) => {
          const pageRoot = element.closest('.g7pb-page');
          return !pageRoot?.classList.contains('g7pb-motion-active')
            || pageRoot.dataset.g7pbMotionReduced === 'true'
            || element.classList.contains('is-inview');
        }, handle);
        await block.evaluate(async (element) => {
          const animations = element.getAnimations({ subtree: true })
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
          await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
        });
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const layout = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="page-builder-store-demo-root"], main.g7pb-page');
        if (!(root instanceof HTMLElement)) throw new Error('Page Kit root is missing.');
        const blocks = [...root.querySelectorAll('[data-testid="page-builder-rendered-block"]')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              type: element.getAttribute('data-block-type') ?? 'unknown',
              top: rect.top + window.scrollY,
              bottom: rect.bottom + window.scrollY,
              width: rect.width,
              height: rect.height,
            };
          });
        const headings = [...root.querySelectorAll('h1, h2')].map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent?.trim().slice(0, 80) ?? '',
            width: rect.width,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            writingMode: getComputedStyle(element).writingMode,
          };
        });
        const images = [...root.querySelectorAll('img')].map((element) => ({
          src: element.currentSrc || element.src,
          complete: element.complete,
          naturalWidth: element.naturalWidth,
          naturalHeight: element.naturalHeight,
        }));
        const overflowingElements = [...root.querySelectorAll('*')].flatMap((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1) return [];
          if (element.closest('.g7pb-motion-parallax-target, .g7pb-inquiry-form__honeypot, [data-g7pb-slider]')) return [];
          return [{
            selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${[...element.classList].slice(0, 3).map((name) => `.${name}`).join('')}`,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            overflowX: getComputedStyle(element).overflowX,
          }];
        });
        const overlaps = blocks.slice(1).flatMap((block, index) => {
          const previous = blocks[index];
          return block.top < previous.bottom - 1
            ? [`${previous.type} -> ${block.type}: ${Math.round(previous.bottom - block.top)}px`]
            : [];
        });
        const motionReduced = root.dataset.g7pbMotionReduced === 'true';
        const hiddenMotion = !root.classList.contains('g7pb-motion-active') || motionReduced
          ? []
          : [...root.querySelectorAll('.g7pb-block[data-g7pb-motion]')].flatMap((block) => {
            if (block.dataset.g7pbMotionTrigger === 'repeat') return [];
            const targets = block.dataset.g7pbMotion === 'stagger'
              ? [...block.querySelectorAll('[data-g7pb-motion-item]')]
              : [block];
            return targets.some((target) => Number.parseFloat(getComputedStyle(target).opacity) < 0.99)
              ? [block.getAttribute('data-block-type') ?? 'unknown']
              : [];
          });
        return {
          blockCount: blocks.length,
          imageCount: images.length,
          viewportWidth: document.documentElement.clientWidth,
          rootScrollWidth: root.scrollWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          invalidBlocks: blocks.filter((block) => !Number.isFinite(block.width) || block.width < 1 || block.height < 1),
          overlaps,
          brokenImages: images.filter((image) => !image.complete || image.naturalWidth < 1 || image.naturalHeight < 1),
          hiddenMotion,
          overflowingElements,
          collapsedHeadings: headings.filter((heading) =>
            heading.writingMode !== 'horizontal-tb'
            || heading.width < Math.min(120, document.documentElement.clientWidth * 0.3)
            || heading.scrollWidth > heading.clientWidth + 1),
        };
      });
      const failures = [
        ...runtimeErrors,
        ...(layout.blockCount < 4 ? [`only ${layout.blockCount} rendered blocks`] : []),
        ...(layout.documentScrollWidth > layout.viewportWidth + 1
          ? [`document horizontal overflow: ${layout.documentScrollWidth}px > ${layout.viewportWidth}px`] : []),
        ...layout.overflowingElements.map((element) =>
          `unclipped horizontal overflow: ${element.selector} (${element.left}px..${element.right}px)`),
        ...layout.invalidBlocks.map((block) => `invalid block geometry: ${block.type}`),
        ...layout.overlaps.map((overlap) => `block overlap: ${overlap}`),
        ...layout.brokenImages.map((image) => `broken image: ${image.src}`),
        ...layout.hiddenMotion.map((type) => `motion content remained hidden: ${type}`),
        ...layout.collapsedHeadings.map((heading) => `collapsed heading: ${heading.text} (${Math.round(heading.width)}px)`),
      ];
      const png = resolve(output, `${slug}-${viewport.name}.png`);
      const webp = resolve(output, `${slug}-${viewport.name}.webp`);
      await page.screenshot({ path: png, fullPage: true, animations: 'disabled' });
      report.push({ slug, viewport, layout, runtimeErrors, screenshot: webp, passed: failures.length === 0, failures });
      if (failures.length > 0) {
        throw new Error(`${slug}/${viewport.name} layout audit failed:\n- ${failures.join('\n- ')}`);
      }
      execFileSync('cwebp', ['-quiet', '-q', '78', png, '-o', webp]);
      await unlink(png);
      await page.close();
    }
  }
} finally {
  await mkdir(dirname(evidenceOutput), { recursive: true });
  await writeFile(evidenceOutput, `${JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2)}\n`, 'utf8');
  await browser.close();
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}

console.log(`Generated ${selectedSlugs.length * selectedViewports.length} Page Kit screenshots.`);
