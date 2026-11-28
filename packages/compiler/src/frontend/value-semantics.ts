import ts from 'typescript';

const foundation = (name: string) => `C-COMPILER-FOUNDATION-0001-${name}`;

/** A language rule shared by frontend analysis and producer admission. */
export interface ValueRule {
  readonly ruleId: string;
  readonly criterion: readonly string[];
}

/** Composite values are immutable and compared through the explicit equals operation. */
export const COMPOSITE_VALUE_RULE: ValueRule = Object.freeze({
  ruleId: 'proto/composite-value-semantics',
  criterion: Object.freeze([foundation('VALUES'), foundation('EQUALITY')]),
});

/** Mutable data that outlives a segment must be declared state. */
export const PERSISTENT_CAPTURE_RULE: ValueRule = Object.freeze({
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

/** The expression a node assigns, increments or decrements, if any. */
export function writtenTarget(node: ts.Node): ts.Expression | undefined {
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
    const target = writtenTarget(node);
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

/** A member or element written by assignment, ++/-- or delete. */
export function mutatedMember(node: ts.Node): ts.Expression | undefined {
  const target = ts.isDeleteExpression(node) ? node.expression : writtenTarget(node);
  if (!target) return undefined;
  let inner = target;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return ts.isPropertyAccessExpression(inner) || ts.isElementAccessExpression(inner)
    ? inner
    : undefined;
}

/** The scope whose `let` bindings outlive an invocation: the module or a setup function. */
export function persistentScope(statement: ts.VariableStatement): ts.Node | undefined {
  const owner = enclosingFunction(statement);
  if (owner === undefined) return statement.getSourceFile();
  return isSetupFunction(owner) ? owner : undefined;
}

/** True when the type is, or may be, an object value other than an authoring handle. */
export function compositeOperand(
  type: ts.Type,
  handle: (constituent: ts.Type) => boolean
): boolean {
  const constituents = type.isUnion() ? type.types : [type];
  return constituents.some(
    (constituent) => (constituent.flags & ts.TypeFlags.Object) !== 0 && !handle(constituent)
  );
}
