import ts from 'typescript';
import { getSemanticGroupKeyV0 } from '@proto.ui/core';
import { diagnostic, type CompilerDiagnostic } from '../diagnostics';
import type {
  ActionStatementIR,
  EventDeclIR,
  PropDeclIR,
  PrototypeIR,
  RuleExpr,
  ScalarLiteral,
  StateDeclIR,
  TemplateChildIR,
  TemplateElementIR,
  ValueExprIR,
} from '../ir';

export interface ReactEmitOptions {
  readonly componentName?: string;
  /** Kept for callers migrating from v2. Native output never imports its source. */
  readonly prototypeImport?: string;
  /** Kept for callers migrating from v2. Native output never imports a Proto runtime. */
  readonly runtimeImport?: string;
  readonly outputFile?: string;
  readonly rootDir?: string;
}

export interface ReactEmitResult {
  readonly code: string;
  readonly componentName: string;
  readonly tier: PrototypeIR['tier'];
  readonly dependencies: readonly string[];
}

const f = ts.factory;
const id = (name: string) => f.createIdentifier(name);
const prop = (value: ts.Expression, name: string) => f.createPropertyAccessExpression(value, name);
const item = (value: ts.Expression, name: string) =>
  f.createElementAccessExpression(value, f.createStringLiteral(name));
const call = (
  value: ts.Expression,
  args: readonly ts.Expression[] = [],
  types?: readonly ts.TypeNode[]
) => f.createCallExpression(value, types, args);
const react = (name: string, args: readonly ts.Expression[] = [], types?: readonly ts.TypeNode[]) =>
  call(prop(id('React'), name), args, types);
const bin = (left: ts.Expression, op: ts.BinaryOperator, right: ts.Expression) =>
  f.createBinaryExpression(left, op, right);
const eq = (a: ts.Expression, b: ts.Expression) => bin(a, ts.SyntaxKind.EqualsEqualsEqualsToken, b);
const ne = (a: ts.Expression, b: ts.Expression) =>
  bin(a, ts.SyntaxKind.ExclamationEqualsEqualsToken, b);
const and = (a: ts.Expression, b: ts.Expression) =>
  bin(a, ts.SyntaxKind.AmpersandAmpersandToken, b);
const or = (a: ts.Expression, b: ts.Expression) => bin(a, ts.SyntaxKind.BarBarToken, b);
const not = (value: ts.Expression) =>
  f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, value);
const assign = (left: ts.Expression, right: ts.Expression) =>
  f.createExpressionStatement(bin(left, ts.SyntaxKind.EqualsToken, right));
const block = (statements: readonly ts.Statement[]) => f.createBlock(statements, true);
const reactType = (name: string) =>
  f.createTypeReferenceNode(f.createQualifiedName(id('React'), name));
const nullable = (type: ts.TypeNode) =>
  f.createUnionTypeNode([type, f.createLiteralTypeNode(f.createNull())]);

function variable(
  name: string | ts.BindingName,
  init: ts.Expression,
  type?: ts.TypeNode,
  mutable = false
): ts.VariableStatement {
  return f.createVariableStatement(
    undefined,
    f.createVariableDeclarationList(
      [f.createVariableDeclaration(name, undefined, type, init)],
      mutable ? ts.NodeFlags.Let : ts.NodeFlags.Const
    )
  );
}

function scalar(value: ScalarLiteral): ts.Expression {
  if (value === null) return f.createNull();
  if (typeof value === 'boolean') return value ? f.createTrue() : f.createFalse();
  if (typeof value === 'string') return f.createStringLiteral(value);
  if (Number.isNaN(value))
    return bin(f.createNumericLiteral(0), ts.SyntaxKind.SlashToken, f.createNumericLiteral(0));
  if (!Number.isFinite(value)) {
    const infinity = bin(
      f.createNumericLiteral(1),
      ts.SyntaxKind.SlashToken,
      f.createNumericLiteral(0)
    );
    return value < 0 ? f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, infinity) : infinity;
  }
  if (value < 0 || Object.is(value, -0))
    return f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, f.createNumericLiteral(-value));
  return f.createNumericLiteral(value);
}

function scalarType(kind: PropDeclIR['kind'] | StateDeclIR['kind']): ts.TypeNode {
  switch (kind) {
    case 'boolean':
    case 'bool':
      return f.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    case 'number':
    case 'number.discrete':
    case 'number.range':
      return f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    default:
      return f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  }
}

// The event payload is not used by the currently admitted ActionStatementIR.
// Attach native listeners so React's synthesized change/focus semantics do not
// silently replace a Proto event's host mapping.
const DOM_EVENTS: Readonly<Record<string, string>> = {
  'key.down': 'keydown',
  'key.up': 'keyup',
  'pointer.down': 'pointerdown',
  'pointer.move': 'pointermove',
  'pointer.up': 'pointerup',
  'pointer.cancel': 'pointercancel',
  'pointer.enter': 'pointerenter',
  'pointer.leave': 'pointerleave',
  'input': 'input',
  'change': 'change',
  'context.menu': 'contextmenu',
  'host:click': 'click',
  'host:keydown': 'keydown',
  'host:keyup': 'keyup',
  'host:pointerdown': 'pointerdown',
  'host:pointerup': 'pointerup',
  'host:pointermove': 'pointermove',
  'host:pointercancel': 'pointercancel',
  'host:pointerenter': 'pointerenter',
  'host:pointerleave': 'pointerleave',
  'host:input': 'input',
  'host:change': 'change',
  'host:contextmenu': 'contextmenu',
  'host:focus': 'focus',
  'host:blur': 'blur',
};
const SUPPORTED_CAPABILITIES = new Set([
  'props',
  'state',
  'event',
  'style',
  'rule',
  'render',
  'lifecycle',
]);
const RESERVED_COMPONENT_NAMES = new Set([
  'React',
  'Number',
  'String',
  'Boolean',
  'Object',
  'TypeError',
]);

interface ValueContext {
  readonly stateMode?: 'live' | 'created';
  readonly currentProps?: 'render' | 'committed';
  readonly previousProps?: ts.Expression;
}

