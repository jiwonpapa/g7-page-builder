import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { readCssGraph } from './editorCssSources.mjs';

export const EDITOR_ENTRY = 'resources/js/editor/PuckEditorAdapter.tsx';
export const EDITOR_CONTRACT_FILES = [
  'package.json', 'package-lock.json', 'tsconfig.json', 'Makefile', 'scripts/coord-harness.sh', 'playwright.config.ts',
  'tests/E2E/editorInteractionQuality.spec.ts', 'tests/E2E/support/editorInteractionFixture.ts',
  'tests/E2E/editorLayoutParity.spec.ts', 'tests/E2E/blockCatalogQuality.spec.ts', 'tests/E2E/sitePartLifecycle.spec.ts',
  'schemas/site-part-document.schema.json', 'src/Application/Compilation/SitePartHtmlCompiler.php',
];
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'];
const inside = (root, file) => { const name = relative(root, file); return name !== '..' && !name.startsWith('../') && !isAbsolute(name); };
const hasValue = (node) => !node.importClause?.isTypeOnly && !node.isTypeOnly;
const named = (node) => node.name && ts.isIdentifier(node.name) ? node.name.text : null;

function commentFree(node, file) {
  const source = node.getText(file);
  // AST comment ranges avoid treating URL strings, regexes or JSX text as comments.
  const ranges = new Map();
  const collect = (current) => {
    for (const point of [current.pos, current.end]) {
      for (const item of [...(ts.getLeadingCommentRanges(file.text, point) ?? []), ...(ts.getTrailingCommentRanges(file.text, point) ?? [])]) {
        if (item.pos >= node.getStart(file) && item.end <= node.end) ranges.set(item.pos, item.end);
      }
    }
    ts.forEachChild(current, collect);
  };
  collect(node);
  let result = source;
  for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) {
    const offset = start - node.getStart(file);
    result = result.slice(0, offset) + result.slice(offset, end - node.getStart(file)).replace(/[^\r\n]/g, ' ') + result.slice(end - node.getStart(file));
  }
  return result;
}

