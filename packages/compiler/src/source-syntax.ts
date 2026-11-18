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
