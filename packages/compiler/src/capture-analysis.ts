import type { AuthoredHookIR, FunctionIR, HookCaptureIR, StatementIR } from './ir';
import { reject } from './diagnostics';
import { traceSetupOperations, traceHookContributions } from './callable-effects';
import { functionValueType, valueAssignable } from './value-types';
import { stateValue, privilegedHookCaptures } from './operations';

/** Derive direct setup capture through checked lexical calls; nested hooks stay separate. */
export function deriveHookCapture(
  setup: FunctionIR,
  moduleBindings: readonly StatementIR[],
  hookNames: ReadonlyMap<string, string>,
  hooks: readonly AuthoredHookIR[] = []
): HookCaptureIR {
  const states = new Map<string, HookCaptureIR['states'][number]>();
  const methods = new Map<string, HookCaptureIR['methods'][number]>();
  const children = new Map<string, HookCaptureIR['children'][number]>();
  const issue = traceSetupOperations(
    setup,
    moduleBindings,
    {
      operation(value) {
        for (const child of privilegedHookCaptures(value)) children.set(child.id, child);
        const key = value.arguments[0];
        if (key?.kind !== 'literal' || typeof key.value !== 'string') return;
        const name = key.value;
        if (value.operation.startsWith('state.') && stateValue(value.type))
          states.set(name, { name, type: value.type });
        if (value.operation === 'expose.method') {
          const method = value.arguments[1];
          const type =
            method.kind === 'function' ? functionValueType(method.function) : method.type;
          if (typeof type !== 'string' && type.kind === 'callable')
            methods.set(name, { name, type });
        }
      },
      hook(value) {
        const name = hookNames.get(value.hookId);
        if (name) children.set(value.hookId, { id: value.hookId, name });
      },
    },
    hooks
  );
  if (issue) reject('PUI1007', issue.message, issue.span);
  const definite = new Set<string>();
  for (const statement of setup.body) {
    if (statement.kind === 'return' || statement.kind === 'throw') break;
    if (statement.kind === 'if' || statement.kind === 'try') {
      // A reachable return in either branch can bypass later declarations.
      const returns = (body: readonly StatementIR[]): boolean => body.some((item) =>
        item.kind === 'return' || (item.kind === 'if' &&
          (returns(item.then) || returns(item.otherwise))) || (item.kind === 'try' &&
          (returns(item.body) || returns(item.catch?.body ?? []) || returns(item.finally ?? []))));
      if (returns([statement])) break;
      continue;
    }
    const value = statement.kind === 'const' ? statement.value : statement.expression;
    if (value.kind !== 'operation' || !value.operation.startsWith('state.')) continue;
    const key = value.arguments[0];
    if (key?.kind === 'literal' && typeof key.value === 'string' && stateValue(value.type))
      definite.add(key.value);
  }
  for (const [name, state] of states)
    if (definite.has(name)) states.set(name, { ...state, definite: true });
  return {
    states: [...states.values()],
    methods: [...methods.values()],
    children: [...children.values()],
  };
}

/** A schema is an upper bound; each live installation keeps its own capture values. */
export function mergeHookCaptures(
  values: readonly HookCaptureIR[],
  span: import('./ir').SourceSpan
): HookCaptureIR {
  const states = new Map<string, HookCaptureIR['states'][number]>();
  const methods = new Map<string, HookCaptureIR['methods'][number]>();
  const children = new Map<string, HookCaptureIR['children'][number]>();
  for (const value of values) {
    for (const state of value.states) {
      const previous = states.get(state.name);
      if (
        previous &&
        (!valueAssignable(previous.type, state.type) ||
          !valueAssignable(state.type, previous.type) ||
          JSON.stringify(previous.valueType) !== JSON.stringify(state.valueType))
      )
        reject(
          'PUI1006',
          `Conflicting capture state types for ${state.name} across possible installations.`,
          span
        );
      states.set(state.name, previous ?? state);
    }
    for (const method of value.methods) {
      const previous = methods.get(method.name);
      if (
        previous &&
        (!valueAssignable(previous.type, method.type) ||
          !valueAssignable(method.type, previous.type))
      )
        reject(
          'PUI1006',
          `Conflicting capture method signatures for ${method.name} across possible installations.`,
          span
        );
      methods.set(method.name, previous ?? method);
    }
    for (const child of value.children) children.set(child.id, child);
  }
  return {
    states: [...states.values()],
    methods: [...methods.values()],
    children: [...children.values()],
  };
}

/** Re-derive contribution schemas from a complete closed graph, never from serialized metadata. */
export function derivePrototypeCaptures(
  ir: Pick<import('./ir').PrototypeIR, 'setup' | 'hooks' | 'moduleBindings'>,
  baseline = true
): Map<string, HookCaptureIR> {
  const names = new Map(ir.hooks.map((hook) => [hook.id, hook.name]));
  const captures = new Map(
    ir.hooks.map((hook) => [
      hook.id,
      baseline
        ? deriveHookCapture(hook.setup, ir.moduleBindings ?? [], names, ir.hooks)
        : ({ states: [], methods: [], children: [] } as HookCaptureIR),
    ])
  );
  const issue = traceHookContributions(ir, {
    operation(id, value) {
      const contribution: HookCaptureIR = {
        states: [],
        methods: [],
        children: privilegedHookCaptures(value),
      };
      const key = value.arguments[0];
      if (key?.kind === 'literal' && typeof key.value === 'string') {
        if (value.operation.startsWith('state.') && stateValue(value.type))
          contribution.states.push({ name: key.value, type: value.type });
        if (value.operation === 'expose.method') {
          const method = value.arguments[1],
            type = method.kind === 'function' ? functionValueType(method.function) : method.type;
          if (typeof type !== 'string' && type.kind === 'callable')
            contribution.methods.push({ name: key.value, type });
        }
      }
      captures.set(id, mergeHookCaptures([captures.get(id)!, contribution], value.span));
    },
    child(id, value) {
      const name = names.get(value.hookId);
      if (name)
        captures.set(
          id,
          mergeHookCaptures(
            [
              captures.get(id)!,
              { states: [], methods: [], children: [{ id: value.hookId, name }] },
            ],
            value.span
          )
        );
    },
  });
  if (issue) reject('PUI1007', issue.message, issue.span);
  // Presence belongs to a unique declaration, including multiple-mode hooks.
  for (const hook of ir.hooks)
    if (ir.hooks.filter((other) => other.name === hook.name).length > 1) {
      const capture = captures.get(hook.id)!;
      capture.states = capture.states.map(({ definite, ...state }) => state);
    }
  // Non-multiple definitions with the same public registration name share a
  // first-winner result. Their static views must not disagree about its fields.
  const families = new Map<string, AuthoredHookIR[]>();
  for (const hook of ir.hooks)
    if (hook.mode !== 'multiple')
      families.set(hook.name, [...(families.get(hook.name) ?? []), hook]);
  for (const family of families.values())
    if (family.length > 1) {
      const capture = mergeHookCaptures(
        family.map((hook) => captures.get(hook.id)!),
        family[0].span
      );
      for (const hook of family) captures.set(hook.id, capture);
    }
  return captures;
}
