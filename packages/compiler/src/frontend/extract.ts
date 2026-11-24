import path from 'node:path';
import ts from 'typescript';
import { diagnostic, type CompilerDiagnostic, type SourceSpan } from '../diagnostics';
import {
  PROTO_IR_VERSION,
  SsaBuilder,
  computePrototypeCapabilities,
  type AuthoredHookSummary,
  type CompilationTier,
  type ContextUsageIR,
  type EventDeclIR,
  type ExposeDeclIR,
  type HookCallIR,
  type LifecycleHookName,
  type ModuleIR,
  type PropDeclIR,
  type PrototypeIR,
  type RenderIR,
  type RuleExpr,
  type RuleIR,
  type ScalarLiteral,
  type SsaFunction,
  type SsaType,
  type StateDeclIR,
  type TemplateChildIR,
  type TemplateElementIR,
} from '../ir';

const BUILTIN_HOOK_NAMES = new Set([
  'asTrigger',
  'asFocusable',
  'asFocusEntry',
  'asFocusScope',
  'asFocusRoving',
  'asAccessible',
  'asControlLabel',
  'asAnatomy',
  'asCollection',
  'asCollectionItem',
  'asOverlay',
  'asBoundary',
  'asHitParticipation',
  'asPositioning',
  'asScrollSurface',
  'asTextControl',
  'asImageView',
  'asTableStructure',
  'asNativeLink',
  'asAxisInput',
  'asPresence',
]);

const LIFECYCLE_METHODS = new Set<LifecycleHookName>([
  'onCreated',
  'onMounted',
  'onUpdated',
  'onUnmounted',
  'onBeforeDispose',
]);

export interface ExtractOptions {
  readonly exportName?: string;
  readonly checkTypes?: boolean;
}

export interface ExtractOutput {
  readonly ir: ModuleIR;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

function spanOf(node: ts.Node, sf: ts.SourceFile): SourceSpan {
  const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  const end = sf.getLineAndCharacterOfPosition(node.getEnd());
  return {
    file: sf.fileName,
    line: start.line + 1,
    column: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

function sanitizeSym(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function unwrapExpr(expr: ts.Expression): ts.Expression {
  let cur = expr;
  while (
    ts.isParenthesizedExpression(cur) ||
    ts.isAsExpression(cur) ||
    ts.isSatisfiesExpression(cur) ||
    ts.isNonNullExpression(cur)
  ) {
    cur = cur.expression;
  }
  return cur;
}

function extractScalarLiteral(
  expr: ts.Expression,
  checker: ts.TypeChecker
): ScalarLiteral | undefined {
  const e = unwrapExpr(expr);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isNumericLiteral(e)) return Number(e.text);
  if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (e.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(e) &&
    (e.operator === ts.SyntaxKind.MinusToken || e.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(e.operand)
  ) {
    return e.operator === ts.SyntaxKind.MinusToken
      ? -Number(e.operand.text)
      : Number(e.operand.text);
  }
  // Use TypeScript's real TypeChecker to resolve const literal types (e.g. `const X = 'foo'`).
  const t = checker.getTypeAtLocation(e);
  if (t.isStringLiteral()) return t.value;
  if (t.isNumberLiteral()) return t.value;
  if (t.flags & ts.TypeFlags.BooleanLiteral) {
    return checker.typeToString(t) === 'true';
  }
  return undefined;
}

function resolveAliasedSymbol(
  checker: ts.TypeChecker,
  sym: ts.Symbol | undefined
): ts.Symbol | undefined {
  if (!sym) return undefined;
  return sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
}

function resolveCallName(
  expr: ts.Expression,
  checker: ts.TypeChecker
): { name: string; sourceFile?: string } | undefined {
  const e = unwrapExpr(expr);
  const sym = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(e));
  if (sym) {
    const decl = sym.valueDeclaration ?? sym.declarations?.[0];
    return { name: sym.getName(), sourceFile: decl?.getSourceFile().fileName };
  }
  if (ts.isIdentifier(e)) return { name: e.text };
  return undefined;
}

function findFactoryCall(
  expr: ts.Expression,
  checker: ts.TypeChecker,
  factoryNames: readonly string[],
  visited = new Set<ts.Node>()
): { call: ts.CallExpression; factory: string } | undefined {
  const e = unwrapExpr(expr);
  if (visited.has(e)) return undefined;
  visited.add(e);

  if (ts.isCallExpression(e)) {
    const resolved = resolveCallName(e.expression, checker);
    if (resolved && factoryNames.includes(resolved.name)) {
      return { call: e, factory: resolved.name };
    }
  }
  if (ts.isIdentifier(e)) {
    const sym = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(e));
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0];
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
      return findFactoryCall(decl.initializer, checker, factoryNames, visited);
    }
  }
  return undefined;
}

