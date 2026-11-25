import ts from 'typescript';
import type { ActionStatementIR, ScalarLiteral, ValueExprIR } from '../ir/types';
import { resolveFunctionLike, unwrapExpr } from './syntax';
import { atExecutionPoint, type InitializationPoints } from './bindings';

export interface ActionBindings {
  readonly states: ReadonlyMap<ts.Symbol, string>;
  readonly checker: ts.TypeChecker;
  readonly runParameter?: string;
  readonly propParameters?: ReadonlyMap<string, 'current' | 'previous'>;
  readonly constant: (
    expression: ts.Expression,
    points?: InitializationPoints
  ) => ScalarLiteral | undefined;
  readonly initializationPoints?: InitializationPoints;
}

export type ActionLowering =
  | { readonly ok: true; readonly body: readonly ActionStatementIR[] }
  | { readonly ok: false; readonly node: ts.Node; readonly message: string };

const binaryOperators = new Map<
  ts.SyntaxKind,
  Extract<ValueExprIR, { kind: 'binary' }>['operator']
>([
  [ts.SyntaxKind.PlusToken, '+'],
  [ts.SyntaxKind.MinusToken, '-'],
  [ts.SyntaxKind.AsteriskToken, '*'],
  [ts.SyntaxKind.SlashToken, '/'],
  [ts.SyntaxKind.PercentToken, '%'],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, '==='],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, '!=='],
  [ts.SyntaxKind.LessThanToken, '<'],
  [ts.SyntaxKind.LessThanEqualsToken, '<='],
  [ts.SyntaxKind.GreaterThanToken, '>'],
  [ts.SyntaxKind.GreaterThanEqualsToken, '>='],
  [ts.SyntaxKind.AmpersandAmpersandToken, '&&'],
  [ts.SyntaxKind.BarBarToken, '||'],
  [ts.SyntaxKind.QuestionQuestionToken, '??'],
]);

interface ActionScope {
  readonly locals: Map<ts.Symbol, string>;
  readonly props: Map<ts.Symbol, 'current' | 'previous'>;
  readonly runs: Set<ts.Symbol>;
  readonly states: Map<ts.Symbol, string>;
  readonly initializationPoints: InitializationPoints;
}

function childScope(parent: ActionScope): ActionScope {
  return {
    locals: new Map(parent.locals),
    props: new Map(parent.props),
    runs: new Set(parent.runs),
    states: new Map(parent.states),
    initializationPoints: parent.initializationPoints,
  };
}

