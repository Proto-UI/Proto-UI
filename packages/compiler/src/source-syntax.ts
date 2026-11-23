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
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration;

export function isSourceFunction(node: ts.Node): node is FunctionNode {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node)
  );
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

/** A literal-only membership expression has no source calls, getters or coercion. */
export function staticScalarMembership(node: ts.Expression): boolean | undefined {
  node = unwrapSourceExpression(node);
  if (
    !ts.isCallExpression(node) ||
    node.questionDotToken ||
    node.typeArguments?.length ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.questionDotToken ||
    node.expression.name.text !== 'includes' ||
    node.arguments.length !== 1
  )
    return undefined;
  const receiver = unwrapSourceExpression(node.expression.expression);
  if (!ts.isArrayLiteralExpression(receiver)) return undefined;
  const scalar = (value: ts.Expression): string | number | boolean | null | undefined => {
    value = unwrapSourceExpression(value);
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
    if (ts.isNumericLiteral(value)) {
      const number = Number(value.text);
      return Number.isFinite(number) ? number : undefined;
    }
    if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (value.kind === ts.SyntaxKind.NullKeyword) return null;
    if (
      ts.isPrefixUnaryExpression(value) &&
      (value.operator === ts.SyntaxKind.PlusToken || value.operator === ts.SyntaxKind.MinusToken) &&
      ts.isNumericLiteral(value.operand)
    ) {
      const number =
        Number(value.operand.text) * (value.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
      return Number.isFinite(number) ? number : undefined;
    }
    return undefined;
  };
  const search = scalar(node.arguments[0]);
  const elements = receiver.elements.map(scalar);
  if (search === undefined || elements.some((value) => value === undefined)) return undefined;
  // Every admitted number is finite. Equality therefore implements SameValueZero,
  // including +0/-0, without evaluating any input code or coercing an operand.
  return elements.some((value) => value === search);
}

/** A checked immutable module selection, not an arbitrary top-level expression. */
export function staticCallableSelection(node: ts.Node): node is ts.ConditionalExpression {
  if (!ts.isConditionalExpression(node)) return false;
  const leaf = (value: ts.Expression): boolean => ts.isIdentifier(unwrapSourceExpression(value));
  const condition = unwrapSourceExpression(node.condition);
  return (
    (ts.isIdentifier(condition) ||
      condition.kind === ts.SyntaxKind.TrueKeyword ||
      condition.kind === ts.SyntaxKind.FalseKeyword ||
      staticScalarMembership(condition) !== undefined) &&
    leaf(node.whenTrue) &&
    leaf(node.whenFalse)
  );
}

/** Creating a literal getter object is inert; reads later execute its real body. */
export function staticGetterRecordInitializer(node: ts.Expression): boolean {
  node = unwrapSourceExpression(node);
  return (
    ts.isObjectLiteralExpression(node) &&
    node.properties.some(ts.isGetAccessorDeclaration) &&
    node.properties.every(
      (property) =>
        (ts.isGetAccessorDeclaration(property) &&
          property.parameters.length === 0 &&
          !!property.body &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) ||
        (ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
          staticDataInitializer(property.initializer))
    )
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
export function staticDataInitializer(node: ts.Expression): boolean {
  node = unwrapSourceExpression(node);
  if (scalarInitializer(node) || node.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isTemplateExpression(node))
    return node.templateSpans.every((span) => staticDataInitializer(span.expression));
  if (ts.isIdentifier(node)) return true;
  if (ts.isArrayLiteralExpression(node))
    return node.elements.every((element) =>
      ts.isSpreadElement(element)
        ? ts.isIdentifier(element.expression)
        : staticDataInitializer(element)
    );
  if (ts.isObjectLiteralExpression(node))
    return node.properties.every(
      (property) =>
        (ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name) ||
            ts.isNumericLiteral(property.name)) &&
          staticDataInitializer(property.initializer)) ||
        (ts.isSpreadAssignment(property) && ts.isIdentifier(property.expression))
    );
  return staticJoin(node) !== undefined || staticScalarMembership(node) !== undefined;
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
