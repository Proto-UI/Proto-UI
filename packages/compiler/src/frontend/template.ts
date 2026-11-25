import ts from 'typescript';
import type { ScalarLiteral, TemplateChildIR, TemplateElementIR } from '../ir';
import type { InitializationPoints } from './bindings';
import {
  unwrapExpr,
  extractScalarLiteral,
  resolveCallName,
  propAccessChain,
  extractObjectProperty,
  isCoreIntrinsic,
  resolveFunctionLike,
} from './syntax';

export function collectTwTokens(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  out: string[],
  constant: (expression: ts.Expression) => ScalarLiteral | undefined = (expression) =>
    extractScalarLiteral(expression, checker),
  initializationPoints: InitializationPoints = new Map()
): boolean {
  const value = unwrapExpr(expr);
  if (!ts.isCallExpression(value)) return false;
  const resolved = resolveCallName(value.expression, checker, new Set(), initializationPoints);
  if (resolved?.name !== 'tw' || !isCoreIntrinsic(resolved) || value.arguments.length === 0)
    return false;
  const tokens: string[] = [];
  for (const arg of value.arguments) {
    const literal = constant(arg);
    if (typeof literal !== 'string') return false;
    tokens.push(...literal.trim().split(/\s+/).filter(Boolean));
  }
  out.push(...tokens);
  return true;
}

/** Only explicit style intents are accepted. Walking an arbitrary callback loses its effects. */
export function collectRuleStyleTokens(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  out: string[],
  constant: (expression: ts.Expression) => ScalarLiteral | undefined = (expression) =>
    extractScalarLiteral(expression, checker),
  initializationPoints: InitializationPoints = new Map()
): boolean {
  const fn = resolveFunctionLike(expr, checker, initializationPoints);
  if (
    !fn?.body ||
    fn.asteriskToken ||
    fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
    fn.parameters.length !== 1 ||
    !ts.isIdentifier(fn.parameters[0].name) ||
    fn.parameters[0].initializer ||
    fn.parameters[0].dotDotDotToken
  )
    return false;
  const parameter = fn.parameters[0].name.text;
  const expressions: ts.Expression[] = [];
  if (ts.isBlock(fn.body)) {
    for (const statement of fn.body.statements) {
      if (ts.isExpressionStatement(statement)) expressions.push(statement.expression);
      else if (ts.isReturnStatement(statement)) {
        if (statement.expression) expressions.push(statement.expression);
        break;
      } else if (!ts.isEmptyStatement(statement)) return false;
    }
  } else expressions.push(fn.body);
  const tokens: string[] = [];
  for (const expression of expressions) {
    const call = unwrapExpr(expression);
    if (
      !ts.isCallExpression(call) ||
      propAccessChain(call.expression)?.join('.') !== parameter + '.feedback.style.use' ||
      call.arguments.length === 0
    )
      return false;
    for (const argument of call.arguments)
      if (!collectTwTokens(argument, checker, tokens, constant, initializationPoints)) return false;
  }
  out.push(...tokens);
  return true;
}

