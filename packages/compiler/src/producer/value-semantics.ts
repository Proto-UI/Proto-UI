import ts from 'typescript';
import type { SourceRule } from './source.ts';

const foundation = (name: string) => `C-COMPILER-FOUNDATION-0001-${name}`;

/** Composite values are immutable and compared through the explicit equals operation. */
export const COMPOSITE_VALUE_RULE: SourceRule = Object.freeze({
  ruleId: 'proto/composite-value-semantics',
  criterion: Object.freeze([foundation('VALUES'), foundation('EQUALITY')]),
});

/** Mutable data that outlives a segment must be declared state. */
export const PERSISTENT_CAPTURE_RULE: SourceRule = Object.freeze({
  ruleId: 'proto/persistent-capture-state',
  criterion: Object.freeze([foundation('CAPTURES')]),
});

const ASSIGNMENTS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

export function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return ASSIGNMENTS.has(kind);
}

function written(node: ts.Node): ts.Expression | undefined {
  if (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind))
    return node.left;
  if (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return node.operand;
  }
  return undefined;
}

export function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isFunctionLike(current)) return current;
  }
  return undefined;
}

/**
 * Finds a write to a `let` declared in `scope` (a setup function or module) that happens
 * inside a nested function. Such a binding outlives the writing invocation and is
 * visible to later invocations, so CAPTURES requires declared state instead.
 */
export function persistentCaptureWrite(
  checker: ts.TypeChecker,
  statement: ts.VariableStatement,
  scope: ts.Node
): ts.Node | undefined {
  if (!(statement.declarationList.flags & ts.NodeFlags.Let)) return undefined;
  const symbols = new Set<ts.Symbol>();
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) continue;
    const symbol = checker.getSymbolAtLocation(declaration.name);
    if (symbol) symbols.add(symbol);
  }
  if (!symbols.size) return undefined;
  const owner = ts.isSourceFile(scope) ? undefined : scope;
  let found: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (found) return;
    const target = written(node);
    if (target && ts.isIdentifier(target)) {
      const symbol = checker.getSymbolAtLocation(target);
      if (symbol && symbols.has(symbol) && enclosingFunction(node) !== owner) {
        found = node;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

/** The definePrototype setup member is the declaration phase rather than an invocation. */
export function isSetupFunction(fn: ts.Node): boolean {
  if (ts.isMethodDeclaration(fn)) return ts.isIdentifier(fn.name) && fn.name.text === 'setup';
  const parent = fn.parent;
  return (
    !!parent &&
    ts.isPropertyAssignment(parent) &&
    ts.isIdentifier(parent.name) &&
    parent.name.text === 'setup'
  );
}

/** Composite data types: records, presence and tagged values (not text literals). */
export function isCompositeKind(kind: string | undefined): boolean {
  return kind === 'record' || kind === 'presence' || kind === 'tagged';
}