function resolveFunctionLike(
  expr: ts.Expression,
  checker: ts.TypeChecker
): ts.FunctionLikeDeclaration | undefined {
  const e = unwrapExpr(expr);
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e;
  if (ts.isIdentifier(e)) {
    const sym = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(e));
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0];
    if (!decl) return undefined;
    if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) return decl;
    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      return resolveFunctionLike(decl.initializer, checker);
    }
  }
  return undefined;
}

function propKindToSsaType(kind: PropDeclIR['kind']): Exclude<SsaType, 'void'> {
  switch (kind) {
    case 'boolean':
      return 'i1';
    case 'number':
      return 'f64';
    case 'string':
    case 'enum':
      return 'i32'; // Interned string/enum ID in LLVM kernel ABI
    default:
      return 'ptr';
  }
}

function stateKindToSsaType(kind: StateDeclIR['kind']): Exclude<SsaType, 'void'> {
  switch (kind) {
    case 'bool':
      return 'i1';
    case 'number.discrete':
    case 'number.range':
      return 'f64';
    case 'string':
    case 'enum':
      return 'i32';
  }
}

function internString(table: string[], value: string): number {
  const existing = table.indexOf(value);
  if (existing >= 0) return existing;
  table.push(value);
  return table.length - 1;
}

function propAccessChain(expr: ts.Expression): string[] | undefined {
  const parts: string[] = [];
  let cur: ts.Expression = unwrapExpr(expr);
  while (ts.isPropertyAccessExpression(cur)) {
    parts.unshift(cur.name.text);
    cur = unwrapExpr(cur.expression);
  }
  if (ts.isIdentifier(cur)) {
    parts.unshift(cur.text);
    return parts;
  }
  return undefined;
}

function extractObjectProperty(
  obj: ts.ObjectLiteralExpression,
  name: string
): ts.Expression | undefined {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const key =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined;
      if (key === name) return prop.initializer;
    } else if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === name) {
      return prop.name;
    } else if (ts.isMethodDeclaration(prop)) {
      const key =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined;
      if (key === name) {
        // Return a synthetic-free reference via caller checking method declarations separately.
        return undefined;
      }
    }
  }
  return undefined;
}

function extractSetupFunction(
  obj: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker
): ts.FunctionLikeDeclaration | undefined {
  for (const prop of obj.properties) {
    if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'setup') {
      return prop;
    }
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'setup') {
      return resolveFunctionLike(prop.initializer, checker);
    }
    if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === 'setup') {
      return resolveFunctionLike(prop.name, checker);
    }
  }
  return undefined;
}

function parseRuleCondition(
  expr: ts.Expression,
  builderParam: string,
  stateVarToName: ReadonlyMap<string, string>,
  checker: ts.TypeChecker
): RuleExpr | undefined {
  const e = unwrapExpr(expr);
  if (!ts.isCallExpression(e)) return undefined;
  const callee = unwrapExpr(e.expression);
  if (!ts.isPropertyAccessExpression(callee)) return undefined;
  const method = callee.name.text;
  const recv = unwrapExpr(callee.expression);

  if (ts.isIdentifier(recv) && recv.text === builderParam) {
    if (method === 't') return { kind: 'true' };
    if (method === 'f') return { kind: 'false' };
    if (method === 'not' && e.arguments[0]) {
      const inner = parseRuleCondition(e.arguments[0], builderParam, stateVarToName, checker);
      return inner ? { kind: 'not', expr: inner } : undefined;
    }
    if ((method === 'all' || method === 'any') && e.arguments.length > 0) {
      const exprs: RuleExpr[] = [];
      for (const arg of e.arguments) {
        const sub = parseRuleCondition(arg, builderParam, stateVarToName, checker);
        if (!sub) return undefined;
        exprs.push(sub);
      }
      return { kind: method, exprs };
    }
    return undefined;
  }

  // w.prop('x').eq(val) / w.state(s).eq(val) / w.meta('k').eq(val) / .gte(n)
  if ((method === 'eq' || method === 'gte') && ts.isCallExpression(recv) && e.arguments[0]) {
    const innerCallee = unwrapExpr(recv.expression);
    if (
      ts.isPropertyAccessExpression(innerCallee) &&
      ts.isIdentifier(unwrapExpr(innerCallee.expression)) &&
      (unwrapExpr(innerCallee.expression) as ts.Identifier).text === builderParam &&
      recv.arguments[0]
    ) {
      const src = innerCallee.name.text;
      if (src !== 'prop' && src !== 'state' && src !== 'meta') return undefined;
      const rhs = extractScalarLiteral(e.arguments[0], checker);
      if (rhs === undefined) return undefined;
      let key: string | undefined;
      if (src === 'state') {
        const arg = unwrapExpr(recv.arguments[0]);
        if (ts.isIdentifier(arg)) key = stateVarToName.get(arg.text) ?? arg.text;
        else if (ts.isPropertyAccessExpression(arg)) key = arg.name.text;
      } else {
        const lit = extractScalarLiteral(recv.arguments[0], checker);
        if (typeof lit === 'string') key = lit;
      }
      if (!key) return undefined;
      return { kind: 'cmp', operator: method, source: src, key, value: rhs };
    }
  }
  return undefined;
}

