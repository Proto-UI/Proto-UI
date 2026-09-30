import { dataTypeEqual, formatDataType } from './data-types';
import type { DataType } from './data-types';
import { validateIR, validIdentifier } from './ir-validation';
import { FOCUS_OPTIONS_TYPE, OPERATION_RULES } from './operations';
import { checkTargetOperations, resolveTargetProfile } from './targets';
import { isDataValueType } from './ir';
import { buildNativeContextArtifacts, emitNativeContextValidation } from './native-context';
import { emitNativeStyleHandle, emitNativeRule, nativeStyleArtifact } from './native-style';
import { nativeInteractionArtifact } from './native-interaction';
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
  const interaction = admitted.value.operations.some((operation) =>
    operation.startsWith('hook.') || operation.startsWith('event.') ||
    operation.startsWith('focus.') || operation.startsWith('accessible.'));
  const unsupportedTemplates: ExpressionIR[] = [];
  function inspectTemplate(value: unknown): void {
    if (Array.isArray(value)) for (const item of value) inspectTemplate(item);
    else if (value !== null && typeof value === 'object') {
      const node = value as ExpressionIR;
      if (node.kind === 'function' && !reachedFunctions.has(node.function)) return;
      if (node.kind === 'operation' && node.operation === 'render.el') {
        const props = node.arguments[1];
        if (props?.kind === 'record' && props.entries.length &&
            props.entries.some((entry) => entry.key !== 'style' || entry.value.type !== 'style-handle'))
          unsupportedTemplates.push(node);
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
      message: 'react-dom-source-v1 template props support only one static tw handle under style.', span: node.span })),
  };
  const componentName = options.componentName ?? 'CompiledComponent';
  const reservedNames: Record<string, true> = {
    GeneratedProps: true, GeneratedExposes: true, GeneratedHandle: true, GeneratedComponentProps: true,
    Object: true, Array: true, Number: true, Math: true, Set: true, WeakMap: true, Reflect: true,
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
  const contextArtifacts = buildNativeContextArtifacts(ir);
  const contextKeys = new Map(ir.contextKeys.map((key, index) => [key.id, `${p}ContextKey${index}`]));
  const contextImports = ir.contextKeys.map((key) =>
    `import { key as ${contextKeys.get(key.id)} } from ${JSON.stringify(contextArtifacts.keys.get(key.id)!.file.replace(/\.ts$/, ''))};`
  ).join('\n');
  const contextValidation = emitNativeContextValidation(ir, contextKeys, `${p}Accepts`);
  const transportFile = '.proto-ui/context/react-v1.ts';

  function typeName(type: ValueType): string {
    if (typeof type !== 'string') return interaction && dataTypeEqual(type, FOCUS_OPTIONS_TYPE)
      ? `${p}NativeFocusOptions` : formatDataType(type as DataType);
    if (type === 'def') return `typeof ${p}Def`;
    if (type === 'run') return `${p}Run`;
    if (type === 'render') return `typeof ${p}Renderer`;
    if (type === 'props') return `${p}ResolvedProps`;
    if (type === 'focus') return `${p}NativeFocus`;
    if (type === 'accessible') return `${p}NativeAccessible`;
    if (type === 'event') return `${p}NativeInput`;
    if (type === 'host-event') return 'Event';
    if (type === 'observed:boolean') return `${p}NativeObservedState<boolean>`;
    if (type.startsWith('state:')) return `${p}State<${type.slice(6)}>`;
    if (['boolean', 'number', 'string', 'null', 'void', 'unknown'].includes(type)) return type;
    if (type === 'array') return 'readonly unknown[]';
    if (type === 'record') return 'Readonly<Record<string, unknown>>';
    if (type === 'template') return `${p}React.ReactNode`;
    if (type === 'style-handle') return `${p}NativeStyleHandle`;
    if (type === 'template-props') return `{ readonly style?: ${p}NativeStyleHandle }`;
    if (type === 'rule-handle') return `${p}NativeRuleHandle`;
    if (type === 'style-disposer') return '() => void';
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
      case 'context-key': return contextKeys.get(value.keyId)!;
      case 'style-handle': return emitNativeStyleHandle(value.handle);
      case 'rule': return emitNativeRule(value, (item) => expression(item, depth), `${p}Style`, 'resolved');
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
        if (value.operation.startsWith('hook.'))
          return `${p}Interaction.${rule.path}(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
        const type = ['context.read', 'context.tryRead', 'render.read.context.read', 'render.read.context.tryRead'].includes(value.operation)
          ? `<${typeName(value.type)}>` : '';
        return `${expression(value.receiver!, depth)}.${rule.path}${type}(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
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
// Inline owner lowering and emitted shared checked-data/Context helpers v1; no Proto-UI Runtime/Core/Adapter dependencies.
// Source graph SHA-256: ${ir.source.sha256}
import * as ${p}React from 'react';
import { createContextScope as ${p}CreateContextScope, acceptsContextValue as ${p}Accepts } from ${JSON.stringify(contextArtifacts.scopeFile.replace(/\.ts$/, ''))};
import type { ContextScope as ${p}ContextScope } from ${JSON.stringify(contextArtifacts.scopeFile.replace(/\.ts$/, ''))};
import { ContextTransport as ${p}ContextTransport } from './.proto-ui/context/react-v1';
import { createNativeStyle as ${p}CreateNativeStyle, templateStyleTokens as ${p}TemplateStyleTokens, type NativeStyle as ${p}NativeStyle, type NativeStyleHandle as ${p}NativeStyleHandle, type NativeRuleHandle as ${p}NativeRuleHandle } from './.proto-ui/style/native-v1';
${interaction ? `import { createNativeInteraction as ${p}CreateNativeInteraction, type NativeInteraction as ${p}NativeInteraction, type NativeFocus as ${p}NativeFocus, type NativeAccessible as ${p}NativeAccessible, type NativeObservedState as ${p}NativeObservedState, type NativeInput as ${p}NativeInput, type NativeFocusOptions as ${p}NativeFocusOptions } from './.proto-ui/interaction/native-v1';` : ''}
${contextImports}

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
type ${p}StateSpec = { kind: 'bool' | 'string' | 'number.discrete' | 'number.range'; options?: readonly (string | number)[]; min?: number; max?: number; step?: number; clamp?: boolean };
type ${p}DataSchema = string | { kind: string; fields?: readonly { name: string; type: ${p}DataSchema; optional?: boolean }[]; element?: ${p}DataSchema; members?: readonly ${p}DataSchema[]; value?: unknown };
type ${p}PropSpec = { type: ${p}DataSchema; default?: unknown; empty?: 'accept' | 'fallback' | 'error'; options?: readonly string[]; range?: { min?: number; max?: number } };
type ${p}Run = {
  update(): void;
  feedback: { style: Pick<${p}NativeStyle, 'patch' | 'suppress' | 'clearPatch'> };
  props: { get(): ${p}ResolvedProps; getRaw(): Readonly<Record<string, unknown>>; isProvided(key: string): boolean };
  context: {
    read<T>(key: object): T;
    tryRead<T>(key: object): T | null;
    update<T>(key: object, next: T | ((prev: T) => T)): void;
    tryUpdate<T>(key: object, next: T | ((prev: T) => T)): boolean;
  };
  expose: { emit(key: string, payload?: unknown, options?: Record<string, unknown>): void };
  lifecycle: { setPresent(present: boolean): void };
};
type ${p}Frame = { revision: number; epoch: number; kind: 'mount' | 'update' | 'detach'; node: ${p}React.ReactNode };
type ${p}Owner = {
  handle: GeneratedHandle;
  scope: ${p}ContextScope;
  bindRoot(root: HTMLDivElement | null): void;
  connect(): void;
${interaction ? '  connectView(): void;\n  disconnectView(): void;\n' : ''}  start(): void;
  applyProps(props: GeneratedComponentProps): void;
  accept(frame: ${p}Frame): void;
  disconnect(): void;
};

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

function ${p}CreateOwner(initial: GeneratedComponentProps, publish: (frame: ${p}Frame) => void, getParent: () => ${p}ContextScope | null): ${p}Owner {
  let phase: 'setup' | 'callback' | 'render' | 'idle' = 'setup';
  let lifetime: 'alive' | 'disposing' | 'disposed' = 'alive';
  let connected = true;
  let cleanupVersion = 0;
  let desiredPresent = true;
  let mounted = false;
${interaction ? '  let viewConnected = false;\n' : ''}  let epoch = 0;
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
  let root: HTMLDivElement | null = null;
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
  const context = ${p}CreateContextScope({
    getParent, isAlive: () => lifetime !== 'disposed', invoke,
    validate: ${contextValidation},
  });
  function projectStyle(tokens: readonly string[]) {
    if (!root) return;
    if (tokens.length) root.setAttribute('data-pui-style', tokens.join(' '));
    else root.removeAttribute('data-pui-style');
  }
  const ${p}Style = ${p}CreateNativeStyle({
    ensureSetup: () => ensurePhase('setup'),
    ensureRuntime: () => ensurePhase('callback'),
    isAlive: () => lifetime !== 'disposed',
    project: projectStyle,
  });
  function dispatch(list: readonly ((run: ${p}Run) => void)[]) {
    invoke(() => { for (const callback of list) callback(${p}RunHandle); });
  }
  function schedule() {
    if (scheduled || callbackDepth || !connected || lifetime !== 'alive') return;
    if (!updateQueued && desiredPresent === mounted && !(!desiredPresent && root) && !(latest && latest.revision > acceptedRevision)) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!connected || lifetime !== 'alive') return;
      if (latest && latest.revision > acceptedRevision) return;
      if (!desiredPresent) {
        if (mounted || root) deliver('detach');
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
    let props: Record<string, unknown> = {};
    if (args.length === 1) {
      const argument = args[0];
      if (argument !== null && typeof argument === 'object' && !Array.isArray(argument) && !${p}React.isValidElement(argument)) {
        props = argument as Record<string, unknown>;
      } else children = argument;
    } else if (args.length === 2) {
      if (!args[0] || typeof args[0] !== 'object' || Array.isArray(args[0]))
        throw new Error('[Template] native template props must be a record.');
      props = args[0] as Record<string, unknown>;
      children = args[1];
    }
    if (Object.keys(props).some((key) => key !== 'style'))
      throw new Error('[Template] native template props support only style.');
    const tokens = Object.hasOwn(props, 'style') ? ${p}TemplateStyleTokens(props.style as ${p}NativeStyleHandle) : '';
    const normalized = normalize(children);
    return ${p}React.createElement(tag, { key: elementSequence++, ...(tokens ? { 'data-pui-style': tokens } : {}) }, ...(Array.isArray(normalized) ? normalized : [normalized]));
  }
  const ${p}Renderer = {
    read: Object.freeze({
      props: Object.freeze({
        get() { ensurePhase('render'); return resolved; },
        getRaw() { ensurePhase('render'); return raw; },
        isProvided(key: string) { ensurePhase('render'); return Object.hasOwn(raw, key); },
      }),
      context: Object.freeze({
        read<T>(key: object): T { ensurePhase('render'); return context.read<T>(key); },
        tryRead<T>(key: object): T | null { ensurePhase('render'); return context.tryRead<T>(key); },
      }),
    }),
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
    if (typeof name !== 'string' || name.length === 0 || stateNames.has(name)) throw new Error('[State] illegal or duplicate state name: ' + name);
    spec = Object.freeze({ ...spec, ...(spec.options ? { options: Object.freeze([...spec.options]) } : {}) });
    const type = spec.kind === 'bool' ? 'boolean' : spec.kind === 'string' ? 'string' : 'number';
    if (spec.options?.some((option) => typeof option !== type || typeof option === 'number' && !Number.isFinite(option)))
      throw new Error('[State] invalid state options: ' + name);
    if (spec.kind === 'number.range' && (!Number.isFinite(spec.min) || !Number.isFinite(spec.max))
      || spec.min !== undefined && !Number.isFinite(spec.min) || spec.max !== undefined && !Number.isFinite(spec.max)
      || spec.min !== undefined && spec.max !== undefined && spec.min > spec.max
      || spec.step !== undefined && !Number.isFinite(spec.step))
      throw new Error('[State] invalid numeric domain: ' + name);
    function validate(next: T) {
      if (typeof next !== type || typeof next === 'number' && !Number.isFinite(next))
        throw new TypeError('[State] invalid state value: ' + name);
      if (spec.options?.length && (spec.kind === 'string' || spec.kind === 'number.discrete')) {
        if (!spec.options.includes(next as string | number)) throw new Error('[State] state value outside options: ' + name);
        return;
      }
      if (typeof next !== 'number') return;
      if (next < (spec.min ?? -Infinity) || next > (spec.max ?? Infinity))
        throw new Error('[State] state value outside range: ' + name);
      if (spec.kind === 'number.discrete' && spec.step !== undefined && spec.step > 0
        && !Number.isInteger((next - (spec.min ?? 0)) / spec.step))
        throw new Error('[State] state value violates step: ' + name);
    }
    let value = initialValue;
    // Core range clamping normalizes definition defaults only, never callback writes.
    if (spec.kind === 'number.range' && spec.clamp && typeof value === 'number' && Number.isFinite(value))
      value = Math.min(spec.max!, Math.max(spec.min!, value)) as T;
    validate(value);
    stateNames.add(name);
    const subscribers = new Set<(event: ${p}StateEvent<T>) => void>();
    stateSubscribers.add(subscribers as Set<(event: ${p}StateEvent<unknown>) => void>);
    const state = {
      get() { ensureAlive(); return value; },
      set(next: T, reason?: unknown) {
        ensurePhase('callback');
        validate(next);
        if (Object.is(value, next)) return;
        const event: ${p}StateEvent<T> = { type: 'next', prev: value, next, reason };
        value = next;
        ${p}Style.refresh();
${interaction ? `        ${p}Interaction.refresh();\n` : ''}        pendingStateEvents.push(() => { for (const callback of [...subscribers]) callback(event); });
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
${interaction ? `  const observedStateCleanups: (() => void)[] = [];
  function registerObservedState(state: ${p}NativeObservedState<boolean>) {
    const subscribers = new Set<(event: ${p}StateEvent<boolean>) => void>();
    stateSubscribers.add(subscribers as Set<(event: ${p}StateEvent<unknown>) => void>);
    observedStateCleanups.push(state.subscribe((event) => {
      ${p}Style.refresh();
      ${p}Interaction.refresh();
      pendingStateEvents.push(() => { for (const callback of [...subscribers]) callback(event); });
      if (emittingState) return;
      emittingState = true;
      try { while (pendingStateEvents.length) pendingStateEvents.shift()!(); }
      finally { emittingState = false; }
    }));
    const external: ${p}ExternalState<boolean> = Object.freeze({
      get() { ensureExternal(); return state.get(); },
      subscribe(callback: (event: ${p}StateEvent<boolean>) => void) {
        ensureExternal(); subscribers.add(callback); return () => { subscribers.delete(callback); };
      },
      unsubscribe(off: () => void) { off(); },
      spec: Object.freeze({ kind: 'bool' as const }),
    });
    externalStates.set(state, external);
  }
  const ${p}Interaction: ${p}NativeInteraction<${p}Run> = ${p}CreateNativeInteraction<${p}Run>({
    ensureSetup: () => ensurePhase('setup'),
    ensureRuntime: () => ensurePhase('callback'),
    ensureEvent: () => ensurePhase('callback'),
    isAlive: () => lifetime !== 'disposed',
    isReady: () => phase !== 'setup',
    invoke,
    getRun: () => ${p}RunHandle,
    getResolvedProps: () => resolved,
    getRoot: () => viewConnected ? root : null,
    registerObservedState,
  });
  function disposeInteraction() {
    try { ${p}Interaction.dispose(); }
    finally { for (const off of observedStateCleanups.splice(0)) off(); }
  }
` : ''}  const ${p}RunHandle: ${p}Run = {
    feedback: { style: ${p}Style },
    update() {
      ensurePhase('callback');
      if (lifetime !== 'alive') return;
      dirty = true;
      if (desiredPresent && mounted) updateQueued = true;
      schedule();
    },
    props: {
      get() { ensureAlive(); return resolved; },
      getRaw() { ensureAlive(); return raw; },
      isProvided(key: string) { ensureAlive(); return Object.hasOwn(raw, key); },
    },
    context: Object.freeze({
      read<T>(key: object): T { ensurePhase('callback'); return context.read<T>(key); },
      tryRead<T>(key: object): T | null { ensurePhase('callback'); return context.tryRead<T>(key); },
      update<T>(key: object, next: T | ((prev: T) => T)) { ensurePhase('callback'); context.update(key, next); },
      tryUpdate<T>(key: object, next: T | ((prev: T) => T)) { ensurePhase('callback'); return context.tryUpdate(key, next); },
    }),
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
${interaction ? `    event: ${p}Interaction.event,\n` : ''}    feedback: { style: { use: ${p}Style.use } },
    context: Object.freeze({
      provide<T>(key: object, value: T) { ensurePhase('setup'); context.provide(key, value); },
      subscribe<T>(key: object, callback?: (run: ${p}Run, next: T, prev: T) => void) {
        ensurePhase('setup');
        return context.subscribe<T>(key, 'required', callback ? (next, prev) => callback(${p}RunHandle, next as T, prev as T) : undefined);
      },
      trySubscribe<T>(key: object, callback?: (run: ${p}Run, next: T | null, prev: T | null) => void) {
        ensurePhase('setup');
        return context.subscribe<T>(key, 'optional', callback ? (next, prev) => callback(${p}RunHandle, next, prev) : undefined);
      },
    }),
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
${interaction ? `        ${p}Interaction.refresh();\n` : ''}      },
      setDefaults(partial: Record<string, unknown>) {
        ensurePhase('setup');
        for (const key of Object.keys(partial)) if (!Object.hasOwn(specs, key)) throw new Error('[Props] undeclared default key: ' + key);
        defaults.unshift({ ...partial });
        resolved = ${p}ResolveProps(specs, defaults, previousValid, raw, false);
${interaction ? `        ${p}Interaction.refresh();\n` : ''}      },
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
  let render: (renderer: typeof ${p}Renderer) => unknown;
  try {
    render = (${fn(ir.setup, 1)})(${p}Def) ?? (() => ${p}Renderer.slot());
    if (typeof render !== 'function') throw new Error('[Prototype] setup must return a render function or void.');
  } catch (error) { ${interaction ? 'try { disposeInteraction(); } catch {} ' : ''}${p}Style.dispose(); context.dispose(); throw error; }
  phase = 'idle';
  function applyProps(nextHost: GeneratedComponentProps) {
    ensureAlive();
    hostProps = nextHost;
    const nextRaw: Record<string, unknown> = Object.create(null);
    for (const [key, value] of Object.entries(nextHost)) {
      if (key === 'children' || key.startsWith('on') && typeof value === 'function') continue;
      nextRaw[key] = value;
    }
    if (hydrated && Object.keys(raw).length === Object.keys(nextRaw).length
      && Object.keys(nextRaw).every((key) => Object.hasOwn(raw, key) && Object.is(raw[key], nextRaw[key]))) return;
    const previous = resolved;
    raw = Object.freeze(nextRaw);
    resolved = ${p}ResolveProps(specs, defaults, previousValid, raw, true);
    ${p}Style.refresh();
${interaction ? `    ${p}Interaction.refresh();\n` : ''}    if (!hydrated) { hydrated = true; return; }
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
    scope: context,
    bindRoot(nextRoot) {
      if (root === nextRoot) return;
${interaction ? `      ${p}Interaction.unmount();\n` : ''}      root?.removeAttribute('data-pui-style');
      root = nextRoot;
      if (mounted) projectStyle(${p}Style.tokens());
${interaction ? `      if (mounted && desiredPresent && viewConnected) ${p}Interaction.mount();\n` : ''}    },
    connect() { connected = true; ++cleanupVersion; },
${interaction ? `    connectView() {
      viewConnected = true;
      if (mounted && desiredPresent) ${p}Interaction.mount();
    },
    disconnectView() { viewConnected = false; ${p}Interaction.unmount(); },
` : ''}    start() {
      try { applyProps(initial); dispatch(callbacks.created); schedule(); }
      catch (error) { ${interaction ? 'try { disposeInteraction(); } catch {} ' : ''}${p}Style.dispose(); context.dispose(); lifetime = 'disposed'; connected = false; throw error; }
    },
    applyProps,
    accept(frame: ${p}Frame) {
      if (!connected || lifetime !== 'alive' || frame.revision <= acceptedRevision || frame !== latest) return;
      acceptedRevision = frame.revision;
      if (frame.kind === 'detach') {
${interaction ? `        ${p}Interaction.unmount();\n` : ''}        ${p}Style.unmount();
        if (mounted) { mounted = false; dispatch(callbacks.unmounted); }
      } else if (!desiredPresent) {
        // Physical materialization is not a published mount. Remove the obsolete
        // Root without manufacturing mounted/unmounted for a never-mounted epoch.
      } else if (frame.kind === 'mount') {
        mounted = true;
        ${p}Style.mount();
${interaction ? `        ${p}Interaction.mount();\n` : ''}        dispatch(callbacks.mounted);
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
${interaction ? `        try { ${p}Interaction.unmount(); }
        catch (error) { failure = error; }
` : ''}        try { if (mounted) { mounted = false; ${p}Style.unmount(); dispatch(callbacks.unmounted); } }
        catch (error) { failure ??= error; }
        try { dispatch(callbacks.beforeDispose); }
        catch (error) { failure ??= error; }
        finally {
${interaction ? `          try { disposeInteraction(); } catch (error) { failure ??= error; }
` : ''}          root?.removeAttribute('data-pui-style');
          root = null;
          ${p}Style.dispose();
          context.dispose();
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
  const parentScope = ${p}React.useContext(${p}ContextTransport);
  const parentRef = ${p}React.useRef<${p}ContextScope | null>(null);
  const [frame, setFrame] = ${p}React.useState<${p}Frame | null>(null);
  const bindRoot = ${p}React.useCallback((root: HTMLDivElement | null) => { ownerRef.current?.bindRoot(root); }, []);
  // All irreversible work begins after an accepted shell commit, never during React render.
  ${p}React.useLayoutEffect(() => {
    parentRef.current = parentScope;
    let owner = ownerRef.current;
    if (!owner) {
      owner = ${p}CreateOwner(props, setFrame, () => parentRef.current);
      ownerRef.current = owner;
      owner.start();
    } else owner.connect();
${interaction ? `    owner.connectView();
    return () => { owner.disconnectView(); };
` : ''}  }, []);
  ${p}React.useLayoutEffect(() => { parentRef.current = parentScope; }, [parentScope]);
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
  const view = frame && frame.kind !== 'detach'
    ? ${p}React.createElement('div', { 'data-pui-root': '', ref: bindRoot }, frame.node) : null;
  return ${p}React.createElement(${p}ContextTransport.Provider, { value: ownerRef.current?.scope ?? null }, view);
});
${componentName}.displayName = ${JSON.stringify(ir.name)};
`;
  return {
    ok: true,
    value: {
      code,
      profile: 'react-dom-source-v1',
      supportingFiles: [...contextArtifacts.files, nativeStyleArtifact, ...(interaction ? [nativeInteractionArtifact] : []), {
        path: transportFile, kind: 'source',
        contents: `import { createContext } from 'react';\nimport type { ContextScope } from './scope-v1';\nexport const ContextTransport = createContext<ContextScope | null>(null);\n`,
      }],
      dependencies: selected.value.dependencies.map((dependency) => ({ ...dependency })),
      provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'react-dom-source-v1' },
    },
  };
}