function validStateValue(
  state: StateDeclIR,
  value: ScalarLiteral | undefined,
  isInitial: boolean
): boolean {
  if (value === undefined) return false;
  if (state.kind === 'bool') return typeof value === 'boolean';
  if (state.kind === 'string' || state.kind === 'enum') {
    return (
      typeof value === 'string' &&
      (state.kind !== 'enum' || !!state.options?.length) &&
      (!state.options?.length || state.options.includes(value))
    );
  }
  if (typeof value !== 'number' || Number.isNaN(value)) return false;
  if (state.kind === 'number.range' && (state.min === undefined || state.max === undefined))
    return false;
  if (state.options?.length) return state.options.includes(value);
  if (!(isInitial && state.kind === 'number.range' && state.clamp)) {
    if (state.min !== undefined && value < state.min) return false;
    if (state.max !== undefined && value > state.max) return false;
  }
  return (
    state.step === undefined ||
    state.step <= 0 ||
    Number.isInteger((value - (state.min ?? 0)) / state.step)
  );
}

function checkValue(
  expr: ValueExprIR,
  proto: PrototypeIR,
  locals: ReadonlySet<string>,
  reject: (message: string) => void,
  previousAllowed = false
): void {
  switch (expr.kind) {
    case 'literal':
      return;
    case 'state':
      if (!proto.states.some((state) => state.name === expr.name))
        reject('Action reads an undeclared state: ' + expr.name + '.');
      return;
    case 'prop':
      if (!proto.props.some((declaration) => declaration.name === expr.name))
        reject('Action reads an undeclared prop: ' + expr.name + '.');
      if (expr.source === 'previous' && !previousAllowed)
        reject('Previous resolved props are available only inside a props watcher.');
      return;
    case 'local':
      if (!locals.has(expr.name)) reject('Action reads an undeclared local: ' + expr.name + '.');
      return;
    case 'unary':
      return checkValue(expr.operand, proto, locals, reject, previousAllowed);
    case 'binary':
      checkValue(expr.left, proto, locals, reject, previousAllowed);
      checkValue(expr.right, proto, locals, reject, previousAllowed);
      return;
    case 'conditional':
      checkValue(expr.condition, proto, locals, reject, previousAllowed);
      checkValue(expr.then, proto, locals, reject, previousAllowed);
      checkValue(expr.otherwise, proto, locals, reject, previousAllowed);
  }
}

function checkActions(
  actions: readonly ActionStatementIR[],
  proto: PrototypeIR,
  outer: ReadonlySet<string>,
  reject: (message: string) => void,
  previousAllowed = false
): void {
  const locals = new Set(outer);
  const declaredHere = new Set<string>();
  for (const action of actions) {
    switch (action.kind) {
      case 'state-set':
        if (!proto.states.some((state) => state.name === action.stateName))
          reject('Action writes an undeclared state: ' + action.stateName + '.');
        checkValue(action.value, proto, locals, reject, previousAllowed);
        break;
      case 'local':
        checkValue(action.value, proto, locals, reject, previousAllowed);
        if (declaredHere.has(action.name))
          reject('Action local is declared more than once: ' + action.name + '.');
        declaredHere.add(action.name);
        locals.add(action.name);
        break;
      case 'if':
        checkValue(action.condition, proto, locals, reject, previousAllowed);
        checkActions(action.then, proto, locals, reject, previousAllowed);
        checkActions(action.otherwise, proto, locals, reject, previousAllowed);
        break;
      case 'return':
        break;
    }
  }
}

