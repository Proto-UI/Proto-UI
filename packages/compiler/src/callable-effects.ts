import type {
  AuthoredHookIR,
  ExpressionIR,
  FunctionContext,
  FunctionIR,
  HookCaptureIR,
  Phase,
  PrototypeIR,
  SourceSpan,
  StatementIR,
  ValueType,
} from './ir';
import {
  operationArgumentRule,
  operationResultType,
  validateOperationPhase,
  privilegedHookCaptures,
  privilegedStateMembers,
  stateValue,
  type ArgumentRule,
  type CallbackContext,
} from './operations';
import { isDataValueType, lexicalStoredType } from './ir';
import { arrayEveryCallbackParameters, objectFields, valueAlternatives } from './value-types';
import { HOOK_API_TYPE, HOOK_TOOLS_TYPE } from './core-value-types';
import { captureFacadeFields } from './capture-types';

type CaptureGetterOperation =
  | 'capture.getState'
  | 'capture.getMethod'
  | 'capture.getAsHook'
  | 'capture.getAsHookHandle';
const CAPTURE_GETTERS = new Map<string, CaptureGetterOperation>([
  ['getState', 'capture.getState'],
  ['getMethod', 'capture.getMethod'],
  ['getAsHook', 'capture.getAsHook'],
  ['getAsHookHandle', 'capture.getAsHookHandle'],
]);
const CAPTURE_LOOKUPS = new Set<string>(CAPTURE_GETTERS.values());

type Known = readonly Atom[];
type CapturedState = HookCaptureIR['states'][number];
type TracedOperation = Extract<ExpressionIR, { kind: 'operation' }>;
type Atom =
  | { kind: 'unknown'; data?: ValueType }
  | { kind: 'undefined' | 'uninitialized' | 'absent' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'closure'; fn: FunctionIR; scope: Scope }
  | { kind: 'native'; type: Extract<ValueType, { kind: 'callable' }> }
  | { kind: 'named-state'; state: CapturedState }
  | { kind: 'cell'; initial: Known; tracked: boolean }
  | { kind: 'record'; fields: Map<string, Known>; tracked?: boolean }
  | { kind: 'getter'; callable: Known }
  | { kind: 'capture-getter'; capture: Capture; operation: CaptureGetterOperation }
  | ({ kind: 'capture'; hookId?: string } & CaptureContents);
type Closure = Extract<Atom, { kind: 'closure' }>;
type Capture = Extract<Atom, { kind: 'capture' }>;
type Presence = 'absent' | 'maybe' | 'present';
interface CaptureContents {
  render?: Known;
  states: Presence;
  events: Presence;
  methods: Map<string, Known>;
  children: Map<string, readonly (Installation | undefined)[]>;
}
interface Installation {
  pending?: boolean;
  mode?: AuthoredHookIR['mode'];
  capture: Capture;
  result?: Known;
  handle: Known;
  api?: Known;
}
interface Execution {
  phase: Phase;
  context: FunctionContext;
  guarded?: boolean;
}
interface Slot {
  value: Known;
}
type Cell = Extract<Atom, { kind: 'cell' }>;
type RecordValue = Extract<Atom, { kind: 'record' }>;
interface Store {
  cells: Map<Cell, Known>;
  records: Map<RecordValue, Map<string, Known>>;
  installations: Map<string, readonly (Installation | undefined)[]>;
  captures: Map<Capture, CaptureContents>;
}
const emptyStore = (): Store => ({
  cells: new Map(),
  records: new Map(),
  installations: new Map(),
  captures: new Map(),
});
const copyStore = (state: Store): Store => ({
  cells: new Map(state.cells),
  records: new Map(state.records),
  installations: new Map(state.installations),
  captures: new Map(state.captures),
});

const UNKNOWN: Known = [{ kind: 'unknown' }];
const UNDEFINED: Known = [{ kind: 'undefined' }];
// Only an own-property map contains ABSENT. Reading it produces undefined;
// spreading it leaves the preceding property intact, unlike an own undefined.
const ABSENT: Known = [{ kind: 'absent' }];
const UNINITIALIZED: Known = [{ kind: 'uninitialized' }];
/** An untracked value whose checked type cannot carry a callable or owner authority. */
const dataFact = (type: ValueType): Known => [{ kind: 'unknown', data: type }];

/** Values here are provenance, not an evaluator for authored data or host effects. */
class Scope {
  private readonly slots = new Map<string, Slot>();
  constructor(private readonly parent?: Scope) {}
  declare(name: string, bindingId?: string): Slot {
    const slot = { value: UNINITIALIZED };
    this.slots.set(`name:${name}`, slot);
    if (bindingId) this.slots.set(`id:${bindingId}`, slot);
    return slot;
  }
  lookup(name: string, bindingId?: string): Slot | undefined {
    const key = bindingId ? `id:${bindingId}` : `name:${name}`;
    return this.slots.get(key) ?? this.parent?.lookup(name, bindingId);
  }
}

export interface CallableEffectIssue {
  message: string;
  span: SourceSpan;
}

/**
 * Check known calls in their actual execution context. Creating or transporting a
 * closure is not a call. The analysis follows declaration environments and actual
 * callable arguments; it never grants authority from a callable's spelling or its
 * coarse creation-time phase. Mutable stores are joined across deferred calls;
 * unresolved source callable edges are diagnosed rather than treated as empty.
 */
export function callableEffectIssue(ir: PrototypeIR): CallableEffectIssue | undefined {
  return analyzeCallableFlow(ir);
}

export interface CallableDemandObserver {
  expression(value: ExpressionIR): void;
  function(value: FunctionIR): void;
  hook(value: Extract<ExpressionIR, { kind: 'authored-hook' }>, recursive?: boolean): void;
  /** Actual call provenance, including separate invocations of a shared helper. */
  call?(
    value: Extract<ExpressionIR, { kind: 'call' }>,
    provenance: { external: boolean; authored: readonly FunctionIR[] }
  ): void;
  /** An opaque/cyclic callable edge prevents a closed invocation proof. */
  opaque(): void;
}

/** Host demand follows actual calls and outward callables, not closure creation. */
export function traceCallableDemand(ir: PrototypeIR, observer: CallableDemandObserver): void {
  analyzeCallableFlow(ir, undefined, observer);
}

/** Setup capture uses the same declaration/argument/return provenance as effects. */
export function traceSetupOperations(
  setup: FunctionIR,
  moduleBindings: readonly StatementIR[],
  trace: {
    operation(
      value: TracedOperation,
      introduced: readonly CapturedState[],
      definite: boolean
    ): void;
    hook(value: Extract<ExpressionIR, { kind: 'authored-hook' }>): void;
  },
  hooks: readonly AuthoredHookIR[] = []
): CallableEffectIssue | undefined {
  return analyzeCallableFlow({ setup, moduleBindings, hooks }, trace);
}

export interface HookContributionObserver {
  operation(hookId: string, value: TracedOperation, introduced: readonly CapturedState[]): void;
  child(hookId: string, value: Extract<ExpressionIR, { kind: 'authored-hook' }>): void;
}
/** Contributions follow the actual argument environment of each reached installation. */
export function traceHookContributions(
  ir: Pick<PrototypeIR, 'setup' | 'moduleBindings' | 'hooks'>,
  observer: HookContributionObserver
): CallableEffectIssue | undefined {
  return analyzeCallableFlow(ir, { operation() {}, hook() {}, owned: observer });
}

