import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Compare syntax, not lines or filenames. Keep every value import, expression,
// declaration and JSX node. Even all-type mixed imports retain their module:
// with verbatimModuleSyntax, `import { type A }` can emit a side-effect import.
function withoutTypeImports(source, filename) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw new Error('Invalid TypeScript syntax');
  const statements = file.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) return [];
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        return [ts.factory.updateImportDeclaration(statement, statement.modifiers,
          ts.factory.updateImportClause(clause, false, clause.name,
            ts.factory.updateNamedImports(clause.namedBindings,
              clause.namedBindings.elements.filter((element) => !element.isTypeOnly))),
          statement.moduleSpecifier, statement.attributes)];
      }
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) return [];
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        return [ts.factory.updateExportDeclaration(statement, statement.modifiers, false,
          ts.factory.updateNamedExports(statement.exportClause,
            statement.exportClause.elements.filter((element) => !element.isTypeOnly)),
          statement.moduleSpecifier, statement.attributes)];
      }
    }
    return [statement];
  });
  // Compiler directives in comments can affect emitted code. Retain a separate
  // comment sequence, including comments attached to erased import statements.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  const comments = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      comments.push(scanner.getTokenText());
    }
  }
  return JSON.stringify([ts.isExternalModule(file), comments, ts.createPrinter({ removeComments: false }).printFile(
    ts.factory.updateSourceFile(file, statements))]);
}

const pairs = JSON.parse(readFileSync(0, 'utf8'));
const unchanged = [];
for (const { path, before, after } of pairs) {
  try {
    if (before !== after && withoutTypeImports(before, path) === withoutTypeImports(after, path)) unchanged.push(path);
  } catch {
    // Uncertain inputs retain their existing browser mapping.
  }
}
process.stdout.write(JSON.stringify(unchanged));
