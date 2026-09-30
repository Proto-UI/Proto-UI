import { formatDataType } from './data-types';
import { isDataValueType } from './ir';
import { validateIR, validIdentifier } from './ir-validation';
import { OPERATION_RULES } from './operations';
import type { CompileResult, ExpressionIR, FunctionIR, GeneratedModule, PrototypeIR, StatementIR, ValueType } from './ir';

const SUPPORTED: Record<string, true> = {
  'run.update': true, 'render.read.props.get': true, 'props.define': true, 'props.setDefaults': true, 'props.watch': true, 'props.get': true,
  'state.bool': true, 'state.string': true, 'state.numberDiscrete': true, 'state.numberRange': true, 'state.get': true, 'state.set': true,
  'expose.state': true, 'expose.event': true, 'expose.method': true, 'expose.emit': true,
  'lifecycle.setPresent': true, 'lifecycle.onCreated': true, 'lifecycle.onMounted': true, 'lifecycle.onUpdated': true,
  'lifecycle.onUnmounted': true, 'lifecycle.onBeforeDispose': true, 'render.el': true, 'render.slot': true,
};

/** Direct native DOM source. The emitted helper kernel owns resources; it never interprets IR. */
export function emitWebComponentSource(
  input: PrototypeIR,
  options: { className?: string; tagName?: string } = {}
): CompileResult<GeneratedModule> {
  const checked = validateIR(input);
  if (!checked.ok) return checked;
  const ir = checked.value;
  const className = options.className ?? 'CompiledElement';
  const tagName = options.tagName ?? 'pui-compiled-element';
  const reject = (message: string, span = ir.setup.span): CompileResult<GeneratedModule> => ({
    ok: false, diagnostics: [{ code: 'PUI3301', category: 'unsupported-input', message, span }],
  });
  if (!validIdentifier(className) || [
    'GeneratedProps', 'GeneratedExposes', 'register', 'HTMLElement', 'Node', 'ShadowRoot',
    'CustomElementRegistry', 'CustomEvent', 'customElements', 'queueMicrotask',
    'Object', 'Number', 'Array', 'Set', 'Symbol', 'Error', 'Math', 'String',
    'Function', 'Readonly', 'Record', 'Partial', 'undefined',
  ].includes(className)) {
    return reject('Choose a valid, non-reserved custom element class identifier.');
  }
  if (!/^[a-z][a-z0-9._-]*-[a-z0-9._-]+$/.test(tagName) || ['annotation-xml', 'color-profile', 'font-face', 'font-face-src', 'font-face-uri', 'font-face-format', 'font-face-name', 'missing-glyph'].includes(tagName)) {
    return reject('Choose a valid lowercase autonomous custom element tag name.');
  }
  const names = new Set<string>([className]);
  const unsupported: { message: string; span: PrototypeIR['setup']['span'] }[] = [];
  function scan(value: unknown): void {
    if (Array.isArray(value)) { for (const entry of value) scan(entry); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (node.kind === 'operation' && !Object.hasOwn(SUPPORTED, String(node.operation))) {
      unsupported.push({ message: `web-component-source-v1 does not implement ${String(node.operation)}.`, span: node.span as PrototypeIR['setup']['span'] });
    }
    if (node.kind === 'operation' && node.operation === 'render.el') {
      const args = node.arguments as ExpressionIR[];
      const props = args.length > 2 ? args[1] : args[1]?.kind === 'record' ? args[1] : undefined;
      if (props && (props.kind !== 'record' || props.entries.length)) {
        unsupported.push({ message: 'web-component-source-v1 does not implement template style handles or element props.', span: props.span });
      }
    }
    // This profile implements scalar prop descriptors, not arbitrary validators or structural schemas.
    if (node.kind === 'operation' && node.operation === 'props.define') {
      const declaration = (node.arguments as ExpressionIR[])[0];
      if (declaration.kind !== 'record') unsupported.push({ message: 'Native prop declarations must be static records.', span: declaration.span });
      else for (const entry of declaration.entries) {
        const spec = entry.value;
        const typeField = spec.kind === 'record' ? spec.entries.find((field) => field.key === 'type')?.value : undefined;
        if (spec.kind !== 'record' || !typeField || typeField.kind !== 'literal' || !['boolean', 'number', 'string'].includes(String(typeField.value)) || spec.entries.some((field) => !['type', 'default', 'empty', 'range'].includes(field.key))) {
          unsupported.push({ message: 'web-component-source-v1 supports scalar prop type/default/empty/range descriptors only.', span: spec.span });
        }
      }
    }
    for (const [key, item] of Object.entries(node)) {
      if (key === 'name' && typeof item === 'string') names.add(item);
      scan(item);
    }
  }
  scan(ir);
  if (unsupported.length) return { ok: false, diagnostics: unsupported.map(({ message, span }) => ({ code: 'PUI3302', category: 'unsupported-input', message, span })) };
  if (ir.props.some((prop) => !['boolean', 'number', 'string'].includes(String(prop.type)))) return reject('web-component-source-v1 currently supports scalar props only.');
  let prefix = '__wc';
  while ([...names].some((name) => name.startsWith(prefix))) prefix += '_';
  const hooks = new Map(ir.hooks.map((hook, index) => [hook.id, `${prefix}Hook${index}`]));
  function typeName(type: ValueType): string {
    if (isDataValueType(type)) return formatDataType(type);
    if (type === 'def') return `${prefix}Def`;
    if (type === 'run') return `${prefix}Run`;
    if (type === 'render') return `${prefix}Renderer`;
    if (type.startsWith('state:')) return `${prefix}State<${type.slice(6)}>`;
    if (type === 'props') return `${prefix}PropsSnapshot`;
    if (type === 'record') return 'Record<string, unknown>';
    if (type === 'array') return 'unknown[]';
    return 'unknown';
  }
  function fn(node: FunctionIR, depth: number): string {
    return `(${node.parameters.map((parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`).join(', ')}) => {\n${statements(node.body, depth + 1)}${'  '.repeat(depth)}}`;
  }
  function expr(node: ExpressionIR, depth: number): string {
    switch (node.kind) {
      case 'literal': return JSON.stringify(node.value);
      case 'reference': return node.name;
      case 'context-key': throw new Error('Context key reached source emission after capability admission.');
      case 'member': return `(${expr(node.object, depth)})${node.optional ? '?.' : ''}[${JSON.stringify(node.property)}]`;
      case 'unary': return `(${node.operator}${expr(node.operand, depth)})`;
      case 'binary': return `(${expr(node.left, depth)} ${node.operator} ${expr(node.right, depth)})`;
      case 'array': return `[${node.elements.map((value) => expr(value, depth)).join(', ')}]`;
      case 'record': return `{ ${node.entries.map((entry) => `[${JSON.stringify(entry.key)}]: ${expr(entry.value, depth)}`).join(', ')} }`;
      case 'function': return fn(node.function, depth);
      case 'helper-call': return `${node.name}(${node.arguments.map((value) => expr(value, depth)).join(', ')})`;
      case 'authored-hook': return `${hooks.get(node.hookId)}()`;
      case 'operation': return `${expr(node.receiver!, depth)}.${OPERATION_RULES[node.operation].path}(${node.arguments.map((value) => expr(value, depth)).join(', ')})`;
    }
  }
  function statements(body: readonly StatementIR[], depth: number): string {
    const indent = '  '.repeat(depth);
    return body.map((statement) => {
      switch (statement.kind) {
        case 'const': return `${indent}const ${statement.name} = ${expr(statement.value, depth)};\n`;
        case 'effect': return `${indent}${expr(statement.expression, depth)};\n`;
        case 'return': return `${indent}return${statement.value ? ` ${expr(statement.value, depth)}` : ''};\n`;
        case 'if': return `${indent}if (${expr(statement.condition, depth)}) {\n${statements(statement.then, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, depth + 1)}${indent}}` : ''}\n`;
      }
    }).join('');
  }
  const hookCode = ir.hooks.map((hook) => `    const ${hooks.get(hook.id)} = () => (${fn(hook.setup, 2)})(${prefix}Def);\n`).join('');
  const props = ir.props.map((prop) => `  ${JSON.stringify(prop.name)}?: ${typeName(prop.type)} | null;`).join('\n');
  const resolvedProps = ir.props.map((prop) => `  readonly ${JSON.stringify(prop.name)}: ${typeName(prop.type)};`).join('\n');
  const exposes = ir.exposes.filter((entry) => entry.kind !== 'event').map((entry) => {
    const type = entry.kind === 'state'
      ? `${prefix}ExternalState<${entry.type}>`
      : `(${entry.parameters.map((parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`).join(', ')}) => ${typeName(entry.returnType)}`;
    return `  ${JSON.stringify(entry.name)}: ${type};`;
  }).join('\n');
  const code = `// Native web-component-source-v1: no Proto-UI Runtime/Core/Adapter dependency.
