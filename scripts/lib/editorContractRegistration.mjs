import ts from 'typescript';

/** Registration evidence only. Browser execution is selected by the Python plan. */
export function validateEditorTestRegistration(source, filename) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const aliases = new Set();
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== '@playwright/test') continue;
    const imports = statement.importClause?.namedBindings;
    if (imports && ts.isNamedImports(imports)) {
      for (const item of imports.elements) if ((item.propertyName ?? item.name).text === 'test') aliases.add(item.name.text);
    }
  }
  let registrations = 0;
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && aliases.has(node.expression.text)
      && node.arguments.length >= 2 && (ts.isArrowFunction(node.arguments[1]) || ts.isFunctionExpression(node.arguments[1]))) registrations += 1;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return registrations > 0 ? [] : [`${filename}: 실행 가능한 Playwright test 등록이 필요합니다. (브라우저 실행 증거와 별도)`];
}

/** Public commands may not hide additional gates in the focused unit entry. */
export function validateFocusedUnitCommand(scripts) {
  if (scripts['test:unit'] !== 'vitest run' || scripts['pretest:unit'] || scripts['posttest:unit']) {
    return ['test:unit는 선택한 Vitest만 실행해야 하며 추가 검사는 Python 계획에서 선택해야 합니다.'];
  }
  return [];
}
