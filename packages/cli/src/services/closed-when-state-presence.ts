import ts from 'typescript';
import { canKeepOmittedParameter } from './closed-rule-helpers.js';
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

// A primitive literal default cannot invoke authored code or alter a sibling
// State argument. The parameter whose identity/absence we capture still passes
// canKeepOmittedParameter, which rejects a default on that parameter itself.
const hasPassiveParameterFrame = (frame: ts.Node): boolean =>
  ts.isFunctionLike(frame) &&
  frame.parameters.every((part) => {
    if (!ts.isIdentifier(part.name) || part.dotDotDotToken) return false;
    if (!part.initializer) return true;
    const value = unwrap(part.initializer);
    return (
      ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword
    );
  });

/** Only these argument reads may authorize the later existence proof. Source
 * inference runs before the argument's effects, so a conditional/call that
 * changes a member and then reads it cannot certify the old captured State.
 * Follow stable const aliases too: moving such an expression into a const does
 * not make its earlier snapshot an actual argument value. */
export function canCaptureWhenStateArgument(
  argument: ts.Node,
  summary: HookSourceSummaryContext,
  sourceValues: (node: ts.Node) => readonly HookSourceValue[],
  capturedParameter: (parameter: ts.ParameterDeclaration) => boolean
): boolean {
  const seen = new Set<ts.VariableDeclaration>();
  const plainOwner = (node: ts.Node): boolean => {
    const values = sourceValues(node);
    return (
      values.length > 0 &&
      values.every(
        (value) =>
          value.kind === 'result' || (value.kind === 'object' && sourceMembersProven(value))
      )
    );
  };
  const read = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) {
      const declaration = summary.resolveStableSourceBinding(value);
      if (!declaration) return false;
      if (ts.isParameter(declaration))
        return (
          hasPassiveParameterFrame(declaration.parent) &&
          canKeepOmittedParameter(declaration, summary) &&
          capturedParameter(declaration)
        );
      if (!declaration.initializer || seen.has(declaration)) return false;
      seen.add(declaration);
      const admitted = read(declaration.initializer);
      seen.delete(declaration);
      return admitted;
    }
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
      if (value.questionDotToken) return false;
      const key = ts.isPropertyAccessExpression(value)
        ? value.name.text
        : ts.isStringLiteralLike(unwrap(value.argumentExpression))
          ? (unwrap(value.argumentExpression) as ts.StringLiteralLike).text
          : null;
      return (
        key !== null &&
        !(key in Object.prototype) &&
        read(value.expression) &&
        plainOwner(value.expression)
      );
    }
    if (ts.isCallExpression(value)) {
      const callee = unwrap(value.expression);
      if (ts.isIdentifier(callee) && value.arguments.length === 0)
        return summary.isAuthoredProducerCall(value, value.getSourceFile());
      // A captured native result supplies these own accessors only when the
      // corresponding State/child exists. An arbitrary method is not an accessor.
      if (!ts.isPropertyAccessExpression(callee) || value.arguments.length !== 1) return false;
      const key = unwrap(value.arguments[0]);
      if (!ts.isStringLiteralLike(key) || !read(callee.expression)) return false;
      const owners = sourceValues(callee.expression);
      return (
        owners.length > 0 &&
        owners.every(
          (owner) =>
            owner.kind === 'result' &&
            ((callee.name.text === 'getState' && owner.stateHandles.has(key.text)) ||
              (callee.name.text === 'getAsHookHandle' && owner.children.has(key.text)))
        )
      );
    }
    if (ts.isObjectLiteralExpression(value))
      return value.properties.every((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return read(property.name);
        if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
          return false;
        const key = property.name.text;
        return !(key in Object.prototype) && read(property.initializer);
      });
    return (
      ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword
    );
  };
  return read(argument);
}

/** Authorize only the new closed-condition branch selection. This does not
 * reinterpret a Rule without a ternary or confer any State/Def capability.
 * The complete returned expression must remain the actual synchronous builder
 * DSL; a receiver/default/getter prefix cannot borrow a literal predicate's
 * proof and disappear when that predicate selects a branch. */
