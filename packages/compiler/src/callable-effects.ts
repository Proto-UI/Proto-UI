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
  validateOperationPhase,
  privilegedHookCaptures,
  privilegedStateMembers,
  type ArgumentRule,
  type CallbackContext,
} from './operations';
import { isDataValueType, lexicalStoredType } from './ir';
import {
  arrayEveryCallbackParameters,
  callableValue,
  dataBoundaryType,
  objectFields,
  valueAlternatives,
  arrayElementType,
  iterableElementType,
  type CallableType,
} from './value-types';
import { HOOK_API_TYPE, HOOK_TOOLS_TYPE } from './core-value-types';
import { captureFacadeFields } from './capture-types';

type Known = readonly Atom[];
interface ArrayExtent {
  minimum: number;
  maximum: number;
}
const UNKNOWN_EXTENT: ArrayExtent = { minimum: 0, maximum: Infinity };
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
  | { kind: 'record'; fields: Map<string, Known>; tracked?: boolean; array?: ArrayExtent }
  | { kind: 'getter'; callable: Known }
  | { kind: 'capture-lookup'; owner: Capture; property: CaptureLookup }
  | ({ kind: 'capture'; hookId?: string } & CaptureContents);
type CaptureLookup = 'getState' | 'getMethod' | 'getAsHook' | 'getAsHookHandle';
type Closure = Extract<Atom, { kind: 'closure' }>;
type Capture = Extract<Atom, { kind: 'capture' }>;
interface CaptureContents {
  render?: Known;
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
/** A missing own field is distinct from an own field whose value is undefined. */
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
  const absentField = checkOutwardData ? ABSENT : UNDEFINED;
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
  const snapshot = (): Store => copyStore(store);
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

  /** These atoms originate in an actual installation, never in callable type metadata. */
  function captureProperty(owner: Capture, property: string): Known {
    const contents = captureContents(owner);
    if (property === 'render') return contents.render ?? UNDEFINED;
    if (property === 'methods') return captureRecord(owner, property, new Map(contents.methods));
    if (property === 'artifacts')
      return captureRecord(
        owner,
        property,
        new Map([
          ['stateHandles', UNKNOWN],
          ['eventKeys', UNKNOWN],
          ['methods', captureProperty(owner, 'methods')],
          ['asHooks', UNKNOWN],
        ])
      );
    if (['getState', 'getMethod', 'getAsHook', 'getAsHookHandle'].includes(property))
      return [{ kind: 'capture-lookup', owner, property: property as CaptureLookup }];
    return UNKNOWN;
  }

