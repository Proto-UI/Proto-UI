import ts from 'typescript';
import {
  SsaBuilder,
  type EventDeclIR,
  type RuleIR,
  type RuleExpr,
  type PropDeclIR,
  type StateDeclIR,
  type SsaFunction,
} from '../ir';
import { unwrapExpr, extractScalarLiteral, propAccessChain, sanitizeSym } from './syntax';
import { internString } from './scalars';

export function detectSimpleEventAction(
  handler: ts.FunctionLikeDeclaration,
  stateVarToName: ReadonlyMap<ts.Symbol, string>,
  checker: ts.TypeChecker
): EventDeclIR['simpleAction'] | undefined {
  if (!handler.body) return undefined;
  const stmts = ts.isBlock(handler.body) ? handler.body.statements : [];
  let expr: ts.Expression | undefined;
  if (ts.isBlock(handler.body)) {
    if (stmts.length !== 1 || !ts.isExpressionStatement(stmts[0])) return undefined;
    expr = stmts[0].expression;
  } else {
    expr = handler.body;
  }
  const call = unwrapExpr(expr);
  if (!ts.isCallExpression(call)) return undefined;
  const chain = propAccessChain(call.expression);
  if (!chain || chain.length !== 2 || chain[1] !== 'set' || call.arguments.length < 1) {
    return undefined;
  }
  const stateName =
    ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression)
      ? stateVarToName.get(checker.getSymbolAtLocation(call.expression.expression)!)
      : undefined;
  if (!stateName) return undefined;
  const arg = unwrapExpr(call.arguments[0]);

  // count.set(count.get() + 1)
  if (
    ts.isBinaryExpression(arg) &&
    (arg.operatorToken.kind === ts.SyntaxKind.PlusToken ||
      arg.operatorToken.kind === ts.SyntaxKind.MinusToken)
  ) {
    const left = unwrapExpr(arg.left);
    const right = extractScalarLiteral(arg.right, checker);
    if (ts.isCallExpression(left) && typeof right === 'number') {
      const lc = propAccessChain(left.expression);
      if (lc && lc.length === 2 && lc[0] === chain[0] && lc[1] === 'get') {
        const delta = arg.operatorToken.kind === ts.SyntaxKind.PlusToken ? right : -right;
        return { kind: 'increment-state', stateName, delta };
      }
    }
  }
  // flag.set(!flag.get())
  if (ts.isPrefixUnaryExpression(arg) && arg.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = unwrapExpr(arg.operand);
    if (ts.isCallExpression(inner)) {
      const ic = propAccessChain(inner.expression);
      if (ic && ic.length === 2 && ic[0] === chain[0] && ic[1] === 'get') {
        return { kind: 'toggle-state', stateName };
      }
    }
  }
  // state.set(literal)
  const lit = extractScalarLiteral(arg, checker);
  if (lit !== undefined) {
    return { kind: 'set-state', stateName, value: lit };
  }
  return undefined;
}

