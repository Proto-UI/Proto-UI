import ts from 'typescript';
import {
  sourceMembersProven,
  type HookSourceSummaryContext,
  type HookSourceValue,
} from './hook-source-summary.js';

const unwrap = (node: ts.Node): ts.Node =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isTypeAssertionExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node;

const ruleRegistrationCache = new WeakMap<ts.FunctionLikeDeclaration, boolean>();

/**
 * Whether a function registers a rule. Only such a function carries rule
 * conditions, so only such a function is worth reading at its call sites.
 *
 * The answer is syntax, not proof: it says the body names the rule API, not
 * that the registration runs.
 */
export function registersRule(fn: ts.FunctionLikeDeclaration): boolean {
  const cached = ruleRegistrationCache.get(fn);
  if (cached !== undefined) return cached;
  let found = false;
  const contains = (node: ts.Node): boolean => {
    if (ts.isTypeNode(node)) return false;
    if (ts.isCallExpression(node)) {
      const target = unwrap(node.expression);
      if (
        (ts.isPropertyAccessExpression(target) && target.name.text === 'rule') ||
        (ts.isElementAccessExpression(target) &&
          ts.isStringLiteralLike(target.argumentExpression) &&
          target.argumentExpression.text === 'rule')
      )
        return true;
    }
    return ts.forEachChild(node, contains) === true;
  };
  found = contains(fn.body ?? fn);
  ruleRegistrationCache.set(fn, found);
  return found;
}

/** The scanner captures an argument before visiting its effects. Only this
 * bounded data-expression slice can be read at that point: a nested write or
 * opaque call may change a later member read within the very same argument.
 * Such an argument must stay unknown, not capture that member's old value.
 * The caller still visits every argument once, in order. */
