import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'resources/store/source/page-kits/event-launch/media');
await mkdir(output, { recursive: true });

const marks = [
  { file: 'partner-northstar.png', name: 'NORTHSTAR', symbol: '✦', color: '#2563eb' },
  { file: 'partner-orbit.png', name: 'ORBIT', symbol: '◯', color: '#7c3aed' },
  { file: 'partner-morrow.png', name: 'MORROW', symbol: 'M', color: '#0891b2' },
  { file: 'partner-vertex.png', name: 'VERTEX', symbol: '△', color: '#db2777' },
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 240 }, deviceScaleFactor: 2 });
  for (const mark of marks) {
    await page.setContent(`<!doctype html><html><style>
      *{box-sizing:border-box}html,body{margin:0;background:transparent}
      .mark{width:800px;height:240px;display:flex;align-items:center;justify-content:center;gap:34px;
        color:#172033;font:800 68px/1 Inter,Arial,sans-serif;letter-spacing:.16em;white-space:nowrap}
      .symbol{width:104px;height:104px;display:grid;place-items:center;border:7px solid ${mark.color};
        border-radius:30px;color:${mark.color};font:800 62px/1 Inter,Arial,sans-serif;letter-spacing:0}
    </style><div class="mark"><span class="symbol">${mark.symbol}</span><span>${mark.name}</span></div></html>`);
    await page.locator('.mark').screenshot({ path: resolve(output, mark.file), omitBackground: true });
  }
} finally {
  await browser.close();
}

console.log(`Generated ${marks.length} Page Kit partner marks.`);
