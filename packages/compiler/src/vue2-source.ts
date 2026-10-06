import { formatDataType } from './data-types';
import { validateIR, validIdentifier } from './ir-validation';
import { buildNativeContextArtifacts } from './native-context';
import { nativeInteractionArtifact } from './native-interaction';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';
import { nativeExposeStateWebArtifact, type ExposeStateWebMode } from './native-expose-state-web';
import { buildNativeStaticDeclarations } from './native-static-declarations';
import { emitNativeRule, emitNativeStyleHandle, nativeStyleArtifact } from './native-style';
import { OPERATION_RULES } from './operations';
import { vue2SsrEntrypoints } from './vue2-ssr-entry';
import { checkTargetOperations, resolveTargetProfile } from './targets';
import type {
  CompileResult,
  CompilerDiagnostic,
  ExpressionIR,
  FunctionIR,
  GeneratedModule,
  ParameterIR,
  PrototypeIR,
  StatementIR,
  ValueType,
} from './ir';

export interface Vue2SourceOptions {
  componentName?: string;
  rootTag?: string;
  autoUpdateOnPropsChange?: boolean;
  ssr?: boolean;
  exposeStateWebMode?: ExposeStateWebMode;
}

/** Component-options output for the concrete Vue 2.6.14 consumer, not an Adapter bridge. */
export function emitVue2Source(
  input: PrototypeIR,
  options: Vue2SourceOptions = {}
): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = validated.value;
  const profile = options.ssr ? 'vue2-ssr-v1' : 'vue2-source-v1';
  const selected = resolveTargetProfile('vue2-source-v1');
  if (!selected.ok) return selected;
  const admitted = checkTargetOperations(ir, selected.value);
  if (!admitted.ok) return admitted;
  const projectsState = ir.exposes.some((exposure) => exposure.kind === 'state');
  const componentName = options.componentName ?? 'CompiledComponent';
  const rootTag = options.rootTag ?? 'div';
  const diagnostics: CompilerDiagnostic[] = [];
  const reject = (message: string, span = ir.setup.span): void => {
    diagnostics.push({ code: 'PUI4102', category: 'unsupported-input', message, span });
  };
  const usesStyle = admitted.value.sites.some(
    (site) =>
      site.operation.startsWith('style.') ||
      site.operation.startsWith('rule.') ||
      site.operation.startsWith('feedback.')
  );
  const usesInteraction =
    ir.moduleDeclarations.length > 0 ||
    admitted.value.sites.some((site) =>
      /^(hook\.|event\.|focus\.|accessible\.|anatomy\.)/.test(site.operation)
    );
  if (
    !validIdentifier(componentName) ||
    ['GeneratedProps', 'GeneratedExposes'].includes(componentName)
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI3001',
          category: 'invalid-input',
          message: 'Choose a valid, non-reserved generated component identifier.',
          span: ir.setup.span,
        },
      ],
    };
  }
  if (!/^[a-z][a-z0-9-]*$/.test(rootTag)) {
    reject('The Vue2 native rootTag must be a static lowercase DOM tag.');
  }
  const hostPropNames = new Map<string, string>();
  for (const prop of ir.props) {
    const hostName = prop.name.replace(/-(\w)/g, (_match, letter: string) => letter.toUpperCase());
    const prior = hostPropNames.get(hostName);
    if (hostName === '__proto__' || (prior !== undefined && prior !== prop.name)) {
      reject(
        `Prop ${JSON.stringify(prop.name)} cannot be represented without a Vue2 prop-name collision.`,
        prop.span
      );
    }
    hostPropNames.set(hostName, prop.name);
  }
  // An operation name is not proof that every host-specific argument has a lowering.
  // Fail closed before emitting, including inside statically expanded authored hooks.
  function inspect(node: ExpressionIR): void {
    if (node.kind === 'operation') {
      if (node.operation === 'render.el') {
        const props = node.arguments[1];
        const record =
          props &&
          (props.kind === 'record' ||
            props.type === 'template-props' ||
            props.type === 'record' ||
            (typeof props.type === 'object' && props.type.kind === 'record'));
        if (
          record &&
          (props.kind !== 'record' ||
            props.entries.length > 1 ||
            props.entries.some(
              (entry) => entry.key !== 'style' || entry.value.type !== 'style-handle'
            ))
        ) {
          reject(
            'vue2-source-v1 TemplateProps supports only one static tw handle under style.',
            props.span
          );
        }
      }
      if (node.operation === 'props.define' && node.arguments[0]?.kind === 'record') {
        for (const entry of node.arguments[0].entries) {
          if (entry.value.kind !== 'record') continue;
          for (const field of entry.value.entries) {
            if (!['type', 'default', 'empty', 'options', 'range'].includes(field.key)) {
              reject(
                `vue2-source-v1 does not implement prop descriptor field ${JSON.stringify(field.key)}.`,
                field.value.span
              );
            }
          }
        }
      }
      if (node.receiver) inspect(node.receiver);
      node.arguments.forEach(inspect);
    } else if (node.kind === 'function') inspectBody(node.function.body);
    else if (node.kind === 'member') inspect(node.object);
    else if (node.kind === 'unary') inspect(node.operand);
    else if (node.kind === 'binary') {
      inspect(node.left);
      inspect(node.right);
    } else if (node.kind === 'array') node.elements.forEach(inspect);
    else if (node.kind === 'record') node.entries.forEach((entry) => inspect(entry.value));
    else if (node.kind === 'helper-call') node.arguments.forEach(inspect);
  }
  function inspectBody(body: readonly StatementIR[]): void {
    for (const statement of body) {
      if (statement.kind === 'const') inspect(statement.value);
      else if (statement.kind === 'effect') inspect(statement.expression);
      else if (statement.kind === 'return' && statement.value) inspect(statement.value);
      else if (statement.kind === 'if') {
        inspect(statement.condition);
        inspectBody(statement.then);
        inspectBody(statement.otherwise);
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
  const contextArtifacts = buildNativeContextArtifacts(ir);
  const staticDeclarations = buildNativeStaticDeclarations(
    ir.staticDeclarations,
    ir.moduleDeclarations
  );
  const staticNames = new Map<string, string>();
  let staticSequence = 0;
  const staticImports = [...staticDeclarations.capabilities]
    .map(([id, entry]) => {
      const name = `${prefix}Static${staticSequence++}`;
      staticNames.set(id, name);
      return `import { declaration as ${name} } from ${JSON.stringify('./' + entry.file.replace(/\.ts$/, ''))};`;
    })
    .join('\n');
  const contextNames = new Map(
    ir.contextKeys.map((key, index) => [key.id, `${prefix}ContextKey${index}`])
  );
  const aliases = new Map(ir.hooks.map((hook, index) => [hook.id, `${prefix}Hook${index}`]));
  function typeName(type: ValueType): string {
    if (typeof type === 'object') return formatDataType(type);
    if (['boolean', 'number', 'string', 'null', 'void', 'unknown'].includes(type)) return type;
    if (type === 'props') return 'GeneratedProps';
    if (type === 'focus') return `${prefix}NativeFocus`;
    if (type === 'accessible') return `${prefix}NativeAccessible`;
    if (type === 'event') return `${prefix}NativeInput`;
    if (type === 'host-event') return 'Event';
    if (type === 'host-target') return 'HTMLElement | null';
    if (type === 'observed:boolean') return `${prefix}NativeObservedState<boolean>`;
    return 'unknown';
  }
  function parameters(values: readonly ParameterIR[]): string {
    return values
      .map(
        (parameter) =>
          `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`
      )
      .join(', ');
  }
  function fn(value: FunctionIR, depth: number): string {
    return `(${value.parameters.map((parameter) => parameter.name).join(', ')}) => {\n${body(value.body, depth + 1)}${'  '.repeat(depth)}}`;
  }
  function expression(value: ExpressionIR, depth: number): string {
    switch (value.kind) {
      case 'literal':
        return JSON.stringify(value.value);
      case 'reference':
        return value.name;
      case 'context-key':
        return contextNames.get(value.keyId)!;
      case 'style-handle':
        return emitNativeStyleHandle(value.handle, false);
      case 'rule':
        return emitNativeRule(
          value,
          (item) => expression(item, depth),
          `${prefix}Owner.def.feedback.style`,
          `${prefix}Owner.resolvedProps`,
          false
        );
      case 'member':
        return `(${expression(value.object, depth)})${value.optional ? '?.' : ''}[${JSON.stringify(value.property)}]`;
      case 'unary':
        return `(${value.operator}${expression(value.operand, depth)})`;
      case 'binary':
        return `(${expression(value.left, depth)} ${value.operator} ${expression(value.right, depth)})`;
      case 'array':
        return `[${value.elements.map((item) => expression(item, depth)).join(', ')}]`;
      case 'record':
        return `{ ${value.entries.map((entry) => `[${JSON.stringify(entry.key)}]: ${expression(entry.value, depth)}`).join(', ')} }`;
      case 'function':
        return fn(value.function, depth);
      case 'helper-call':
        return `${value.name}(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
      case 'authored-hook':
        return `${aliases.get(value.hookId)}()`;
      case 'static-capability':
        return staticNames.get(value.declarationId)!;
      case 'operation': {
        const argumentsCode = value.arguments.map((item) => expression(item, depth)).join(', ');
        if (OPERATION_RULES[value.operation].path === 'call')
          return `${expression(value.receiver!, depth)}(${argumentsCode})`;
        if (value.operation.startsWith('hook.') || value.operation.startsWith('anatomy.')) {
          return `${prefix}Owner.interaction.${OPERATION_RULES[value.operation].path}(${argumentsCode})`;
        }
        if (value.operation === 'host.get') return `${prefix}Owner.host()`;
        return `${expression(value.receiver!, depth)}.${OPERATION_RULES[value.operation].path}(${argumentsCode})`;
      }
    }
  }
  function body(statements: readonly StatementIR[], depth: number): string {
    const indent = '  '.repeat(depth);
    return statements
      .map((statement) => {
        const origin = `${indent}// Source ${JSON.stringify(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
        switch (statement.kind) {
          case 'const':
            return `${origin}${indent}const ${statement.name} = ${expression(statement.value, depth)};\n`;
          case 'effect':
            return `${origin}${indent}${expression(statement.expression, depth)};\n`;
          case 'return':
            return `${origin}${indent}return${statement.value ? ` ${expression(statement.value, depth)}` : ''};\n`;
          case 'if':
            return `${origin}${indent}if (${expression(statement.condition, depth)}) {\n${body(statement.then, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${body(statement.otherwise, depth + 1)}${indent}}` : ''}\n`;
        }
      })
      .join('');
  }
  const propsType = ir.props
    .map((prop) => `  ${JSON.stringify(prop.name)}?: ${typeName(prop.type)} | null;`)
    .join('\n')
    .replace(/\*\//g, '*\\/');
  const exposesType = ir.exposes
    .filter((entry) => entry.kind !== 'event')
    .map((entry) => {
      const type =
        entry.kind === 'state'
          ? `${prefix}ExternalState<${typeName(entry.type)}>`
          : entry.kind === 'value'
            ? typeName(entry.type)
            : `(${parameters(entry.parameters)}) => ${typeName(entry.returnType)}`;
      return `  ${JSON.stringify(entry.name)}: ${type};`;
    })
    .join('\n')
    .replace(/\*\//g, '*\\/');
  const propTypes = Object.fromEntries(ir.props.map((prop) => [prop.name, prop.type]));
  const hooks = ir.hooks
    .map(
      (hook) =>
        `  const ${aliases.get(hook.id)} = () => (${fn(hook.setup, 1)})(${prefix}Owner.def);`
    )
    .join('\n');
  const styleImport = usesStyle
    ? `import { createNativeStyle as ${prefix}CreateNativeStyle, templateStyleTokens as ${prefix}TemplateStyleTokens } from './.proto-ui/style/native-v1';\n`
    : '';
  const interactionImport = usesInteraction
    ? `import { createNativeInteraction as ${prefix}CreateNativeInteraction } from './.proto-ui/interaction/native-v1';
/** @template Run @typedef {import('./.proto-ui/interaction/native-v1').NativeInteraction<Run>} ${prefix}NativeInteraction */
/** @typedef {import('./.proto-ui/interaction/native-v1').NativeFocus} ${prefix}NativeFocus */
/** @typedef {import('./.proto-ui/interaction/native-v1').NativeAccessible} ${prefix}NativeAccessible */
/** @template T @typedef {import('./.proto-ui/interaction/native-v1').NativeObservedState<T>} ${prefix}NativeObservedState */
/** @typedef {import('./.proto-ui/interaction/native-v1').NativeInput} ${prefix}NativeInput */
/** @typedef {import('./.proto-ui/interaction/native-v1').NativeFocusOptions} ${prefix}NativeFocusOptions */
`
    : '';
  const contextImports =
    styleImport +
    interactionImport +
    (projectsState
      ? `import { createNativeExposeStateWeb as ${prefix}CreateExposeStateWeb } from './.proto-ui/expose-state/web-v1';\n`
      : '') +
    (contextArtifacts
      ? `import { createContextScope as ${prefix}CreateContextScope, scopeKey as ${prefix}ScopeKey, acceptsContextValue as ${prefix}AcceptsContextValue } from '${contextArtifacts.scopeFile.replace(/\.ts$/, '')}';\n${ir.contextKeys.map((key) => `import { key as ${contextNames.get(key.id)} } from '${contextArtifacts.keys.get(key.id)!.file.replace(/\.ts$/, '')}';`).join('\n')}`
      : '');
  const contextCode = contextArtifacts
    ? `
  const contextChecks = new Map([
${ir.contextKeys.map((key) => `    [${contextNames.get(key.id)}, (value) => ${prefix}AcceptsContextValue(${JSON.stringify(key.type)}, value)],`).join('\n')}
  ]);
  const contextScope = ${prefix}CreateContextScope({
    getParent: () => vm[${JSON.stringify(`${prefix}ParentScope`)}] || null,
    isAlive: () => !disposed,
    invoke: (fn) => invoke(fn, false),
    validate: (key, value) => contextChecks.get(key)?.(value) === true,
  });
  const contextRead = Object.freeze({ read: (key) => { alive(); return contextScope.read(key); }, tryRead: (key) => { alive(); return contextScope.tryRead(key); } });
`
    : '';
  const helpers = nativeHelpers(
    {
      owner: contextCode,
      run: contextArtifacts
        ? `context: { ...contextRead, update: (key, value) => { callback(); contextScope.update(key, value); }, tryUpdate: (key, value) => { callback(); return contextScope.tryUpdate(key, value); } },`
        : '',
      read: contextArtifacts ? ', context: contextRead' : '',
      def: contextArtifacts
        ? `context: { provide: (key, value) => { setupOnly(); contextScope.provide(key, value); }, subscribe: (key, fn) => { setupOnly(); return contextScope.subscribe(key, 'required', fn ? (next, prev) => fn(run, next, prev) : undefined); }, trySubscribe: (key, fn) => { setupOnly(); return contextScope.subscribe(key, 'optional', fn ? (next, prev) => fn(run, next, prev) : undefined); } },`
        : '',
      handle: contextArtifacts ? 'contextScope,' : '',
      dispose: contextArtifacts
        ? 'try { contextScope.dispose(); } catch (error) { failure ??= error; }'
        : '',
      setupFailure: contextArtifacts ? 'contextScope.dispose();' : '',
    },
    usesStyle,
    usesInteraction,
    options.ssr === true,
    projectsState,
    JSON.stringify(ir.moduleDeclarations.map(({ id, config }) => ({ id, config }))),
    staticNames.get('@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY') ?? 'undefined',
    JSON.stringify(options.exposeStateWebMode) ?? 'undefined'
  ).replace(/\bPUI/g, prefix);
  const ownerKey = JSON.stringify(`${prefix}Owner`);
  const propDeclarations = ir.props.map((prop) => `[${JSON.stringify(prop.name)}]: {}`).join(', ');
  const code = `// Editable generated Vue 2.6.14 component options. Profile: ${profile}.
// Inline native-lowering helpers: logical owner, prop resolution, state, semantic templates.
// No Proto-UI Core, Runtime, Hooks or Adapter dependency; optional native helpers are emitted artifacts.
// Source graph SHA-256: ${ir.source.sha256}
${contextImports}
${staticImports}

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
  ${
    contextArtifacts
      ? `inject: { [${JSON.stringify(`${prefix}ParentScope`)}]: { from: ${prefix}ScopeKey, default: null } },
  provide() { return { [${prefix}ScopeKey]: this[${ownerKey}].contextScope }; },`
      : ''
  }
  beforeCreate() {
    Object.defineProperty(this, ${ownerKey}, { value: ${prefix}CreateOwner(this, ${prefix}Setup, ${JSON.stringify(propTypes)}, ${JSON.stringify(rootTag)}, ${options.autoUpdateOnPropsChange !== false}) });
    ${
      options.ssr
        ? `const session = ${prefix}FindSession(this);
    if (session) this[${ownerKey}].bindSession(session, ${JSON.stringify(ir.source.sha256)});`
        : ''
    }
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
${options.ssr ? vue2SsrEntrypoints(prefix, componentName, ir.source.sha256) : ''}
`;
  return {
    ok: true,
    value: {
      code,
      profile,
      supportingFiles: [
        ...(contextArtifacts?.files ?? []),
        ...staticDeclarations.files,
        ...(usesStyle ? [nativeStyleArtifact] : []),
        ...(projectsState ? [nativeExposeStateWebArtifact] : []),
        ...(usesInteraction ? [nativeInteractionArtifact, nativeAdapterModulesArtifact] : []),
      ],
      dependencies: [
        ...selected.value.dependencies.map((dependency) => ({ ...dependency })),
        ...(options.ssr
          ? [{ name: 'vue-server-renderer', version: '2.6.14', role: 'target' as const }]
          : []),
      ],
      provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: profile },
    },
  };
}

// This is target-specific generated host code, never a shared IR interpreter.
function nativeHelpers(
  context: {
    owner: string;
    run: string;
    read: string;
    def: string;
    handle: string;
    dispose: string;
    setupFailure: string;
  },
  styled: boolean,
  interactive: boolean,
  ssr: boolean,
  projectsState: boolean,
  declarations: string,
  tableFamily: string,
  stateWebMode: string
): string {
  const refresh = `${styled ? 'style.refresh();' : ''}${interactive ? ' interaction.refresh();' : ''}`;
  return String.raw`
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
  ${styled ? "const tokens = props && PUIOwn(a, 'style') ? PUITemplateStyleTokens(a.style) : undefined;" : ''}
  return Object.freeze({ tag, children${styled ? ', tokens' : ''} });
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
  return [h(value.tag, { pre: true${styled ? ", attrs: value.tokens === undefined ? {} : { 'data-pui-style': value.tokens }" : ''} }, PUIChildren(value.children, h, vm, slots))];
}
function PUIRootData(properties, attrs, serializeValue) {
  const result = { pre: true, attrs: { ...attrs } };
  for (const [key, value] of Object.entries(properties)) {
    // Browser value/IME writes belong to TextControl; only server HTML serializes value.
    if (key === 'value') { if (serializeValue) result.domProps = { value }; }
    else if (key === 'style') result.style = value;
    else result.attrs[key] = value === false ? null : value === true ? '' : value;
  }
  return result;
}
function PUICreateOwner(vm, setup, types, rootTag, autoUpdate) {
  ${
    ssr
      ? `let session, initialProjection, requestIndex, sourceIdentity;
  let initialized = false;
  let shell = false;
  let bootRaw = false;
  let firstContinuation = false;`
      : ''
  }
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
  ${styled || interactive || projectsState ? 'let activeRoot = null;' : ''}
  ${interactive ? 'let activeEpoch = -1;' : ''}
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
  ${
    projectsState
      ? `const stateWeb = PUICreateExposeStateWeb({
    isAlive: () => !terminal && !disposed && hostActive && viewActive,
    getHost: () => activeRoot,
    mode: ${stateWebMode},
  });`
      : ''
  }
  const eventDeclarations = Object.create(null);
  const lifecycle = { created: [], mounted: [], updated: [], unmounted: [], beforeDispose: [] };
  const notifications = [];
  ${interactive ? 'const observedExternals = new WeakMap();' : ''}
  let notifying = false;
  let portalAnchor = null, portalRoot = null;
  function syncPortal(target, destination) {
    if (portalRoot && portalRoot !== target) restorePortal();
    if (destination && target?.nodeType === 1) {
      if (!portalAnchor) { portalAnchor = target.ownerDocument.createComment('pui-portal'); target.parentNode?.insertBefore(portalAnchor, target); portalRoot = target; }
      if (target.parentNode !== destination) destination.appendChild(target);
    } else restorePortal();
  }
  function restorePortal() {
    if (portalRoot && portalAnchor?.parentNode) portalAnchor.parentNode.insertBefore(portalRoot, portalAnchor);
    portalAnchor?.remove(); portalAnchor = portalRoot = null;
  }
  let dispatchingProps = false;
  const alive = () => { if (disposed) throw new Error('[Vue2 native] logical instance has been disposed.'); };
  const publicAlive = () => { if (terminal) throw new Error('[Vue2 native] exposed target has been terminally invalidated.'); };
  const callback = () => { alive(); if (phase !== 'callback') throw new Error('[Vue2 native] mutation requires callback scope.'); };
  const setupOnly = () => { alive(); if (phase !== 'setup') throw new Error('[Vue2 native] declaration requires setup scope.'); };
${
  styled
    ? `  const style = PUICreateNativeStyle({
    ensureSetup: setupOnly,
    ensureRuntime: callback,
    isAlive: () => !terminal && !disposed,
    project: (tokens) => {
      if (!activeRoot) return;
      if (tokens.length) activeRoot.setAttribute('data-pui-style', tokens.join(' '));
      else activeRoot.removeAttribute('data-pui-style');
    },
  });`
    : ''
}
  const hostRaw = () => {
    ${ssr ? `if (bootRaw) return PUIDecodeRaw(initialProjection.raw);` : ''}
    // Full snapshots preserve omission and explicit undefined. Vue Boolean casting and
    // default materialization never participate in the semantic prop contract.
    const out = Object.create(null);
    const input = { ...(vm.$attrs || {}), ...((vm.$options && vm.$options.propsData) || {}) };
    const provided = (vm.$options && vm.$options.propsData) || {};
    for (const key of Object.keys(types)) {
      const hostKey = key.replace(/-(\w)/g, (_match, letter) => letter.toUpperCase());
      // Track native prop notifications, but keep values/presence from the raw snapshot.
      if (vm.$props) void vm.$props[hostKey];
      if (PUIOwn(provided, hostKey)) input[key] = provided[hostKey];
    }
    for (const key of Object.keys(input)) out[key] = input[key];
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
      const value = input[key] === undefined ? null : input[key];
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
    try { if (sync && !terminal ${ssr ? '&& !(firstContinuation && !bootRaw)' : ''}) syncHost(false); return fn(); }
    finally { phase = previousPhase; }
  };
  const syncHost = (request) => {
    if (terminal) return;
    const nextRaw = hostRaw();
    if (hydrated && same(raw, nextRaw)) return;
    const previousRaw = raw;
    const previous = resolved;
    const next = resolveProps(nextRaw, true);
    raw = nextRaw; resolved = next.snapshot;
    if (!hydrated) { hydrated = true; ${refresh} return; }
    const changedKeys = Object.keys(specs).filter((key) => !Object.is(previous[key], resolved[key]));
    const changedRawKeys = watchers.some((watch) => watch.active && (watch.kind === 'raw' || watch.kind === 'raw-all'))
      ? [...new Set([...Object.keys(previousRaw), ...Object.keys(raw)])].filter((key) => PUIOwn(previousRaw, key) !== PUIOwn(raw, key) || !Object.is(previousRaw[key], raw[key])) : [];
    ${refresh ? `if (changedKeys.length) { ${refresh} }` : ''}
    if ((changedKeys.length || changedRawKeys.length) && !dispatchingProps) {
      dispatchingProps = true;
      try {
        invoke(() => {
          // Raw-all precedes raw-keyed; resolved-all and keyed share declaration order.
          const snapshot = watchers.slice();
          for (let group = 0; group < 3; ++group) {
            for (const watch of snapshot) {
              if (!watch.active || (watch.kind === 'raw-all' ? 0 : watch.kind === 'raw' ? 1 : 2) !== group) continue;
              const isRaw = group < 2;
              const changedKeysAll = isRaw ? changedRawKeys : changedKeys;
              const changedKeysMatched = watch.keys === null ? changedKeysAll : watch.keys.filter((key) => changedKeysAll.includes(key));
              if (changedKeysMatched.length) watch.fn(run, isRaw ? nextRaw : next.snapshot,
                isRaw ? previousRaw : previous, { changedKeysAll: [...changedKeysAll], changedKeysMatched: [...changedKeysMatched] });
            }
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
    ${interactive ? 'if (!next) interaction.unmount();' : ''}
    // A fresh mount always re-renders retained logical state. A canceled detach is
    // still a presence request, not a React-style reactive state write.
    if (next && nativeMounted && hostActive && viewActive) renderSemantic();
    force();
  };
${context.owner}
  const run = {
    ${context.run}
    ${styled ? 'feedback: { style },' : ''}
    update: () => { callback(); update(); },
    props: {
      get: () => { alive(); return resolved; },
      getRaw: () => { alive(); return raw; },
      isProvided: (key) => { alive(); return PUIOwn(raw, key); },
    },
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
  ${
    interactive
      ? `/** @type {PUINativeInteraction<typeof run>} */
  const interaction = PUICreateNativeInteraction({
    ensureSetup: setupOnly,
    ensureRuntime: callback,
    ensureEvent: callback,
    isAlive: () => !terminal && !disposed,
    isSetupComplete: () => phase !== 'setup',
    isReady: () => phase !== 'setup' && viewActive && present && hostActive && !terminal,
    invoke: (fn) => invoke(fn),
    getRun: () => run,
    getResolvedProps: () => resolved,
    subscribeState: (state, fn) => (state.external ?? observedExternals.get(state) ?? state).subscribe(fn),
    getRoot: () => viewActive && present && hostActive && activeEpoch === epoch ? activeRoot : null,
    identity: contextScope, getLogicalParent: () => vm[${JSON.stringify('PUIParentScope')}] || null,
    declarations: ${declarations}, tableFamily: ${tableFamily},
    getExposes: () => exposed,
    registerExpose: (key, value) => {
      setupOnly(); if (PUIOwn(exposed, key)) throw new Error('[Expose] duplicate declaration: ' + key);
      if (value?.external) exposed[key] = value.external;
      else if (typeof value === 'function') exposed[key] = (...args) => { publicAlive(); return invoke(() => value(...args)); };
      else if (key === 'controls' && value) exposed[key] = Object.fromEntries(Object.entries(value).map(([name, action]) => [name, (...args) => { publicAlive(); return invoke(() => action(...args)); }]));
      else exposed[key] = value;
    },
    createOwnedState: (name, value, spec) => createState(spec?.kind ?? (typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'number.discrete' : 'string'), name, value, spec),
    watchState: (state, fn) => { setupOnly(); return state.external.subscribe(event => invoke(() => fn(run, event))); },
    isPropProvided: key => PUIOwn(raw, key),
    declareTransition(hooks) {
      def.props.define({open:{type:'boolean'},defaultOpen:{type:'boolean',default:false},appear:{type:'boolean',default:false},enterDuration:{type:'number',default:300},leaveDuration:{type:'number',default:200},interrupt:{type:'enum',options:['reverse','wait','immediate'],default:'reverse'}});
      for (const key of ['beforeEnter','afterEnter','beforeLeave','afterLeave']) def.expose.event(key);
      lifecycle.created.push(hooks.created); lifecycle.mounted.push(hooks.mounted); lifecycle.unmounted.push(hooks.unmounted); lifecycle.beforeDispose.push(hooks.beforeDispose);
      def.props.watch(['open','interrupt','enterDuration','leaveDuration'], hooks.propsChanged);
    },
    setPresent, requestHostUpdate: force,
    emit: (key) => run.expose.emit(key),
    registerGenericObservedState: (handle) => {
      const subscribers = new Set();
      const off = handle.subscribe((event) => {
        ${refresh}
        notifications.push(() => { for (const subscriber of Array.from(subscribers)) if (subscribers.has(subscriber)) subscriber(event); });
        if (notifying) return;
        notifying = true;
        try { while (notifications.length) notifications.shift()(); }
        finally { notifying = false; }
      });
      const external = Object.freeze({
        get: () => { publicAlive(); return handle.get(); },
        subscribe: (fn) => { publicAlive(); subscribers.add(fn); return () => subscribers.delete(fn); },
        unsubscribe: (unsubscribe) => { publicAlive(); if (typeof unsubscribe === 'function') unsubscribe(); },
        spec: Object.freeze({ ...(handle.spec ?? { kind: typeof handle.get() === 'boolean' ? 'bool' : typeof handle.get() === 'number' ? 'number.discrete' : 'string' }), observed: true }),
      });
      observedExternals.set(handle, external);
      ${
        projectsState
          ? `stateWeb.track(external, { semantic: handle.semantic, kind: external.spec.kind, get: () => handle.get(),
        subscribe(fn) { subscribers.add(fn); return () => { subscribers.delete(fn); }; } });`
          : ''
      }
      states.push({ dispose: () => {
        off();
        try { for (const fn of Array.from(subscribers)) fn({ type: 'disconnect', reason: 'unmount' }); }
        finally { subscribers.clear(); }
      } });
    },
  });`
      : ''
  }
  const renderer = { el: PUIElement, slot: () => Object.freeze({ slot: true }),
    read: Object.freeze({ props: Object.freeze({ get: () => { alive(); return resolved; }, getRaw: () => { alive(); return raw; }, isProvided: (key) => { alive(); return PUIOwn(raw, key); } }) ${context.read} }) };
  const createState = (kind, key, initial, configuration = {}) => {
    setupOnly();
    const spec = Object.freeze({ ...configuration, kind });
    const check = (value, initialValue = false) => {
      const expected = kind === 'bool' ? 'boolean' : kind === 'string' || kind === 'enum' ? 'string' : 'number';
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
      setDefault: next => { setupOnly(); value = check(next, true); },
      set: (next, reason) => {
        callback();
        next = check(next);
        if (Object.is(value, next)) return;
        const previous = value; value = next;
        ${refresh}
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
    ${
      projectsState
        ? `stateWeb.track(handle.external, { semantic: key, kind, get: () => value,
      subscribe(fn) { subscribers.add(fn); return () => { subscribers.delete(fn); }; } });`
        : ''
    }
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
  const registerPropsWatch = (kind, keys, fn) => {
    setupOnly();
    if (keys !== null && (!keys.length || keys.some((key) => typeof key !== 'string'
      || kind === 'resolved' && !PUIOwn(specs, key)))) throw new Error('[Vue2 native] watch requires non-empty valid prop keys.');
    const watch = { kind, keys: keys === null ? null : [...keys], fn, active: true };
    watchers.push(watch);
    return () => { watch.active = false; };
  };
  const def = {
    ${context.def}
    ${styled ? 'feedback: { style },' : ''}
    ${interactive ? 'event: interaction.event,' : ''}
    props: {
      define: defineProps,
      setDefaults: (layer) => {
        setupOnly();
        for (const key of Object.keys(layer)) if (!PUIOwn(specs, key) || !PUIJson(layer[key])) throw new Error('[Vue2 native] invalid prop default: ' + key);
        defaults.unshift({ ...layer }); resolved = resolveProps(raw, false).snapshot;
      },
      watch: (keys, fn) => registerPropsWatch('resolved', keys, fn),
      watchAll: (fn) => registerPropsWatch('resolved-all', null, fn),
      watchRaw: (keys, fn) => registerPropsWatch('raw', keys, fn),
      watchRawAll: (fn) => registerPropsWatch('raw-all', null, fn),
    },
    state: {
      bool: (key, value) => createState('bool', key, value),
      string: (key, value, spec) => createState('string', key, value, spec),
      enum: (key, value, spec) => createState('enum', key, value, spec),
      numberDiscrete: (key, value, spec) => createState('number.discrete', key, value, spec),
      numberRange: (key, value, spec) => createState('number.range', key, value, spec),
    },
    expose: {
      value: (key, value) => { setupOnly(); if (PUIOwn(exposed, key)) throw new Error('[Expose] duplicate declaration'); exposed[key] = value; },
      state: (key, handle) => { setupOnly(); exposed[key] = ${interactive ? 'observedExternals.get(handle) ?? ' : ''}handle.external; ${projectsState ? 'stateWeb.expose(key, exposed[key]);' : ''} },
      method: (key, fn) => { setupOnly(); exposed[key] = (...args) => { publicAlive(); return invoke(() => fn(...args)); }; },
      event: (key, spec) => { setupOnly(); eventDeclarations[key] = spec; },
    },
    lifecycle: Object.fromEntries(Object.keys(lifecycle).map((key) => ['on' + key[0].toUpperCase() + key.slice(1), (fn) => { setupOnly(); lifecycle[key].push(fn); }])),
  };
  const fire = (kind) => invoke(() => { for (const fn of lifecycle[kind]) fn(run); }, !terminal);
  const detach = () => {
    if (!viewActive) return;
    viewActive = false; pending = null; queued = false;
    ${projectsState ? 'stateWeb.unmount();' : ''}
    restorePortal();
    ${interactive ? 'interaction.unmount();' : ''}
    ${styled ? "style.unmount();\n    if (activeRoot) activeRoot.removeAttribute('data-pui-style');" : ''}
    ${styled || interactive || projectsState ? 'activeRoot = null;' : ''}
    fire('unmounted');
  };
  const afterCommit = () => {
    if (terminal) return;
    ${ssr ? 'if (!firstContinuation) syncHost(true);' : 'syncHost(true);'}
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
      ${interactive ? 'syncPortal(target, interaction.portalTarget());' : ''}
      const kind = commit.kind;
      if (kind === 'mount' && !viewActive) {
        viewActive = true;
        ${styled || interactive || projectsState ? 'activeRoot = target;' : ''}
        ${
          interactive
            ? `activeEpoch = epoch;
        ${ssr ? 'if (firstContinuation) interaction.adoptAttributes(initialProjection.attributes);' : ''}
        interaction.mount();`
            : ''
        }
        ${interactive ? 'if (terminal || commit.epoch !== epoch || !present || !hostActive) return;' : ''}
        ${styled ? 'style.mount();' : ''}
        ${projectsState ? 'stateWeb.mount();' : ''}
        fire('mounted');
        ${ssr ? `if (firstContinuation) { firstContinuation = false; syncHost(true); }` : ''}
      } else if (viewActive) {
        ${
          interactive
            ? `if (activeRoot !== target || activeEpoch !== epoch) {
          activeRoot = target; activeEpoch = epoch;
          interaction.mount();
        }
        if (terminal || commit.epoch !== epoch || !present || !hostActive) return;`
            : ''
        }
        ${
          projectsState
            ? `if (activeRoot !== target) { activeRoot = target; stateWeb.mount(); }
        else stateWeb.refresh();`
            : ''
        }
        if (kind !== 'update' || !pending || pending.revision !== commit.revision) return;
        pending = null;
        const again = queued; queued = false;
        fire('updated');
        if (again && present && viewActive && !terminal && !pending) update();
      }
    });
  };
  const owner = {
    ${context.handle}
    host() { return viewActive && present && hostActive && !terminal ? vm.$el : null; },
    ${interactive ? 'interaction,' : ''}
    def,
    get resolvedProps() { return resolved; },
    ${
      ssr
        ? `bindSession(value, source) {
      session = value; sourceIdentity = source;
      if (session.closed) { owner.dispose(); throw new Error('[Vue2 SSR] request already retired.'); }
      requestIndex = session.owners.length;
      session.owners.push(owner);
      if (session.mode === 'hydrate') {
        initialProjection = session.carrier.projections[requestIndex];
        if (!initialProjection || initialProjection.source !== source || typeof initialProjection.rootTag !== 'string'
          || typeof initialProjection.present !== 'boolean' || !initialProjection.attrs || typeof initialProjection.attrs !== 'object'
          || Array.isArray(initialProjection.attrs) || Object.values(initialProjection.attrs).some((value) => value !== null && typeof value !== 'string')
          || !initialProjection.attributes || typeof initialProjection.attributes !== 'object' || Array.isArray(initialProjection.attributes)
          || Object.values(initialProjection.attributes).some((value) => value !== null && typeof value !== 'string')) throw new Error('[Vue2 SSR] source/profile projection mismatch.');
        shell = true;
      }
    },
    acceptHydration() {
      if (terminal || !shell) return;
      bootRaw = true;
      owner.initialize();
      bootRaw = false;
      shell = false;
      if (present !== initialProjection.present || (${interactive ? 'interaction.rootTag() || rootTag' : 'rootTag'}) !== initialProjection.rootTag) throw new Error('[Vue2 SSR] initial owner Root/presence differs from server projection.');
      if (present) { renderSemantic(); if (JSON.stringify(template) !== JSON.stringify(initialProjection.template)) throw new Error('[Vue2 SSR] initial owner template differs from server projection.'); }
      firstContinuation = initialProjection.present && present;
      unwatch = vm.$watch(() => hostRaw(), () => syncHost(true), { deep: true });
      // The accepted carrier is a render snapshot, not transferred State or handles.
      template = initialProjection.template;
      if (initialProjection.present && renderedCommit) {
        // Once accepted, Root presentation is imperative owner output. Do not let a
        // later ordinary Vue render diff the transport attrs against style-only changes.
        renderedCommit.vnode.data.attrs = { 'data-pui-root': '' };
      }
      owner.hostMounted();
      if (present !== initialProjection.present) force();
      if (!initialProjection.present) syncHost(true);
    },`
        : ''
    }
    initialize() {
      ${
        ssr
          ? `if (shell && !bootRaw || initialized) return;
      initialized = true;`
          : ''
      }
      try {
        renderFunction = setup(owner);
        if (typeof renderFunction !== 'function') renderFunction = (renderer) => renderer.slot();
        phase = 'idle';
        syncHost(false);
        fire('created');
        ${ssr ? `if (!session || session.mode === 'client' && !bootRaw)` : ''} unwatch = vm.$watch(() => hostRaw(), () => syncHost(true), { deep: true });
      } catch (error) {
        ${
          ssr
            ? `try { owner.dispose(); }
        catch (cleanupError) { throw new AggregateError([error, cleanupError], '[Vue2 SSR] initialization and cleanup failed.'); }
        throw error;`
            : `
        terminal = true;
        ${interactive ? 'try { interaction.dispose(); } catch {}\n        for (const state of states) { try { state.dispose(); } catch {} }' : ''}
        ${styled ? 'try { style.dispose(); } catch {}' : ''}
        ${context.setupFailure ? `try { ${context.setupFailure} } catch {}` : ''}
        disposed = true;
        phase = 'idle';
        throw error;`
        }
      }
    },
    hostMounted() { ${ssr ? 'if (shell) return;' : ''} nativeMounted = true; afterCommit(); },
    afterCommit,
    render(h) {
      ${
        ssr
          ? `if (shell) {
        const vnode = initialProjection.present
          ? h(initialProjection.rootTag, PUIRootData(initialProjection.properties, initialProjection.attrs, false), PUIChildren(initialProjection.template, h, vm, { used: false })) : h();
        renderedCommit = { epoch, version: ++commitVersion, present: initialProjection.present, vnode, kind: initialProjection.present ? 'mount' : 'detach' };
        return vnode;
      }
      if (session && session.mode === 'server') {
        if (present && hostActive && !terminal) renderSemantic();
        const attributes = ${interactive ? 'interaction.projectAttributes()' : '{}'};
        const attrs = { 'data-pui-root': '', ${styled ? "'data-pui-style': style.serverTokens().join(' ')," : ''} ...attributes };
        if (attrs['data-pui-style'] === '') delete attrs['data-pui-style'];
        const tag = ${interactive ? 'interaction.rootTag() || rootTag' : 'rootTag'}, properties = ${interactive ? 'interaction.rootProperties()' : '{}'};
        const children = PUIChildren(template, h, vm, { used: false });
        if (['input', 'textarea', 'img'].includes(tag) && children.length) throw new Error('[Template] physical control Root requires empty children.');
        const projection = { source: sourceIdentity, rootTag: tag, properties, present: present && hostActive && !terminal, raw: PUIEncodeRaw(raw), template: JSON.parse(JSON.stringify(template ?? null)), attrs, attributes };
        // This validates transport data only; callbacks and logical handles never cross.
        if (!PUIJson(projection)) throw new TypeError('[Vue2 SSR] render projection is not serializable.');
        session.projections[requestIndex] = projection;
        return projection.present ? h(tag, PUIRootData(properties, attrs, true), children) : h();
      }`
          : ''
      }
      if (terminal || !present || !hostActive) {
        const vnode = h();
        renderedCommit = { epoch, version: ++commitVersion, present: false, vnode, kind: 'detach' };
        return vnode;
      }
      if (!viewActive) renderSemantic();
      const tag = ${interactive ? 'interaction.rootTag() || rootTag' : 'rootTag'};
      const children = PUIChildren(template, h, vm, { used: false });
      if (['input', 'textarea', 'img'].includes(tag) && children.length) throw new Error('[Template] physical control Root requires empty children.');
      const vnode = h(tag, PUIRootData(${interactive ? 'interaction.rootProperties()' : '{}'}, { 'data-pui-root': '' }, false), children);
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
      ${projectsState ? 'stateWeb.dispose();' : ''}
      unwatch?.(); unwatch = undefined;
      let failure;
      try { detach(); } catch (error) { failure = error; }
      ${ssr ? 'if (initialized)' : ''} try { fire('beforeDispose'); } catch (error) { failure ??= error; }
      for (const state of states) {
        try { state.dispose(); } catch (error) { failure ??= error; }
      }
      ${context.dispose}
      ${interactive ? 'try { interaction.dispose(); } catch (error) { failure ??= error; }' : ''}
      ${
        styled
          ? `try { style.dispose(); } catch (error) { failure ??= error; }
      const target = vm.$el;
      if (target && target.nodeType === 1 && target.hasAttribute('data-pui-root')) target.removeAttribute('data-pui-style');`
          : ''
      }
      disposed = true; phase = 'idle';
      watchers.length = 0; notifications.length = 0; states.length = 0; defaults.length = 0;
      for (const key of Object.keys(lifecycle)) lifecycle[key].length = 0;
      for (const key of Object.keys(exposed)) delete exposed[key];
      for (const key of Object.keys(eventDeclarations)) delete eventDeclarations[key];
      specs = Object.create(null); previousValid = Object.create(null); raw = resolved = Object.freeze({}); template = renderFunction = null;
      ${
        ssr
          ? `if (session && session.mode === 'client') {
        const index = session.owners.indexOf(owner);
        if (index >= 0) session.owners.splice(index, 1);
      }`
          : ''
      }
      if (failure) throw failure;
    },
  };
  return owner;
}
`;
}