/** Admission is based on represented semantics, never the old protocol tier label. */
export function getReactLoweringDiagnostics(proto: PrototypeIR): readonly CompilerDiagnostic[] {
  const issues: CompilerDiagnostic[] = [];
  const reject = (message: string) =>
    issues.push(diagnostic('PUI_REACT_UNSUPPORTED', 'codegen', message, proto.span));
  for (const remaining of proto.unlowered ?? [])
    issues.push(
      diagnostic(
        'PUI_REACT_UNSUPPORTED',
        'codegen',
        remaining.operation + ': ' + remaining.message,
        remaining.span ?? proto.span
      )
    );
  if (proto.render.kind === 'dynamic')
    reject('React AST lowering does not cover this dynamic render expression.');
  for (const cap of proto.capabilities)
    if (!SUPPORTED_CAPABILITIES.has(cap))
      reject('React AST lowering does not yet cover capability: ' + cap + '.');
  if (proto.hooks.length)
    reject('Hook bodies must be lowered to supported semantic operations before React emission.');
  if (proto.contexts.length)
    reject('Context operations need executable semantic IR before React emission.');
  if (proto.exposes.length)
    reject('Expose operations need executable semantic IR before React emission.');
  const lifecyclePhases: Readonly<Record<string, string>> = {
    onCreated: 'created',
    onMounted: 'mounted',
    onUpdated: 'updated',
    onUnmounted: 'unmounted',
  };
  for (const registration of proto.lifecycle) {
    const phase = lifecyclePhases[registration];
    if (!phase || !proto.lifecycleHandlers?.some((handler) => handler.phase === phase))
      reject('Lifecycle registration has no executable native lowering: ' + registration + '.');
  }
  for (const handler of proto.lifecycleHandlers ?? []) {
    if (handler.phase === 'before-dispose')
      reject('Terminal disposal cannot be equated with React effect cleanup or StrictMode replay.');
    checkActions(handler.body, proto, new Set(), reject);
  }
  for (const watch of proto.propWatches ?? []) {
    if (
      watch.keys &&
      (!watch.keys.length ||
        watch.keys.some((key) => !proto.props.some((declaration) => declaration.name === key)))
    )
      reject('A keyed props watcher requires non-empty declared keys.');
    checkActions(watch.body, proto, new Set(), reject, true);
  }
  for (const declaration of proto.props) {
    if (declaration.kind === 'object' || declaration.kind === 'any')
      reject(
        'Native React prop validation does not yet cover non-scalar prop: ' + declaration.name + '.'
      );
    if (
      declaration.kind === 'enum' &&
      (!declaration.options?.length ||
        declaration.options.some((value) => typeof value !== 'string'))
    )
      reject('Enum prop requires a non-empty string domain: ' + declaration.name + '.');
    if (['className', 'style', 'children'].includes(declaration.name))
      reject(
        'Declared prop collides with React host presentation input: ' + declaration.name + '.'
      );
  }
  for (const state of proto.states) {
    if (!validStateValue(state, state.initialValue, true))
      reject('State initial value or domain is missing or invalid: ' + state.name + '.');
  }
  for (const event of proto.events) {
    if (event.scope !== 'root')
      reject('Global event ownership is not yet represented by React AST lowering.');
    if (!Object.hasOwn(DOM_EVENTS, event.eventName))
      reject(
        'Event requires explicit host semantics before React emission: ' + event.eventName + '.'
      );
    if (event.body) {
      checkActions(event.body, proto, new Set(), reject);
      continue;
    }
    if (!event.simpleAction) {
      reject('Event callback requires executable semantic IR: ' + event.eventName + '.');
      continue;
    }
    const action = event.simpleAction;
    const state = proto.states.find((declaration) => declaration.name === action.stateName);
    if (!state) {
      reject('Event references an undeclared state: ' + action.stateName + '.');
      continue;
    }
    if (action.kind === 'toggle-state' && state.kind !== 'bool')
      reject('Toggle requires a boolean state: ' + action.stateName + '.');
    if (
      action.kind === 'increment-state' &&
      ((state.kind !== 'number.discrete' && state.kind !== 'number.range') ||
        Number.isNaN(action.delta))
    )
      reject('Increment requires a numeric state and non-NaN delta: ' + action.stateName + '.');
    if (action.kind === 'set-state' && !validStateValue(state, action.value, false))
      reject('Literal state update violates the declared domain: ' + action.stateName + '.');
  }
  const checkCondition = (condition: RuleExpr): void => {
    if (condition.kind === 'not') return checkCondition(condition.expr);
    if (condition.kind === 'all' || condition.kind === 'any') {
      condition.exprs.forEach(checkCondition);
      return;
    }
    if (condition.kind !== 'cmp') return;
    const declaration =
      condition.source === 'prop'
        ? proto.props.find((value) => value.name === condition.key)
        : condition.source === 'state'
          ? proto.states.find((value) => value.name === condition.key)
          : undefined;
    if (!declaration)
      reject(
        'Rule condition requires a declared prop or state: ' +
          condition.source +
          '.' +
          condition.key +
          '.'
      );
    if (
      condition.operator === 'gte' &&
      (typeof condition.value !== 'number' ||
        !Number.isFinite(condition.value) ||
        !declaration ||
        !['number', 'number.discrete', 'number.range'].includes(declaration.kind))
    )
      reject('Rule gte requires numeric operands and a finite threshold.');
  };
  for (const rule of proto.rules) {
    if (rule.dynamic) reject('Dynamic rule conditions require executable semantic IR.');
    checkCondition(rule.condition);
  }
  const checkChildren = (children: readonly TemplateChildIR[]): void => {
    for (const child of children) {
      if (
        child.kind === 'prop-read' &&
        !proto.props.some((declaration) => declaration.name === child.propName)
      )
        reject('Render references an undeclared prop: ' + child.propName + '.');
      if (
        child.kind === 'state-read' &&
        !proto.states.some((state) => state.name === child.stateName)
      )
        reject('Render references an undeclared state: ' + child.stateName + '.');
      if (child.kind === 'element') checkChildren(child.node.children);
    }
  };
  if (proto.render.kind === 'static-tree' || proto.render.kind === 'reactive-tree')
    checkChildren(proto.render.root.children);
  return issues;
}

export function toPascalCase(name: string): string {
  const parts = name
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'CompiledComponent';
  const result = parts.map((part) => part[0].toUpperCase() + part.slice(1)).join('');
  return /^[0-9]/.test(result) ? 'C' + result : result;
}

function throwError(message: string): ts.ThrowStatement {
  return f.createThrowStatement(
    f.createNewExpression(id('TypeError'), undefined, [f.createStringLiteral(message)])
  );
}

function isEmpty(value: ts.Expression): ts.Expression {
  return or(eq(value, f.createNull()), eq(value, f.createVoidZero()));
}

function validPropExpression(declaration: PropDeclIR, value: ts.Expression): ts.Expression {
  let result: ts.Expression = eq(
    f.createTypeOfExpression(value),
    f.createStringLiteral(declaration.kind === 'enum' ? 'string' : declaration.kind)
  );
  if (declaration.kind === 'number')
    result = and(result, call(prop(id('Number'), 'isFinite'), [value]));
  if (declaration.kind === 'enum')
    result = and(
      result,
      call(
        prop(f.createArrayLiteralExpression((declaration.options ?? []).map(scalar)), 'includes'),
        [value]
      )
    );
  if (declaration.range?.min !== undefined)
    result = and(
      result,
      bin(value, ts.SyntaxKind.GreaterThanEqualsToken, scalar(declaration.range.min))
    );
  if (declaration.range?.max !== undefined)
    result = and(
      result,
      bin(value, ts.SyntaxKind.LessThanEqualsToken, scalar(declaration.range.max))
    );
  return result;
}

function isValidPropDefault(declaration: PropDeclIR): boolean {
  const value = declaration.defaultValue;
  if (value === undefined || value === null) return false;
  if (declaration.kind === 'enum')
    return typeof value === 'string' && !!declaration.options?.includes(value);
  if (typeof value !== declaration.kind) return false;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    if (declaration.range?.min !== undefined && value < declaration.range.min) return false;
    if (declaration.range?.max !== undefined && value > declaration.range.max) return false;
  }
  return true;
}