  function captureLookup(value: Extract<Atom, { kind: 'capture-lookup' }>, keys: Known): Known {
    const contents = captureContents(value.owner);
    if (value.property === 'getState') return UNKNOWN;
    const read = (key: string): Known => {
      if (value.property === 'getMethod') return contents.methods.get(key) ?? UNDEFINED;
      return (contents.children.get(key) ?? [undefined]).flatMap((child): Known => {
        if (!child) return UNDEFINED;
        if (value.property === 'getAsHookHandle') return child.handle;
        return [
          {
            kind: 'record',
            fields: new Map<string, Known>([
              ['name', [{ kind: 'literal', value: key }]],
              ['result', child.result ?? [child.capture]],
              ['handle', child.handle],
            ]),
          },
        ];
      });
    };
    return merge(
      keys.map((key) =>
        key.kind === 'literal' && typeof key.value === 'string'
          ? read(key.value)
          : merge([
              UNDEFINED,
              ...[
                ...(value.property === 'getMethod' ? contents.methods : contents.children).keys(),
              ].map(read),
            ])
      )
    );
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
    return merge(
      values.map((value) => {
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
    if (states.length === 1) return copyStore(states[0]);
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
      const names = new Set(maps.flatMap((map) => [...map.keys()]));
      result.records.set(
        record,
        new Map(
          [...names].map((name) => [name, merge(maps.map((map) => map.get(name) ?? absentField))])
        )
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
      const methods = new Set(contents.flatMap((value) => [...value.methods.keys()]));
      const children = new Set(contents.flatMap((value) => [...value.children.keys()]));
      result.captures.set(capture, {
        render: merge(contents.map((value) => value.render ?? UNDEFINED)),
        methods: new Map(
          [...methods].map((name) => [
            name,
            merge(contents.map((value) => value.methods.get(name) ?? UNDEFINED)),
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
    next.set(name, weak ? merge([next.get(name) ?? absentField, value]) : value);
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
            'record',
            value.tracked === false ? null : location(value),
            value.array ? extent(value) : null,
            [...fields(value)]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, field]) => [name, field.map((child) => visit(child, depth + 1))]),
          ];
        case 'getter':
          return ['get', value.callable.map((child) => visit(child, depth + 1))];
        case 'capture-lookup':
          return ['capture-lookup', value.property, visit(value.owner, depth + 1)];
        case 'capture':
          return [
            'capture',
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
      (['record', 'object', 'array', 'value-array'].includes(type.kind) ||
        ((type.kind === 'union' || type.kind === 'value-union') && type.members.some(aggregate)));
    return (
      carriesCallable(type) ||
      (!!trace && !isDataValueType(type)) ||
      (checkOutwardData && aggregate(type))
    );
  }

  /** Publication examines retained values, including fields hidden by a narrower
   * checked view. It never calls getters or treats a type assertion as a copy. */
  function outwardData(values: Known, top = true, ancestors = new Set<Atom>()): boolean {
    return values.every((value) => {
      if (value.kind === 'absent') return !top;
      if (value.kind === 'undefined') return top;
      if (value.kind === 'literal') return true;
      if (value.kind === 'unknown')
        return value.data !== undefined && dataBoundaryType(value.data, top) !== undefined;
      if (value.kind !== 'record' || ancestors.has(value) || ancestors.size > 256) return false;
      ancestors.add(value);
      const valid = [...fields(value).values()].every((field) =>
        outwardData(field, false, ancestors)
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
      if (!carriesCallable(type.element) && !(checkOutwardData && type.kind === 'value-array'))
        return UNKNOWN;
      return [{ kind: 'record', fields: new Map([['*', hostValue(type.element)]]), tracked: true }];
    }
    if (type.kind === 'object' || type.kind === 'record') {
      if (isDataValueType(type)) return dataFact(type);
      // A non-JSON host aggregate must keep its original structure. A bare
      // UNKNOWN could otherwise acquire a narrower data fact at a later view.
      const finite = type.index === undefined;
      if (!carriesCallable(type) && !(checkOutwardData && finite)) return UNKNOWN;
      const record: RecordValue = {
        kind: 'record',
        fields: new Map(),
        tracked: carriesCallable(type) || checkOutwardData,
      };
      const value: Known = [record];
      for (const field of type.fields)
        record.fields.set(
          field.name,
          'accessor' in field && field.accessor
            ? [
                {
                  kind: 'getter',
                  callable: hostValue({ kind: 'callable', parameters: [], returnType: field.type }),
                },
              ]
            : field.optional
              ? merge([hostValue(field.type), UNDEFINED])
              : hostValue(field.type)
        );
      return value;
    }
    return UNKNOWN;
  }

  function call(closure: Closure, args: readonly Known[], execution: Execution): Known {
    if (issue) return UNKNOWN;
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
          if (value.kind === 'capture-lookup') return captureLookup(value, args[0] ?? UNDEFINED);
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
          const field =
            fields(value).get(name) ??
            (/^(0|[1-9]\d*)$/.test(name) ? fields(value).get('*') : undefined) ??
            UNDEFINED;
          return branches(
            field.map(
              (part) => () =>
                part.kind === 'getter'
                  ? calls(part.callable, [], execution, span)
                  : part.kind === 'absent'
                    ? UNDEFINED
                    : [part]
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
        }
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
        if (value.kind === 'record')
          for (const name of ownKeys(value)) {
            const field = fields(value).get(name)!;
            // On an absent-field branch, spread leaves the preceding property
            // intact. An own undefined value still overwrites it and is rejected.
            const read = branches(
              field.map(
                (part) => () =>
                  part.kind === 'absent'
                    ? (previous.get(name) ?? absentField)
                    : part.kind === 'getter'
                      ? calls(part.callable, [], execution, span)
                      : [part]
              )
            );
            copy.set(name, read);
            if (!reachable) return [];
          }
        else if (value.kind === 'capture')
          for (const field of captureFacadeFields(undefined, new Map()))
            copy.set(field.name, captureProperty(value, field.name));
        else if (type || (value.kind === 'unknown' && value.data))
          for (const field of objectFields(
            value.kind === 'unknown' && value.data ? value.data : type!
          ) ?? []) {
            if (field.accessor) {
              opaque(span);
              copy.set(field.name, UNKNOWN);
            } else {
              const next = hostValue(field.type);
              copy.set(
                field.name,
                field.optional
                  ? merge([
                      previous.get(field.name) ?? absentField,
                      next,
                      ...(checkOutwardData ? [] : [UNDEFINED]),
                    ])
                  : next
              );
            }
          }
        copies.push(copy);
        return UNDEFINED;
      })
    );
    const names = new Set(copies.flatMap((copy) => [...copy.keys()]));
    return new Map(
      [...names].map((name) => [name, merge(copies.map((copy) => copy.get(name) ?? absentField))])
    );
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
                            : branches(
                                present.flatMap((item) =>
                                  item.kind === 'record'
                                    ? ownKeys(item).map(
                                        (name) => () =>
                                          property([item], name, execution, value.span)
                                      )
                                    : [() => UNKNOWN]
                                )
                              )
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
              if (target.kind === 'record')
                for (const [name, field] of copied) writeField(target, name, field);
          }
          return checkOutwardData
            ? args[0]
            : isDataValueType(value.type)
              ? dataFact(value.type)
              : args[0];
        }
        return value.name === 'object.freeze'
          ? args[0]
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
            tracked: tracksIdentity(lexicalStoredType(value.type)!),
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
        const phaseIssue = validateOperationPhase(
          value.operation,
          execution.phase,
          execution.phase === 'callback' ? (execution.context as CallbackContext) : undefined
        ).find((item) => item.code !== 'context' || execution.context !== 'helper');
        const receiver = value.receiver ? expression(value.receiver, scope, execution) : UNKNOWN;
        const args = value.arguments.map((argument) => expression(argument, scope, execution));
        if (
          checkOutwardData &&
          !issue &&
          reachable &&
          value.operation === 'expose.emit' &&
          !outwardData(args[1] ?? UNDEFINED)
        ) {
          issue = {
            code: 'PUI1006',
            message:
              'Outward JSON payload retains a value outside the declared data boundary. Copy only plain, defined data fields before publication.',
            span: value.span,
          };
          return UNKNOWN;
        }
        if (phaseIssue && !trace) {
          if (execution.guarded) {
            possibleThrow();
            reachable = false;
            return [];
          }
          if (!demand) {
            issue = { message: phaseIssue.message, span: value.span };
            return UNKNOWN;
          }
        }
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
            capture: { kind: 'capture', methods: new Map(), children: new Map() },
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
        if (name?.kind === 'literal') {
          const key = String(name.value);
          if (value.operation === 'capture.getMethod')
            return receiver.flatMap((item) =>
              item.kind === 'capture'
                ? (captureContents(item).methods.get(key) ?? UNDEFINED)
                : UNKNOWN
            );
          if (value.operation === 'capture.getAsHook')
            return receiver.flatMap((item) =>
              item.kind === 'capture'
                ? (captureContents(item).children.get(key) ?? [undefined]).flatMap((child) =>
                    child
                      ? [
                          {
                            kind: 'record' as const,
                            fields: new Map<string, Known>([
                              ['name', [{ kind: 'literal', value: key }]],
                              ['result', child.result ?? [child.capture]],
                              ['handle', child.handle],
                            ]),
                          },
                        ]
                      : UNDEFINED
                  )
                : UNKNOWN
            );
          if (value.operation === 'capture.getAsHookHandle')
            return receiver.flatMap((item) =>
              item.kind === 'capture'
                ? (captureContents(item).children.get(key) ?? [undefined]).flatMap(
                    (child) => child?.handle ?? UNDEFINED
                  )
                : UNKNOWN
            );
        }
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
              store = copyStore(head);
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
    store = copyStore(quiescent);
    for (const root of outwardRoots.values()) escape(root.values, root.execution, root.type, false);
    for (const registration of callbacks) {
      const { closure, execution, outward } = registration;
      store = copyStore(quiescent);
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
}