export function lowerRuleToSsa(
  protoSym: string,
  rule: RuleIR,
  props: readonly PropDeclIR[],
  states: readonly StateDeclIR[],
  stringTable: string[]
): SsaFunction {
  const b = new SsaBuilder(
    `${protoSym}_rule_${rule.id}`,
    [
      { id: '%props', type: 'ptr' },
      { id: '%states', type: 'ptr' },
    ],
    'i1',
    {
      exported: true,
      pure: true,
      comment: `Compiled rule #${rule.id} -> [${rule.styleTokens.join(' ')}]`,
    }
  );

  const propByName = new Map(props.map((p) => [p.name, p]));
  const stateByName = new Map(states.map((s) => [s.name, s]));
  const compareNumber = (value: string, threshold: number, operator: 'eq' | 'ge'): string => {
    const comparison = b.cmp(operator, 'f64', value, b.constF64(threshold));
    if (operator === 'eq') return comparison;
    const finite = b.binop(
      'and',
      'i1',
      b.cmp('lt', 'f64', value, b.constF64(Infinity)),
      b.cmp('gt', 'f64', value, b.constF64(-Infinity))
    );
    return b.binop('and', 'i1', comparison, finite);
  };

  const emitExpr = (expr: RuleExpr): string => {
    switch (expr.kind) {
      case 'true':
        return b.constI1(true);
      case 'false':
        return b.constI1(false);
      case 'not':
        return b.not(emitExpr(expr.expr));
      case 'all': {
        let acc = emitExpr(expr.exprs[0]);
        for (let i = 1; i < expr.exprs.length; i++) {
          acc = b.binop('and', 'i1', acc, emitExpr(expr.exprs[i]));
        }
        return acc;
      }
      case 'any': {
        let acc = emitExpr(expr.exprs[0]);
        for (let i = 1; i < expr.exprs.length; i++) {
          acc = b.binop('or', 'i1', acc, emitExpr(expr.exprs[i]));
        }
        return acc;
      }
      case 'cmp': {
        const cmpOp = expr.operator === 'eq' ? 'eq' : 'ge';
        if (expr.source === 'prop') {
          const prop = propByName.get(expr.key);
          const slot = prop?.index ?? 0;
          if (typeof expr.value === 'boolean') {
            const v = b.loadProp('%props', slot, expr.key, 'i1');
            return b.cmp(cmpOp, 'i1', v, b.constI1(expr.value));
          }
          if (typeof expr.value === 'number') {
            const v = b.loadProp('%props', slot, expr.key, 'f64');
            return compareNumber(v, expr.value, cmpOp);
          }
          if (typeof expr.value === 'string') {
            const v = b.loadProp('%props', slot, expr.key, 'i32');
            return b.cmp(cmpOp, 'i32', v, b.constI32(internString(stringTable, expr.value)));
          }
          return b.constI1(false);
        }
        if (expr.source === 'state') {
          const st = stateByName.get(expr.key);
          const slot = st?.index ?? 0;
          if (typeof expr.value === 'boolean') {
            const v = b.loadState('%states', slot, expr.key, 'i1');
            return b.cmp(cmpOp, 'i1', v, b.constI1(expr.value));
          }
          if (typeof expr.value === 'number') {
            const v = b.loadState('%states', slot, expr.key, 'f64');
            return compareNumber(v, expr.value, cmpOp);
          }
          if (typeof expr.value === 'string') {
            const v = b.loadState('%states', slot, expr.key, 'i32');
            return b.cmp(cmpOp, 'i32', v, b.constI32(internString(stringTable, expr.value)));
          }
          return b.constI1(false);
        }
        // Meta reads depend on host environment; keep conservative false in pure kernel.
        return b.constI1(false);
      }
    }
  };

  const res = emitExpr(rule.condition);
  b.ret(res);
  return b.build();
}

export function lowerCombinedRuleMask(protoSym: string, rules: readonly RuleIR[]): SsaFunction {
  const b = new SsaBuilder(
    `${protoSym}_eval_rules`,
    [
      { id: '%props', type: 'ptr' },
      { id: '%states', type: 'ptr' },
    ],
    'i32',
    { exported: true, pure: true, comment: `Evaluates bitmask of ${rules.length} compiled rules` }
  );

  let mask = b.constI32(0);
  const limit = Math.min(rules.length, 31);
  for (let i = 0; i < limit; i++) {
    const matched = b.call(`${protoSym}_rule_${rules[i].id}`, 'i1', [
      { id: '%props', type: 'ptr' },
      { id: '%states', type: 'ptr' },
    ])!;
    const bit = b.select('i32', matched, b.constI32(1 << i), b.constI32(0));
    mask = b.binop('or', 'i32', mask, bit);
  }
  b.ret(mask);
  return b.build();
}

