import ts from 'typescript';
import type { ActionStatementIR, ScalarLiteral, ValueExprIR } from '../ir/types';

export interface ActionBindings {
  readonly states: ReadonlyMap<ts.Symbol, string>;
  readonly checker: ts.TypeChecker;
  readonly runParameter?: string;
  readonly propParameters?: ReadonlyMap<string, 'current' | 'previous'>;
  readonly constant: (expression: ts.Expression) => ScalarLiteral | undefined;
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

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression;
  return current;
}

/** Lower a callback body to target-independent actions, preserving blocks and evaluation order. */
export function lowerActionBody(
  fn: ts.FunctionLikeDeclaration,
  bindings: ActionBindings
): ActionLowering {
  if (!fn.body) return { ok: false, node: fn, message: 'Callback has no implementation body.' };
  let failure: { node: ts.Node; message: string } | undefined;
  let nextLocal = 0;
  const reject = (node: ts.Node, message: string): undefined => {
    failure ??= { node, message };
    return undefined;
  };
  const value = (
    expression: ts.Expression,
    locals: ReadonlyMap<string, string>
  ): ValueExprIR | undefined => {
    const expr = unwrap(expression);
    if (ts.isIdentifier(expr) && locals.has(expr.text)) {
      return { kind: 'local', name: locals.get(expr.text)! };
    }
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
      const source = bindings.propParameters?.get(expr.expression.text);
      if (source) return { kind: 'prop', name: expr.name.text, source };
    }
    if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
      const recv = unwrap(expr.expression.expression);
      if (
        ts.isIdentifier(recv) &&
        expr.expression.name.text === 'get' &&
        expr.arguments.length === 0
      ) {
        const state = bindings.states.get(bindings.checker.getSymbolAtLocation(recv)!);
        if (state) return { kind: 'state', name: state };
      }
    }
    if (ts.isPropertyAccessExpression(expr) && ts.isCallExpression(unwrap(expr.expression))) {
      const getter = unwrap(expr.expression) as ts.CallExpression;
      if (
        getter.arguments.length === 0 &&
        ts.isPropertyAccessExpression(getter.expression) &&
        getter.expression.name.text === 'get'
      ) {
        const props = unwrap(getter.expression.expression);
        if (
          ts.isPropertyAccessExpression(props) &&
          props.name.text === 'props' &&
          ts.isIdentifier(props.expression) &&
          props.expression.text === bindings.runParameter
        ) {
          return { kind: 'prop', name: expr.name.text };
        }
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
      const operand = operator ? value(expr.operand, locals) : undefined;
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
      const left = value(expr.left, locals);
      const right = value(expr.right, locals);
      return left && right ? { kind: 'binary', operator, left, right } : undefined;
    }
    if (ts.isConditionalExpression(expr)) {
      const condition = value(expr.condition, locals);
      const then = value(expr.whenTrue, locals);
      const otherwise = value(expr.whenFalse, locals);
      return condition && then && otherwise
        ? { kind: 'conditional', condition, then, otherwise }
        : undefined;
    }
    const literal = bindings.constant(expr);
    if (literal !== undefined) return { kind: 'literal', value: literal };
    return reject(
      expr,
      'Action value has no semantic lowering; no source text or callback is copied to the target.'
    );
  };
  const action = (
    expression: ts.Expression,
    locals: ReadonlyMap<string, string>
  ): ActionStatementIR | undefined => {
    const expr = unwrap(expression);
    if (
      ts.isCallExpression(expr) &&
      ts.isPropertyAccessExpression(expr.expression) &&
      expr.expression.name.text === 'set' &&
      ts.isIdentifier(expr.expression.expression)
    ) {
      const stateName = bindings.states.get(
        bindings.checker.getSymbolAtLocation(expr.expression.expression)!
      );
      if (stateName && expr.arguments.length >= 1 && expr.arguments.length <= 2) {
        if (expr.arguments[1] && typeof bindings.constant(expr.arguments[1]) !== 'string') {
          return reject(
            expr.arguments[1],
            'A state reason must be a proven static string; its evaluation cannot be discarded.'
          );
        }
        const next = value(expr.arguments[0], locals);
        if (next) return { kind: 'state-set', stateName, value: next };
      }
    }
    return reject(expr, 'Callback operation has no target-independent lowering.');
  };
  const statements = (
    nodes: readonly ts.Statement[],
    outer: ReadonlyMap<string, string>
  ): ActionStatementIR[] | undefined => {
    const locals = new Map(outer);
    const result: ActionStatementIR[] = [];
    for (const node of nodes) {
      if (ts.isEmptyStatement(node)) continue;
      if (ts.isBlock(node)) {
        const block = statements(node.statements, locals);
        if (!block) return undefined;
        result.push(...block);
      } else if (ts.isVariableStatement(node)) {
        if (!(node.declarationList.flags & ts.NodeFlags.Const)) {
          return reject(node, 'Mutable local bindings require explicit assignment lowering.');
        }
        for (const declaration of node.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
            return reject(declaration, 'Action bindings must have an explicit initializer.');
          }
          const initial = value(declaration.initializer, locals);
          if (!initial) return undefined;
          const name = 'local' + nextLocal++;
          locals.set(declaration.name.text, name);
          result.push({ kind: 'local', name, value: initial });
        }
      } else if (ts.isExpressionStatement(node)) {
        const lowered = action(node.expression, locals);
        if (!lowered) return undefined;
        result.push(lowered);
      } else if (ts.isIfStatement(node)) {
        const condition = value(node.expression, locals);
        const then = statements(
          ts.isBlock(node.thenStatement) ? node.thenStatement.statements : [node.thenStatement],
          locals
        );
        const otherwise = node.elseStatement
          ? statements(
              ts.isBlock(node.elseStatement) ? node.elseStatement.statements : [node.elseStatement],
              locals
            )
          : [];
        if (!condition || !then || !otherwise) return undefined;
        result.push({ kind: 'if', condition, then, otherwise });
      } else if (ts.isReturnStatement(node) && !node.expression) {
        result.push({ kind: 'return' });
        break;
      } else {
        return reject(
          node,
          'Statement has no action lowering; the compiler will not drop control flow or effects.'
        );
      }
    }
    return result;
  };
  const body = ts.isBlock(fn.body)
    ? statements(fn.body.statements, new Map())
    : (() => {
        const lowered = action(fn.body as ts.Expression, new Map());
        return lowered ? [lowered] : undefined;
      })();
  return body
    ? { ok: true, body }
    : { ok: false, ...(failure ?? { node: fn, message: 'Action lowering failed.' }) };
}
