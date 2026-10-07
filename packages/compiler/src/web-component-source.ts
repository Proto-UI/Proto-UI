import { dataTypeEqual, formatDataType } from './data-types';
import { isDataValueType } from './ir';
import { validateIR, validIdentifier } from './ir-validation';
import { FOCUS_OPTIONS_TYPE, OPERATION_RULES } from './operations';
import { checkTargetOperations, resolveTargetProfile } from './targets';
import { buildNativeContextArtifacts, emitNativeContextValidation } from './native-context';
import { emitNativeStyleHandle, emitNativeRule, nativeStyleArtifact } from './native-style';
import { nativeInteractionArtifact } from './native-interaction';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';
import { buildNativeStaticDeclarations } from './native-static-declarations';
import { webComponentSsrSupport } from './web-component-ssr-support';
import { createHash } from 'node:crypto';
import type {
  CompileResult,
  ExpressionIR,
  FunctionIR,
  GeneratedModule,
  PrototypeIR,
  StatementIR,
  ValueType,
} from './ir';

const SUPPORTED: Record<string, true> = {
  'run.update': true,
  'render.read.props.get': true,
  'props.define': true,
  'props.setDefaults': true,
  'props.watch': true,
  'props.get': true,
  'props.watchAll': true,
  'props.watchRaw': true,
  'props.watchRawAll': true,
  'props.getRaw': true,
  'props.isProvided': true,
  'render.read.props.getRaw': true,
  'render.read.props.isProvided': true,
  'state.bool': true,
  'state.string': true,
  'state.numberDiscrete': true,
  'state.numberRange': true,
  'state.get': true,
  'state.set': true,
  'expose.state': true,
  'expose.event': true,
  'expose.method': true,
  'expose.emit': true,
  'lifecycle.setPresent': true,
  'lifecycle.onCreated': true,
  'lifecycle.onMounted': true,
  'lifecycle.onUpdated': true,
  'lifecycle.onUnmounted': true,
  'lifecycle.onBeforeDispose': true,
  'render.el': true,
  'render.slot': true,
  'context.provide': true,
  'context.subscribe': true,
  'context.trySubscribe': true,
  'context.read': true,
  'context.tryRead': true,
  'context.update': true,
  'context.tryUpdate': true,
  'render.read.context.read': true,
  'render.read.context.tryRead': true,
  'feedback.style.use': true,
  'feedback.style.release': true,
  'feedback.style.patch': true,
  'feedback.style.suppress': true,
  'feedback.style.clearPatch': true,
  'rule.dispose': true,
  'hook.asTrigger': true,
  'hook.asFocusable': true,
  'hook.asAccessible': true,
  'event.on': true,
  'event.onGlobal': true,
  'event.requestDefaultActionPrevention': true,
  'focus.configure': true,
  'focus.setDisabled': true,
  'focus.focusSelf': true,
  'accessible.state': true,
  'accessible.action': true,
  'accessible.role': true,
  'accessible.nameFromContent': true,
};