/** Native refs hold only committed previous valid props; interrupted renders do not mutate history. */
function emitPropResolution(declaration: PropDeclIR, index: number): ts.Statement[] {
  const resolved = id('_prop' + index);
  const previous = id('_previousProp' + index);
  const previousValue = prop(previous, 'current');
  const raw = id('_rawProp' + index);
  const provided = id('_providedProp' + index);
  const remember = id('_rememberProp' + index);
  const type = nullable(scalarType(declaration.kind));
  const defaultValue = isValidPropDefault(declaration)
    ? scalar(declaration.defaultValue!)
    : f.createNull();
  const acceptsEmpty = declaration.empty === 'accept';
  const requireNonEmpty = declaration.empty === 'error';
  const missing: ts.Statement[] = [assign(resolved, defaultValue)];
  if (requireNonEmpty)
    missing.push(
      f.createIfStatement(
        eq(resolved, f.createNull()),
        throwError('Missing prop has no non-empty fallback: ' + declaration.name + '.')
      )
    );
  const unusable: ts.Statement[] = [
    assign(
      resolved,
      f.createConditionalExpression(
        ne(previousValue, f.createNull()),
        undefined,
        previousValue,
        undefined,
        defaultValue
      )
    ),
    assign(remember, ne(resolved, f.createNull())),
  ];
  if (requireNonEmpty)
    unusable.push(
      f.createIfStatement(
        eq(resolved, f.createNull()),
        throwError('Unusable prop has no non-empty fallback: ' + declaration.name + '.')
      )
    );
  const providedResolution = f.createIfStatement(
    acceptsEmpty ? isEmpty(raw) : f.createFalse(),
    block([assign(resolved, f.createNull())]),
    f.createIfStatement(
      validPropExpression(declaration, raw),
      block([assign(resolved, raw), assign(remember, f.createTrue())]),
      block(unusable)
    )
  );
  return [
    variable(previous, react('useRef', [f.createNull()], [type])),
    variable(
      provided,
      call(prop(prop(prop(id('Object'), 'prototype'), 'hasOwnProperty'), 'call'), [
        id('props'),
        f.createStringLiteral(declaration.name),
      ])
    ),
    variable(
      raw,
      f.createConditionalExpression(
        provided,
        undefined,
        item(id('props'), declaration.name),
        undefined,
        f.createVoidZero()
      )
    ),
    variable(resolved, f.createNull(), type, true),
    variable(remember, f.createFalse(), undefined, true),
    f.createIfStatement(not(provided), block(missing), providedResolution),
    f.createExpressionStatement(
      react('useLayoutEffect', [
        f.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          block([f.createIfStatement(remember, assign(previousValue, resolved))])
        ),
        f.createArrayLiteralExpression([resolved, remember]),
      ])
    ),
  ];
}

function stateValidity(state: StateDeclIR, value: ts.Expression): ts.Expression {
  const kind =
    state.kind === 'bool'
      ? 'boolean'
      : state.kind === 'enum'
        ? 'string'
        : state.kind.startsWith('number.')
          ? 'number'
          : state.kind;
  let result = eq(f.createTypeOfExpression(value), f.createStringLiteral(kind));
  if (kind === 'number') result = and(result, not(call(prop(id('Number'), 'isNaN'), [value])));
  if (state.options?.length)
    return and(
      result,
      call(prop(f.createArrayLiteralExpression(state.options.map(scalar)), 'includes'), [value])
    );
  if (state.min !== undefined)
    result = and(result, bin(value, ts.SyntaxKind.GreaterThanEqualsToken, scalar(state.min)));
  if (state.max !== undefined)
    result = and(result, bin(value, ts.SyntaxKind.LessThanEqualsToken, scalar(state.max)));
  if (state.step !== undefined && state.step > 0)
    result = and(
      result,
      call(prop(id('Number'), 'isInteger'), [
        bin(
          bin(value, ts.SyntaxKind.MinusToken, scalar(state.min ?? 0)),
          ts.SyntaxKind.SlashToken,
          scalar(state.step)
        ),
      ])
    );
  return result;
}

function initialStateValue(state: StateDeclIR): ScalarLiteral {
  let value = state.initialValue!;
  if (state.kind === 'number.range' && state.clamp && typeof value === 'number') {
    if (state.min !== undefined && value < state.min) value = state.min;
    if (state.max !== undefined && value > state.max) value = state.max;
  }
  return value;
}

function emitState(state: StateDeclIR, index: number, created: boolean): ts.Statement[] {
  const type = scalarType(state.kind);
  const initial = created
    ? f.createElementAccessExpression(id('_createdStates'), index)
    : scalar(initialStateValue(state));
  const ref = id('_stateRef' + index);
  const next = id('_nextState');
  return [
    variable(
      f.createArrayBindingPattern([
        f.createBindingElement(undefined, undefined, '_state' + index),
        f.createBindingElement(undefined, undefined, '_setState' + index),
      ]),
      react('useState', [initial], [type])
    ),
    variable(ref, react('useRef', [initial], [type])),
    variable(
      '_writeState' + index,
      f.createArrowFunction(
        undefined,
        undefined,
        [
          f.createParameterDeclaration(
            undefined,
            undefined,
            next,
            undefined,
            f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
          ),
        ],
        undefined,
        undefined,
        block([
          f.createIfStatement(
            not(stateValidity(state, next)),
            throwError('State update violates domain: ' + state.name + '.')
          ),
          assign(prop(ref, 'current'), next),
          f.createExpressionStatement(call(id('_setState' + index), [next])),
        ])
      )
    ),
  ];
}

const operatorTokens: Readonly<Record<string, ts.BinaryOperator>> = {
  '+': ts.SyntaxKind.PlusToken,
  '-': ts.SyntaxKind.MinusToken,
  '*': ts.SyntaxKind.AsteriskToken,
  '/': ts.SyntaxKind.SlashToken,
  '%': ts.SyntaxKind.PercentToken,
  '===': ts.SyntaxKind.EqualsEqualsEqualsToken,
  '!==': ts.SyntaxKind.ExclamationEqualsEqualsToken,
  '<': ts.SyntaxKind.LessThanToken,
  '<=': ts.SyntaxKind.LessThanEqualsToken,
  '>': ts.SyntaxKind.GreaterThanToken,
  '>=': ts.SyntaxKind.GreaterThanEqualsToken,
  '&&': ts.SyntaxKind.AmpersandAmpersandToken,
  '||': ts.SyntaxKind.BarBarToken,
  '??': ts.SyntaxKind.QuestionQuestionToken,
};

