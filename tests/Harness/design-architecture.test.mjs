import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { auditArchitecture } from '../../scripts/check-design-architecture.mjs';
import { applyDebt, finding, readPolicy, safePath, sizeFinding } from '../../scripts/lib/designArchitecturePolicy.mjs';
import { inspectTypeScript } from '../../scripts/lib/designArchitectureTypeScript.mjs';
import { inspectPhp } from '../../scripts/lib/designArchitecturePhp.mjs';
import { inspectCss } from '../../scripts/lib/designArchitectureCss.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const policy = JSON.parse(readFileSync(join(repository, 'config/design-architecture.json'), 'utf8'));
const baseDebt = () => ({ version: 1, reviewedBase: 'a'.repeat(40), entries: [] });
function debtFor(item, maximum = 1) {
  return { ...baseDebt(), entries: [{ path: item.path, rule: item.rule,
    reason: 'Reviewed legacy adapter compatibility; no new use is permitted.',
    resolveWhen: 'Replace this exact bridge with validated typed construction.',
    fingerprints: { [item.fingerprint]: maximum } }] };
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'g7pb-design-architecture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, source) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };
  write('config/design-architecture.json', JSON.stringify(policy));
  write(policy.debtFile, JSON.stringify(baseDebt()));
  write(policy.constitution, policy.rules.map((rule) => `\`${rule}\``).join('\n'));
  return { root, write };
}

test('AST protects domain imports including re-export, import equals and dynamic import', () => {
  for (const source of [
    "import { client } from '../api/pageBuilderApi';", "export { client } from '../api/pageBuilderApi';",
    "import api = require('../api/pageBuilderApi');", "const api = import('../api/pageBuilderApi');",
    "const api = require('../api/pageBuilderApi');", "const api = import(name);",
    "type Client = import('../api/pageBuilderApi').Client;",
  ]) assert.ok(inspectTypeScript(repository, 'resources/js/documents/new.ts', source, policy).some((item) => item.rule === 'TS-BOUNDARY'));
});

test('domain permits its own contract, but not UI packages or private G7 access', () => {
  assert.deepEqual(inspectTypeScript(repository, 'resources/js/documents/new.ts', "import type { PageBuilderDocument } from './types';", policy), []);
  assert.ok(inspectTypeScript(repository, 'resources/js/documents/new.ts', "import React from 'react';", policy).length);
  assert.ok(inspectTypeScript(repository, 'resources/js/editor/new.ts', "const a = window.G7Core?.['__runtime'];", policy).some((item) => item.rule === 'G7-INTERNAL'));
});

test('public runtime cannot import admin API; names in strings and comments are not imports', () => {
  assert.ok(inspectTypeScript(repository, 'resources/js/public/new.ts', "import { api } from '../api/pageBuilderApi';", policy).length);
  assert.deepEqual(inspectTypeScript(repository, 'resources/js/documents/new.ts', "// import React from 'react';\nconst text = 'as unknown as any';\nconst data: unknown = null;", policy), []);
});

test('unsafe AST rules distinguish double assertions and any from validated single assertions', () => {
  const results = inspectTypeScript(repository, 'resources/js/editor/new.ts', 'const a: any = value; const b = (value as unknown) as Shape; const c = value as Shape;', policy);
  assert.equal(results.filter((item) => item.rule === 'TS-UNSAFE').length, 2);
  assert.equal(inspectTypeScript(repository, 'resources/js/editor/new.ts', 'const b = <Shape><unknown>value;', policy).length, 1);
  assert.equal(inspectTypeScript(repository, 'resources/js/editor/new.ts', 'dispatch(value as never);', policy).length, 1);
});

test('PHP lexer detects grouped imports, aliases and fully qualified framework dependencies', () => {
  for (const source of [
    '<?php use Illuminate\\Support\\{Arr, Str};', '<?php use Illuminate as Framework;',
    '<?php $value = new \\Illuminate\\Support\\Collection();',
    '<?php use Modules\\Jiwonpapa\\PageBuilder\\Infrastructure\\Store;',
    '<?php use Modules\\Jiwonpapa\\PageBuilder\\{Infrastructure\\Store, Domain\\Documents\\PageBuilderDocument};',
  ]) assert.ok(inspectPhp({ 'src/Domain/New.php': source }, policy).length);
  assert.deepEqual(inspectPhp({ 'src/Domain/New.php': "<?php // use Illuminate\\Support\\Arr;\n$value = 'Illuminate\\Support\\Arr';" }, policy), []);
  assert.deepEqual(inspectPhp({ 'src/Domain/New.php': '<?php namespace Modules\\Jiwonpapa\\PageBuilder\\Domain; class App {}' }, policy), []);
});

