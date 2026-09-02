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

export function inspectTypeScript(root, path, source, policy) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const results = [];
  let structuralNodes = 0;
  const layer = policy.typescriptLayers.find((candidate) => path.startsWith(candidate.from));
  const report = (rule, node, detail, identity = detail) => results.push(finding(rule, path,
    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, detail, identity));
  if (file.parseDiagnostics.length) {
    for (const error of file.parseDiagnostics) results.push(finding('TS-BOUNDARY', path, 1,
      `Cannot analyze invalid TypeScript: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`));
    return results;
  }
  const visit = (node) => {
    structuralNodes++;
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