function collectTwTokens(expr: ts.Expression, checker: ts.TypeChecker, out: string[]): void {
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const resolved = resolveCallName(node.expression, checker);
      if (resolved?.name === 'tw') {
        for (const arg of node.arguments) {
          const lit = extractScalarLiteral(arg, checker);
          if (typeof lit === 'string') {
            for (const tok of lit.trim().split(/\s+/)) {
              if (tok && !out.includes(tok)) out.push(tok);
            }
          }
        }
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expr);
}

function parseTemplateChild(
  expr: ts.Expression,
  renderParam: string,
  stateVarToName: ReadonlyMap<string, string>,
  checker: ts.TypeChecker
): { children: TemplateChildIR[]; reactive: boolean } | undefined {
  const e = unwrapExpr(expr);
  if (ts.isArrayLiteralExpression(e)) {
    const children: TemplateChildIR[] = [];
    let reactive = false;
    for (const elem of e.elements) {
      const parsed = parseTemplateChild(elem, renderParam, stateVarToName, checker);
      if (!parsed) return undefined;
      children.push(...parsed.children);
      reactive ||= parsed.reactive;
    }
    return { children, reactive };
  }
  const lit = extractScalarLiteral(e, checker);
  if (typeof lit === 'string' || typeof lit === 'number') {
    return { children: [{ kind: 'text', value: String(lit) }], reactive: false };
  }
  if (ts.isCallExpression(e)) {
    const chain = propAccessChain(e.expression);
    if (chain && chain[0] === renderParam) {
      if (chain.length === 2 && chain[1] === 'slot') {
        return { children: [{ kind: 'slot' }], reactive: false };
      }
      if (chain.length === 2 && chain[1] === 'el') {
        const el = parseTemplateElement(e, renderParam, stateVarToName, checker);
        if (!el) return undefined;
        return { children: [{ kind: 'element', node: el.node }], reactive: el.reactive };
      }
    }
    // state.get()
    if (chain && chain.length === 2 && chain[1] === 'get') {
      const stateName = stateVarToName.get(chain[0]);
      if (stateName) {
        return { children: [{ kind: 'state-read', stateName }], reactive: true };
      }
    }
  }
  // r.read.props.get().<propName>
  if (ts.isPropertyAccessExpression(e) && ts.isCallExpression(unwrapExpr(e.expression))) {
    const call = unwrapExpr(e.expression) as ts.CallExpression;
    const chain = propAccessChain(call.expression);
    if (chain && chain[0] === renderParam && chain.slice(1).join('.') === 'read.props.get') {
      return { children: [{ kind: 'prop-read', propName: e.name.text }], reactive: true };
    }
  }
  return undefined;
}

function parseTemplateElement(
  call: ts.CallExpression,
  renderParam: string,
  stateVarToName: ReadonlyMap<string, string>,
  checker: ts.TypeChecker
): { node: TemplateElementIR; reactive: boolean } | undefined {
  if (call.arguments.length === 0) return undefined;
  const tagLit = extractScalarLiteral(call.arguments[0], checker);
  if (typeof tagLit !== 'string') return undefined;

  let styleTokens: string[] | undefined;
  let childrenArg: ts.Expression | undefined;

  if (call.arguments.length === 2) {
    const second = unwrapExpr(call.arguments[1]);
    if (ts.isObjectLiteralExpression(second)) {
      const styleExpr = extractObjectProperty(second, 'style');
      if (styleExpr) {
        const toks: string[] = [];
        collectTwTokens(styleExpr, checker, toks);
        if (toks.length) styleTokens = toks;
      }
    } else {
      childrenArg = second;
    }
  } else if (call.arguments.length >= 3) {
    const second = unwrapExpr(call.arguments[1]);
    if (ts.isObjectLiteralExpression(second)) {
      const styleExpr = extractObjectProperty(second, 'style');
      if (styleExpr) {
        const toks: string[] = [];
        collectTwTokens(styleExpr, checker, toks);
        if (toks.length) styleTokens = toks;
      }
    }
    childrenArg = call.arguments[2];
  }

  let children: TemplateChildIR[] = [];
  let reactive = false;
  if (childrenArg) {
    const parsed = parseTemplateChild(childrenArg, renderParam, stateVarToName, checker);
    if (!parsed) return undefined;
    children = parsed.children;
    reactive = parsed.reactive;
  }
  return {
    node: { tag: tagLit, ...(styleTokens ? { styleTokens } : {}), children },
    reactive,
  };
}

