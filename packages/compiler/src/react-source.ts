import { dataTypeEqual, formatDataType } from './data-types';
import type { DataType } from './data-types';
import { validateIR, validIdentifier } from './ir-validation';
import { FOCUS_OPTIONS_TYPE, OPERATION_RULES } from './operations';
import { checkTargetOperations, resolveTargetProfile } from './targets';
import { isDataValueType, isPublicValueType } from './ir';
import { buildNativeContextArtifacts, emitNativeContextValidation } from './native-context';
import { emitNativeStyleHandle, emitNativeRule, nativeStyleArtifact } from './native-style';
import { nativeInteractionArtifact } from './native-interaction';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';
import { buildNativeStaticDeclarations } from './native-static-declarations';
import { emitReactSSRSupport, reactSSRTransportArtifact } from './react-ssr-source';
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
  options: { componentName?: string; ssr?: boolean } = {}
): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = validated.value;
  const ssr = options.ssr === true;
  const profile = ssr ? 'react-dom-ssr-v1' : 'react-dom-source-v1';
  const selected = resolveTargetProfile('react-dom-source-v1');
  if (!selected.ok) return selected;
  const admitted = checkTargetOperations(ir, selected.value);
  if (!admitted.ok) return admitted;
  const unsupportedMethods = ir.exposes.filter((value) => value.kind === 'method' &&
    !isPublicValueType(value.returnType) || value.kind === 'method' && value.parameters.some(parameter => !isDataValueType(parameter.type)));
  if (unsupportedMethods.length) return {
    ok: false,
    diagnostics: unsupportedMethods.map((value) => ({ code: 'PUI4003', category: 'unsupported-input',
      message: 'react-dom-source-v1 exposed methods require checked serializable parameter and return types, not semantic capabilities or unknown.', span: value.span })),
  };
  const reachedFunctions = new Set(admitted.value.functions);
  const interaction = ir.moduleDeclarations.length > 0 || admitted.value.operations.some((operation) =>
    /^(hook\.|event\.|focus\.|accessible\.|anatomy\.|collection\.|collectionItem\.|boundary\.|hitParticipation\.|positioning\.|overlay\.|scroll\.|textControl\.|imageView\.|transition\.|tableStructure\.)/.test(operation));
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
    console: true,
  };
  if (ssr) Object.assign(reservedNames, {
    AggregateError: true, Map: true, WeakSet: true, GeneratedTemplateProjection: true, GeneratedInitialData: true,
    GeneratedRenderProjection: true, GeneratedHydrationCarrier: true, GeneratedServerResult: true,
    GeneratedHydratedRoot: true, renderGeneratedToString: true, hydrateGeneratedRoot: true,
  });
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
  const staticArtifacts = buildNativeStaticDeclarations(ir.staticDeclarations, ir.moduleDeclarations);
  const staticCapabilities = new Map(ir.staticDeclarations.map((declaration, index) => [declaration.id, `${p}Declaration${index}`]));
  const staticImports = ir.staticDeclarations.map(declaration =>
    `import { declaration as ${staticCapabilities.get(declaration.id)} } from ${JSON.stringify('./' + staticArtifacts.capabilities.get(declaration.id)!.file.replace(/\.ts$/, ''))};`
  ).join('\n');
  const contextKeys = new Map(ir.contextKeys.map((key, index) => [key.id, `${p}ContextKey${index}`]));
  const contextImports = ir.contextKeys.map((key) =>
    `import { key as ${contextKeys.get(key.id)} } from ${JSON.stringify(contextArtifacts.keys.get(key.id)!.file.replace(/\.ts$/, ''))};`
  ).join('\n');
  const contextValidation = emitNativeContextValidation(ir, contextKeys, `${p}Accepts`);
  const transportFile = '.proto-ui/context/react-v1.ts';

  function typeName(type: ValueType): string {
    if (typeof type !== 'string') return interaction && dataTypeEqual(type, FOCUS_OPTIONS_TYPE)
      ? `${p}NativeFocusOptions` : formatDataType(type as DataType);
    if (type.startsWith('nullable:')) return `${typeName(type.slice(9) as ValueType)} | null`;
    if (type.startsWith('optional:')) return `${typeName(type.slice(9) as ValueType)} | undefined`;
    if (type.startsWith('borrowed:')) return `${p}State<${type.slice(9)}> & { watch(callback: (run: ${p}Run, event: ${p}StateEvent<${type.slice(9)}>) => void): () => void }`;
    if (type.startsWith('state-event:')) return `${p}StateEvent<${type.slice(12)}>`;
    if (type.startsWith('state-next:')) return `Extract<${p}StateEvent<${type.slice(11)}>, {type:'next'}>`;
    if (type === 'state-disconnect') return `{type:'disconnect';reason:'unmount'}`;
    if (type === 'def') return `typeof ${p}Def`;
    if (type === 'run') return `${p}Run`;
    if (type === 'render') return `typeof ${p}Renderer`;
    if (type === 'props') return `${p}ResolvedProps`;
    if (type === 'focus') return `${p}NativeFocus`;
    if (type === 'accessible') return `${p}NativeAccessible`;
    if (type === 'event') return `${p}NativeInput`;
    if (type === 'host-event') return 'Event';
    if (type.startsWith('observed:')) return `${p}NativeObservedState<${type.slice(9)}>`;
    if (type.startsWith('state:')) return `${p}State<${type.slice(6)}>`;
    if (['boolean', 'number', 'string', 'null', 'void', 'unknown'].includes(type)) return type;
    if (type === 'array') return 'readonly unknown[]';
    if (type === 'record') return 'Readonly<Record<string, unknown>>';
    if (type === 'template') return `${p}React.ReactNode`;
    if (type === 'style-handle') return `${p}NativeStyleHandle`;
    if (type === 'template-props') return `{ readonly style?: ${p}NativeStyleHandle }`;
    if (type === 'rule-handle') return `${p}NativeRuleHandle`;
    if (type === 'style-disposer') return '() => void';
    if (interaction) return `${p}NativeModuleCapability<${JSON.stringify(type)}, ${p}Run>`;
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
      case 'static-capability': return staticCapabilities.get(value.declarationId)!;
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
        if (rule.path === 'call') return `${expression(value.receiver!, depth)}(${value.arguments.map(item => expression(item, depth)).join(', ')})`;
        if (value.operation === 'host.get') return '(mounted && connected ? (root as HTMLElement) : null)';
        if (value.operation.startsWith('hook.') || value.operation.startsWith('anatomy.'))
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
      : value.kind === 'value' ? typeName(value.type)
      : value.kind === 'event' ? `{ readonly kind: 'event'; readonly payload: ${JSON.stringify(value.payload)} }`
      : `(${parameters(value.parameters)}) => ${typeName(value.returnType)}`;
    return `  ${JSON.stringify(value.name)}: ${type};`;
  }).join('\n');
  const eventProps = ir.exposes.filter((value) => value.kind === 'event').map((value) =>
    `  ${JSON.stringify(`on${value.name.charAt(0).toUpperCase()}${value.name.slice(1)}`)}?: (${value.payload === 'void' ? '' : `payload: ${formatDataType(value.payload as DataType)}`}) => void;`
  ).join('\n');
  const methodSchemas = ir.exposes.filter((value) => value.kind === 'method').map((value) =>
    `    ${JSON.stringify(value.name)}: { parameters: ${JSON.stringify(value.parameters.map((parameter) => ({ type: parameter.type, ...(parameter.optional ? { optional: true } : {}) })))}, result: ${JSON.stringify(isDataValueType(value.returnType) ? value.returnType : null)} },`
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

  const code = `// Editable generated React DOM source. Profile: ${profile}.
// Inline owner lowering and emitted shared checked-data/Context helpers v1; no Proto-UI Runtime/Core/Adapter dependencies.
// Source graph SHA-256: ${ir.source.sha256}
import * as ${p}React from 'react';
${interaction ? `import { createPortal as ${p}CreatePortal } from 'react-dom';` : ''}
${ssr ? `import { renderToString as ${p}RenderToString } from 'react-dom/server';
import { hydrateRoot as ${p}HydrateRoot, type HydrationOptions as ${p}HydrationOptions, type Root as ${p}ReactRoot } from 'react-dom/client';` : ''}
${ssr ? `import { ServerTransport as ${p}SharedServerTransport, HydrationTransport as ${p}SharedHydrationTransport, OwnerReady as ${p}SharedOwnerReady } from './.proto-ui/context/react-ssr-v1';` : ''}
import { createContextScope as ${p}CreateContextScope, acceptsContextValue as ${p}Accepts } from ${JSON.stringify(contextArtifacts.scopeFile.replace(/\.ts$/, ''))};
import type { ContextScope as ${p}ContextScope } from ${JSON.stringify(contextArtifacts.scopeFile.replace(/\.ts$/, ''))};
import { ContextTransport as ${p}ContextTransport } from './.proto-ui/context/react-v1';
import { createNativeStyle as ${p}CreateNativeStyle, templateStyleTokens as ${p}TemplateStyleTokens, type NativeStyle as ${p}NativeStyle, type NativeStyleHandle as ${p}NativeStyleHandle, type NativeRuleHandle as ${p}NativeRuleHandle } from './.proto-ui/style/native-v1';
${interaction ? `import { createNativeInteraction as ${p}CreateNativeInteraction, type NativeInteraction as ${p}NativeInteraction, type NativeFocus as ${p}NativeFocus, type NativeAccessible as ${p}NativeAccessible, type NativeObservedState as ${p}NativeObservedState, type NativeInput as ${p}NativeInput, type NativeFocusOptions as ${p}NativeFocusOptions } from './.proto-ui/interaction/native-v1';` : ''}
${interaction ? `import type { NativeModuleCapability as ${p}NativeModuleCapability } from './.proto-ui/interaction/adapter-modules-v1';` : ''}
${contextImports}
${staticImports}

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
type ${p}State<T> = { get(): T; setDefault(value: T): void; set(value: T, reason?: unknown): void };
type ${p}StateSpec = { kind: 'bool' | 'enum' | 'string' | 'number.discrete' | 'number.range'; options?: readonly (string | number)[]; min?: number; max?: number; step?: number; clamp?: boolean };
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
  getHostProjection(): { tag: string; properties: Readonly<Record<string, string | number | boolean | null>>; portalTarget: HTMLElement | null };
  bindRoot(root: HTMLElement | null): void;
  connect(): void;
${interaction ? '  connectView(): void;\n  disconnectView(): void;\n' : ''}  start(${ssr ? 'expected?: GeneratedRenderProjection' : ''}): void;
  applyProps(props: GeneratedComponentProps): void;
  accept(frame: ${p}Frame): boolean;
  disconnect(): void;
${ssr ? `  prepareServer(): GeneratedRenderProjection;
  disposeNow(): void;
` : ''}
};

const ${p}Slots = new WeakSet<object>();
function ${p}BindSlots(node: ${p}React.ReactNode, slot: ${p}React.ReactNode): ${p}React.ReactNode {
  if (Array.isArray(node)) {
    let result: ${p}React.ReactNode[] | null = null;
    for (let index = 0; index < node.length; index++) {
      const child = ${p}BindSlots(node[index], slot);
      if (child !== node[index]) { result ??= node.slice(); result[index] = child; }
    }
    return result ?? node;
  }
  if (!${p}React.isValidElement(node)) return node;
  const element = node as ${p}React.ReactElement<{ children?: ${p}React.ReactNode }>;
  if (${p}Slots.has(element)) return ${p}React.createElement(${p}React.Fragment, { key: element.key }, slot);
  const previous = element.props.children, next = ${p}BindSlots(previous, slot);
  return previous === next ? node : ${p}React.cloneElement(element, undefined, next);
}
function ${p}RootProperties(properties: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...properties };
  // Native TextControl owns subsequent value writes and IME restoration. React
  // supplies only the initial value, avoiding a competing controlled writer.
  if (Object.hasOwn(result, 'value')) { result.defaultValue = result.value; delete result.value; }
  if (typeof result.style === 'string') {
    const style: Record<string, string> = {};
    for (const declaration of result.style.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 1) continue;
      const name = declaration.slice(0, colon).trim();
      style[name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())] = declaration.slice(colon + 1).trim();
    }
    result.style = style;
  }
  return result;
}
function ${p}HasRootContent(node: ${p}React.ReactNode): boolean {
  if (node === null || node === undefined || typeof node === 'boolean' || node === '') return false;
  if (Array.isArray(node)) return node.some(${p}HasRootContent);
  if (${p}React.isValidElement(node) && node.type === ${p}React.Fragment)
    return ${p}HasRootContent((node.props as { children?: ${p}React.ReactNode }).children);
  return true;
}
function ${p}RenderRoot(tag: string, attributes: Record<string, unknown>, children: ${p}React.ReactNode): ${p}React.ReactElement {
  if (tag === 'input' || tag === 'textarea' || tag === 'img') {
    if (${p}HasRootContent(children)) throw new TypeError('[Template] this physical control Root cannot contain semantic children.');
    return ${p}React.createElement(tag, attributes);
  }
  return ${p}React.createElement(tag, attributes, children);
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

function ${p}CreateOwner(initial: GeneratedComponentProps, publish: (frame: ${p}Frame) => void, getParent: () => ${p}ContextScope | null, publishHost: () => void${ssr ? ', server = false' : ''}): ${p}Owner {
  let phase: 'setup' | 'callback' | 'render' | 'idle' = 'setup';
  let lifetime: 'alive' | 'disposing' | 'disposed' = 'alive';
  let connected = true;
  let cleanupVersion = 0;
  let desiredPresent = true;
  let mounted = false;
${interaction ? `  let viewConnected = false;
${ssr ? '  let hydrationAttributes: Readonly<Record<string, string | null>> | null = null;\n' : ''}` : ''}  let epoch = 0;
  let revision = 0;
  let acceptedRevision = 0;
  let latest: ${p}Frame | null = null;
  let dirty = false;
  let updateQueued = false;
  let scheduled = false;
  let hostScheduled = false;
  let callbackDepth = 0;
  let slotUsed = false;
  let elementSequence = 0;
  let hostProps = initial;
  let root: HTMLElement | null = null;
  let raw: Readonly<Record<string, unknown>> = Object.freeze({});
  let resolved: ${p}ResolvedProps;
  let hydrated = false;
${ssr ? '  let serverPrepared = false;\n' : ''}  let propsWindow: { raw: Readonly<Record<string, unknown>>; resolved: ${p}ResolvedProps } | null = null;
  const specs: Record<string, ${p}PropSpec> = Object.create(null);
  const defaults: Readonly<Record<string, unknown>>[] = [];
  const previousValid: Record<string, unknown> = Object.create(null);
  const stateNames = new Set<string>();
  const ${p}HookNames = new Set<string>();
  const stateSubscribers = new Set<Set<(event: ${p}StateEvent<unknown>) => void>>();
  const pendingStateEvents: (() => void)[] = [];
  const authorStateWatchCleanups: (() => void)[] = [];
  let emittingState = false;
  type ${p}ResolvedWatcher = { active: boolean; keys: readonly string[] | null; callback: (run: ${p}Run, next: ${p}ResolvedProps, prev: ${p}ResolvedProps, info: Readonly<Record<string, unknown>>) => void };
  type ${p}RawWatcher = { active: boolean; keys: readonly string[] | null; callback: (run: ${p}Run, next: Readonly<Record<string, unknown>>, prev: Readonly<Record<string, unknown>>, info: Readonly<Record<string, unknown>>) => void };
  const watchers: ${p}ResolvedWatcher[] = [];
  const rawWatchers: ${p}RawWatcher[] = [], rawAllWatchers: ${p}RawWatcher[] = [];
  const exposes: Record<string, unknown> = Object.create(null);
  const methodSchemas: Record<string, { parameters: readonly { type: ${p}DataSchema; optional?: boolean }[]; result: ${p}DataSchema | null }> = {
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
${ssr ? '    if (server) return;\n' : ''}    if (scheduled || callbackDepth || !connected || lifetime !== 'alive') return;
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
      const slot = ${p}React.createElement(${p}React.Fragment, { key: elementSequence++ });
      ${p}Slots.add(slot);
      return slot;
    },
  };
  function ${p}CreateState<T extends boolean | string | number>(name: string, initialValue: T, spec: ${p}StateSpec): ${p}State<T> {
    ensurePhase('setup');
    if (typeof name !== 'string' || name.length === 0 || stateNames.has(name)) throw new Error('[State] illegal or duplicate state name: ' + name);
    spec = Object.freeze({ ...spec, ...(spec.options ? { options: Object.freeze([...spec.options]) } : {}) });
    const type = spec.kind === 'bool' ? 'boolean' : spec.kind === 'string' || spec.kind === 'enum' ? 'string' : 'number';
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
      if (spec.kind === 'enum' && !spec.options?.includes(next as string)) throw new Error('[State] enum value outside options: ' + name);
      if (spec.options?.length && (spec.kind === 'enum' || spec.kind === 'string' || spec.kind === 'number.discrete')) {
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
      setDefault(next: T) { ensurePhase('setup'); validate(next); value = next; },
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
  function registerObservedState<T extends boolean | string | number>(state: ${p}NativeObservedState<T>) {
    const subscribers = new Set<(event: ${p}StateEvent<T>) => void>();
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
    const kind = typeof state.get();
    const external: ${p}ExternalState<T> = Object.freeze({
      get() { ensureExternal(); return state.get(); },
      subscribe(callback: (event: ${p}StateEvent<T>) => void) {
        ensureExternal(); subscribers.add(callback); return () => { subscribers.delete(callback); };
      },
      unsubscribe(off: () => void) { off(); },
      spec: Object.freeze({ kind: kind === 'boolean' ? 'bool' as const : kind === 'number' ? 'number.discrete' as const : 'string' as const }),
    });
    externalStates.set(state, external);
  }
  const ${p}Interaction: ${p}NativeInteraction<${p}Run> = ${p}CreateNativeInteraction<${p}Run>({
    ensureSetup: () => ensurePhase('setup'),
    ensureRuntime: () => ensurePhase('callback'),
    ensureEvent: () => ensurePhase('callback'),
    isAlive: () => lifetime !== 'disposed',
    isReady: () => phase !== 'setup' && mounted && viewConnected && desiredPresent && connected && lifetime === 'alive',
    invoke,
    getRun: () => ${p}RunHandle,
    getResolvedProps: () => resolved,
    subscribeState(state, callback) { return (externalStates.get(state) as ${p}ExternalState<unknown> | undefined)?.subscribe(callback) ?? (state as ${p}NativeObservedState<unknown>).subscribe(callback); },
    getRoot: () => viewConnected ? root : null,
    identity: context,
    getLogicalParent: getParent,
    declarations: ${JSON.stringify(ir.moduleDeclarations.map(({ id, config }) => ({ id, config })))},
    tableFamily: ${staticCapabilities.get('@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY') ?? 'undefined'},
    getExposes: () => exposes,
    registerExpose(key, value) {
      const state = value && typeof value === 'object' ? externalStates.get(value) : undefined;
      if (state) registerExpose(key, state);
      else if (typeof value === 'function') registerExpose(key, (...args: unknown[]) => { ensureExternal(); return invoke(() => value(...args)); });
      else if (key === 'controls' && value && typeof value === 'object') registerExpose(key, Object.fromEntries(Object.entries(value).map(([name, action]) => [name, (...args: unknown[]) => { ensureExternal(); return invoke(() => (action as Function)(...args)); }])));
      else registerExpose(key, value);
    },
    createOwnedState: <T extends boolean | string | number>(name: string, value: T, spec?: ${p}StateSpec) => ${p}CreateState(name, value, spec ?? { kind: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'number.discrete' : 'string' }),
    watchState<T>(state: {get(): T}, callback: (run: ${p}Run, event: ${p}StateEvent<T>) => void) {
      ensurePhase('setup');
      const external = externalStates.get(state) as ${p}ExternalState<T>;
      if (!external) throw new Error('[State] foreign watch target');
      const off = external.subscribe(event => invoke(() => callback(${p}RunHandle, event)));
      authorStateWatchCleanups.push(off); return off;
    },
    isPropProvided: key => Object.hasOwn(raw, key),
    declareTransition(hooks) {
      ${p}Def.props.define({ open: {type:'boolean'}, defaultOpen: {type:'boolean',default:false}, appear: {type:'boolean',default:false}, enterDuration: {type:'number',default:300}, leaveDuration: {type:'number',default:200}, interrupt: {type:'string',default:'reverse'} });
      for (const name of ['beforeEnter','afterEnter','beforeLeave','afterLeave']) ${p}Def.expose.event(name);
      callbacks.created.push(hooks.created); callbacks.mounted.push(hooks.mounted); callbacks.unmounted.push(hooks.unmounted); callbacks.beforeDispose.push(hooks.beforeDispose);
      ${p}Def.props.watch(['open','interrupt','enterDuration','leaveDuration'], hooks.propsChanged);
    },
    setPresent: value => ${p}RunHandle.lifecycle.setPresent(value),
    requestHostUpdate() {
      if (hostScheduled || lifetime !== 'alive'${ssr ? ' || server' : ''}) return;
      hostScheduled = true;
      queueMicrotask(() => { hostScheduled = false; if (connected && lifetime === 'alive') publishHost(); });
    },
    registerGenericObservedState: registerObservedState,
    emit: key => ${p}RunHandle.expose.emit(key),
  });
  function disposeInteraction() {
    try { ${p}Interaction.dispose(); }
    finally { for (const off of observedStateCleanups.splice(0)) off(); for (const off of authorStateWatchCleanups.splice(0)) off(); }
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
      get() { ensureAlive(); return propsWindow?.resolved ?? resolved; },
      getRaw() { ensureAlive(); return propsWindow?.raw ?? raw; },
      isProvided(key: string) { ensureAlive(); return Object.hasOwn(propsWindow?.raw ?? raw, key); },
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
      watchAll(callback: ${p}ResolvedWatcher['callback']) {
        ensurePhase('setup');
        const watcher: ${p}ResolvedWatcher = { keys: null, callback, active: true };
        watchers.push(watcher);
        return () => { watcher.active = false; };
      },
      watchRaw(keys: readonly string[], callback: ${p}RawWatcher['callback']) {
        ensurePhase('setup');
        if (!keys.length || keys.some(key => typeof key !== 'string' || !key.length)) throw new Error('[Props] raw watchers require nonempty keys.');
        const watcher: ${p}RawWatcher = { keys: [...keys], callback, active: true };
        rawWatchers.push(watcher);
        return () => { watcher.active = false; };
      },
      watchRawAll(callback: ${p}RawWatcher['callback']) {
        ensurePhase('setup');
        const watcher: ${p}RawWatcher = { keys: null, callback, active: true };
        rawAllWatchers.push(watcher);
        return () => { watcher.active = false; };
      },
    },
    state: {
      bool: (name: string, value: boolean) => ${p}CreateState(name, value, { kind: 'bool' }),
      string: (name: string, value: string, spec: Omit<${p}StateSpec, 'kind'> = {}) => ${p}CreateState(name, value, { kind: 'string', ...spec }),
      enum: (name: string, value: string, spec: { options: readonly string[] }) => ${p}CreateState(name, value, { kind: 'enum', ...spec }),
      numberDiscrete: (name: string, value: number, spec: Omit<${p}StateSpec, 'kind'> = {}) => ${p}CreateState(name, value, { kind: 'number.discrete', ...spec }),
      numberRange: (name: string, value: number, spec: Omit<${p}StateSpec, 'kind'>) => ${p}CreateState(name, value, { kind: 'number.range', ...spec }),
    },
    expose: {
      value: registerExpose,
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
          if (schema.result !== null && !${p}Accepts(schema.result, result)) throw new TypeError('[Expose] invalid method result: ' + key);
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
    const previousRaw = raw;
    raw = Object.freeze(nextRaw);
    resolved = ${p}ResolveProps(specs, defaults, previousValid, raw, true);
    ${p}Style.refresh();
${interaction ? `    ${p}Interaction.refresh();\n` : ''}    if (!hydrated) { hydrated = true; return; }
    const nextResolved = resolved, nextRawSnapshot = raw;
    invoke(() => {
      const previousWindow = propsWindow;
      propsWindow = { raw: nextRawSnapshot, resolved: nextResolved };
      try {
      if (rawAllWatchers.length || rawWatchers.length) {
        const changedRaw = [...new Set([...Object.keys(previousRaw), ...Object.keys(nextRawSnapshot)])].filter(key => Object.hasOwn(previousRaw, key) !== Object.hasOwn(nextRawSnapshot, key) || !Object.is(previousRaw[key], nextRawSnapshot[key]));
        if (changedRaw.length) for (let groupIndex = 0; groupIndex < 2; ++groupIndex) for (const watcher of groupIndex === 0 ? rawAllWatchers : rawWatchers) {
          if (!watcher.active) continue;
          const changedKeysMatched = watcher.keys ? watcher.keys.filter(key => changedRaw.includes(key)) : changedRaw;
          if (!changedKeysMatched.length) continue;
          console.warn('[Props] raw watchers are an adapter-snapshot escape hatch; avoid in official prototypes.');
          watcher.callback(${p}RunHandle, nextRawSnapshot, previousRaw, { changedKeysAll: changedRaw, changedKeysMatched });
        }
      }
      const changedKeysAll = Object.keys(specs).filter((key) => !Object.is(previous[key as keyof GeneratedProps], nextResolved[key as keyof GeneratedProps]));
      for (const watcher of watchers) {
        if (!watcher.active) continue;
        const changedKeysMatched = watcher.keys ? watcher.keys.filter((key) => changedKeysAll.includes(key)) : changedKeysAll;
        if (changedKeysMatched.length) watcher.callback(${p}RunHandle, nextResolved, previous, { changedKeysAll, changedKeysMatched });
      }
      } finally { propsWindow = previousWindow; }
    });
  }
  const handle: GeneratedHandle = Object.freeze({
    update() { ensureExternal(); invoke(() => ${p}RunHandle.update()); },
    getExposes() { ensureExternal(); return exposes as GeneratedExposes; },
    invokeInCallbackScope<T>(callback: () => T): T { ensureExternal(); return invoke(callback); },
  });
${ssr ? `  function disposeNow() {
    if (lifetime !== 'alive') return;
    lifetime = 'disposing'; phase = 'callback';
    let failure: unknown;
    try { dispatch(callbacks.beforeDispose); } catch (error) { failure = error; }
    finally {
${interaction ? `      try { disposeInteraction(); } catch (error) { failure ??= error; }\n` : ''}      try { ${p}Style.dispose(); } catch (error) { failure ??= error; }
      try { context.dispose(); } catch (error) { failure ??= error; }
      lifetime = 'disposed'; phase = 'idle'; connected = false;
      for (const subscribers of stateSubscribers) subscribers.clear();
      pendingStateEvents.length = 0; watchers.length = 0; rawWatchers.length = 0; rawAllWatchers.length = 0;
      for (const list of Object.values(callbacks)) list.length = 0;
      for (const key of Object.keys(exposes)) delete exposes[key];
    }
    if (failure !== undefined) throw failure;
  }
` : ''}  return {
    handle,
    scope: context,
    getHostProjection() { return { tag: ${interaction ? `${p}Interaction.rootTag() ?? 'div'` : "'div'"}, properties: ${interaction ? `${p}Interaction.rootProperties()` : '{}'}, portalTarget: ${interaction ? `${p}Interaction.portalTarget()` : 'null'} }; },
${ssr ? `    disposeNow,
    prepareServer() {
      if (!server) throw new Error('[SSR] preparation requires a request-owned server instance.');
      try {
        if (!serverPrepared) { applyProps(initial); dispatch(callbacks.created); serverPrepared = true; }
${interaction ? `        ${p}Interaction.projectAttributes();\n` : ''}        slotUsed = false; elementSequence = 0;
        let node: ${p}React.ReactNode = null;
        if (desiredPresent) {
          phase = 'render';
          try { node = normalize(render(${p}Renderer)); } finally { phase = 'idle'; }
        }
        const tokens = ${p}Style.serverTokens();
        return { source: ${JSON.stringify(ir.source.sha256)}, present: desiredPresent, rootTag: ${interaction ? `${p}Interaction.rootTag() ?? 'div'` : "'div'"}, properties: ${interaction ? `${p}Interaction.rootProperties()` : '{}'}, template: ${p}EncodeTemplate(node),
          attributes: { 'data-pui-root': '',
            ...(tokens.length ? { 'data-pui-style': tokens.join(' ') } : {}),
${interaction ? `            ...${p}Interaction.projectAttributes(),\n` : ''}          }, raw: ${p}EncodeData(raw) };
      } catch (error) { try { disposeNow(); } catch (cleanup) { throw new AggregateError([error, cleanup], '[SSR] preparation and disposal failed.'); } throw error; }
    },
` : ''}
    bindRoot(nextRoot) {
      if (root === nextRoot) return;
${interaction ? `      ${p}Interaction.unmount();\n` : ''}      root?.removeAttribute('data-pui-style');
      root = nextRoot;
      if (mounted) projectStyle(${p}Style.tokens());
${interaction ? `      if (mounted && desiredPresent && viewConnected) ${p}Interaction.mount();\n` : ''}    },
    connect() { connected = true; ++cleanupVersion; },
${interaction ? `    connectView() {
      viewConnected = true;
${ssr ? `      if (root && hydrationAttributes) {
        ${p}Interaction.adoptAttributes(hydrationAttributes);
        hydrationAttributes = null;
      }
` : ''}      if (mounted && desiredPresent) ${p}Interaction.mount();
    },
    disconnectView() { viewConnected = false; ${p}Interaction.unmount(); },
` : ''}    start(${ssr ? 'expected?: GeneratedRenderProjection' : ''}) {
      try {
        applyProps(initial); dispatch(callbacks.created);
${ssr ? `        if (expected && expected.present !== desiredPresent)
          throw new Error('[Hydration] client initial presence disagrees with the server projection.');
${interaction ? `        if (expected) hydrationAttributes = Object.fromEntries(Object.entries(expected.attributes).filter(([key]) => key !== 'data-pui-root' && key !== 'data-pui-style'));
` : ''}
` : ''}        schedule();
      }
      catch (error) { ${ssr ? `try { disposeNow(); } catch (cleanup) { throw new AggregateError([error, cleanup], '[Hydration] startup and cleanup failed.'); }` : `${interaction ? 'try { disposeInteraction(); } catch {} ' : ''}${p}Style.dispose(); context.dispose(); lifetime = 'disposed'; connected = false;`} throw error; }
    },
    applyProps,
    accept(frame: ${p}Frame) {
      if (!connected || lifetime !== 'alive' || frame.revision <= acceptedRevision || frame !== latest) return false;
      acceptedRevision = frame.revision;
      if (frame.kind === 'detach') {
${interaction ? `        ${p}Interaction.unmount();\n` : ''}        ${p}Style.unmount();
        if (mounted) { mounted = false; dispatch(callbacks.unmounted); }
      } else if (!desiredPresent) {
        // Physical materialization is not a published mount. Remove the obsolete
        // Root without manufacturing mounted/unmounted for a never-mounted epoch.
        schedule();
        return false;
      } else if (frame.kind === 'mount') {
        mounted = true;
        ${p}Style.mount();
${interaction ? `        ${p}Interaction.mount();\n` : ''}        dispatch(callbacks.mounted);
      } else if (mounted && frame.epoch === epoch) dispatch(callbacks.updated);
      schedule();
      return true;
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
          rawWatchers.length = 0; rawAllWatchers.length = 0;
          for (const list of Object.values(callbacks)) list.length = 0;
          for (const key of Object.keys(exposes)) delete exposes[key];
        }
        if (failure !== undefined) throw failure;
      });
    },
  };
}

${ssr ? emitReactSSRSupport(p, componentName, ir) : ''}
export const ${componentName} = ${p}React.forwardRef<GeneratedHandle, GeneratedComponentProps>(function ${componentName}(props, ref) {
  const ownerRef = ${p}React.useRef<${p}Owner | null>(null);
  const parentScope = ${p}React.useContext(${p}ContextTransport);
  const parentRef = ${p}React.useRef<${p}ContextScope | null>(null);
  const [frame, setFrame] = ${p}React.useState<${p}Frame | null>(null);
  const [, publishHost] = ${p}React.useReducer((version: number) => version + 1, 0);
${ssr ? `  const shellId = ${p}React.useId();
  const [started, setStarted] = ${p}React.useState(false);
  const serverRequest = ${p}React.useContext(${p}ServerTransport);
  const session = ${p}React.useContext(${p}HydrationTransport);
  const parentReady = ${p}React.useContext(${p}OwnerReady);
  // Carrier metadata validates initial adoption, not owners created after bootstrap.
  // Freeze that decision for this logical shell, including retained view re-entry.
  const [projection] = ${p}React.useState(() => {
    if (!session || session.pending.size === 0) return undefined;
    const initial = session.carrier.projections[shellId];
    if (!initial || initial.source !== ${JSON.stringify(ir.source.sha256)})
      throw new Error('[Hydration] missing/mismatched source-bound component projection.');
    return initial;
  });
  const rootRef = ${p}React.useRef<HTMLElement | null>(null);
  const bindRoot = ${p}React.useCallback((root: HTMLElement | null) => { rootRef.current = root; ownerRef.current?.bindRoot(root); }, []);
` : `  const bindRoot = ${p}React.useCallback((root: HTMLElement | null) => { ownerRef.current?.bindRoot(root); }, []);
`}  // All irreversible work begins after an accepted shell commit, never during React render.
  ${p}React.useLayoutEffect(() => {
${ssr ? `    if (serverRequest || !parentReady) return;
` : ''}    parentRef.current = parentScope;
    let owner = ownerRef.current;
    if (!owner) {
${ssr ? `      const initial: GeneratedComponentProps = projection ? { ...${p}DecodeData(projection.raw) as GeneratedProps, children: props.children } : props;
      if (projection) for (const [key, value] of Object.entries(props)) if (key.startsWith('on') && typeof value === 'function') initial[key as \`on\${string}\`] = value;
      let first = projection?.present ?? true;
      owner = ${p}CreateOwner(initial, next => {
        if (first && projection && next.kind !== 'detach') {
          first = false;
          const host = owner!.getHostProjection();
          if (!projection.present || host.tag !== projection.rootTag || JSON.stringify(host.properties) !== JSON.stringify(projection.properties)
            || JSON.stringify(${p}EncodeTemplate(next.node)) !== JSON.stringify(projection.template)) {
            owner!.disposeNow();
            throw new Error('[Hydration] client initial execution disagrees with the source-bound server projection.');
          }
        }
        setFrame(next);
      }, () => parentRef.current, publishHost);
` : `      owner = ${p}CreateOwner(props, setFrame, () => parentRef.current, publishHost);
`}      ownerRef.current = owner;
      owner.start(${ssr ? 'projection' : ''});
${ssr ? `      owner.bindRoot(rootRef.current);
      if (projection && !projection.present) session!.pending.delete(shellId);
      setStarted(true);
` : ''}    } else owner.connect();
${interaction ? `    owner.connectView();
    return () => { owner.disconnectView(); };
` : ''}  }, [${ssr ? 'parentReady' : ''}]);
  ${p}React.useLayoutEffect(() => { parentRef.current = parentScope; }, [parentScope]);
  // Suspense can disconnect layout effects without unmounting the owner shell.
  // Passive cleanup identifies shell unmount; same-turn StrictMode replay cancels disposal.
  ${p}React.useEffect(() => {
    const owner = ownerRef.current${ssr ? ';\n    if (!owner) return' : '!'};
    owner.connect();
    return () => { owner.disconnect(); };
  }, [${ssr ? 'parentReady' : ''}]);
  ${p}React.useLayoutEffect(() => { ${ssr ? 'if (projection && (!started || projection.present && !frame)) return; ownerRef.current?.' : 'ownerRef.current!.'}applyProps(props); }, [props${ssr ? ', parentReady, started, !!frame' : ''}]);
  ${p}React.useLayoutEffect(() => { if (frame${ssr ? ` && ownerRef.current!.accept(frame) && projection && frame.kind !== 'detach'` : ''}) ${ssr ? 'session!.pending.delete(shellId)' : 'ownerRef.current!.accept(frame)'}; }, [frame]);
  ${p}React.useImperativeHandle(ref, () => ${ssr ? `({
    update() { if (!ownerRef.current) throw new Error('[Hydration] owner is not ready.'); ownerRef.current.handle.update(); },
    getExposes() { if (!ownerRef.current) throw new Error('[Hydration] owner is not ready.'); return ownerRef.current.handle.getExposes(); },
    invokeInCallbackScope<T>(callback: () => T): T { if (!ownerRef.current) throw new Error('[Hydration] owner is not ready.'); return ownerRef.current.handle.invokeInCallbackScope(callback); },
  })` : 'ownerRef.current!.handle'}, []);
  const template = ${p}React.useMemo(() => ${p}BindSlots(frame?.node, props.children), [frame?.node, props.children]);
