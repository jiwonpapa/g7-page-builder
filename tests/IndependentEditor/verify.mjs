import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const mode = process.argv[2];
if (!['unit', 'browser'].includes(mode)) throw new Error('Expected unit or browser');
if (!process.version.startsWith('v24.')) throw new Error('Use Node 24');
function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit', env: { ...process.env, ...extra }, timeout: 240_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
// This package is deliberately isolated. Never install into the product root.
const digest = createHash('sha256').update(readFileSync(join(directory, 'package-lock.json'))).digest('hex');
const marker = join(directory, 'node_modules/.ip1-lock');
if (!existsSync(marker) || readFileSync(marker, 'utf8') !== digest) {
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  writeFileSync(marker, digest);
}
const bin = name => join(directory, 'node_modules', ...name);
if (mode === 'unit') {
  const ts = await import('typescript');
  const allowed = new Set(['react', 'react-dom', 'react-dom/client', '@puckeditor/core', '@puckeditor/core/puck.css', 'react-moveable', 'react-selecto']);
  for (const name of ['model.ts', 'main.tsx', 'Interactions.tsx']) {
    const source = readFileSync(join(directory, name), 'utf8');
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, name.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = node => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) throw new Error('IP1 explicit any: ' + name);
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const spec = node.moduleSpecifier.text;
        if (!allowed.has(spec) && !['./main', './Interactions', './model', './probe.css'].includes(spec))
          throw new Error('IP1 non-isolated import: ' + spec);
        if (name === 'model.ts') throw new Error('Geometry model must be vendor/DOM independent');
      }
      if (ts.isIdentifier(node) && ['fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'G7Core'].includes(node.text))
        throw new Error('IP1 I/O/host boundary: ' + node.text);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  const lock = JSON.parse(readFileSync(join(directory, 'package-lock.json'), 'utf8'));
  for (const [name, item] of Object.entries(lock.packages)) {
    if (/node_modules\/@tiptap\/[^/]+$/.test(name) && item.version !== '3.30.2')
      throw new Error('Mixed Tiptap versions: ' + name);
  }
  console.log('IP1 architecture: 3 source files, no host/I/O/vendor-model imports or explicit any; Tiptap pinned.');
  run(process.execPath, [bin(['typescript', 'bin', 'tsc']), '--noEmit']);
  run(process.execPath, [bin(['vitest', 'vitest.mjs']), 'run', 'model.test.ts']);
} else {
  run(process.execPath, [bin(['vite', 'bin', 'vite.js']), 'build']);
  const assets = readdirSync(join(directory, 'dist/assets')).filter(name => /\.(js|css)$/.test(name))
    .map(name => { const bytes = readFileSync(join(directory, 'dist/assets', name)); return { name, bytes: bytes.length, gzip: gzipSync(bytes).length }; });
  const totalGzip = assets.reduce((sum, asset) => sum + asset.gzip, 0);
  if (totalGzip > 900 * 1024) throw new Error(`IP1 900 KiB gzip budget exceeded: ${totalGzip}`);
  const { preview } = await import('vite');
  const server = await preview({ root: directory, preview: { host: '127.0.0.1', port: 0 } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing loopback server address');
  const output = join(root, 'output/playwright/ip1', new Date().toISOString().replaceAll(':', '-'));
  mkdirSync(output, { recursive: true });
  const report = join(output, 'results.json');
  console.log(JSON.stringify({ node: process.version, assets, totalGzip, output }));
  writeFileSync(join(output, 'bundle.json'), JSON.stringify({ assets, totalGzip, budget: 900 * 1024 }, null, 2));
  try {
    // Async child: the preview server must keep servicing browser requests.
    const { spawn } = await import('node:child_process');
    await new Promise((accept, reject) => {
      const child = spawn(process.execPath, [bin(['@playwright', 'test', 'cli.js']), 'test', '--config', 'playwright.config.ts'], {
        cwd: directory, stdio: 'inherit', env: { ...process.env,
          G7PB_PROBE_URL: `http://127.0.0.1:${address.port}`, G7PB_PROBE_REPORT: report, G7PB_PROBE_OUTPUT: join(output, 'results') },
      });
      const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('IP1 browser timeout')); }, 240_000);
      child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('exit', code => { clearTimeout(timeout); code === 0 ? accept() : reject(new Error(`Browser failed (${code})`)); });
    });
    const results = JSON.parse(readFileSync(report, 'utf8'));
    if (results.stats.expected !== 9 || results.stats.unexpected || results.stats.skipped || results.stats.flaky)
      throw new Error('Empty, skipped, failed or flaky proof is not acceptance');
  } finally { await new Promise(accept => server.httpServer.close(accept)); }
}