export function helperArgumentBeforeVisit(
  argument: ts.Expression,
  summary: HookSourceSummaryContext,
  sourceValues: (node: ts.Node) => readonly HookSourceValue[]
): ts.Expression | null {
  const atom = (node: ts.Node): boolean =>
    ts.isIdentifier(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword;
  // Reading an unknown identifier and testing its truthiness runs no user
  // code. A member read may invoke an unknown getter, so it is not a test
  // whose effects can be omitted while resolving the two branches.
  const passiveTest = (node: ts.Node): boolean => {
    const value = unwrap(node);
    return (
      atom(value) ||
      (ts.isPrefixUnaryExpression(value) &&
        value.operator === ts.SyntaxKind.ExclamationToken &&
        passiveTest(value.operand))
    );
  };
  const plainMembers = (node: ts.Node): boolean => {
    const values = sourceValues(node);
    return (
      values.length > 0 &&
      values.every((value) => value.kind === 'result' || sourceMembersProven(value))
    );
  };
  const producerReference = (node: ts.Node): boolean => {
    const value = unwrap(node);
    return (
      ts.isIdentifier(value) ||
      (ts.isPropertyAccessExpression(value) && producerReference(value.expression)) ||
      (ts.isElementAccessExpression(value) &&
        ts.isStringLiteralLike(unwrap(value.argumentExpression)) &&
        producerReference(value.expression))
    );
  };
  const data = (node: ts.Node, allowProducer: boolean): boolean => {
    const value = unwrap(node);
    if (atom(value)) return true;
    if (ts.isPropertyAccessExpression(value))
      return data(value.expression, allowProducer) && plainMembers(value.expression);
    if (ts.isElementAccessExpression(value))
      return (
        (ts.isStringLiteralLike(unwrap(value.argumentExpression)) ||
          ts.isNumericLiteral(unwrap(value.argumentExpression))) &&
        data(value.expression, allowProducer) &&
        plainMembers(value.expression)
      );
    if (ts.isCallExpression(value))
      return (
        allowProducer &&
        producerReference(value.expression) &&
        summary.isAuthoredProducerCall(value, value.getSourceFile()) &&
        value.arguments.every((part) => data(part, false))
      );
    if (ts.isConditionalExpression(value))
      return (
        passiveTest(value.condition) && data(value.whenTrue, false) && data(value.whenFalse, false)
      );
    if (ts.isObjectLiteralExpression(value))
      return value.properties.every((part) => {
        if (ts.isSpreadAssignment(part))
          return data(part.expression, false) && plainMembers(part.expression);
        if (ts.isShorthandPropertyAssignment(part)) return !part.objectAssignmentInitializer;
        if (!ts.isPropertyAssignment(part)) return false;
        if (
          ts.isComputedPropertyName(part.name) &&
          !ts.isStringLiteralLike(unwrap(part.name.expression)) &&
          !ts.isNumericLiteral(unwrap(part.name.expression))
        )
          return false;
        return data(part.initializer, false);
      });
    if (ts.isArrayLiteralExpression(value))
      return value.elements.every((part) =>
        ts.isOmittedExpression(part) ? true : !ts.isSpreadElement(part) && data(part, false)
      );
    return false;
  };
  const value = unwrap(argument);
  // Assigning a plain lexical name evaluates and returns its RHS unchanged.
  // A member target may execute accessors while evaluating the target or
  // performing the write, so it is deliberately outside this slice.
  const captured =
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isIdentifier(unwrap(value.left))
      ? value.right
      : value;
  return data(captured, true) ? (captured as ts.Expression) : null;
}

/** A deliberately closed first slice: private same-file function declarations,
 * used only by direct calls in source-proven Core setup functions. The call
 * arguments are not proved here; the scanner captures them when each call is
 * visited. Export, escape, reassignment, spread, recursion and unknown callers
 * keep the original independent declaration scan. */
export function closedLocalRuleHelpers(
  source: ts.SourceFile,
  summary: HookSourceSummaryContext
): ReadonlySet<ts.FunctionDeclaration> {
  const candidates: ts.FunctionDeclaration[] = [];
  let dynamicScope = false;
  const containsRule = (node: ts.Node): boolean => {
    if (ts.isTypeNode(node)) return false;
    if (ts.isCallExpression(node)) {
      const target = unwrap(node.expression);
      if (
        (ts.isPropertyAccessExpression(target) && target.name.text === 'rule') ||
        (ts.isElementAccessExpression(target) &&
          ts.isStringLiteralLike(target.argumentExpression) &&
          target.argumentExpression.text === 'rule')
      )
        return true;
    }
    return ts.forEachChild(node, (child) => containsRule(child) || undefined) === true;
  };
  const collect = (node: ts.Node): void => {
    if (ts.isTypeNode(node)) return;
    if (
      ts.isWithStatement(node) ||
      (ts.isCallExpression(node) &&
        ts.isIdentifier(unwrap(node.expression)) &&
        (unwrap(node.expression) as ts.Identifier).text === 'eval')
    )
      dynamicScope = true;
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.body &&
      containsRule(node.body) &&
      !node.asteriskToken &&
      !node.modifiers?.some((modifier) =>
        [
          ts.SyntaxKind.ExportKeyword,
          ts.SyntaxKind.DefaultKeyword,
          ts.SyntaxKind.AsyncKeyword,
        ].includes(modifier.kind)
      ) &&
      node.parameters.every(
        (parameter) =>
          ts.isIdentifier(parameter.name) && !parameter.initializer && !parameter.dotDotDotToken
      ) &&
      summary.resolveSourceFunction(node.name, source) === node &&
      !summary.isAuthoredSetup(node, source)
    )
      candidates.push(node);
    ts.forEachChild(node, collect);
  };
  collect(source);
  if (dynamicScope || candidates.length === 0) return new Set();

  // Closed references do not freeze an authored caller's public definition.
  // Without this exact source graph's lifetime proof, keep every original
  // declaration scan; argument replay must not erase the independent gap.
  const lifetime = summary.proveSourceProducerLifetimes(source);
  if (!lifetime || lifetime.source !== source) return new Set();

  const result = new Set<ts.FunctionDeclaration>();
  for (const candidate of candidates) {
    let calls = 0;
    let closed = true;
    const inspect = (node: ts.Node): void => {
      if (!closed || ts.isTypeNode(node)) return;
      if (ts.isIdentifier(node) && node.text === candidate.name!.text && node !== candidate.name) {
        const parent = node.parent;
        // Property labels do not read the identifier's lexical binding.
        if (
          (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
          (ts.isPropertyAssignment(parent) && parent.name === node) ||
          (ts.isMethodDeclaration(parent) && parent.name === node)
        )
          return;
        if (summary.resolveSourceFunction(node, source) === candidate) {
          let reference: ts.Node = node;
          while (reference.parent && unwrap(reference.parent) === node)
            reference = reference.parent;
          const call = reference.parent;
          const owner = ts.findAncestor(node, ts.isFunctionLike);
          if (
            !call ||
            !ts.isCallExpression(call) ||
            call.expression !== reference ||
            call.arguments.some(ts.isSpreadElement) ||
            call.arguments.length !== candidate.parameters.length ||
            call.getStart(source) <= candidate.end ||
            !owner ||
            !summary.isAuthoredSetup(owner, source)
          ) {
            closed = false;
            return;
          }
          calls++;
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source);
    if (closed && calls > 0) result.add(candidate);
  }
  return result;
}