// Helper cost: owner/callback guards, scalar state + subscriptions, prop fallback/watch,
// microtask update/ViewIntent reconciliation, native shadow DOM template construction.
// setProps is a full raw snapshot. No automatic state-write rendering.
// Synchronous DOM moves retain the owner; settled disconnection disposes it.
// setPresent detaches only the view; explicit dispose permanently closes this element.
export type GeneratedProps = {
${props}
};
type ${prefix}PropsSnapshot = {
${resolvedProps}
};
export type GeneratedExposes = {
${exposes}
};
${nativeHelpers(prefix)}
export class ${className} extends HTMLElement {
  private ${prefix}Owner: ${prefix}Owner | null = null;
  private ${prefix}Raw: Record<string, unknown> = {};
  private ${prefix}Disconnect = 0;
  private ${prefix}Closed = false;
  get logicalOwner(): symbol | null { return this.${prefix}Owner?.identity ?? null; }
  get viewEpoch(): number { return this.${prefix}Owner?.epoch ?? 0; }
  get present(): boolean { return this.${prefix}Owner?.view ?? false; }
  connectedCallback(): void {
    ++this.${prefix}Disconnect;
    if (this.${prefix}Closed || this.${prefix}Owner) return;
    const root = this.shadowRoot ?? this.attachShadow({mode: 'open'});
    const owner = ${prefix}CreateOwner(this, root);
    this.${prefix}Owner = owner;
    const ${prefix}Def = owner.def;
${hookCode}    try {
      owner.render = (${fn(ir.setup, 3)})(${prefix}Def);
      owner.hydrate(this.${prefix}Raw);
      owner.created();
      owner.reconcile();
    } catch (error) {
      owner.dispose();
      this.${prefix}Owner = null;
      throw error;
    }
  }
  disconnectedCallback(): void {
    const version = ++this.${prefix}Disconnect;
    const owner = this.${prefix}Owner;
    queueMicrotask(() => {
      if (version !== this.${prefix}Disconnect || this.isConnected || !owner || owner !== this.${prefix}Owner) return;
      this.${prefix}Owner = null;
      owner.dispose();
    });
  }
  setProps(next: GeneratedProps & Record<string, unknown>): void {
    if (this.${prefix}Closed) throw new Error('Custom element is disposed');
    this.${prefix}Raw = { ...next };
    if (this.${prefix}Owner) { this.${prefix}Owner.hydrate(this.${prefix}Raw); this.${prefix}Owner.update(); }
  }
  update(): void {
    if (this.${prefix}Closed) throw new Error('Custom element is disposed');
    this.${prefix}Owner?.update();
  }
  getExposes(): Partial<GeneratedExposes> {
    return this.isConnected && this.${prefix}Owner ? this.${prefix}Owner.exposes as Partial<GeneratedExposes> : {};
  }
  dispose(): void {
    if (this.${prefix}Closed) return;
    this.${prefix}Closed = true;
    ++this.${prefix}Disconnect;
    const owner = this.${prefix}Owner;
    this.${prefix}Owner = null;
    owner?.dispose();
  }
}
export function register(tagName = ${JSON.stringify(tagName)}, registry: CustomElementRegistry = customElements): typeof ${className} {
  const existing = registry.get(tagName);
  if (existing && existing !== ${className}) throw new Error('Custom element tag already registered: ' + tagName);
  if (!existing) registry.define(tagName, ${className});
  return ${className};
}
export default ${className};
`;
  return { ok: true, value: { code, profile: 'web-component-source-v1', dependencies: [], provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'web-component-source-v1' } } };
}

function nativeHelpers(p: string): string {
  return `type ${p}ExternalState<T> = { get(): T; subscribe(cb: (event: {type: 'next'; prev: T; next: T; reason?: unknown}) => void): () => void; unsubscribe(off: () => void): void; spec: Readonly<${p}StateOptions & {kind: string}> };
