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
import {
  arrayEveryCallbackParameters,
  callableValue,
  dataBoundaryType,
  joinValueTypes,
  memberValueType,
  objectFields,
  valueAlternatives,
  arrayElementType,
  iterableElementType,
  type CallableType,
} from './value-types';
import { HOOK_API_TYPE, HOOK_TOOLS_TYPE } from './core-value-types';
import { captureFacadeFields } from './capture-types';

const CAPTURE_LOOKUPS = new Map<string, CaptureLookup>([
  ['capture.getState', 'getState'],
  ['capture.getMethod', 'getMethod'],
  ['capture.getAsHook', 'getAsHook'],
  ['capture.getAsHookHandle', 'getAsHookHandle'],
]);

type Known = readonly Atom[];
interface ArrayExtent {
  minimum: number;
  maximum: number;
}
const UNKNOWN_EXTENT: ArrayExtent = { minimum: 0, maximum: Infinity };
// Private analysis limits, not limits on the authored program's runtime work.
const CALLABLE_STORE_WORK_LIMIT = 16_777_216;
const CALLABLE_ACTIVE_CALL_LIMIT = 128;
type CapturedState = HookCaptureIR['states'][number];
type TracedOperation = Extract<ExpressionIR, { kind: 'operation' }>;
type Atom =
  | { kind: 'unknown'; data?: ValueType }
  | { kind: 'undefined' | 'uninitialized' | 'public' | 'absent' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'closure'; fn: FunctionIR; scope: Scope }
  | { kind: 'native'; type: CallableType }
  | { kind: 'named-state'; state: CapturedState }
  | { kind: 'cell'; initial: Known; tracked: boolean }
  | {
      kind: 'record';
      fields: Map<string, Known>;
      tracked?: boolean;
      array?: ArrayExtent;
      set?: true;
      opaqueFields?: boolean;
    }
  | { kind: 'getter'; callable: Known }
  | { kind: 'capture-lookup'; owner: Capture; property: CaptureLookup }
  | ({ kind: 'capture'; hookId?: string } & CaptureContents);
type CaptureLookup = 'getState' | 'getMethod' | 'getAsHook' | 'getAsHookHandle';
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
  arrays: Map<RecordValue, ArrayExtent>;
  installations: Map<string, readonly (Installation | undefined)[]>;
  captures: Map<Capture, CaptureContents>;
  /** Named states present on every successful path to this point. */
  captureStates: Set<string>;
  /** Props declarations/defaults executed on every successful setup path. */
  setupPropOperations: Set<TracedOperation>;
}
const emptyStore = (): Store => ({
  cells: new Map(),
  records: new Map(),
  arrays: new Map(),
  installations: new Map(),
  captures: new Map(),
  captureStates: new Set(),
  setupPropOperations: new Set(),
});
const copyStore = (state: Store): Store => ({
  cells: new Map(state.cells),
  records: new Map(state.records),
  arrays: new Map(state.arrays),
  installations: new Map(state.installations),
  captures: new Map(state.captures),
  captureStates: new Set(state.captureStates),
  setupPropOperations: new Set(state.setupPropOperations),
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
  code?: 'PUI1006';
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
  // An event declaration is not a data escape. Omitted payloads and the actual
  // undefined expression cannot retain an object graph; every other expression
  // still needs its real value provenance, even when its checked type is void.
  // Scan all executable bodies conservatively, including defaults, module
  // helpers and dormant closures. Phase/callable analysis always runs below.
  const seen = new Set<object>();
  const hasPayload = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) return value.some(hasPayload);
    const node = value as Record<string, unknown>;
    if (node.kind === 'operation' && node.operation === 'expose.emit') {
      const payload = (node.arguments as ExpressionIR[])[1];
      if (payload && payload.kind !== 'undefined') return true;
    }
    return Object.entries(node).some(
      ([key, child]) => key !== 'type' && key !== 'span' && hasPayload(child)
    );
  };
  return analyzeCallableFlow(
    ir,
    undefined,
    undefined,
    hasPayload([ir.setup, ir.moduleBindings, ir.hooks])
  );
}