/** Parse only actual local module edges. Packages are supplied by the lockfile. */
export async function readEditorSourceGraph(subject, entries = [EDITOR_ENTRY]) {
  const root = await realpath(subject);
  const modules = new Map(), visiting = new Set(), order = [];
  const configFiles = new Set();
  async function compilerConfig(file, parents = []) {
    const actual = await realpath(file);
    if (!inside(root, actual)) throw new Error(`Editor config escapes root: ${file}`);
    if (parents.includes(actual)) throw new Error(`Circular editor config: ${file}`);
    configFiles.add(relative(root, actual));
    const parsed = ts.parseConfigFileTextToJson(actual, await readFile(actual, 'utf8'));
    if (parsed.error) throw new Error(`Invalid editor config: ${file}`);
    const base = parsed.config.extends;
    if (base && (typeof base !== 'string' || !base.startsWith('.'))) throw new Error(`Unsupported editor config extends: ${base}`);
    const inherited = base ? await compilerConfig(resolve(dirname(actual), extname(base) ? base : base + '.json'), [...parents, actual]) : {};
    return { ...inherited, ...(parsed.config.compilerOptions ?? {}) };
  }
  const rawOptions = (await stat(resolve(root, 'tsconfig.json')).catch(() => null))?.isFile()
    ? await compilerConfig(resolve(root, 'tsconfig.json')) : {};
  const converted = ts.convertCompilerOptionsFromJson(rawOptions, root);
  if (converted.errors.length) throw new Error('Invalid editor compiler options');
  const compilerOptions = { ...converted.options, target: ts.ScriptTarget.Latest, jsx: ts.JsxEmit.Preserve, noEmit: false };
  async function localFile(from, target) {
    const candidate = resolve(dirname(from), target);
    if (!inside(root, candidate)) throw new Error(`Editor source escapes root: ${target}`);
    const choices = [candidate];
    if (/\.[cm]?jsx?$/.test(candidate)) choices.push(candidate.replace(/\.[cm]?jsx?$/, '.ts'), candidate.replace(/\.[cm]?jsx?$/, '.tsx'));
    if (!extname(candidate)) choices.push(...extensions.map(ext => candidate + ext), ...extensions.map(ext => resolve(candidate, 'index' + ext)));
    for (const file of choices) {
      if (!(await stat(file).catch(() => null))?.isFile()) continue;
      const actual = await realpath(file);
      if (!inside(root, actual)) throw new Error(`Editor source escapes root: ${target}`);
      return actual;
    }
    throw new Error(`Missing editor source import: ${relative(root, from)} -> ${target}`);
  }
  async function visit(file) {
    if (visiting.has(file)) throw new Error(`Circular editor source import: ${relative(root, file)}`);
    if (modules.has(file)) return;
    if (!inside(root, file)) throw new Error(`Editor source escapes root: ${file}`);
    const source = await readFile(file, 'utf8');
    const module = { file, source, edges: [], tree: null };
    modules.set(file, module);
    visiting.add(file);
    if (/\.[cm]?[jt]sx?$/.test(file)) {
      module.tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      if (module.tree.parseDiagnostics.length) throw new Error(`Invalid editor source syntax: ${relative(root, file)}`);
      // Use the project's emitted module edges: normal type-only uses may be
      // erased, while verbatimModuleSyntax preserves an empty mixed import.
      const emitted = ts.transpileModule(source, { fileName: file, compilerOptions }).outputText;
      const runtimeTree = ts.createSourceFile(file + '.js', emitted, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
      const targets = [];
      const collect = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && hasValue(node)) targets.push(node.moduleSpecifier);
        if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)) targets.push(node.moduleReference.expression);
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) targets.push(node.arguments[0]);
        ts.forEachChild(node, collect);
      };
      collect(runtimeTree);
      for (const target of targets) {
        if (!target || !ts.isStringLiteralLike(target)) throw new Error(`Dynamic editor source import: ${relative(root, file)}`);
        const name = target.text;
        if (!name.startsWith('.')) {
          if (isAbsolute(name) || name.startsWith('@/') || name.startsWith('~/')) throw new Error(`Unsupported editor source import: ${name}`);
          continue;
        }
        const dependency = await localFile(file, name);
        module.edges.push(dependency);
        await visit(dependency);
      }
    }
    visiting.delete(file);
    order.push(file);
  }
  const roots = [];
  for (const entry of entries) {
    const file = await localFile(resolve(root, '__entry__.ts'), './' + entry);
    roots.push(file);
    await visit(file);
  }
  // The binder resolves aliases/reexports and lexical identifiers. Its host only
  // sees files already admitted by the bounded graph, never vendor internals.
  const options = { ...compilerOptions, noLib: true, allowJs: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
  const host = ts.createCompilerHost(options);
  host.fileExists = file => modules.has(resolve(file));
  host.readFile = file => modules.get(resolve(file))?.source;
  host.getSourceFile = file => modules.get(resolve(file))?.tree ?? undefined;
  host.directoryExists = file => [...modules.keys()].some(item => item.startsWith(resolve(file) + '/'));
  const program = ts.createProgram([...modules.values()].filter(item => item.tree).map(item => item.file), options, host);
  const checker = program.getTypeChecker();
  const reachable = new Set(), statements = new Set();
  const symbol = node => {
    const value = ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
    return value && value.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(value) : value;
  };
  const isImportReference = (node, imported, moduleName) => (checker.getSymbolAtLocation(node)?.declarations ?? []).some(declaration => {
    if (!ts.isImportSpecifier(declaration) || (declaration.propertyName ?? declaration.name).text !== imported || declaration.isTypeOnly) return false;
    const statement = declaration.parent.parent.parent;
    return ts.isImportDeclaration(statement) && !statement.importClause.isTypeOnly && statement.moduleSpecifier.text === moduleName;
  });
  const mark = node => {
    if (!node || reachable.has(node) || !modules.has(node.getSourceFile().fileName)) return;
    reachable.add(node);
    let top = node;
    while (top.parent && !ts.isSourceFile(top.parent)) top = top.parent;
    statements.add(top);
    const walk = current => {
      // A loaded module's type/typeof reference is not an executed declaration.
      if (ts.isTypeNode(current)) return;
      if (current !== node && ts.isFunctionDeclaration(current)) return;
      if (current !== node && ts.isVariableDeclaration(current) && current.initializer
        && (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer)) && !reachable.has(current)) return;
      const parent = current.parent;
      const declarationName = parent?.name === current && (ts.isVariableDeclaration(parent) || ts.isParameter(parent)
        || ts.isFunctionDeclaration(parent) || ts.isBindingElement(parent) || ts.isPropertyAssignment(parent)
        || ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isTypeAliasDeclaration(parent) || ts.isInterfaceDeclaration(parent));
      if (ts.isIdentifier(current) && !declarationName) {
        for (const declaration of symbol(current)?.declarations ?? []) mark(declaration);
      }
      ts.forEachChild(current, walk);
    };
    if (ts.isBindingElement(node)) {
      let declaration = node.parent;
      while (declaration && !ts.isVariableDeclaration(declaration) && !ts.isParameter(declaration)) declaration = declaration.parent;
      if (declaration) mark(declaration);
    }
    walk(node);
  };
  for (const entry of roots) {
    const tree = modules.get(entry).tree;
    for (const declaration of checker.getExportsOfModule(tree.symbol)) {
      if (relative(root, entry) === EDITOR_ENTRY && declaration.name !== 'PuckEditorAdapter') continue;
      const value = declaration.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(declaration) : declaration;
      for (const node of value.declarations ?? []) mark(node);
    }
  }
  for (const module of modules.values()) for (const statement of module.tree?.statements ?? []) {
    if (ts.isExpressionStatement(statement)) mark(statement);
  }
  const namedNodes = new Map();
  for (const file of order) {
    const tree = modules.get(file).tree;
    if (!tree) continue;
    const collect = node => {
      if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && named(node)) {
        let top = node;
        while (top.parent && !ts.isSourceFile(top.parent)) top = top.parent;
        if (reachable.has(node)) namedNodes.set(named(node), [...(namedNodes.get(named(node)) ?? []), node]);
      }
      ts.forEachChild(node, collect);
    };
    collect(tree);
  }
  const descendants = entry => {
    const start = resolve(root, entry);
    if (!modules.has(start)) throw new Error(`Disconnected editor source: ${entry}`);
    const selected = new Set();
    const walk = file => { if (selected.has(file)) return; selected.add(file); modules.get(file).edges.forEach(walk); };
    walk(start);
    return selected;
  };
  const find = (predicate, entry = entries[0]) => {
    const selected = descendants(entry), found = [];
    const walk = node => {
      if (ts.isTypeNode(node)) return;
      if (ts.isFunctionDeclaration(node) && !reachable.has(node)) return;
      if (ts.isVariableDeclaration(node) && node.initializer
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) && !reachable.has(node)) return;
      if (predicate(node)) found.push(node);
      ts.forEachChild(node, walk);
    };
    for (const file of order) if (selected.has(file)) {
      for (const statement of modules.get(file).tree?.statements ?? []) if (statements.has(statement)) walk(statement);
    }
    return found;
  };
  // Resolve a value binding through explicit object returns of a local hook.
  // This follows the value consumed by JSX, not another same-named declaration.
  const value = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return node;
    seen = new Set([...seen, node]);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return value(node.expression, seen);
    if (ts.isIdentifier(node)) {
      const declaration = symbol(node)?.valueDeclaration ?? symbol(node)?.declarations?.[0];
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return value(declaration.initializer, seen);
      if (declaration && ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent)) {
        const owner = declaration.parent.parent;
        if (ts.isVariableDeclaration(owner) && owner.initializer) return member(owner.initializer,
          declaration.propertyName?.getText() ?? declaration.name.getText(), seen) ?? declaration;
      }
      return declaration ?? node;
    }
    if (ts.isPropertyAccessExpression(node)) return member(node.expression, node.name.text, seen) ?? node;
    return node;
  };
  const member = (input, name, seen, resolveMember = true) => {
    let object = value(input, seen);
    if (object && ts.isCallExpression(object)) {
      const callee = value(object.expression, seen);
      const body = callee && (ts.isFunctionDeclaration(callee) || ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) ? callee.body : null;
      const returns = [];
      const collect = node => {
        if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
        else if (!ts.isFunctionLike(node)) ts.forEachChild(node, collect);
      };
      if (body && ts.isBlock(body)) collect(body);
      else if (body) returns.push(body);
      if (returns.length !== 1) return undefined;
      object = value(returns[0], seen);
    }
    if (!object || !ts.isObjectLiteralExpression(object) || object.properties.some(ts.isSpreadAssignment)) return undefined;
    const properties = object.properties.filter(item => item.name?.getText() === name);
    if (properties.length !== 1) return undefined;
    const property = properties[0];
    const expression = ts.isShorthandPropertyAssignment(property) ? property.name
      : ts.isPropertyAssignment(property) ? property.initializer : undefined;
    return resolveMember ? value(expression, seen) : expression;
  };
  const sameValue = (left, right) => {
    const a = value(left), b = value(right);
    if (!a || !b) return false;
    if (a === b) return true;
    return ts.isPropertyAccessExpression(a) && ts.isPropertyAccessExpression(b)
      && a.name.text === b.name.text && sameValue(a.expression, b.expression);
  };
  // Resolve a single local hook's explicit parameter/argument wiring. This is
  // value provenance, not execution: multiple callers, defaults and spreads are
  // deliberately unresolved rather than selecting an arbitrary input.
  const inputBinding = (input, seen = new Set()) => {
    let node = input;
    if (!node || seen.has(node)) return undefined;
    seen = new Set([...seen, node]);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return inputBinding(node.expression, seen);
    if (ts.isIdentifier(node)) node = symbol(node)?.valueDeclaration ?? symbol(node)?.declarations?.[0] ?? node;
    if (ts.isVariableDeclaration(node) && node.initializer) return inputBinding(node.initializer, seen);
    if (ts.isPropertyAccessExpression(node)) {
      const receiver = inputBinding(node.expression, seen);
      return receiver && { node: receiver.node, members: [...receiver.members, node.name.text] };
    }
    const binding = ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) ? node : undefined;
    if (binding && ts.isVariableDeclaration(binding.parent.parent)) {
      return inputBinding(member(binding.parent.parent.initializer, (binding.propertyName ?? binding.name).getText(), new Set(), false), seen);
    }
    const parameter = ts.isParameter(node) ? node : binding && ts.isParameter(binding.parent.parent) ? binding.parent.parent : undefined;
    if (parameter) {
      if (parameter.initializer || parameter.dotDotDotToken || binding?.initializer || binding?.dotDotDotToken) return undefined;
      const owner = parameter.parent;
      const calls = find(candidate => ts.isCallExpression(candidate) && value(candidate.expression) === owner);
      if (calls.length !== 1 || !owner.parameters) return undefined;
      if (calls[0].arguments.some(ts.isSpreadElement)) return undefined;
      const argument = calls[0].arguments[owner.parameters.indexOf(parameter)];
      return inputBinding(binding ? member(argument, (binding.propertyName ?? binding.name).getText(), new Set(), false) : argument, seen);
    }
    if (ts.isCallExpression(node) && isImportReference(node.expression, 'useMemo', 'react')) {
      const factory = node.arguments[0];
      if (!factory || !ts.isArrowFunction(factory)) return undefined;
      const body = factory.body;
      return inputBinding(ts.isBlock(body) ? body.statements.length === 1 && ts.isReturnStatement(body.statements[0]) ? body.statements[0].expression : undefined : body, seen);
    }
    return { node, members: [] };
  };
  return {
    files: [...new Set([...modules.keys()].map(file => relative(root, file)).concat([...configFiles]))].sort(),
    nodes(name) { return namedNodes.get(name) ?? []; },
    find,
    value,
    sameValue,
    inputBinding,
    member(input, name) { return member(input, name, new Set()); },
    memberExpression(input, name) { return member(input, name, new Set(), false); },
    isImportReference,
    usesImport(owner, imported, moduleName) {
      const nodes = namedNodes.get(owner) ?? [];
      if (nodes.length !== 1) return false;
      let found = false;
      const walk = node => {
        if (ts.isIdentifier(node)) {
          for (const declaration of checker.getSymbolAtLocation(node)?.declarations ?? []) {
            if (!ts.isImportSpecifier(declaration) || (declaration.propertyName ?? declaration.name).text !== imported || declaration.isTypeOnly) continue;
            const statement = declaration.parent.parent.parent;
            if (ts.isImportDeclaration(statement) && !statement.importClause.isTypeOnly && statement.moduleSpecifier.text === moduleName) found = true;
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(nodes[0]);
      return found;
    },
    callOwner(name, firstArgument) {
      const calls = find(node => ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text === name : ts.isIdentifier(node.expression) && node.expression.text === name)
        && (!firstArgument || node.arguments[0]?.getText() === firstArgument));
      const files = [...new Set(calls.map(node => relative(root, node.getSourceFile().fileName)))];
      if (files.length !== 1) throw new Error(`Expected one connected editor call owner ${name}, found ${files.length}`);
      return files[0];
    },
    jsxOwner(tag, attributeName, attributeValue) {
      const nodes = find(node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === tag
        && node.attributes.properties.some(item => ts.isJsxAttribute(item) && item.name.text === attributeName
          && item.initializer && ts.isJsxExpression(item.initializer) && item.initializer.expression
          && ts.isIdentifier(item.initializer.expression) && item.initializer.expression.text === attributeValue));
      if (nodes.length !== 1) throw new Error(`Expected one connected JSX owner ${tag}, found ${nodes.length}`);
      return relative(root, nodes[0].getSourceFile().fileName);
    },
    owner(name) {
      const nodes = namedNodes.get(name) ?? [];
      if (nodes.length !== 1) throw new Error(`Expected one connected editor declaration ${name}, found ${nodes.length}`);
      return relative(root, nodes[0].getSourceFile().fileName);
    },
    declaration(name) {
      this.owner(name);
      const node = namedNodes.get(name)[0];
      return commentFree(node, node.getSourceFile());
    },
    source(entry) {
      const selected = descendants(entry);
      return order.filter(file => selected.has(file)).flatMap(file => {
        const tree = modules.get(file).tree;
        return tree ? tree.statements.filter(node => statements.has(node) || ts.isImportDeclaration(node)
          || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)).map(node => commentFree(node, tree)) : [];
      }).join('\n\n');
    },
  };
}

export async function editorContractInputs(root) {
  const graph = await readEditorSourceGraph(root);
  const css = await readCssGraph(root, ['resources/css/page-builder-editor.css', 'resources/css/page-builder-public.css']);
  return [...new Set([...graph.files, ...css.files, ...EDITOR_CONTRACT_FILES])].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const flag = process.argv.indexOf('--root'), root = flag < 0 ? process.cwd() : process.argv[flag + 1];
  if (!root) throw new Error('--root is required');
  if (process.argv.includes('--inputs')) console.log(JSON.stringify(await editorContractInputs(root)));
  else {
    const graph = await readEditorSourceGraph(root);
    const owner = process.argv.indexOf('--owner'), call = process.argv.indexOf('--call-owner'), argument = process.argv.indexOf('--argument');
    console.log(process.argv.includes('--puck-owner') ? graph.jsxOwner('Puck', 'config', 'runtimePuckConfig')
      : owner >= 0 ? graph.owner(process.argv[owner + 1]) : call >= 0
      ? graph.callOwner(process.argv[call + 1], argument < 0 ? undefined : process.argv[argument + 1]) : graph.files.join('\n'));
  }
}
