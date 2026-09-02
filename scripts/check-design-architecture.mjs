import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDebt, IMPLEMENTATION_FILES, listSources, readPolicy, RULE_FILE, safePath, sizeFinding, validateNormativeDocuments } from './lib/designArchitecturePolicy.mjs';
import { inspectTypeScript } from './lib/designArchitectureTypeScript.mjs';
import { inspectPhp } from './lib/designArchitecturePhp.mjs';
import { inspectCss } from './lib/designArchitectureCss.mjs';

export function auditArchitecture(root, requested = [], policyRoot = root) {
  const policy = readPolicy(policyRoot);
  const paths = requested.map(safePath);
  const normativeChecked = paths.filter((path) => policy.normativeFiles.includes(path));
  validateNormativeDocuments(root, normativeChecked, policy);
  const debt = JSON.parse(readFileSync(join(policyRoot, policy.debtFile), 'utf8'));
  const globalInputs = [RULE_FILE, policy.debtFile, ...policy.normativeFiles, ...IMPLEMENTATION_FILES];
  const full = !paths.length || paths.some((path) => globalInputs.includes(path));
  const all = listSources(root, policy);
  const related = new Set(paths);
  for (const entry of debt.entries) {
    const endpoints = [entry.path, ...(entry.relocations ?? []).map((relocation) => relocation.path)];
    if (endpoints.some((path) => related.has(path))) endpoints.forEach((path) => related.add(path));
  }
  const selected = full ? all : all.filter((path) => related.has(path));
  const findings = [];
  const php = {};
  for (const path of selected) {
    const source = readFileSync(join(root, path), 'utf8');
    findings.push(...sizeFinding(path, source, policy));
    if (/\.(?:tsx?|js)$/.test(path)) findings.push(...inspectTypeScript(root, path, source, policy));
    if (path.endsWith('.css')) findings.push(...inspectCss(path, source, policy));
    if (path.endsWith('.php')) php[path] = source;
  }
  findings.push(...inspectPhp(php, policy));
  for (const path of paths) {
    if (!existsSync(join(root, path))) continue; // Deleted sources have no new violations.
    if (/\.(?:tsx?|js|php|css)$/.test(path) && policy.sourceRoots.some((prefix) => path.startsWith(`${prefix}/`))
      && !selected.includes(path)) throw new Error(`Source was not analyzed: ${path}`);
  }
  const result = applyDebt(findings, debt, policy);
  return { scope: full ? 'all-product-sources' : 'changed-product-sources', checked: selected, normativeChecked, findings,
    ...result, unusedDebt: full ? result.unusedDebt : result.unusedDebt.filter((key) => selected.some((path) => key.includes(`:${path}:`))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const paths = [];
    let json = false;
    const controllerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    let root = controllerRoot;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--json') json = true;
      else if (args[index] === '--files' && args[index + 1]) paths.push(...args[++index].split(',').filter(Boolean));
      else if (args[index] === '--root' && args[index + 1]) root = resolve(args[++index]);
      else throw new Error(`Unknown or incomplete option: ${args[index]}`);
    }
    const report = auditArchitecture(root, paths, controllerRoot);
    if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      for (const error of report.errors) console.error(`${error.path}:${error.line} [${error.rule}] ${error.detail}`);
      console.log(`Design architecture: ${report.errors.length ? 'FAIL' : 'OK'}; ${report.checked.length} files; ${report.acknowledged.length} existing debt findings; ${report.unusedDebt.length} retired debt candidates.`);
    }
    process.exitCode = report.errors.length ? 1 : 0;
  } catch (error) {
    console.error(`Design architecture: ${error.message}`);
    process.exitCode = 1;
  }
}