export function parseTemplateChild(
  expr: ts.Expression,
  renderParam: string,
  stateVarToName: ReadonlyMap<ts.Symbol, string>,
  checker: ts.TypeChecker,
  constant: (expression: ts.Expression) => ScalarLiteral | undefined = (expression) =>
    extractScalarLiteral(expression, checker),
  initializationPoints: InitializationPoints = new Map()
): { children: TemplateChildIR[]; reactive: boolean } | undefined {
  const e = unwrapExpr(expr);
  if (ts.isArrayLiteralExpression(e)) {
    const children: TemplateChildIR[] = [];
    let reactive = false;
    for (const elem of e.elements) {
      const parsed = parseTemplateChild(
        elem,
        renderParam,
        stateVarToName,
        checker,
        constant,
        initializationPoints
      );
      if (!parsed) return undefined;
      children.push(...parsed.children);
      reactive ||= parsed.reactive;
    }
    return { children, reactive };
  }
  const lit = constant(e);
  if (lit === null) return { children: [], reactive: false };
  if (typeof lit === 'string' || typeof lit === 'number') {
    return { children: [{ kind: 'text', value: String(lit) }], reactive: false };
  }
  if (ts.isCallExpression(e)) {
    const chain = propAccessChain(e.expression);
    if (chain && chain[0] === renderParam) {
      const operation = chain.slice(1).join('.');
      if (operation === 'slot' || operation === 'r.slot') {
        if (e.arguments.length) return undefined;
        return { children: [{ kind: 'slot' }], reactive: false };
      }
      if (operation === 'el') {
        const el = parseTemplateElement(
          e,
          renderParam,
          stateVarToName,
          checker,
          constant,
          initializationPoints
        );
        if (!el) return undefined;
        return { children: [{ kind: 'element', node: el.node }], reactive: el.reactive };
      }
    }
    // state.get()
    if (chain && chain.length === 2 && chain[1] === 'get') {
      if (e.arguments.length) return undefined;
      const stateName =
        ts.isPropertyAccessExpression(e.expression) && ts.isIdentifier(e.expression.expression)
          ? stateVarToName.get(checker.getSymbolAtLocation(e.expression.expression)!)
          : undefined;
      if (stateName !== undefined) {
        return { children: [{ kind: 'state-read', stateName }], reactive: true };
      }
    }
  }
  // r.read.props.get().<propName>
  if (ts.isPropertyAccessExpression(e) && ts.isCallExpression(unwrapExpr(e.expression))) {
    const call = unwrapExpr(e.expression) as ts.CallExpression;
    const chain = propAccessChain(call.expression);
    if (chain && chain[0] === renderParam && chain.slice(1).join('.') === 'read.props.get') {
      if (call.arguments.length) return undefined;
      return { children: [{ kind: 'prop-read', propName: e.name.text }], reactive: true };
    }
  }
  return undefined;
}

export function parseTemplateElement(
  call: ts.CallExpression,
  renderParam: string,
  stateVarToName: ReadonlyMap<ts.Symbol, string>,
  checker: ts.TypeChecker,
  constant: (expression: ts.Expression) => ScalarLiteral | undefined = (expression) =>
    extractScalarLiteral(expression, checker),
  initializationPoints: InitializationPoints = new Map()
): { node: TemplateElementIR; reactive: boolean } | undefined {
  if (call.arguments.length === 0) return undefined;
  if (call.arguments.length > 3) return undefined;
  const tagLit = constant(call.arguments[0]);
  if (typeof tagLit !== 'string') return undefined;

  let styleTokens: string[] | undefined;
  let childrenArg: ts.Expression | undefined;

  if (call.arguments.length === 2) {
    const second = unwrapExpr(call.arguments[1]);
    if (ts.isObjectLiteralExpression(second)) {
      if (
        second.properties.some(
          (p) =>
            !ts.isPropertyAssignment(p) ||
            (!ts.isIdentifier(p.name) && !ts.isStringLiteral(p.name)) ||
            p.name.text !== 'style'
        )
      )
        return undefined;
      const styleExpr = extractObjectProperty(second, 'style');
      if (styleExpr) {
        const toks: string[] = [];
        if (!collectTwTokens(styleExpr, checker, toks, constant, initializationPoints))
          return undefined;
        if (toks.length) styleTokens = toks;
      }
    } else {
      childrenArg = second;
    }
  } else if (call.arguments.length >= 3) {
    const second = unwrapExpr(call.arguments[1]);
    if (ts.isObjectLiteralExpression(second)) {
      if (
        second.properties.some(
          (p) =>
            !ts.isPropertyAssignment(p) ||
            (!ts.isIdentifier(p.name) && !ts.isStringLiteral(p.name)) ||
            p.name.text !== 'style'
        )
      )
        return undefined;
      const styleExpr = extractObjectProperty(second, 'style');
      if (styleExpr) {
        const toks: string[] = [];
        if (!collectTwTokens(styleExpr, checker, toks, constant, initializationPoints))
          return undefined;
        if (toks.length) styleTokens = toks;
      }
    } else return undefined;
    childrenArg = call.arguments[2];
  }

  let children: TemplateChildIR[] = [];
  let reactive = false;
  if (childrenArg) {
    const parsed = parseTemplateChild(
      childrenArg,
      renderParam,
      stateVarToName,
      checker,
      constant,
      initializationPoints
    );
    if (!parsed) return undefined;
    children = parsed.children;
    reactive = parsed.reactive;
  }
  return {
    node: { tag: tagLit, ...(styleTokens ? { styleTokens } : {}), children },
    reactive,
  };
}
