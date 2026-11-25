import ts from 'typescript';
import type { RuleExpr, ScalarLiteral } from '../ir';
import { unwrapExpr, extractScalarLiteral } from './syntax';

export function parseRuleCondition(
  expr: ts.Expression,
  builderParam: string,
  stateVarToName: ReadonlyMap<ts.Symbol, string>,
  checker: ts.TypeChecker,
  constant: (expression: ts.Expression) => ScalarLiteral | undefined = (expression) =>
    extractScalarLiteral(expression, checker)
): RuleExpr | undefined {
  const e = unwrapExpr(expr);
  if (!ts.isCallExpression(e)) return undefined;
  const callee = unwrapExpr(e.expression);
  if (!ts.isPropertyAccessExpression(callee)) return undefined;
  const method = callee.name.text;
  const recv = unwrapExpr(callee.expression);

  if (ts.isIdentifier(recv) && recv.text === builderParam) {
    if (method === 't' && e.arguments.length === 0) return { kind: 'true' };
    if (method === 'f' && e.arguments.length === 0) return { kind: 'false' };
    if (method === 'not' && e.arguments.length === 1) {
      const inner = parseRuleCondition(
        e.arguments[0],
        builderParam,
        stateVarToName,
        checker,
        constant
      );
      return inner ? { kind: 'not', expr: inner } : undefined;
    }
    if ((method === 'all' || method === 'any') && e.arguments.length > 0) {
      const exprs: RuleExpr[] = [];
      for (const arg of e.arguments) {
        const sub = parseRuleCondition(arg, builderParam, stateVarToName, checker, constant);
        if (!sub) return undefined;
        exprs.push(sub);
      }
      return { kind: method, exprs };
    }
    return undefined;
  }

  // w.prop('x').eq(val) / w.state(s).eq(val) / w.meta('k').eq(val) / .gte(n)
  if (
    (method === 'eq' || method === 'gte') &&
    ts.isCallExpression(recv) &&
    e.arguments.length === 1
  ) {
    const innerCallee = unwrapExpr(recv.expression);
    if (
      ts.isPropertyAccessExpression(innerCallee) &&
      ts.isIdentifier(unwrapExpr(innerCallee.expression)) &&
      (unwrapExpr(innerCallee.expression) as ts.Identifier).text === builderParam &&
      recv.arguments.length === 1
    ) {
      const src = innerCallee.name.text;
      if (src !== 'prop' && src !== 'state' && src !== 'meta') return undefined;
      const rhs = constant(e.arguments[0]);
      if (rhs === undefined) return undefined;
      let key: string | undefined;
      if (src === 'state') {
        const arg = unwrapExpr(recv.arguments[0]);
        if (ts.isIdentifier(arg)) key = stateVarToName.get(checker.getSymbolAtLocation(arg)!);
      } else {
        const lit = constant(recv.arguments[0]);
        if (typeof lit === 'string') key = lit;
      }
      if (key === undefined) return undefined;
      return { kind: 'cmp', operator: method, source: src, key, value: rhs };
    }
  }
  return undefined;
}