test('PHP layer direction permits contracts and blocks inward references to application', () => {
  assert.deepEqual(inspectPhp({ 'src/Application/New.php': '<?php use Modules\\Jiwonpapa\\PageBuilder\\Contracts\\PageBuilderRepository;' }, policy), []);
  assert.ok(inspectPhp({ 'src/Contracts/New.php': '<?php use Modules\\Jiwonpapa\\PageBuilder\\Application\\PageBuilderService;' }, policy).length);
});

test('CSS tokens are allowed only in named owners; component color copies are rejected', () => {
  assert.deepEqual(inspectCss('resources/css/page-builder-theme.css', '.g7pb-theme { --g7pb-page-text: #123456; color: var(--g7pb-page-text); }', policy), []);
  assert.ok(inspectCss('resources/css/new.css', '.g7pb-card { --g7pb-page-text: #123456; }', policy).some((item) => item.rule === 'CSS-COLOR'));
  assert.ok(inspectCss('resources/css/new.css', '.g7pb-card { color: rgb(1 2 3); }', policy).some((item) => item.rule === 'CSS-COLOR'));
  assert.ok(inspectCss('resources/css/new.css', '.g7pb-card { color: rebeccapurple; }', policy).some((item) => item.rule === 'CSS-COLOR'));
  assert.deepEqual(inspectCss('resources/css/new.css', '.g7pb-card { color: var(--g7pb-red); background: url("red.svg#abc"); }', policy), []);
  assert.deepEqual(inspectCss('resources/css/new.css', '.g7pb-card { font-family: Black; animation-name: red; }', policy), []);
});

test('CSS escalation rules identify importance and class repetition separately', () => {
  const results = inspectCss('resources/css/new.css', '.g7pb-card.g7pb-card { color: var(--g7pb-text) !important; }', policy);
  assert.deepEqual(results.map((item) => item.rule).sort(), ['CSS-IMPORTANT', 'CSS-SPECIFICITY']);
  assert.deepEqual(inspectCss('resources/css/new.css', '.g7pb-card:has(.g7pb-card) { color: inherit; }', policy), []);
});

test('exact debt cannot move, change a value or fund a duplicated violation', () => {
  const original = inspectCss('resources/css/legacy.css', '.g7pb-card { color: #123456; }', policy)[0];
  const debt = debtFor(original);
  assert.equal(applyDebt([original], debt, policy).errors.length, 0);
  assert.equal(applyDebt([original, original], debt, policy).errors.length, 1);
  assert.equal(applyDebt([{ ...original, path: 'resources/css/new.css' }], debt, policy).errors.length, 1);
  const changed = inspectCss(original.path, '.g7pb-card { color: #654321; }', policy)[0];
  assert.equal(applyDebt([changed], debt, policy).errors.length, 1);
  assert.equal(applyDebt([], debt, policy).unusedDebt.length, 1);
});

test('a reviewed relocation shares the original cap and cannot duplicate the bridge', (t) => {
  const { root, write } = fixture(t);
  const source = 'const value = input as unknown as Shape;';
  const oldPath = 'resources/js/editor/legacy.ts';
  const newPath = 'resources/js/editor/codec.ts';
  const original = inspectTypeScript(root, oldPath, source, policy)[0];
  const debt = debtFor(original);
  debt.entries[0].relocations = [{ path: newPath, fingerprint: original.fingerprint, reason: 'Move the existing bridge into its own typed adapter without duplication.' }];
  const relocated = { ...original, path: newPath };
  assert.equal(applyDebt([relocated], debt, policy).errors.length, 0);
  assert.equal(applyDebt([original, relocated], debt, policy).errors.length, 1);
  write(policy.debtFile, JSON.stringify(debt));
  write(oldPath, source); write(newPath, source);
  const result = auditArchitecture(root, [newPath]);
  assert.equal(result.checked.length, 2);
  assert.equal(result.errors.length, 1);
});

