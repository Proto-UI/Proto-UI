import { mergeTwTokensV0 } from '../../core/src/spec/feedback/semantic-merge';
import { assertTwTokenV0 } from '../../core/src/spec/feedback/tokens';
import { acceptsValue, type DataType } from './data-types';
import { CompilerRejection, reject } from './diagnostics';
import type { CompileResult, Primitive, SourceSpan } from './ir';
import type { RuleCondition, RuleDeclarationIR, RuleDependency, RuleValue } from './rule-declarations';
import type { StylePlan } from './style-plan';

export interface RulePlan {
  kind: 'rule.plan';
  schemaVersion: 1;
  /** Rule v0 merges active declarations in source declaration order; later semantic groups win. */
  precedence: 'declaration-order';
  rules: readonly RuleDeclarationIR[];
  dependencies: readonly RuleDependency[];
}
export interface RuleEvaluationContext {
  props: Readonly<Record<string, Primitive>>;
  /** Portable identity -> current value, not handles/getter callbacks. */
  states: Readonly<Record<string, Primitive>>;
}
export interface RuleEvaluation {
  activeRuleIds: readonly number[];
  activatedRuleIds: readonly number[];
  withdrawnRuleIds: readonly number[];
  /** The existing RulePlanV0 result, for this rule layer only. */
  style: { kind: 'style.tokens'; tokens: readonly string[] };
  /** Diff of this layer only. Use StyleProjection diff for host/consumer ownership. */
  addedTokens: readonly string[];
  removedTokens: readonly string[];
  /** Disabled declarations remain visible so target value admission is not data-dependent. */
  stylePlan: StylePlan;
}

const fallbackSpan: SourceSpan = {
  file: '<rule-plan>', start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1,
};
const declarationArrayType: DataType = {
  kind: 'array', element: { kind: 'record', fields: [] },
};
function fail(message: string, span: SourceSpan): never {
  return reject('PUI2024', message, span, 'invalid-ir');
}
const dependencyKey = (dependency: RuleDependency | RuleValue): string => {
  if ('kind' in dependency)
    return dependency.kind === 'prop' ? `prop:${dependency.key}` : `state:${dependency.id}`;
  return dependency.type === 'prop' ? `prop:${dependency.key}` : `state:${dependency.id}`;
};

function record(value: unknown, required: readonly string[], optional: readonly string[], span: SourceSpan): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a Rule plan record.', span);
  const result = value as Record<string, unknown>;
  if (required.some((key) => !Object.hasOwn(result, key)) ||
    Object.keys(result).some((key) => !required.includes(key) && !optional.includes(key)))
    fail('Rule plan record has missing or unexpected fields.', span);
  return result;
}

function array(value: unknown, span: SourceSpan): unknown[] {
  if (!Array.isArray(value)) fail('Expected a Rule plan array.', span);
  return value;
}

function name(value: unknown, span: SourceSpan): string {
  if (typeof value !== 'string' || !value.length) fail('Expected a nonempty portable Rule identity.', span);
  return value;
}

function sourceLocation(value: unknown, fallback: SourceSpan): SourceSpan {
  const span = record(value, ['file', 'start', 'end', 'line', 'column', 'endLine', 'endColumn'], [], fallback);
  name(span.file, fallback);
  for (const field of ['start', 'end', 'line', 'column', 'endLine', 'endColumn']) {
    const position = span[field];
    if (typeof position !== 'number' || !Number.isSafeInteger(position) ||
      position < (field === 'start' || field === 'end' ? 0 : 1))
      fail('Rule source span positions must be valid safe integers.', fallback);
  }
  const result = value as SourceSpan;
  if (result.end < result.start || result.endLine < result.line ||
    (result.endLine === result.line && result.endColumn < result.column))
    fail('Rule source span end precedes its start.', fallback);
  return result;
}