export function lowerEventActionsToSsa(
  protoSym: string,
  events: readonly EventDeclIR[],
  states: readonly StateDeclIR[],
  stringTable: string[]
): SsaFunction[] {
  const stateByName = new Map(states.map((s) => [s.name, s]));
  const fns: SsaFunction[] = [];

  events.forEach((ev, idx) => {
    const act = ev.simpleAction;
    if (!act) return;
    const st = stateByName.get(act.stateName);
    if (!st) return;

    const b = new SsaBuilder(
      `${protoSym}_on_${sanitizeSym(ev.eventName)}_${idx}`,
      [{ id: '%states', type: 'ptr' }],
      'void',
      { exported: true, comment: `State transition kernel for event '${ev.eventName}'` }
    );

    if (act.kind === 'increment-state' && st.ssaType === 'f64') {
      const cur = b.loadState('%states', st.index, st.name, 'f64');
      const next = b.binop('add', 'f64', cur, b.constF64(act.delta));
      b.storeState('%states', st.index, next, 'f64');
    } else if (act.kind === 'toggle-state' && st.ssaType === 'i1') {
      const cur = b.loadState('%states', st.index, st.name, 'i1');
      const next = b.not(cur);
      b.storeState('%states', st.index, next, 'i1');
    } else if (act.kind === 'set-state') {
      if (st.ssaType === 'i1' && typeof act.value === 'boolean') {
        b.storeState('%states', st.index, b.constI1(act.value), 'i1');
      } else if (st.ssaType === 'f64' && typeof act.value === 'number') {
        b.storeState('%states', st.index, b.constF64(act.value), 'f64');
      } else if (st.ssaType === 'i32' && typeof act.value === 'string') {
        b.storeState('%states', st.index, b.constI32(internString(stringTable, act.value)), 'i32');
      }
    }
    b.ret();
    fns.push(b.build());
  });

  return fns;
}