test('debt requires exact paths, finite counts, known rules and a removal condition', () => {
  const item = finding('TS-UNSAFE', 'resources/js/editor/legacy.ts', 1, 'legacy');
  for (const mutation of [
    (entry) => { entry.path = 'resources/js/editor/*'; },
    (entry) => { entry.resolveWhen = ''; }, (entry) => { entry.reason = ''; },
    (entry) => { entry.rule = 'DISABLE-ALL'; }, (entry) => { entry.fingerprints[item.fingerprint] = 0; },
  ]) {
    const debt = debtFor(item); mutation(debt.entries[0]);
    assert.throws(() => applyDebt([item], debt, policy));
  }
  for (const path of ['../outside.ts', '/outside.ts', 'a/../b.ts']) assert.throws(() => safePath(path));
});

test('source size debt is a ceiling, never an unlimited large file exception', () => {
  const item = sizeFinding('resources/js/editor/large.ts', 'x\n'.repeat(900), policy)[0];
  const debt = debtFor(item, 900);
  assert.equal(applyDebt([item], debt, policy).errors.length, 0);
  const grown = sizeFinding(item.path, 'x\n'.repeat(901), policy)[0];
  assert.equal(applyDebt([grown], debt, policy).errors.length, 1);
  assert.deepEqual(sizeFinding('resources/js/documents/small.ts', '\n'.repeat(2000) + 'const x = 1;', policy), []);
});

test('a compressed TypeScript file cannot bypass the structural size rule', () => {
  const source = Array.from({ length: 2500 }, (_, index) => `const value${index} = ${index};`).join('');
  const result = inspectTypeScript(repository, 'resources/js/editor/compressed.ts', source, policy);
  assert.ok(result.some((item) => item.rule === 'SOURCE-SIZE' && item.detail.includes('AST nodes')));
});

test('selected source is scoped while constitution edits trigger complete static assessment', (t) => {
  const { root, write } = fixture(t);
  write('resources/js/documents/good.ts', 'export const x = 1;');
  write('resources/js/documents/bad.ts', "import React from 'react';");
  const selected = auditArchitecture(root, ['resources/js/documents/good.ts']);
  assert.deepEqual(selected.checked, ['resources/js/documents/good.ts']);
  assert.equal(selected.errors.length, 0);
  const complete = auditArchitecture(root, [policy.constitution]);
  assert.equal(complete.checked.length, 2);
  assert.equal(complete.errors.length, 1);
});

test('a verified controller can inspect a subject without trusting subject policy changes', (t) => {
  const controller = fixture(t);
  const subject = fixture(t);
  subject.write('resources/js/documents/bad.ts', "import React from 'react';");
  subject.write('config/design-architecture.json', JSON.stringify({ ...policy, typescriptLayers: [] }));
  assert.equal(auditArchitecture(subject.root, [], controller.root).errors.length, 1);
});

test('normative changes are read from the subject even with a separate controller', (t) => {
  const controller = fixture(t);
  const subject = fixture(t);
  subject.write('AGENTS.md', 'Old rules without a constitution reference');
  assert.throws(() => auditArchitecture(subject.root, ['AGENTS.md'], controller.root), /must reference/);
  subject.write('AGENTS.md', 'See docs/development-constitution.md');
  assert.deepEqual(auditArchitecture(subject.root, ['AGENTS.md'], controller.root).normativeChecked, ['AGENTS.md']);
  subject.write(policy.constitution, 'No declared rule IDs');
  assert.throws(() => auditArchitecture(subject.root, [policy.constitution], controller.root), /Subject constitution omits/);
});

test('rules missing from the constitution fail instead of quietly dropping enforcement', (t) => {
  const { root, write } = fixture(t);
  write(policy.constitution, 'Unrelated text');
  assert.throws(() => readPolicy(root), /Undocumented architecture rule/);
});

test('a rule or protected source area cannot be disabled by empty configuration', (t) => {
  const { root, write } = fixture(t);
  for (const change of [{ rules: [] }, { typescriptLayers: [] }, { sourceRoots: ['resources/css'] }, { sourceSize: {} }]) {
    write('config/design-architecture.json', JSON.stringify({ ...policy, ...change }));
    assert.throws(() => readPolicy(root));
  }
});