function validateCondition(value: unknown, fallback: SourceSpan, dependencies: Set<string>): void {
  const raw = record(value, ['type', 'span'], ['left', 'right', 'expr', 'exprs'], fallback);
  const span = sourceLocation(raw.span, fallback);
  switch (raw.type) {
    case 'true': case 'false':
      record(value, ['type', 'span'], [], span);
      return;
    case 'eq': {
      record(value, ['type', 'left', 'right', 'span'], [], span);
      const left = record(raw.left, ['type', 'span'], ['key', 'id'], span);
      const leftSpan = sourceLocation(left.span, span);
      if (left.type === 'prop') {
        record(raw.left, ['type', 'key', 'span'], [], leftSpan);
        name(left.key, leftSpan);
      } else if (left.type === 'state') {
        record(raw.left, ['type', 'id', 'span'], [], leftSpan);
        name(left.id, leftSpan);
      } else fail('Only prop/state comparisons are supported by a portable Rule plan.', leftSpan);
      if (raw.right !== null && !['boolean', 'string', 'number'].includes(typeof raw.right))
        fail('Rule comparisons require concrete finite primitive literals.', span);
      const key = dependencyKey(raw.left as RuleValue);
      if (!dependencies.has(key)) fail('Rule condition reads a signal missing from its dependency list.', leftSpan);
      return;
    }
    case 'not':
      record(value, ['type', 'expr', 'span'], [], span);
      validateCondition(raw.expr, span, dependencies);
      return;
    case 'all': case 'any':
      record(value, ['type', 'exprs', 'span'], [], span);
      for (const expression of array(raw.exprs, span)) validateCondition(expression, span, dependencies);
      return;
    default: fail('Unknown Rule WhenExpr operator.', span);
  }
}

/** Validate serialized closure without invoking functions, accessors or authoring callbacks. */
export function lowerRulePlan(
  declarations: readonly RuleDeclarationIR[],
  diagnosticSpan: SourceSpan = fallbackSpan
): CompileResult<RulePlan> {
  try {
    // Shared JSON boundary checks descriptors before reading values, rejecting live/host objects.
    if (!acceptsValue(declarationArrayType, declarations))
      fail('Rule declarations must contain only finite JSON data, without functions, getters, cycles or live handles.', diagnosticSpan);
    const rules: RuleDeclarationIR[] = [];
    const ids = new Set<number>();
    const orders = new Set<number>();
    const operationIds = new Set<string>();
    for (const value of declarations) {
      const raw = record(value, ['operation', 'id', 'order', 'deps', 'when', 'intent', 'span'], ['label', 'note'], diagnosticSpan);
      const span = sourceLocation(raw.span, diagnosticSpan);
      if (raw.operation !== 'rule.declare') fail('Expected the typed rule.declare operation.', span);
      if (typeof raw.id !== 'number' || !Number.isSafeInteger(raw.id) || raw.id < 1 || ids.has(raw.id))
        fail('Rule declaration IDs must be unique positive safe integers.', span);
      if (typeof raw.order !== 'number' || !Number.isSafeInteger(raw.order) || raw.order < 0 || orders.has(raw.order))
        fail('Rule declaration orders must be unique nonnegative safe integers.', span);
      ids.add(raw.id);
      orders.add(raw.order);
      for (const metadata of ['label', 'note']) {
        if (Object.hasOwn(raw, metadata) && typeof raw[metadata] !== 'string')
          fail('Rule metadata must be static strings.', span);
      }
      const dependencies = new Set<string>();
      for (const dependency of array(raw.deps, span)) {
        const dep = record(dependency, ['kind', 'span'], ['key', 'id'], span);
        const depSpan = sourceLocation(dep.span, span);
        if (dep.kind === 'prop') {
          record(dependency, ['kind', 'key', 'span'], [], depSpan);
          name(dep.key, depSpan);
        } else if (dep.kind === 'state') {
          record(dependency, ['kind', 'id', 'span'], [], depSpan);
          name(dep.id, depSpan);
        } else fail('Only declared prop/state dependencies are supported by this Rule plan.', depSpan);
        const typed = dependency as RuleDependency;
        const key = dependencyKey(typed);
        if (dependencies.has(key)) fail('Rule dependency identities must not be repeated.', depSpan);
        dependencies.add(key);
      }
      validateCondition(raw.when, span, dependencies);
      const intent = record(raw.intent, ['kind', 'ops'], [], span);
      if (intent.kind !== 'ops') fail('Expected the existing Rule ops intent shape.', span);
      for (const operation of array(intent.ops, span)) {
        const op = record(operation, ['kind', 'id', 'handles', 'span'], [], span);
        const opSpan = sourceLocation(op.span, span);
        if (op.kind !== 'feedback.style.use')
          fail('Only reversible feedback.style.use intents are supported in this Rule plan.', opSpan);
        const id = name(op.id, opSpan);
        if (operationIds.has(id)) fail('Rule intent operation IDs must be unique.', opSpan);
        operationIds.add(id);
        for (const handle of array(op.handles, opSpan)) {
          const style = record(handle, ['kind', 'tokens'], [], opSpan);
          if (style.kind !== 'tw') fail('Rule v0 style intents support tw token handles only.', opSpan);
          for (const token of array(style.tokens, opSpan)) {
            if (typeof token !== 'string') fail('Rule style tokens must be strings.', opSpan);
            try { assertTwTokenV0(token, 'compiler rule plan'); }
            catch (error) {
              if (!(error instanceof Error)) throw error;
              fail(error.message, opSpan);
            }
          }
        }
      }
      rules.push(value);
    }
    rules.sort((left, right) => left.order - right.order);
    const allDependencies: RuleDependency[] = [];
    const allDependencyKeys = new Set<string>();
    for (const rule of rules) {
      for (const dependency of rule.deps) {
        const key = dependencyKey(dependency);
        if (allDependencyKeys.has(key)) continue;
        allDependencyKeys.add(key);
        allDependencies.push(dependency);
      }
    }
    return { ok: true, value: {
      kind: 'rule.plan', schemaVersion: 1, precedence: 'declaration-order',
      rules, dependencies: allDependencies,
    } };
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    throw error;
  }
}

