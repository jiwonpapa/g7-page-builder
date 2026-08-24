import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, unlink } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demos = resolve(root, 'resources/store/dist/demos');
const previews = resolve(root, 'resources/store/dist/previews');
const output = resolve(root, 'resources/store/source/screenshots');
const publicCss = resolve(root, 'dist/css/page-builder-public.css');
const effectsJs = resolve(root, 'dist/js/page-effects.iife.js');
const slugs = ['company-launch', 'service-conversion', 'local-business', 'event-launch', 'editorial-community'];
const titles = {
  'company-launch': '회사 소개 랜딩',
  'service-conversion': '전문 서비스 상담 랜딩',
  'local-business': '로컬 비즈니스 방문 안내',
  'event-launch': '컨퍼런스·행사 랜딩',
  'editorial-community': '에디토리얼·커뮤니티 홈',
};
const viewports = [
  { name: 'desktop', width: 1425, height: 1000 },
  { name: 'tablet', width: 805, height: 1000 },
  { name: 'mobile', width: 375, height: 812 },
];

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
try {
  for (const slug of slugs) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      await page.goto(`http://127.0.0.1:${address.port}/store/demos/${slug}`, { waitUntil: 'networkidle' });
      await page.locator('img').evaluateAll(async (images) => {
        for (const image of images) {
          image.loading = 'eager';
          if (!image.complete) await new Promise((resolveImage) => image.addEventListener('load', resolveImage, { once: true }));
          await image.decode().catch(() => undefined);
        }
      });
      const png = resolve(output, `${slug}-${viewport.name}.png`);
      const webp = resolve(output, `${slug}-${viewport.name}.webp`);
      await page.screenshot({ path: png, fullPage: true, animations: 'disabled' });
      execFileSync('cwebp', ['-quiet', '-q', '78', png, '-o', webp]);
      await unlink(png);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}

console.log(`Generated ${slugs.length * viewports.length} Page Kit screenshots.`);