export interface CallableDemandObserver {
  expression(value: ExpressionIR): void;
  function(value: FunctionIR): void;
  hook(value: Extract<ExpressionIR, { kind: 'authored-hook' }>, recursive?: boolean): void;
  /** The actual closure crosses an open host/public invocation boundary. */
  escape?(value: FunctionIR): void;
  /** Actual call provenance, including separate invocations of a shared helper. */
  call?(
    value: Extract<ExpressionIR, { kind: 'call' }>,
    provenance: { external: boolean; authored: readonly FunctionIR[]; closed: boolean }
  ): void;
  /** Read-only array traversal still invokes its actual callable argument. */
  traversal?(
    value: Extract<ExpressionIR, { kind: 'intrinsic' }>,
    provenance: { external: boolean; authored: readonly FunctionIR[]; closed: boolean }
  ): void;
  /** Exact recursive reentry repeats one already active store/argument state.
   * Other opaque edges (including analysis limits) cannot prove a closed call. */
  opaque(reason?: 'recursive-call'): void;
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
    complete?(definiteStates: ReadonlySet<string>): void;
    completePropOperations?(operations: ReadonlySet<TracedOperation>): void;
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
    complete?(definiteStates: ReadonlySet<string>): void;
    completePropOperations?(operations: ReadonlySet<TracedOperation>): void;
    owned?: HookContributionObserver;
  },
  demand?: CallableDemandObserver,
  checkOutwardData = false
): CallableEffectIssue | undefined {
  let issue: CallableEffectIssue | undefined;
  let setupPropsClosed = true;
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
  // Count abstract work, not wall time: small call graphs can still repeatedly
  // clone and join a growing store before reaching the call-count boundary.
  let remainingWork = CALLABLE_STORE_WORK_LIMIT;
  let workSpan = ir.setup.span;
  class WorkLimit extends Error {
    readonly span = workSpan;
    constructor(readonly boundary: 'store-work' | 'call-depth') {
      super(boundary);
    }
  }
  function spendWork(units: number): void {
    remainingWork -= units;
    if (remainingWork < 0) throw new WorkLimit('store-work');
  }
  function storeSize(state: Store): number {
    return (
      state.cells.size +
      state.records.size +
      state.arrays.size +
      state.installations.size +
      state.captures.size +
      state.captureStates.size +
      state.setupPropOperations.size +
      1
    );
  }
  function forkStore(state: Store): Store {
    spendWork(storeSize(state));
    return copyStore(state);
  }
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
  const callbackArguments = new WeakMap<Registration, readonly Known[]>();
  const queuedCallbacks = new WeakMap<Closure, Set<string>>();
  function enqueueCallback(registration: Registration): void {
    const { closure, execution, outward } = registration;
    const key = `${execution.phase}:${execution.context}:${!!execution.guarded}:${!!outward}`;
    const queued = queuedCallbacks.get(closure) ?? new Set<string>();
    if (queued.has(key)) return;
    queued.add(key);
    queuedCallbacks.set(closure, queued);
    // This monotonic queue represents possible external invocations, not a
    // runtime event count. Replaying the identical cached closure needs one
    // root; the quiescent loop still revisits it when its captured store changes.
    // Fresh closures, even of the same function, retain independent entries.
    callbacks.push(registration);
  }
  const outwardRoots = new Map<string, { values: Known; execution: Execution; type?: ValueType }>();
  const childRecords = new WeakMap<Installation, Map<string, RecordValue>>();
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
  const captureRecords = new WeakMap<Capture, Map<string, RecordValue>>();
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
  const extent = (record: RecordValue): ArrayExtent =>
    store.arrays.get(record) ?? record.array ?? UNKNOWN_EXTENT;
  const snapshot = (): Store => forkStore(store);
  const captureContents = (capture: Capture): CaptureContents =>
    store.captures.get(capture) ?? capture;

  function captureRecord(owner: Capture, key: string, contents: Map<string, Known>): Known {
    let records = captureRecords.get(owner);
    if (!records) captureRecords.set(owner, (records = new Map()));
    let record = records.get(key);
    if (!record) {
      record = { kind: 'record', fields: contents, tracked: true };
      records.set(key, record);
      allocationSerial++;
    }
    store.records.set(record, contents);
    return [record];
  }

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
  function joinExtents(values: readonly ArrayExtent[], widen = false): ArrayExtent {
    if (!values.length) return { minimum: 0, maximum: 0 };
    return {
      minimum: Math.min(...values.map((value) => value.minimum)),
      maximum:
        widen && values.some((value) => value.maximum !== values[0].maximum)
          ? Infinity
          : Math.max(...values.map((value) => value.maximum)),
    };
  }
  function arrayExtent(values: Known): ArrayExtent {
    return joinExtents(
      values.map((value) => (value.kind === 'record' ? extent(value) : UNKNOWN_EXTENT))
    );
  }
  /** Read the value's own proof, never the narrower type of its current view. */
  function actualElements(values: Known): Known {
    // A host data fact may retain a union such as array | void. Expand that
    // original contract before iterating; a narrowed view never replaces a
    // tracked container's actual elements or hidden fields.
    const alternatives = values.flatMap((value) =>
      value.kind === 'unknown' && value.data ? hostValue(value.data) : [value]
    );
    return merge(
      alternatives.map((value) => {
        if (value.kind === 'undefined' || (value.kind === 'literal' && value.value === null)) {
          possibleThrow();
          return [];
        }
        if (value.kind === 'record')
          return fields(value).get('*') ?? merge([...fields(value).values()]);
        const element =
          value.kind === 'unknown' && value.data ? iterableElementType(value.data) : undefined;
        return element === undefined ? UNKNOWN : hostValue(element);
      })
    );
  }
  function writeExtent(record: RecordValue, value: ArrayExtent, weak = false): void {
    if (!checkOutwardData) return;
    store.arrays.set(record, weak ? joinExtents([extent(record), value], true) : value);
  }
  function joinStores(states: readonly Store[]): Store {
    if (states.length === 1) return forkStore(states[0]);
    spendWork(states.reduce((total, state) => total + storeSize(state), 0));
    const cells = new Set(states.flatMap((state) => [...state.cells.keys()]));
    const records = new Set(states.flatMap((state) => [...state.records.keys()]));
    const result = emptyStore();
    for (const name of states[0]?.captureStates ?? [])
      if (states.every((state) => state.captureStates.has(name))) result.captureStates.add(name);
    for (const operation of states[0]?.setupPropOperations ?? [])
      if (states.every((state) => state.setupPropOperations.has(operation)))
        result.setupPropOperations.add(operation);
    for (const cell of cells)
      result.cells.set(cell, merge(states.map((state) => state.cells.get(cell) ?? cell.initial)));
    for (const record of records) {
      const maps = states.map((state) => state.records.get(record) ?? record.fields);
      if (maps.every((map) => map === maps[0])) {
        result.records.set(record, maps[0]);
        continue;
      }
      spendWork(maps.reduce((total, map) => total + map.size, 0));
      const names = new Set(maps.flatMap((map) => [...map.keys()]));
      result.records.set(
        record,
        new Map([...names].map((name) => [name, merge(maps.map((map) => map.get(name) ?? ABSENT))]))
      );
    }
    for (const record of new Set(states.flatMap((state) => [...state.arrays.keys()])))
      result.arrays.set(
        record,
        joinExtents(
          states.map((state) => state.arrays.get(record) ?? record.array ?? UNKNOWN_EXTENT),
          true
        )
      );
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
      spendWork(
        contents.reduce((total, value) => total + value.methods.size + value.children.size, 0)
      );
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
      arrays: new Map([...after.arrays].filter(([key, value]) => before.arrays.get(key) !== value)),
      installations: new Map(
        [...after.installations].filter(([key, value]) => before.installations.get(key) !== value)
      ),
      captures: new Map(
        [...after.captures].filter(([key, value]) => before.captures.get(key) !== value)
      ),
      captureStates: new Set(
        [...after.captureStates].filter((name) => !before.captureStates.has(name))
      ),
      setupPropOperations: new Set(
        [...after.setupPropOperations].filter(
          (operation) => !before.setupPropOperations.has(operation)
        )
      ),
    };
  }
  function applyDelta(target: Store, changes: Store): void {
    spendWork(storeSize(changes));
    for (const [key, value] of changes.cells) target.cells.set(key, value);
    for (const [key, value] of changes.records) target.records.set(key, value);
    for (const [key, value] of changes.arrays) target.arrays.set(key, value);
    for (const [key, value] of changes.installations) target.installations.set(key, value);
    for (const [key, value] of changes.captures) target.captures.set(key, value);
    for (const name of changes.captureStates) target.captureStates.add(name);
    for (const operation of changes.setupPropOperations) target.setupPropOperations.add(operation);
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
      values.map((value) => {
        // Unknown scalar contents can still have a known non-nullish domain.
        // Use the value's own fact, never a narrowed expression view or the
        // contents of a tracked record. Empty facts establish no such proof.
        if (nullish && value.kind === 'unknown' && value.data !== undefined) {
          const alternatives = valueAlternatives(value.data);
          if (
            alternatives.length > 0 &&
            alternatives.every((part) =>
              typeof part === 'string'
                ? ['boolean', 'number', 'string'].includes(part)
                : part.kind === 'literal'
                  ? part.value !== null
                  : ['record', 'array', 'object', 'value-array', 'set'].includes(part.kind)
            )
          )
            return true;
        }
        return value.kind === 'undefined' || value.kind === 'absent'
          ? false
          : value.kind === 'literal'
            ? nullish
              ? value.value !== null
              : !!value.value
            : value.kind === 'unknown' || value.kind === 'uninitialized'
              ? undefined
              : true;
      })
    );
    return choices.size === 1 ? [...choices][0] : undefined;
  }
  function branches(actions: readonly (() => Known)[]): Known {
    const before = snapshot(),
      results: Known[] = [],
      after: Store[] = [];
    for (const action of actions) {
      store = forkStore(before);
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
      spendWork(1);
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
        case 'public':
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
            value.array ? 'array' : 'record',
            value.opaqueFields === true,
            value.tracked === false ? null : location(value),
            value.array ? extent(value) : null,
            [...fields(value)]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, field]) => [name, field.map((child) => visit(child, depth + 1))]),
          ];
        case 'getter':
          return ['get', value.callable.map((child) => visit(child, depth + 1))];
        case 'capture-lookup':
          return [
            'capture-lookup',
            value.property,
            location(value.owner),
            visit(value.owner, depth + 1),
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
      return (
        type === 'function' ||
        type === 'unknown' ||
        // Checked module configurations retain host callbacks in named fields
        // (for example CollectionItem.getMeta). Their nominal container type
        // must not erase the actual closure before the operation's field rules
        // register its possible host invocation.
        type === 'module-config' ||
        type === 'authored-result' ||
        type === 'public-expose' ||
        type === 'public-method'
      );
    if (type.kind === 'callable' || type.kind === 'capture') return true;
    if (type.kind === 'object')
      return (
        type.fields.some((field) => !!field.accessor || carriesCallable(field.type)) ||
        (type.index !== undefined && carriesCallable(type.index))
      );
    if (type.kind === 'value-union') return type.members.some(carriesCallable);
    if (type.kind === 'value-array' || type.kind === 'set') return carriesCallable(type.element);
    return false;
  }

  /** Capture discovery transports the actual named-State atoms through the
   * same ordinary containers as callables. A checked authority-shaped type
   * requests tracking; it never invents a State name or a privileged origin. */
  function tracksIdentity(type: ValueType): boolean {
    const aggregate = (type: ValueType): boolean =>
      typeof type !== 'string' &&
      (['record', 'object', 'array', 'value-array', 'set'].includes(type.kind) ||
        ((type.kind === 'union' || type.kind === 'value-union') && type.members.some(aggregate)));
    return (
      carriesCallable(type) ||
      (!!trace && !isDataValueType(type)) ||
      (checkOutwardData && aggregate(type))
    );
  }

  /** A scalar declared field view proves the published shape of plain data. */
  function scalarDataView(view: ValueType | undefined, top: boolean): boolean {
    return (
      view !== undefined &&
      valueAlternatives(view).every((type) =>
        typeof type === 'string'
          ? ['boolean', 'number', 'string', 'null', ...(top ? ['void'] : [])].includes(type)
          : type.kind === 'literal'
      )
    );
  }
  /** The declared member type of one published field, when the view declares it. */
  function dataFieldView(
    view: ValueType | undefined,
    name: string,
    array = false
  ): ValueType | undefined {
    if (view === undefined) return undefined;
    const members = valueAlternatives(view).map((type) =>
      array
        ? typeof type !== 'string' && type.kind === 'array'
          ? type.element
          : undefined
        : objectFields(type)?.find((field) => field.name === name)?.type
    );
    return members.every((type): type is ValueType => type !== undefined)
      ? joinValueTypes(members)
      : undefined;
  }
  /** A retained data fact is publishable when its declared view stays plain data. */
  function runtimeDataType(type: ValueType, view: ValueType | undefined, top: boolean): boolean {
    if (scalarDataView(view, top)) return true;
    if (typeof type === 'string' || type.kind === 'literal')
      return dataBoundaryType(type, top) !== undefined;
    if (type.kind === 'union' || type.kind === 'value-union')
      return type.members.every((member) => runtimeDataType(member, view, top));
    if (type.kind === 'array')
      return runtimeDataType(type.element, dataFieldView(view, '', true), false);
    if (type.kind === 'object' || type.kind === 'record')
      return (
        !('index' in type && type.index !== undefined) &&
        type.fields.every(
          (field) =>
            !('accessor' in field && field.accessor) &&
            runtimeDataType(field.type, dataFieldView(view, field.name), false)
        )
      );
    return false;
  }
  /** Publication examines retained values, including fields hidden by a narrower
   * checked view. It never calls getters or treats a type assertion as a copy. */
  function outwardData(
    values: Known,
    view: ValueType | undefined,
    top = true,
    ancestors = new Set<Atom>()
  ): boolean {
    return values.every((value) => {
      if (value.kind === 'absent') return !top;
      if (value.kind === 'undefined') return top;
      if (value.kind === 'literal') return true;
      if (value.kind === 'unknown')
        return value.data !== undefined && runtimeDataType(value.data, view, top);
      if (
        value.kind !== 'record' ||
        value.set ||
        value.opaqueFields ||
        ancestors.has(value) ||
        ancestors.size > 256
      )
        return false;
      ancestors.add(value);
      const valid = [...fields(value).entries()].every(([name, field]) =>
        outwardData(field, dataFieldView(view, name), false, ancestors)
      );
      ancestors.delete(value);
      return valid;
    });
  }

  /** A checked data view can refine an untracked host fact without discarding
   * an actually tracked closure, mutable container, or owner capability. */
  function checkedFacts(values: Known, type: ValueType): Known {
    if (!isDataValueType(type)) return values;
    return values.map((value) =>
      value.kind === 'unknown' && !value.data ? { kind: 'unknown', data: type } : value
    );
  }

  /** Native callback inputs and fixed host results carry an explicit external contract. */
  function hostValue(type: ValueType): Known {
    const key = JSON.stringify(type),
      cached = hostTypes.get(key);
    if (cached) return cached;
    if (type === 'public-expose') return [{ kind: 'public' }];
    if (type === 'public-method') return [{ kind: 'native', type: callableValue(type) }];
    if (type === 'null') return [{ kind: 'literal', value: null }];
    if (typeof type === 'string')
      return type === 'void' ? UNDEFINED : isDataValueType(type) ? dataFact(type) : UNKNOWN;
    if (type.kind === 'literal') return [{ kind: 'literal', value: type.value }];
    if (type.kind === 'callable') {
      const value: Known = [{ kind: 'native', type }];
      hostTypes.set(key, value);
      return value;
    }
    if (type.kind === 'value-union' || type.kind === 'union')
      return merge(type.members.map(hostValue));
    // A general data type can still contain nested void. Retain that original
    // fact too: JSON publication checks it at its actual nesting depth.
    if (checkOutwardData && (isDataValueType(type) || dataBoundaryType(type) !== undefined))
      return dataFact(type);
    if (type.kind === 'value-array' || type.kind === 'set') {
      if (!carriesCallable(type.element) && !checkOutwardData) return UNKNOWN;
      return [
        {
          kind: 'record',
          fields: new Map([['*', hostValue(type.element)]]),
          tracked: true,
          ...(type.kind === 'set' ? { set: true as const } : {}),
        },
      ];
    }
    if (type.kind === 'object' || type.kind === 'record') {
      if (isDataValueType(type)) return dataFact(type);
      // A non-JSON host aggregate must keep its original structure. A bare
      // UNKNOWN could otherwise acquire a narrower data fact at a later view.
      const finite = type.index === undefined;
      if (!carriesCallable(type) && !(checkOutwardData && finite))
        return checkOutwardData ? dataFact(type) : UNKNOWN;
      const record: RecordValue = {
        kind: 'record',
        fields: new Map(),
        tracked: carriesCallable(type) || checkOutwardData,
        opaqueFields: checkOutwardData && type.index !== undefined,
      };
      const value: Known = [record];
      for (const field of type.fields) {
        const contents: Known =
          'accessor' in field && field.accessor
            ? [
                {
                  kind: 'getter',
                  callable: hostValue({ kind: 'callable', parameters: [], returnType: field.type }),
                },
              ]
            : hostValue(field.type);
        record.fields.set(
          field.name,
          field.optional ? merge([contents, UNDEFINED, ABSENT]) : contents
        );
      }
      return value;
    }
    return UNKNOWN;
  }

  function call(closure: Closure, args: readonly Known[], execution: Execution): Known {
    if (issue) return UNKNOWN;
    workSpan = closure.fn.span;
    demand?.function(closure.fn);
    fingerprintExceeded = false;
    const installationKey = JSON.stringify(
      [...store.installations].map(([name, alternatives]) => [
        name,
        alternatives.map((value) => (value ? location(value) : null)),
      ])
    );
    const key = `${installationKey}:${identity(closure.fn)}:${execution.phase}:${execution.context}:${execution.guarded ? 'guarded' : 'strict'}:${captureFrames.length ? location(captureFrames.at(-1)!) : 'public'}:${fingerprint([closure])}:${args.map((argument) => fingerprint(argument)).join(';')}:${trace ? JSON.stringify([...store.captureStates].sort()) : ''}:${trace?.completePropOperations ? JSON.stringify([...store.setupPropOperations].map(location).sort((a, b) => a - b)) : ''}`;
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
      cached.callbacks.forEach(enqueueCallback);
      return cached.result;
    }
    if (active.has(key)) {
      if (trace?.completePropOperations) setupPropsClosed = false;
      demand?.opaque('recursive-call');
      return UNKNOWN;
    }
    // The worklist bound applies to new checked states. Exact cache replays
    // already account for their captured-store and argument fingerprints,
    // writes, throws and callback roots; they do not expand the analysis.
    if (++callCount > 8192) {
      opaque(closure.fn.span);
      if (demand)
        issue ??= {
          message: 'Callable flow exceeds the finite analysis worklist boundary.',
          span: closure.fn.span,
        };
      return UNKNOWN;
    }
    // Changing captured stores can produce distinct recursive keys forever.
    // Refuse the incomplete proof before exhausting the JavaScript stack.
    if (active.size >= CALLABLE_ACTIVE_CALL_LIMIT) throw new WorkLimit('call-depth');
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
        if (parameter.rest) {
          slots[index].value = [
            { kind: 'record', fields: new Map([['*', merge(args.slice(index))]]), tracked: true },
          ];
          return;
        }
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
    const property = CAPTURE_LOOKUPS.get('capture.' + name);
    if (property) return ownValue(presence, [{ kind: 'capture-lookup', owner: capture, property }]);
    const contents = captureContents(capture);
    if (name === 'methods')
      return ownValue(presence, captureRecord(capture, 'methods', contents.methods));
    const field = captureFields(capture).find((field) => field.name === name);
    if (!field) return ABSENT;
    if (name === 'artifacts')
      return ownValue(
        presence,
        captureRecord(
          capture,
          'artifacts',
          new Map(
            (objectFields(field.type) ?? []).map((artifact): [string, Known] => [
              artifact.name,
              artifact.name === 'methods'
                ? ownValue(
                    memberPresence(contents.methods.values()),
                    captureRecord(capture, 'methods', contents.methods)
                  )
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
        )
      );
    return ownValue(presence, carriesCallable(field.type) ? UNKNOWN : hostValue(field.type));
  }

  function captureProperty(capture: Capture, name: string): Known {
    return readValue(captureOwnProperty(capture, name));
  }

  /** Direct operations and copied getters resolve the same current capture graph. */
  function captureLookup(value: Extract<Atom, { kind: 'capture-lookup' }>, argument: Known): Known {
    const capture = value.owner;
    const property = value.property;
    const contents = captureContents(capture);
    const hook = ir.hooks.find((hook) => hook.id === capture.hookId);
    const unresolved = argument.some(
      (key) => key.kind !== 'literal' || typeof key.value !== 'string'
    );
    // Sharing provenance must retain the State/unresolved lookup exception edge.
    if (property === 'getState' || unresolved) possibleThrow();
    const keys = new Set(
      argument.flatMap((key) =>
        key.kind === 'literal' && typeof key.value === 'string' ? [key.value] : []
      )
    );
    if (unresolved) {
      const candidates =
        property === 'getMethod'
          ? contents.methods.keys()
          : property === 'getState'
            ? (hook?.capture?.states ?? []).map((state) => state.name)
            : contents.children.keys();
      for (const key of candidates) keys.add(key);
    }
    const result = [...keys].map((key): Known => {
      if (property === 'getMethod') return readValue(contents.methods.get(key) ?? ABSENT);
      if (property === 'getState') {
        // Incomplete first-pass capture metadata never proves a source callable.
        if (!hook?.capture) return UNKNOWN;
        const type =
          operationResultType('capture.getState', undefined, {
            capture: hook.capture,
            captureKey: key,
          }) ?? 'unknown';
        return carriesCallable(type) ? UNKNOWN : hostValue(type);
      }
      return merge(
        (contents.children.get(key) ?? [undefined]).map((child) =>
          !child
            ? UNDEFINED
            : property === 'getAsHookHandle'
              ? child.handle
              : childRecord(child, key)
        )
      );
    });
    if (unresolved) result.push(property === 'getState' && !hook?.capture ? UNKNOWN : UNDEFINED);
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
          if (value.kind === 'capture-lookup') {
            const failure = operationFailure('capture.' + value.property, execution, span);
            return failure ?? captureLookup(value, args[0] ?? UNDEFINED);
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
      if (value.kind === 'closure') {
        demand?.escape?.(value.fn);
        enqueueCallback({ closure: value, execution, outward: true });
      } else if (value.kind === 'capture-lookup' && value.property !== 'getState')
        pending.push(...captureLookup(value, UNKNOWN).map((value) => ({ value, type: undefined })));
      else if (value.kind === 'getter')
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
          if (value.kind === 'closure') enqueueCallback({ closure: value, execution: origin });
    }
    if (rule.fields)
      for (const value of values)
        if (value.kind === 'record')
          for (const [key, field] of Object.entries(rule.fields))
            callback(fields(value).get(key) ?? UNKNOWN, field, execution);
  }

  function scheduleRender(values: Known): void {
    for (const value of values) {
      if (value.kind === 'closure') enqueueCallback({ closure: value, execution: render });
      else if (value.kind === 'unknown' && !value.data) opaque(ir.setup.span);
    }
  }

  function childRecord(child: Installation, name: string): Known {
    let records = childRecords.get(child);
    if (!records) childRecords.set(child, (records = new Map()));
    let record = records.get(name);
    if (!record) {
      record = {
        kind: 'record',
        fields: new Map<string, Known>([
          ['name', [{ kind: 'literal', value: name }]],
          ['result', child.result ?? [child.capture]],
          ['handle', child.handle],
        ]),
      };
      records.set(name, record);
      allocationSerial++;
    }
    return [record];
  }

  function overlayField(source: Known, previous: Known | undefined): Known {
    return merge(source.map((value) => (value.kind === 'absent' ? (previous ?? ABSENT) : [value])));
  }

  function property(
    values: Known,
    name: string,
    execution: Execution,
    span: SourceSpan,
    optional = false
  ): Known {
    if (!reachable) return [];
    return branches(
      values.map((value) => () => {
        if (value.kind === 'undefined' || (value.kind === 'literal' && value.value === null)) {
          if (optional) return UNDEFINED;
          // A nullish receiver throws before a method read or its call arguments.
          // Preserve the throwing store for an authored catch/finally successor.
          possibleThrow();
          reachable = false;
          return [];
        }
        if (value.kind === 'record') {
          if (value.set && name === 'size') return dataFact('number');
          if (value.array && name === 'length') return dataFact('number');
          const field =
            fields(value).get(name) ??
            (/^(0|[1-9]\d*)$/.test(name) ? fields(value).get('*') : undefined) ??
            UNDEFINED;
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
        if (value.kind === 'unknown' && value.data) {
          const field = objectFields(value.data)?.find((field) => field.name === name);
          if (field) {
            const known = hostValue(field.type);
            return field.optional ? merge([known, UNDEFINED]) : known;
          }
          const element = arrayElementType(value.data);
          if (element !== undefined) {
            if (name === 'length') return dataFact('number');
            if (/^(0|[1-9]\d*)$/.test(name)) return merge([hostValue(element), UNDEFINED]);
          }
          if (checkOutwardData) {
            try {
              return hostValue(memberValueType(value.data, name));
            } catch {
              return UNKNOWN;
            }
          }
        }
        return UNKNOWN;
      })
    );
  }

  // Own enumerable keys visit integer indices first, then the remaining names
  // in creation order. Reading each getter is a real sequential invocation.
  function ownKeys(record: RecordValue): string[] {
    // Set membership is internal storage, not an own enumerable property.
    const keys = [...fields(record).keys()].filter((key) => !record.set || key !== '*');
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
  ): { fields: Map<string, Known>; opaque: boolean } {
    const copies: Map<string, Known>[] = [];
    let opaqueFields = false;
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
        if (value.kind === 'record') {
          opaqueFields ||= value.opaqueFields === true;
          for (const name of ownKeys(value)) {
            copyField(name, fields(value).get(name) ?? ABSENT);
            if (!reachable) return [];
          }
        } else if (value.kind === 'capture') {
          for (const field of captureFields(value)) {
            copyField(field.name, captureOwnProperty(value, field.name));
            if (!reachable) return [];
          }
        } else if (
          value.kind === 'undefined' ||
          (value.kind === 'literal' && value.value === null)
        ) {
          // A nullish source has no own fields in either callable or data flow.
        } else {
          // A structural view cannot erase the backing host value's full shape.
          const retained = checkOutwardData && value.kind === 'unknown' ? value.data : type;
          const declared = retained === undefined ? undefined : objectFields(retained);
          if (
            checkOutwardData &&
            (!declared ||
              (typeof retained !== 'string' &&
                retained?.kind === 'object' &&
                retained.index !== undefined))
          )
            opaqueFields = true;
          for (const field of declared ?? []) {
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
        }
        copies.push(copy);
        return UNDEFINED;
      })
    );
    const names = new Set(copies.flatMap((copy) => [...copy.keys()]));
    return {
      fields: new Map(
        [...names].map((name) => [name, merge(copies.map((copy) => copy.get(name) ?? ABSENT))])
      ),
      opaque: opaqueFields,
    };
  }

  function callOperands(
    value: Extract<ExpressionIR, { kind: 'call' | 'helper-call' }>,
    scope: Scope,
    execution: Execution
  ) {
    const types = value.arguments.map((argument, index) => ({
      type: value.spread?.[index] ? iterableElementType(argument.type)! : argument.type,
    }));
    const args = value.arguments.map((argument, index): Known => {
      const known = expression(argument, scope, execution);
      if (!value.spread?.[index]) return known;
      return merge(
        known.map((owner) =>
          owner.kind === 'record'
            ? (fields(owner).get('*') ?? merge([...fields(owner).values()]))
            : hostValue(types[index].type)
        )
      );
    });
    return { args, types };
  }

  function expression(value: ExpressionIR, scope: Scope, execution: Execution): Known {
    if (issue || !reachable) return [];
    workSpan = value.span;
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
      case 'reference': {
        const values = scope.lookup(value.name, value.bindingId)?.value ?? UNKNOWN;
        // Scalar flow facts may refine an opaque input or recursive result,
        // but cannot erase a tracked container or authority-bearing value.
        return scalarDataView(value.type, true) ? checkedFacts(values, value.type) : values;
      }
      case 'narrow': {
        const values = expression(value.value, scope, execution);
        return checkedFacts(
          values.flatMap((known) => (known.kind === 'public' ? hostValue(value.type) : [known])),
          value.type
        );
      }
      case 'function':
        return [{ kind: 'closure', fn: value.function, scope }];
      case 'call': {
        const targets = expression(value.callee, scope, execution).map(
          (known): Atom =>
            known.kind === 'public'
              ? { kind: 'native', type: callableValue(value.callee.type, !!value.optional) }
              : known
        );
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
                  const { args, types } = callOperands(value, scope, execution);
                  if (!reachable) return [];
                  demand?.call?.(value, {
                    external: present.some((target) => target.kind === 'native'),
                    authored: present.flatMap((target) =>
                      target.kind === 'closure' ? [target.fn] : []
                    ),
                    // A definitely non-callable value can only throw after
                    // argument evaluation. It contributes no invoked closure
                    // on a normally continuing path; unknown/native values do.
                    closed: present.every(
                      (target) =>
                        target.kind === 'closure' ||
                        target.kind === 'capture-lookup' ||
                        target.kind === 'undefined' ||
                        target.kind === 'uninitialized' ||
                        target.kind === 'literal'
                    ),
                  });
                  return calls(present, args, execution, value.span, types);
                },
              ]
            : []),
        ]);
      }
      case 'helper-call': {
        const { args, types } = callOperands(value, scope, execution);
        return calls(
          scope.lookup(value.name)?.value ?? UNKNOWN,
          args,
          execution,
          value.span,
          types
        );
      }
      case 'member':
        if (value.property === 'length' && arrayElementType(value.object.type) !== undefined) {
          expression(value.object, scope, execution);
          return dataFact('number');
        }
        return checkedFacts(
          property(
            expression(value.object, scope, execution),
            value.property,
            execution,
            value.span,
            value.optional
          ),
          value.type
        );
      case 'element': {
        const owner = expression(value.object, scope, execution);
        if (!reachable) return [];
        const absent = (item: Atom) =>
          item.kind === 'undefined' || (item.kind === 'literal' && item.value === null);
        const present = value.optional ? owner.filter((item) => !absent(item)) : owner;
        return checkedFacts(
          branches([
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
                                ...present.flatMap((item) => {
                                  if (item.kind === 'record')
                                    return ownKeys(item).map(
                                      (name) => () => property([item], name, execution, value.span)
                                    );
                                  const data = item.kind === 'unknown' ? item.data : undefined;
                                  return checkOutwardData &&
                                    data &&
                                    typeof data !== 'string' &&
                                    data.kind === 'array'
                                    ? [() => hostValue(data.element)]
                                    : [];
                                }),
                              ])
                      )
                    );
                  },
                ]
              : []),
          ]),
          value.type
        );
      }
      case 'record': {
        if (!tracksIdentity(value.type)) {
          value.entries.forEach((entry) => expression(entry.value, scope, execution));
          return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
        }
        let record = recordSites.get(value) as RecordValue | undefined;
        const repeated = !!record;
        if (!record) {
          record = {
            kind: 'record',
            fields: new Map(),
            tracked: tracksIdentity(value.type),
          };
          recordSites.set(value, record);
          allocationSerial++;
        }
        for (const entry of value.entries) {
          const field = expression(entry.value, scope, execution);
          const initial: Known = entry.accessor ? [{ kind: 'getter', callable: field }] : field;
          if (!repeated) record.fields.set(entry.key, initial);
          writeField(record, entry.key, initial, repeated);
        }
        return [record];
      }
      case 'object-spread': {
        let nextFields = new Map<string, Known>();
        let opaqueFields = false;
        for (const part of value.parts) {
          const result = expression(part.value, scope, execution);
          if (!reachable) return [];
          if (part.kind === 'entry') {
            nextFields.set(
              part.key,
              part.accessor ? [{ kind: 'getter', callable: result }] : result
            );
          } else {
            const copied = copyProperties(
              result,
              execution,
              value.span,
              nextFields,
              part.value.type
            );
            nextFields = copied.fields;
            opaqueFields ||= copied.opaque;
            if (!reachable) return [];
          }
        }
        if (!tracksIdentity(value.type))
          return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
        let record = recordSites.get(value) as RecordValue | undefined;
        const repeated = !!record;
        if (!record) {
          record = {
            kind: 'record',
            fields: new Map(),
            tracked: tracksIdentity(value.type),
          };
          recordSites.set(value, record);
          allocationSerial++;
        }
        if (checkOutwardData && opaqueFields) record.opaqueFields = true;
        for (const [name, field] of nextFields) {
          if (!repeated) record.fields.set(name, field);
          writeField(record, name, field, repeated);
        }
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
          // A checked host-data union can contain an actual undefined alternative.
          // Split those facts before selecting the values returned by each branch;
          // tracked records/closures retain their real identity and hidden fields.
          const alternatives = merge(
            left.map((part) =>
              part.kind === 'unknown' && part.data ? hostValue(part.data) : [part]
            )
          );
          const condition = truth(alternatives, value.operator === '??');
          const useRight =
            value.operator === '&&' ? condition : condition === undefined ? undefined : !condition;
          // Only the short-circuiting left alternatives reach the result.
          // In particular a nullish left value cannot survive a ?? fallback.
          const retained = alternatives.filter((item) => {
            const choice = truth([item], value.operator === '??');
            return value.operator === '&&' ? choice !== true : choice !== false;
          });
          return branches([
            ...(useRight !== true ? [() => retained] : []),
            ...(useRight !== false ? [() => expression(value.right, scope, execution)] : []),
          ]);
        }
        expression(value.right, scope, execution);
        return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
      }
      case 'unary': {
        const operand = expression(value.operand, scope, execution);
        // Negation of a known absent value is a closed control-flow fact. In
        // particular an uninstalled optional Hook must not manufacture a
        // reachable call through a member of its null result.
        if (value.operator === '!') {
          const condition = truth(operand);
          if (condition !== undefined) return [{ kind: 'literal', value: !condition }];
        }
        return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
      }
      case 'intrinsic': {
        const args = value.arguments.map((argument) => expression(argument, scope, execution));
        const array = value.arguments[0]?.type;
        const list = (values: Known, bounds = UNKNOWN_EXTENT): Known => {
          if (!tracksIdentity(value.type))
            return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
          let record = recordSites.get(value) as RecordValue | undefined;
          const repeated = !!record;
          if (!record) {
            record = {
              kind: 'record',
              fields: new Map(),
              tracked: true,
              ...(checkOutwardData ? { array: bounds } : {}),
              ...(typeof value.type !== 'string' && value.type.kind === 'set'
                ? { set: true as const }
                : {}),
            };
            recordSites.set(value, record);
            allocationSerial++;
          }
          if (!repeated) record.fields.set('*', values);
          writeField(record, '*', values, repeated);
          writeExtent(record, bounds, repeated);
          return [record];
        };
        if (value.name === 'set.create') return list(args.length ? actualElements(args[0]) : []);
        if (value.name === 'array.push' || value.name === 'set.add') {
          const additions = merge(args.slice(1));
          for (const owner of args[0] ?? []) {
            if (owner.kind === 'record') {
              writeField(owner, '*', additions, true);
              if (value.name === 'array.push') {
                const prior = extent(owner),
                  count = args.length - 1;
                writeExtent(
                  owner,
                  { minimum: prior.minimum + count, maximum: prior.maximum + count },
                  args[0].length > 1
                );
              }
            } else if (value.arguments.slice(1).some((argument) => carriesCallable(argument.type)))
              opaque(value.span);
          }
          return value.name === 'set.add' ? args[0] : dataFact('number');
        }
        if (value.name === 'array.shift' || value.name === 'array.pop') {
          const result = merge([actualElements(args[0]), UNDEFINED]);
          for (const owner of args[0] ?? []) {
            if (owner.kind !== 'record') continue;
            const prior = extent(owner);
            const next = {
              minimum: Math.max(0, prior.minimum - 1),
              maximum: Math.max(0, prior.maximum - 1),
            };
            writeExtent(owner, next, args[0].length > 1);
            if (checkOutwardData && next.maximum === 0 && args[0].length === 1)
              writeField(owner, '*', []);
          }
          return result;
        }
        if (value.name === 'array.at') return merge([actualElements(args[0]), UNDEFINED]);
        if (value.name === 'array.slice')
          return list(
            actualElements(args[0]),
            args.length === 1
              ? arrayExtent(args[0])
              : { minimum: 0, maximum: arrayExtent(args[0]).maximum }
          );
        if (value.name === 'array.from') return list(actualElements(args[0]), arrayExtent(args[0]));
        if (array && arrayElementType(array) !== undefined && value.name === 'array.sort') {
          const element = arrayElementType(array)!;
          const targets = args[1] ?? UNKNOWN;
          demand?.traversal?.(value, {
            external: targets.some(
              (target) => target.kind === 'native' || target.kind === 'public'
            ),
            authored: targets.flatMap((target) => (target.kind === 'closure' ? [target.fn] : [])),
            closed: targets.length > 0 && targets.every((target) => target.kind === 'closure'),
          });
          calls(
            targets,
            [actualElements(args[0]), actualElements(args[0])],
            execution,
            value.span,
            [{ type: element }, { type: element }]
          );
          return args[0];
        }
        if (array && arrayElementType(array) !== undefined && value.name === 'array.reduce') {
          const element = arrayElementType(array)!,
            accumulator = value.arguments[2]?.type ?? element;
          const targets = args[1] ?? UNKNOWN;
          demand?.traversal?.(value, {
            external: targets.some(
              (target) => target.kind === 'native' || target.kind === 'public'
            ),
            authored: targets.flatMap((target) => (target.kind === 'closure' ? [target.fn] : [])),
            closed: targets.length > 0 && targets.every((target) => target.kind === 'closure'),
          });
          if (!checkOutwardData) {
            calls(
              targets,
              [hostValue(accumulator), hostValue(element), dataFact('number'), args[0]],
              execution,
              value.span,
              [accumulator, element, 'number' as const, array].map((type) => ({ type }))
            );
            return hostValue(value.type);
          }
          // A checked accumulator type does not erase retained fields. The
          // zero-iteration result is the actual seed (or first actual element);
          // each later invocation receives the preceding actual result.
          const initial = arrayExtent(args[0]),
            hasSeed = args.length > 2;
          if (!hasSeed && initial.minimum === 0) possibleThrow();
          if (!hasSeed && initial.maximum === 0) {
            reachable = false;
            return [];
          }
          let accumulated = hasSeed ? args[2] : actualElements(args[0]);
          const exits: { values: Known; store: Store }[] = [];
          const finish = () => exits.push({ values: accumulated, store: snapshot() });
          const previousAllocationContext = allocationContext;
          // Repeated iterations join only this invocation's allocation sites.
          // Separate ordinary calls still create distinct result identities.
          allocationContext = `${allocationContext ?? `reduce:${allocationSerial++}`}:${location(value)}`;
          const seen = new Map<string, number>();
          let completed = false;
          try {
            for (let iteration = 0, index = hasSeed ? 0 : 1; iteration < 64; iteration++, index++) {
              const current = arrayExtent(args[0]);
              if (index >= initial.minimum || index >= current.minimum) finish();
              if (index >= initial.maximum || index >= current.maximum) {
                completed = true;
                break;
              }
              const key = fingerprint([
                ...accumulated,
                ...store.cells.keys(),
                ...store.records.keys(),
                ...store.captures.keys(),
              ]);
              const previous = seen.get(key);
              // A stable state gives the same result for further iterations;
              // an unknown-length cycle has already contributed every exit.
              if (
                previous === iteration - 1 ||
                (previous !== undefined && initial.maximum === Infinity && index >= initial.minimum)
              ) {
                finish();
                completed = true;
                break;
              }
              seen.set(key, iteration);
              accumulated = calls(
                targets,
                [accumulated, actualElements(args[0]), dataFact('number'), args[0]],
                execution,
                value.span,
                [accumulator, element, 'number' as const, array].map((type) => ({ type }))
              );
              if (issue || !reachable) {
                completed = true;
                break;
              }
            }
            if (!completed) opaque(value.span);
          } finally {
            allocationContext = previousAllocationContext;
          }
          reachable = exits.length > 0;
          if (reachable) store = joinStores(exits.map((exit) => exit.store));
          return merge(exits.map((exit) => exit.values));
        }
        if (
          array &&
          arrayElementType(array) !== undefined &&
          [
            'array.every',
            'array.some',
            'array.filter',
            'array.find',
            'array.findIndex',
            'array.map',
            'array.flatMap',
            'array.forEach',
          ].includes(value.name)
        ) {
          const parameters = arrayEveryCallbackParameters(array);
          const element = actualElements(args[0]);
          const traversalExtent = arrayExtent(args[0]);
          const targets = args[1] ?? UNKNOWN;
          demand?.traversal?.(value, {
            external: targets.some(
              (target) => target.kind === 'native' || target.kind === 'public'
            ),
            authored: targets.flatMap((target) => (target.kind === 'closure' ? [target.fn] : [])),
            closed: targets.length > 0 && targets.every((target) => target.kind === 'closure'),
          });
          const result = calls(
            targets,
            [element, dataFact('number'), args[0]],
            execution,
            value.span,
            parameters
          );
          if (value.name === 'array.filter')
            return list(element, { minimum: 0, maximum: traversalExtent.maximum });
          if (value.name === 'array.find') return merge([element, UNDEFINED]);
          // map snapshots its input length before calling the mapper. A mapper
          // may remove later elements, but cannot erase the first normal result.
          if (value.name === 'array.map')
            return list(result, {
              minimum: traversalExtent.minimum > 0 ? 1 : 0,
              maximum: traversalExtent.maximum,
            });
          if (value.name === 'array.flatMap') return list(actualElements(result));
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
              if (target.kind === 'record') {
                if (checkOutwardData && copied.opaque) target.opaqueFields = true;
                for (const [name, field] of copied.fields)
                  writeField(
                    target,
                    name,
                    overlayField(field, fields(target).get(name)),
                    args[0].length > 1
                  );
              }
          }
          return checkOutwardData
            ? args[0]
            : isDataValueType(value.type)
              ? dataFact(value.type)
              : args[0];
        }
        return value.name === 'object.freeze'
          ? args[0]
          : checkOutwardData
            ? hostValue(value.type)
            : isDataValueType(value.type)
              ? dataFact(value.type)
              : UNKNOWN;
      }
      case 'lexical-cell': {
        const initial = expression(value.value, scope, execution);
        let cell = recordSites.get(value) as Cell | undefined;
        if (!cell) {
          cell = {
            kind: 'cell',
            initial,
            // A scalar or void callable view can retain an actual source return graph.
            // Publication analysis keeps every cell's real initialization and writes.
            tracked: checkOutwardData || tracksIdentity(lexicalStoredType(value.type)!),
          };
          recordSites.set(value, cell);
          if (cell.tracked) allocationSerial++;
        } else if (cell.tracked) store.cells.set(cell, merge([cellValue(cell), initial]));
        return [cell];
      }
      case 'lexical-read': {
        const values = merge(
          expression(value.cell, scope, execution).map((cell) =>
            cell.kind === 'cell' ? cellValue(cell) : UNKNOWN
          )
        );
        // Scalar cells need no identity tracking, but their checked storage
        // domain still proves a data snapshot. Aggregate views must retain
        // their actual contents, including fields hidden by a declared shape.
        return scalarDataView(value.type, true) ? checkedFacts(values, value.type) : values;
      }
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
      case 'array-spread': {
        let bounds: ArrayExtent = { minimum: 0, maximum: 0 };
        const elements =
          value.kind === 'array'
            ? value.elements.map((element) => {
                bounds.minimum++;
                bounds.maximum++;
                return expression(element, scope, execution);
              })
            : value.parts.map((part) => {
                const result = expression(part.value, scope, execution);
                const size = part.spread ? arrayExtent(result) : { minimum: 1, maximum: 1 };
                bounds = {
                  minimum: bounds.minimum + size.minimum,
                  maximum: bounds.maximum + size.maximum,
                };
                return part.spread ? actualElements(result) : result;
              });
        if (
          !tracksIdentity(value.type) &&
          !(
            typeof value.type !== 'string' &&
            value.type.kind === 'value-array' &&
            !value.type.readonly
          )
        )
          return isDataValueType(value.type) ? dataFact(value.type) : UNKNOWN;
        let record = recordSites.get(value) as RecordValue | undefined;
        const repeated = !!record;
        if (!record) {
          record = {
            kind: 'record',
            fields: new Map(),
            tracked: true,
            ...(checkOutwardData ? { array: bounds } : {}),
          };
          recordSites.set(value, record);
          allocationSerial++;
        }
        const contents = merge(elements);
        if (!repeated) record.fields.set('*', contents);
        writeField(record, '*', contents, repeated);
        writeExtent(record, bounds, repeated);
        return [record];
      }
      case 'operation': {
        const receiver = value.receiver ? expression(value.receiver, scope, execution) : UNKNOWN;
        const args = value.arguments.map((argument) => expression(argument, scope, execution));
        if (
          checkOutwardData &&
          !issue &&
          reachable &&
          value.operation === 'expose.emit' &&
          !outwardData(args[1] ?? UNDEFINED, value.arguments[1]?.type ?? 'void')
        ) {
          issue = {
            code: 'PUI1006',
            message:
              'Outward JSON payload retains a value outside the declared data boundary. Copy only plain, defined data fields before publication.',
            span: value.span,
          };
          return UNKNOWN;
        }
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
        if (value.operation === 'props.define') {
          // A validator is retained by props resolution and may run both during
          // setup and later updates. Neither origin grants it an owner handle.
          for (const schemas of args[0] ?? [])
            if (schemas.kind === 'record')
              for (const specification of fields(schemas).values())
                for (const spec of specification)
                  if (spec.kind === 'record') {
                    const validator = fields(spec).get('validator');
                    if (validator) {
                      escape(validator, { phase: 'setup', context: 'setup' });
                      escape(validator, { phase: 'callback', context: 'helper' });
                    }
                  }
        }
        const frame = captureFrames.at(-1);
        if (trace) {
          const target =
            value.operation === 'expose.state' || value.operation === 'accessible.state'
              ? (args[1] ?? UNKNOWN)
              : [];
          const introduced = target.flatMap((item) =>
            item.kind === 'named-state' ? [item.state] : []
          );
          if (!frame) {
            trace.operation(value, introduced, target.length === 1 && introduced.length === 1);
            if (target.length === 1 && introduced.length === 1)
              store.captureStates.add(introduced[0].name);
            const name = value.arguments[0];
            if (
              value.operation.startsWith('state.') &&
              name?.kind === 'literal' &&
              typeof name.value === 'string' &&
              value.type !== 'void'
            )
              store.captureStates.add(name.value);
          }
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
        const lookup = CAPTURE_LOOKUPS.get(value.operation);
        if (lookup)
          return merge(
            receiver.map((item) =>
              item.kind === 'capture'
                ? captureLookup(
                    { kind: 'capture-lookup', owner: item, property: lookup },
                    args[0] ?? UNDEFINED
                  )
                : UNKNOWN
            )
          );
        possibleThrow();
        // A caught failure cannot prove that the declaration/default layer was
        // installed. Record it only on the operation's normal completion path.
        if (
          trace?.completePropOperations &&
          reachable &&
          execution.phase === 'setup' &&
          (value.operation === 'props.define' || value.operation === 'props.setDefaults')
        )
          store.setupPropOperations.add(value);
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
        if (!hook) {
          if (trace?.completePropOperations) setupPropsClosed = false;
          return UNKNOWN;
        }
        if (installingHooks.has(hook.id)) {
          if (trace?.completePropOperations) setupPropsClosed = false;
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
      case 'rule': {
        expression(value.receiver, scope, execution);
        const phaseIssue = validateOperationPhase(
          'rule.declare',
          execution.phase,
          execution.phase === 'callback' ? (execution.context as CallbackContext) : undefined
        )[0];
        if (phaseIssue && !trace) {
          if (execution.guarded) {
            possibleThrow();
            reachable = false;
            return [];
          }
          if (!demand) {
            issue ??= { message: phaseIssue.message, span: value.span };
            return UNKNOWN;
          }
        }
        value.states.forEach((state) => expression(state.value, scope, execution));
        value.styles?.forEach((style) => expression(style.value, scope, execution));
        value.targets?.forEach((style) => expression(style.value, scope, execution));
        return UNKNOWN;
      }
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
              store = forkStore(before);
              flows.push(statements(statement.then, scope, execution));
            }
            if (condition !== true) {
              store = forkStore(before);
              flows.push(statements(statement.otherwise, scope, execution));
            }
            accept(joinFlows(flows));
            break;
          }
          case 'while':
          case 'for-of': {
            const iterable =
              statement.kind === 'for-of'
                ? expression(statement.iterable, scope, execution)
                : undefined;
            const start = snapshot();
            let head = start,
              key = '',
              converged = false;
            const exits: Flow[] = [{ normal: start }];
            for (let iteration = 0; iteration < 64; iteration++) {
              store = forkStore(head);
              reachable = true;
              if (
                statement.kind === 'while' &&
                truth(expression(statement.condition, scope, execution)) === false
              ) {
                converged = true;
                break;
              }
              const loopScope = new Scope(scope);
              if (statement.kind === 'for-of')
                loopScope.declare(statement.name, statement.bindingId).value = merge(
                  (iterable ?? UNKNOWN).map((owner) =>
                    owner.kind === 'record'
                      ? (fields(owner).get('*') ?? merge([...fields(owner).values()]))
                      : hostValue(iterableElementType(statement.iterable.type)!)
                  )
                );
              const flow = statements(statement.body, loopScope, execution);
              exits.push(flow);
              if (!flow.normal) {
                converged = true;
                break;
              }
              head = joinStores([start, head, flow.normal]);
              store = head;
              const next =
                fingerprint([
                  ...head.cells.keys(),
                  ...head.records.keys(),
                  ...head.captures.keys(),
                ]) +
                JSON.stringify(
                  [...head.installations].map(([name, values]) => [
                    name,
                    values.map((value) => (value ? location(value) : null)),
                  ])
                );
              if (next === key) {
                converged = true;
                break;
              }
              key = next;
            }
            if (!converged) opaque(statement.span);
            accept(joinFlows(exits));
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
                store = forkStore(state);
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

  try {
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
    trace?.complete?.(reachable ? store.captureStates : new Set());
    trace?.completePropOperations?.(
      reachable && !issue && setupPropsClosed ? store.setupPropOperations : new Set()
    );
    if (!trace) scheduleRender(returned);
    // Installation uses strong updates. After installation, every host/public
    // callback may run repeatedly in any order; join its post-store with the
    // quiescent store and revisit roots when their captured callable facts change.
    let quiescent = snapshot(),
      progress = true;
    while (progress && !issue && !trace) {
      progress = false;
      store = forkStore(quiescent);
      for (const root of outwardRoots.values())
        escape(root.values, root.execution, root.type, false);
      for (const registration of callbacks) {
        const { closure, execution, outward } = registration;
        store = forkStore(quiescent);
        reachable = true;
        const key = `${identity(closure.fn)}:${execution.phase}:${execution.context}:${execution.guarded ? 'guarded' : 'strict'}:${fingerprint([closure])}:${outward ? 'outward' : 'callback'}`;
        if (analyzedCallbacks.has(key)) continue;
        analyzedCallbacks.add(key);
        progress = true;
        allocationContext = `${identity(closure.fn)}:${fingerprint([closure], true)}`;
        const callbackThrows: Store[] = [];
        exceptionSinks.push(callbackThrows);
        // A host invocation is an analysis root, not a new concrete allocation
        // on every fixed-point visit. Keep its parameter locations stable while
        // stores continue to join all possible writes. Different registrations,
        // parameters and nested fields retain independent host value identities.
        let args = callbackArguments.get(registration);
        if (!args) {
          args = closure.fn.parameters.map((parameter) =>
            parameter.optional || parameter.default
              ? merge([hostValue(parameter.type), UNDEFINED])
              : hostValue(parameter.type)
          );
          callbackArguments.set(registration, args);
        }
        const returned = call(closure, args, execution);
        exceptionSinks.pop();
        allocationContext = undefined;
        if (outward) escape(returned, execution, closure.fn.returnType);
        quiescent = joinStores([quiescent, snapshot(), ...callbackThrows]);
        if (issue) break;
      }
    }

    return issue;
  } catch (error) {
    if (!(error instanceof WorkLimit)) throw error;
    // A demand-only caller must not use the partial traversal as proof that
    // unvisited functions or host support are unreachable.
    demand?.opaque();
    return (
      issue ?? {
        message:
          error.boundary === 'store-work'
            ? `Callable provenance exceeds the deterministic analysis store-work budget (${CALLABLE_STORE_WORK_LIMIT} visits; span identifies analysis context).`
            : `Callable provenance exceeds the finite analysis call-depth boundary (${CALLABLE_ACTIVE_CALL_LIMIT} active states; span identifies analysis context).`,
        span: error.span,
      }
    );
  }
}
