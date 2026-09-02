import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import postcss from 'postcss';

/** Read local CSS imports for static contract inspection, never render/browser proof. */
export async function readCssGraph(root, entries) {
  const boundary = await realpath(root);
  const files = new Map();
  async function visit(input, ancestors) {
    const path = await realpath(input).catch(() => { throw new Error(`Missing CSS import: ${relative(boundary, input)}`); });
    const name = relative(boundary, path);
    if (isAbsolute(name) || name === '..' || name.startsWith('../')) throw new Error(`CSS import escapes root: ${name}`);
    if (ancestors.includes(path)) throw new Error(`Circular CSS import: ${[...ancestors, path].map(item => relative(boundary, item)).join(' -> ')}`);
    if (!files.has(name)) files.set(name, await readFile(path, 'utf8'));
    const ast = postcss.parse(files.get(name), { from: path });
    const imports = [];
    ast.walkAtRules('import', rule => imports.push(rule));
    for (const rule of imports) {
      const match = rule.params.match(/^(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')\s*$/i);
      const target = match?.slice(1).find(value => value !== undefined);
      if (!target || /^(?:[a-z][a-z\d+.-]*:|\/)|[?#\\]/i.test(target)) {
        throw new Error(`Unsupported CSS import in ${name}: ${rule.params}`);
      }
      const nested = await visit(resolve(dirname(path), target), [...ancestors, path]);
      rule.replaceWith(postcss.parse(nested).nodes);
    }
    return ast.toString();
  }
  const expanded = [];
  for (const entry of entries) expanded.push(await visit(resolve(boundary, entry), []));
  return { css: expanded.join('\n'), files: [...files.keys()].sort() };
}

/** Inspect an exact selector's declarations independently of file/source order. */
export function cssPropertyValues(css, selector, property) {
  const normalize = value => value.trim().replaceAll('"', "'").replace(/\s+/g, ' ');
  const expected = normalize(selector);
  const values = [];
  postcss.parse(css).walkRules(rule => {
    if (!rule.selectors.some(item => normalize(item) === expected)) return;
    rule.each(node => {
      if (node.type === 'decl' && node.prop === property) values.push(node.value.trim());
    });
  });
  return values;
}