export function tryLowerPureScalarFunction(
  fn: ts.FunctionDeclaration,
  checker: ts.TypeChecker
): SsaFunction | undefined {
  if (!fn.name || !fn.body) return undefined;
  const sig = checker.getSignatureFromDeclaration(fn);
  if (!sig) return undefined;

  const tsTypeToSsa = (t: ts.Type): 'i1' | 'f64' | undefined => {
    if (t.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) return 'f64';
    if (t.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return 'i1';
    return undefined;
  };

  const retType = tsTypeToSsa(checker.getReturnTypeOfSignature(sig));
  if (!retType) return undefined;

  const params: { id: string; name: string; type: 'i1' | 'f64' }[] = [];
  for (const p of fn.parameters) {
    if (!ts.isIdentifier(p.name) || p.dotDotDotToken) return undefined;
    const pt = tsTypeToSsa(checker.getTypeAtLocation(p));
    if (!pt) return undefined;
    params.push({ id: `%${sanitizeSym(p.name.text)}`, name: p.name.text, type: pt });
  }

  const b = new SsaBuilder(
    `helper_${sanitizeSym(fn.name.text)}`,
    params.map(({ id, type }) => ({ id, type })),
    retType,
    { exported: true, pure: true, comment: `Lowered pure scalar helper ${fn.name.text}` }
  );

  const env = new Map<string, { id: string; type: 'i1' | 'f64' }>(
    params.map((p) => [p.name, { id: p.id, type: p.type }])
  );

  const lowerExpr = (raw: ts.Expression): { id: string; type: 'i1' | 'f64' } | undefined => {
    const e = unwrapExpr(raw);
    if (ts.isNumericLiteral(e)) return { id: b.constF64(Number(e.text)), type: 'f64' };
    if (e.kind === ts.SyntaxKind.TrueKeyword) return { id: b.constI1(true), type: 'i1' };
    if (e.kind === ts.SyntaxKind.FalseKeyword) return { id: b.constI1(false), type: 'i1' };
    if (ts.isIdentifier(e)) return env.get(e.text);
    if (ts.isPrefixUnaryExpression(e)) {
      const inner = lowerExpr(e.operand);
      if (!inner) return undefined;
      if (e.operator === ts.SyntaxKind.ExclamationToken && inner.type === 'i1') {
        return { id: b.not(inner.id), type: 'i1' };
      }
      if (e.operator === ts.SyntaxKind.MinusToken && inner.type === 'f64') {
        return { id: b.fneg(inner.id), type: 'f64' };
      }
      return undefined;
    }
    if (ts.isBinaryExpression(e)) {
      const l = lowerExpr(e.left);
      const r = lowerExpr(e.right);
      if (!l || !r || l.type !== r.type) return undefined;
      const k = e.operatorToken.kind;
      if (l.type === 'f64') {
        if (k === ts.SyntaxKind.PlusToken)
          return { id: b.binop('add', 'f64', l.id, r.id), type: 'f64' };
        if (k === ts.SyntaxKind.MinusToken)
          return { id: b.binop('sub', 'f64', l.id, r.id), type: 'f64' };
        if (k === ts.SyntaxKind.AsteriskToken)
          return { id: b.binop('mul', 'f64', l.id, r.id), type: 'f64' };
        if (k === ts.SyntaxKind.SlashToken)
          return { id: b.binop('div', 'f64', l.id, r.id), type: 'f64' };
        if (k === ts.SyntaxKind.EqualsEqualsEqualsToken)
          return { id: b.cmp('eq', 'f64', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.ExclamationEqualsEqualsToken)
          return { id: b.cmp('ne', 'f64', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.LessThanToken)
          return { id: b.cmp('lt', 'f64', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.LessThanEqualsToken)
          return { id: b.cmp('le', 'f64', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.GreaterThanToken)
          return { id: b.cmp('gt', 'f64', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.GreaterThanEqualsToken)
          return { id: b.cmp('ge', 'f64', l.id, r.id), type: 'i1' };
      } else {
        if (k === ts.SyntaxKind.AmpersandAmpersandToken)
          return { id: b.binop('and', 'i1', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.BarBarToken)
          return { id: b.binop('or', 'i1', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.EqualsEqualsEqualsToken)
          return { id: b.cmp('eq', 'i1', l.id, r.id), type: 'i1' };
        if (k === ts.SyntaxKind.ExclamationEqualsEqualsToken)
          return { id: b.cmp('ne', 'i1', l.id, r.id), type: 'i1' };
      }
      return undefined;
    }
    if (ts.isConditionalExpression(e)) {
      const c = lowerExpr(e.condition);
      const t = lowerExpr(e.whenTrue);
      const f = lowerExpr(e.whenFalse);
      if (!c || c.type !== 'i1' || !t || !f || t.type !== f.type) return undefined;
      return { id: b.select(t.type, c.id, t.id, f.id), type: t.type };
    }
    return undefined;
  };

  let blockIdx = 0;
  let terminated = false;
  for (const stmt of fn.body.statements) {
    if (terminated) break;
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) return undefined;
        const val = lowerExpr(decl.initializer);
        if (!val) return undefined;
        env.set(decl.name.text, val);
      }
    } else if (ts.isIfStatement(stmt)) {
      const cond = lowerExpr(stmt.expression);
      if (!cond || cond.type !== 'i1') return undefined;
      const thenRet =
        ts.isReturnStatement(stmt.thenStatement) && stmt.thenStatement.expression
          ? stmt.thenStatement.expression
          : ts.isBlock(stmt.thenStatement) &&
              stmt.thenStatement.statements.length === 1 &&
              ts.isReturnStatement(stmt.thenStatement.statements[0]) &&
              stmt.thenStatement.statements[0].expression
            ? stmt.thenStatement.statements[0].expression
            : undefined;
      if (!thenRet) return undefined;
      const id = blockIdx++;
      const thenBlk = b.createBlock(`if_then_${id}`);
      const elseBlk = b.createBlock(`if_else_${id}`);
      b.condbr(cond.id, thenBlk.label, elseBlk.label);
      b.positionAt(thenBlk);
      const tv = lowerExpr(thenRet);
      if (!tv || tv.type !== retType) return undefined;
      b.ret(tv.id);
      b.positionAt(elseBlk);
      if (stmt.elseStatement) {
        const other = stmt.elseStatement;
        const elseRet = ts.isReturnStatement(other)
          ? other.expression
          : ts.isBlock(other) &&
              other.statements.length === 1 &&
              ts.isReturnStatement(other.statements[0])
            ? other.statements[0].expression
            : undefined;
        if (!elseRet) return undefined;
        const fv = lowerExpr(elseRet);
        if (!fv || fv.type !== retType) return undefined;
        b.ret(fv.id);
        terminated = true;
      }
    } else if (ts.isReturnStatement(stmt) && stmt.expression) {
      const rv = lowerExpr(stmt.expression);
      if (!rv || rv.type !== retType) return undefined;
      b.ret(rv.id);
      terminated = true;
    } else {
      return undefined;
    }
  }

  if (!terminated) return undefined;
  return b.build();
}