export function canPruneClosedWhenCondition(
  conditional: ts.ConditionalExpression,
  callback: ts.Node,
  summary: HookSourceSummaryContext,
  readOnlyMember: (node: ts.Node) => boolean,
  allowFiniteArrayBranches = false
): boolean {
  const fn = unwrap(callback);
  if (
    !ts.isArrowFunction(fn) ||
    ts.isBlock(fn.body) ||
    fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
  )
    return false;
  const builder = fn.parameters[0];
  if (
    fn.parameters.length !== 1 ||
    !builder ||
    !ts.isIdentifier(builder.name) ||
    builder.initializer ||
    builder.dotDotDotToken
  )
    return false;
  // Helper replay does not generally execute default/destructuring parameter
  // effects. A closed literal predicate does not make that activation pure.
  const frame = ts.findAncestor(fn.parent, ts.isFunctionLike);
  if (frame && !hasPassiveParameterFrame(frame)) return false;
  const onBuilder = (node: ts.Node, names: readonly string[]): ts.CallExpression | null => {
    const value = unwrap(node);
    if (!ts.isCallExpression(value) || value.questionDotToken) return null;
    const callee = unwrap(value.expression);
    if (
      !ts.isPropertyAccessExpression(callee) ||
      callee.questionDotToken ||
      !names.includes(callee.name.text)
    )
      return null;
    const owner = unwrap(callee.expression);
    return ts.isIdentifier(owner) && summary.resolveStableSourceBinding(owner) === builder
      ? value
      : null;
  };
  const passive = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) return summary.resolveStableSourceBinding(value) !== builder;
    if (
      ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword
    )
      return true;
    if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken)
      return passive(value.operand);
    if (
      ts.isBinaryExpression(value) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(value.operatorToken.kind)
    )
      return passive(value.left) && passive(value.right);
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value))
      return readOnlyMember(value);
    return false;
  };
  let reachesConditional = false;
  const branch = (node: ts.ConditionalExpression, read: (value: ts.Node) => boolean): boolean => {
    if (node === conditional) reachesConditional = true;
    return passive(node.condition) && read(node.whenTrue) && read(node.whenFalse);
  };
  const finiteArray = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (ts.isConditionalExpression(value)) return branch(value, finiteArray);
    return ts.isArrayLiteralExpression(value) && value.elements.every(whenExpression);
  };
  const whenExpression = (node: ts.Node): boolean => {
    const value = unwrap(node);
    if (ts.isConditionalExpression(value)) return branch(value, whenExpression);
    const group = onBuilder(value, ['all', 'any', 'not']);
    if (group) {
      const member = (unwrap(group.expression) as ts.PropertyAccessExpression).name.text;
      return (
        (member !== 'not' || group.arguments.length === 1) &&
        group.arguments.every((argument) =>
          ts.isSpreadElement(argument)
            ? allowFiniteArrayBranches && finiteArray(argument.expression)
            : whenExpression(argument)
        )
      );
    }
    if (
      !ts.isCallExpression(value) ||
      value.questionDotToken ||
      value.arguments.length !== 1 ||
      !passive(value.arguments[0])
    )
      return false;
    const callee = unwrap(value.expression);
    if (
      !ts.isPropertyAccessExpression(callee) ||
      callee.questionDotToken ||
      callee.name.text !== 'eq'
    )
      return false;
    const subject = onBuilder(callee.expression, ['state', 'meta', 'prop']);
    return subject !== null && subject.arguments.length === 1 && passive(subject.arguments[0]);
  };
  return whenExpression(fn.body) && reachesConditional;
}

/** A State is an object even when its current value is false. This proves only
 * that one captured argument still denotes that object; it does not read the
 * State, add a variant, expose it, or confer an authored setup capability.
 *
 * Keep this proof inside ternaries returning the actual WhenBuilder's calls.
 * In particular it does not prune Rule registrations in statement branches or
 * expand optional arrays. An unknown object and a missing member remain unknown.
 */
export function closedWhenStatePresence(
  conditional: ts.ConditionalExpression,
  callback: ts.Node,
  summary: HookSourceSummaryContext,
  captured: (parameter: ts.ParameterDeclaration) => readonly HookSourceValue[] | null,
  versions: (value: HookSourceValue) => readonly HookSourceValue[]
): boolean | null {
  const sourcePathValues = (node: ts.Node): readonly HookSourceValue[] | null => {
    let value = unwrap(node);
    const keys: string[] = [];
    while (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
      if (value.questionDotToken) return null;
      const key = ts.isPropertyAccessExpression(value)
        ? value.name.text
        : ts.isStringLiteralLike(unwrap(value.argumentExpression))
          ? (unwrap(value.argumentExpression) as ts.StringLiteralLike).text
          : null;
      if (key === null || key in Object.prototype) return null;
      keys.unshift(key);
      value = unwrap(value.expression);
    }
    if (!ts.isIdentifier(value)) return null;
    const parameter = summary.resolveStableSourceBinding(value);
    if (
      !parameter ||
      !ts.isParameter(parameter) ||
      !hasPassiveParameterFrame(parameter.parent) ||
      !canKeepOmittedParameter(parameter, summary)
    )
      return null;
    let values = captured(parameter);
    if (!values?.length) return null;
    for (const key of keys) {
      const members: HookSourceValue[] = [];
      for (const held of values) {
        const current = versions(held);
        if (current.length === 0) return null;
        for (const owner of current) {
          if (owner.kind !== 'object' || !sourceMembersProven(owner)) return null;
          const member = owner.members.get(key);
          // A closed bag still has an ordinary object prototype. Missing a
          // key does not introduce a false-existence fact here.
          if (!member) return null;
          members.push(member);
        }
      }
      values = members;
    }
    const leaves: HookSourceValue[] = [];
    for (const held of values) {
      const current = versions(held);
      if (current.length === 0) return null;
      leaves.push(...current);
    }
    return leaves;
  };
  if (
    !canPruneClosedWhenCondition(
      conditional,
      callback,
      summary,
      (node) => sourcePathValues(node) !== null
    )
  )
    return null;

  let condition = unwrap(conditional.condition);
  let negated = false;
  while (
    ts.isPrefixUnaryExpression(condition) &&
    condition.operator === ts.SyntaxKind.ExclamationToken
  ) {
    negated = !negated;
    condition = unwrap(condition.operand);
  }
  const values = sourcePathValues(condition);
  return values?.length && values.every((value) => value.kind === 'state') ? !negated : null;
}
