import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// This guard reads syntax and symbols; it never imports or executes product code.
// Its accepted control flow is deliberately bounded: bridge -> register ->
// unconditional descriptor loop / throwing collision guard -> registry.set.
const fail = (message) => { throw new Error(`Block Pack registry boundary: ${message}`); };
const unwrap = (node) => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
const member = (node, name) => node && ts.isPropertyAccessExpression(node) && node.name.text === name;
const walk = (node, visit) => { visit(node); ts.forEachChild(node, (child) => walk(child, visit)); };
const exported = (node) => node.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword);

export function checkBlockPackRegistryBoundary(subjectRoot) {
  const root = fs.realpathSync(subjectRoot);
  const files = new Map();
  const within = (filename) => {
    const actual = fs.realpathSync(filename);
    if (actual !== root && !actual.startsWith(root + path.sep)) fail('source escapes subject root');
    return actual;
  };
  const load = (filename) => {
    const actual = within(filename);
    if (!files.has(actual)) {
      const source = ts.createSourceFile(actual, fs.readFileSync(actual, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      if (source.parseDiagnostics.length) fail(`invalid TypeScript: ${path.relative(root, actual)}`);
      files.set(actual, source);
    }
    return files.get(actual);
  };
  const importedFile = (source, specifier) => {
    if (!specifier.startsWith('.')) fail('registration owner must use a relative source import');
    const stem = path.resolve(path.dirname(source.fileName), specifier);
    const filename = [stem + '.ts', stem + '.tsx', stem].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!filename) fail(`missing registration dependency: ${specifier}`);
    return load(filename);
  };
  const entry = load(path.join(root, 'resources/js/blocks/runtimeRegistry.ts'));
  const catalog = load(path.join(root, 'resources/js/blocks/builtinCatalog.ts'));
  // Resolve only the actual bridge binding, not an unrelated function with a
  // familiar name. Named imports/re-exports and immutable identifier aliases
  // can move the owner without executing or scanning the whole product graph.
  const resolveOwner = (source, name, requireExport = false, seen = new Set()) => {
    const key = source.fileName + ':' + name;
    if (seen.has(key)) fail('cyclic registration binding');
    const next = new Set([...seen, key]);
    const candidates = [];
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === name && (!requireExport || exported(statement))) candidates.push(statement);
      if (ts.isVariableStatement(statement) && (!requireExport || exported(statement))) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
            if (!(statement.declarationList.flags & ts.NodeFlags.Const)) fail('mutable registration binding');
            if (!declaration.initializer) fail('registration alias has no initializer');
            const value = unwrap(declaration.initializer);
            if (!ts.isIdentifier(value)) fail('registration alias must identify its function');
            candidates.push(resolveOwner(source, value.text, false, next));
          }
        }
      }
      if (!requireExport && ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
        for (const specifier of statement.importClause.namedBindings.elements) {
          if (specifier.name.text !== name) continue;
          if (statement.importClause.isTypeOnly || specifier.isTypeOnly) fail('type-only registration binding');
          candidates.push(resolveOwner(importedFile(source, statement.moduleSpecifier.text), (specifier.propertyName ?? specifier.name).text, true, next));
        }
      }
      if (requireExport && ts.isExportDeclaration(statement) && statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          if (specifier.name.text !== name) continue;
          if (statement.isTypeOnly || specifier.isTypeOnly) fail('type-only registration export');
          candidates.push(resolveOwner(importedFile(source, statement.moduleSpecifier.text), (specifier.propertyName ?? specifier.name).text, true, next));
        }
      }
    }
    if (candidates.length !== 1 || !candidates[0].body) fail(`missing or ambiguous register function: ${name}`);
    return candidates[0];
  };
  const isBridge = (node) => member(node, 'G7PageBuilderBlockPacks') && ts.isIdentifier(node.expression) && node.expression.text === 'window';
  const bridgeWrites = [];
  walk(entry, (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && (isBridge(node.left) || (ts.isPropertyAccessExpression(node.left) && isBridge(node.left.expression)))) bridgeWrites.push(node);
  });
  if (bridgeWrites.length !== 1 || !isBridge(bridgeWrites[0].left)) fail('one live Window bridge assignment is required');
  const bridge = bridgeWrites[0];
  if (!ts.isExpressionStatement(bridge.parent)) fail('bridge assignment is not a statement');
  let container = bridge.parent.parent;
  if (ts.isBlock(container)) {
    const condition = container.parent;
    if (!ts.isIfStatement(condition) || condition.thenStatement !== container || condition.elseStatement
      || condition.parent !== entry) fail('bridge is not installed from module scope');
    const test = unwrap(condition.expression);
    if (!ts.isBinaryExpression(test) || test.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken
      || !ts.isTypeOfExpression(test.left) || !ts.isIdentifier(test.left.expression) || test.left.expression.text !== 'window'
      || !ts.isStringLiteral(test.right) || test.right.text !== 'undefined') fail('bridge must use the live browser environment guard');
    container = condition.parent;
  }
  if (container !== entry || !ts.isObjectLiteralExpression(bridge.right)) fail('bridge must be a module-level object');
  if (bridge.right.properties.some(ts.isSpreadAssignment)) fail('bridge spread can replace its register binding');
  const registrations = bridge.right.properties.filter((property) => property.name && property.name.getText(entry) === 'register');
  if (registrations.length !== 1) fail('bridge must expose exactly one register property');
  const property = registrations[0];
  const registerRef = ts.isShorthandPropertyAssignment(property) ? property.name : ts.isPropertyAssignment(property) ? unwrap(property.initializer) : undefined;
  if (!registerRef || !ts.isIdentifier(registerRef)) fail('bridge register must identify its function');
  const register = resolveOwner(entry, registerRef.text);

  const host = ts.createCompilerHost({ noLib: true });
  host.getSourceFile = (filename) => files.get(path.resolve(filename));
  host.resolveModuleNames = (names, containing) => names.map((name) => {
    if (!name.startsWith('.')) return undefined;
    const stem = path.resolve(path.dirname(containing), name);
    const filename = [stem + '.ts', stem + '.tsx', stem].find((candidate) => files.has(candidate));
    return filename ? { resolvedFileName: filename, extension: filename.endsWith('.tsx') ? ts.Extension.Tsx : ts.Extension.Ts } : undefined;
  });
  const program = ts.createProgram([...files.keys()], { noLib: true, noEmit: true, target: ts.ScriptTarget.ESNext }, host);
  const checker = program.getTypeChecker();
  const symbol = (node) => {
    let value = ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
    if (value?.flags & ts.SymbolFlags.Alias) value = checker.getAliasedSymbol(value);
    return value;
  };
  const same = (left, right) => !!symbol(left) && symbol(left) === symbol(right);
  const constant = (identifier) => {
    const declarations = symbol(identifier)?.declarations ?? [];
    return declarations.length === 1 && ts.isVariableDeclaration(declarations[0])
      && declarations[0].parent.flags & ts.NodeFlags.Const ? declarations[0] : undefined;
  };
  const functionBinding = (node, seen = new Set()) => {
    const value = symbol(node);
    if (!value || seen.has(value)) return undefined;
    const declarations = value.declarations ?? [];
    if (declarations.length !== 1) return undefined;
    const declaration = declarations[0];
    if (ts.isFunctionDeclaration(declaration)) return declaration;
    if (ts.isVariableDeclaration(declaration) && declaration.parent.flags & ts.NodeFlags.Const
      && declaration.initializer && ts.isIdentifier(unwrap(declaration.initializer))) {
      return functionBinding(unwrap(declaration.initializer), new Set([...seen, value]));
    }
    return undefined;
  };
  if (functionBinding(registerRef) !== register) fail('bridge register binding bypasses the validated function');
  if (checker.getSymbolAtLocation(bridge.left.expression)) fail('Window bridge receiver is shadowed');
  if (!register.parameters[0] || !ts.isIdentifier(register.parameters[0].name) || register.parameters.length !== 1) fail('register must receive one registration parameter');
  const parameter = register.parameters[0].name;
  const body = register.body.statements;
  const sets = [];
  walk(register.body, (node) => { if (ts.isCallExpression(node) && member(node.expression, 'set')) sets.push(node); });
  if (sets.length !== 1) fail('register must have exactly one registry.set after validation');
  const store = sets[0];
  const registry = constant(store.expression.expression);
  if (!registry?.initializer || !ts.isNewExpression(registry.initializer) || registry.initializer.expression.getText() !== 'Map'
    || checker.getSymbolAtLocation(registry.initializer.expression) || registry.initializer.arguments?.length
    || store.arguments.length !== 2 || !same(store.arguments[1], parameter)
    || !ts.isExpressionStatement(store.parent) || store.parent.parent !== register.body) fail('registration storage is not the direct Map.set of the validated input');
  const storeIndex = body.indexOf(store.parent);
  const validLoops = body.filter((statement, index) => index < storeIndex && ts.isForOfStatement(statement)
    && member(statement.expression, 'blocks') && same(statement.expression.expression, parameter)
    && ts.isVariableDeclarationList(statement.initializer) && statement.initializer.declarations.length === 1
    && ts.isIdentifier(statement.initializer.declarations[0].name) && ts.isBlock(statement.statement));
  let guarded = false;
  for (const loop of validLoops) {
    const block = loop.initializer.declarations[0].name;
    // The existing loop only rejects a collision then records the seen name.
    // A break/return or nested transfer could leave later descriptors unchecked.
    const recordsOnly = loop.statement.statements.slice(1).every((statement) => {
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false;
      const call = statement.expression;
      if (!member(call.expression, 'add') || call.arguments.length !== 1
        || !member(call.arguments[0], 'editor_component') || !same(call.arguments[0].expression, block)) return false;
      const seen = constant(call.expression.expression)?.initializer;
      return seen && ts.isNewExpression(seen) && seen.expression.getText() === 'Set'
        && !checker.getSymbolAtLocation(seen.expression) && !seen.arguments?.length;
    });
    if (!recordsOnly) continue;
    const guard = loop.statement.statements[0];
    if (!guard || !ts.isIfStatement(guard) || guard.elseStatement) continue;
    const rejection = ts.isBlock(guard.thenStatement) ? guard.thenStatement.statements : [guard.thenStatement];
    if (rejection.length !== 1 || !ts.isThrowStatement(rejection[0])) continue;
    const alternatives = (expression) => {
      const item = unwrap(expression);
      return ts.isBinaryExpression(item) && item.operatorToken.kind === ts.SyntaxKind.BarBarToken
        ? [...alternatives(item.left), ...alternatives(item.right)] : [item];
    };
    for (const check of alternatives(guard.expression)) {
      if (!ts.isCallExpression(check) || !member(check.expression, 'has') || check.arguments.length !== 1
        || !member(check.arguments[0], 'editor_component') || !same(check.arguments[0].expression, block)) continue;
      const builtinSet = constant(check.expression.expression);
      const init = builtinSet?.initializer;
      if (!init || !ts.isNewExpression(init) || init.expression.getText() !== 'Set' || checker.getSymbolAtLocation(init.expression) || init.arguments?.length !== 1) continue;
      const mapped = init.arguments[0];
      if (!ts.isCallExpression(mapped) || !member(mapped.expression, 'map') || mapped.arguments.length !== 1) continue;
      const definition = symbol(mapped.expression.expression)?.declarations;
      if (definition?.length !== 1 || !ts.isVariableDeclaration(definition[0]) || definition[0].name.getText() !== 'BUILTIN_BLOCK_DEFINITIONS'
        || definition[0].getSourceFile() !== catalog || !exported(definition[0].parent.parent)) continue;
      const callback = mapped.arguments[0];
      if (!ts.isArrowFunction(callback) || callback.parameters.length !== 1 || !member(callback.body, 'editor_component')
        || !same(callback.body.expression, callback.parameters[0].name)) continue;
      let modified = false;
      walk(builtinSet.getSourceFile(), (node) => {
        if (ts.isPropertyAccessExpression(node) && same(node.expression, builtinSet.name) && node.name.text !== 'has') modified = true;
        if (ts.isBinaryExpression(node) && (same(node.left, builtinSet.name)
          || (ts.isPropertyAccessExpression(node.left) && same(node.left.expression, builtinSet.name)))) modified = true;
      });
      if (!modified) guarded = true;
    }
  }
  if (!guarded) fail('builtin catalog Set.has must throw for each descriptor before registry.set');
  return [...files.keys()].map((filename) => path.relative(root, filename));
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--root') fail('usage: --root <subject-directory>');
  checkBlockPackRegistryBoundary(args[1]);
  console.log('Block Pack registry boundary: OK');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
