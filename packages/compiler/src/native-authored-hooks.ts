import type { AuthoredHookIR, FunctionIR, GeneratedModule, ValueType, ExpressionIR } from './ir';
import { privilegedStateMembers } from './operations';

/** Owner-local capture and installation. Authored behavior remains emitted native functions. */
export const nativeAuthoredHooksArtifact: NonNullable<GeneratedModule['supportingFiles']>[number] =
  {
    path: '.proto-ui/owner/authored-hooks-v1.ts',
    kind: 'source',
    contents: `export interface NativeHookCapture {
  readonly asHooks?: readonly NativeHookChild[];
  readonly stateHandles?: Readonly<Record<string, unknown>>;
  readonly getState?: (name: string) => unknown;
  readonly getMethod?: (name: string) => unknown;
  readonly getAsHook?: (name: string) => NativeHookChild | undefined;
  readonly getAsHookHandle?: (name: string) => unknown;
  readonly render?: unknown;
}
export interface NativeHookChild {
  readonly name: string; readonly order: number; readonly privileged: boolean;
  readonly mode: 'once' | 'multiple' | 'configurable';
  readonly result: unknown; readonly handle: unknown;
}
export interface NativeHookApi { readonly name: string; readonly order: number; readonly store: Record<string, unknown> }
type Definition = {
  name: string; mode: NativeHookChild['mode'];
  setup(options: unknown, api: NativeHookApi): unknown;
  project?: (capture: NativeHookCapture) => unknown;
  configure?: (api: NativeHookApi, options: unknown, tools: {warn(message: string): void; conflict(message: string): never}) => void;
};
export function createNativeAuthoredHooks(options: { setup(): void; borrow(state: unknown): unknown }) {
  type Frame = { names: Set<string>; states: Map<string, unknown>; methods: Map<string, unknown>; children: NativeHookChild[] };
  type Entry = { order: number; mode: NativeHookChild['mode']; api: NativeHookApi; result?: unknown; handle?: unknown; installing: boolean; privileged: boolean };
  const entries = new Map<string, Entry>(), frames: Frame[] = [], rootNames = new Set<string>();
  const observedNames = new WeakMap<object, string>();
  let order = 0;
  function record(definition: Definition, entry: Entry, result = entry.result, handle = entry.handle): void {
    const parent = frames.at(-1);
    if (parent) parent.children.push(Object.freeze({name: definition.name, order: entry.order, privileged: false, mode: definition.mode, result, handle}));
  }
  return {
    privileged<T>(name: string, acquire: () => T, observedMembers?: readonly (keyof T & string)[]): T {
      options.setup();
      let entry = entries.get(name);
      if (entry && !entry.privileged) throw new Error('[Hook] registration kind conflict: ' + name);
      if (entry?.installing) throw new Error('[Hook] recursive installation: ' + name);
      if (!entry) {
        const api = Object.freeze({name, order: order++, store: Object.create(null) as Record<string, unknown>});
        entry = {order:api.order, mode:'once', api, installing:true, privileged:true};
        entries.set(name, entry);
        const handle = acquire();
        for (const member of observedMembers ?? []) observedNames.set(handle[member] as object, member);
        entry.handle = entry.result = handle;
        entry.installing = false;
      }
      frames.at(-1)?.children.push(Object.freeze({name, order:entry.order, privileged:true, mode:'once', result:entry.result, handle:entry.handle}));
      return entry.handle as T;
    },
    claimState(name: string): void {
      options.setup();
      const names = frames.at(-1)?.names ?? rootNames;
      if (typeof name !== 'string' || !name || names.has(name)) throw new Error('[State] illegal or duplicate state name in setup frame: ' + name);
      names.add(name);
    },
    state(name: string, state: unknown): void { options.setup(); frames.at(-1)?.states.set(name, state); },
    introduceObserved(state: object): void {
      const name = observedNames.get(state);
      if (name !== undefined) frames.at(-1)?.states.set(name, state);
    },
    method(name: string, method: unknown): void { options.setup(); frames.at(-1)?.methods.set(name, method); },
    install(definition: Definition, input?: unknown): unknown {
      options.setup();
      const previous = definition.mode === 'multiple' ? undefined : entries.get(definition.name);
      if (entries.get(definition.name)?.privileged) throw new Error('[Hook] registration kind conflict: ' + definition.name);
      const tools = Object.freeze({warn(message: string) { console.warn('[Hook:' + definition.name + '] ' + message); }, conflict(message: string): never { throw new Error('[Hook:' + definition.name + '] ' + message); }});
      if (previous) {
        if (previous.mode !== 'once' && definition.mode !== 'once') definition.configure?.(previous.api, input, tools);
        // Registration precedes setup. A same-name call during setup, or after
        // failed setup, still skips installation and receives a fresh capture
        // fallback until the winning setup has produced its result.
        const result = previous.result ?? {};
        const handle = Object.hasOwn(previous, 'handle') ? previous.handle : result;
        record(definition, previous, result, handle);
        return handle;
      }
      const api = Object.freeze({name: definition.name, order: order++, store: Object.create(null) as Record<string, unknown>});
      const entry: Entry = {order: api.order, mode: definition.mode, api, installing: true, privileged:false};
      if (definition.mode !== 'multiple') entries.set(definition.name, entry);
      const frame: Frame = {names: new Set(), states: new Map(), methods: new Map(), children: []};
      frames.push(frame);
      let captureOpen = true;
      try {
        const render = definition.setup(input, api);
        frames.pop(); captureOpen = false;
        const states = new Map([...frame.states].map(([name, value]) => [name, observedNames.has(value as object) ? value : options.borrow(value)]));
        const stateHandles = states.size ? Object.freeze(Object.fromEntries(states)) : undefined;
        const children = Object.freeze(frame.children.slice());
        const capture: NativeHookCapture = Object.freeze({
          asHooks: children,
          ...(stateHandles ? {stateHandles, getState: (name: string) => Object.prototype.hasOwnProperty.call(stateHandles, name) ? stateHandles[name] : undefined} : {}),
          ...(frame.methods.size ? {getMethod: (name: string) => frame.methods.get(name)} : {}),
          ...(children.length ? {getAsHook: (name: string) => children.find(child => child.name === name), getAsHookHandle: (name: string) => children.find(child => child.name === name)?.handle} : {}),
          ...(typeof render === 'function' ? {render} : {}),
        });
        entry.result = capture;
        entry.handle = definition.project ? definition.project(capture) : capture;
        entry.installing = false;
        record(definition, entry);
        if (definition.mode === 'configurable') definition.configure?.(api, input, tools);
        return entry.handle;
      } catch (error) { if (captureOpen) frames.pop(); throw error; }
    },
    dispose() { entries.clear(); frames.length = 0; rootNames.clear(); },
  };
}
`,
  };