type ${p}Scalar = string | number | boolean | null;
type ${p}Snapshot = Readonly<Record<string, ${p}Scalar>>;
type ${p}PropSpec = {type: string; default?: ${p}Scalar; empty?: 'accept' | 'fallback' | 'error'; range?: {min?: number; max?: number}};
type ${p}StateOptions = {options?: readonly ${p}Scalar[]; min?: number; max?: number; step?: number; clamp?: boolean};
type ${p}State<T extends ${p}Scalar = ${p}Scalar> = {get(): T; set(next: T, reason?: unknown): void; external: ${p}ExternalState<T>; subscribers: Set<Function>};
type ${p}Run = {update(): void; props: {get(): ${p}PropsSnapshot}; lifecycle: {setPresent(next: boolean): void}; expose: {emit(key: string, payload?: unknown, options?: CustomEventInit): void}};
type ${p}Renderer = {el(tag: string, a?: unknown, b?: unknown): Node; slot(): Node; props: {get(): ${p}PropsSnapshot}; read: {props: {get(): ${p}PropsSnapshot}}};
type ${p}Def = {
  props: {define(input: Record<string, ${p}PropSpec>): void; setDefaults(input: Record<string, ${p}Scalar>): void; watch(keys: string[], fn: Function): () => void};
  state: {bool(s: string, v: boolean): ${p}State<boolean>; string(s: string, v: string, o?: ${p}StateOptions): ${p}State<string>; numberDiscrete(s: string, v: number, o?: ${p}StateOptions): ${p}State<number>; numberRange(s: string, v: number, o: ${p}StateOptions): ${p}State<number>};
  expose: {state(key: string, handle: ${p}State): void; method(key: string, fn: Function): void; event(key: string, spec?: object): void};
  lifecycle: {onCreated(fn: Function): void; onMounted(fn: Function): void; onUpdated(fn: Function): void; onUnmounted(fn: Function): void; onBeforeDispose(fn: Function): void};
};
type ${p}Owner = {identity: symbol; def: ${p}Def; exposes: Record<string, unknown>; render?: Function | void; readonly epoch: number; readonly view: boolean; hydrate(input: Record<string, unknown>): void; update(): void; reconcile(): void; created(): void; dispose(): void};
function ${p}CreateOwner(host: HTMLElement, root: ShadowRoot): ${p}Owner {
  let alive = true, disposing = false, setup = true, callbackDepth = 0;
  let intent = true, view = false, epoch = 0, queued = false, dirty = false;
  let detachedDisplay: {value: string; priority: string} | undefined;
  let resolved: ${p}Snapshot = Object.freeze({}), raw: Readonly<Record<string, unknown>> = Object.freeze({}), hydrated = false;
  const specs: Record<string, ${p}PropSpec> = Object.create(null), previous: Record<string, ${p}Scalar> = Object.create(null), defaults: Record<string, ${p}Scalar>[] = [];
  const watchers: {keys: string[]; fn: Function; active: boolean}[] = [], states: ${p}State[] = [], emissions: (() => void)[] = [];
  let emitting = false;
  const exposes: Record<string, unknown> = Object.create(null), events = new Set<string>();
  const lifecycle: Record<string, Function[]> = {created: [], mounted: [], updated: [], unmounted: [], beforeDispose: []};
  const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
  const ensure = () => { if (!alive) throw new Error('Logical owner is disposed'); };
  const ensureSetup = () => { ensure(); if (!setup) throw new Error('Setup capability is closed'); };
  const runtime = () => { ensure(); if (setup || !callbackDepth) throw new Error('State writes require a live callback scope'); };
  function invoke(fn: Function, args: unknown[] = [], withRun = true): unknown {
    ensure();
    let active = true;
    const capturedEpoch = epoch;
    const check = () => { ensure(); if (!active || capturedEpoch !== epoch) throw new Error('Callback handle is stale'); };
    const run: ${p}Run = {
      update() { check(); if (!disposing) schedule(true); },
      props: {get() { check(); return resolved as ${p}PropsSnapshot; }},
      lifecycle: {setPresent(next: boolean) { check(); if (disposing) return; intent = next; schedule(false); }},
      expose: {emit(key: string, payload?: unknown, options?: CustomEventInit) { check(); if (!events.has(key)) throw new Error('Undeclared exposed event: ' + key); host.dispatchEvent(new CustomEvent(key, {detail: payload, bubbles: true, cancelable: true, ...options})); }},
    };
    ++callbackDepth;
    try { return fn(...(withRun ? [run, ...args] : args)); }
    finally { active = false; --callbackDepth; }
  }
  function fire(name: string): void {
    let error: unknown;
    for (const fn of lifecycle[name]) { try { invoke(fn); } catch (caught) { error ??= caught; } }
    if (error !== undefined) throw error;
  }
  function valid(spec: ${p}PropSpec, value: unknown): value is ${p}Scalar {
    return typeof value === spec.type && (spec.type !== 'number' || Number.isFinite(value)) &&
      (!spec.range || (typeof value === 'number' && value >= (spec.range.min ?? -Infinity) && value <= (spec.range.max ?? Infinity)));
  }
  function resolve(strict: boolean): ${p}Snapshot {
    const next: Record<string, ${p}Scalar> = Object.create(null);
    for (const key of Object.keys(specs)) {
      const spec = specs[key], provided = own(raw, key), value = raw[key];
      const requireValue = strict && spec.empty === 'error';
      if (provided && value != null && valid(spec, value)) { next[key] = value; previous[key] = value; continue; }
      if (provided && value == null && spec.empty === 'accept') { next[key] = null; continue; }
      let candidate: ${p}Scalar | undefined;
      if (provided && own(previous, key) && valid(spec, previous[key])) candidate = previous[key];
      if (candidate === undefined) for (const layer of defaults) {
        if (!own(layer, key)) continue;
        const value = layer[key];
        if ((value === null && !requireValue) || (value != null && valid(spec, value))) { candidate = value; break; }
      }
      if (candidate === undefined && own(spec, 'default')) {
        const value = spec.default;
        if ((value === null && !requireValue) || (value != null && valid(spec, value))) candidate = value;
      }
      if (candidate === undefined) {
        if (requireValue) throw new Error('Prop has no valid fallback: ' + key);
        candidate = null;
      }
      next[key] = candidate;
      if (provided && next[key] != null) previous[key] = next[key];
    }
    return Object.freeze(next);
  }
  function hydrate(input: Record<string, unknown>): void {
    ensure();
    const prev = resolved;
    raw = Object.freeze(Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === undefined ? null : value])));
    resolved = resolve(true);
    if (!hydrated) { hydrated = true; return; }
    const changed = Object.keys(specs).filter((key) => !Object.is(prev[key], resolved[key]));
    const next = resolved;
    for (const watcher of [...watchers]) {
      const matched = changed.filter((key) => watcher.keys.includes(key));
      if (watcher.active && matched.length) invoke(watcher.fn, [next, prev, {changedKeysAll: changed, changedKeysMatched: matched}]);
    }
  }
  function state<T extends ${p}Scalar>(kind: string, semantic: string, initial: T, options: ${p}StateOptions = {}): ${p}State<T> {
    ensureSetup();
    if (!/^[a-z0-9-]+(\\.[a-z0-9-]+)*$/.test(semantic)) throw new Error('Invalid state semantic');
    const spec = Object.freeze({...options, kind});
    function validate(value: unknown): void {
      const type = kind === 'bool' ? 'boolean' : kind === 'string' ? 'string' : 'number';
      if (typeof value !== type || (type === 'number' && Number.isNaN(value))) throw new Error('Invalid state value');
      if (options.options?.length && !options.options.includes(value as ${p}Scalar)) throw new Error('State value outside options');
      if (kind === 'number.range' || (kind === 'number.discrete' && !options.options?.length)) {
        const numeric = typeof value === 'number' ? value : NaN;
        if (numeric < (options.min ?? -Infinity) || numeric > (options.max ?? Infinity)) throw new Error('State value outside range');
        if (kind === 'number.discrete' && options.step !== undefined && options.step > 0 && !Number.isInteger((numeric - (options.min ?? 0)) / options.step)) throw new Error('State value violates step');
      }
    }
    if (kind === 'number.range' && options.clamp) initial = Math.max(options.min ?? -Infinity, Math.min(options.max ?? Infinity, initial as number)) as T;
    validate(initial);
    let value = initial;
    const subscribers = new Set<Function>();
    const external = Object.freeze({
      get() { ensure(); return value; }, spec,
      subscribe(fn: Function) { ensure(); subscribers.add(fn); return () => subscribers.delete(fn); },
      unsubscribe(off: () => void) { ensure(); off(); },
    });
    const handle = {external, subscribers,
      get() { ensure(); return value; },
      set(next: T, reason?: unknown) {
        runtime(); validate(next); if (Object.is(value, next)) return;
        const prev = value; value = next;
        emissions.push(() => { for (const fn of [...subscribers]) { if (alive && subscribers.has(fn)) invoke(fn, [{type: 'next', prev, next, reason}], false); } });
        if (emitting) return;
        emitting = true;
        try { while (emissions.length && alive) emissions.shift()!(); } finally { emitting = false; }
      },
    };
    states.push(handle); return handle;
  }
  function element(tag: string, a?: unknown, b?: unknown): Node {
    const node = host.ownerDocument.createElement(tag);
    const children = arguments.length === 1 ? null : arguments.length > 2 ? b : a != null && typeof a === 'object' && !Array.isArray(a) && !(a instanceof Node) ? null : a;
    append(node, children); return node;
  }
  let slotUsed = false;
  function append(parent: Node, children: unknown): void {
    if (children === null) return;
    if (Array.isArray(children)) { for (const child of children) append(parent, child); return; }
    if (children instanceof Node) { parent.appendChild(children); return; }
    if (typeof children === 'string' || typeof children === 'number') { parent.appendChild(host.ownerDocument.createTextNode(String(children))); return; }
    throw new Error('Invalid template child');
  }
  function render(): void {
    slotUsed = false;
    const renderer: ${p}Renderer = {el: element, slot() { if (slotUsed) throw new Error('Multiple slots are unsupported'); slotUsed = true; return host.ownerDocument.createElement('slot'); }, props: {get: () => resolved as ${p}PropsSnapshot}, read: {props: {get: () => resolved as ${p}PropsSnapshot}}};
    const fragment = host.ownerDocument.createDocumentFragment();
    if (typeof owner.render === 'function') append(fragment, owner.render(renderer));
    root.replaceChildren(fragment);
  }
  function detach(): void {
    if (!detachedDisplay) detachedDisplay = {value: host.style.getPropertyValue('display'), priority: host.style.getPropertyPriority('display')};
    host.style.setProperty('display', 'none', 'important');
    if (!view) return;
    view = false; ++epoch;
    try { fire('unmounted'); } finally { root.replaceChildren(); }
  }
  function reconcile(): void {
    if (!alive || disposing || !host.isConnected) return;
    if (!intent) { detach(); return; }
    if (detachedDisplay) {
      if (host.style.getPropertyValue('display') === 'none' && host.style.getPropertyPriority('display') === 'important') {
        if (detachedDisplay.value) host.style.setProperty('display', detachedDisplay.value, detachedDisplay.priority);
        else host.style.removeProperty('display');
      }
      detachedDisplay = undefined;
    }
    if (!view) { ++epoch; render(); view = true; fire('mounted'); }
    else if (dirty) { render(); fire('updated'); }
  }
  function schedule(update: boolean): void {
    ensure(); dirty ||= update; if (queued || disposing) return;
    queued = true;
    queueMicrotask(() => {
      queued = false; if (!alive || disposing) return;
      const shouldUpdate = dirty; dirty = false;
      if (!intent) detach();
      else if (host.isConnected) { if (!view) reconcile(); else if (shouldUpdate) { render(); fire('updated'); } }
    });
  }
  function expose(key: string, value: unknown): void { ensureSetup(); if (own(exposes, key) || events.has(key)) throw new Error('Duplicate expose: ' + key); exposes[key] = value; }
  const def: ${p}Def = {
    props: {
      define(input: Record<string, ${p}PropSpec>) {
        ensureSetup();
        const merged = {...specs};
        for (const key of Object.keys(input)) {
          const next = input[key], prev = specs[key];
          if (!['boolean', 'number', 'string'].includes(next.type)) throw new Error('Unsupported prop type');
          if (next.empty !== undefined && !['accept', 'fallback', 'error'].includes(next.empty)) throw new Error('Invalid prop empty policy');
          if (next.range && ((next.range.min !== undefined && (typeof next.range.min !== 'number' || Number.isNaN(next.range.min))) || (next.range.max !== undefined && (typeof next.range.max !== 'number' || Number.isNaN(next.range.max))))) throw new Error('Invalid prop range');
          if (prev && (prev.type !== next.type || (prev.range && next.range && ((next.range.min ?? -Infinity) > (prev.range.min ?? -Infinity) || (next.range.max ?? Infinity) < (prev.range.max ?? Infinity))))) throw new Error('Conflicting prop declaration');
          const rank = (empty: string) => empty === 'accept' ? 0 : empty === 'error' ? 2 : 1;
          if (prev && next.empty !== undefined && rank(next.empty) > rank(prev.empty ?? 'fallback')) throw new Error('Conflicting prop empty policy');
          merged[key] = {...prev, ...next, empty: prev?.empty ?? next.empty ?? 'fallback', range: next.range ?? prev?.range, ...(prev && own(prev, 'default') ? {default: prev.default} : {})};
        }
        Object.assign(specs, merged);
        resolved = resolve(false);
      },
      setDefaults(input: Record<string, ${p}Scalar>) { ensureSetup(); for (const key of Object.keys(input)) if (!own(specs, key)) throw new Error('Undeclared prop default: ' + key); defaults.unshift({...input}); resolved = resolve(false); },
      watch(keys: string[], fn: Function) { ensureSetup(); const watcher = {keys: [...keys], fn, active: true}; watchers.push(watcher); return () => { watcher.active = false; }; },
    },
    state: {bool: (s: string, v: boolean) => state('bool', s, v), string: (s: string, v: string, o?: ${p}StateOptions) => state('string', s, v, o), numberDiscrete: (s: string, v: number, o?: ${p}StateOptions) => state('number.discrete', s, v, o), numberRange: (s: string, v: number, o: ${p}StateOptions) => state('number.range', s, v, o)},
    expose: {
      state(key: string, handle: ${p}State) { expose(key, handle.external); },
      method(key: string, fn: Function) { expose(key, (...args: unknown[]) => invoke(fn, args, false)); },
      event(key: string) { ensureSetup(); if (own(exposes, key) || events.has(key)) throw new Error('Duplicate expose: ' + key); events.add(key); },
    },
    lifecycle: {onCreated(fn) { ensureSetup(); lifecycle.created.push(fn); }, onMounted(fn) { ensureSetup(); lifecycle.mounted.push(fn); }, onUpdated(fn) { ensureSetup(); lifecycle.updated.push(fn); }, onUnmounted(fn) { ensureSetup(); lifecycle.unmounted.push(fn); }, onBeforeDispose(fn) { ensureSetup(); lifecycle.beforeDispose.push(fn); }},
  };
  const owner: ${p}Owner = {
    identity: Symbol('compiled-logical-owner'), def, exposes, render: undefined,
    get epoch() { return epoch; }, get view() { return view; },
    hydrate, update: () => schedule(true), reconcile,
    created() { setup = false; fire('created'); },
    dispose() {
      if (!alive || disposing) return; disposing = true;
      let error: unknown;
      try { fire('beforeDispose'); } catch (caught) { error = caught; }
      try { detach(); } catch (caught) { error ??= caught; }
      finally {
        alive = false; ++epoch; dirty = false; watchers.length = 0; emissions.length = 0;
        for (const handle of states) handle.subscribers.clear();
        for (const callbacks of Object.values(lifecycle)) callbacks.length = 0;
        root.replaceChildren();
        if (detachedDisplay && host.style.getPropertyValue('display') === 'none' && host.style.getPropertyPriority('display') === 'important') {
          if (detachedDisplay.value) host.style.setProperty('display', detachedDisplay.value, detachedDisplay.priority);
          else host.style.removeProperty('display');
        }
        detachedDisplay = undefined;
      }
      if (error !== undefined) throw error;
    },
  };
  return owner;
}
`;
}