const operatorHelpers: Readonly<Record<string, string>> = {
  '+': '_valueAdd',
  '-': '_valueSubtract',
  '*': '_valueMultiply',
  '/': '_valueDivide',
  '%': '_valueRemainder',
  '===': '_valueEqual',
  '!==': '_valueNotEqual',
  '<': '_valueLess',
  '<=': '_valueLessEqual',
  '>': '_valueGreater',
  '>=': '_valueGreaterEqual',
  '&&': '_valueAnd',
  '||': '_valueOr',
  '??': '_valueCoalesce',
};

function primitiveType(): ts.TypeNode {
  return f.createUnionTypeNode([
    f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
    f.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
    f.createLiteralTypeNode(f.createNull()),
  ]);
}

/** Lower primitive JavaScript operators explicitly, retaining coercion and lazy RHS evaluation. */
function emitValueHelpers(prototype: PrototypeIR): ts.Statement[] {
  const operators = new Set<string>();
  const value = (expression: ValueExprIR): void => {
    if (expression.kind === 'unary') value(expression.operand);
    else if (expression.kind === 'binary') {
      operators.add(expression.operator);
      value(expression.left);
      value(expression.right);
    } else if (expression.kind === 'conditional') {
      value(expression.condition);
      value(expression.then);
      value(expression.otherwise);
    }
  };
  const actions = (body: readonly ActionStatementIR[]): void => {
    for (const action of body) {
      if (action.kind === 'state-set' || action.kind === 'local') value(action.value);
      else if (action.kind === 'if') {
        value(action.condition);
        actions(action.then);
        actions(action.otherwise);
      }
    }
  };
  const rule = (condition: RuleExpr): void => {
    if (condition.kind === 'cmp' && condition.operator === 'eq') operators.add('===');
    else if (condition.kind === 'not') rule(condition.expr);
    else if (condition.kind === 'all' || condition.kind === 'any') condition.exprs.forEach(rule);
  };
  for (const event of prototype.events) if (event.body) actions(event.body);
  for (const handler of prototype.lifecycleHandlers ?? []) actions(handler.body);
  for (const watch of prototype.propWatches ?? []) actions(watch.body);
  for (const definition of prototype.rules) rule(definition.condition);
  return [...operators].map((operator) => {
    const left = id('_left');
    const right = id('_right');
    const lazy = operator === '&&' || operator === '||' || operator === '??';
    const numeric = (operand: ts.Expression) => call(id('Number'), [operand]);
    const string = (operand: ts.Expression) => call(id('String'), [operand]);
    const isString = (operand: ts.Expression) =>
      eq(f.createTypeOfExpression(operand), f.createStringLiteral('string'));
    let expression: ts.Expression;
    if (lazy) expression = bin(left, operatorTokens[operator], call(right));
    else if (operator === '===' || operator === '!==')
      expression = bin(left, operatorTokens[operator], right);
    else if (operator === '+')
      expression = f.createConditionalExpression(
        or(isString(left), isString(right)),
        undefined,
        bin(string(left), ts.SyntaxKind.PlusToken, string(right)),
        undefined,
        bin(numeric(left), ts.SyntaxKind.PlusToken, numeric(right))
      );
    else if (['<', '<=', '>', '>='].includes(operator))
      expression = f.createConditionalExpression(
        and(isString(left), isString(right)),
        undefined,
        bin(left, operatorTokens[operator], right),
        undefined,
        bin(numeric(left), operatorTokens[operator], numeric(right))
      );
    else expression = bin(numeric(left), operatorTokens[operator], numeric(right));
    return variable(
      operatorHelpers[operator],
      f.createArrowFunction(
        undefined,
        undefined,
        [
          f.createParameterDeclaration(undefined, undefined, left, undefined, primitiveType()),
          f.createParameterDeclaration(
            undefined,
            undefined,
            right,
            undefined,
            lazy ? f.createFunctionTypeNode(undefined, [], primitiveType()) : primitiveType()
          ),
        ],
        undefined,
        undefined,
        expression
      )
    );
  });
}

function emitValue(
  expression: ValueExprIR,
  proto: PrototypeIR,
  locals: ReadonlyMap<string, string>,
  context: ValueContext = {}
): ts.Expression {
  switch (expression.kind) {
    case 'literal':
      return scalar(expression.value);
    case 'state': {
      const index = proto.states.findIndex((state) => state.name === expression.name);
      return context.stateMode === 'created'
        ? id('_createdState' + index)
        : prop(id('_stateRef' + index), 'current');
    }
    case 'prop': {
      const index = proto.props.findIndex((declaration) => declaration.name === expression.name);
      if (expression.source === 'previous')
        return f.createElementAccessExpression(context.previousProps!, index);
      if (context.currentProps === 'committed')
        return f.createElementAccessExpression(prop(id('_committedProps'), 'current'), index);
      return id('_prop' + index);
    }
    case 'local':
      return id(locals.get(expression.name)!);
    case 'unary': {
      const operand = emitValue(expression.operand, proto, locals, context);
      if (expression.operator === '!') return not(call(id('Boolean'), [operand]));
      const numeric = call(id('Number'), [operand]);
      return expression.operator === '-'
        ? f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, numeric)
        : numeric;
    }
    case 'binary': {
      const left = emitValue(expression.left, proto, locals, context);
      let right = emitValue(expression.right, proto, locals, context);
      if (['&&', '||', '??'].includes(expression.operator))
        right = f.createArrowFunction(undefined, undefined, [], undefined, undefined, right);
      return call(id(operatorHelpers[expression.operator]), [left, right]);
    }
    case 'conditional':
      return f.createConditionalExpression(
        call(id('Boolean'), [emitValue(expression.condition, proto, locals, context)]),
        undefined,
        emitValue(expression.then, proto, locals, context),
        undefined,
        emitValue(expression.otherwise, proto, locals, context)
      );
  }
}