export function emitPrivilegedHookCall(options: {
  value: Extract<ExpressionIR, { kind: 'operation' }>;
  manager: string;
  callee: string;
  prefix: string;
  emit(value: ExpressionIR): string;
  typeName(type: ValueType): string;
  typed?: boolean;
}): string {
  const { value, manager, callee, emit } = options;
  const name = value.operation.slice(5);
  if (value.operation === 'hook.asTableStructure') {
    const role = `${options.prefix}TableRole`;
    const parameter =
      options.typed === false ? role : `${role}: ${options.typeName(value.arguments[0].type)}`;
    return `((${parameter}) => ${manager}.privileged('asTableStructure:' + ${role}, () => ${callee}(${role})))(${emit(value.arguments[0])})`;
  }
  const observed = privilegedStateMembers(value.operation).map((state) => state.name);
  return `${manager}.privileged(${JSON.stringify(name)}, () => ${callee}(${value.arguments.map(emit).join(', ')})${observed.length ? `, ${JSON.stringify(observed)}` : ''})`;
}

export function emitAuthoredHookDefinition(options: {
  hook: AuthoredHookIR;
  name: string;
  manager: string;
  def: string;
  emit: (fn: FunctionIR) => string;
  typeName: (type: ValueType) => string;
  typed?: boolean;
}): string {
  const { hook, name, manager, def, emit, typeName } = options;
  const typed = options.typed !== false;
  const input = (value: string, type: ValueType) =>
    typed ? `(${value} as ${typeName(type)})` : `/** @type {${typeName(type)}} */ (${value})`;
  const setupArgs = [
    def,
    ...hook.setup.parameters
      .slice(1)
      .map((parameter, index) => input(index === 0 ? 'options' : 'api', parameter.type)),
  ].slice(0, hook.setup.parameters.length);
  const configure = hook.configure;
  const result = hook.projectHandle?.returnType ?? { kind: 'capture' as const, hookId: hook.id };
  const descriptor = `{name: ${JSON.stringify(hook.name)}, mode: ${JSON.stringify(hook.kind === 'hook' ? (hook.mode ?? 'once') : 'once')}, setup: (options, api) => (${emit(hook.setup)})(${setupArgs.join(', ')})${hook.projectHandle ? `, project: ${emit(hook.projectHandle)}` : ''}${configure ? `, configure: (api, options, tools) => (${emit(configure)})(${configure.parameters.map((parameter, index) => input(['api', 'options', 'tools'][index], parameter.type)).join(', ')})` : ''}}`;
  const invocation = `${manager}.install(${descriptor}, options)`;
  return `const ${name} = ${typed ? '(options?: unknown)' : '/** @param {unknown} [options] */ (options)'} => ${input(invocation, result)};`;
}
