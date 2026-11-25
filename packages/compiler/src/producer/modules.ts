import ts from 'typescript';
import type { SourceContext } from './source.ts';
import { unalias } from './source.ts';

function unwrap(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression) || ts.isSatisfiesExpression(expression))
    expression = expression.expression;
  return expression;
}

/** Module evaluation precedes instance creation. An unproved initializer in a
 * reached dependency cannot be elided just because the selected export was found. */
function checkInitializer(
  context: SourceContext,
  value: ts.Expression,
  ready: ReadonlySet<ts.Declaration>
): void {
  const node = unwrap(value);
  if (ts.isIdentifier(node)) {
    const target = context.symbol(node).valueDeclaration;
    if (
      target &&
      !target.getSourceFile().isDeclarationFile &&
      (ts.isVariableDeclaration(target) || ts.isExportAssignment(target)) &&
      !ready.has(target)
    ) {
      context.missing(
        node,
        'producer/module-initialization-order',
        'An eager module read precedes initialization of its resolved binding.'
      );
    }
    return;
  }
  if (
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  )
    return;
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
    (ts.isNumericLiteral(node.operand) ||
      context.intrinsic(node.operand, 'Infinity') ||
      context.intrinsic(node.operand, 'NaN'))
  )
    return;
  if (ts.isObjectLiteralExpression(node)) {
    for (const member of node.properties) {
      if (ts.isShorthandPropertyAssignment(member) && !member.objectAssignmentInitializer) {
        checkInitializer(context, member.name, ready);
        continue;
      }
      if (ts.isMethodDeclaration(member) && !ts.isComputedPropertyName(member.name)) continue;
      if (!ts.isPropertyAssignment(member) || ts.isComputedPropertyName(member.name)) {
        context.missing(
          member,
          'producer/module-member',
          'Module initialization needs a proof for this object member.'
        );
      }
      checkInitializer(context, member.initializer, ready);
    }
    return;
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) checkInitializer(context, element, ready);
    return;
  }
  if (
    ts.isCallExpression(node) &&
    ['definePrototype', 'createContextKey', 'declareExtern', 'tw'].some((name) =>
      context.intrinsic(node.expression, name)
    )
  ) {
    if (ts.isIdentifier(node.expression)) checkInitializer(context, node.expression, ready);
    for (const argument of node.arguments) checkInitializer(context, argument, ready);
    return;
  }
  context.missing(
    node,
    'producer/module-initializer',
    'The producer needs the evaluation effects of this module initializer before it can emit the component.'
  );
}

function checkModule(
  context: SourceContext,
  file: ts.SourceFile,
  ready: Set<ts.Declaration>
): void {
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement)
    )
      continue;
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) continue;
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      checkInitializer(context, statement.expression, ready);
      ready.add(statement);
      continue;
    }
    if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          context.missing(
            declaration,
            'producer/module-binding',
            'Binding this module declaration requires additional initialization coverage.'
          );
        }
        checkInitializer(context, declaration.initializer, ready);
        ready.add(declaration);
      }
      continue;
    }
    context.missing(
      statement,
      'producer/module-effects',
      'This reached module statement needs its effects represented before emission.'
    );
  }
}

export function checkModuleClosure(
  context: SourceContext,
  entry: ts.SourceFile,
  authoring: ts.SourceFile
): void {
  const files = new Set<ts.SourceFile>();
  const ready = new Set<ts.Declaration>();
  function visit(file: ts.SourceFile): void {
    if (files.has(file)) return;
    files.add(file);
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (
        !statement.moduleSpecifier ||
        (ts.isImportDeclaration(statement)
          ? statement.importClause?.isTypeOnly
          : statement.isTypeOnly)
      )
        continue;
      const clause = ts.isImportDeclaration(statement)
        ? statement.importClause?.namedBindings
        : statement.exportClause;
      if (
        clause &&
        (ts.isNamedImports(clause) || ts.isNamedExports(clause)) &&
        clause.elements.length &&
        clause.elements.every((item) => item.isTypeOnly) &&
        !(ts.isImportDeclaration(statement) && statement.importClause?.name)
      )
        continue;
      const module = context.checker.getSymbolAtLocation(statement.moduleSpecifier);
      const dependency = module?.declarations?.find(ts.isSourceFile);
      if (dependency === authoring) continue;
      if (!dependency || dependency.isDeclarationFile) {
        context.missing(
          statement.moduleSpecifier,
          'producer/external-module-effects',
          'A value import needs its source module or a declared and bound atomic operation.'
        );
      }
      visit(dependency);
    }
    checkModule(context, file, ready);
  }
  visit(entry);
}

export function componentExport(
  context: SourceContext,
  file: ts.SourceFile,
  name: string
): ts.CallExpression {
  const module = context.checker.getSymbolAtLocation(file);
  const exported =
    module && context.checker.getExportsOfModule(module).find((item) => item.name === name);
  if (!exported)
    context.missing(
      file,
      'producer/entry-export',
      `The requested export ${JSON.stringify(name)} is unavailable.`
    );
  let symbol = unalias(context.checker, exported);
  const visited = new Set<ts.Symbol>();
  while (!visited.has(symbol)) {
    visited.add(symbol);
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!declaration) break;
    const value = ts.isExportAssignment(declaration)
      ? declaration.expression
      : ts.isVariableDeclaration(declaration) &&
          ts.isVariableDeclarationList(declaration.parent) &&
          declaration.parent.flags & ts.NodeFlags.Const
        ? declaration.initializer
        : undefined;
    if (!value) break;
    const expression = unwrap(value);
    if (
      ts.isCallExpression(expression) &&
      context.intrinsic(expression.expression, 'definePrototype')
    )
      return expression;
    if (!ts.isIdentifier(expression)) {
      context.missing(
        expression,
        'producer/entry-prototype',
        'This export has no proved binding to the authoring prototype declaration.'
      );
    }
    symbol = context.symbol(expression);
  }
  return context.missing(
    file,
    'producer/entry-origin',
    `The producer could not establish the prototype origin of export ${JSON.stringify(name)}.`
  );
}
