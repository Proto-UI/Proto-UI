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
const dynamicParameterSources = new WeakMap<ts.SourceFile, boolean>();

/** Only an actual missing call argument can introduce this fact. A default,
 * rest/destructured binding or a write in any deferred closure can change it;
 * direct eval can write the lexical binding without an authored assignment.
 * External modules also exclude sloppy-mode arguments/parameter aliasing. */
export function canKeepOmittedParameter(
  parameter: ts.ParameterDeclaration,
  summary: HookSourceSummaryContext
): boolean {
  if (
    !ts.isIdentifier(parameter.name) ||
    parameter.initializer ||
    parameter.dotDotDotToken ||
    !ts.isExternalModule(parameter.getSourceFile()) ||
    summary.resolveStableSourceBinding(parameter.name) !== parameter
  )
    return false;
  const source = parameter.getSourceFile();
  let dynamic = dynamicParameterSources.get(source);
  if (dynamic === undefined) {
    dynamic = false;
    const visit = (node: ts.Node): void => {
      if (dynamic || ts.isTypeNode(node)) return;
      if (
        ts.isWithStatement(node) ||
        (ts.isCallExpression(node) &&
          ts.isIdentifier(unwrap(node.expression)) &&
          (unwrap(node.expression) as ts.Identifier).text === 'eval')
      ) {
        dynamic = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    dynamicParameterSources.set(source, dynamic);
  }
  return !dynamic;
}

/** Truthiness of a captured omission, bound to this exact lexical parameter.
 * A same-spelled callback parameter must not borrow its caller's absence. */
export function omittedParameterConditionOutcome(
  node: ts.Node,
  summary: HookSourceSummaryContext,
  captured: (name: string) => ts.Node | undefined
): boolean | null {
  const value = unwrap(node);
  if (ts.isIdentifier(value)) {
    const parameter = captured(value.text);
    return parameter &&
      ts.isParameter(parameter) &&
      summary.resolveStableSourceBinding(value) === parameter
      ? false
      : null;
  }
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
    const result = omittedParameterConditionOutcome(value.operand, summary, captured);
    return result === null ? null : !result;
  }
  return null;
}

/** A primitive captured by value, never a State, object or function capability. */
export type ClosedRuleScalar = Readonly<{
  value: string | number | boolean | null | undefined;
}>;

/** Resolve only passive scalar expressions with an immutable lexical binding.
 * A captured parameter belongs to this exact invocation and lexical binding;
 * a type annotation or a same-spelled outer name cannot supply that value.
 * Unknown calls, members, coercive comparisons and writes remain unresolved. */
export function closedRuleScalarValue(
  node: ts.Node,
  summary: HookSourceSummaryContext | null | undefined,
  captured: (declaration: ts.ParameterDeclaration) => ClosedRuleScalar | null
): ClosedRuleScalar | null {
  const read = (expression: ts.Node, active: ReadonlySet<ts.Node>): ClosedRuleScalar | null => {
    if (active.size >= 32) return null;
    const value = unwrap(expression);
    if (value.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
    if (value.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
    if (value.kind === ts.SyntaxKind.NullKeyword) return { value: null };
    if (ts.isStringLiteralLike(value)) return { value: value.text };
    if (ts.isNumericLiteral(value)) {
      const number = Number(value.text);
      return Number.isFinite(number) ? { value: number } : null;
    }
    if (ts.isIdentifier(value)) {
      if (!summary) return null;
      const declaration = summary.resolveStableSourceBinding(value);
      if (!declaration || !ts.isIdentifier(declaration.name) || active.has(declaration))
        return null;
      if (ts.isParameter(declaration))
        return canKeepOmittedParameter(declaration, summary) ? captured(declaration) : null;
      // Imported or not-yet-initialized bindings need an execution-order proof.
      // This slice only follows earlier const initializers in the same source.
      if (
        declaration.getSourceFile() !== value.getSourceFile() ||
        declaration.end >= value.getStart()
      )
        return null;
      const next = new Set(active).add(declaration);
      if (declaration.initializer) return read(declaration.initializer, next);
      // Loop induction bindings need their own identity/write proof. Do not
      // turn an initializer-free declaration into a stable scalar here.
      return null;
    }
    if (ts.isPrefixUnaryExpression(value)) {
      const operand = read(value.operand, active);
      if (!operand) return null;
      if (value.operator === ts.SyntaxKind.ExclamationToken) return { value: !operand.value };
      if (typeof operand.value !== 'number') return null;
      if (value.operator === ts.SyntaxKind.MinusToken) return { value: -operand.value };
      if (value.operator === ts.SyntaxKind.PlusToken) return operand;
      return null;
    }
    if (ts.isConditionalExpression(value)) {
      const condition = read(value.condition, active);
      return condition ? read(condition.value ? value.whenTrue : value.whenFalse, active) : null;
    }
    if (!ts.isBinaryExpression(value)) return null;
    const left = read(value.left, active);
    if (!left) return null;
    const operator = value.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken)
      return left.value ? read(value.right, active) : left;
    if (operator === ts.SyntaxKind.BarBarToken)
      return left.value ? left : read(value.right, active);
    if (operator === ts.SyntaxKind.QuestionQuestionToken)
      return left.value === null || left.value === undefined ? read(value.right, active) : left;
    if (
      operator !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
      operator !== ts.SyntaxKind.ExclamationEqualsEqualsToken
    )
      return null;
    const right = read(value.right, active);
    if (!right) return null;
    return {
      value:
        operator === ts.SyntaxKind.EqualsEqualsEqualsToken
          ? left.value === right.value
          : left.value !== right.value,
    };
  };
  return read(node, new Set());
}

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
