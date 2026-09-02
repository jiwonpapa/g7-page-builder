import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, posix } from 'node:path';

export const RULE_FILE = 'config/design-architecture.json';
const REQUIRED_RULES = ['TS-BOUNDARY', 'TS-UNSAFE', 'G7-INTERNAL', 'PHP-BOUNDARY', 'SOURCE-SIZE', 'CSS-COLOR', 'CSS-IMPORTANT', 'CSS-SPECIFICITY'];
const REQUIRED_NORMATIVE_FILES = [
  'AGENTS.md', 'docs/architecture.md', 'docs/development-constitution.md',
  'docs/productization/editing-policy.md', 'docs/productization/requirements.md',
  'docs/quality-harness.md', 'docs/worktree-coordination.md',
];
export const IMPLEMENTATION_FILES = [
  'scripts/check-design-architecture.mjs',
  ...['Policy', 'TypeScript', 'Php', 'Css'].map((name) => `scripts/lib/designArchitecture${name}.mjs`),
];

export function safePath(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || /[\\*?\[\]\0]/.test(path)
    || path !== posix.normalize(path) || path.startsWith('../') || path === '..') {
    throw new Error(`An exact repository-relative path is required: ${path}`);
  }
  return path;
}

export function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function finding(rule, path, line, detail, identity = detail, value = 1) {
  return { rule, path, line, detail, fingerprint: fingerprint(identity), value };
}

export function listSources(root, policy) {
  const result = [];
  const walk = (path) => {
    if (!existsSync(join(root, path))) return;
    for (const item of readdirSync(join(root, path), { withFileTypes: true })) {
      const next = `${path}/${item.name}`;
      if (item.isSymbolicLink()) throw new Error(`Product source symlinks require an explicit ownership decision: ${next}`);
      if (item.isDirectory()) walk(next);
      else if (item.isFile() && /\.(?:tsx?|js|php|css)$/.test(next)) result.push(next);
    }
  };
  policy.sourceRoots.forEach(walk);
  return result.sort();
}

export function readPolicy(root) {
  const policy = JSON.parse(readFileSync(join(root, RULE_FILE), 'utf8'));
  if (policy.version !== 1 || !Array.isArray(policy.rules)
    || policy.rules.length !== REQUIRED_RULES.length || REQUIRED_RULES.some((rule) => !policy.rules.includes(rule))) throw new Error('Unsupported or disabled design architecture rules');
  if (!Array.isArray(policy.normativeFiles) || policy.normativeFiles.length !== REQUIRED_NORMATIVE_FILES.length
    || REQUIRED_NORMATIVE_FILES.some((path) => !policy.normativeFiles.includes(path))) throw new Error('Required normative documents cannot be omitted or duplicated');
  if (policy.constitution !== 'docs/development-constitution.md') throw new Error('The development constitution cannot be redirected');
  if (['resources/js', 'resources/css', 'src'].some((path) => !policy.sourceRoots.includes(path))) throw new Error('Product source roots cannot be silently excluded');
  if (['resources/js/documents/', 'resources/js/api/', 'resources/js/public/'].some((path) => !policy.typescriptLayers.some((layer) => layer.from === path))) throw new Error('A protected TypeScript layer is missing');
  for (const path of [policy.constitution, policy.debtFile, ...policy.normativeFiles, ...policy.sourceRoots, ...policy.cssTokenSources]) safePath(path);
  if (['ts', 'tsx', 'js', 'php', 'css'].some((kind) => !Object.hasOwn(policy.sourceSize, kind))) throw new Error('A source size rule is missing');
  if (!Number.isInteger(policy.maxTypeScriptNodes) || policy.maxTypeScriptNodes < 1 || policy.maxTypeScriptNodes > 15000) throw new Error('Invalid TypeScript structural node limit');
  for (const [kind, limit] of Object.entries(policy.sourceSize)) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1500) throw new Error(`Invalid source size policy: ${kind}`);
  }
  const constitution = readFileSync(join(root, policy.constitution), 'utf8');
  for (const rule of policy.rules) {
    if (!constitution.includes(`\`${rule}\``)) throw new Error(`Undocumented architecture rule: ${rule}`);
  }
  return policy;
}

export function applyDebt(findings, debt, policy) {
  if (debt.version !== 1 || !/^[0-9a-f]{40}$/.test(debt.reviewedBase) || !Array.isArray(debt.entries)) throw new Error('Invalid architecture debt ledger');
  const allowances = new Map();
  const aliases = new Map();
  const used = new Set();
  for (const entry of debt.entries) {
    safePath(entry.path);
    if (!policy.rules.includes(entry.rule) || typeof entry.reason !== 'string' || entry.reason.trim().length < 12
      || typeof entry.resolveWhen !== 'string' || entry.resolveWhen.trim().length < 12
      || !entry.fingerprints || Object.keys(entry.fingerprints).length === 0) throw new Error(`Unbounded or unexplained debt: ${entry.path}`);
    for (const [hash, maximum] of Object.entries(entry.fingerprints)) {
      const key = `${entry.rule}:${entry.path}:${hash}`;
      if (!/^[0-9a-f]{64}$/.test(hash) || !Number.isInteger(maximum) || maximum < 1 || allowances.has(key)) throw new Error(`Invalid or duplicate debt member: ${key}`);
      allowances.set(key, maximum);
    }
    for (const relocation of entry.relocations ?? []) {
      safePath(relocation.path);
      const key = `${entry.rule}:${relocation.path}:${relocation.fingerprint}`;
      if (relocation.path === entry.path || !Object.hasOwn(entry.fingerprints, relocation.fingerprint)
        || typeof relocation.reason !== 'string' || relocation.reason.trim().length < 12 || aliases.has(key)) throw new Error(`Invalid debt relocation: ${key}`);
      aliases.set(key, `${entry.rule}:${entry.path}:${relocation.fingerprint}`);
    }
  }
  for (const key of aliases.keys()) if (allowances.has(key)) throw new Error(`Relocation cannot also have an independent allowance: ${key}`);
  const totals = new Map();
  const errors = [];
  const acknowledged = [];
  for (const item of findings) {
    const sourceKey = `${item.rule}:${item.path}:${item.fingerprint}`;
    const key = aliases.get(sourceKey) ?? sourceKey;
    const total = (totals.get(key) ?? 0) + item.value;
    totals.set(key, total);
    if (allowances.has(key) && total <= allowances.get(key)) {
      used.add(key);
      acknowledged.push(item);
    } else errors.push(item);
  }
  // A removed violation is reported for ledger retirement, never used as credit for another violation.
  return { errors, acknowledged, unusedDebt: [...allowances.keys()].filter((key) => !used.has(key)) };
}

export function validateNormativeDocuments(root, selected, policy) {
  for (const path of selected) {
    const source = readFileSync(join(root, path), 'utf8');
    if (path === policy.constitution) {
      for (const rule of policy.rules) if (!source.includes(`\`${rule}\``)) throw new Error(`Subject constitution omits ${rule}: ${path}`);
    } else if (!source.includes('development-constitution.md')) {
      throw new Error(`Normative document must reference the development constitution: ${path}`);
    }
  }
}

export function sizeFinding(path, source, policy) {
  const extension = path.split('.').at(-1);
  const limit = policy.sourceSize[extension];
  const lines = source.split(/\r?\n/).filter((line) => line.trim()).length;
  return limit && lines > limit ? [finding('SOURCE-SIZE', path, 1,
    `${lines} non-empty lines exceeds ${limit}; split responsibilities or retire existing debt`, 'non-empty-lines', lines)] : [];
}
