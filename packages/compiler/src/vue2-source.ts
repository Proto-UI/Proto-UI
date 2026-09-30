import { formatDataType } from './data-types';
import { validateIR, validIdentifier } from './ir-validation';
import { OPERATION_RULES } from './operations';
import { checkTargetOperations, resolveTargetProfile } from './targets';
import type {
  CompileResult, CompilerDiagnostic, ExpressionIR, FunctionIR, GeneratedModule,
  ParameterIR, PrototypeIR, StatementIR, ValueType,
} from './ir';

export interface Vue2SourceOptions {
  componentName?: string;
  rootTag?: string;
  autoUpdateOnPropsChange?: boolean;
}

/** Component-options output for the concrete Vue 2.6.14 consumer, not an Adapter bridge. */
export function emitVue2Source(
  input: PrototypeIR,
  options: Vue2SourceOptions = {}
): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = validated.value;
  const selected = resolveTargetProfile('vue2-source-v1');
  if (!selected.ok) return selected;
  const admitted = checkTargetOperations(ir, selected.value);
  if (!admitted.ok) return admitted;
  const componentName = options.componentName ?? 'CompiledComponent';
  const rootTag = options.rootTag ?? 'div';
  const diagnostics: CompilerDiagnostic[] = [];
  const reject = (message: string, span = ir.setup.span): void => {
    diagnostics.push({ code: 'PUI4102', category: 'unsupported-input', message, span });
  };
  const implemented: Readonly<Record<string, true>> = {
    'run.update': true,
    'props.define': true, 'props.setDefaults': true, 'props.watch': true, 'props.get': true,
    'render.read.props.get': true,
    'state.bool': true, 'state.string': true, 'state.numberDiscrete': true,
    'state.numberRange': true, 'state.get': true, 'state.set': true,
    'expose.state': true, 'expose.event': true, 'expose.method': true, 'expose.emit': true,
    'lifecycle.setPresent': true, 'lifecycle.onCreated': true, 'lifecycle.onMounted': true,
    'lifecycle.onUpdated': true, 'lifecycle.onUnmounted': true, 'lifecycle.onBeforeDispose': true,
    'render.el': true, 'render.slot': true,
  };
  for (const site of admitted.value.sites) {
    if (!Object.hasOwn(implemented, site.operation)) {
      reject(`Operation ${site.operation} has no Vue2 native lowering.`, site.span);
    }
  }
  if (!validIdentifier(componentName) || ['GeneratedProps', 'GeneratedExposes'].includes(componentName)) {
    return { ok: false, diagnostics: [{ code: 'PUI3001', category: 'invalid-input',
      message: 'Choose a valid, non-reserved generated component identifier.', span: ir.setup.span }] };
  }
  if (!/^[a-z][a-z0-9-]*$/.test(rootTag)) {
    reject('The Vue2 native rootTag must be a static lowercase DOM tag.');
  }
  const hostPropNames = new Map<string, string>();
  for (const prop of ir.props) {
    const hostName = prop.name.replace(/-(\w)/g, (_match, letter: string) => letter.toUpperCase());
    const prior = hostPropNames.get(hostName);
    if (hostName === '__proto__' || prior !== undefined && prior !== prop.name) {
      reject(`Prop ${JSON.stringify(prop.name)} cannot be represented without a Vue2 prop-name collision.`, prop.span);
    }
    hostPropNames.set(hostName, prop.name);
  }
  // An operation name is not proof that every host-specific argument has a lowering.
  // Fail closed before emitting, including inside statically expanded authored hooks.
  function inspect(node: ExpressionIR): void {
    if (node.kind === 'operation') {
      if (node.operation === 'render.el') {
        const props = node.arguments[1];
        const record = props && (props.type === 'record' || typeof props.type === 'object' && props.type.kind === 'record');
        if (record && (props.kind !== 'record' || props.entries.length)) {
          reject('vue2-source-v1 does not yet lower template style descriptors. Remove the style descriptor; no Runtime fallback is emitted.', props.span);
        }
      }
      if (node.operation === 'props.define' && node.arguments[0]?.kind === 'record') {
        for (const entry of node.arguments[0].entries) {
          if (entry.value.kind !== 'record') continue;
          for (const field of entry.value.entries) {
            if (!['type', 'default', 'empty', 'options', 'range'].includes(field.key)) {
              reject(`vue2-source-v1 does not implement prop descriptor field ${JSON.stringify(field.key)}.`, field.value.span);
            }
          }
        }
      }
      if (node.receiver) inspect(node.receiver);
      node.arguments.forEach(inspect);
    } else if (node.kind === 'context-key') {
      reject('vue2-source-v1 does not implement Context keys or propagation.', node.span);
    } else if (node.kind === 'function') inspectBody(node.function.body);
    else if (node.kind === 'member') inspect(node.object);
    else if (node.kind === 'unary') inspect(node.operand);
    else if (node.kind === 'binary') { inspect(node.left); inspect(node.right); }
    else if (node.kind === 'array') node.elements.forEach(inspect);
    else if (node.kind === 'record') node.entries.forEach((entry) => inspect(entry.value));
    else if (node.kind === 'helper-call') node.arguments.forEach(inspect);
  }
  function inspectBody(body: readonly StatementIR[]): void {
    for (const statement of body) {
      if (statement.kind === 'const') inspect(statement.value);
      else if (statement.kind === 'effect') inspect(statement.expression);
      else if (statement.kind === 'return' && statement.value) inspect(statement.value);
      else if (statement.kind === 'if') {
        inspect(statement.condition); inspectBody(statement.then); inspectBody(statement.otherwise);
      }
    }
  }
  inspectBody(ir.setup.body);
  for (const hook of ir.hooks) inspectBody(hook.setup.body);
  if (diagnostics.length) return { ok: false, diagnostics };

  const names = new Set<string>([componentName]);
  function collect(value: unknown): void {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'name' && typeof item === 'string') names.add(item);
        collect(item);
      }
    }
  }
  collect(ir);
  let prefix = '__pui';
  while ([...names].some((name) => name.startsWith(prefix))) prefix += '_';
  const aliases = new Map(ir.hooks.map((hook, index) => [hook.id, `${prefix}Hook${index}`]));
  function typeName(type: ValueType): string {
    if (typeof type === 'object') return formatDataType(type);
    if (['boolean', 'number', 'string', 'null', 'void', 'unknown'].includes(type)) return type;
    if (type === 'props') return 'GeneratedProps';
    return 'unknown';
  }
  function parameters(values: readonly ParameterIR[]): string {
    return values.map((parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`).join(', ');
  }
  function fn(value: FunctionIR, depth: number): string {
    return `(${value.parameters.map((parameter) => parameter.name).join(', ')}) => {\n${body(value.body, depth + 1)}${'  '.repeat(depth)}}`;
  }
  function expression(value: ExpressionIR, depth: number): string {
    switch (value.kind) {
      case 'literal': return JSON.stringify(value.value);
      case 'reference': return value.name;
      case 'context-key': throw new Error('A Context key reached Vue2 emission after capability admission.');
      case 'member': return `(${expression(value.object, depth)})${value.optional ? '?.' : ''}[${JSON.stringify(value.property)}]`;
      case 'unary': return `(${value.operator}${expression(value.operand, depth)})`;
      case 'binary': return `(${expression(value.left, depth)} ${value.operator} ${expression(value.right, depth)})`;
      case 'array': return `[${value.elements.map((item) => expression(item, depth)).join(', ')}]`;
      case 'record': return `{ ${value.entries.map((entry) => `[${JSON.stringify(entry.key)}]: ${expression(entry.value, depth)}`).join(', ')} }`;
      case 'function': return fn(value.function, depth);
      case 'helper-call': return `${value.name}(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
      case 'authored-hook': return `${aliases.get(value.hookId)}()`;
      case 'operation': return `${expression(value.receiver!, depth)}.${OPERATION_RULES[value.operation].path}(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
    }
  }
  function body(statements: readonly StatementIR[], depth: number): string {
    const indent = '  '.repeat(depth);
    return statements.map((statement) => {
      const origin = `${indent}// Source ${statement.span.line}:${statement.span.column}\n`;
      switch (statement.kind) {
        case 'const': return `${origin}${indent}const ${statement.name} = ${expression(statement.value, depth)};\n`;
        case 'effect': return `${origin}${indent}${expression(statement.expression, depth)};\n`;
        case 'return': return `${origin}${indent}return${statement.value ? ` ${expression(statement.value, depth)}` : ''};\n`;
        case 'if': return `${origin}${indent}if (${expression(statement.condition, depth)}) {\n${body(statement.then, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${body(statement.otherwise, depth + 1)}${indent}}` : ''}\n`;
      }
    }).join('');
  }
  const propsType = ir.props.map((prop) => `  ${JSON.stringify(prop.name)}?: ${typeName(prop.type)} | null;`).join('\n').replace(/\*\//g, '*\\/');
  const exposesType = ir.exposes.filter((entry) => entry.kind !== 'event').map((entry) => {
    const type = entry.kind === 'state' ? `${prefix}ExternalState<${typeName(entry.type)}>`
      : `(${parameters(entry.parameters)}) => ${typeName(entry.returnType)}`;
    return `  ${JSON.stringify(entry.name)}: ${type};`;
  }).join('\n').replace(/\*\//g, '*\\/');
  const propTypes = Object.fromEntries(ir.props.map((prop) => [prop.name, prop.type]));
  const hooks = ir.hooks.map((hook) => `  const ${aliases.get(hook.id)} = () => (${fn(hook.setup, 1)})(${prefix}Owner.def);`).join('\n');
  const helpers = NATIVE_HELPERS.replace(/\bPUI/g, prefix);
  const ownerKey = JSON.stringify(`${prefix}Owner`);
  const propDeclarations = ir.props.map((prop) => `[${JSON.stringify(prop.name)}]: {}`).join(', ');
  const code = `// Editable generated Vue 2.6.14 component options. Profile: vue2-source-v1.
// Inline native-lowering helpers: logical owner, prop resolution, state, semantic templates.
// No Proto-UI Core, Runtime, Hooks or Adapter dependency; helper cost is retained inline.
// Source graph SHA-256: ${ir.source.sha256}

/** @typedef {{
${propsType}
}} GeneratedProps */
/** @typedef {{
${exposesType}
}} GeneratedExposes */
${helpers}

function ${prefix}Setup(${prefix}Owner) {
${hooks}
  return (${fn(ir.setup, 1)})(${prefix}Owner.def);
}

export const ${componentName} = {
  name: ${JSON.stringify(ir.name)},
  inheritAttrs: false,
  props: { ${propDeclarations} },
  beforeCreate() {
    Object.defineProperty(this, ${ownerKey}, { value: ${prefix}CreateOwner(this, ${prefix}Setup, ${JSON.stringify(propTypes)}, ${JSON.stringify(rootTag)}, ${options.autoUpdateOnPropsChange !== false}) });
  },
  created() { this[${ownerKey}].initialize(); },
  mounted() { this[${ownerKey}].hostMounted(); },
  updated() { this[${ownerKey}].afterCommit(); },
  activated() { this[${ownerKey}].activate(); },
  deactivated() { this[${ownerKey}].deactivate(); },
  beforeDestroy() { this[${ownerKey}].dispose(); },
  methods: {
    update() { this[${ownerKey}].update(); },
    getExposes() { return this[${ownerKey}].getExposes(); },
    invokeInCallbackScope(callback) { return this[${ownerKey}].invokePublic(callback); },
  },
  render(h) { return this[${ownerKey}].render(h); },
};
export default ${componentName};
`;
  return { ok: true, value: { code, profile: 'vue2-source-v1',
    dependencies: [{ name: 'vue', version: '2.6.14', role: 'target' }],
    provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'vue2-source-v1' } } };
}

// This is target-specific generated host code, never a shared IR interpreter.
const NATIVE_HELPERS = String.raw`
/**
 * @template T
 * @typedef {{ get: () => T, subscribe: (callback: (event: { type: 'next', prev: T, next: T, reason?: unknown } | { type: 'disconnect', reason: 'unmount' }) => void) => (() => void), unsubscribe: (off: () => void) => void, spec: Readonly<Record<string, unknown>> }} PUIExternalState
 */
const PUIOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function PUIAccepts(type, value) {
  if (typeof type === 'string') return type === 'null' ? value === null : typeof value === type && (type !== 'number' || Number.isFinite(value));
  if (type.kind === 'literal') return Object.is(value, type.value);
  if (type.kind === 'union') return type.members.some((member) => PUIAccepts(member, value));
  if (type.kind === 'array') return Array.isArray(value) && value.every((item) => PUIAccepts(type.element, item));
  return value !== null && typeof value === 'object' && !Array.isArray(value) && type.fields.every((field) =>
    PUIOwn(value, field.name) ? PUIAccepts(field.type, value[field.name]) : field.optional === true);
}
function PUIJson(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  if (Array.isArray(value) && (Object.keys(value).length !== value.length || !Object.keys(value).every((key) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length))) return false;
  seen.add(value);
  const valid = Object.values(value).every((item) => PUIJson(item, seen));
  seen.delete(value);
  return valid;
}
function PUIElement(tag, a, b) {
  const props = a !== null && typeof a === 'object' && !Array.isArray(a) && !PUIOwn(a, 'tag') && !PUIOwn(a, 'slot');
  const children = arguments.length > 2 ? b : props ? null : a;
  return Object.freeze({ tag, children });
}
function PUIChildren(value, h, vm, slots) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((item) => PUIChildren(item, h, vm, slots));
  if (typeof value === 'string' || typeof value === 'number') return [value];
  if (typeof value !== 'object') throw new TypeError('[Vue2 native] template children must be text, elements, slots or null.');
  if (value.slot) {
    if (slots.used) throw new Error('[Vue2 native] only one default slot is supported.');
    slots.used = true;
    const scoped = vm.$scopedSlots && vm.$scopedSlots.default;
    const nodes = scoped ? scoped({}) : vm.$slots && vm.$slots.default;
    return nodes ? Array.isArray(nodes) ? nodes : [nodes] : [];
  }
  if (typeof value.tag !== 'string') throw new TypeError('[Vue2 native] invalid semantic element.');
  // Vue2's pre flag prevents a registered component from hijacking a semantic DOM tag.
  return [h(value.tag, { pre: true }, PUIChildren(value.children, h, vm, slots))];
}
function PUICreateOwner(vm, setup, types, rootTag, autoUpdate) {
  let phase = 'setup';
  let terminal = false;
  let disposed = false;
  let hydrated = false;
  let nativeMounted = false;
  let hostActive = true;
  let present = true;
  let viewActive = false;
  let epoch = 0;
  let revision = 0;
  let commitVersion = 0;
  let queued = false;
  let pending = null;
  let renderedCommit = null;
  let template = null;
  let renderFunction;
  let unwatch;
  let raw = Object.freeze({});
  let resolved = Object.freeze({});
  let previousValid = Object.create(null);
  let specs = Object.create(null);
  const defaults = [];
  const watchers = [];
  const states = [];
  const exposed = Object.create(null);
  const eventDeclarations = Object.create(null);
  const lifecycle = { created: [], mounted: [], updated: [], unmounted: [], beforeDispose: [] };
  const notifications = [];
  let notifying = false;
  let dispatchingProps = false;
  const alive = () => { if (disposed) throw new Error('[Vue2 native] logical instance has been disposed.'); };
  const publicAlive = () => { if (terminal) throw new Error('[Vue2 native] exposed target has been terminally invalidated.'); };
  const callback = () => { alive(); if (phase !== 'callback') throw new Error('[Vue2 native] mutation requires callback scope.'); };
  const setupOnly = () => { alive(); if (phase !== 'setup') throw new Error('[Vue2 native] declaration requires setup scope.'); };
  const hostRaw = () => {
    // Full snapshots preserve omission and explicit undefined. Vue Boolean casting and
    // default materialization never participate in the semantic prop contract.
    const out = Object.create(null);
    const input = { ...(vm.$attrs || {}), ...((vm.$options && vm.$options.propsData) || {}) };
    const provided = (vm.$options && vm.$options.propsData) || {};
    for (const key of Object.keys(types)) {
      const hostKey = key.replace(/-(\w)/g, (_match, letter) => letter.toUpperCase());
      if (PUIOwn(provided, hostKey)) input[key] = provided[hostKey];
    }
    for (const key of Object.keys(input)) out[key] = input[key] === undefined ? null : input[key];
    return Object.freeze(out);
  };
  const same = (a, b) => {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => PUIOwn(b, key) && Object.is(a[key], b[key]));
  };
  const validValue = (key, value) => {
    const spec = specs[key];
    if (!PUIJson(value) || !PUIAccepts(types[key], value)) return false;
    if (spec.type === 'enum' && !spec.options.includes(value)) return false;
    return !spec.range || typeof value === 'number' && value >= (spec.range.min ?? -Infinity) && value <= (spec.range.max ?? Infinity);
  };
  const resolveProps = (input, strict) => {
    const out = Object.create(null);
    const nextValid = { ...previousValid };
    const meta = { providedKeys: [], emptyKeys: [], invalidKeys: [], usedFallbackKeys: [], acceptedEmptyKeys: [] };
    for (const key of Object.keys(specs)) {
      const spec = specs[key];
      const provided = PUIOwn(input, key);
      const value = input[key];
      const empty = spec.empty ?? 'fallback';
      if (provided) meta.providedKeys.push(key);
      if (provided && value !== null && validValue(key, value)) {
        out[key] = value; nextValid[key] = value; continue;
      }
      if (provided && value === null) {
        meta.emptyKeys.push(key);
        if (empty === 'accept') { out[key] = null; meta.acceptedEmptyKeys.push(key); continue; }
      } else if (provided) meta.invalidKeys.push(key);
      let found = false;
      let selected = null;
      let usedDefault = true;
      const take = (candidate, fromDefault) => {
        if (found || candidate === undefined || strict && empty === 'error' && candidate === null) return;
        if (candidate !== null && !validValue(key, candidate)) return;
        found = true; selected = candidate; usedDefault = fromDefault;
      };
      if (provided && PUIOwn(previousValid, key)) take(previousValid[key], false);
      for (const layer of defaults) if (PUIOwn(layer, key)) take(layer[key], true);
      if (PUIOwn(spec, 'default')) take(spec.default, true);
      if (!found && strict && empty === 'error') throw new Error('[Vue2 native] prop ' + key + ' requires a non-empty valid value or fallback.');
      out[key] = selected;
      if (usedDefault) meta.usedFallbackKeys.push(key);
      if (provided && selected !== null) nextValid[key] = selected;
    }
    previousValid = nextValid;
    return { snapshot: Object.freeze(out), meta };
  };
  const invoke = (fn, sync = true) => {
    alive();
    const previousPhase = phase;
    phase = 'callback';
    try { if (sync && !terminal) syncHost(false); return fn(); }
    finally { phase = previousPhase; }
  };
  const syncHost = (request) => {
    if (terminal) return;
    const nextRaw = hostRaw();
    if (hydrated && same(raw, nextRaw)) return;
    const previous = resolved;
    const next = resolveProps(nextRaw, true);
    raw = nextRaw; resolved = next.snapshot;
    if (!hydrated) { hydrated = true; return; }
    const changedKeys = Object.keys(specs).filter((key) => !Object.is(previous[key], resolved[key]));
    if (changedKeys.length && !dispatchingProps) {
      dispatchingProps = true;
      try {
        invoke(() => {
          for (const watch of watchers.slice()) {
            const selectedKeys = watch.keys.filter((key) => changedKeys.includes(key));
            if (watch.active && selectedKeys.length) watch.fn(run, resolved, previous, { ...next.meta, changedKeys: selectedKeys });
          }
        }, false);
      } finally { dispatchingProps = false; }
    }
    if (request && autoUpdate) update();
  };
  const renderSemantic = () => {
    const previousPhase = phase;
    phase = 'render';
    try { template = renderFunction(renderer); }
    finally { phase = previousPhase; }
  };
  const force = () => { if (!terminal && nativeMounted) vm.$forceUpdate(); };
  const update = () => {
    if (terminal) return;
    invoke(() => {}, true);
    if (!nativeMounted || !hostActive || !present || !viewActive) return;
    if (pending) { queued = true; return; }
    renderSemantic();
    pending = { epoch, revision: ++revision, kind: 'update' };
    force();
  };
  const setPresent = (next) => {
    callback();
    if (terminal) throw new Error('[Vue2 native] presence is locked for terminal disposal.');
    if (present === next) return;
    present = next; ++epoch; pending = null; renderedCommit = null; queued = false;
    // A fresh mount always re-renders retained logical state. A canceled detach is
    // still a presence request, not a React-style reactive state write.
    if (next && nativeMounted && hostActive && viewActive) renderSemantic();
    force();
  };
  const run = {
    update: () => { callback(); update(); },
    props: { get: () => { alive(); return resolved; } },
    lifecycle: { setPresent },
    expose: { emit: (key, payload, options) => {
      callback();
      if (!PUIOwn(eventDeclarations, key)) throw new Error('[Vue2 native] undeclared expose event: ' + key);
      const listener = vm.$attrs && vm.$attrs['on' + key[0].toUpperCase() + key.slice(1)];
      // Host sink failures do not re-enter authored callbacks, matching the Vue2 sink.
      try { if (typeof listener === 'function') listener(payload, options); } catch {}
      try { vm.$emit(key, payload, options); } catch {}
    } },
  };
  const renderer = { el: PUIElement, slot: () => Object.freeze({ slot: true }),
    read: { props: { get: () => { alive(); return resolved; } } } };
  const createState = (kind, key, initial, configuration = {}) => {
    setupOnly();
    const spec = Object.freeze({ ...configuration, kind });
    const check = (value, initialValue = false) => {
      const expected = kind === 'bool' ? 'boolean' : kind === 'string' ? 'string' : 'number';
      if (typeof value !== expected || expected === 'number' && !Number.isFinite(value)) throw new TypeError('[Vue2 native] invalid state value: ' + key);
      if (spec.options && spec.options.length && !spec.options.includes(value)) throw new Error('[Vue2 native] state value not in options: ' + key);
      if (kind === 'number.range' && initialValue && spec.clamp) value = Math.min(spec.max, Math.max(spec.min, value));
      if (!(kind === 'number.discrete' && spec.options && spec.options.length) && (spec.min !== undefined && value < spec.min || spec.max !== undefined && value > spec.max)) throw new Error('[Vue2 native] state value out of range: ' + key);
      if (kind === 'number.discrete' && !(spec.options && spec.options.length) && spec.step > 0 && !Number.isInteger((value - (spec.min ?? 0)) / spec.step)) throw new Error('[Vue2 native] state value violates step: ' + key);
      return value;
    };
    let value = check(initial, true);
    const subscribers = new Set();
    const handle = {
      get: () => { alive(); return value; },
      set: (next, reason) => {
        callback();
        next = check(next);
        if (Object.is(value, next)) return;
        const previous = value; value = next;
        const event = { type: 'next', prev: previous, next, reason };
        notifications.push(() => { for (const subscriber of Array.from(subscribers)) if (subscribers.has(subscriber)) subscriber(event); });
        if (notifying) return;
        notifying = true;
        try { while (notifications.length) notifications.shift()(); }
        finally { notifying = false; }
      },
      external: {
        get: () => { publicAlive(); return handle.get(); },
        subscribe: (fn) => { publicAlive(); subscribers.add(fn); return () => subscribers.delete(fn); },
        unsubscribe: (off) => { publicAlive(); if (typeof off === 'function') off(); },
        spec,
      },
      dispose: () => {
        try { for (const fn of Array.from(subscribers)) fn({ type: 'disconnect', reason: 'unmount' }); }
        finally { subscribers.clear(); }
      },
    };
    states.push(handle);
    return handle;
  };
  const defineProps = (input) => {
    setupOnly();
    const next = { ...specs };
    const rank = { accept: 0, fallback: 1, error: 2 };
    for (const key of Object.keys(input)) {
      const spec = input[key];
      if (!spec || !['boolean', 'number', 'string', 'object', 'any', 'enum'].includes(spec.type)) throw new Error('[Vue2 native] invalid prop declaration: ' + key);
      if (spec.empty !== undefined && !PUIOwn(rank, spec.empty)) throw new Error('[Vue2 native] invalid empty behavior: ' + key);
      if (spec.type === 'enum' && (!Array.isArray(spec.options) || !spec.options.length || !spec.options.every((value) => typeof value === 'string'))) throw new Error('[Vue2 native] invalid enum options: ' + key);
      if (spec.type !== 'enum' && PUIOwn(spec, 'options')) throw new Error('[Vue2 native] only enum props accept options: ' + key);
      if (PUIOwn(spec, 'default') && !PUIJson(spec.default)) throw new Error('[Vue2 native] non-JSON prop default: ' + key);
      const prior = next[key];
      if (prior) {
        if (prior.type !== spec.type || PUIOwn(spec, 'empty') && rank[spec.empty] > rank[prior.empty ?? 'fallback']) throw new Error('[Vue2 native] conflicting prop declaration: ' + key);
        if (prior.options && !prior.options.every((value) => spec.options && spec.options.includes(value))) throw new Error('[Vue2 native] prop options cannot narrow: ' + key);
        if (prior.range && spec.range && ((spec.range.min ?? -Infinity) > (prior.range.min ?? -Infinity) || (spec.range.max ?? Infinity) < (prior.range.max ?? Infinity))) throw new Error('[Vue2 native] prop range cannot narrow: ' + key);
        next[key] = { ...prior, ...spec, empty: prior.empty ?? 'fallback', range: spec.range ?? prior.range };
        if (PUIOwn(prior, 'default')) next[key].default = prior.default;
      } else next[key] = { ...spec };
    }
    specs = next; resolved = resolveProps(raw, false).snapshot;
  };
  const def = {
    props: {
      define: defineProps,
      setDefaults: (layer) => {
        setupOnly();
        for (const key of Object.keys(layer)) if (!PUIOwn(specs, key) || !PUIJson(layer[key])) throw new Error('[Vue2 native] invalid prop default: ' + key);
        defaults.unshift({ ...layer }); resolved = resolveProps(raw, false).snapshot;
      },
      watch: (keys, fn) => {
        setupOnly();
        if (!keys.length || keys.some((key) => !PUIOwn(specs, key))) throw new Error('[Vue2 native] watch requires declared prop keys.');
        const watch = { keys: [...keys], fn, active: true }; watchers.push(watch);
        return () => { watch.active = false; };
      },
    },
    state: {
      bool: (key, value) => createState('bool', key, value),
      string: (key, value, spec) => createState('string', key, value, spec),
      numberDiscrete: (key, value, spec) => createState('number.discrete', key, value, spec),
      numberRange: (key, value, spec) => createState('number.range', key, value, spec),
    },
    expose: {
      state: (key, handle) => { setupOnly(); exposed[key] = handle.external; },
      method: (key, fn) => { setupOnly(); exposed[key] = (...args) => { publicAlive(); return invoke(() => fn(...args)); }; },
      event: (key, spec) => { setupOnly(); eventDeclarations[key] = spec; },
    },
    lifecycle: Object.fromEntries(Object.keys(lifecycle).map((key) => ['on' + key[0].toUpperCase() + key.slice(1), (fn) => { setupOnly(); lifecycle[key].push(fn); }])),
  };
  const fire = (kind) => invoke(() => { for (const fn of lifecycle[kind]) fn(run); }, !terminal);
  const detach = () => {
    if (!viewActive) return;
    viewActive = false; pending = null; queued = false;
    fire('unmounted');
  };
  const afterCommit = () => {
    if (terminal) return;
    syncHost(true);
    const commit = renderedCommit;
    if (!commit) return;
    renderedCommit = null;
    const target = vm.$el;
    // Removal has already committed when Vue calls updated. Do not postpone its
    // unmount notification into a tick which may belong to a replacement view.
    if (!commit.present && commit.vnode.elm === target) { detach(); return; }
    vm.$nextTick(() => {
      if (terminal || commit.epoch !== epoch || commit.version !== commitVersion || vm.$el !== target || commit.vnode.elm !== target) return;
      if (!present || !hostActive) return;
      const kind = commit.kind;
      if (kind === 'mount' && !viewActive) {
        viewActive = true;
        fire('mounted');
      } else if (kind === 'update' && viewActive && pending && pending.revision === commit.revision) {
        pending = null;
        const again = queued; queued = false;
        fire('updated');
        if (again && present && viewActive && !terminal && !pending) update();
      }
    });
  };
  const owner = {
    def,
    initialize() {
      renderFunction = setup(owner);
      if (typeof renderFunction !== 'function') renderFunction = (renderer) => renderer.slot();
      phase = 'idle';
      syncHost(false);
      fire('created');
      unwatch = vm.$watch(() => hostRaw(), () => syncHost(true), { deep: true });
    },
    hostMounted() { nativeMounted = true; afterCommit(); },
    afterCommit,
    render(h) {
      if (terminal || !present || !hostActive) {
        const vnode = h();
        renderedCommit = { epoch, version: ++commitVersion, present: false, vnode, kind: 'detach' };
        return vnode;
      }
      if (!viewActive) renderSemantic();
      const vnode = h(rootTag, { pre: true, attrs: { 'data-pui-root': '' } }, PUIChildren(template, h, vm, { used: false }));
      renderedCommit = { epoch, version: ++commitVersion, present: true, vnode, kind: !viewActive ? 'mount' : pending ? 'update' : 'none', revision: pending && pending.revision };
      return vnode;
    },
    update,
    getExposes() { if (terminal) return {}; return { ...exposed }; },
    invokePublic(fn) { publicAlive(); return invoke(fn); },
    deactivate() {
      if (terminal || !hostActive) return;
      hostActive = false; ++epoch; renderedCommit = null; pending = null; queued = false;
      detach();
    },
    activate() {
      if (terminal || hostActive) return;
      hostActive = true; ++epoch; pending = null; renderedCommit = null;
      vm.$forceUpdate();
    },
    dispose() {
      if (terminal) return;
      terminal = true; ++epoch; renderedCommit = null; pending = null; queued = false;
      unwatch?.(); unwatch = undefined;
      let failure;
      try { detach(); } catch (error) { failure = error; }
      try { fire('beforeDispose'); } catch (error) { failure ??= error; }
      for (const state of states) {
        try { state.dispose(); } catch (error) { failure ??= error; }
      }
      disposed = true; phase = 'idle';
      watchers.length = 0; notifications.length = 0; states.length = 0; defaults.length = 0;
      for (const key of Object.keys(lifecycle)) lifecycle[key].length = 0;
      for (const key of Object.keys(exposed)) delete exposed[key];
      for (const key of Object.keys(eventDeclarations)) delete eventDeclarations[key];
      specs = Object.create(null); previousValid = Object.create(null); raw = resolved = Object.freeze({}); template = renderFunction = null;
      if (failure) throw failure;
    },
  };
  return owner;
}
`;