function analyzeCallableFlow(
  ir: {
    setup: FunctionIR;
    moduleBindings?: readonly StatementIR[];
    hooks: readonly AuthoredHookIR[];
  },
  trace?: {
    operation(
      value: TracedOperation,
      introduced: readonly CapturedState[],
      definite: boolean
    ): void;
    hook(value: Extract<ExpressionIR, { kind: 'authored-hook' }>): void;
    owned?: HookContributionObserver;
  },
  demand?: CallableDemandObserver
): CallableEffectIssue | undefined {
  let issue: CallableEffectIssue | undefined;
  const moduleScope = new Scope();
  const active = new Set<string>();
  type Registration = { closure: Closure; execution: Execution; outward?: boolean };
  const dataCalls = new Map<
    string,
    { result: Known; writes: Store; thrown?: Store; normal: boolean; callbacks: Registration[] }
  >();
  let store = emptyStore();
  const locations = new WeakMap<object, number>();
  let nextLocation = 0;
  let callCount = 0;
  let allocationSerial = 0;
  const hostTypes = new Map<string, Known>();
  type RecordSites = Map<ExpressionIR, RecordValue | Cell>;
  let recordSites: RecordSites = new Map();
  const activeRecordSites = new Map<FunctionIR, RecordSites>();
  const callbackRecordSites = new Map<string, RecordSites>();
  let allocationContext: string | undefined;
  let invocationPath: string[] = [];
  const literalSites = new Map<ExpressionIR, Known>();
  let fingerprintExceeded = false;
  const analyzedCallbacks = new Set<string>();
  const callbacks: Registration[] = [];
  const outwardRoots = new Map<string, { values: Known; execution: Execution; type?: ValueType }>();
  const exceptionSinks: Store[][] = [];
  let reachable = true;
  interface Flow {
    normal?: Store;
    returned?: { store: Store; values: Known };
    thrown?: Store;
  }
  const identities = new Map<FunctionIR, number>();
  const installingHooks = new Set<string>();
  const captureFrames: Capture[] = [];
  const setup: Execution = { phase: 'setup', context: 'setup' };
  const render: Execution = { phase: 'render', context: 'render' };

  function location(value: object): number {
    let id = locations.get(value);
    if (id === undefined) {
      id = nextLocation++;
      locations.set(value, id);
    }
    return id;
  }
  const cellValue = (cell: Cell): Known =>
    cell.tracked ? (store.cells.get(cell) ?? cell.initial) : UNKNOWN;
  const fields = (record: RecordValue): Map<string, Known> =>
    store.records.get(record) ?? record.fields;
  const snapshot = (): Store => copyStore(store);
  const captureContents = (capture: Capture): CaptureContents =>
    store.captures.get(capture) ?? capture;
  function merge(values: readonly Known[]): Known {
    if (!values.length) return [];
    if (values.every((value) => value === values[0])) return values[0];
    const unique = [...new Set(values.flat())];
    if (unique.length < 2) return values.find((value) => value.length === unique.length) ?? unique;
    const result = new Map<string, Atom>();
    for (const value of unique) {
      const key =
        (value.kind === 'cell' && value.tracked) ||
        (value.kind === 'record' && value.tracked !== false)
          ? `location:${location(value)}`
          : fingerprint([value]);
      if (!result.has(key)) result.set(key, value);
    }
    return [...result].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
  }
  function joinStores(states: readonly Store[]): Store {
    if (states.length === 1) return copyStore(states[0]);
    const cells = new Set(states.flatMap((state) => [...state.cells.keys()]));
    const records = new Set(states.flatMap((state) => [...state.records.keys()]));
    const result = emptyStore();
    for (const cell of cells)
      result.cells.set(cell, merge(states.map((state) => state.cells.get(cell) ?? cell.initial)));
    for (const record of records) {
      const maps = states.map((state) => state.records.get(record) ?? record.fields);
      if (maps.every((map) => map === maps[0])) {
        result.records.set(record, maps[0]);
        continue;
      }
      const names = new Set(maps.flatMap((map) => [...map.keys()]));
      result.records.set(
        record,
        new Map([...names].map((name) => [name, merge(maps.map((map) => map.get(name) ?? ABSENT))]))
      );
    }
    const unionInstallations = (
      alternatives: readonly (readonly (Installation | undefined)[])[]
    ): readonly (Installation | undefined)[] => {
      const union = [...new Set(alternatives.flat())];
      return (
        alternatives.find(
          (values) =>
            values.length === union.length && values.every((value, index) => value === union[index])
        ) ?? union
      );
    };
    const names = new Set(states.flatMap((state) => [...state.installations.keys()]));
    for (const name of names)
      result.installations.set(name, [
        ...new Set(states.flatMap((state) => state.installations.get(name) ?? [undefined])),
      ]);
    const captures = new Set(states.flatMap((state) => [...state.captures.keys()]));
    for (const capture of captures) {
      const contents = states.map((state) => state.captures.get(capture) ?? capture);
      const methods = new Set(contents.flatMap((value) => [...value.methods.keys()]));
      const children = new Set(contents.flatMap((value) => [...value.children.keys()]));
      result.captures.set(capture, {
        render: merge(contents.map((value) => value.render ?? UNDEFINED)),
        states: joinPresence(contents.map((value) => value.states)),
        events: joinPresence(contents.map((value) => value.events)),
        methods: new Map(
          [...methods].map((name) => [
            name,
            merge(contents.map((value) => value.methods.get(name) ?? ABSENT)),
          ])
        ),
        children: new Map(
          [...children].map((name) => [
            name,
            unionInstallations(contents.map((value) => value.children.get(name) ?? [undefined])),
          ])
        ),
      });
    }
    return result;
  }
  function writeCaptureMethod(capture: Capture, name: string, value: Known): void {
    const prior = captureContents(capture);
    store.captures.set(capture, {
      ...prior,
      methods: new Map(prior.methods).set(name, value),
    });
  }
  function recordChild(capture: Capture | undefined, name: string, value: Installation): void {
    if (!capture) return;
    const prior = captureContents(capture),
      possible = prior.children.get(name) ?? [undefined];
    // Runtime getAsHook(name) returns the first matching direct child entry.
    store.captures.set(capture, {
      ...prior,
      children: new Map(prior.children).set(name, [
        ...new Set(possible.map((child) => child ?? value)),
      ]),
    });
  }
  function delta(after: Store, before: Store): Store {
    return {
      cells: new Map([...after.cells].filter(([key, value]) => before.cells.get(key) !== value)),
      records: new Map(
        [...after.records].filter(([key, value]) => before.records.get(key) !== value)
      ),
      installations: new Map(
        [...after.installations].filter(([key, value]) => before.installations.get(key) !== value)
      ),
      captures: new Map(
        [...after.captures].filter(([key, value]) => before.captures.get(key) !== value)
      ),
    };
  }
  function applyDelta(target: Store, changes: Store): void {
    for (const [key, value] of changes.cells) target.cells.set(key, value);
    for (const [key, value] of changes.records) target.records.set(key, value);
    for (const [key, value] of changes.installations) target.installations.set(key, value);
    for (const [key, value] of changes.captures) target.captures.set(key, value);
  }
  function writeField(record: RecordValue, name: string, value: Known, weak = false): void {
    const next = new Map(fields(record));
    next.set(name, weak ? merge([next.get(name) ?? ABSENT, value]) : value);
    store.records.set(record, next);
  }
  function opaque(span: SourceSpan): void {
    if (demand) demand.opaque();
    else
      issue ??= {
        message:
          'Callable provenance is not closed at this invocation. Supply a checked callable or an explicit host callback contract.',
        span,
      };
  }

  function possibleThrow(): void {
    exceptionSinks.at(-1)?.push(snapshot());
  }
  function joinFlows(flows: readonly Flow[]): Flow {
    const normal = flows.flatMap((flow) => (flow.normal ? [flow.normal] : []));
    const returned = flows.flatMap((flow) => (flow.returned ? [flow.returned] : []));
    const thrown = flows.flatMap((flow) => (flow.thrown ? [flow.thrown] : []));
    return {
      ...(normal.length ? { normal: joinStores(normal) } : {}),
      ...(returned.length
        ? {
            returned: {
              store: joinStores(returned.map((exit) => exit.store)),
              values: merge(returned.map((exit) => exit.values)),
            },
          }
        : {}),
      ...(thrown.length ? { thrown: joinStores(thrown) } : {}),
    };
  }
  function truth(values: Known, nullish = false): boolean | undefined {
    const choices = new Set(
      values.map((value) =>
        value.kind === 'undefined' || value.kind === 'absent'
          ? false
          : value.kind === 'literal'
            ? nullish
              ? value.value !== null
              : !!value.value
            : value.kind === 'unknown' || value.kind === 'uninitialized'
              ? undefined
              : true
      )
    );
    return choices.size === 1 ? [...choices][0] : undefined;
  }
  function branches(actions: readonly (() => Known)[]): Known {
    const before = snapshot(),
      results: Known[] = [],
      after: Store[] = [];
    for (const action of actions) {
      store = copyStore(before);
      reachable = true;
      const result = action();
      if (reachable) {
        results.push(result);
        after.push(snapshot());
      }
    }
    reachable = after.length > 0;
    store = after.length ? joinStores(after) : before;
    return merge(results);
  }

  function identity(fn: FunctionIR): number {
    let id = identities.get(fn);
    if (id === undefined) {
      id = identities.size;
      identities.set(fn, id);
    }
    return id;
  }

  // Preserve callable positions and capture bindings. A set of function IDs
  // conflates {invoke: pure, other: effectful} with the reverse arrangement.
  // Literal provenance is finite (arithmetic/host results are unknown), while
  // graph references bound cycles without erasing record or closure structure.
  function fingerprint(values: Known, locationsOnly = false): string {
    const seen = new Map<Atom, number>();
    function visit(value: Atom, depth = 0): unknown {
      if (depth > 48 || seen.size > 2048) {
        fingerprintExceeded = true;
        return ['widened'];
      }
      const previous = seen.get(value);
      if (previous !== undefined) return ['ref', previous];
      seen.set(value, seen.size);
      switch (value.kind) {
        case 'unknown':
        case 'undefined':
        case 'absent':
        case 'uninitialized':
          return value.kind === 'unknown' && value.data
            ? ['unknown-data', value.data]
            : [value.kind];
        case 'literal':
          return ['literal', value.value];
        case 'native':
          return ['native', value.type];
        case 'named-state':
          return ['named-state', value.state.name, value.state.type];
        case 'cell':
          if (locationsOnly && value.tracked) return ['cell-location', location(value)];
          return [
            'cell',
            value.tracked ? location(value) : null,
            cellValue(value).map((child) => visit(child, depth + 1)),
          ];
        case 'closure':
          return [
            'closure',
            identity(value.fn),
            (value.fn.captures ?? []).map((capture) => {
              const slot = value.scope.lookup(capture.name, capture.bindingId);
              return [
                capture.bindingId ?? capture.name,
                slot?.value === UNINITIALIZED
                  ? ['uninitialized-binding', location(slot)]
                  : (slot?.value ?? UNKNOWN).map((child) => visit(child, depth + 1)),
              ];
            }),
          ];
        case 'record':
          if (locationsOnly && value.tracked !== false) return ['record-location', location(value)];
          return [
            'record',
            value.tracked === false ? null : location(value),
            [...fields(value)]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, field]) => [name, field.map((child) => visit(child, depth + 1))]),
          ];
        case 'getter':
          return ['get', value.callable.map((child) => visit(child, depth + 1))];
        case 'capture-getter':
          return [
            'capture-getter',
            value.operation,
            location(value.capture),
            visit(value.capture, depth + 1),
          ];
        case 'capture':
          return [
            'capture',
            captureContents(value).states,
            captureContents(value).events,
            (captureContents(value).render ?? UNDEFINED).map((child) => visit(child, depth + 1)),
            [...captureContents(value).methods].map(([name, method]) => [
              name,
              method.map((child) => visit(child, depth + 1)),
            ]),
            [...captureContents(value).children].map(([name, children]) => [
              name,
              children.map((child) =>
                child ? child.handle.map((value) => visit(value, depth + 1)) : ['absent']
              ),
            ]),
          ];
      }
    }
    return JSON.stringify(values.map((value) => visit(value)));
  }

  function carriesCallable(type: ValueType): boolean {
    if (typeof type === 'string')
      return type === 'function' || type === 'unknown' || type === 'authored-result';
    if (type.kind === 'callable' || type.kind === 'capture') return true;
    if (type.kind === 'object')
      return (
        type.fields.some((field) => !!field.accessor || carriesCallable(field.type)) ||
        (type.index !== undefined && carriesCallable(type.index))
      );
    if (type.kind === 'value-union') return type.members.some(carriesCallable);
    return false;
  }

  /** Native callback inputs and fixed host results carry an explicit external contract. */
  function hostValue(type: ValueType): Known {
    const key = JSON.stringify(type),
      cached = hostTypes.get(key);
    if (cached) return cached;
    if (typeof type === 'string')
      return type === 'void' ? UNDEFINED : isDataValueType(type) ? dataFact(type) : UNKNOWN;
    if (type.kind === 'callable') {
      const value: Known = [{ kind: 'native', type }];
      hostTypes.set(key, value);
      return value;
    }
    if (type.kind === 'value-union' || type.kind === 'union')
      return merge(type.members.map(hostValue));
    if (type.kind === 'object' || type.kind === 'record') {
      if (isDataValueType(type)) return dataFact(type);
      if (!carriesCallable(type)) return UNKNOWN;
      const record: RecordValue = {
        kind: 'record',
        fields: new Map(),
        tracked: carriesCallable(type),
      };
      const value: Known = [record];
      for (const field of type.fields)
        record.fields.set(
          field.name,
          field.optional ? merge([hostValue(field.type), UNDEFINED, ABSENT]) : hostValue(field.type)
        );
      return value;
    }
    return UNKNOWN;
  }

  function call(closure: Closure, args: readonly Known[], execution: Execution): Known {
    if (issue) return UNKNOWN;
    if (++callCount > 8192) {
      opaque(closure.fn.span);
      if (demand)
        issue ??= {
          message: 'Callable flow exceeds the finite analysis worklist boundary.',
          span: closure.fn.span,
        };
      return UNKNOWN;
    }
    demand?.function(closure.fn);
    fingerprintExceeded = false;
    const installationKey = JSON.stringify(
      [...store.installations].map(([name, alternatives]) => [
        name,
        alternatives.map((value) => (value ? location(value) : null)),
      ])
    );
    const key = `${installationKey}:${identity(closure.fn)}:${execution.phase}:${execution.context}:${execution.guarded ? 'guarded' : 'strict'}:${captureFrames.length ? location(captureFrames.at(-1)!) : 'public'}:${fingerprint([closure])}:${args.map((argument) => fingerprint(argument)).join(';')}`;
    if (fingerprintExceeded) {
      if (demand) demand.opaque();
      else
        issue = {
          message:
            'Recursive callable provenance exceeds the finite analysis boundary. Keep callable capture structure bounded.',
          span: closure.fn.span,
        };
      return UNKNOWN;
    }
    const cached = dataCalls.get(key);
    if (cached) {
      if (cached.thrown) {
        const thrown = snapshot();
        applyDelta(thrown, cached.thrown);
        exceptionSinks.at(-1)?.push(thrown);
      }
      reachable = cached.normal;
      applyDelta(store, cached.writes);
      callbacks.push(...cached.callbacks);
      return cached.result;
    }
    if (active.has(key)) {
      demand?.opaque();
      return UNKNOWN;
    }
    active.add(key);
    const before = snapshot(),
      allocationsBefore = allocationSerial,
      callbacksBefore = callbacks.length;
    // Ordinary factory invocations have distinct environments and records.
    // Join allocation sites only on recursive reentry into this active call.
    const previousRecordSites = recordSites;
    const recursiveRecordSites = activeRecordSites.get(closure.fn);
    const allocationKey = allocationContext
      ? `${allocationContext}:${invocationPath.join('/')}:${identity(closure.fn)}`
      : undefined;
    recordSites =
      recursiveRecordSites ??
      (allocationKey ? callbackRecordSites.get(allocationKey) : undefined) ??
      new Map();
    if (allocationKey) callbackRecordSites.set(allocationKey, recordSites);
    activeRecordSites.set(closure.fn, recordSites);
    try {
      const scope = new Scope(closure.scope);
      const slots = closure.fn.parameters.map((parameter) =>
        scope.declare(parameter.name, parameter.bindingId)
      );
      closure.fn.parameters.forEach((parameter, index) => {
        if (!reachable) return;
        let argument = args[index] ?? UNDEFINED;
        if (
          parameter.default &&
          argument.some(
            (value) =>
              value.kind === 'undefined' ||
              (value.kind === 'unknown' &&
                (!value.data || valueAlternatives(value.data).includes('void')))
          )
        ) {
          const supplied = argument.filter((value) => value.kind !== 'undefined');
          argument = branches([
            ...(supplied.length ? [() => supplied] : []),
            () => expression(parameter.default!, scope, execution),
          ]);
        }
        slots[index].value = argument;
      });
      if (!reachable) return [];
      const flow = statements(closure.fn.body, scope, execution);
      if (flow.thrown) exceptionSinks.at(-1)?.push(flow.thrown);
      const completed = [flow.normal, flow.returned?.store].filter(
        (state): state is Store => !!state
      );
      reachable = completed.length > 0;
      if (reachable) store = joinStores(completed);
      const result = merge([
        ...(flow.normal ? [UNDEFINED] : []),
        ...(flow.returned ? [flow.returned.values] : []),
      ]);
      // Replaying a data-returning helper must not alias distinct fresh mutable
      // environments or repeat a once installation from another branch.
      if (
        !carriesCallable(closure.fn.returnType) &&
        allocationSerial === allocationsBefore &&
        [...store.cells.keys()].every((key) => before.cells.has(key)) &&
        [...store.records.keys()].every((key) => before.records.has(key)) &&
        [...store.installations].every(([key, values]) => {
          const previous = before.installations.get(key);
          return (
            previous?.length === values.length && values.every((value) => previous.includes(value))
          );
        })
      )
        dataCalls.set(key, {
          result,
          normal: reachable,
          ...(flow.thrown ? { thrown: delta(flow.thrown, before) } : {}),
          writes: delta(store, before),
          callbacks: callbacks.slice(callbacksBefore),
        });
      return result;
    } finally {
      recordSites = previousRecordSites;
      if (!recursiveRecordSites) activeRecordSites.delete(closure.fn);
      active.delete(key);
    }
  }

  function operationFailure(
    operation: string,
    execution: Execution,
    span: SourceSpan
  ): Known | undefined {
    const phaseIssue = validateOperationPhase(
      operation,
      execution.phase,
      execution.phase === 'callback' ? (execution.context as CallbackContext) : undefined
    ).find((item) => item.code !== 'context' || execution.context !== 'helper');
    if (phaseIssue && !trace) {
      if (execution.guarded) {
        possibleThrow();
        reachable = false;
        return [];
      }
      if (!demand) {
        issue = { message: phaseIssue.message, span };
        return UNKNOWN;
      }
    }
    return undefined;
  }

  function joinPresence(values: readonly Presence[]): Presence {
    return values.every((value) => value === values[0]) ? (values[0] ?? 'absent') : 'maybe';
  }

  function anyPresence(values: readonly Presence[]): Presence {
    return values.includes('present') ? 'present' : values.includes('maybe') ? 'maybe' : 'absent';
  }

  function memberPresence(values: Iterable<Known>): Presence {
    const members = [...values];
    if (members.some((value) => value.length && value.every((part) => part.kind !== 'absent')))
      return 'present';
    return members.some((value) => value.some((part) => part.kind !== 'absent'))
      ? 'maybe'
      : 'absent';
  }

  function childPresence(capture: Capture): Presence {
    const children = [...captureContents(capture).children.values()];
    if (children.some((values) => values.length && values.every((value) => value !== undefined)))
      return 'present';
    return children.some((values) => values.some((value) => value !== undefined))
      ? 'maybe'
      : 'absent';
  }

  function ownValue(presence: Presence, value: Known): Known {
    return presence === 'absent' ? ABSENT : presence === 'present' ? value : merge([value, ABSENT]);
  }

  function readValue(value: Known): Known {
    return merge(value.map((part) => (part.kind === 'absent' ? UNDEFINED : [part])));
  }

  function captureRecord(entries: Iterable<readonly [string, Known]>): Known {
    return [{ kind: 'record', fields: new Map(entries), tracked: false }];
  }

  function captureFields(capture: Capture) {
    return captureFacadeFields(
      ir.hooks.find((hook) => hook.id === capture.hookId),
      new Map()
    );
  }

  /** Presence comes from executed contributions, not serialized capture schemas. */
  function capturePresence(capture: Capture, name: string): Presence {
    if (!capture.hookId) return 'maybe';
    const contents = captureContents(capture);
    if (name === 'getState' || name === 'stateHandles') return contents.states;
    if (name === 'getMethod' || name === 'methods')
      return memberPresence(contents.methods.values());
    if (name === 'getAsHook' || name === 'getAsHookHandle' || name === 'asHooks')
      return childPresence(capture);
    if (name === 'artifacts')
      return anyPresence([
        contents.states,
        contents.events,
        memberPresence(contents.methods.values()),
        childPresence(capture),
      ]);
    return 'maybe';
  }

  /** Only a reached capture creates these bound getters; a field's type is not authority. */
  function captureOwnProperty(capture: Capture, name: string): Known {
    if (name === 'render')
      return merge(
        (captureContents(capture).render ?? UNDEFINED).map((value) =>
          value.kind === 'undefined' ? ABSENT : [value]
        )
      );
    // Pending and privileged placeholders do not prove a completed public facade.
    if (!capture.hookId) return merge([UNKNOWN, ABSENT]);
    const presence = capturePresence(capture, name);
    if (presence === 'absent') return ABSENT;
    const operation = CAPTURE_GETTERS.get(name);
    if (operation) return ownValue(presence, [{ kind: 'capture-getter', capture, operation }]);
    if (name === 'methods')
      return ownValue(presence, captureRecord(captureContents(capture).methods));
    const field = captureFields(capture).find((field) => field.name === name);
    if (!field) return ABSENT;
    if (name === 'artifacts') {
      const contents = captureContents(capture);
      return ownValue(
        presence,
        captureRecord(
          (objectFields(field.type) ?? []).map((artifact): [string, Known] => [
            artifact.name,
            artifact.name === 'methods'
              ? ownValue(memberPresence(contents.methods.values()), captureRecord(contents.methods))
              : ownValue(
                  artifact.name === 'stateHandles'
                    ? contents.states
                    : artifact.name === 'eventKeys'
                      ? contents.events
                      : childPresence(capture),
                  carriesCallable(artifact.type) ? UNKNOWN : hostValue(artifact.type)
                ),
          ])
        )
      );
    }
    return ownValue(presence, carriesCallable(field.type) ? UNKNOWN : hostValue(field.type));
  }

  function captureProperty(capture: Capture, name: string): Known {
    return readValue(captureOwnProperty(capture, name));
  }

  /** Direct operations and copied getters resolve the same current capture graph. */
  function captureLookup(
    capture: Capture,
    operation: CaptureGetterOperation,
    argument: Known
  ): Known {
    const contents = captureContents(capture);
    const hook = ir.hooks.find((hook) => hook.id === capture.hookId);
    const unresolved = argument.some(
      (key) => key.kind !== 'literal' || typeof key.value !== 'string'
    );
    // Preserve the existing direct-operation exception edge for State reads
    // and unresolved lookups; sharing provenance must not erase catch paths.
    if (operation === 'capture.getState' || unresolved) possibleThrow();
    const keys = new Set(
      argument.flatMap((key) =>
        key.kind === 'literal' && typeof key.value === 'string' ? [key.value] : []
      )
    );
    if (unresolved) {
      const candidates =
        operation === 'capture.getMethod'
          ? contents.methods.keys()
          : operation === 'capture.getState'
            ? (hook?.capture?.states ?? []).map((state) => state.name)
            : contents.children.keys();
      for (const key of candidates) keys.add(key);
    }
    const result = [...keys].map((key): Known => {
      if (operation === 'capture.getMethod') return readValue(contents.methods.get(key) ?? ABSENT);
      if (operation === 'capture.getState') {
        // State handles are not authored callables. Keep an incomplete first-pass
        // capture opaque instead of using serialized lookup metadata as proof.
        if (!hook?.capture) return UNKNOWN;
        const type =
          operationResultType(operation, undefined, { capture: hook.capture, captureKey: key }) ??
          'unknown';
        return carriesCallable(type) ? UNKNOWN : hostValue(type);
      }
      return merge(
        (contents.children.get(key) ?? [undefined]).map((child) =>
          !child
            ? UNDEFINED
            : operation === 'capture.getAsHookHandle'
              ? child.handle
              : captureRecord([
                  ['name', [{ kind: 'literal', value: key }]],
                  ['result', child.result ?? [child.capture]],
                  ['handle', child.handle],
                ])
        )
      );
    });
    if (unresolved)
      result.push(operation === 'capture.getState' && !hook?.capture ? UNKNOWN : UNDEFINED);
    return result.length ? merge(result) : UNDEFINED;
  }

  function calls(
    values: Known,
    args: readonly Known[],
    execution: Execution,
    span: SourceSpan = ir.setup.span,
    checkedArguments?: readonly { type: ValueType }[]
  ): Known {
    const previousPath = invocationPath;
    invocationPath = [...invocationPath, `${span.file}:${span.start}`];
    try {
      return branches(
        values.map((value) => () => {
          if (value.kind === 'closure') return call(value, args, execution);
          if (value.kind === 'capture-getter') {
            const failure = operationFailure(value.operation, execution, span);
            return failure ?? captureLookup(value.capture, value.operation, args[0] ?? UNDEFINED);
          }
          if (value.kind === 'native') {
            // A host-supplied callable has an explicit signature. Supplied closures
            // may be retained by that external consumer and become outward roots.
            // UNKNOWN also represents untracked data; retain the actual checked
            // shape, including data fields omitted by a narrower host signature.
            args.forEach((argument, index) =>
              escape(
                argument,
                { phase: 'callback', context: 'expose-method' },
                checkedArguments?.[index]?.type ?? value.type.parameters[index]?.type
              )
            );
            possibleThrow();
            return hostValue(value.type.returnType);
          }
          if (
            value.kind === 'undefined' ||
            value.kind === 'absent' ||
            value.kind === 'uninitialized' ||
            (value.kind === 'literal' && value.value === null)
          )
            return UNDEFINED;
          if (value.kind === 'unknown') {
            opaque(span);
            args.forEach((argument, index) =>
              escape(argument, execution, checkedArguments?.[index]?.type)
            );
          }
          return UNKNOWN;
        })
      );
    } finally {
      invocationPath = previousPath;
    }
  }

  function escape(values: Known, execution: Execution, type?: ValueType, retain = true): void {
    if (type && !carriesCallable(type)) return;
    if (retain)
      outwardRoots.set(
        `${execution.phase}:${execution.context}:${execution.guarded ? 'guarded' : 'strict'}:${fingerprint(values, true)}:${JSON.stringify(type)}`,
        { values, execution, type }
      );
    const pending = values.map((value) => ({ value, type })),
      seen = new Set<Atom>();
    function fieldType(type: ValueType | undefined, name: string): ValueType | undefined {
      if (!type || typeof type === 'string') return undefined;
      if (type.kind === 'object' || type.kind === 'record')
        return (
          type.fields.find((field) => field.name === name)?.type ??
          (type.kind === 'object' ? type.index : undefined)
        );
      if (type.kind === 'value-union' || type.kind === 'union') {
        const members = type.members
          .map((member) => fieldType(member, name))
          .filter((member): member is ValueType => member !== undefined);
        return members.length ? { kind: 'value-union', members } : undefined;
      }
      return undefined;
    }
    while (pending.length) {
      const { value, type } = pending.pop()!;
      if (seen.has(value)) continue;
      seen.add(value);
      if (value.kind === 'unknown') {
        // An untracked fact is not callable provenance when it is proven data or
        // its checked type cannot carry a callable. A stored closure, record,
        // cell or capture is always traversed, whatever the checked type says.
        if (!value.data && (!type || carriesCallable(type))) opaque(ir.setup.span);
        continue;
      }
      if (value.kind === 'closure') callbacks.push({ closure: value, execution, outward: true });
      else if (value.kind === 'capture-getter') {
        // A public getter can return any member of its actual closed capture.
        // Those closures keep the caller's execution context and guarded policy.
        if (value.operation !== 'capture.getState')
          pending.push(
            ...captureLookup(value.capture, value.operation, UNKNOWN).map((value) => ({
              value,
              type: undefined,
            }))
          );
      } else if (value.kind === 'getter')
        pending.push(...value.callable.map((value) => ({ value, type: undefined })));
      else if (value.kind === 'record')
        for (const [name, field] of fields(value))
          pending.push(...field.map((value) => ({ value, type: fieldType(type, name) })));
      else if (value.kind === 'cell')
        pending.push(...cellValue(value).map((value) => ({ value, type })));
      else if (value.kind === 'capture') {
        pending.push(
          ...(captureContents(value).render ?? UNDEFINED).map((value) => ({
            value,
            type: undefined,
          }))
        );
        for (const method of captureContents(value).methods.values())
          pending.push(...method.map((value) => ({ value, type: undefined })));
        for (const children of captureContents(value).children.values())
          for (const child of children)
            if (child) pending.push(...child.handle.map((value) => ({ value, type: undefined })));
      }
    }
  }

  function callback(
    values: Known,
    rule: ArgumentRule | undefined,
    execution: Execution,
    type?: ValueType
  ): void {
    if (!rule || trace) return;
    if (
      rule.callback &&
      !(rule.callback.acceptsValue && type && !carriesCallable(type)) &&
      rule.callback.parameterPolicy !== 'declared-method'
    ) {
      if (values.some((value) => value.kind === 'unknown' && !value.data)) opaque(ir.setup.span);
      const signature = rule.callback;
      const origin: Execution =
        signature.contextFrom === 'caller'
          ? execution
          : { phase: signature.phase, context: signature.context };
      if (signature.contextFrom === 'caller')
        calls(values, signature.parameters.map(hostValue), origin);
      else
        for (const value of values)
          if (value.kind === 'closure') callbacks.push({ closure: value, execution: origin });
    }
    if (rule.fields)
      for (const value of values)
        if (value.kind === 'record')
          for (const [key, field] of Object.entries(rule.fields))
            callback(fields(value).get(key) ?? UNKNOWN, field, execution);
  }

  function scheduleRender(values: Known): void {
    for (const value of values) {
      if (value.kind === 'closure') callbacks.push({ closure: value, execution: render });
      else if (value.kind === 'unknown' && !value.data) opaque(ir.setup.span);
    }
  }

  function property(values: Known, name: string, execution: Execution, span: SourceSpan): Known {
    if (!reachable) return [];
    return branches(
      values.map((value) => () => {
        if (value.kind === 'record') {
          const field = fields(value).get(name) ?? UNDEFINED;
          return branches(
            field.map(
              (part) => () =>
                part.kind === 'getter'
                  ? calls(part.callable, [], execution, span)
                  : readValue([part])
            )
          );
        }
        if (value.kind === 'capture') return captureProperty(value, name);
        if (value.kind === 'undefined' || (value.kind === 'literal' && value.value === null))
          return UNDEFINED;
        return UNKNOWN;
      })
    );
  }

  // Own enumerable keys visit integer indices first, then the remaining names
  // in creation order. Reading each getter is a real sequential invocation.
  function ownKeys(record: RecordValue): string[] {
    const keys = [...fields(record).keys()];
    const index = (key: string) => /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < 0xffff_ffff;
    return [
      ...keys.filter(index).sort((a, b) => Number(a) - Number(b)),
      ...keys.filter((key) => !index(key)),
    ];
  }

  function copyProperties(
    values: Known,
    execution: Execution,
    span: SourceSpan,
    previous = new Map<string, Known>(),
    type?: ValueType
  ): Map<string, Known> {
    const copies: Map<string, Known>[] = [];
    branches(
      values.map((value) => () => {
        const copy = new Map(previous);
        const copyField = (name: string, field: Known): void => {
          const present = field.filter((part) => part.kind !== 'absent');
          const missing = present.length !== field.length;
          if (!present.length) return;
          const next = branches([
            ...(missing ? [() => copy.get(name) ?? ABSENT] : []),
            () =>
              branches(
                present.map(
                  (part) => () =>
                    part.kind === 'getter' ? calls(part.callable, [], execution, span) : [part]
                )
              ),
          ]);
          copy.set(name, next);
        };
        if (value.kind === 'record')
          for (const name of ownKeys(value)) {
            copyField(name, fields(value).get(name) ?? ABSENT);
            if (!reachable) return [];
          }
        else if (value.kind === 'capture')
          for (const field of captureFields(value)) {
            copyField(field.name, captureOwnProperty(value, field.name));
            if (!reachable) return [];
          }
        else if (
          value.kind !== 'undefined' &&
          !(value.kind === 'literal' && value.value === null) &&
          type
        )
          for (const field of objectFields(type) ?? []) {
            if (field.accessor) {
              opaque(span);
              copyField(field.name, ownValue(field.optional ? 'maybe' : 'present', UNKNOWN));
            } else {
              copyField(
                field.name,
                ownValue(
                  field.optional ? 'maybe' : 'present',
                  field.optional ? merge([hostValue(field.type), UNDEFINED]) : hostValue(field.type)
                )
              );
            }
          }
        copies.push(copy);
        return UNDEFINED;
      })
    );
    const names = new Set(copies.flatMap((copy) => [...copy.keys()]));
    return new Map(
      [...names].map((name) => [name, merge(copies.map((copy) => copy.get(name) ?? ABSENT))])
    );
  }

  function expression(value: ExpressionIR, scope: Scope, execution: Execution): Known {
    if (issue || !reachable) return [];
    demand?.expression(value);
    switch (value.kind) {
      case 'undefined':
        return UNDEFINED;
      case 'literal': {
        let known = literalSites.get(value);
        if (!known) {
          known = [{ kind: 'literal', value: value.value }];
          literalSites.set(value, known);
        }
        return known;
      }
      case 'reference':
        return scope.lookup(value.name, value.bindingId)?.value ?? UNKNOWN;
      case 'narrow':
        return expression(value.value, scope, execution);
      case 'function':
        return [{ kind: 'closure', fn: value.function, scope }];
      case 'call': {
        const targets = expression(value.callee, scope, execution);
        if (!reachable) return [];
        const absent = (target: Atom) =>
          target.kind === 'undefined' || (target.kind === 'literal' && target.value === null);
        const present = value.optional ? targets.filter((target) => !absent(target)) : targets;
        return branches([
          ...(value.optional &&
          targets.some((target) => absent(target) || target.kind === 'unknown')
            ? [() => UNDEFINED]
            : []),
          ...(present.length
            ? [
                () => {
                  const args = value.arguments.map((argument) =>
                    expression(argument, scope, execution)
                  );
                  if (!reachable) return [];
                  demand?.call?.(value, {
                    external: present.some((target) => target.kind === 'native'),
                    authored: present.flatMap((target) =>
                      target.kind === 'closure' ? [target.fn] : []
                    ),
                  });
                  return calls(present, args, execution, value.span, value.arguments);
                },
              ]
            : []),
        ]);
      }
      case 'helper-call':
        return calls(
          scope.lookup(value.name)?.value ?? UNKNOWN,
          value.arguments.map((argument) => expression(argument, scope, execution)),
          execution,
          value.span,
          value.arguments
        );
      case 'member':
        return property(
          expression(value.object, scope, execution),
          value.property,
          execution,
          value.span
        );
      case 'element': {
        const owner = expression(value.object, scope, execution);
        if (!reachable) return [];
        const absent = (item: Atom) =>
          item.kind === 'undefined' || (item.kind === 'literal' && item.value === null);
        const present = value.optional ? owner.filter((item) => !absent(item)) : owner;
        return branches([
          ...(value.optional && owner.some((item) => absent(item) || item.kind === 'unknown')
            ? [() => UNDEFINED]
            : []),
          ...(present.length
            ? [
                () => {
                  const keys = expression(value.index, scope, execution);
                  return branches(
                    keys.map(
                      (key) => () =>
                        key.kind === 'literal'
                          ? property(present, String(key.value), execution, value.span)
                          : branches([
                              () => UNKNOWN,
                              ...present.flatMap((item) =>
                                item.kind === 'record'
                                  ? ownKeys(item).map(
                                      (name) => () => property([item], name, execution, value.span)
                                    )
                                  : []
                              ),
                            ])
                    )
                  );
                },
              ]
            : []),
        ]);
      }
      case 'record': {
        if (!carriesCallable(value.type)) {
          value.entries.forEach((entry) => expression(entry.value, scope, execution));
          return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
        }
        let record = recordSites.get(value) as RecordValue | undefined;
        const repeated = !!record;
        if (!record) {
          record = {
            kind: 'record',
            fields: new Map(),
            tracked: carriesCallable(value.type),
          };
          recordSites.set(value, record);
          allocationSerial++;
        }
        for (const entry of value.entries) {
          const field = expression(entry.value, scope, execution);
          writeField(
            record,
            entry.key,
            entry.accessor ? [{ kind: 'getter', callable: field }] : field,
            repeated
          );
        }
        return [record];
      }
      case 'object-spread': {
        let nextFields = new Map<string, Known>();
        for (const part of value.parts) {
          const result = expression(part.value, scope, execution);
          if (!reachable) return [];
          if (part.kind === 'entry') {
            nextFields.set(
              part.key,
              part.accessor ? [{ kind: 'getter', callable: result }] : result
            );
          } else {
            nextFields = copyProperties(result, execution, value.span, nextFields, part.value.type);
            if (!reachable) return [];
          }
        }
        if (!carriesCallable(value.type))
          return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
        let record = recordSites.get(value) as RecordValue | undefined;
        const repeated = !!record;
        if (!record) {
          record = {
            kind: 'record',
            fields: new Map(),
            tracked: carriesCallable(value.type),
          };
          recordSites.set(value, record);
          allocationSerial++;
        }
        for (const [name, field] of nextFields) writeField(record, name, field, repeated);
        return [record];
      }
      case 'conditional': {
        const condition = truth(expression(value.condition, scope, execution));
        if (!reachable) return [];
        return branches([
          ...(condition !== false ? [() => expression(value.then, scope, execution)] : []),
          ...(condition !== true ? [() => expression(value.otherwise, scope, execution)] : []),
        ]);
      }
      case 'binary': {
        const left = expression(value.left, scope, execution);
        if (!reachable) return [];
        if (['&&', '||', '??'].includes(value.operator)) {
          const condition = truth(left, value.operator === '??');
          const useRight =
            value.operator === '&&' ? condition : condition === undefined ? undefined : !condition;
          return branches([
            ...(useRight !== true ? [() => left] : []),
            ...(useRight !== false ? [() => expression(value.right, scope, execution)] : []),
          ]);
        }
        expression(value.right, scope, execution);
        return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
      }
      case 'unary':
        expression(value.operand, scope, execution);
        return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
      case 'intrinsic': {
        const args = value.arguments.map((argument) => expression(argument, scope, execution));
        const array = value.arguments[0]?.type;
        if (
          value.name === 'array.every' &&
          array &&
          typeof array !== 'string' &&
          array.kind === 'array'
        ) {
          const parameters = arrayEveryCallbackParameters(array);
          calls(
            args[1] ?? UNKNOWN,
            parameters.map((parameter) => dataFact(parameter.type)),
            execution,
            value.span,
            parameters
          );
        }
        if (value.name === 'object.assign') {
          for (const [index, source] of args.slice(1).entries()) {
            const copied = copyProperties(
              source,
              execution,
              value.span,
              undefined,
              value.arguments[index + 1].type
            );
            if (!reachable) return [];
            for (const target of args[0])
              if (target.kind === 'record')
                for (const [name, field] of copied) {
                  // Object.assign observes the same own-key absence as spread.
                  const next = merge(
                    field.map((part) =>
                      part.kind === 'absent' ? (fields(target).get(name) ?? ABSENT) : [part]
                    )
                  );
                  writeField(target, name, next);
                }
          }
          return isDataValueType(value.type) ? dataFact(value.type) : args[0];
        }
        return value.name === 'object.freeze' ? args[0] : UNKNOWN;
      }
      case 'lexical-cell': {
        const initial = expression(value.value, scope, execution);
        let cell = recordSites.get(value) as Cell | undefined;
        if (!cell) {
          cell = {
            kind: 'cell',
            initial,
            tracked: carriesCallable(lexicalStoredType(value.type)!),
          };
          recordSites.set(value, cell);
          if (cell.tracked) allocationSerial++;
        } else if (cell.tracked) store.cells.set(cell, merge([cellValue(cell), initial]));
        return [cell];
      }
      case 'lexical-read':
        return merge(
          expression(value.cell, scope, execution).map((cell) =>
            cell.kind === 'cell' ? cellValue(cell) : UNKNOWN
          )
        );
      case 'lexical-update': {
        const cells = expression(value.cell, scope, execution);
        for (const cell of cells)
          if (cell.kind === 'cell' && cell.tracked) store.cells.set(cell, UNKNOWN);
        return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
      }
      case 'lexical-write': {
        const cells = expression(value.cell, scope, execution),
          result = expression(value.value, scope, execution);
        for (const cell of cells) {
          if (cell.kind === 'cell') {
            if (cell.tracked)
              store.cells.set(cell, cells.length === 1 ? result : merge([cellValue(cell), result]));
          } else if (carriesCallable(value.value.type)) opaque(value.span);
        }
        return result;
      }
      case 'member-write': {
        const owner = expression(value.object, scope, execution),
          result = expression(value.value, scope, execution);
        for (const item of owner) {
          if (item.kind === 'record') writeField(item, value.property, result, owner.length > 1);
          else if (carriesCallable(value.value.type)) opaque(value.span);
        }
        return result;
      }
      case 'array':
        value.elements.forEach((element) => expression(element, scope, execution));
        return UNKNOWN;
      case 'operation': {
        const receiver = value.receiver ? expression(value.receiver, scope, execution) : UNKNOWN;
        const args = value.arguments.map((argument) => expression(argument, scope, execution));
        const failure = operationFailure(value.operation, execution, value.span);
        if (failure !== undefined) return failure;
        if (!trace && (value.operation === 'expose.method' || value.operation === 'expose.value')) {
          if (
            carriesCallable(value.arguments[1].type) &&
            args[1]?.some((item) => item.kind === 'unknown')
          )
            demand?.opaque();
          escape(
            args[1] ?? UNKNOWN,
            {
              phase: 'callback',
              context: 'expose-method',
              ...(captureFrames.length ? { guarded: true } : {}),
            },
            value.arguments[1].type
          );
        }
        const frame = captureFrames.at(-1);
        if (trace) {
          const target = value.operation === 'expose.state' ? (args[1] ?? UNKNOWN) : [];
          const introduced = target.flatMap((item) =>
            item.kind === 'named-state' ? [item.state] : []
          );
          if (!frame)
            trace.operation(value, introduced, target.length === 1 && introduced.length === 1);
          if (frame?.hookId) trace.owned?.operation(frame.hookId, value, introduced);
        }
        // A throwing operation may leave the capture untouched. Snapshot that
        // edge before recording successful presence, and retain the existing
        // post-operation edge below for failures after a partial contribution.
        if (!CAPTURE_LOOKUPS.has(value.operation)) possibleThrow();
        const stateMembers = trace ? privilegedStateMembers(value.operation) : [];
        const handle: Known | undefined = stateMembers.length
          ? [
              {
                kind: 'record',
                fields: new Map<string, Known>(
                  stateMembers.map((state) => [state.name, [{ kind: 'named-state', state }]])
                ),
              },
            ]
          : undefined;
        for (const child of privilegedHookCaptures(value))
          recordChild(captureFrames.at(-1), child.name, {
            capture: {
              kind: 'capture',
              states: 'absent',
              events: 'absent',
              methods: new Map(),
              children: new Map(),
            },
            result: handle ?? UNKNOWN,
            handle: handle ?? UNKNOWN,
          });
        args.forEach((argument, index) =>
          callback(
            argument,
            operationArgumentRule(value.operation, index),
            execution,
            value.arguments[index].type
          )
        );
        const name = args[0]?.find(
          (argument) => argument.kind === 'literal' && typeof argument.value === 'string'
        );
        if (value.operation === 'expose.method' && name?.kind === 'literal')
          if (captureFrames.length)
            writeCaptureMethod(captureFrames.at(-1)!, String(name.value), args[1]);
        if (frame) {
          if (
            (value.operation.startsWith('state.') && stateValue(value.type)) ||
            value.operation === 'expose.state'
          )
            store.captures.set(frame, { ...captureContents(frame), states: 'present' });
          if (value.operation === 'expose.event')
            store.captures.set(frame, { ...captureContents(frame), events: 'present' });
        }
        if (CAPTURE_LOOKUPS.has(value.operation))
          return merge(
            receiver.map((item) =>
              item.kind === 'capture'
                ? captureLookup(
                    item,
                    value.operation as CaptureGetterOperation,
                    args[0] ?? UNDEFINED
                  )
                : UNKNOWN
            )
          );
        possibleThrow();
        return handle ?? hostValue(value.type);
      }
      case 'authored-hook': {
        if (!captureFrames.length) trace?.hook(value);
        const parent = captureFrames.at(-1);
        if (parent?.hookId) trace?.owned?.child(parent.hookId, value);
        if (execution.phase !== 'setup' && !trace) {
          if (execution.guarded) {
            possibleThrow();
            reachable = false;
            return [];
          }
          if (!demand) {
            issue = { message: 'Authored hooks install during setup.', span: value.span };
            return UNKNOWN;
          }
        }
        demand?.hook(value);
        const args = (value.arguments ?? []).map((argument) =>
          expression(argument, scope, execution)
        );
        const hook = ir.hooks.find((hook) => hook.id === value.hookId);
        if (!hook) return UNKNOWN;
        if (installingHooks.has(hook.id)) {
          demand?.hook(value, true);
          demand?.opaque();
          return UNKNOWN;
        }
        const alternatives =
          hook.mode === 'multiple'
            ? [undefined]
            : (store.installations.get(hook.name) ?? [undefined]);
        return branches(
          alternatives.map((previous) => () => {
            let installed = previous;
            if (!installed) {
              allocationSerial++;
              const capture: Capture = {
                kind: 'capture',
                hookId: hook.id,
                states: 'absent',
                events: 'absent',
                methods: new Map(),
                children: new Map(),
              };
              installed = {
                capture,
                handle: UNKNOWN,
                api: hostValue(HOOK_API_TYPE),
                pending: true,
                mode: hook.mode,
              };
              if (hook.mode !== 'multiple') store.installations.set(hook.name, [installed]);
              installingHooks.add(hook.id);
              captureFrames.push(capture);
              const returned = call(
                { kind: 'closure', fn: hook.setup, scope: moduleScope },
                [UNKNOWN, args[0] ?? UNDEFINED, installed.api!],
                setup
              );
              captureFrames.pop();
              installingHooks.delete(hook.id);
              if (!reachable) return [];
              store.captures.set(capture, { ...captureContents(capture), render: returned });
              if (!trace) scheduleRender(returned);
              const handle = hook.projectHandle
                ? call(
                    { kind: 'closure', fn: hook.projectHandle, scope: moduleScope },
                    [[capture]],
                    setup
                  )
                : [capture];
              if (!reachable) return [];
              installed = { ...installed, pending: false, result: [capture], handle };
              if (hook.mode !== 'multiple') store.installations.set(hook.name, [installed]);
            }
            if (
              hook.configure &&
              (previous
                ? previous.mode !== 'once' && hook.mode !== 'once'
                : hook.mode === 'configurable')
            )
              call(
                { kind: 'closure', fn: hook.configure, scope: moduleScope },
                [installed.api!, args[0] ?? UNDEFINED, hostValue(HOOK_TOOLS_TYPE)],
                setup
              );
            if (!reachable) return [];
            if (installed.pending) {
              const fallback: Capture = {
                kind: 'capture',
                states: 'absent',
                events: 'absent',
                methods: new Map(),
                children: new Map(),
              };
              installed = {
                ...installed,
                capture: fallback,
                result: [fallback],
                handle: [fallback],
              };
            }
            recordChild(captureFrames.at(-1), hook.name, installed);
            return installed.handle;
          })
        );
      }
      case 'rule':
        expression(value.receiver, scope, execution);
        value.states.forEach((state) => expression(state.value, scope, execution));
        return UNKNOWN;
      case 'context-key':
      case 'static-capability':
      case 'style-handle':
        return UNKNOWN;
    }
  }

  function statements(body: readonly StatementIR[], parent: Scope, execution: Execution): Flow {
    const scope = new Scope(parent),
      slots = new Map<StatementIR, Slot>();
    for (const statement of body)
      if (statement.kind === 'const')
        slots.set(statement, scope.declare(statement.name, statement.bindingId));
    const throws: Store[] = [];
    exceptionSinks.push(throws);
    let completed: Flow = {};
    reachable = true;
    function accept(flow: Flow): void {
      completed = joinFlows([completed, { returned: flow.returned, thrown: flow.thrown }]);
      reachable = !!flow.normal;
      if (flow.normal) store = flow.normal;
    }
    try {
      for (const statement of body) {
        if (issue || !reachable) break;
        switch (statement.kind) {
          case 'const':
            slots.get(statement)!.value = expression(statement.value, scope, execution);
            break;
          case 'effect':
            expression(statement.expression, scope, execution);
            break;
          case 'return': {
            const values = statement.value
              ? expression(statement.value, scope, execution)
              : UNDEFINED;
            if (reachable)
              completed = joinFlows([completed, { returned: { store: snapshot(), values } }]);
            reachable = false;
            break;
          }
          case 'throw':
            expression(statement.value, scope, execution);
            if (reachable) throws.push(snapshot());
            reachable = false;
            break;
          case 'if': {
            const condition = truth(expression(statement.condition, scope, execution)),
              before = snapshot();
            if (!reachable) break;
            const flows: Flow[] = [];
            if (condition !== false) {
              store = copyStore(before);
              flows.push(statements(statement.then, scope, execution));
            }
            if (condition !== true) {
              store = copyStore(before);
              flows.push(statements(statement.otherwise, scope, execution));
            }
            accept(joinFlows(flows));
            break;
          }
          case 'try': {
            const attempted = statements(statement.body, scope, execution);
            let flow: Flow = attempted;
            if (statement.catch && attempted.thrown) {
              store = attempted.thrown;
              const catchScope = new Scope(scope);
              if (statement.catch.name) catchScope.declare(statement.catch.name).value = UNKNOWN;
              const caught = statements(statement.catch.body, catchScope, execution);
              flow = joinFlows([
                { normal: attempted.normal, returned: attempted.returned },
                caught,
              ]);
            }
            if (statement.finally) {
              const completions: Flow[] = [];
              for (const kind of ['normal', 'returned', 'thrown'] as const) {
                const state = kind === 'returned' ? flow.returned?.store : flow[kind];
                if (!state) continue;
                store = copyStore(state);
                const final = statements(statement.finally, scope, execution);
                completions.push({ returned: final.returned, thrown: final.thrown });
                if (final.normal)
                  completions.push(
                    kind === 'returned'
                      ? { returned: { store: final.normal, values: flow.returned!.values } }
                      : { [kind]: final.normal }
                  );
              }
              flow = joinFlows(completions);
            }
            accept(flow);
            break;
          }
        }
      }
      return joinFlows([
        completed,
        ...(reachable ? [{ normal: snapshot() }] : []),
        ...(throws.length ? [{ thrown: joinStores(throws) }] : []),
      ]);
    } finally {
      exceptionSinks.pop();
    }
  }

  // Module closures share the same module environment as hook and prototype setup.
  const declarations = (ir.moduleBindings ?? []).filter(
    (binding): binding is Extract<StatementIR, { kind: 'const' }> => binding.kind === 'const'
  );
  const moduleSlots = declarations.map((binding) =>
    moduleScope.declare(binding.name, binding.bindingId)
  );
  declarations.forEach((binding, index) => {
    moduleSlots[index].value = expression(binding.value, moduleScope, setup);
  });
  const returned = call(
    { kind: 'closure', fn: ir.setup, scope: moduleScope },
    ir.setup.parameters.map((parameter) => hostValue(parameter.type)),
    setup
  );
  if (!trace) scheduleRender(returned);
  // Installation uses strong updates. After installation, every host/public
  // callback may run repeatedly in any order; join its post-store with the
  // quiescent store and revisit roots when their captured callable facts change.
  let quiescent = snapshot(),
    progress = true;
  while (progress && !issue && !trace) {
    progress = false;
    store = copyStore(quiescent);
    for (const root of outwardRoots.values()) escape(root.values, root.execution, root.type, false);
    for (const { closure, execution, outward } of callbacks) {
      store = copyStore(quiescent);
      reachable = true;
      const key = `${identity(closure.fn)}:${execution.phase}:${execution.context}:${execution.guarded ? 'guarded' : 'strict'}:${fingerprint([closure])}:${outward ? 'outward' : 'callback'}`;
      if (analyzedCallbacks.has(key)) continue;
      analyzedCallbacks.add(key);
      progress = true;
      allocationContext = `${identity(closure.fn)}:${fingerprint([closure], true)}`;
      const callbackThrows: Store[] = [];
      exceptionSinks.push(callbackThrows);
      const returned = call(
        closure,
        closure.fn.parameters.map((parameter) =>
          parameter.optional || parameter.default
            ? merge([hostValue(parameter.type), UNDEFINED])
            : hostValue(parameter.type)
        ),
        execution
      );
      exceptionSinks.pop();
      allocationContext = undefined;
      if (outward) escape(returned, execution, closure.fn.returnType);
      quiescent = joinStores([quiescent, snapshot(), ...callbackThrows]);
      if (issue) break;
    }
  }

  return issue;
}