function emitActions(
  actions: readonly ActionStatementIR[],
  proto: PrototypeIR,
  inherited: ReadonlyMap<string, string>,
  counter: { value: number },
  context: ValueContext = {}
): ts.Statement[] {
  const locals = new Map(inherited);
  const output: ts.Statement[] = [];
  for (const action of actions) {
    switch (action.kind) {
      case 'state-set':
        output.push(
          f.createExpressionStatement(
            call(
              id(
                (context.stateMode === 'created' ? '_createdWriteState' : '_writeState') +
                  proto.states.findIndex((state) => state.name === action.stateName)
              ),
              [emitValue(action.value, proto, locals, context)]
            )
          )
        );
        break;
      case 'local': {
        const name = '_local' + counter.value++;
        output.push(variable(name, emitValue(action.value, proto, locals, context)));
        locals.set(action.name, name);
        break;
      }
      case 'if':
        output.push(
          f.createIfStatement(
            call(id('Boolean'), [emitValue(action.condition, proto, locals, context)]),
            block(emitActions(action.then, proto, locals, counter, context)),
            action.otherwise.length
              ? block(emitActions(action.otherwise, proto, locals, counter, context))
              : undefined
          )
        );
        break;
      case 'return':
        output.push(f.createReturnStatement());
        break;
    }
  }
  return output;
}

function emitCondition(condition: RuleExpr, prototype: PrototypeIR): ts.Expression {
  if (condition.kind === 'true') return f.createTrue();
  if (condition.kind === 'false') return f.createFalse();
  if (condition.kind === 'not') return not(emitCondition(condition.expr, prototype));
  if (condition.kind === 'all' || condition.kind === 'any') {
    const values = condition.exprs.map((expression) => emitCondition(expression, prototype));
    const identity = condition.kind === 'all' ? f.createTrue() : f.createFalse();
    return values.reduce(
      (acc, value) => (condition.kind === 'all' ? and(acc, value) : or(acc, value)),
      identity
    );
  }
  const source =
    condition.source === 'prop'
      ? id('_prop' + prototype.props.findIndex((declaration) => declaration.name === condition.key))
      : id('_state' + prototype.states.findIndex((state) => state.name === condition.key));
  if (condition.operator === 'eq')
    return call(id(operatorHelpers['===']), [source, scalar(condition.value)]);
  return and(
    and(
      eq(f.createTypeOfExpression(source), f.createStringLiteral('number')),
      call(prop(id('Number'), 'isFinite'), [source])
    ),
    bin(source, ts.SyntaxKind.GreaterThanEqualsToken, scalar(condition.value))
  );
}

function invokeActions(
  actions: readonly ActionStatementIR[],
  prototype: PrototypeIR,
  context: ValueContext = {}
): ts.Statement {
  return f.createExpressionStatement(
    call(
      f.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        block(emitActions(actions, prototype, new Map(), { value: 0 }, context))
      )
    )
  );
}

function propsTupleType(prototype: PrototypeIR): ts.TupleTypeNode {
  return f.createTupleTypeNode(
    prototype.props.map((declaration) => nullable(scalarType(declaration.kind)))
  );
}

function propsTupleValue(prototype: PrototypeIR): ts.ArrayLiteralExpression {
  return f.createArrayLiteralExpression(
    prototype.props.map((_declaration, index) => id('_prop' + index))
  );
}

/** Created callbacks are pure state/props computations, evaluated before the first native render. */
function emitCreatedInitializer(prototype: PrototypeIR): ts.Statement[] {
  const handlers = (prototype.lifecycleHandlers ?? []).filter(
    (handler) => handler.phase === 'created'
  );
  if (!handlers.length) return [];
  const body: ts.Statement[] = [];
  prototype.states.forEach((state, index) => {
    const next = id('_nextState');
    body.push(
      variable(
        '_createdState' + index,
        scalar(initialStateValue(state)),
        scalarType(state.kind),
        true
      ),
      variable(
        '_createdWriteState' + index,
        f.createArrowFunction(
          undefined,
          undefined,
          [
            f.createParameterDeclaration(
              undefined,
              undefined,
              next,
              undefined,
              f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
            ),
          ],
          undefined,
          undefined,
          block([
            f.createIfStatement(
              not(stateValidity(state, next)),
              throwError('Created state update violates domain: ' + state.name + '.')
            ),
            assign(id('_createdState' + index), next),
          ])
        )
      )
    );
  });
  for (const handler of handlers)
    body.push(invokeActions(handler.body, prototype, { stateMode: 'created' }));
  body.push(
    f.createReturnStatement(
      f.createArrayLiteralExpression(
        prototype.states.map((_state, index) => id('_createdState' + index))
      )
    )
  );
  return [
    variable(
      '_createdStates',
      f.createElementAccessExpression(
        react(
          'useState',
          [f.createArrowFunction(undefined, undefined, [], undefined, undefined, block(body))],
          [f.createTupleTypeNode(prototype.states.map((state) => scalarType(state.kind)))]
        ),
        0
      )
    ),
  ];
}

/** Keep the last committed props available to unmount callbacks without stale closures. */
function emitCommittedProps(prototype: PrototypeIR): ts.Statement[] {
  if (!(prototype.lifecycleHandlers ?? []).some((handler) => handler.phase !== 'created'))
    return [];
  return [
    variable(
      '_committedProps',
      react('useRef', [propsTupleValue(prototype)], [propsTupleType(prototype)])
    ),
    f.createExpressionStatement(
      react('useLayoutEffect', [
        f.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          block([assign(prop(id('_committedProps'), 'current'), propsTupleValue(prototype))])
        ),
      ])
    ),
  ];
}

/** Dispatch resolved changes in registration order after commit and before updated callbacks. */
function emitPropWatches(prototype: PrototypeIR): ts.Statement[] {
  const watches = prototype.propWatches ?? [];
  if (!watches.length) return [];
  const previous = id('_watchPrevious');
  const body: ts.Statement[] = [
    variable(previous, prop(id('_watchSnapshot'), 'current')),
    // Clear the pending window before invoking callbacks, matching the canonical dispatcher.
    assign(prop(id('_watchSnapshot'), 'current'), propsTupleValue(prototype)),
  ];
  const dispatch: ts.Statement[] = [];
  for (const watch of watches) {
    const keys = watch.keys ?? prototype.props.map((declaration) => declaration.name);
    const changed = keys
      .map((key) => {
        const index = prototype.props.findIndex((declaration) => declaration.name === key);
        return not(
          call(prop(id('Object'), 'is'), [
            f.createElementAccessExpression(previous, index),
            id('_prop' + index),
          ])
        );
      })
      .reduce((result, condition) => or(result, condition), f.createFalse() as ts.Expression);
    dispatch.push(
      f.createIfStatement(
        changed,
        block([invokeActions(watch.body, prototype, { previousProps: previous })])
      )
    );
  }
  body.push(f.createIfStatement(ne(previous, f.createNull()), block(dispatch)));
  return [
    variable(
      '_watchSnapshot',
      react('useRef', [f.createNull()], [nullable(propsTupleType(prototype))])
    ),
    f.createExpressionStatement(
      react('useLayoutEffect', [
        f.createArrowFunction(undefined, undefined, [], undefined, undefined, block(body)),
      ])
    ),
  ];
}

