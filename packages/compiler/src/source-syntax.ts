import ts from 'typescript';
import { reject } from './diagnostics';
import type { SourceSpan } from './ir';
import { sourceName } from './source-resolution';

// Syntax readers and static declarations share these helpers without loading SourceGraph.
// Keep this layer independent of parser-module and the semantic declaration readers.
export type FunctionNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

export function isSourceFunction(node: ts.Node): node is FunctionNode {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

/** Static object parameter patterns are invocation-local property snapshots. */
export function lowerObjectParameterPatterns(
  node: FunctionNode,
  fresh: () => string
): FunctionNode {
  if (!node.parameters.some((parameter) => !ts.isIdentifier(parameter.name))) return node;
  if (!node.body) rejectNode(node, 'PUI1004', 'A destructured parameter requires a function body.');
  // Moving a pattern into the body is equivalent only when no later parameter
  // default can observe it. Do not reorder default effects or approximate rest.
  if (node.parameters.some((parameter) => parameter.initializer || parameter.dotDotDotToken))
    rejectNode(node, 'PUI1004', 'Destructured parameters with defaults or rest are not admitted.');
  const f = ts.factory;
  const ranged = <T extends ts.Node>(value: T, from: ts.Node): T => ts.setTextRange(value, from);
  const declarations: ts.VariableDeclaration[] = [];
  const parameters = node.parameters.map((parameter) => {
    if (ts.isIdentifier(parameter.name)) return parameter;
    const pattern = parameter.name;
    if (!ts.isObjectBindingPattern(pattern) || parameter.questionToken)
      rejectNode(
        pattern,
        'PUI1004',
        'Only required static object parameter patterns are admitted.'
      );
    if (!pattern.elements.length)
      rejectNode(
        pattern,
        'PUI1004',
        'An empty parameter pattern requires an explicit object-coercibility lowering.'
      );
    const name = fresh();
    for (const element of pattern.elements) {
      if (element.dotDotDotToken || element.initializer || !ts.isIdentifier(element.name))
        rejectNode(
          element,
          'PUI1004',
          'Parameter patterns require simple fields without defaults or rest.'
        );
      const key = element.propertyName ?? element.name;
      if (!ts.isIdentifier(key) && !ts.isStringLiteral(key))
        rejectNode(key, 'PUI1004', 'A destructured parameter key must be a static name.');
      const read = f.createElementAccessExpression(
        ranged(f.createIdentifier(name), pattern),
        ranged(f.createStringLiteral(key.text), key)
      );
      declarations.push(
        ranged(
          f.createVariableDeclaration(element.name, undefined, undefined, ranged(read, element)),
          element
        )
      );
    }
    return f.updateParameterDeclaration(
      parameter,
      parameter.modifiers,
      undefined,
      ranged(f.createIdentifier(name), pattern),
      undefined,
      parameter.type,
      undefined
    );
  });
  const bindings = ranged(
    f.createVariableStatement(
      undefined,
      ranged(f.createVariableDeclarationList(declarations, ts.NodeFlags.Let), node)
    ),
    node
  );
  const body = ranged(
    f.createBlock(
      [
        bindings,
        ...(ts.isBlock(node.body)
          ? node.body.statements
          : [ranged(f.createReturnStatement(node.body), node.body)]),
      ],
      true
    ),
    node.body
  );
  const lowered = ts.isArrowFunction(node)
    ? f.updateArrowFunction(
        node,
        node.modifiers,
        node.typeParameters,
        parameters,
        node.type,
        node.equalsGreaterThanToken,
        body
      )
    : ts.isFunctionDeclaration(node)
      ? f.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          parameters,
          node.type,
          body
        )
      : ts.isFunctionExpression(node)
        ? f.updateFunctionExpression(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.typeParameters,
            parameters,
            node.type,
            body
          )
        : f.updateMethodDeclaration(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.questionToken,
            node.typeParameters,
            parameters,
            node.type,
            body
          );
  (lowered as { parent: ts.Node }).parent = node.parent;
  (
    ts as typeof ts & { setParentRecursive<T extends ts.Node>(node: T, incremental?: boolean): T }
  ).setParentRecursive(lowered, true);
  return lowered;
}