function readSignal(value: RuleValue, context: RuleEvaluationContext): Primitive | undefined {
  const values = value.type === 'prop' ? context.props : context.states;
  const key = value.type === 'prop' ? value.key : value.id;
  // Prototype members are not authored prop/state values (including a key named "constructor").
  return Object.hasOwn(values, key) ? values[key] : undefined;
}

function evaluateCondition(condition: RuleCondition, context: RuleEvaluationContext): boolean {
  switch (condition.type) {
    case 'true': return true;
    case 'false': return false;
    case 'eq': return readSignal(condition.left, context) === condition.right;
    case 'not': return !evaluateCondition(condition.expr, context);
    case 'all':
      for (const expression of condition.exprs) if (!evaluateCondition(expression, context)) return false;
      return true;
    case 'any':
      for (const expression of condition.exprs) if (evaluateCondition(expression, context)) return true;
      return false;
  }
}

/** Pure consumer evaluation of a checked plan. Recompute from declarations to restore earlier
 * winners when a later rule withdraws; token removal alone cannot implement this precedence.
 * Pass stylePlan to the shared style consumer to combine with base/patch/consumer layers.
 */
export function evaluateRulePlan(
  plan: RulePlan,
  context: RuleEvaluationContext,
  previous?: RuleEvaluation
): RuleEvaluation {
  const activeRuleIds: number[] = [];
  const tokens: string[] = [];
  const contributions: StylePlan['contributions'][number][] = [];
  for (const rule of plan.rules) {
    const enabled = evaluateCondition(rule.when, context);
    contributions.push({
      id: `rule:${rule.id}`, scope: 'host', layer: 'rule', enabled,
      intents: rule.intent.ops.map((operation) => ({ kind: operation.kind, handles: operation.handles })),
      span: rule.span,
    });
    if (!enabled) continue;
    activeRuleIds.push(rule.id);
    for (const operation of rule.intent.ops)
      for (const handle of operation.handles) tokens.push(...handle.tokens);
  }
  const merged = mergeTwTokensV0(tokens).tokens;
  const wasActive = new Set(previous?.activeRuleIds ?? []);
  const isActive = new Set(activeRuleIds);
  const oldTokens = new Set(previous?.style.tokens ?? []);
  const newTokens = new Set(merged);
  return {
    activeRuleIds,
    activatedRuleIds: activeRuleIds.filter((id) => !wasActive.has(id)),
    withdrawnRuleIds: (previous?.activeRuleIds ?? []).filter((id) => !isActive.has(id)),
    style: { kind: 'style.tokens', tokens: merged },
    addedTokens: merged.filter((token) => !oldTokens.has(token)),
    removedTokens: (previous?.style.tokens ?? []).filter((token) => !newTokens.has(token)),
    stylePlan: { contributions },
  };
}