/** Native commit effects implement the admitted view lifetime; terminal disposal remains unsupported. */
function emitLifecycleEffects(prototype: PrototypeIR): ts.Statement[] {
  const handlers = prototype.lifecycleHandlers ?? [];
  const mounted = handlers.filter((handler) => handler.phase === 'mounted');
  const updated = handlers.filter((handler) => handler.phase === 'updated');
  const unmounted = handlers.filter((handler) => handler.phase === 'unmounted');
  if (!mounted.length && !updated.length && !unmounted.length) return [];
  const hasCommitted = prop(id('_lifecycleMounted'), 'current');
  const context: ValueContext = { currentProps: 'committed' };
  const mountBody: ts.Statement[] = [assign(hasCommitted, f.createTrue())];
  mounted.forEach((handler) => mountBody.push(invokeActions(handler.body, prototype, context)));
  const updateBody = updated.map((handler) => invokeActions(handler.body, prototype, context));
  const cleanup: ts.Statement[] = [assign(hasCommitted, f.createFalse())];
  unmounted.forEach((handler) => cleanup.push(invokeActions(handler.body, prototype, context)));
  return [
    variable('_lifecycleMounted', react('useRef', [f.createFalse()])),
    f.createExpressionStatement(
      react('useLayoutEffect', [
        f.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          block([f.createIfStatement(not(hasCommitted), block(mountBody), block(updateBody))])
        ),
      ])
    ),
    f.createExpressionStatement(
      react('useLayoutEffect', [
        f.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          block([
            f.createReturnStatement(
              f.createArrowFunction(undefined, undefined, [], undefined, undefined, block(cleanup))
            ),
          ])
        ),
        f.createArrayLiteralExpression([]),
      ])
    ),
  ];
}

function eventBody(event: EventDeclIR, prototype: PrototypeIR): ts.Statement[] {
  if (event.body) return emitActions(event.body, prototype, new Map(), { value: 0 });
  const action = event.simpleAction!;
  const index = prototype.states.findIndex((state) => state.name === action.stateName);
  const current = prop(id('_stateRef' + index), 'current');
  const next =
    action.kind === 'increment-state'
      ? bin(current, ts.SyntaxKind.PlusToken, scalar(action.delta))
      : action.kind === 'toggle-state'
        ? not(current)
        : scalar(action.value);
  return [f.createExpressionStatement(call(id('_writeState' + index), [next]))];
}

function emitEventEffects(prototype: PrototypeIR): ts.Statement[] {
  if (!prototype.events.length) return [];
  const root = id('_eventRoot');
  const setup: ts.Statement[] = [
    variable(root, prop(id('_rootRef'), 'current')),
    f.createIfStatement(eq(root, f.createNull()), f.createReturnStatement()),
  ];
  const cleanup: ts.Statement[] = [];
  prototype.events.forEach((event, index) => {
    const listener = id('_listener' + index);
    const nativeEvent = f.createStringLiteral(DOM_EVENTS[event.eventName]);
    setup.push(
      variable(
        listener,
        f.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          undefined,
          block(eventBody(event, prototype))
        )
      ),
      f.createExpressionStatement(call(prop(root, 'addEventListener'), [nativeEvent, listener]))
    );
    cleanup.push(
      f.createExpressionStatement(call(prop(root, 'removeEventListener'), [nativeEvent, listener]))
    );
  });
  setup.push(
    f.createReturnStatement(
      f.createArrowFunction(undefined, undefined, [], undefined, undefined, block(cleanup))
    )
  );
  return [
    variable(
      '_rootRef',
      react('useRef', [f.createNull()], [nullable(f.createTypeReferenceNode('Element'))])
    ),
    f.createExpressionStatement(
      react('useLayoutEffect', [
        f.createArrowFunction(undefined, undefined, [], undefined, undefined, block(setup)),
      ])
    ),
  ];
}

interface ConditionalToken {
  readonly token: string;
  readonly condition?: ts.Expression;
}

/** Resolve the finite semantic groups at compile time; output only native selections. */
function emitMergedTokens(tokens: readonly ConditionalToken[]): ts.Expression[] {
  const groups = new Map<string, ConditionalToken[]>();
  for (const token of tokens) {
    const key = getSemanticGroupKeyV0(token.token);
    const group = groups.get(key) ?? [];
    group.push(token);
    groups.set(key, group);
  }
  const earlier = new Map<string, ConditionalToken[]>();
  const output: ts.Expression[] = [];
  for (const token of tokens) {
    const key = getSemanticGroupKeyV0(token.token);
    const preceding = earlier.get(key) ?? [];
    earlier.set(key, [...preceding, token]);
    if (preceding.some((value) => !value.condition)) continue;
    let selected: ts.Expression = f.createVoidZero();
    for (const candidate of groups.get(key)!) {
      selected = candidate.condition
        ? f.createConditionalExpression(
            candidate.condition,
            undefined,
            f.createStringLiteral(candidate.token),
            undefined,
            selected
          )
        : f.createStringLiteral(candidate.token);
    }
    const isFirst = preceding.reduce(
      (condition, value) => and(condition, not(value.condition!)),
      token.condition ?? f.createTrue()
    );
    output.push(
      !token.condition && !preceding.length
        ? selected
        : f.createConditionalExpression(isFirst, undefined, selected, undefined, f.createVoidZero())
    );
  }
  return output;
}