export function unwrapSourceExpression(node: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
    node = node.expression;
  return node;
}

/** Pure scalar initializers have no module-evaluation effects to execute or erase. */
export function scalarInitializer(node: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(node)) return scalarInitializer(node.expression);
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isPrefixUnaryExpression(node) &&
      (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
      ts.isNumericLiteral(node.operand))
  );
}

/**
 * Immutable finite data written with literal syntax: scalars, array and object
 * literals of such data, references to other module bindings, and a static
 * string array joined by a static separator. Admission is syntactic only; the
 * initializer is still parsed, typed and checked as finite data, and a
 * non-constant `join` is rejected where it is lowered. Nothing is executed at
 * module load beyond building the literal value.
 */
export function staticDataInitializer(
  node: ts.Expression,
  staticCall?: (node: ts.CallExpression) => boolean
): boolean {
  node = unwrapSourceExpression(node);
  if (scalarInitializer(node) || node.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isIdentifier(node)) return true;
  if (
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'Set' &&
    (node.arguments?.length ?? 0) <= 1 &&
    (!node.arguments?.length || staticDataInitializer(node.arguments[0], staticCall))
  )
    return true;
  if (ts.isArrayLiteralExpression(node))
    return node.elements.every((element) =>
      ts.isSpreadElement(element)
        ? ts.isIdentifier(element.expression)
        : staticDataInitializer(element, staticCall)
    );
  if (ts.isObjectLiteralExpression(node))
    return node.properties.every(
      (property) =>
        (ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name) ||
            ts.isNumericLiteral(property.name)) &&
          staticDataInitializer(property.initializer, staticCall)) ||
        (ts.isSpreadAssignment(property) && ts.isIdentifier(property.expression))
    );
  if (ts.isCallExpression(node)) {
    if (staticCall?.(node)) return true;
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Object' &&
      node.expression.name.text === 'freeze' &&
      node.arguments.length === 1
    )
      return staticDataInitializer(node.arguments[0], staticCall);
  }
  return staticJoin(node) !== undefined;
}

/** `<static array>.join(<string literal>)`: the receiver and separator nodes. */
export function staticJoin(
  node: ts.Expression
): { receiver: ts.Expression; separator: ts.StringLiteral | undefined } | undefined {
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== 'join' ||
    node.arguments.length > 1 ||
    (node.arguments.length === 1 && !ts.isStringLiteral(node.arguments[0]))
  )
    return undefined;
  const receiver = unwrapSourceExpression(node.expression.expression);
  if (!ts.isArrayLiteralExpression(receiver) && !ts.isIdentifier(receiver)) return undefined;
  return { receiver, separator: node.arguments[0] as ts.StringLiteral | undefined };
}

export function sourceSpan(node: ts.Node): SourceSpan {
  const file = node.getSourceFile();
  const start = node.getStart(file);
  const first = file.getLineAndCharacterOfPosition(start);
  const last = file.getLineAndCharacterOfPosition(node.end);
  return {
    file: sourceName(file.fileName),
    start,
    end: node.end,
    line: first.line + 1,
    column: first.character + 1,
    endLine: last.line + 1,
    endColumn: last.character + 1,
  };
}

export function rejectNode(node: ts.Node, code: string, message: string): never {
  return reject(code, message, sourceSpan(node));
}

export function identifier(node: ts.Node): string {
  if (!ts.isIdentifier(node) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(node.text))
    return rejectNode(node, 'PUI1004', 'Use a simple static identifier.');
  return node.text;
}

export function propertyName(node: ts.PropertyName): string {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return rejectNode(node, 'PUI1004', 'Computed/numeric property names are not admitted.');
}
