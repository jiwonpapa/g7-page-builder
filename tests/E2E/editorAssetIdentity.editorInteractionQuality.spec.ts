import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { authenticateEditorInteractionAdmin } from './support/editorInteractionFixture';
import { INTER_DIST, interFontAssets } from '../../vite.inter-fonts.js';

test('editor serves pinned Inter faces locally without external font requests', async ({ context, page }, info) => {
  await authenticateEditorInteractionAdmin(context);
  const external: string[] = [];
  await context.route('https://rsms.me/**', route => { external.push(route.request().url()); return route.abort('blockedbyclient'); });
  const responses: Promise<{ url: string; status: number; bytes: Buffer }>[] = [];
  page.on('response', response => {
    if (response.url().includes('/' + INTER_DIST + '/') && new URL(response.url()).pathname.endsWith('.woff2')) {
      responses.push(response.body().then(bytes => ({ url: response.url(), status: response.status(), bytes })));
    }
  });
  await page.goto('/modules/jiwonpapa-page_builder/admin/editor');
  const origin = new URL(page.url()).origin;
  const faces = await page.evaluate(async () => {
    const loaded = [];
    for (const style of ['normal', 'italic']) for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      const fonts = await document.fonts.load(`${style} ${weight} 24px Inter`, 'Inter 4.1 glyph proof 12345');
      loaded.push({ style, weight, count: fonts.length, loaded: fonts.every(font => font.status === 'loaded') });
    }
    await document.fonts.ready;
    return loaded;
  });
  expect(faces).toHaveLength(18);
  expect(faces.every(face => face.count > 0 && face.loaded)).toBe(true);
  expect(external).toEqual([]);
  const originals = interFontAssets(process.cwd());
  const received = await Promise.all(responses);
  expect(new Set(received.map(entry => new URL(entry.url).pathname)).size).toBe(18);
  for (const entry of received) {
    const url = new URL(entry.url), name = url.pathname.split('/').at(-1)!;
    expect(url.origin).toBe(origin);
    expect(entry.status).toBe(200);
    expect(entry.bytes.equals(originals.get(name)!)).toBe(true);
  }
  await info.attach('local-inter-font-proof', { contentType: 'application/json', body: JSON.stringify({
    faces, external, files: received.map(entry => ({ path: new URL(entry.url).pathname, bytes: entry.bytes.length, sha256: createHash('sha256').update(entry.bytes).digest('hex') })),
  }) });
  await info.attach('local-inter-editor', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('rendered editor asset hashes bypass old immutable browser assets', async ({ context, page }) => {
  await authenticateEditorInteractionAdmin(context);
  await page.goto('/modules/jiwonpapa-page_builder/admin/editor');
  const assets: { path: string; current: string; body: Buffer; mime: string }[] = [];
  for (const [file, selector, attribute, mime] of [
    ['css/page-builder-editor.css', 'link[rel="stylesheet"]', 'href', 'text/css'],
    ['js/page-builder-editor.iife.js', 'script[defer]', 'src', 'application/javascript'],
  ]) {
    const body = readFileSync(`dist/${file}`);
    const digest = createHash('sha256').update(body).digest('hex');
    const locator = page.locator(selector);
    const urls = await locator.evaluateAll((nodes, attr) => nodes.map((node) => node.getAttribute(attr)), attribute);
    const href = urls.find((url) => url?.includes(`/dist/${file}`));
    if (!href) throw new Error(`Editor did not render ${file}.`);
    const url = new URL(href, page.url());
    expect(url.searchParams.get('v')).toBe(digest);
    assets.push({ path: url.pathname, current: url.pathname + url.search, body, mime });
  }

  // Local G7 uses no-cache. This isolated HTTP fixture reproduces production's
  // immutable cache policy using the exact URLs rendered by the real editor.
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    if (url === '/warmup' || url === '/current') {
      const paths = assets.map((asset) => url === '/warmup' ? asset.path : asset.current);
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      response.end(`<html><head><link rel="stylesheet" href="${paths[0]}"><script defer src="${paths[1]}"></script></head><body>Asset cache fixture</body></html>`);
      return;
    }
    const asset = assets.find((candidate) => url === candidate.path || url === candidate.current);
    if (!asset) { response.writeHead(404); response.end(); return; }
    requests.push(url);
    response.writeHead(200, { 'Content-Type': asset.mime, 'Cache-Control': 'public,max-age=31536000,immutable' });
    response.end(url === asset.current ? asset.body : asset.mime === 'text/css'
      ? 'html{--g7pb-legacy:true}' : 'window.__g7pbLegacyAsset=true;');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cache fixture did not listen.');
  const cachePage = await context.newPage();
  try {
    const origin = `http://127.0.0.1:${address.port}`;
    await cachePage.goto(`${origin}/warmup`, { waitUntil: 'load' });
    expect(await cachePage.evaluate(() => Reflect.get(window, '__g7pbLegacyAsset'))).toBe(true);
    await cachePage.goto(`${origin}/current`, { waitUntil: 'load' });
    expect(await cachePage.evaluate(() => Reflect.get(window, '__g7pbLegacyAsset'))).toBeUndefined();
    for (const asset of assets) {
      expect(requests).toContain(asset.path);
      expect(requests).toContain(asset.current);
    }
    await cachePage.reload({ waitUntil: 'load' });
    expect(await cachePage.evaluate(() => Reflect.get(window, '__g7pbLegacyAsset'))).toBeUndefined();
    const loaded = await cachePage.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
    for (const asset of assets) expect(loaded).toContain(origin + asset.current);
  } finally {
    await cachePage.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