function emitTemplate(
  node: TemplateElementIR,
  prototype: PrototypeIR,
  root: boolean
): ts.Expression {
  const properties: ts.ObjectLiteralElementLike[] = [];
  const classes: ts.Expression[] = root ? [prop(id('props'), 'className')] : [];
  const tokens: ConditionalToken[] = [];
  if (root) for (const token of prototype.staticStyleTokens) tokens.push({ token });
  for (const token of node.styleTokens ?? []) tokens.push({ token });
  if (root)
    prototype.rules.forEach((rule, index) => {
      for (const token of rule.styleTokens) tokens.push({ token, condition: id('_rule' + index) });
    });
  classes.push(...emitMergedTokens(tokens));
  if (classes.length)
    properties.push(
      f.createPropertyAssignment(
        'className',
        or(
          call(
            prop(
              call(prop(f.createArrayLiteralExpression(classes), 'filter'), [id('Boolean')]),
              'join'
            ),
            [f.createStringLiteral(' ')]
          ),
          f.createVoidZero()
        )
      )
    );
  if (root) {
    properties.push(f.createPropertyAssignment('style', prop(id('props'), 'style')));
    if (prototype.events.length)
      properties.push(
        f.createPropertyAssignment(
          'ref',
          f.createArrowFunction(
            undefined,
            undefined,
            [
              f.createParameterDeclaration(
                undefined,
                undefined,
                '_element',
                undefined,
                nullable(f.createTypeReferenceNode('Element'))
              ),
            ],
            undefined,
            undefined,
            block([assign(prop(id('_rootRef'), 'current'), id('_element'))])
          )
        )
      );
  }
  const child = (value: TemplateChildIR): ts.Expression => {
    switch (value.kind) {
      case 'text':
        return f.createStringLiteral(value.value);
      case 'slot':
        return prop(id('props'), 'children');
      case 'prop-read':
        return id(
          '_prop' + prototype.props.findIndex((declaration) => declaration.name === value.propName)
        );
      case 'state-read':
        return id('_state' + prototype.states.findIndex((state) => state.name === value.stateName));
      case 'element':
        return emitTemplate(value.node, prototype, false);
    }
  };
  return react('createElement', [
    f.createStringLiteral(node.tag),
    properties.length ? f.createObjectLiteralExpression(properties, true) : f.createNull(),
    ...node.children.map(child),
  ]);
}

/** Construct target nodes directly; TypeScript's printer alone serializes source. */
export function emitReactComponent(
  prototype: PrototypeIR,
  options: ReactEmitOptions = {}
): ReactEmitResult {
  const issues = getReactLoweringDiagnostics(prototype);
  if (issues.length)
    throw new Error(issues.map((issue) => issue.code + ': ' + issue.message).join('\n'));
  const defaultName = toPascalCase(prototype.name);
  const componentName =
    options.componentName ??
    (RESERVED_COMPONENT_NAMES.has(defaultName) ? 'Compiled' + defaultName : defaultName);
  if (!/^[A-Z_$][A-Za-z0-9_$]*$/.test(componentName))
    throw new Error('React componentName must be a valid uppercase or prefixed identifier.');
  if (RESERVED_COMPONENT_NAMES.has(componentName))
    throw new Error(
      'React componentName shadows an imported or native binding: ' + componentName + '.'
    );
  const propsName = componentName + 'Props';
  const propsMembers = prototype.props.map((declaration) =>
    f.createPropertySignature(
      undefined,
      f.createStringLiteral(declaration.name),
      f.createToken(ts.SyntaxKind.QuestionToken),
      nullable(scalarType(declaration.kind))
    )
  );
  propsMembers.push(
    f.createPropertySignature(
      undefined,
      'className',
      f.createToken(ts.SyntaxKind.QuestionToken),
      f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
    ),
    f.createPropertySignature(
      undefined,
      'style',
      f.createToken(ts.SyntaxKind.QuestionToken),
      reactType('CSSProperties')
    ),
    f.createPropertySignature(
      undefined,
      'children',
      f.createToken(ts.SyntaxKind.QuestionToken),
      reactType('ReactNode')
    )
  );
  const statements: ts.Statement[] = [
    f.createImportDeclaration(
      undefined,
      f.createImportClause(false, undefined, f.createNamespaceImport(id('React'))),
      f.createStringLiteral('react')
    ),
    f.createInterfaceDeclaration(
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      propsName,
      undefined,
      undefined,
      propsMembers
    ),
  ];
  const body: ts.Statement[] = [...emitValueHelpers(prototype)];
  prototype.props.forEach((declaration, index) =>
    body.push(...emitPropResolution(declaration, index))
  );
  const hasCreated = !!prototype.lifecycleHandlers?.some((handler) => handler.phase === 'created');
  body.push(...emitCreatedInitializer(prototype));
  prototype.states.forEach((state, index) => body.push(...emitState(state, index, hasCreated)));
  body.push(...emitCommittedProps(prototype));
  body.push(...emitEventEffects(prototype));
  body.push(...emitPropWatches(prototype));
  body.push(...emitLifecycleEffects(prototype));
  // Compute each pure condition once. Reusing the boolean also keeps control-flow
  // narrowing inside token selection from turning repeated comparisons into
  // contradictory TypeScript expressions.
  prototype.rules.forEach((rule, index) =>
    body.push(variable('_rule' + index, emitCondition(rule.condition, prototype)))
  );
  const root: TemplateElementIR =
    prototype.render.kind === 'static-tree' || prototype.render.kind === 'reactive-tree'
      ? prototype.render.root
      : { tag: 'div', children: [{ kind: 'slot' }] };
  body.push(f.createReturnStatement(emitTemplate(root, prototype, true)));
  statements.push(
    f.createFunctionDeclaration(
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      undefined,
      componentName,
      undefined,
      [
        f.createParameterDeclaration(
          undefined,
          undefined,
          'props',
          undefined,
          f.createTypeReferenceNode(propsName)
        ),
      ],
      reactType('ReactElement'),
      block(body)
    ),
    f.createExportAssignment(undefined, false, id(componentName))
  );
  const source = f.createSourceFile(
    statements,
    f.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  );
  return {
    code: ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(source),
    componentName,
    tier:
      prototype.props.length ||
      prototype.states.length ||
      prototype.events.length ||
      prototype.lifecycleHandlers?.length ||
      prototype.propWatches?.length
        ? 'reactive'
        : 'static',
    dependencies: ['react'],
  };
}
