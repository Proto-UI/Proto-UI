import { formatDataType } from './data-types';
import type { DataType } from './data-types';
import { validateIR, validIdentifier } from './ir-validation';
import { OPERATION_RULES } from './operations';
import { checkTargetOperations, resolveTargetProfile } from './targets';
import { isDataValueType } from './ir';
import type {
  CompileResult,
  ExpressionIR,
  FunctionIR,
  GeneratedModule,
  ParameterIR,
  PrototypeIR,
  StatementIR,
  ValueType,
} from './ir';

/** Native DOM lowering. The generated program executes checked functions, never an IR interpreter. */
export function emitReactSource(
  input: PrototypeIR,
  options: { componentName?: string } = {}
): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = validated.value;
  const selected = resolveTargetProfile('react-dom-source-v1');
  if (!selected.ok) return selected;
  const admitted = checkTargetOperations(ir, selected.value);
  if (!admitted.ok) return admitted;
  const unsupportedMethods = ir.exposes.filter((value) => value.kind === 'method' &&
    [value.returnType, ...value.parameters.map((parameter) => parameter.type)].some((type) => !isDataValueType(type)));
  if (unsupportedMethods.length) return {
    ok: false,
    diagnostics: unsupportedMethods.map((value) => ({ code: 'PUI4003', category: 'unsupported-input',
      message: 'react-dom-source-v1 exposed methods require checked serializable parameter and return types, not semantic capabilities or unknown.', span: value.span })),
  };
  const reachedFunctions = new Set(admitted.value.functions);
  const unsupportedTemplates: ExpressionIR[] = [];
  function inspectTemplate(value: unknown): void {
    if (Array.isArray(value)) for (const item of value) inspectTemplate(item);
    else if (value !== null && typeof value === 'object') {
      const node = value as ExpressionIR;
      if (node.kind === 'function' && !reachedFunctions.has(node.function)) return;
      if (node.kind === 'operation' && node.operation === 'render.el') {
        const props = node.arguments[1];
        if (props?.kind === 'record' && props.entries.length) unsupportedTemplates.push(node);
      }
      for (const item of Object.values(value)) inspectTemplate(item);
    }
  }
  for (const reached of admitted.value.functions) {
    for (const statement of reached.body) {
      inspectTemplate(statement);
      if (statement.kind === 'return') break;
    }
  }
  if (unsupportedTemplates.length) return {
    ok: false,
    diagnostics: unsupportedTemplates.map((node) => ({ code: 'PUI4003', category: 'unsupported-input',
      message: 'react-dom-source-v1 does not implement TemplateStyleHandle or non-empty template props.', span: node.span })),
  };
  const componentName = options.componentName ?? 'CompiledComponent';
  const reservedNames: Record<string, true> = {
    GeneratedProps: true, GeneratedExposes: true, GeneratedHandle: true, GeneratedComponentProps: true,
    Object: true, Array: true, Number: true, Set: true, WeakMap: true, Reflect: true,
    JSON: true, Error: true, TypeError: true, Infinity: true, queueMicrotask: true,
  };
  if (
    !validIdentifier(componentName) ||
    Object.hasOwn(reservedNames, componentName)
  ) {
    return {
      ok: false,
      diagnostics: [{ code: 'PUI3001', category: 'invalid-input',
        message: 'Choose a valid, non-reserved generated component identifier.', span: ir.setup.span }],
    };
  }
  const names = new Set<string>([componentName]);
  function collect(value: unknown): void {
    if (Array.isArray(value)) for (const item of value) collect(item);
    else if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'name' && typeof item === 'string') names.add(item);
        collect(item);
      }
    }
  }
  collect(ir);
  let p = '__pui';
  while ([...names].some((name) => name.startsWith(p))) p += '_';
  const hooks = new Map(ir.hooks.map((hook, index) => [hook.id, `${p}Hook${index}`]));

  function typeName(type: ValueType): string {
    if (typeof type !== 'string') return formatDataType(type as DataType);
    if (type === 'def') return `typeof ${p}Def`;
    if (type === 'run') return `${p}Run`;
    if (type === 'render') return `typeof ${p}Renderer`;
    if (type === 'props') return `${p}ResolvedProps`;
    if (type.startsWith('state:')) return `${p}State<${type.slice(6)}>`;
    if (['boolean', 'number', 'string', 'null', 'void', 'unknown'].includes(type)) return type;
    if (type === 'array') return 'readonly unknown[]';
    if (type === 'record' || type === 'focus-options') return 'Readonly<Record<string, unknown>>';
    if (type === 'template') return `${p}React.ReactNode`;
    return 'unknown';
  }
  function parameters(values: readonly ParameterIR[]): string {
    return values.map((value) => `${value.name}${value.optional ? '?' : ''}: ${typeName(value.type)}`).join(', ');
  }
  function fn(value: FunctionIR, depth: number): string {
    return `(${parameters(value.parameters)}) => {\n${statements(value.body, depth + 1)}${'  '.repeat(depth)}}`;
  }
  function expression(value: ExpressionIR, depth: number): string {
    switch (value.kind) {
      case 'literal': return JSON.stringify(value.value);
      case 'reference': return value.name;
      case 'context-key': throw new Error('Context key reached native emission after capability admission.');
      case 'member': return `(${expression(value.object, depth)})${value.optional ? '?.' : ''}[${JSON.stringify(value.property)}]`;
      case 'unary': return `(${value.operator}${expression(value.operand, depth)})`;
      case 'binary': return `(${expression(value.left, depth)} ${value.operator} ${expression(value.right, depth)})`;
      case 'array': return `[${value.elements.map((item) => expression(item, depth)).join(', ')}]`;
      case 'record': return `{ ${value.entries.map((item) => `${item.key === '__proto__' ? `[${JSON.stringify(item.key)}]` : JSON.stringify(item.key)}: ${expression(item.value, depth)}`).join(', ')} }`;
      case 'function': return fn(value.function, depth);
      case 'helper-call': return `${value.name}(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
      case 'authored-hook': return `${hooks.get(value.hookId)}()`;
      case 'operation': {
        const rule = OPERATION_RULES[value.operation];
        return `${expression(value.receiver!, depth)}.${rule.path}(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
      }
    }
  }
  function statements(body: readonly StatementIR[], depth: number): string {
    const indent = '  '.repeat(depth);
    const terminator = body.findIndex((value) => value.kind === 'return');
    return body.slice(0, terminator < 0 ? body.length : terminator + 1).map((value) => {
      if (value.kind === 'const' && value.value.kind === 'function' && !reachedFunctions.has(value.value.function)) return '';
      const sourceFile = JSON.stringify(value.span.file).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
      const origin = `${indent}// Source ${sourceFile}:${value.span.line}:${value.span.column}\n`;
      switch (value.kind) {
        case 'const': return `${origin}${indent}const ${value.name} = ${expression(value.value, depth)};\n`;
        case 'effect': return `${origin}${indent}${expression(value.expression, depth)};\n`;
        case 'return': return `${origin}${indent}return${value.value ? ` ${expression(value.value, depth)}` : ''};\n`;
        case 'if': return `${origin}${indent}if (${expression(value.condition, depth)}) {\n${statements(value.then, depth + 1)}${indent}}${value.otherwise.length ? ` else {\n${statements(value.otherwise, depth + 1)}${indent}}` : ''}\n`;
      }
    }).join('');
  }
  const props = ir.props.map((value) => `  ${JSON.stringify(value.name)}?: ${formatDataType(value.type as DataType)} | null;`).join('\n');
  const exposed = ir.exposes.map((value) => {
    const type = value.kind === 'state' ? `${p}ExternalState<${formatDataType(value.type as DataType)}>`
      : value.kind === 'event' ? `{ readonly kind: 'event'; readonly payload: ${JSON.stringify(value.payload)} }`
      : `(${parameters(value.parameters)}) => ${typeName(value.returnType)}`;
    return `  ${JSON.stringify(value.name)}: ${type};`;
  }).join('\n');
  const eventProps = ir.exposes.filter((value) => value.kind === 'event').map((value) =>
    `  ${JSON.stringify(`on${value.name.charAt(0).toUpperCase()}${value.name.slice(1)}`)}?: (${value.payload === 'void' ? '' : `payload: ${formatDataType(value.payload as DataType)}`}) => void;`
  ).join('\n');
  const methodSchemas = ir.exposes.filter((value) => value.kind === 'method').map((value) =>
    `    ${JSON.stringify(value.name)}: { parameters: ${JSON.stringify(value.parameters.map((parameter) => ({ type: parameter.type, ...(parameter.optional ? { optional: true } : {}) })))}, result: ${JSON.stringify(value.returnType)} },`
  ).join('\n');
  const eventSchemas = ir.exposes.filter((value) => value.kind === 'event').map((value) =>
    `    ${JSON.stringify(value.name)}: ${JSON.stringify(value.payload)},`
  ).join('\n');
  const propSchemas = ir.props.map((value) => `    ${JSON.stringify(value.name)}: ${JSON.stringify(value.type)},`).join('\n');
  const hookDefinitions = ir.hooks.filter((hook) => admitted.value.authoredHooks.includes(hook.id)).map((hook) => `  const ${hooks.get(hook.id)} = () => {
    if (${p}HookNames.has(${JSON.stringify(hook.name)})) return;
    ${p}HookNames.add(${JSON.stringify(hook.name)});
    (${fn(hook.setup, 2)})(${p}Def);
  };`).join('\n');

  const code = `// Editable generated React DOM source. Profile: react-dom-source-v1.
// Inline native lowering helpers v1; no Proto-UI Runtime/Core/Adapter dependencies.
// Source graph SHA-256: ${ir.source.sha256}
import * as ${p}React from 'react';

export type GeneratedProps = {
${props}
};
export type GeneratedExposes = {
${exposed}
};
export type GeneratedComponentProps = GeneratedProps & {
  children?: ${p}React.ReactNode;
${eventProps}
  [event: \`on\${string}\`]: unknown;
};
export interface GeneratedHandle {
  update(): void;
  getExposes(): GeneratedExposes;
  invokeInCallbackScope<T>(callback: () => T): T;
}
type ${p}ResolvedProps = Readonly<{ [K in keyof GeneratedProps]-?: Exclude<GeneratedProps[K], undefined> }>;
type ${p}StateEvent<T> = { type: 'next'; prev: T; next: T; reason?: unknown } | { type: 'disconnect'; reason: 'unmount' };
type ${p}ExternalState<T> = {
  get(): T;
  subscribe(callback: (event: ${p}StateEvent<T>) => void): () => void;
  unsubscribe(off: () => void): void;
  readonly spec: Readonly<${p}StateSpec>;
};
type ${p}State<T> = { get(): T; set(value: T, reason?: unknown): void };
type ${p}StateSpec = { kind: string; options?: readonly (string | number)[]; min?: number; max?: number; step?: number; clamp?: boolean };
type ${p}DataSchema = string | { kind: string; fields?: readonly { name: string; type: ${p}DataSchema; optional?: boolean }[]; element?: ${p}DataSchema; members?: readonly ${p}DataSchema[]; value?: unknown };
type ${p}PropSpec = { type: ${p}DataSchema; default?: unknown; empty?: 'accept' | 'fallback' | 'error'; options?: readonly string[]; range?: { min?: number; max?: number } };
type ${p}Run = {
  update(): void;
  props: { get(): ${p}ResolvedProps };
  expose: { emit(key: string, payload?: unknown, options?: Record<string, unknown>): void };
  lifecycle: { setPresent(present: boolean): void };
};
type ${p}Frame = { revision: number; epoch: number; kind: 'mount' | 'update' | 'detach'; node: ${p}React.ReactNode };
type ${p}Owner = {
  handle: GeneratedHandle;
  connect(): void;
  start(): void;
  applyProps(props: GeneratedComponentProps): void;
  accept(frame: ${p}Frame): void;
  disconnect(): void;
};

function ${p}IsData(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  ancestors.add(value);
  try {
    if (array && Object.keys(value).length !== (value as unknown[]).length) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || array && !/^(0|[1-9][0-9]*)$/.test(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !('value' in descriptor) || !${p}IsData(descriptor.value, ancestors)) return false;
    }
    return true;
  } finally { ancestors.delete(value); }
}
function ${p}Accepts(type: ${p}DataSchema, value: unknown, checked = false): boolean {
  if (type === 'void') return value === undefined;
  if (!checked && value !== undefined && !${p}IsData(value)) return false;
  if (typeof type === 'string') {
    if (type === 'null') return value === null;
    return typeof value === type && (type !== 'number' || Number.isFinite(value));
  }
  switch (type.kind) {
    case 'literal': return Object.is(value, type.value);
    case 'union': return !!type.members?.some((member) => ${p}Accepts(member, value, true));
    case 'array': return Array.isArray(value) && !!type.element && Object.keys(value).length === value.length
      && value.every((item) => ${p}Accepts(type.element!, item, true));
    case 'record': return value !== null && typeof value === 'object' && !Array.isArray(value)
      && !!type.fields?.every((field) => !Object.hasOwn(value, field.name) ? !!field.optional
        : ${p}Accepts(field.type, (value as Record<string, unknown>)[field.name], true));
    default: return false;
  }
}

function ${p}ResolveProps(
  specs: Readonly<Record<string, ${p}PropSpec>>,
  defaults: readonly Readonly<Record<string, unknown>>[],
  previousValid: Record<string, unknown>,
  raw: Readonly<Record<string, unknown>>,
  strict: boolean
): ${p}ResolvedProps {
  const next: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(specs)) {
    const spec = specs[key];
    const provided = Object.hasOwn(raw, key);
    const value = raw[key];
    const empty = value === null || value === undefined;
    const valid = (candidate: unknown) => ${p}Accepts(spec.type, candidate)
      && (!spec.range || typeof candidate === 'number'
        && candidate >= (spec.range.min ?? -Infinity) && candidate <= (spec.range.max ?? Infinity));
    if (provided && !empty && valid(value)) {
      next[key] = value;
      previousValid[key] = value;
      continue;
    }
    if (provided && empty && spec.empty === 'accept') { next[key] = null; continue; }
    const nonEmpty = strict && spec.empty === 'error';
    let found = false;
    const take = (candidate: unknown) => {
      if (candidate === undefined || nonEmpty && candidate === null) return false;
      if (candidate !== null && !valid(candidate)) return false;
      next[key] = candidate;
      found = true;
      return true;
    };
    if (provided && Object.hasOwn(previousValid, key)) take(previousValid[key]);
    if (!found) for (const layer of defaults) if (Object.hasOwn(layer, key) && take(layer[key])) break;
    if (!found && Object.hasOwn(spec, 'default')) take(spec.default);
    if (!found) {
      if (nonEmpty) throw new Error('[Props] missing, empty or invalid prop without non-empty fallback: ' + key);
      next[key] = null;
    }
    if (provided && next[key] !== null) previousValid[key] = next[key];
  }
  return Object.freeze(next) as ${p}ResolvedProps;
}

function ${p}CreateOwner(initial: GeneratedComponentProps, publish: (frame: ${p}Frame) => void): ${p}Owner {
  let phase: 'setup' | 'callback' | 'render' | 'idle' = 'setup';
  let lifetime: 'alive' | 'disposing' | 'disposed' = 'alive';
  let connected = true;
  let cleanupVersion = 0;
  let desiredPresent = true;
  let mounted = false;
  let epoch = 0;
  let revision = 0;
  let acceptedRevision = 0;
  let latest: ${p}Frame | null = null;
  let dirty = false;
  let updateQueued = false;
  let scheduled = false;
  let callbackDepth = 0;
  let slotUsed = false;
  let elementSequence = 0;
  let hostProps = initial;
  let raw: Readonly<Record<string, unknown>> = Object.freeze({});
  let resolved: ${p}ResolvedProps;
  let hydrated = false;
  const specs: Record<string, ${p}PropSpec> = Object.create(null);
  const defaults: Readonly<Record<string, unknown>>[] = [];
  const previousValid: Record<string, unknown> = Object.create(null);
  const stateNames = new Set<string>();
  const ${p}HookNames = new Set<string>();
  const stateSubscribers = new Set<Set<(event: ${p}StateEvent<unknown>) => void>>();
  const pendingStateEvents: (() => void)[] = [];
  let emittingState = false;
  const watchers: { active: boolean; keys: readonly string[]; callback: (run: ${p}Run, next: ${p}ResolvedProps, prev: ${p}ResolvedProps, info: Readonly<Record<string, unknown>>) => void }[] = [];
  const exposes: Record<string, unknown> = Object.create(null);
  const methodSchemas: Record<string, { parameters: readonly { type: ${p}DataSchema; optional?: boolean }[]; result: ${p}DataSchema }> = {
${methodSchemas}
  };
  const eventSchemas: Record<string, ${p}DataSchema> = {
${eventSchemas}
  };
  const propSchemas: Record<string, ${p}DataSchema> = {
${propSchemas}
  };
  const callbacks = {
    created: [] as ((run: ${p}Run) => void)[], mounted: [] as ((run: ${p}Run) => void)[],
    updated: [] as ((run: ${p}Run) => void)[], unmounted: [] as ((run: ${p}Run) => void)[],
    beforeDispose: [] as ((run: ${p}Run) => void)[],
  };
  function ensureAlive() {
    if (lifetime === 'disposed' || !connected && phase !== 'callback')
      throw new Error('Generated handle is invalid after terminal disposal.');
  }
  function ensurePhase(expected: typeof phase) {
    ensureAlive();
    if (phase !== expected) throw new Error('Illegal generated operation phase: ' + phase + '; expected ' + expected);
  }
  function ensureExternal() {
    if (!connected || lifetime !== 'alive') throw new Error('Generated handle is invalid after terminal disposal begins.');
  }
  function invoke<T>(callback: () => T): T {
    ensureAlive();
    if (phase === 'render' || phase === 'setup') throw new Error('Cannot enter callback scope from ' + phase);
    const previous = phase;
    phase = 'callback';
    ++callbackDepth;
    try { return callback(); }
    finally { phase = previous; --callbackDepth; if (!callbackDepth) schedule(); }
  }
  function dispatch(list: readonly ((run: ${p}Run) => void)[]) {
    invoke(() => { for (const callback of list) callback(${p}RunHandle); });
  }
  function schedule() {
    if (scheduled || callbackDepth || !connected || lifetime !== 'alive') return;
    if (!updateQueued && desiredPresent === mounted && !(latest && latest.revision > acceptedRevision)) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!connected || lifetime !== 'alive') return;
      if (latest && latest.revision > acceptedRevision) return;
      if (!desiredPresent) {
        if (mounted) deliver('detach');
        else { dirty = dirty || updateQueued; updateQueued = false; }
      } else if (!mounted) deliver('mount');
      else if (updateQueued) deliver('update');
    });
  }
  function deliver(kind: ${p}Frame['kind']) {
    updateQueued = false;
    let node: ${p}React.ReactNode = null;
    if (kind === 'mount') ++epoch;
    if (kind !== 'detach') {
      slotUsed = false;
      elementSequence = 0;
      phase = 'render';
      try { node = normalize(render(${p}Renderer)); }
      finally { phase = 'idle'; }
      dirty = false;
    }
    latest = { revision: ++revision, epoch, kind, node };
    publish(latest);
  }
  function normalize(value: unknown): ${p}React.ReactNode {
    if (value === null) return null;
    if (Array.isArray(value)) return value.flatMap((item) => {
      const child = normalize(item);
      return child === null ? [] : [child];
    });
    if (typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) || ${p}React.isValidElement(value)) return value;
    throw new Error('[Template] child must be null, text, a finite number or an authored element/slot.');
  }
  function ${p}Element(tag: string, ...args: unknown[]) {
    ensurePhase('render');
    if (!tag || typeof tag !== 'string') throw new Error('[Template] native elements require a tag string.');
    let children: unknown = null;
    if (args.length === 1) {
      const argument = args[0];
      if (argument !== null && typeof argument === 'object' && !Array.isArray(argument) && !${p}React.isValidElement(argument)) {
        if (Object.keys(argument).length) throw new Error('[Template] style capabilities are not supported by this native profile.');
      } else children = argument;
    } else if (args.length === 2) {
      if (!args[0] || typeof args[0] !== 'object' || Object.keys(args[0]).length)
        throw new Error('[Template] native template props must be empty; style is unsupported.');
      children = args[1];
    }
    const normalized = normalize(children);
    return ${p}React.createElement(tag, { key: elementSequence++ }, ...(Array.isArray(normalized) ? normalized : [normalized]));
  }
  const ${p}Renderer = {
    el: ${p}Element,
    slot: () => {
      ensurePhase('render');
      if (slotUsed) throw new Error('[Template] multiple anonymous slots are not supported.');
      slotUsed = true;
      return ${p}React.createElement(${p}React.Fragment, { key: elementSequence++ }, hostProps.children);
    },
  };
  function ${p}CreateState<T extends boolean | string | number>(name: string, initialValue: T, spec: ${p}StateSpec): ${p}State<T> {
    ensurePhase('setup');
    if (!name || stateNames.has(name)) throw new Error('[State] empty or duplicate state name: ' + name);
    stateNames.add(name);
    let value = initialValue;
    const subscribers = new Set<(event: ${p}StateEvent<T>) => void>();
    stateSubscribers.add(subscribers as Set<(event: ${p}StateEvent<unknown>) => void>);
    const state = {
      get() { ensureAlive(); return value; },
      set(next: T, reason?: unknown) {
        ensurePhase('callback');
        if (Object.is(value, next)) return;
        const event: ${p}StateEvent<T> = { type: 'next', prev: value, next, reason };
        value = next;
        pendingStateEvents.push(() => { for (const callback of [...subscribers]) callback(event); });
        if (emittingState) return;
        emittingState = true;
        try { while (pendingStateEvents.length) pendingStateEvents.shift()!(); }
        finally { emittingState = false; }
      },
    };
    const external: ${p}ExternalState<T> = Object.freeze({
      get() { ensureExternal(); return state.get(); },
      subscribe(callback: (event: ${p}StateEvent<T>) => void) {
        ensureExternal(); subscribers.add(callback); return () => { subscribers.delete(callback); };
      },
      unsubscribe(off: () => void) { off(); },
      spec: Object.freeze(spec),
    });
    externalStates.set(state, external);
    return state;
  }
  const externalStates = new WeakMap<object, unknown>();
  const ${p}RunHandle: ${p}Run = {
    update() {
      ensurePhase('callback');
      if (lifetime !== 'alive') return;
      dirty = true;
      if (desiredPresent && mounted) updateQueued = true;
      schedule();
    },
    props: { get() { ensureAlive(); return resolved; } },
    expose: { emit(key, payload, options) {
      ensurePhase('callback');
      const declaration = exposes[key] as { kind?: string; payload: ${p}DataSchema } | undefined;
      if (declaration?.kind !== 'event') throw new Error('[Expose] event was not declared: ' + key);
      if (!${p}Accepts(declaration.payload, payload)) throw new TypeError('[Expose] invalid event payload: ' + key);
      const sink = (hostProps as Record<string, unknown>)['on' + key.charAt(0).toUpperCase() + key.slice(1)];
      if (typeof sink === 'function') { try { sink(payload, options); } catch { /* Host sink failures do not re-enter prototype execution. */ } }
    } },
    lifecycle: { setPresent(present) {
      ensurePhase('callback');
      if (lifetime !== 'alive') throw new Error('[Lifecycle] cannot update view presence after terminal disposal begins.');
      if (typeof present !== 'boolean') throw new Error('[Lifecycle] view presence must be boolean.');
      if (desiredPresent === present) return;
      desiredPresent = present;
      schedule();
    } },
  };
  function registerExpose(key: string, value: unknown) {
    ensurePhase('setup');
    if (!key || Object.hasOwn(exposes, key)) throw new Error('[Expose] empty or duplicate declaration: ' + key);
    exposes[key] = value;
  }
  const ${p}Def = {
    props: {
      define(incoming: Record<string, ${p}PropSpec>) {
        ensurePhase('setup');
        const next = { ...specs };
        for (const [key, authored] of Object.entries(incoming)) {
          const spec = { ...authored, type: propSchemas[key] ?? authored.type };
          const previous = specs[key];
          if (!previous) { next[key] = { ...spec }; continue; }
          const rank = (empty: ${p}PropSpec['empty']) => empty === 'accept' ? 0 : empty === 'error' ? 2 : 1;
          if (JSON.stringify(previous.type) !== JSON.stringify(spec.type) || Object.hasOwn(spec, 'empty') && rank(spec.empty) > rank(previous.empty)
            || previous.range && spec.range && ((spec.range.min ?? -Infinity) > (previous.range.min ?? -Infinity)
              || (spec.range.max ?? Infinity) < (previous.range.max ?? Infinity)))
            throw new Error('[Props] conflicting or stricter prop definition: ' + key);
          next[key] = { ...previous, ...spec, empty: previous.empty ?? 'fallback', range: spec.range ?? previous.range };
          if (Object.hasOwn(previous, 'default')) next[key].default = previous.default;
        }
        Object.assign(specs, next);
        resolved = ${p}ResolveProps(specs, defaults, previousValid, raw, false);
      },
      setDefaults(partial: Record<string, unknown>) {
        ensurePhase('setup');
        for (const key of Object.keys(partial)) if (!Object.hasOwn(specs, key)) throw new Error('[Props] undeclared default key: ' + key);
        defaults.unshift({ ...partial });
        resolved = ${p}ResolveProps(specs, defaults, previousValid, raw, false);
      },
      watch(keys: readonly string[], callback: (run: ${p}Run, next: ${p}ResolvedProps, prev: ${p}ResolvedProps, info: Readonly<Record<string, unknown>>) => void) {
        ensurePhase('setup');
        if (!keys.length || keys.some((key) => !Object.hasOwn(specs, key))) throw new Error('[Props] watchers require declared keys.');
        const watcher = { keys: [...keys], callback, active: true };
        watchers.push(watcher);
        return () => { watcher.active = false; };
      },
    },
    state: {
      bool: (name: string, value: boolean) => ${p}CreateState(name, value, { kind: 'bool' }),
      string: (name: string, value: string, spec: Omit<${p}StateSpec, 'kind'> = {}) => ${p}CreateState(name, value, { kind: 'string', ...spec }),
      numberDiscrete: (name: string, value: number, spec: Omit<${p}StateSpec, 'kind'> = {}) => ${p}CreateState(name, value, { kind: 'number.discrete', ...spec }),
      numberRange: (name: string, value: number, spec: Omit<${p}StateSpec, 'kind'>) => ${p}CreateState(name, value, { kind: 'number.range', ...spec }),
    },
    expose: {
      state(key: string, state: object) {
        const external = externalStates.get(state);
        if (!external) throw new Error('[Expose] state must belong to this instance.');
        registerExpose(key, external);
      },
      event(key: string, _spec: { payload?: 'void' | 'any' | 'json'; options?: Readonly<Record<string, unknown>> } = {}) {
        if (!Object.hasOwn(eventSchemas, key)) throw new Error('[Expose] missing checked event schema: ' + key);
        registerExpose(key, Object.freeze({ kind: 'event', payload: eventSchemas[key] }));
      },
      method<A extends unknown[], R>(key: string, callback: (...args: A) => R) {
        registerExpose(key, (...args: A): R => {
          ensureExternal();
          return invoke(() => {
          const schema = methodSchemas[key];
          if (!schema || args.length > schema.parameters.length || schema.parameters.some((parameter, index) =>
            !(parameter.optional && args[index] === undefined) && !${p}Accepts(parameter.type, args[index])))
            throw new TypeError('[Expose] invalid method arguments: ' + key);
          const result = callback(...args);
          if (!${p}Accepts(schema.result, result)) throw new TypeError('[Expose] invalid method result: ' + key);
          return result;
          });
        });
      },
    },
    lifecycle: {
      onCreated(callback: (run: ${p}Run) => void) { ensurePhase('setup'); callbacks.created.push(callback); },
      onMounted(callback: (run: ${p}Run) => void) { ensurePhase('setup'); callbacks.mounted.push(callback); },
      onUpdated(callback: (run: ${p}Run) => void) { ensurePhase('setup'); callbacks.updated.push(callback); },
      onUnmounted(callback: (run: ${p}Run) => void) { ensurePhase('setup'); callbacks.unmounted.push(callback); },
      onBeforeDispose(callback: (run: ${p}Run) => void) { ensurePhase('setup'); callbacks.beforeDispose.push(callback); },
    },
  };
${hookDefinitions}
  const render = (${fn(ir.setup, 1)})(${p}Def) ?? (() => ${p}Renderer.slot());
  if (typeof render !== 'function') throw new Error('[Prototype] setup must return a render function or void.');
  phase = 'idle';
  function applyProps(nextHost: GeneratedComponentProps) {
    ensureAlive();
    hostProps = nextHost;
    const nextRaw: Record<string, unknown> = Object.create(null);
    for (const [key, value] of Object.entries(nextHost)) {
      if (key === 'children' || key.startsWith('on') && typeof value === 'function') continue;
      nextRaw[key] = value === undefined ? null : value;
    }
    if (hydrated && Object.keys(raw).length === Object.keys(nextRaw).length
      && Object.keys(nextRaw).every((key) => Object.hasOwn(raw, key) && Object.is(raw[key], nextRaw[key]))) return;
    const previous = resolved;
    raw = Object.freeze(nextRaw);
    resolved = ${p}ResolveProps(specs, defaults, previousValid, raw, true);
    if (!hydrated) { hydrated = true; return; }
    invoke(() => {
      const changedKeysAll = Object.keys(specs).filter((key) => !Object.is(previous[key as keyof GeneratedProps], resolved[key as keyof GeneratedProps]));
      for (const watcher of watchers) {
        if (!watcher.active) continue;
        const changedKeysMatched = watcher.keys.filter((key) => changedKeysAll.includes(key));
        if (changedKeysMatched.length) watcher.callback(${p}RunHandle, resolved, previous, { changedKeysAll, changedKeysMatched });
      }
    });
  }
  const handle: GeneratedHandle = Object.freeze({
    update() { ensureExternal(); invoke(() => ${p}RunHandle.update()); },
    getExposes() { ensureExternal(); return exposes as GeneratedExposes; },
    invokeInCallbackScope<T>(callback: () => T): T { ensureExternal(); return invoke(callback); },
  });
  return {
    handle,
    connect() { connected = true; ++cleanupVersion; },
    start() { applyProps(initial); dispatch(callbacks.created); schedule(); },
    applyProps,
    accept(frame: ${p}Frame) {
      if (!connected || lifetime !== 'alive' || frame.revision <= acceptedRevision || frame !== latest) return;
      acceptedRevision = frame.revision;
      if (frame.kind === 'detach') {
        if (mounted) { mounted = false; dispatch(callbacks.unmounted); }
      } else if (!desiredPresent) {
        // The host has completed an obsolete commit. Never publish mounted/updated for it.
        mounted = true;
      } else if (frame.kind === 'mount') {
        mounted = true;
        dispatch(callbacks.mounted);
      } else if (mounted && frame.epoch === epoch) dispatch(callbacks.updated);
      schedule();
    },
    disconnect() {
      connected = false;
      const version = ++cleanupVersion;
      queueMicrotask(() => {
        if (connected || cleanupVersion !== version || lifetime !== 'alive') return;
        lifetime = 'disposing';
        phase = 'callback';
        let failure: unknown;
        try { if (mounted) { mounted = false; dispatch(callbacks.unmounted); } }
        catch (error) { failure = error; }
        try { dispatch(callbacks.beforeDispose); }
        catch (error) { failure ??= error; }
        finally {
          lifetime = 'disposed'; phase = 'idle';
          for (const subscribers of stateSubscribers) subscribers.clear();
          pendingStateEvents.length = 0;
          watchers.length = 0;
          for (const list of Object.values(callbacks)) list.length = 0;
          for (const key of Object.keys(exposes)) delete exposes[key];
        }
        if (failure !== undefined) throw failure;
      });
    },
  };
}

export const ${componentName} = ${p}React.forwardRef<GeneratedHandle, GeneratedComponentProps>(function ${componentName}(props, ref) {
  const ownerRef = ${p}React.useRef<${p}Owner | null>(null);
  const [frame, setFrame] = ${p}React.useState<${p}Frame | null>(null);
  // All irreversible work begins after an accepted shell commit, never during React render.
  ${p}React.useLayoutEffect(() => {
    let owner = ownerRef.current;
    if (!owner) {
      owner = ${p}CreateOwner(props, setFrame);
      ownerRef.current = owner;
      owner.start();
    } else owner.connect();
  }, []);
  // Suspense can disconnect layout effects without unmounting the owner shell.
  // Passive cleanup identifies shell unmount; same-turn StrictMode replay cancels disposal.
  ${p}React.useEffect(() => {
    const owner = ownerRef.current!;
    owner.connect();
    return () => { owner.disconnect(); };
  }, []);
  ${p}React.useLayoutEffect(() => { ownerRef.current!.applyProps(props); }, [props]);
  ${p}React.useLayoutEffect(() => { if (frame) ownerRef.current!.accept(frame); }, [frame]);
  ${p}React.useImperativeHandle(ref, () => ownerRef.current!.handle, []);
  return frame?.node ?? null;
});
${componentName}.displayName = ${JSON.stringify(ir.name)};
`;
  return {
    ok: true,
    value: {
      code,
      profile: 'react-dom-source-v1',
      dependencies: selected.value.dependencies.map((dependency) => ({ ...dependency })),
      provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'react-dom-source-v1' },
    },
  };
}