/** Direct native DOM source. The emitted helper kernel owns resources; it never interprets IR. */
export function emitWebComponentSource(
  input: PrototypeIR,
  options: { className?: string; tagName?: string; ssr?: boolean; shadow?: boolean } = {}
): CompileResult<GeneratedModule> {
  const checked = validateIR(input);
  if (!checked.ok) return checked;
  const ir = checked.value;
  const selected = resolveTargetProfile('web-component-source-v1');
  if (!selected.ok) return selected;
  const admitted = checkTargetOperations(ir, selected.value);
  if (!admitted.ok) return admitted;
  const reachedFunctions = new Set(admitted.value.functions);
  const reachedHooks = new Set(admitted.value.authoredHooks);
  const interacting =
    ir.moduleDeclarations.length > 0 ||
    admitted.value.operations.some((operation) =>
      /^(hook\.|event\.|focus\.|accessible\.|anatomy\.)/.test(operation)
    );
  const outwardEvents = admitted.value.operations.includes('expose.emit');
  const interactionArtifact = interacting || outwardEvents;
  const className = options.className ?? 'CompiledElement';
  const tagName = options.tagName ?? 'pui-compiled-element';
  const profile = options.ssr ? 'web-component-ssr-v1' : 'web-component-source-v1';
  const reject = (message: string, span = ir.setup.span): CompileResult<GeneratedModule> => ({
    ok: false,
    diagnostics: [{ code: 'PUI3301', category: 'unsupported-input', message, span }],
  });
  if (
    !validIdentifier(className) ||
    [
      'GeneratedProps',
      'GeneratedExposes',
      'register',
      'HTMLElement',
      'Node',
      'ShadowRoot',
      'CustomElementRegistry',
      'CustomEvent',
      'customElements',
      'queueMicrotask',
      'Object',
      'Number',
      'Array',
      'Set',
      'Map',
      'Symbol',
      'Error',
      'Math',
      'String',
      'Function',
      'Readonly',
      'Record',
      'Partial',
      'undefined',
    ].includes(className) ||
    (options.ssr &&
      [
        'createHydrationOwner',
        'hydrationBinding',
        'defaultTagName',
        'HydrationOwner',
        'Carrier',
        'BrowserPort',
        'HostPort',
        'Presentation',
        'HydrationMismatch',
        'AggregateError',
        'createBrowserPort',
        'readCarrier',
        'checkCarrier',
        'decodeRaw',
        'pendingProviderDefinition',
        'hydrate',
        'renderToString',
        'renderWithScope',
      ].includes(className))
  ) {
    return reject('Choose a valid, non-reserved custom element class identifier.');
  }
  if (
    !/^[a-z][a-z0-9._-]*-[a-z0-9._-]+$/.test(tagName) ||
    [
      'annotation-xml',
      'color-profile',
      'font-face',
      'font-face-src',
      'font-face-uri',
      'font-face-format',
      'font-face-name',
      'missing-glyph',
    ].includes(tagName)
  ) {
    return reject('Choose a valid lowercase autonomous custom element tag name.');
  }
  const names = new Set<string>([className]);
  let styled = false;
  const unsupported: { message: string; span: PrototypeIR['setup']['span'] }[] = [];
  const scanned = new Set<object>();
  function scan(value: unknown): void {
    if (value && typeof value === 'object') {
      if (scanned.has(value)) return;
      scanned.add(value);
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        scan(entry);
        if (entry && typeof entry === 'object' && entry.kind === 'return') break;
      }
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (node.kind === 'function' && !reachedFunctions.has(node.function as FunctionIR)) return;
    if (
      node.kind === 'style-handle' ||
      node.kind === 'rule' ||
      (node.kind === 'operation' && String(node.operation).startsWith('feedback.style.'))
    )
      styled = true;
    if (node.kind === 'operation' && node.operation === 'render.el') {
      const args = node.arguments as ExpressionIR[];
      const tag = args[0];
      if (tag.kind === 'literal' && typeof tag.value === 'string' && tag.value.includes('-')) {
        unsupported.push({
          message:
            'web-component-source-v1 does not implement stable custom-element template child reconciliation; compose generated owners through native light DOM and slots.',
          span: tag.span,
        });
      }
      const props = args.length > 2 ? args[1] : args[1]?.kind === 'record' ? args[1] : undefined;
      if (
        props &&
        (props.kind !== 'record' ||
          props.entries.length > 1 ||
          props.entries.some(
            (entry) =>
              entry.key !== 'style' ||
              entry.value.type !== 'style-handle' ||
              !['style-handle', 'reference'].includes(entry.value.kind)
          ))
      ) {
        unsupported.push({
          message:
            'web-component-source-v1 supports only one static tw handle under TemplateProps.style.',
          span: props.span,
        });
      }
    }
    for (const [key, item] of Object.entries(node)) {
      if (key === 'name' && typeof item === 'string') names.add(item);
      scan(item);
    }
  }
  for (const reached of admitted.value.functions) {
    for (const parameter of reached.parameters) names.add(parameter.name);
    for (const statement of reached.body) {
      scan(statement);
      if (statement.kind === 'return') break;
    }
  }
  if (unsupported.length)
    return {
      ok: false,
      diagnostics: unsupported.map(({ message, span }) => ({
        code: 'PUI3302',
        category: 'unsupported-input',
        message,
        span,
      })),
    };
  let prefix = '__wc';
  while ([...names].some((name) => name.startsWith(prefix))) prefix += '_';
  const context = buildNativeContextArtifacts(ir);
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
  const keyNames = new Map(ir.contextKeys.map((key, index) => [key.id, `${prefix}Key${index}`]));
  const contextTypes = new Map(ir.contextKeys.map((key) => [key.id, formatDataType(key.type)]));
  const contextImports = context
    ? `import {createContextScope as ${prefix}CreateContextScope, ownerScopes as ${prefix}OwnerScopes, acceptsContextValue as ${prefix}Accepts, type ContextScope as ${prefix}ContextScope} from ${JSON.stringify(context.scopeFile.replace(/\.ts$/, ''))};\n${[...context.keys].map(([id, key]) => `import {key as ${keyNames.get(id)}} from ${JSON.stringify(key.file.replace(/\.ts$/, ''))};`).join('\n')}\n${interacting ? `import type { NativeModuleCapability as ${prefix}NativeModuleCapability } from './.proto-ui/interaction/adapter-modules-v1';\n` : ''}`
    : '';
  const contextValidation = context
    ? emitNativeContextValidation(ir, keyNames, `${prefix}Accepts`)
    : '';
  const hooks = new Map(ir.hooks.map((hook, index) => [hook.id, `${prefix}Hook${index}`]));
  function typeName(type: ValueType): string {
    if (isDataValueType(type))
      return interacting && dataTypeEqual(type, FOCUS_OPTIONS_TYPE)
        ? `${prefix}NativeFocusOptions`
        : formatDataType(type);
    if (typeof type === 'string' && type.startsWith('nullable:'))
      return `${typeName(type.slice(9) as ValueType)} | null`;
    if (typeof type === 'string' && type.startsWith('optional:'))
      return `${typeName(type.slice(9) as ValueType)} | undefined`;
    if (type.startsWith('borrowed:'))
      return `${prefix}State<${type.slice(9)}> & {watch(callback: (run: ${prefix}Run, event: {type:'next';prev:${type.slice(9)};next:${type.slice(9)};reason?:unknown}|{type:'disconnect';reason:'unmount'}) => void): () => void}`;
    if (type.startsWith('state-event:') || type.startsWith('state-next:'))
      return `{type:'next';prev:${type.split(':')[1]};next:${type.split(':')[1]};reason?:unknown}${type.startsWith('state-event:') ? "|{type:'disconnect';reason:'unmount'}" : ''}`;
    if (type === 'state-disconnect') return `{type:'disconnect';reason:'unmount'}`;
    if (type === 'def') return `${prefix}Def`;
    if (type === 'run') return `${prefix}Run`;
    if (type === 'render') return `${prefix}Renderer`;
    if (type.startsWith('state:')) return `${prefix}State<${type.slice(6)}>`;
    if (type.startsWith('observed:')) return `${prefix}NativeObservedState<${type.slice(9)}>`;
    if (type === 'focus') return `${prefix}NativeFocus`;
    if (type === 'accessible') return `${prefix}NativeAccessible`;
    if (type === 'event') return `${prefix}NativeInput`;
    if (type === 'host-event') return 'Event';
    if (type === 'props') return `${prefix}PropsSnapshot`;
    if (type === 'record') return 'Record<string, unknown>';
    if (type === 'array') return 'unknown[]';
    if (type === 'style-handle') return `${prefix}NativeStyleHandle`;
    if (type === 'rule-handle') return `${prefix}NativeRuleHandle`;
    return interacting
      ? `${prefix}NativeModuleCapability<${JSON.stringify(type)}, ${prefix}Run>`
      : 'unknown';
  }
  function fn(node: FunctionIR, depth: number): string {
    return `(${node.parameters.map((parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`).join(', ')}) => {\n${statements(node.body, depth + 1)}${'  '.repeat(depth)}}`;
  }
  function expr(node: ExpressionIR, depth: number): string {
    switch (node.kind) {
      case 'literal':
        return JSON.stringify(node.value);
      case 'reference':
        return node.name;
      case 'context-key':
        return `(${keyNames.get(node.keyId)} as ${prefix}ContextKey<${contextTypes.get(node.keyId)}>)`;
      case 'style-handle':
        return emitNativeStyleHandle(node.handle);
      case 'rule':
        return emitNativeRule(
          node,
          (value) => expr(value, depth),
          `${prefix}Style`,
          `${prefix}OwnerProps()`
        );
      case 'member':
        return `(${expr(node.object, depth)})${node.optional ? '?.' : ''}[${JSON.stringify(node.property)}]`;
      case 'unary':
        return `(${node.operator}${expr(node.operand, depth)})`;
      case 'binary':
        return `(${expr(node.left, depth)} ${node.operator} ${expr(node.right, depth)})`;
      case 'array':
        return `[${node.elements.map((value) => expr(value, depth)).join(', ')}]`;
      case 'record':
        return `{ ${node.entries.map((entry) => `[${JSON.stringify(entry.key)}]: ${expr(entry.value, depth)}`).join(', ')} }`;
      case 'function':
        return fn(node.function, depth);
      case 'helper-call':
        return `${node.name}(${node.arguments.map((value) => expr(value, depth)).join(', ')})`;
      case 'authored-hook':
        return `${hooks.get(node.hookId)}()`;
      case 'static-capability':
        return staticNames.get(node.declarationId)!;
      case 'operation': {
        const args = node.arguments.map((value) => expr(value, depth)).join(', ');
        if (OPERATION_RULES[node.operation].path === 'call')
          return `${expr(node.receiver!, depth)}(${args})`;
        if (node.operation.startsWith('hook.') || node.operation.startsWith('anatomy.'))
          return `${prefix}Interaction.${OPERATION_RULES[node.operation].path}(${args})`;
        return `${expr(node.receiver!, depth)}.${OPERATION_RULES[node.operation].path}(${args})`;
      }
    }
  }
  function statements(body: readonly StatementIR[], depth: number): string {
    const indent = '  '.repeat(depth);
    const terminator = body.findIndex((statement) => statement.kind === 'return');
    const deadBindings = new Set<string>();
    return body
      .slice(0, terminator < 0 ? body.length : terminator + 1)
      .map((statement) => {
        if (
          statement.kind === 'const' &&
          ((statement.value.kind === 'function' &&
            !reachedFunctions.has(statement.value.function)) ||
            (statement.value.kind === 'reference' && deadBindings.has(statement.value.name)))
        ) {
          deadBindings.add(statement.name);
          return '';
        }
        const sourceFile = JSON.stringify(statement.span.file)
          .replaceAll('\u2028', '\\u2028')
          .replaceAll('\u2029', '\\u2029');
        const origin = `${indent}// Source ${sourceFile}:${statement.span.line}:${statement.span.column}\n`;
        switch (statement.kind) {
          case 'const':
            return `${origin}${indent}const ${statement.name} = ${expr(statement.value, depth)};\n`;
          case 'effect':
            return `${origin}${indent}${expr(statement.expression, depth)};\n`;
          case 'return':
            return `${origin}${indent}return${statement.value ? ` ${expr(statement.value, depth)}` : ''};\n`;
          case 'if':
            return `${origin}${indent}if (${expr(statement.condition, depth)}) {\n${statements(statement.then, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, depth + 1)}${indent}}` : ''}\n`;
        }
      })
      .join('');
  }
  const hookCode = ir.hooks
    .filter((hook) => reachedHooks.has(hook.id))
    .map(
      (hook) => `    const ${hooks.get(hook.id)} = () => (${fn(hook.setup, 2)})(${prefix}Def);\n`
    )
    .join('');
  const props = ir.props
    .map((prop) => `  ${JSON.stringify(prop.name)}?: ${typeName(prop.type)} | null;`)
    .join('\n');
  const resolvedProps = ir.props
    .map((prop) => `  readonly ${JSON.stringify(prop.name)}: ${typeName(prop.type)};`)
    .join('\n');
  const exposes = ir.exposes
    .filter((entry) => entry.kind !== 'event')
    .map((entry) => {
      const type =
        entry.kind === 'state'
          ? `${prefix}ExternalState<${entry.type}>`
          : entry.kind === 'value'
            ? typeName(entry.type)
            : `(${entry.parameters.map((parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`).join(', ')}) => ${typeName(entry.returnType)}`;
      return `  ${JSON.stringify(entry.name)}: ${type};`;
    })
    .join('\n');
  if (options.ssr) {
    const binding = createHash('sha256').update(JSON.stringify(ir)).digest('hex');
    const imports = `${contextImports}${styled ? `import {createNativeStyle as ${prefix}CreateNativeStyle, templateStyleTokens as ${prefix}TemplateStyleTokens, type NativeStyle as ${prefix}Style, type NativeStyleHandle as ${prefix}NativeStyleHandle, type NativeRuleHandle as ${prefix}NativeRuleHandle} from './.proto-ui/style/native-v1';\n` : ''}${
      interacting
        ? `import type {NativeInteraction as ${prefix}NativeInteraction, NativeFocus as ${prefix}NativeFocus, NativeAccessible as ${prefix}NativeAccessible, NativeObservedState as ${prefix}NativeObservedState, NativeInput as ${prefix}NativeInput, NativeFocusOptions as ${prefix}NativeFocusOptions} from './.proto-ui/interaction/native-v1';
\n`
        : ''
    }`;
    const support = webComponentSsrSupport({ className, tagName, binding });
    const code = `// web-component-ssr-v1: direct semantic statements; no browser globals at module evaluation.
// Helper cost: guarded owner, presentation serialization/adoption, per-request Context and AX intent.
${imports}${support.imports}
${staticImports}
export type GeneratedProps = {\n${props}\n};
const ${prefix}PropTypes = ${JSON.stringify(Object.fromEntries(ir.props.map((prop) => [prop.name, prop.type])))};
type ${prefix}PropsSnapshot = {\n${resolvedProps}\n};
export type GeneratedExposes = {\n${exposes}\n};
${nativeHelpers(prefix, contextValidation, styled, interacting, outwardEvents, true, JSON.stringify(ir.moduleDeclarations.map(({ id, config }) => ({ id, config }))), staticNames.get('@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY') ?? 'undefined')}
export type HydrationOwner = ${prefix}Owner;
export function createHydrationOwner(port: HostPort, raw: Record<string, unknown>): ${prefix}Owner {
  const owner = ${prefix}CreateOwner(port);
  const ${prefix}Def = owner.def;
${styled ? `  const ${prefix}Style = owner.style;\n  const ${prefix}OwnerProps = owner.props;\n` : ''}${interacting ? `  const ${prefix}Interaction = owner.interaction;\n` : ''}${hookCode}
  try {
    owner.render = (${fn(ir.setup, 2)})(${prefix}Def);
    owner.hydrate(raw);
    owner.created();
    return owner;
  } catch (error) { try { owner.dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Setup and cleanup failed'); } throw error; }
}
${support.server}
`;
    return {
      ok: true,
      value: {
        code,
        profile: 'web-component-ssr-v1',
        supportingFiles: [
          ...(context?.files ?? []),
          ...staticDeclarations.files,
          ...(styled ? [nativeStyleArtifact] : []),
          nativeInteractionArtifact,
          nativeAdapterModulesArtifact,
          ...support.files,
        ],
        dependencies: [...selected.value.dependencies],
        provenance: {
          source: ir.source,
          irVersion: ir.schemaVersion,
          backend: 'web-component-ssr-v1',
        },
      },
    };
  }
  const code = `// Native web-component-source-v1: no Proto-UI Runtime/Core/Adapter dependency.
// Helper cost: owner/callback guards, scalar state + subscriptions, prop fallback/watch,
// microtask update/ViewIntent reconciliation, native shadow DOM template construction.
${context ? '// Context cost: shared reference-key modules, owner scopes, checked JSON records, dynamic logical DOM ancestry.\n' : ''}// Context ancestry follows registered generated owners, never tag names or CSS markers.
// setProps is a full raw snapshot. No automatic state-write rendering.
// Synchronous DOM moves retain the owner; settled disconnection disposes it.
// setPresent detaches only the view; explicit dispose permanently closes this element.
${contextImports}
${staticImports}
import { createBrowserPort, type BrowserPort, type HostPort, type Presentation, presentationElement, presentationChildren, isPresentation } from './.proto-ui/web-component/ssr-v1';
const ${prefix}PropTypes = ${JSON.stringify(Object.fromEntries(ir.props.map((prop) => [prop.name, prop.type])))};
${styled ? `import {createNativeStyle as ${prefix}CreateNativeStyle, templateStyleTokens as ${prefix}TemplateStyleTokens, type NativeStyle as ${prefix}Style, type NativeStyleHandle as ${prefix}NativeStyleHandle, type NativeRuleHandle as ${prefix}NativeRuleHandle} from './.proto-ui/style/native-v1';\n` : ''}
${interactionArtifact ? `import {${interacting ? `createNativeInteraction as ${prefix}CreateNativeInteraction, type NativeInteraction as ${prefix}NativeInteraction, type NativeFocus as ${prefix}NativeFocus, type NativeAccessible as ${prefix}NativeAccessible, type NativeObservedState as ${prefix}NativeObservedState, type NativeInput as ${prefix}NativeInput, type NativeFocusOptions as ${prefix}NativeFocusOptions, ` : ''}${outwardEvents ? `markNativeExposeEvent as ${prefix}MarkNativeExposeEvent` : ''}} from './.proto-ui/interaction/native-v1';\n` : ''}
export type GeneratedProps = {
${props}
};
type ${prefix}PropsSnapshot = {
${resolvedProps}
};
export type GeneratedExposes = {
${exposes}
};
${nativeHelpers(prefix, contextValidation, styled, interacting, outwardEvents, true, JSON.stringify(ir.moduleDeclarations.map(({ id, config }) => ({ id, config }))), staticNames.get('@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY') ?? 'undefined')}
export class ${className} extends HTMLElement {
  private ${prefix}Owner: ${prefix}Owner | null = null;
  private ${prefix}Port: BrowserPort | null = null;
  private ${prefix}Raw: Record<string, unknown> = {};
  private ${prefix}Disconnect = 0;
  private ${prefix}Closed = false;
  get logicalOwner(): symbol | null { return this.${prefix}Owner?.identity ?? null; }
  get viewEpoch(): number { return this.${prefix}Owner?.epoch ?? 0; }
  get present(): boolean { return this.${prefix}Owner?.view ?? false; }
  connectedCallback(): void {
    ++this.${prefix}Disconnect;
    if (this.${prefix}Closed || this.${prefix}Owner) return;
    const port = createBrowserPort(this, ${options.shadow ? "'shadow'" : "'light'"}, null, false);
    this.${prefix}Port = port;
    const owner = ${prefix}CreateOwner(port);
    this.${prefix}Owner = owner;
    const ${prefix}Def = owner.def;
${styled ? `    const ${prefix}Style = owner.style;\n    const ${prefix}OwnerProps = owner.props;\n` : ''}
${interacting ? `    const ${prefix}Interaction = owner.interaction;\n` : ''}
${hookCode}    try {
      owner.render = (${fn(ir.setup, 3)})(${prefix}Def);
      owner.hydrate(this.${prefix}Raw);
      owner.created();
      owner.reconcile();
      port.accept();
    } catch (error) {
      try { owner.dispose(); }
      finally { port.dispose(); this.${prefix}Port = null; this.${prefix}Owner = null; }
      throw error;
    }
  }
  disconnectedCallback(): void {
    const version = ++this.${prefix}Disconnect;
    const owner = this.${prefix}Owner;
    queueMicrotask(() => {
      if (version !== this.${prefix}Disconnect || this.isConnected || !owner || owner !== this.${prefix}Owner) return;
      this.${prefix}Owner = null;
      try { owner.dispose(); } finally { this.${prefix}Port?.dispose(); this.${prefix}Port = null; }
    });
  }
  setProps(next: GeneratedProps & Record<string, unknown>): void {
    if (this.${prefix}Closed) throw new Error('Custom element is disposed');
    this.${prefix}Raw = { ...next };
    if (this.${prefix}Owner) { this.${prefix}Owner.hydrate(this.${prefix}Raw); }
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
    try { owner?.dispose(); } finally { this.${prefix}Port?.dispose(); this.${prefix}Port = null; }
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
  return {
    ok: true,
    value: {
      code,
      profile: 'web-component-source-v1',
      supportingFiles: [
        ...context.files,
        ...staticDeclarations.files,
        ...(styled ? [nativeStyleArtifact] : []),
        nativeInteractionArtifact,
        nativeAdapterModulesArtifact,
        webComponentSsrSupport({ className, tagName, binding: ir.source.sha256 }).files[0],
      ],
      dependencies: [...selected.value.dependencies],
      provenance: {
        source: ir.source,
        irVersion: ir.schemaVersion,
        backend: 'web-component-source-v1',
      },
    },
  };
}

function nativeHelpers(
  p: string,
  contextValidation: string,
  styled: boolean,
  interacting: boolean,
  outwardEvents: boolean,
  ssr = false,
  declarations = '[]',
  tableFamily = 'undefined'
): string {
  const context = !!contextValidation;
  const contextTypes = context
    ? `type ${p}ContextKey<T> = object & {readonly __contextValue?: T};
type ${p}ContextRead = Readonly<{read<T>(key: ${p}ContextKey<T>): T; tryRead<T>(key: ${p}ContextKey<T>): T | null}>;
type ${p}ContextRun = ${p}ContextRead & {update<T>(key: ${p}ContextKey<T>, next: T | ((prev: T) => T)): void; tryUpdate<T>(key: ${p}ContextKey<T>, next: T | ((prev: T) => T)): boolean};
type ${p}ContextDef = {provide<T>(key: ${p}ContextKey<T>, value: T): void; subscribe<T>(key: ${p}ContextKey<T>, callback?: (run: ${p}Run, next: T, prev: T) => void): () => void; trySubscribe<T>(key: ${p}ContextKey<T>, callback?: (run: ${p}Run, next: T | null, prev: T | null) => void): () => void};
${
  ssr
    ? ''
    : `function ${p}ContextParent(host: HTMLElement): ${p}ContextScope | null {
  if (!host.isConnected) return null;
  let node: Node | null = host;
  while (node) {
    const slot: HTMLSlotElement | null = node instanceof Element ? node.assignedSlot : null;
    node = slot ?? (node instanceof ShadowRoot ? node.host : node.parentNode);
    if (node) {
      const scope = ${p}OwnerScopes.get(node);
      if (scope) return scope;
    }
  }
  return null;
}`
}
`
    : '';
  return `type ${p}ExternalState<T> = { get(): T; subscribe(cb: (event: {type: 'next'; prev: T; next: T; reason?: unknown}) => void): () => void; unsubscribe(off: () => void): void; spec: Readonly<${p}StateOptions & {kind: string}> };
type ${p}Scalar = string | number | boolean | null;
type ${p}Snapshot = Readonly<Record<string, unknown>>;
type ${p}PropSpec = {type: string; schema?: Parameters<typeof ${p}Accepts>[0]; default?: unknown; options?: readonly string[]; empty?: 'accept' | 'fallback' | 'error'; range?: {min?: number; max?: number}};
type ${p}StateOptions = {options?: readonly ${p}Scalar[]; min?: number; max?: number; step?: number; clamp?: boolean};
type ${p}State<T extends ${p}Scalar = ${p}Scalar> = {get(): T; setDefault(next: T): void; set(next: T, reason?: unknown): void; external: ${p}ExternalState<T>; subscribers: Set<Function>};
${contextTypes}type ${p}PropsRead = Readonly<{get(): ${p}PropsSnapshot; getRaw(): Readonly<Record<string, unknown>>; isProvided(key: string): boolean}>;
type ${p}Run = {host: {get(): HTMLElement | null}; ${styled ? `readonly feedback: {readonly style: ${p}Style}; ` : ''}${context ? `readonly context: ${p}ContextRun; ` : ''}update(): void; props: ${p}PropsRead; lifecycle: {setPresent(next: boolean): void}; expose: {emit(key: string, payload?: unknown, options?: CustomEventInit): void}};
type ${p}Renderer = {el(tag: string, a?: unknown, b?: unknown): ${ssr ? 'Presentation' : 'Node'}; slot(): ${ssr ? 'Presentation' : 'Node'}; readonly props: ${p}PropsRead; readonly read: Readonly<{readonly props: ${p}PropsRead${context ? `; readonly context: ${p}ContextRead` : ''}}>};
type ${p}Def = {
${styled ? `  readonly feedback: {readonly style: ${p}Style};\n` : ''}
${interacting ? `  readonly event: ${p}NativeInteraction<${p}Run>['event'];\n` : ''}
${context ? `  context: ${p}ContextDef;\n` : ''}  props: {define(input: Record<string, ${p}PropSpec>): void; setDefaults(input: Record<string, unknown>): void; watch(keys: string[], fn: Function): () => void; watchAll(fn: Function): () => void; watchRaw(keys: string[], fn: Function): () => void; watchRawAll(fn: Function): () => void};
  state: {bool(s: string, v: boolean): ${p}State<boolean>; enum(s: string, v: string, o: ${p}StateOptions): ${p}State<string>; string(s: string, v: string, o?: ${p}StateOptions): ${p}State<string>; numberDiscrete(s: string, v: number, o?: ${p}StateOptions): ${p}State<number>; numberRange(s: string, v: number, o: ${p}StateOptions): ${p}State<number>};
  expose: {value(key: string, value: unknown): void; state(key: string, handle: ${p}State${interacting ? ` | ${p}NativeObservedState<boolean | string | number>` : ''}): void; method(key: string, fn: Function): void; event(key: string, spec?: object): void};
  lifecycle: {onCreated(fn: Function): void; onMounted(fn: Function): void; onUpdated(fn: Function): void; onUnmounted(fn: Function): void; onBeforeDispose(fn: Function): void};
};
type ${p}Owner = {identity: symbol; def: ${p}Def; exposes: Record<string, unknown>; render?: Function | void; readonly epoch: number; readonly view: boolean; ${ssr ? 'serialize(): void; ' : ''}${interacting ? `readonly interaction: ${p}NativeInteraction<${p}Run>; ` : ''}${styled ? `readonly style: ${p}Style; props(): ${p}PropsSnapshot; ` : ''}hydrate(input: Record<string, unknown>): void; update(): void; reconcile(): void; created(): void; dispose(): void};
function ${p}CreateOwner(host: ${ssr ? 'HostPort' : 'HTMLElement, root: ShadowRoot'}): ${p}Owner {
  let alive = true, disposing = false, setup = true, callbackDepth = 0;
${
  interacting
    ? `  let currentRun: ${p}Run | undefined;
  const observedProjections = new Map<object, {external: ${p}ExternalState<unknown>; subscribers: Set<Function>}>();
  const observedSubscriptions: (() => void)[] = [];\n`
    : ''
}
  let intent = true, view = false, epoch = 0, queued = false, dirty = false, hostScheduled = false;
${ssr ? '' : '  let detachedDisplay: {value: string; priority: string} | undefined;'}
  let resolved: ${p}Snapshot = Object.freeze({}), raw: Readonly<Record<string, unknown>> = Object.freeze({}), hydrated = false;
  const specs: Record<string, ${p}PropSpec> = Object.create(null), previous: Record<string, unknown> = Object.create(null), defaults: Record<string, unknown>[] = [];
  const watchers: {keys: string[] | null; fn: Function; active: boolean; raw: boolean}[] = [], states: ${p}State[] = [], emissions: (() => void)[] = [];
  let emitting = false;
  const exposes: Record<string, unknown> = Object.create(null), events = new Set<string>();
  const lifecycle: Record<string, Function[]> = {created: [], mounted: [], updated: [], unmounted: [], beforeDispose: []};
  const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
  const ensure = () => { if (!alive) throw new Error('Logical owner is disposed'); };
  const ensureExternal = () => { ensure(); if (disposing) throw new Error('Logical owner is disposing'); };
  const ensureSetup = () => { ensure(); if (!setup) throw new Error('Setup capability is closed'); };
  const runtime = () => { ensure(); if (setup || !callbackDepth) throw new Error('State writes require a live callback scope'); };
${
  context
    ? `  const context = ${p}CreateContextScope({getParent: () => ${ssr ? 'host.parentContext()' : `${p}ContextParent(host)`}, isAlive: () => alive,
    invoke: <T>(callback: () => T): T => invoke(callback, [], false) as T, validate: ${contextValidation}});
`
    : ''
}
${
  styled
    ? `  const ${p}Style = ${p}CreateNativeStyle({ensureSetup, ensureRuntime: runtime, isAlive: () => alive,
    project(tokens) { ${ssr ? "host.attribute('data-pui-style', tokens.length ? tokens.join(' ') : null);" : "if (tokens.length) host.setAttribute('data-pui-style', tokens.join(' ')); else host.removeAttribute('data-pui-style');"} }});\n`
    : ''
}
${
  interacting
    ? `  const ${p}Interaction: ${p}NativeInteraction<${p}Run> = ${ssr ? 'host.createInteraction' : `${p}CreateNativeInteraction`}<${p}Run>({
    ensureSetup, ensureRuntime: runtime, ensureEvent: runtime, isAlive: () => alive, isSetupComplete: () => !setup, isReady: () => !setup && view && intent && !disposing && host.isConnected,
    invoke: <T>(callback: () => T): T => invoke(callback, [], false) as T,
    getRun() { ensure(); if (!currentRun) throw new Error('Interaction requires a live callback scope'); return currentRun; },
    getResolvedProps: () => resolved,
    getRoot: () => view && !disposing${ssr ? ' && !host.server' : ''} ? ${ssr ? 'host.root' : 'physicalRoot'} : null,
    getHost: () => ${ssr ? 'host.host' : 'host'},
    identity: context, getLogicalParent: () => ${ssr ? 'host.parentContext()' : `${p}ContextParent(host)`},
    declarations: ${declarations}, tableFamily: ${tableFamily},
    getExposes: () => exposes,
    registerExpose(key, value) {
      if (value && typeof value === 'object' && 'external' in value) expose(key, value.external);
      else if (typeof value === 'function') expose(key, (...args: unknown[]) => { ensureExternal(); return invoke(value, args, false); });
      else if (key === 'controls' && value && typeof value === 'object') expose(key, Object.fromEntries(Object.entries(value).map(([name, action]) => [name, (...args: unknown[]) => { ensureExternal(); return invoke(action as Function, args, false); }])));
      else expose(key, value);
    },
    createOwnedState: (name, value, spec) => state(spec?.kind ?? (typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'number.discrete' : 'string'), name, value, spec),
    watchState<T>(handle: {get():T}, fn: (run: ${p}Run, event: {type:'next';prev:T;next:T;reason?:unknown}|{type:'disconnect';reason:'unmount'}) => void) {
      ensureSetup();
      const external = ('external' in handle ? handle.external : observedProjections.get(handle)?.external) as ${p}ExternalState<T> | undefined;
      if (!external) throw new Error('Unknown owner State watch target');
      const off = external.subscribe(event => invoke(fn, [event]) as void); observedSubscriptions.push(off); return off;
    },
    subscribeState(handle, callback) {
      const source = 'external' in handle ? (handle as {external:${p}ExternalState<unknown>}).external : handle as ${p}NativeObservedState<unknown>;
      return source.subscribe(callback);
    },
    isPropProvided: key => own(raw, key),
    declareTransition(hooks) {
      def.props.define({open:{type:'boolean'},defaultOpen:{type:'boolean',default:false},appear:{type:'boolean',default:false},enterDuration:{type:'number',default:300},leaveDuration:{type:'number',default:200},interrupt:{type:'string',default:'reverse'}});
      for (const key of ['beforeEnter','afterEnter','beforeLeave','afterLeave']) def.expose.event(key);
      lifecycle.created.push(hooks.created); lifecycle.mounted.push(hooks.mounted); lifecycle.unmounted.push(hooks.unmounted); lifecycle.beforeDispose.push(hooks.beforeDispose);
      def.props.watch(['open','interrupt','enterDuration','leaveDuration'], hooks.propsChanged);
    },
    emit: key => { runtime(); currentRun!.expose.emit(key); },
    setPresent: value => { runtime(); if (disposing) throw new Error('Terminal presence is locked'); intent = value; schedule(false); },
    requestHostUpdate() {
      if (hostScheduled || disposing) return;
      hostScheduled = true;
      queueMicrotask(() => { hostScheduled = false; if (alive && !disposing && view) projectHost(); });
    },
    registerGenericObservedState(handle) {
      if (observedProjections.has(handle)) return;
      const subscribers = new Set<Function>();
      const external: ${p}ExternalState<boolean | string | number> = Object.freeze({
        get() { ensureExternal(); return handle.get(); }, spec: Object.freeze({kind: typeof handle.get() === 'boolean' ? 'bool' : typeof handle.get() === 'number' ? 'number.discrete' : 'string'}),
        subscribe(fn: Function) { ensureExternal(); subscribers.add(fn); return () => { subscribers.delete(fn); }; },
        unsubscribe(off: () => void) { ensureExternal(); off(); },
      });
      observedProjections.set(handle, {external, subscribers});
      observedSubscriptions.push(handle.subscribe((event) => {
${styled ? `        ${p}Style.refresh();\n` : ''}        ${p}Interaction.refresh();
        emissions.push(() => { for (const fn of [...subscribers]) { if (alive && !disposing && subscribers.has(fn)) invoke(fn, [event], false); } });
        drainEmissions();
      }));
    },
  });\n`
    : ''
}
  function invoke(fn: Function, args: unknown[] = [], withRun = true): unknown {
    ensure();
    let active = true;
    const capturedEpoch = epoch;
    const check = () => { ensure(); if (!active || capturedEpoch !== epoch) throw new Error('Callback handle is stale'); };
    const run: ${p}Run = {
      host: { get() { check(); return view && !disposing ? ${ssr ? 'host.root' : 'host'} : null; } },
${styled ? `      feedback: {style: ${p}Style},\n` : ''}
${
  context
    ? `      context: Object.freeze({
        read<T>(key: ${p}ContextKey<T>): T { check(); return context.read(key) as T; },
        tryRead<T>(key: ${p}ContextKey<T>): T | null { check(); return context.tryRead(key) as T | null; },
        update<T>(key: ${p}ContextKey<T>, next: T | ((prev: T) => T)) { check(); runtime(); context.update(key, next); },
        tryUpdate<T>(key: ${p}ContextKey<T>, next: T | ((prev: T) => T)) { check(); runtime(); return context.tryUpdate(key, next); },
      }),\n`
    : ''
}      update() { check(); if (!disposing) schedule(true); },
      props: Object.freeze({get() { check(); return resolved as ${p}PropsSnapshot; }, getRaw() { check(); return raw; }, isProvided(key: string) { check(); return own(raw, key); }}),
      lifecycle: {setPresent(next: boolean) { check(); if (disposing) return; intent = next; schedule(false); }},
      expose: {emit(key: string, payload?: unknown, options?: CustomEventInit) { check(); if (!events.has(key)) throw new Error('Undeclared exposed event: ' + key); ${ssr ? 'host.emit(key, payload, options);' : `host.dispatchEvent(${outwardEvents ? `${p}MarkNativeExposeEvent(` : ''}new CustomEvent(key, {detail: payload, bubbles: true, cancelable: true, ...options})${outwardEvents ? ')' : ''});`} }},
    };
${interacting ? `    const previousRun = currentRun; currentRun = run;\n` : ''}
    ++callbackDepth;
    try { return fn(...(withRun ? [run, ...args] : args)); }
    finally { active = false; --callbackDepth; ${interacting ? 'currentRun = previousRun; ' : ''}}
  }
${
  context
    ? `  ${p}OwnerScopes.set(host, context);
${ssr ? '  host.bindContext(context);\n' : ''}
  const contextRead: ${p}ContextRead = Object.freeze({
    read<T>(key: ${p}ContextKey<T>): T { ensure(); if (setup) throw new Error('Context reads require runtime scope'); return context.read(key) as T; },
    tryRead<T>(key: ${p}ContextKey<T>): T | null { ensure(); if (setup) throw new Error('Context reads require runtime scope'); return context.tryRead(key) as T | null; },
  });\n`
    : ''
}  function fire(name: string): void {
    let error: unknown;
    for (const fn of lifecycle[name]) { try { invoke(fn); } catch (caught) { error ??= caught; } }
    if (error !== undefined) throw error;
  }
  function valid(spec: ${p}PropSpec, value: unknown): boolean {
    if (spec.schema === undefined) throw new Error('Missing checked Props schema');
    return ${p}Accepts(spec.schema, value) && (!spec.options || spec.options.includes(value as string)) &&
      (!spec.range || (typeof value === 'number' && value >= (spec.range.min ?? -Infinity) && value <= (spec.range.max ?? Infinity)));
  }
  function resolve(strict: boolean): ${p}Snapshot {
    const next: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(specs)) {
      const spec = specs[key], provided = own(raw, key), value = raw[key];
      const requireValue = strict && spec.empty === 'error';
      if (provided && value != null && valid(spec, value)) { next[key] = value; previous[key] = value; continue; }
      if (provided && value == null && spec.empty === 'accept') { next[key] = null; continue; }
      let candidate: unknown;
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
    const prev = resolved, previousRaw = raw;
    raw = Object.freeze({...input});
    resolved = resolve(true);
${styled ? `    ${p}Style.refresh();\n` : ''}
${interacting ? `    ${p}Interaction.refresh();\n` : ''}
    if (!hydrated) { hydrated = true; return; }
    const changed = Object.keys(specs).filter((key) => !Object.is(prev[key], resolved[key]));
    const rawChanged = watchers.some((watcher) => watcher.raw && watcher.active) ? [...new Set([...Object.keys(previousRaw), ...Object.keys(raw)])].filter((key) => own(previousRaw, key) !== own(raw, key) || !Object.is(previousRaw[key], raw[key])) : changed;
    const next = resolved, nextRaw = raw;
    for (const watcher of [...watchers]) {
      const all = watcher.raw ? rawChanged : changed;
      const matched = watcher.keys === null ? all : all.filter((key) => watcher.keys!.includes(key));
      if (watcher.active && matched.length) invoke(watcher.fn, [watcher.raw ? nextRaw : next, watcher.raw ? previousRaw : prev, {changedKeysAll: all, changedKeysMatched: matched}]);
    }
  }
  function drainEmissions(): void {
    if (emitting) return;
    emitting = true;
    try { while (emissions.length && alive) emissions.shift()!(); } finally { emitting = false; }
  }
  function state<T extends ${p}Scalar>(kind: string, semantic: string, initial: T, options: ${p}StateOptions = {}): ${p}State<T> {
    ensureSetup();
    if (typeof semantic !== 'string' || semantic.length === 0) throw new Error('Invalid state semantic');
    const spec = Object.freeze({...options, kind});
    function validate(value: unknown): void {
      const type = kind === 'bool' ? 'boolean' : kind === 'string' || kind === 'enum' ? 'string' : 'number';
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
      get() { ensureExternal(); return value; }, spec,
      subscribe(fn: Function) { ensureExternal(); subscribers.add(fn); return () => subscribers.delete(fn); },
      unsubscribe(off: () => void) { ensureExternal(); off(); },
    });
    const handle = {external, subscribers,
      get() { ensure(); return value; },
      setDefault(next: T) { ensureSetup(); validate(next); value = next; },
      set(next: T, reason?: unknown) {
        runtime(); validate(next); if (Object.is(value, next)) return;
        const prev = value; value = next;
${styled ? `        ${p}Style.refresh();\n` : ''}
${interacting ? `        ${p}Interaction.refresh();\n` : ''}
        emissions.push(() => { for (const fn of [...subscribers]) { if (alive && !disposing && subscribers.has(fn)) invoke(fn, [{type: 'next', prev, next, reason}], false); } });
        drainEmissions();
      },
    };
    states.push(handle); return handle;
  }
${
  ssr
    ? `  function element(tag: string, a?: unknown, b?: unknown): Presentation {
    const props = arguments.length > 2 ? a : a != null && typeof a === 'object' && !Array.isArray(a) && !isPresentation(a) ? a : undefined;
    const children = arguments.length === 1 ? null : arguments.length > 2 ? b : props === undefined ? a : null;
    return presentationElement(tag, ${styled ? `props && Object.hasOwn(props, 'style') ? ${p}TemplateStyleTokens((props as {style: ${p}NativeStyleHandle}).style) : undefined` : 'undefined'}, children);
  }
  let slotUsed = false;
${interacting ? '  let interactionAdopted = false;\n' : ''}
  function render(): void {
    slotUsed = false;
    const props: ${p}PropsRead = Object.freeze({get: () => resolved as ${p}PropsSnapshot, getRaw: () => raw, isProvided: (key: string) => own(raw, key)});
    const renderer: ${p}Renderer = {el: element, slot() { if (slotUsed) throw new Error('Multiple slots are unsupported'); slotUsed = true; return {kind: 'slot'}; }, props, read: Object.freeze({props${context ? ', context: contextRead' : ''}})};
    projectHost();
    host.commit(presentationChildren(typeof owner.render === 'function' ? owner.render(renderer) : renderer.slot()));
  }
  function projectHost(): void {
    host.projectRoot(${interacting ? `${p}Interaction.rootTag(), ${p}Interaction.rootProperties(), host.server ? null : ${p}Interaction.portalTarget()` : 'null, {}, null'});
  }
  function detach(): void {
    host.visible(false);
    if (!view) return;
    view = false; ++epoch;
    let error: unknown;
${interacting ? `    try { ${p}Interaction.unmount(); } catch (caught) { error = caught; }\n` : ''}${styled ? `    try { ${p}Style.unmount(); host.attribute('data-pui-style', null); } catch (caught) { error ??= caught; }\n` : ''}    try { fire('unmounted'); } catch (caught) { error ??= caught; } finally { host.clear(); }
    if (error !== undefined) throw error;
  }
  function reconcile(): void {
    if (!alive || disposing || !host.isConnected || host.server) return;
    if (!intent) { detach(); return; }
    host.visible(true);
    if (!view) {
      ++epoch; render(); view = true; dirty = false;
${styled ? `      ${p}Style.mount();\n` : ''}${
        interacting
          ? `      if (!interactionAdopted && host.hydrationAttributes) {
        ${p}Interaction.adoptAttributes(host.hydrationAttributes, host.hydrationBaselines);
        interactionAdopted = true;
      }
      ${p}Interaction.mount();\n`
          : ''
      }      fire('mounted');
    } else if (dirty) { dirty = false; render(); fire('updated'); }
  }
  function schedule(update: boolean): void {
    ensure(); dirty ||= update;
    if (host.server || queued || disposing) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!alive || disposing) return;
      // Detached dirty work is retained until the next actual view commit.
      if (host.isConnected) reconcile();
    });
  }
`
    : `  function element(tag: string, a?: unknown, b?: unknown): Node {
    const node = host.ownerDocument.createElement(tag);
${
  styled
    ? `    const props = arguments.length > 2 ? a : a != null && typeof a === 'object' && !Array.isArray(a) && !(a instanceof Node) ? a : undefined;
    if (props && Object.hasOwn(props, 'style')) node.setAttribute('data-pui-style', ${p}TemplateStyleTokens((props as {style: ${p}NativeStyleHandle}).style));\n`
    : ''
}
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
    const props: ${p}PropsRead = Object.freeze({get: () => resolved as ${p}PropsSnapshot, getRaw: () => raw, isProvided: (key: string) => own(raw, key)});
    const renderer: ${p}Renderer = {el: element, slot() { if (slotUsed) throw new Error('Multiple slots are unsupported'); slotUsed = true; return host.ownerDocument.createElement('slot'); }, props, read: Object.freeze({props${context ? ', context: contextRead' : ''}})};
    const fragment = host.ownerDocument.createDocumentFragment();
    if (typeof owner.render === 'function') append(fragment, owner.render(renderer));
    root.replaceChildren(fragment);
  }
  function detach(): void {
    if (!detachedDisplay) detachedDisplay = {value: host.style.getPropertyValue('display'), priority: host.style.getPropertyPriority('display')};
    host.style.setProperty('display', 'none', 'important');
    if (!view) return;
    view = false; ++epoch;
    let error: unknown;
${interacting ? `    try { ${p}Interaction.unmount(); } catch (caught) { error = caught; }\n` : ''}
${styled ? `    try { ${p}Style.unmount(); host.removeAttribute('data-pui-style'); } catch (caught) { error ??= caught; }\n` : ''}
    try { fire('unmounted'); } catch (caught) { error ??= caught; } finally { root.replaceChildren(); }
    if (error !== undefined) throw error;
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
    if (!view) { ++epoch; render(); view = true; ${styled ? `${p}Style.mount(); ` : ''}${interacting ? `${p}Interaction.mount(); ` : ''}fire('mounted'); }
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
`
}
  function expose(key: string, value: unknown): void { ensureSetup(); if (own(exposes, key) || events.has(key)) throw new Error('Duplicate expose: ' + key); exposes[key] = value; }
  const def: ${p}Def = {
${styled ? `    feedback: {style: ${p}Style},\n` : ''}
${interacting ? `    event: ${p}Interaction.event,\n` : ''}
${
  context
    ? `    context: {
      provide(key, value) { ensureSetup(); context.provide(key, value); },
      subscribe(key, callback) { ensureSetup(); return context.subscribe(key, 'required', callback ? (next, prev) => { invoke(callback, [next, prev]); } : undefined); },
      trySubscribe(key, callback) { ensureSetup(); return context.subscribe(key, 'optional', callback ? (next, prev) => { invoke(callback, [next, prev]); } : undefined); },
    },\n`
    : ''
}    props: {
      define(input: Record<string, ${p}PropSpec>) {
        ensureSetup();
        const merged = {...specs};
        for (const key of Object.keys(input)) {
          const next = input[key], prev = specs[key];
          if (!['boolean', 'number', 'string', 'enum', 'object', 'any'].includes(next.type)) throw new Error('Unsupported prop type');
          if (next.empty !== undefined && !['accept', 'fallback', 'error'].includes(next.empty)) throw new Error('Invalid prop empty policy');
          if (next.range && ((next.range.min !== undefined && (typeof next.range.min !== 'number' || Number.isNaN(next.range.min))) || (next.range.max !== undefined && (typeof next.range.max !== 'number' || Number.isNaN(next.range.max))))) throw new Error('Invalid prop range');
          if (prev && (prev.type !== next.type || (prev.range && next.range && ((next.range.min ?? -Infinity) > (prev.range.min ?? -Infinity) || (next.range.max ?? Infinity) < (prev.range.max ?? Infinity))))) throw new Error('Conflicting prop declaration');
          const rank = (empty: string) => empty === 'accept' ? 0 : empty === 'error' ? 2 : 1;
          if (prev && next.empty !== undefined && rank(next.empty) > rank(prev.empty ?? 'fallback')) throw new Error('Conflicting prop empty policy');
          merged[key] = {...prev, ...next, schema: (${p}PropTypes as Record<string, Parameters<typeof ${p}Accepts>[0]>)[key], empty: prev?.empty ?? next.empty ?? 'fallback', range: next.range ?? prev?.range, ...(prev && own(prev, 'default') ? {default: prev.default} : {})};
        }
        Object.assign(specs, merged);
        resolved = resolve(false);
${interacting ? `        ${p}Interaction.refresh();\n` : ''}
      },
      setDefaults(input: Record<string, unknown>) { ensureSetup(); for (const key of Object.keys(input)) if (!own(specs, key)) throw new Error('Undeclared prop default: ' + key); defaults.unshift({...input}); resolved = resolve(false); ${interacting ? `${p}Interaction.refresh(); ` : ''}},
      watch(keys: string[], fn: Function) { ensureSetup(); const watcher = {keys: [...keys], fn, active: true, raw: false}; watchers.push(watcher); return () => { watcher.active = false; }; },
      watchAll(fn: Function) { ensureSetup(); const watcher = {keys: null, fn, active: true, raw: false}; watchers.push(watcher); return () => { watcher.active = false; }; },
      watchRaw(keys: string[], fn: Function) { ensureSetup(); const watcher = {keys: [...keys], fn, active: true, raw: true}; watchers.push(watcher); return () => { watcher.active = false; }; },
      watchRawAll(fn: Function) { ensureSetup(); const watcher = {keys: null, fn, active: true, raw: true}; watchers.push(watcher); return () => { watcher.active = false; }; },
    },
    state: {bool: (s: string, v: boolean) => state('bool', s, v), enum: (s: string, v: string, o: ${p}StateOptions) => state('enum', s, v, o), string: (s: string, v: string, o?: ${p}StateOptions) => state('string', s, v, o), numberDiscrete: (s: string, v: number, o?: ${p}StateOptions) => state('number.discrete', s, v, o), numberRange: (s: string, v: number, o: ${p}StateOptions) => state('number.range', s, v, o)},
    expose: {
      value: expose,
      state(key: string, handle: ${p}State${interacting ? ` | ${p}NativeObservedState<boolean | string | number>` : ''}) { ${interacting ? `const external = observedProjections.get(handle as ${p}NativeObservedState<boolean | string | number>)?.external ?? ('external' in handle ? handle.external : undefined); if (!external) throw new Error('Unknown external state projection'); expose(key, external);` : 'expose(key, handle.external);'} },
      method(key: string, fn: Function) { expose(key, (...args: unknown[]) => { ensureExternal(); return invoke(fn, args, false); }); },
      event(key: string) { ensureSetup(); if (own(exposes, key) || events.has(key)) throw new Error('Duplicate expose: ' + key); events.add(key); },
    },
    lifecycle: {onCreated(fn) { ensureSetup(); lifecycle.created.push(fn); }, onMounted(fn) { ensureSetup(); lifecycle.mounted.push(fn); }, onUpdated(fn) { ensureSetup(); lifecycle.updated.push(fn); }, onUnmounted(fn) { ensureSetup(); lifecycle.unmounted.push(fn); }, onBeforeDispose(fn) { ensureSetup(); lifecycle.beforeDispose.push(fn); }},
  };
  const owner: ${p}Owner = {
    identity: Symbol('compiled-logical-owner'), def, exposes, render: undefined,
${interacting ? `    interaction: ${p}Interaction,\n` : ''}
${styled ? `    style: ${p}Style, props: () => resolved as ${p}PropsSnapshot,\n` : ''}
    get epoch() { return epoch; }, get view() { return view; },
    hydrate, update: () => schedule(true), reconcile,
${
  ssr
    ? `    serialize() {
      ensure();
      if (!host.server) throw new Error('serialize requires a server owner');
      host.visible(intent);
      if (intent) render(); else host.commit([]);
${styled ? `      host.attribute('data-pui-style', intent ? ${p}Style.serverTokens().join(' ') || null : null);\n` : ''}${interacting ? `      if (intent) host.projectInteraction(${p}Interaction.projectAttributes());\n` : ''}      dirty = false;
    },\n`
    : ''
}
    created() { setup = false; fire('created'); },
    dispose() {
      if (!alive || disposing) return; disposing = true;
      let error: unknown;
      try { detach(); } catch (caught) { error = caught; }
      try { fire('beforeDispose'); } catch (caught) { error ??= caught; }
      finally {
${
  interacting
    ? `        try { ${p}Interaction.dispose(); } catch (caught) { error ??= caught; }
        for (const off of observedSubscriptions.splice(0)) off();
        for (const projection of observedProjections.values()) projection.subscribers.clear();
        observedProjections.clear();\n`
    : ''
}
${styled ? `        ${p}Style.dispose(); ${ssr ? "host.attribute('data-pui-style', null);" : "host.removeAttribute('data-pui-style');"}\n` : ''}
${context ? `        ${p}OwnerScopes.delete(host); context.dispose(); ${ssr ? 'host.bindContext(null);' : ''}\n` : ''}        alive = false; ++epoch; dirty = false; watchers.length = 0; emissions.length = 0;
        for (const handle of states) handle.subscribers.clear();
        for (const callbacks of Object.values(lifecycle)) callbacks.length = 0;
${
  ssr
    ? '        host.clear();'
    : `        root.replaceChildren();
        if (detachedDisplay && host.style.getPropertyValue('display') === 'none' && host.style.getPropertyPriority('display') === 'important') {
          if (detachedDisplay.value) host.style.setProperty('display', detachedDisplay.value, detachedDisplay.priority);
          else host.style.removeProperty('display');
        }
        detachedDisplay = undefined;`
}
      }
      if (error !== undefined) throw error;
    },
  };
  return owner;
}
`;
}