function detectSimpleEventAction(
  handler: ts.FunctionLikeDeclaration,
  stateVarToName: ReadonlyMap<string, string>,
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
  const stateName = stateVarToName.get(chain[0]);
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

/** Lower declarative RuleIR condition AST into an executable SSA function. */
function lowerRuleToSsa(
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
            return b.cmp(cmpOp, 'f64', v, b.constF64(expr.value));
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
            return b.cmp(cmpOp, 'f64', v, b.constF64(expr.value));
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

/** Lower combined rule bitmask evaluator: returns i32 bitmask of matching rules (up to 31 rules). */
function lowerCombinedRuleMask(protoSym: string, rules: readonly RuleIR[]): SsaFunction {
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

/** Lower simple event state transition actions into real SSA state-transition functions. */
function lowerEventActionsToSsa(
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

/**
 * Lower pure scalar TypeScript helper functions (arithmetic, cmp, ternary, if/else)
 * directly to SSA IR so LLVM opt/llc can compile authored pure logic to native/WASM.
 */
function tryLowerPureScalarFunction(
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
        return { id: b.binop('sub', 'f64', b.constF64(0), inner.id), type: 'f64' };
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

/**
 * Extract Proto SSA IR from a real TypeScript SourceFile using ts.Program + ts.TypeChecker.
 */
export function extractModuleIR(
  program: ts.Program,
  entryPath: string,
  options: ExtractOptions = {}
): ExtractOutput {
  const diagnostics: CompilerDiagnostic[] = [];
  const sf = program.getSourceFile(path.resolve(entryPath));
  if (!sf) {
    return {
      ir: {
        irVersion: PROTO_IR_VERSION,
        sourceFile: entryPath,
        prototypes: [],
        authoredHooks: [],
        functions: [],
      },
      diagnostics: [
        diagnostic(
          'PUI_FE001',
          'input',
          `Source file not found in TypeScript program: ${entryPath}`
        ),
      ],
    };
  }

  const checker = program.getTypeChecker();

  if (options.checkTypes) {
    const tsDiags = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
    for (const d of tsDiags) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const sp =
        d.file && d.start !== undefined
          ? (() => {
              const lc = d.file.getLineAndCharacterOfPosition(d.start);
              return { file: d.file.fileName, line: lc.line + 1, column: lc.character + 1 };
            })()
          : undefined;
      diagnostics.push(diagnostic(`TS${d.code}`, 'typecheck', msg, sp));
    }
  }

  const prototypes: PrototypeIR[] = [];
  const authoredHooks: AuthoredHookSummary[] = [];
  const moduleFunctions: SsaFunction[] = [];

  // Extract pure scalar helper functions declared at module top level.
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt)) {
      const lowered = tryLowerPureScalarFunction(stmt, checker);
      if (lowered) moduleFunctions.push(lowered);
    }
  }

  const moduleSym = checker.getSymbolAtLocation(sf);
  const exportsList = moduleSym ? checker.getExportsOfModule(moduleSym) : [];
  const seenCalls = new Set<ts.CallExpression>();

  for (const expSym of exportsList) {
    const expName = expSym.getName();
    if (options.exportName && expName !== options.exportName) continue;

    const target = resolveAliasedSymbol(checker, expSym);
    const decl = target?.valueDeclaration ?? target?.declarations?.[0];
    if (!decl) continue;

    let initExpr: ts.Expression | undefined;
    if (ts.isExportAssignment(decl)) initExpr = decl.expression;
    else if (ts.isVariableDeclaration(decl) && decl.initializer) initExpr = decl.initializer;

    if (!initExpr) continue;
    const found = findFactoryCall(initExpr, checker, [
      'definePrototype',
      'defineAsHook',
      'defineHook',
    ]);
    if (!found) continue;

    if (found.factory === 'definePrototype') {
      if (seenCalls.has(found.call) && !options.exportName) continue;
      seenCalls.add(found.call);
      const proto = extractPrototype(
        found.call,
        expName,
        expName === 'default',
        sf.fileName,
        checker
      );
      if (proto) prototypes.push(proto);
    } else {
      const hookSummary = extractAuthoredHookSummary(found.call, expName, found.factory, checker);
      if (hookSummary) authoredHooks.push(hookSummary);
    }
  }

  // Fallback: if no exported prototype matched and no explicit exportName was given, scan top-level statements.
  if (prototypes.length === 0 && authoredHooks.length === 0 && !options.exportName) {
    for (const stmt of sf.statements) {
      if (ts.isExportAssignment(stmt)) {
        const found = findFactoryCall(stmt.expression, checker, ['definePrototype']);
        if (found) {
          const proto = extractPrototype(found.call, 'default', true, sf.fileName, checker);
          if (proto) prototypes.push(proto);
        }
      }
    }
  }

  return {
    ir: {
      irVersion: PROTO_IR_VERSION,
      sourceFile: sf.fileName,
      prototypes,
      authoredHooks,
      functions: moduleFunctions,
    },
    diagnostics,
  };
}

function extractAuthoredHookSummary(
  call: ts.CallExpression,
  exportName: string,
  factory: string,
  checker: ts.TypeChecker
): AuthoredHookSummary | undefined {
  const arg = call.arguments[0] ? unwrapExpr(call.arguments[0]) : undefined;
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  const nameExpr = extractObjectProperty(arg, 'name');
  const nameLit = nameExpr ? extractScalarLiteral(nameExpr, checker) : undefined;
  const name = typeof nameLit === 'string' ? nameLit : exportName;
  const setupFn = extractSetupFunction(arg, checker);
  const proto = setupFn
    ? analyzeSetup(setupFn, name, exportName, false, call.getSourceFile().fileName, call, checker)
    : undefined;
  return {
    name,
    exportName,
    kind: factory === 'defineAsHook' ? 'as-hook' : 'hook',
    sourceFile: call.getSourceFile().fileName,
    capabilities: proto?.capabilities ?? [],
  };
}

function extractPrototype(
  call: ts.CallExpression,
  exportName: string,
  isDefaultExport: boolean,
  entryFile: string,
  checker: ts.TypeChecker
): PrototypeIR | undefined {
  const arg = call.arguments[0] ? unwrapExpr(call.arguments[0]) : undefined;
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  const nameExpr = extractObjectProperty(arg, 'name');
  const nameLit = nameExpr ? extractScalarLiteral(nameExpr, checker) : undefined;
  const name = typeof nameLit === 'string' ? nameLit : exportName;
  const setupFn = extractSetupFunction(arg, checker);

  // Extract explicit generic type arguments from `definePrototype<Props, Exposes>(...)`.
  const propsTypeText = call.typeArguments?.[0]?.getText(call.getSourceFile());
  const exposesTypeText = call.typeArguments?.[1]?.getText(call.getSourceFile());

  if (!setupFn) {
    const base = {
      name,
      exportName,
      isDefaultExport,
      sourceFile: entryFile,
      span: spanOf(call, call.getSourceFile()),
      tier: 'static' as CompilationTier,
      propsTypeText,
      exposesTypeText,
      props: [],
      states: [],
      exposes: [],
      events: [],
      hooks: [],
      contexts: [],
      staticStyleTokens: [],
      rules: [],
      lifecycle: [],
      render: { kind: 'default-slot' } as RenderIR,
      functions: [],
      stringTable: [],
    };
    return { ...base, ...computePrototypeCapabilities(base) };
  }

  return analyzeSetup(
    setupFn,
    name,
    exportName,
    isDefaultExport,
    entryFile,
    call,
    checker,
    propsTypeText,
    exposesTypeText
  );
}

function analyzeSetup(
  setupFn: ts.FunctionLikeDeclaration,
  name: string,
  exportName: string,
  isDefaultExport: boolean,
  entryFile: string,
  originCall: ts.CallExpression,
  checker: ts.TypeChecker,
  propsTypeText?: string,
  exposesTypeText?: string
): PrototypeIR {
  const propsMap = new Map<string, PropDeclIR>();
  const states: StateDeclIR[] = [];
  const stateVarToName = new Map<string, string>();
  const exposes: ExposeDeclIR[] = [];
  const events: EventDeclIR[] = [];
  const hooks: HookCallIR[] = [];
  const contexts: ContextUsageIR[] = [];
  const staticStyleTokens: string[] = [];
  const rules: RuleIR[] = [];
  const lifecycle = new Set<LifecycleHookName>();
  const stringTable: string[] = [];
  const renderBox: { current: RenderIR } = { current: { kind: 'default-slot' } };

  const visitedFns = new Set<ts.FunctionLikeDeclaration>();

  const recordContextCall = (method: string, keyArg: ts.Expression | undefined) => {
    const mode: ContextUsageIR['mode'] =
      method === 'provide'
        ? 'provide'
        : method.includes('Subscribe') || method === 'subscribe'
          ? 'subscribe'
          : method.includes('Update') || method === 'update'
            ? 'update'
            : 'read';
    const keyName = keyArg ? keyArg.getText(keyArg.getSourceFile()) : 'unknown';
    contexts.push({ keyName, mode });
  };

  const scanRunCallback = (cb: ts.FunctionLikeDeclaration | undefined) => {
    if (!cb?.body) return;
    const p0 = cb.parameters[0];
    const runName = p0 && ts.isIdentifier(p0.name) ? p0.name.text : undefined;
    if (!runName) return;
    const scan = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const ch = propAccessChain(n.expression);
        if (ch && ch[0] === runName && ch[1] === 'context' && ch.length >= 3) {
          recordContextCall(ch.slice(2).join('.'), n.arguments[0]);
        }
      }
      ts.forEachChild(n, scan);
    };
    scan(cb.body);
  };

  const walkFunction = (fn: ts.FunctionLikeDeclaration, defParamName?: string) => {
    if (!fn.body || visitedFns.has(fn)) return;
    visitedFns.add(fn);

    const p0 = fn.parameters[0];
    const defName = defParamName ?? (p0 && ts.isIdentifier(p0.name) ? p0.name.text : undefined);

    const visit = (node: ts.Node) => {
      // Do not descend into nested functions except when explicitly analyzing render/event/rule.
      if (node !== fn && ts.isFunctionLike(node)) return;

      // Capture return statement in top-level setup as RenderIR.
      if (fn === setupFn && ts.isReturnStatement(node) && node.expression) {
        const retFn = resolveFunctionLike(node.expression, checker);
        if (retFn && retFn.body) {
          const rp = retFn.parameters[0];
          const renderParam = rp && ts.isIdentifier(rp.name) ? rp.name.text : 'r';
          const bodyExpr = !ts.isBlock(retFn.body)
            ? retFn.body
            : retFn.body.statements.length === 1 &&
                ts.isReturnStatement(retFn.body.statements[0]) &&
                retFn.body.statements[0].expression
              ? retFn.body.statements[0].expression
              : undefined;
          if (bodyExpr) {
            const u = unwrapExpr(bodyExpr);
            if (ts.isCallExpression(u)) {
              const chain = propAccessChain(u.expression);
              if (chain && chain[0] === renderParam && chain[1] === 'slot') {
                renderBox.current = { kind: 'default-slot' };
              } else if (chain && chain[0] === renderParam && chain[1] === 'el') {
                const parsed = parseTemplateElement(u, renderParam, stateVarToName, checker);
                renderBox.current = parsed
                  ? { kind: parsed.reactive ? 'reactive-tree' : 'static-tree', root: parsed.node }
                  : { kind: 'dynamic' };
              } else {
                renderBox.current = { kind: 'dynamic' };
              }
            } else {
              renderBox.current = { kind: 'dynamic' };
            }
          } else {
            renderBox.current = { kind: 'dynamic' };
          }
        } else {
          renderBox.current = { kind: 'dynamic' };
        }
        return;
      }

      if (ts.isCallExpression(node)) {
        const chain = propAccessChain(node.expression);

        // 1. def.* operations
        if (defName && chain && chain[0] === defName) {
          const sub = chain.slice(1).join('.');

          // def.props.define({...})
          if (sub === 'props.define' && node.arguments[0]) {
            const obj = unwrapExpr(node.arguments[0]);
            if (ts.isObjectLiteralExpression(obj)) {
              for (const p of obj.properties) {
                if (!ts.isPropertyAssignment(p)) continue;
                const key =
                  ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : undefined;
                if (!key) continue;
                const spec = unwrapExpr(p.initializer);
                let kind: PropDeclIR['kind'] = 'any';
                let defaultValue: ScalarLiteral | undefined;
                let empty: PropDeclIR['empty'];
                let options: ScalarLiteral[] | undefined;

                if (ts.isObjectLiteralExpression(spec)) {
                  const typeExpr = extractObjectProperty(spec, 'type');
                  const typeLit = typeExpr ? extractScalarLiteral(typeExpr, checker) : undefined;
                  if (
                    typeLit === 'boolean' ||
                    typeLit === 'number' ||
                    typeLit === 'string' ||
                    typeLit === 'enum' ||
                    typeLit === 'object' ||
                    typeLit === 'any'
                  ) {
                    kind = typeLit;
                  }
                  const defExpr = extractObjectProperty(spec, 'default');
                  if (defExpr) defaultValue = extractScalarLiteral(defExpr, checker);
                  const emptyExpr = extractObjectProperty(spec, 'empty');
                  const emptyLit = emptyExpr ? extractScalarLiteral(emptyExpr, checker) : undefined;
                  if (emptyLit === 'accept' || emptyLit === 'fallback' || emptyLit === 'error') {
                    empty = emptyLit;
                  }
                  const optExpr = extractObjectProperty(spec, 'options');
                  if (optExpr && ts.isArrayLiteralExpression(unwrapExpr(optExpr))) {
                    options = (unwrapExpr(optExpr) as ts.ArrayLiteralExpression).elements
                      .map((el) => extractScalarLiteral(el, checker))
                      .filter((v): v is ScalarLiteral => v !== undefined);
                  }
                }

                const tsType =
                  kind === 'enum' && options?.length
                    ? options.map((v) => JSON.stringify(v)).join(' | ')
                    : kind === 'object'
                      ? 'Record<string, unknown>'
                      : kind === 'any'
                        ? 'unknown'
                        : kind;

                if (!propsMap.has(key)) {
                  propsMap.set(key, {
                    index: propsMap.size,
                    name: key,
                    tsType,
                    kind,
                    ...(defaultValue !== undefined ? { defaultValue } : {}),
                    ...(options ? { options } : {}),
                    ...(empty ? { empty } : {}),
                    ssaType: propKindToSsaType(kind),
                  });
                }
              }
            }
          }

          // def.props.setDefaults({...})
          else if (sub === 'props.setDefaults' && node.arguments[0]) {
            const obj = unwrapExpr(node.arguments[0]);
            if (ts.isObjectLiteralExpression(obj)) {
              for (const p of obj.properties) {
                if (!ts.isPropertyAssignment(p)) continue;
                const key =
                  ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : undefined;
                if (!key) continue;
                const existing = propsMap.get(key);
                const val = extractScalarLiteral(p.initializer, checker);
                if (existing && val !== undefined) {
                  propsMap.set(key, { ...existing, defaultValue: val });
                }
              }
            }
          }

          // def.state.{bool,string,enum,numberDiscrete,numberRange}(name, initial)
          else if (
            sub === 'state.bool' ||
            sub === 'state.string' ||
            sub === 'state.enum' ||
            sub === 'state.numberDiscrete' ||
            sub === 'state.numberRange'
          ) {
            const nameLit = node.arguments[0]
              ? extractScalarLiteral(node.arguments[0], checker)
              : undefined;
            const initLit = node.arguments[1]
              ? extractScalarLiteral(node.arguments[1], checker)
              : undefined;
            const kindMap: Record<string, StateDeclIR['kind']> = {
              'state.bool': 'bool',
              'state.string': 'string',
              'state.enum': 'enum',
              'state.numberDiscrete': 'number.discrete',
              'state.numberRange': 'number.range',
            };
            const kind = kindMap[sub];
            const stateName = typeof nameLit === 'string' ? nameLit : `state_${states.length}`;
            let variableName: string | undefined;
            if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
              variableName = node.parent.name.text;
              stateVarToName.set(variableName, stateName);
            }
            states.push({
              index: states.length,
              name: stateName,
              variableName,
              kind,
              ...(initLit !== undefined ? { initialValue: initLit } : {}),
              ssaType: stateKindToSsaType(kind),
            });
          }

          // def.expose.{state,event,method,value}
          else if (
            sub === 'expose.state' ||
            sub === 'expose.event' ||
            sub === 'expose.method' ||
            sub === 'expose.value'
          ) {
            const keyLit = node.arguments[0]
              ? extractScalarLiteral(node.arguments[0], checker)
              : undefined;
            if (typeof keyLit === 'string') {
              const kind = sub.slice('expose.'.length) as ExposeDeclIR['kind'];
              const valType = node.arguments[1]
                ? checker.typeToString(checker.getTypeAtLocation(node.arguments[1]))
                : 'void';
              exposes.push({ name: keyLit, kind, tsType: valType });
            }
          }

          // def.props.watch / def.props.watchAll / def.props.watchRaw
          else if (sub.startsWith('props.watch')) {
            const cbArg = node.arguments[node.arguments.length - 1];
            if (cbArg) scanRunCallback(resolveFunctionLike(cbArg, checker));
          }

          // def.event.on / def.event.onGlobal
          else if (sub === 'event.on' || sub === 'event.onGlobal') {
            const evLit = node.arguments[0]
              ? extractScalarLiteral(node.arguments[0], checker)
              : undefined;
            if (typeof evLit === 'string') {
              const handler = node.arguments[1]
                ? resolveFunctionLike(node.arguments[1], checker)
                : undefined;
              scanRunCallback(handler);
              const simpleAction = handler
                ? detectSimpleEventAction(handler, stateVarToName, checker)
                : undefined;
              events.push({
                scope: sub === 'event.onGlobal' ? 'global' : 'root',
                eventName: evLit,
                ...(simpleAction ? { simpleAction } : {}),
              });
            }
          }

          // def.lifecycle.*
          else if (sub.startsWith('lifecycle.')) {
            const method = sub.slice('lifecycle.'.length) as LifecycleHookName;
            if (LIFECYCLE_METHODS.has(method)) lifecycle.add(method);
            const cbArg = node.arguments[0];
            if (cbArg) scanRunCallback(resolveFunctionLike(cbArg, checker));
          }

          // def.context.*
          else if (sub.startsWith('context.')) {
            const method = sub.slice('context.'.length);
            recordContextCall(method, node.arguments[0]);
            if (node.arguments[1]) scanRunCallback(resolveFunctionLike(node.arguments[1], checker));
          }

          // def.feedback.style.use(tw(...))
          else if (sub === 'feedback.style.use') {
            for (const a of node.arguments) collectTwTokens(a, checker, staticStyleTokens);
          }

          // def.rule({ when: (w) => ..., intent: (i) => ... })
          else if (sub === 'rule' && node.arguments[0]) {
            const obj = unwrapExpr(node.arguments[0]);
            if (ts.isObjectLiteralExpression(obj)) {
              const whenExpr = extractObjectProperty(obj, 'when');
              const intentExpr = extractObjectProperty(obj, 'intent');
              const styleTokens: string[] = [];
              if (intentExpr) collectTwTokens(intentExpr, checker, styleTokens);
              let condition: RuleExpr = { kind: 'true' };
              let dynamic = false;
              if (whenExpr) {
                const whenFn = resolveFunctionLike(whenExpr, checker);
                if (whenFn && whenFn.body) {
                  const wp = whenFn.parameters[0];
                  const wName = wp && ts.isIdentifier(wp.name) ? wp.name.text : 'w';
                  const bodyExpr = !ts.isBlock(whenFn.body)
                    ? whenFn.body
                    : whenFn.body.statements.length === 1 &&
                        ts.isReturnStatement(whenFn.body.statements[0]) &&
                        whenFn.body.statements[0].expression
                      ? whenFn.body.statements[0].expression
                      : undefined;
                  const parsed = bodyExpr
                    ? parseRuleCondition(bodyExpr, wName, stateVarToName, checker)
                    : undefined;
                  if (parsed) condition = parsed;
                  else dynamic = true;
                } else {
                  dynamic = true;
                }
              }
              rules.push({
                id: rules.length,
                condition,
                styleTokens,
                ...(dynamic ? { dynamic: true } : {}),
              });
            }
          }
        }

        // 2. Hook calls (`asTrigger()`, `asFocusable()`, `asButton()`, ...)
        const resolved = resolveCallName(node.expression, checker);
        if (resolved) {
          if (BUILTIN_HOOK_NAMES.has(resolved.name)) {
            hooks.push({
              name: resolved.name,
              moduleSpecifier: resolved.sourceFile,
              kind: 'builtin',
            });
          } else if (resolved.name.startsWith('as') && /^as[A-Z]/.test(resolved.name)) {
            hooks.push({
              name: resolved.name,
              moduleSpecifier: resolved.sourceFile,
              kind: 'authored',
            });
            // Follow authored hook's setup if defined via defineAsHook in the program!
            const sym = resolveAliasedSymbol(
              checker,
              checker.getSymbolAtLocation(unwrapExpr(node.expression))
            );
            const decl = sym?.valueDeclaration ?? sym?.declarations?.[0];
            if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
              const hookFactory = findFactoryCall(decl.initializer, checker, [
                'defineAsHook',
                'defineHook',
              ]);
              const hookArg = hookFactory?.call.arguments[0]
                ? unwrapExpr(hookFactory.call.arguments[0])
                : undefined;
              if (hookArg && ts.isObjectLiteralExpression(hookArg)) {
                const nestedSetup = extractSetupFunction(hookArg, checker);
                if (nestedSetup) walkFunction(nestedSetup);
              }
            }
          } else if (
            defName &&
            node.arguments.some(
              (a) =>
                ts.isIdentifier(unwrapExpr(a)) && (unwrapExpr(a) as ts.Identifier).text === defName
            )
          ) {
            // Follow local helper calls passing `def` (e.g. `setupShadcnStyleSelection(def, ...)`).
            const helperFn = resolveFunctionLike(node.expression, checker);
            if (helperFn) {
              const defArgIdx = node.arguments.findIndex(
                (a) =>
                  ts.isIdentifier(unwrapExpr(a)) &&
                  (unwrapExpr(a) as ts.Identifier).text === defName
              );
              const targetParam = helperFn.parameters[defArgIdx];
              const targetParamName =
                targetParam && ts.isIdentifier(targetParam.name)
                  ? targetParam.name.text
                  : undefined;
              if (targetParamName) walkFunction(helperFn, targetParamName);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(fn.body);
  };

  walkFunction(setupFn);

  const props = [...propsMap.values()];
  const protoSym = sanitizeSym(name);

  // Lower rules & simple event actions into real executable SSA functions!
  const functions: SsaFunction[] = [];
  for (const rule of rules) {
    if (!rule.dynamic) {
      functions.push(lowerRuleToSsa(protoSym, rule, props, states, stringTable));
    }
  }
  const compiledRules = rules.filter((r) => !r.dynamic);
  if (compiledRules.length > 0) {
    functions.push(lowerCombinedRuleMask(protoSym, compiledRules));
  }
  functions.push(...lowerEventActionsToSsa(protoSym, events, states, stringTable));

  const render = renderBox.current;
  // Determine compilation tier honestly from actual reached capabilities!
  const hasProtocolFeatures =
    hooks.length > 0 ||
    exposes.length > 0 ||
    contexts.length > 0 ||
    lifecycle.size > 0 ||
    rules.length > 0 ||
    render.kind === 'dynamic';

  let tier: CompilationTier = 'protocol';
  if (!hasProtocolFeatures && states.length === 0 && events.length === 0) {
    tier = 'static';
  } else if (
    !hasProtocolFeatures &&
    (render.kind === 'reactive-tree' || render.kind === 'static-tree') &&
    events.every((e) => e.scope === 'root' && e.simpleAction !== undefined)
  ) {
    tier = 'reactive';
  }

  const partial = {
    name,
    exportName,
    isDefaultExport,
    sourceFile: entryFile,
    span: spanOf(originCall, originCall.getSourceFile()),
    tier,
    propsTypeText,
    exposesTypeText,
    props,
    states,
    exposes,
    events,
    hooks,
    contexts,
    staticStyleTokens,
    rules,
    lifecycle: [...lifecycle],
    render,
    functions,
    stringTable,
  };

  return {
    ...partial,
    ...computePrototypeCapabilities(partial),
  };
}