${ssr ? `  if (serverRequest) {
    const entry = serverRequest.prepare(shellId, () => {
      const owner = ${p}CreateOwner(props, () => { throw new Error('[SSR] server cannot publish a physical commit.'); }, () => parentScope, () => {}, true);
      return { owner, projection: owner.prepareServer() };
    });
    const view = entry.projection.present ? ${p}RenderRoot(entry.projection.rootTag, ${p}RootAttributes(entry.projection),
      ${p}DecodeTemplate(entry.projection.template, props.children)) : null;
    return ${p}React.createElement(${p}ContextTransport.Provider, { value: entry.owner.scope }, view);
  }
` : ''}  const host = ownerRef.current?.getHostProjection();
  const rootView = frame && frame.kind !== 'detach'
    ? ${p}RenderRoot(host!.tag, { ${ssr ? '...(projection ? ' + p + 'RootAttributes(projection) : {}), ' : ''}...${p}RootProperties(host!.properties), 'data-pui-root': '', ref: bindRoot }, template)${ssr ? ` : !frame && projection?.present
      ? ${p}RenderRoot(projection.rootTag, { ...${p}RootAttributes(projection), ref: bindRoot }, ${p}DecodeTemplate(projection.template, props.children))` : ''} : null;
  const view = ${interaction ? `rootView && host?.portalTarget ? ${p}CreatePortal(rootView, host.portalTarget) : rootView` : 'rootView'};
${ssr ? `  return ${p}React.createElement(${p}OwnerReady.Provider, { value: started },
    ${p}React.createElement(${p}ContextTransport.Provider, { value: ownerRef.current?.scope ?? null }, view));
` : `  return ${p}React.createElement(${p}ContextTransport.Provider, { value: ownerRef.current?.scope ?? null }, view);
`}
});
${componentName}.displayName = ${JSON.stringify(ir.name)};
`;
  return {
    ok: true,
    value: {
      code,
      profile,
      supportingFiles: [...contextArtifacts.files, ...staticArtifacts.files, nativeStyleArtifact, ...(interaction ? [nativeInteractionArtifact, nativeAdapterModulesArtifact] : []), ...(ssr ? [reactSSRTransportArtifact] : []), {
        path: transportFile, kind: 'source',
        contents: `import { createContext } from 'react';\nimport type { ContextScope } from './scope-v1';\nexport const ContextTransport = createContext<ContextScope | null>(null);\n`,
      }],
      dependencies: selected.value.dependencies.map((dependency) => ({ ...dependency })),
      provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: profile },
    },
  };
}