/** Lower callback control flow and ordinary helper calls without copying executable source. */
export function lowerActionBody(
  fn: ts.FunctionLikeDeclaration,
  bindings: ActionBindings
): ActionLowering {
  if (!fn.body) return { ok: false, node: fn, message: 'Callback has no implementation body.' };
  const unsupportedParameter = fn.parameters.find(
    (parameter) =>
      !ts.isIdentifier(parameter.name) || parameter.dotDotDotToken || parameter.initializer
  );
  if (unsupportedParameter)
    return {
      ok: false,
      node: unsupportedParameter,
      message:
        'Callback parameter defaults, destructuring and rest require explicit argument semantics.',
    };
  if (
    fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
    fn.asteriskToken
  )
    return {
      ok: false,
      node: fn,
      message: 'Asynchronous and generator callbacks require separate action semantics.',
    };
  let failure: { node: ts.Node; message: string } | undefined;
  let nextLocal = 0;
  let budget = 4096;
  const active = new Set<ts.FunctionLikeDeclaration>();
  const reject = (node: ts.Node, message: string): undefined => {
    failure ??= { node, message };
    return undefined;
  };
  const symbol = (node: ts.Node): ts.Symbol | undefined =>
    bindings.checker.getSymbolAtLocation(node);
  const propsSource = (
    raw: ts.Expression,
    scope: ActionScope
  ): 'current' | 'previous' | undefined => {
    const expression = unwrapExpr(raw);
    if (ts.isIdentifier(expression)) return scope.props.get(symbol(expression)!);
    if (
      !ts.isCallExpression(expression) ||
      expression.arguments.length ||
      !ts.isPropertyAccessExpression(expression.expression) ||
      expression.expression.name.text !== 'get'
    )
      return undefined;
    const props = unwrapExpr(expression.expression.expression);
    if (
      ts.isPropertyAccessExpression(props) &&
      props.name.text === 'props' &&
      ts.isIdentifier(props.expression) &&
      scope.runs.has(symbol(props.expression)!)
    )
      return 'current';
    return undefined;
  };
  const value = (expression: ts.Expression, scope: ActionScope): ValueExprIR | undefined => {
    if (--budget < 0)
      return reject(expression, 'Action expansion exceeded its finite lowering budget.');
    const expr = unwrapExpr(expression);
    if (ts.isIdentifier(expr) && scope.locals.has(symbol(expr)!))
      return { kind: 'local', name: scope.locals.get(symbol(expr)!)! };
    if (ts.isPropertyAccessExpression(expr)) {
      const source = propsSource(expr.expression, scope);
      if (source) return { kind: 'prop', name: expr.name.text, source };
    }
    if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
      const recv = unwrapExpr(expr.expression.expression);
      if (
        ts.isIdentifier(recv) &&
        expr.expression.name.text === 'get' &&
        expr.arguments.length === 0
      ) {
        const state = scope.states.get(symbol(recv)!);
        if (state !== undefined) return { kind: 'state', name: state };
      }
    }
    if (ts.isPrefixUnaryExpression(expr)) {
      const operator =
        expr.operator === ts.SyntaxKind.ExclamationToken
          ? '!'
          : expr.operator === ts.SyntaxKind.MinusToken
            ? '-'
            : expr.operator === ts.SyntaxKind.PlusToken
              ? '+'
              : undefined;
      const operand = operator ? value(expr.operand, scope) : undefined;
      if (operator && operand) return { kind: 'unary', operator, operand };
      return reject(expr, 'Unsupported unary action expression.');
    }
    if (ts.isBinaryExpression(expr)) {
      const operator = binaryOperators.get(expr.operatorToken.kind);
      if (!operator)
        return reject(
          expr,
          'Unsupported action operator; source coercion is not silently changed.'
        );
      const left = value(expr.left, scope),
        right = value(expr.right, scope);
      return left && right ? { kind: 'binary', operator, left, right } : undefined;
    }
    if (ts.isConditionalExpression(expr)) {
      const condition = value(expr.condition, scope),
        then = value(expr.whenTrue, scope),
        otherwise = value(expr.whenFalse, scope);
      return condition && then && otherwise
        ? { kind: 'conditional', condition, then, otherwise }
        : undefined;
    }
    const literal = bindings.constant(expr, scope.initializationPoints);
    if (literal !== undefined) return { kind: 'literal', value: literal };
    return reject(
      expr,
      'Action value has no semantic lowering; no source text or callback is copied to the target.'
    );
  };
  const bindAlias = (
    binding: ts.Symbol,
    raw: ts.Expression,
    scope: ActionScope,
    target: ActionScope
  ): boolean => {
    const expression = unwrapExpr(raw);
    const props = propsSource(expression, scope);
    if (props) {
      target.props.set(binding, props);
      return true;
    }
    if (ts.isIdentifier(expression)) {
      const source = symbol(expression)!;
      if (scope.runs.has(source)) {
        target.runs.add(binding);
        return true;
      }
      const state = scope.states.get(source);
      if (state !== undefined) {
        target.states.set(binding, state);
        return true;
      }
    }
    return false;
  };
  const action = (
    expression: ts.Expression,
    scope: ActionScope
  ): ActionStatementIR[] | undefined => {
    const expr = unwrapExpr(expression);
    if (!ts.isCallExpression(expr))
      return reject(expr, 'Callback operation has no target-independent lowering.');
    if (ts.isPropertyAccessExpression(expr.expression)) {
      const receiver = unwrapExpr(expr.expression.expression);
      if (ts.isIdentifier(receiver)) {
        if (scope.runs.has(symbol(receiver)!) && expr.expression.name.text === 'update') {
          if (expr.arguments.length)
            return reject(
              expr,
              'run.update() takes no arguments; argument effects cannot be discarded.'
            );
          return [{ kind: 'request-update' }];
        }
        const stateName = scope.states.get(symbol(receiver)!);
        if (
          stateName !== undefined &&
          expr.expression.name.text === 'set' &&
          expr.arguments.length >= 1 &&
          expr.arguments.length <= 2
        ) {
          if (
            expr.arguments[1] &&
            typeof bindings.constant(expr.arguments[1], scope.initializationPoints) !== 'string'
          )
            return reject(
              expr.arguments[1],
              'A state reason must be a proven static string; its evaluation cannot be discarded.'
            );
          const next = value(expr.arguments[0], scope);
          return next ? [{ kind: 'state-set', stateName, value: next }] : undefined;
        }
      }
    }
    const callPoints = atExecutionPoint(expr, scope.initializationPoints);
    const helper = resolveFunctionLike(expr.expression, bindings.checker, callPoints);
    if (!helper?.body)
      return reject(expr, 'Callback operation has no target-independent lowering.');
    if (active.has(helper))
      return reject(expr, 'Recursive action helpers require an explicit call representation.');
    if (
      helper.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
      helper.asteriskToken
    )
      return reject(expr, 'Asynchronous and generator helpers require separate action semantics.');
    if (
      expr.arguments.length > helper.parameters.length ||
      helper.parameters.some(
        (parameter) => !ts.isIdentifier(parameter.name) || parameter.dotDotDotToken
      )
    )
      return reject(expr, 'Helper arguments must bind to explicit positional parameters.');
    const local = { ...childScope(scope), initializationPoints: callPoints };
    const prefix: ActionStatementIR[] = [];
    for (let index = 0; index < helper.parameters.length; index++) {
      const parameter = helper.parameters[index];
      const argument = expr.arguments[index] ?? parameter.initializer;
      if (!argument)
        return reject(
          parameter,
          'Missing helper arguments require an explicit undefined representation.'
        );
      const binding = symbol(parameter.name)!;
      const argumentScope = expr.arguments[index] ? scope : local;
      if (bindAlias(binding, argument, argumentScope, local)) continue;
      const initial = value(argument, argumentScope);
      if (!initial) return undefined;
      const name = 'local' + nextLocal++;
      local.locals.set(binding, name);
      prefix.push({ kind: 'local', name, value: initial });
    }
    active.add(helper);
    const body = ts.isBlock(helper.body)
      ? statements(helper.body.statements, local)
      : action(helper.body, local);
    active.delete(helper);
    return body ? [{ kind: 'invoke', body: [...prefix, ...body] }] : undefined;
  };
  const statements = (
    nodes: readonly ts.Statement[],
    outer: ActionScope
  ): ActionStatementIR[] | undefined => {
    const scope = childScope(outer);
    const result: ActionStatementIR[] = [];
    for (const node of nodes) {
      if (--budget < 0)
        return reject(node, 'Action expansion exceeded its finite lowering budget.');
      if (ts.isEmptyStatement(node) || ts.isFunctionDeclaration(node)) continue;
      if (ts.isBlock(node)) {
        const nested = statements(node.statements, scope);
        if (!nested) return undefined;
        result.push(...nested);
      } else if (ts.isVariableStatement(node)) {
        if (!(node.declarationList.flags & ts.NodeFlags.Const))
          return reject(node, 'Mutable local bindings require explicit assignment lowering.');
        for (const declaration of node.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
            return reject(declaration, 'Action bindings must have an explicit initializer.');
          if (
            ts.isArrowFunction(unwrapExpr(declaration.initializer)) ||
            ts.isFunctionExpression(unwrapExpr(declaration.initializer))
          )
            continue;
          const binding = symbol(declaration.name)!;
          if (bindAlias(binding, declaration.initializer, scope, scope)) continue;
          const initial = value(declaration.initializer, scope);
          if (!initial) return undefined;
          const name = 'local' + nextLocal++;
          scope.locals.set(binding, name);
          result.push({ kind: 'local', name, value: initial });
        }
      } else if (ts.isExpressionStatement(node)) {
        const lowered = action(node.expression, scope);
        if (!lowered) return undefined;
        result.push(...lowered);
      } else if (ts.isIfStatement(node)) {
        const condition = value(node.expression, scope);
        const then = statements(
          ts.isBlock(node.thenStatement) ? node.thenStatement.statements : [node.thenStatement],
          scope
        );
        const otherwise = node.elseStatement
          ? statements(
              ts.isBlock(node.elseStatement) ? node.elseStatement.statements : [node.elseStatement],
              scope
            )
          : [];
        if (!condition || !then || !otherwise) return undefined;
        result.push({ kind: 'if', condition, then, otherwise });
      } else if (ts.isReturnStatement(node)) {
        if (node.expression) {
          // Returning a helper invocation still executes it; the enclosing callback returns afterwards.
          const returned = unwrapExpr(node.expression);
          if (ts.isCallExpression(returned)) {
            const lowered = action(returned, scope);
            if (!lowered) return undefined;
            result.push(...lowered);
          } else if (!value(returned, scope)) return undefined;
        }
        result.push({ kind: 'return' });
        break;
      } else
        return reject(
          node,
          'Statement has no action lowering; the compiler will not drop control flow or effects.'
        );
    }
    return result;
  };
  const root: ActionScope = {
    locals: new Map(),
    props: new Map(),
    runs: new Set(),
    states: new Map(bindings.states),
    initializationPoints: bindings.initializationPoints ?? new Map(),
  };
  for (const parameter of fn.parameters) {
    if (!ts.isIdentifier(parameter.name)) continue;
    const binding = symbol(parameter.name)!;
    if (parameter.name.text === bindings.runParameter) root.runs.add(binding);
    const props = bindings.propParameters?.get(parameter.name.text);
    if (props) root.props.set(binding, props);
  }
  active.add(fn);
  const body = ts.isBlock(fn.body) ? statements(fn.body.statements, root) : action(fn.body, root);
  return body
    ? { ok: true, body }
    : { ok: false, ...(failure ?? { node: fn, message: 'Action lowering failed.' }) };
}
