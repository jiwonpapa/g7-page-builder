import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';
import { finding } from './designArchitecturePolicy.mjs';

function importedName(node) {
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) return node.argument.literal;
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier;
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) return node.moduleReference.expression;
  if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
    || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) return node.arguments[0];
  return null;
}

function resolveImport(root, path, specifier) {
  const local = posix.normalize(posix.join(posix.dirname(path), specifier));
  return [local, `${local}.ts`, `${local}.tsx`, `${local}.js`, `${local}/index.ts`, `${local}/index.tsx`]
    .find((candidate) => existsSync(join(root, candidate))) ?? local;
}

function unwrap(node) {
  return ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)
    ? unwrap(node.expression) : node;
}

function unwrapType(node) {
  return ts.isParenthesizedTypeNode(node) ? unwrapType(node.type) : node;
}

function accessPath(node) {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) return [...accessPath(node.expression), node.name.text];
  if (ts.isElementAccessExpression(node)) return [...accessPath(node.expression),
    ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : '*'];
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)
    || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) return accessPath(node.expression);
  return [];
}

function inspectNativeAccess(node, path, policy, report) {
  const native = policy.nativeEditor;
  const inAdapter = path.startsWith(native.adapter);
  const inNative = path.startsWith(native.root) || inAdapter;
  if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)
    && !ts.isParenthesizedExpression(node) && !ts.isNonNullExpression(node) && !ts.isAsExpression(node)
    && !ts.isTypeAssertionExpression(node) && !ts.isSatisfiesExpression(node)) return;
  // Inspect the full chain once. Do not mistake a property name for a global reference.
  const parent = node.parent;
  if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent))
      && parent.expression === node
    || (ts.isParenthesizedExpression(parent) || ts.isNonNullExpression(parent)
      || ts.isAsExpression(parent) || ts.isTypeAssertionExpression(parent) || ts.isSatisfiesExpression(parent)) && parent.expression === node
    || parent.name === node && !ts.isShorthandPropertyAssignment(parent)) return;
  const parts = accessPath(node);
  const globalRoot = ['window', 'globalThis'].includes(parts[0]);
  if (globalRoot) parts.shift();
  if (inNative && globalRoot && (!parts.length || parts.includes('*'))) {
    report('NATIVE-BOUNDARY', node, 'Native editor globals require explicit members; global object aliases are forbidden');
  }
  if (parts[0] === 'G7Core' && (inNative || parts[1] === 'layoutEditor')) {
    if (!inAdapter) report('NATIVE-BOUNDARY', node, 'G7 editor host access belongs in the native G7 adapter');
    else if (parts.length !== 3 || parts[1] !== 'layoutEditor' || !native.methods.includes(parts[2])) {
      report('NATIVE-BOUNDARY', node, 'Use a declared public editor method directly; do not alias or expose the host object');
    }
  }
  if (inNative && !inAdapter
    && ['fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB'].includes(parts[0])) {
    report('NATIVE-BOUNDARY', node, 'Native editor I/O must use an injected port implemented by the adapter');
  }
}

export function inspectTypeScript(root, path, source, policy) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const results = [];
  let structuralNodes = 0;
  const layer = policy.typescriptLayers.filter((candidate) => path.startsWith(candidate.from))
    .sort((a, b) => b.from.length - a.from.length)[0];
  const report = (rule, node, detail, identity = detail) => results.push(finding(rule, path,
    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, detail, identity));
  if (file.parseDiagnostics.length) {
    for (const error of file.parseDiagnostics) results.push(finding('TS-BOUNDARY', path, 1,
      `Cannot analyze invalid TypeScript: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`));
    return results;
  }
  const visit = (node) => {
    structuralNodes++;
    inspectNativeAccess(node, path, policy, report);
    const imported = importedName(node);
    if (imported) {
      if (!ts.isStringLiteralLike(imported)) {
        if (layer) report('TS-BOUNDARY', node, 'Protected layers require a statically declared import');
      } else {
        const name = imported.text;
        if (/resources\/js\/core\/|G7Core\.__runtime|LayoutEditorChrome/.test(name)) report('G7-INTERNAL', node, `G7 implementation import: ${name}`);
        if (layer) {
          const target = name.startsWith('.') ? resolveImport(root, path, name) : null;
          const allowed = target === null ? layer.packages.some((pkg) => name === pkg || name.startsWith(`${pkg}/`))
            : layer.localFiles.includes(target) || layer.localPrefixes.some((prefix) => target.startsWith(prefix));
          if (!allowed) report('TS-BOUNDARY', node, `${path} may not depend on ${name}`);
        }
      }
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) report('TS-UNSAFE', node, 'Explicit any bypasses the contract',
      node.parent.getText(file).replace(/\s+/g, ' '));
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      if (unwrapType(node.type).kind === ts.SyntaxKind.NeverKeyword) report('TS-UNSAFE', node,
        'Casting a value to never bypasses the consumer contract', node.getText(file).replace(/\s+/g, ' '));
      const inner = unwrap(node.expression);
      if ((ts.isAsExpression(inner) || ts.isTypeAssertionExpression(inner))
        && [ts.SyntaxKind.UnknownKeyword, ts.SyntaxKind.AnyKeyword].includes(unwrapType(inner.type).kind)) {
        report('TS-UNSAFE', node, 'Double assertion bypasses structural validation', node.getText(file).replace(/\s+/g, ' '));
      }
    }
    if ((ts.isPropertyAccessExpression(node) && ['__runtime', '__LayoutEditorChrome'].includes(node.name.text)
      || ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
        && ['__runtime', '__LayoutEditorChrome'].includes(node.argumentExpression.text))
      && /\bG7Core\b/.test(node.expression.getText(file))) report('G7-INTERNAL', node, 'G7 private runtime access is forbidden');
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (structuralNodes > policy.maxTypeScriptNodes) results.push(finding('SOURCE-SIZE', path, 1,
    `${structuralNodes} TypeScript AST nodes exceeds ${policy.maxTypeScriptNodes}; reduce structural responsibilities`, 'typescript-ast-nodes', structuralNodes));
  return results;
}
