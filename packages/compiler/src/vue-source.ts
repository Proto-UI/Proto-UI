import { formatDataType, parseDataType, type DataType } from './data-types';
import { validateIR, validIdentifier } from './ir-validation';
import { buildNativeContextArtifacts } from './native-context';
import { nativeInteractionArtifact } from './native-interaction';
import { emitNativeRule, emitNativeStyleHandle, nativeStyleArtifact } from './native-style';
import { checkTargetOperations, TARGET_PROFILES } from './targets';
import type {
  CompileResult, CompilerDiagnostic, ExpressionIR, FunctionIR, GeneratedModule,
  ParameterIR, PrototypeIR, StatementIR, ValueType,
} from './ir';

/** Direct Vue 3 lowering of checked portable operations. The emitted helpers own no IR. */
export function emitVueSource(
  input: PrototypeIR,
  options: { componentName?: string } = {}
): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = validated.value;
  const admitted = checkTargetOperations(ir, TARGET_PROFILES['vue-source-v1']);
  if (!admitted.ok) return admitted;
  const componentName = options.componentName ?? 'CompiledComponent';
  if (!validIdentifier(componentName) || ['GeneratedProps', 'GeneratedResolvedProps', 'GeneratedExposes', 'GeneratedHandle'].includes(componentName)) {
    return { ok: false, diagnostics: [{ code: 'PUI4007', category: 'invalid-input', message: 'Choose a valid, non-reserved Vue component identifier.', span: ir.setup.span }] };
  }
  const names = new Set<string>([componentName]);
  function collect(value: unknown): void {
    if (Array.isArray(value)) { for (const item of value) collect(item); return; }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'name' && typeof item === 'string') names.add(item);
        collect(item);
      }
    }
  }
  collect(ir);
  let prefix = '__puiVue';
  while ([...names].some((name) => name.startsWith(prefix))) prefix += '_';
  const n = (name: string): string => `${prefix}${name}`;
  const contextArtifacts = ir.contextKeys.length ? buildNativeContextArtifacts(ir) : undefined;
  const contextNames = new Map(ir.contextKeys.map((key, index) => [key.id, n(`ContextKey${index}`)]));
  const reached = new Set(admitted.value.functions);
  const hooks = new Set(admitted.value.authoredHooks);
  const hookNames = new Map(ir.hooks.map((hook, index) => [hook.id, n(`Hook${index}`)]));
  const diagnostics: CompilerDiagnostic[] = [];
  const exposureNames = new Set<string>();
  let usesStyle = false;
  let usesInteraction = false;
  function unsupported(node: ExpressionIR, message: string): void {
    diagnostics.push({ code: 'PUI4003', category: 'unsupported-input', message, span: node.span });
  }
  function inspect(node: ExpressionIR): void {
    switch (node.kind) {
      case 'style-handle': usesStyle = true; break;
      case 'rule': usesStyle = true; node.states.forEach((state) => inspect(state.value)); break;
      case 'member': inspect(node.object); break;
      case 'unary': inspect(node.operand); break;
      case 'binary': inspect(node.left); inspect(node.right); break;
      case 'array': node.elements.forEach(inspect); break;
      case 'record': node.entries.forEach((entry) => inspect(entry.value)); break;
      case 'helper-call': node.arguments.forEach(inspect); break;
      case 'operation':
        if (node.operation.startsWith('feedback.style.')) usesStyle = true;
        if (['hook.', 'event.', 'focus.', 'accessible.'].some((family) => node.operation.startsWith(family))) usesInteraction = true;
        if (['expose.state', 'expose.method', 'expose.event'].includes(node.operation)) {
          const key = node.arguments[0];
          if (key?.kind === 'literal' && typeof key.value === 'string') exposureNames.add(key.value);
        }
        if (node.operation === 'props.define' && node.arguments[0]?.kind === 'record') {
          for (const prop of node.arguments[0].entries) {
            if (prop.value.kind !== 'record') continue;
            for (const field of prop.value.entries) {
              if (!['type', 'default', 'empty', 'range', 'options'].includes(field.key))
                unsupported(field.value, `Vue source props do not implement schema field ${JSON.stringify(field.key)}.`);
            }
          }
        }
        if (node.operation === 'render.el' && node.arguments[1]?.kind === 'record') {
          const fields = node.arguments[1].entries;
          if (fields.length && (fields.length !== 1 || fields[0].key !== 'style' || fields[0].value.type !== 'style-handle'))
            unsupported(node.arguments[1], 'Vue source template props support exactly one static tw handle under style.');
        }
        if (node.receiver) inspect(node.receiver);
        node.arguments.forEach(inspect);
        break;
      default: break;
    }
  }
  function inspectBody(body: readonly StatementIR[]): void {
    for (const statement of body) {
      if (statement.kind === 'const') inspect(statement.value);
      else if (statement.kind === 'effect') inspect(statement.expression);
      else if (statement.kind === 'return') { if (statement.value) inspect(statement.value); }
      else { inspect(statement.condition); inspectBody(statement.then); inspectBody(statement.otherwise); }
    }
  }
  admitted.value.functions.forEach((fn) => inspectBody(fn.body));
  const exposes = ir.exposes.filter((exposure) => exposureNames.has(exposure.name));
  for (const exposure of exposes) {
    if (exposure.kind !== 'method') continue;
    for (const type of [...exposure.parameters.map((parameter) => parameter.type), exposure.returnType]) {
      try { parseDataType(type); }
      catch (error) {
        if (!(error instanceof TypeError)) throw error;
        diagnostics.push({ code: 'PUI4003', category: 'unsupported-input', message: 'Vue source public methods require concrete portable data signatures; capability handles and opaque values cannot cross this boundary.', span: exposure.span });
      }
    }
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  const usesRoot = usesStyle || usesInteraction;

  function typeName(type: ValueType): string {
    if (typeof type !== 'string') return formatDataType(type);
    switch (type) {
      case 'def': return usesStyle ? n('Def') : 'void';
      case 'run': return `${n('Run')}`;
      case 'render': return `${n('Frame')}`;
      case 'props': return 'Readonly<GeneratedResolvedProps>';
      case 'state:boolean': return `${n('State')}<boolean>`;
      case 'state:number': return `${n('State')}<number>`;
      case 'state:string': return `${n('State')}<string>`;
      case 'observed:boolean': return `${n('ObservedState')}<boolean>`;
      case 'focus': return n('Focus');
      case 'accessible': return n('Accessible');
      case 'event': return n('Input');
      case 'host-event': return 'Event';
      case 'template': return `${n('Vue')}.VNodeChild`;
      case 'function': return '(...args: unknown[]) => unknown';
      case 'array': return 'readonly unknown[]';
      case 'record': return 'Readonly<Record<string, unknown>>';
      case 'context-key': return 'object';
      case 'style-handle': return n('StyleHandle');
      case 'style-disposer': return '() => void';
      case 'rule-handle': return n('RuleHandle');
      case 'template-props': return `{ readonly style?: ${n('StyleHandle')} }`;
      case 'unknown': return 'unknown';
      default: return formatDataType(parseDataType(type));
    }
  }
  function parameters(values: readonly ParameterIR[]): string {
    return values.map((parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`).join(', ');
  }
  function fn(value: FunctionIR, depth: number): string {
    const scoped = usesInteraction && value.phase === 'callback' && !['helper', 'context-update'].includes(value.context);
    return `(${parameters(value.parameters)}) => ${scoped ? `${n('Invoke')}(${JSON.stringify(value.context)}, () => ` : ''}{\n${statements(value.body, depth + 1)}${'  '.repeat(depth)}}${scoped ? ')' : ''}`;
  }
  function expression(node: ExpressionIR, depth: number): string {
    switch (node.kind) {
      case 'literal': return JSON.stringify(node.value);
      case 'reference': return node.name;
      case 'context-key': return contextNames.get(node.keyId)!;
      case 'style-handle': return emitNativeStyleHandle(node.handle);
      case 'rule': return emitNativeRule(node, (value) => expression(value, depth), n('Style'), n('Props'));
      case 'member': return `(${expression(node.object, depth)})${node.optional ? '?.' : ''}[${JSON.stringify(node.property)}]`;
      case 'unary': return `(${node.operator}${expression(node.operand, depth)})`;
      case 'binary': return `(${expression(node.left, depth)} ${node.operator} ${expression(node.right, depth)})`;
      case 'array': return `[${node.elements.map((item) => expression(item, depth)).join(', ')}]`;
      case 'record': return `{ ${node.entries.map((entry) => `[${JSON.stringify(entry.key)}]: ${expression(entry.value, depth)}`).join(', ')} }`;
      case 'function': return fn(node.function, depth);
      case 'helper-call': return `${node.name}(${node.arguments.map((arg) => expression(arg, depth)).join(', ')})`;
      case 'authored-hook': return `${hookNames.get(node.hookId)}(${usesStyle ? n('DefValue') : 'undefined'})`;
      case 'operation': {
        const args = node.arguments.map((arg) => expression(arg, depth));
        const receiver = node.receiver ? expression(node.receiver, depth) : 'undefined';
        switch (node.operation) {
          case 'hook.asTrigger': return `${n('Interaction')}.asTrigger()`;
          case 'hook.asFocusable': return `${n('Interaction')}.asFocusable()`;
          case 'hook.asAccessible': return `${n('Interaction')}.asAccessible()`;
          case 'event.on':
          case 'event.onGlobal': return `${n('Interaction')}.event.${node.operation === 'event.on' ? 'on' : 'onGlobal'}(${args.join(', ')})`;
          case 'event.requestDefaultActionPrevention': return `${receiver}.control.requestDefaultActionPrevention(${args.join(', ')})`;
          case 'focus.configure': return `${receiver}.configure(${args.join(', ')})`;
          case 'focus.setDisabled': return `${receiver}.setDisabled(${args.join(', ')})`;
          case 'focus.focusSelf': return `${receiver}.focusSelf(${args.join(', ')})`;
          case 'accessible.state': return `${receiver}.state(${args.join(', ')})`;
          case 'accessible.action': return `${receiver}.action(${args.join(', ')})`;
          case 'accessible.role': return `${receiver}.role(${args.join(', ')})`;
          case 'accessible.nameFromContent': return `${receiver}.nameFromContent()`;
          case 'rule.dispose': return `${receiver}.dispose()`;
          case 'feedback.style.use': return `${n('Style')}.use(${args.join(', ')})`;
          case 'feedback.style.release': return `${receiver}()`;
          case 'feedback.style.patch': return `${receiver}.feedback.style.patch(${args.join(', ')})`;
          case 'feedback.style.suppress': return `${receiver}.feedback.style.suppress(${args.join(', ')})`;
          case 'feedback.style.clearPatch': return `${receiver}.feedback.style.clearPatch()`;
          case 'run.update': return `${n('RequestUpdate')}(${receiver})`;
          case 'props.define': return `${n('DefineProps')}(${args.join(', ')})`;
          case 'props.setDefaults': return `${n('SetDefaults')}(${args.join(', ')})`;
          case 'props.watch': return `${n('WatchProps')}(${args.join(', ')})`;
          case 'props.get': return `${n('ReadProps')}(${receiver})`;
          case 'props.getRaw': return `${n('ReadRawProps')}(${receiver})`;
          case 'props.isProvided': return `${n('IsProvided')}(${receiver}, ${args.join(', ')})`;
          case 'render.read.props.get': return `${n('ReadFrameProps')}(${receiver})`;
          case 'render.read.props.getRaw': return `${n('ReadFrameRawProps')}(${receiver})`;
          case 'render.read.props.isProvided': return `${n('FrameProvided')}(${receiver}, ${args.join(', ')})`;
          case 'context.provide': return `${n('Scope')}.provide(${args.join(', ')})`;
          case 'context.subscribe':
          case 'context.trySubscribe': {
            const key = node.arguments[0];
            if (key.kind !== 'context-key') throw new Error('Checked Context subscription requires a key declaration.');
            const valueType = `${formatDataType(ir.contextKeys.find((entry) => entry.id === key.keyId)!.type)}${node.operation === 'context.trySubscribe' ? ' | null' : ''}`;
            const callback = node.arguments[1];
            const invocation = callback?.kind === 'function'
              ? `(${args[1]})(${[n('RunValue'), `next as ${valueType}`, `prev as ${valueType}`].slice(0, callback.function.parameters.length).join(', ')})`
              : `Reflect.apply(${args[1]}, undefined, [${n('RunValue')}, next, prev])`;
            return `${n('Scope')}.subscribe(${args[0]}, '${node.operation === 'context.subscribe' ? 'required' : 'optional'}'${callback ? `, (next, prev) => ${invocation}` : ''})`;
          }
          case 'context.read':
          case 'context.tryRead': return `(${n('ReadContext')}(${receiver}, ${args[0]}, ${node.operation === 'context.tryRead'}) as ${typeName(node.type)})`;
          case 'context.update':
          case 'context.tryUpdate': return `(${n('UpdateContext')}(${receiver}, ${args.join(', ')}, ${node.operation === 'context.tryUpdate'}) as ${node.operation === 'context.tryUpdate' ? 'boolean' : 'void'})`;
          case 'render.read.context.read':
          case 'render.read.context.tryRead': return `(${n('ReadFrameContext')}(${receiver}, ${args[0]}, ${node.operation === 'render.read.context.tryRead'}) as ${typeName(node.type)})`;
          case 'state.bool': return `${n('CreateState')}('bool', ${args.join(', ')})`;
          case 'state.string': return `${n('CreateState')}('string', ${args.join(', ')})`;
          case 'state.numberDiscrete': return `${n('CreateState')}('number.discrete', ${args.join(', ')})`;
          case 'state.numberRange': return `${n('CreateState')}('number.range', ${args.join(', ')})`;
          case 'state.get': return `${receiver}.get()`;
          case 'state.set': return `${receiver}.set(${args.join(', ')})`;
          case 'expose.state': return `${n('ExposeState')}(${args.join(', ')})`;
          case 'expose.event': return `${n('ExposeEvent')}(${args.join(', ')})`;
          case 'expose.method': return `${n('ExposeMethod')}(${args.join(', ')})`;
          case 'expose.emit': return `${n('Emit')}(${receiver}, ${args.join(', ')})`;
          case 'lifecycle.setPresent': return `${n('SetPresent')}(${receiver}, ${args.join(', ')})`;
          case 'lifecycle.onCreated': return `${n('Life')}.created.push(${args.join(', ')})`;
          case 'lifecycle.onMounted': return `${n('Life')}.mounted.push(${args.join(', ')})`;
          case 'lifecycle.onUpdated': return `${n('Life')}.updated.push(${args.join(', ')})`;
          case 'lifecycle.onUnmounted': return `${n('Life')}.unmounted.push(${args.join(', ')})`;
          case 'lifecycle.onBeforeDispose': return `${n('Life')}.beforeDispose.push(${args.join(', ')})`;
          case 'render.el': return `${n('Element')}(${receiver}, ${args.join(', ')})`;
          case 'render.slot': return `${n('Slot')}(${receiver})`;
          default: throw new Error(`Admitted Vue operation has no lowering: ${node.operation}`);
        }
      }
    }
  }
  function statements(body: readonly StatementIR[], depth: number, deadBindings = new Set<string>()): string {
    const indent = '  '.repeat(depth);
    let output = '';
    for (const statement of body) {
      const sourceFile = JSON.stringify(statement.span.file).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
      const origin = `${indent}// Source ${sourceFile}:${statement.span.line}:${statement.span.column}\n`;
      if (statement.kind === 'const') {
        if (statement.value.kind === 'function' && !reached.has(statement.value.function) || statement.value.kind === 'reference' && deadBindings.has(statement.value.name)) {
          deadBindings.add(statement.name);
          continue;
        }
        output += `${origin}${indent}const ${statement.name} = ${expression(statement.value, depth)};\n`;
      } else if (statement.kind === 'effect') output += `${origin}${indent}${expression(statement.expression, depth)};\n`;
      else if (statement.kind === 'return') {
        output += `${origin}${indent}return${statement.value ? ` ${expression(statement.value, depth)}` : ''};\n`;
        break;
      } else output += `${origin}${indent}if (${expression(statement.condition, depth)}) {\n${statements(statement.then, depth + 1, new Set(deadBindings))}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, depth + 1, new Set(deadBindings))}${indent}}` : ''}\n`;
    }
    return output;
  }
  let checkIndex = 0;
  // Specialize data predicates at compile time; no data-type/semantic interpreter ships.
  function check(value: string, type: DataType): string {
    if (typeof type === 'string') {
      if (type === 'null') return `${value} === null`;
      if (type === 'void') return `${value} === undefined`;
      return `(typeof ${value} === '${type}'${type === 'number' ? ` && Number.isFinite(${value})` : ''})`;
    }
    if (type.kind === 'literal') return `${value} === ${JSON.stringify(type.value)}`;
    if (type.kind === 'union') return `(${type.members.map((member) => check(value, member)).join(' || ') || 'false'})`;
    if (type.kind === 'array') {
      const item = n(`Item${checkIndex++}`);
      return `(${n('IsArray')}(${value}) && Array.prototype.every.call(${value}, (${item}: unknown) => ${check(item, type.element)}))`;
    }
    const key = n(`Key${checkIndex++}`);
    const fields = type.fields.map((field) => {
      const member = `${value}[${JSON.stringify(field.name)}]`;
      const present = `Object.hasOwn(${value}, ${JSON.stringify(field.name)})`;
      return field.optional ? `(!${present} || ${check(member, field.type)})` : `(${present} && ${check(member, field.type)})`;
    });
    return `(${n('IsRecord')}(${value}) && Object.keys(${value}).every((${key}) => ${JSON.stringify(type.fields.map((field) => field.name))}.includes(${key}))${fields.map((field) => ` && ${field}`).join('')})`;
  }
  const propFields = ir.props.map((prop) => `  ${JSON.stringify(prop.name)}?: ${typeName(prop.type)} | null;`).join('\n');
  const resolvedPropFields = ir.props.map((prop) => `  readonly ${JSON.stringify(prop.name)}: ${typeName(prop.type)};`).join('\n');
  const exposureFields = exposes.map((entry) => {
    const type = entry.kind === 'state' ? `${n('PublicState')}<${typeName(entry.type)}>`
      : entry.kind === 'event' ? `{ readonly kind: 'event' }`
      : `(${parameters(entry.parameters)}) => ${typeName(entry.returnType)}`;
    return `  readonly ${JSON.stringify(entry.name)}: ${type};`;
  }).join('\n');
  const propChecks = ir.props.map((prop) => `    [${JSON.stringify(prop.name)}]: (${n('Value')}: unknown) => ${check(n('Value'), parseDataType(prop.type))},`).join('\n');
  const methodChecks = exposes.filter((entry) => entry.kind === 'method').map((entry) => {
    const checks = entry.parameters.map((parameter, index) => {
      const argument = `${n('Args')}[${index}]`;
      const test = check(argument, parseDataType(parameter.type));
      return parameter.optional ? `(${argument} === undefined || ${test})` : `(${test})`;
    });
    return `    [${JSON.stringify(entry.name)}]: { args: (${n('Args')}: unknown[]) => ${n('Args')}.length <= ${entry.parameters.length}${checks.map((test) => ` && ${test}`).join('')}, result: (${n('Value')}: unknown) => ${check(n('Value'), parseDataType(entry.returnType))} },`;
  }).join('\n');
  const eventChecks = exposes.filter((entry) => entry.kind === 'event').map((entry) => `    [${JSON.stringify(entry.name)}]: (${n('Value')}: unknown) => ${check(n('Value'), parseDataType(entry.payload))},`).join('\n');
  const contextImports = contextArtifacts ? `import { createContextScope as ${n('CreateContextScope')}, scopeKey as ${n('ScopeKey')}, acceptsContextValue as ${n('AcceptsContextValue')}, type ContextScope as ${n('ContextScope')} } from '${contextArtifacts.scopeFile.replace(/\.ts$/, '')}';\n${ir.contextKeys.map((key) => `import { key as ${contextNames.get(key.id)} } from '${contextArtifacts.keys.get(key.id)!.file.replace(/\.ts$/, '')}';`).join('\n')}` : '';
  const contextCode = contextArtifacts ? `
    const ${n('ParentScope')} = ${n('Vue')}.inject<${n('ContextScope')} | null>(${n('ScopeKey')}, null);
    const ${n('ContextChecks')} = new Map<object, (value: unknown) => boolean>([
${ir.contextKeys.map((key) => `      [${contextNames.get(key.id)}, (value: unknown) => ${n('AcceptsContextValue')}(${JSON.stringify(key.type)}, value)],`).join('\n')}
    ]);
    const ${n('Scope')} = ${n('CreateContextScope')}({
      getParent: () => ${n('ParentScope')}, isAlive: () => !${n('Disposed')},
      invoke: (callback) => { ${n('Alive')}(); return callback(); },
      validate: (key, value) => ${n('ContextChecks')}.get(key)?.(value) === true,
    });
    ${n('Vue')}.provide(${n('ScopeKey')}, ${n('Scope')});
    function ${n('ReadContext')}(run: ${n('Run')}, key: object, optional: boolean): unknown {
      ${n('RequireRun')}(run); return optional ? ${n('Scope')}.tryRead(key) : ${n('Scope')}.read(key);
    }
    function ${n('UpdateContext')}(run: ${n('Run')}, key: object, value: unknown, optional: boolean): void | boolean {
      ${n('RequireRun')}(run); return optional ? ${n('Scope')}.tryUpdate(key, value) : ${n('Scope')}.update(key, value);
    }
    function ${n('ReadFrameContext')}(frame: ${n('Frame')}, key: object, optional: boolean): unknown {
      ${n('ActiveFrame')}(frame); return optional ? ${n('Scope')}.tryRead(key) : ${n('Scope')}.read(key);
    }
` : '';
  const hookCode = ir.hooks.filter((hook) => hooks.has(hook.id)).map((hook) => `    const ${hookNames.get(hook.id)} = ${fn(hook.setup, 2)};`).join('\n');
  const code = `// Editable Vue 3 source. Profile: vue-source-v1; no Proto Runtime or Adapter dependency.
// Inline native costs: owner/update queue, constrained state subscriptions, prop resolution/watchers,
// public boundary guards, view commit lifecycle and native element/slot composition.
// Source graph SHA-256: ${ir.source.sha256}
import * as ${n('Vue')} from 'vue';
${usesStyle ? `import { createNativeStyle as ${n('CreateStyle')}, templateStyleTokens as ${n('TemplateStyleTokens')}, type NativeStyle as ${n('NativeStyle')}, type NativeStyleHandle as ${n('StyleHandle')}, type NativeRuleHandle as ${n('RuleHandle')} } from './.proto-ui/style/native-v1';` : ''}
${usesInteraction ? `import { createNativeInteraction as ${n('CreateInteraction')}, type NativeInteraction as ${n('NativeInteraction')}, type NativeFocus as ${n('Focus')}, type NativeAccessible as ${n('Accessible')}, type NativeObservedState as ${n('ObservedState')}, type NativeInput as ${n('Input')} } from './.proto-ui/interaction/native-v1';` : ''}
${contextImports}

${usesStyle ? `type ${n('Def')} = Readonly<{ feedback: Readonly<{ style: ${n('NativeStyle')} }> }>;` : ''}
type ${n('Run')} = Readonly<{ readonly owner: symbol${usesStyle ? `; readonly feedback: ${n('Def')}['feedback']` : ''} }>;
type ${n('StateEvent')}<T> = { type: 'next'; prev: T; next: T; reason?: unknown };
type ${n('Spec')} = Readonly<{ kind: 'bool' | 'string' | 'number.range' | 'number.discrete'; options?: readonly (string | number)[]; min?: number; max?: number; step?: number; clamp?: boolean }>;
type ${n('PropSpec')} = { type: unknown; default?: unknown; empty?: 'accept' | 'fallback' | 'error'; range?: { min?: number; max?: number }; options?: readonly unknown[] };
type ${n('WatchInfo')} = { changedKeysAll: string[]; changedKeysMatched: string[] };
export type ${n('PublicState')}<T> = { get(): T; subscribe(callback: (event: ${n('StateEvent')}<T>) => void): () => void; unsubscribe(off: () => void): void; readonly spec: ${n('Spec')} };
type ${n('State')}<T> = ${n('PublicState')}<T> & { set(next: T, reason?: unknown): void };
type ${n('Epoch')} = { id: number; active: boolean; committed: boolean };
type ${n('Frame')} = { epoch: ${n('Epoch')}; slotUsed: boolean };
export type GeneratedProps = {
${propFields}
};
export type GeneratedResolvedProps = {
${resolvedPropFields}
};
export type GeneratedExposes = {
${exposureFields}
};
export type GeneratedHandle = { update(): void; getExposes(): GeneratedExposes };

// The slot is a real Vue child render, so authored Vue children retain native ownership.
const ${n('SlotView')} = ${n('Vue')}.defineComponent({
  name: 'CompiledSlot', inheritAttrs: false,
  props: { read: { type: Function as ${n('Vue')}.PropType<() => ${n('Vue')}.VNodeChild>, required: true } },
  setup(props) { return () => props.read!(); },
});

export const ${componentName} = ${n('Vue')}.defineComponent({
  name: ${JSON.stringify(ir.name)}, inheritAttrs: false,
  emits: ${JSON.stringify(exposes.filter((entry) => entry.kind === 'event').map((entry) => entry.name))},
  setup(_props, ${n('Context')}) {
    // Protocol values intentionally do not enter Vue's reactive state graph.
    const ${n('Instance')} = ${n('Vue')}.getCurrentInstance()!;
    const ${n('Revision')} = ${n('Vue')}.shallowRef(0);
    const ${n('Present')} = ${n('Vue')}.shallowRef(true);
    const ${n('SlotRevision')} = ${n('Vue')}.shallowRef(0);
    let ${n('Disposed')} = false, ${n('Disposing')} = false, ${n('InternalTeardown')} = false;
    let ${n('Queued')} = false, ${n('Requested')} = false, ${n('QueueTicket')} = 0;
    let ${n('EpochId')} = 0;
    let ${n('CurrentEpoch')}: ${n('Epoch')} | undefined;
    const ${n('Life')}: Record<'created' | 'mounted' | 'updated' | 'unmounted' | 'beforeDispose', Array<(run: ${n('Run')}) => void>> = { created: [], mounted: [], updated: [], unmounted: [], beforeDispose: [] };
    const ${n('Exposes')}: Record<string, unknown> = Object.create(null);
    const ${n('States')} = new Set<object>();
    const ${n('PublicStates')} = new WeakMap<object, object>();
    const ${n('StateCleanup')}: Array<() => void> = [];
    const ${n('Events')} = new Set<string>();
    const ${n('PropChecks')}: Record<string, (value: unknown) => boolean> = {
${propChecks}
    };
    const ${n('MethodChecks')}: Record<string, { args(args: unknown[]): boolean; result(value: unknown): boolean }> = {
${methodChecks}
    };
    const ${n('EventChecks')}: Record<string, (value: unknown) => boolean> = {
${eventChecks}
    };
    const ${n('PropSpecs')}: Record<string, ${n('PropSpec')}> = Object.create(null);
    const ${n('Defaults')}: Array<Record<string, unknown>> = [];
    const ${n('PreviousValid')}: Record<string, unknown> = Object.create(null);
    // Setup declarations precede hydration; the final snapshot is validated before created.
    let ${n('Props')}: Readonly<GeneratedResolvedProps>;
    let ${n('RawProps')}: Record<string, unknown> = Object.create(null);
    const ${n('Watchers')}: Array<{ keys: readonly string[]; active: boolean; callback: (run: ${n('Run')}, next: Readonly<GeneratedResolvedProps>, previous: Readonly<GeneratedResolvedProps>, info: ${n('WatchInfo')}) => void }> = [];
    const ${n('StateQueue')}: Array<() => void> = [];
    let ${n('EmittingState')} = false;
${usesRoot ? `    let ${n('Setup')} = true;
    let ${n('RootElement')}: HTMLElement | null = null;
    let ${n('RootEpoch')}: ${n('Epoch')} | undefined;` : ''}
${usesInteraction ? `    let ${n('CallbackScope')}: string | undefined;
    function ${n('Invoke')}<T>(scope: string, callback: () => T): T {
      ${n('Alive')}();
      const previous = ${n('CallbackScope')}; ${n('CallbackScope')} = scope;
      try { return callback(); } finally { ${n('CallbackScope')} = previous; }
    }
    function ${n('RegisterObservedState')}(state: ${n('ObservedState')}<boolean>): void {
      const removals = new Set<() => void>();
      const projection: ${n('PublicState')}<boolean> = Object.freeze({
        spec: Object.freeze({ kind: 'bool' as const }),
        get() { ${n('PublicAlive')}(); return state.get(); },
        subscribe(callback: (event: ${n('StateEvent')}<boolean>) => void) {
          ${n('PublicAlive')}();
          let active = true;
          const off = state.subscribe((event) => { if (active && !${n('Disposed')} && !${n('Disposing')}) callback(event); });
          const stop = () => { if (!active) return; active = false; removals.delete(stop); off(); };
          removals.add(stop);
          return () => { ${n('PublicAlive')}(); stop(); };
        },
        unsubscribe(off: () => void) { ${n('PublicAlive')}(); off(); },
      });
      ${n('States')}.add(state); ${n('PublicStates')}.set(state, projection);
      const refresh = state.subscribe(() => {
${usesStyle ? `        ${n('Style')}.refresh();` : ''}
        ${n('Interaction')}.refresh();
      });
      ${n('StateCleanup')}.push(() => { refresh(); for (const stop of removals) stop(); });
    }
    const ${n('Interaction')}: ${n('NativeInteraction')}<${n('Run')}> = ${n('CreateInteraction')}<${n('Run')}>({
      ensureSetup(operation) { ${n('Alive')}(); if (!${n('Setup')}) throw new Error('[Vue source] ' + operation + ' requires setup'); },
      ensureRuntime(operation) {
        ${n('Alive')}();
        if (${n('Setup')} || !${n('CallbackScope')} || ${n('Disposing')} && !${n('InternalTeardown')}) throw new Error('[Vue source] ' + operation + ' requires an owned runtime callback');
      },
      ensureEvent(operation) {
        ${n('Alive')}();
        if (${n('Setup')} || ${n('CallbackScope')} !== 'event' || ${n('Disposing')}) throw new Error('[Vue source] ' + operation + ' requires an input callback');
      },
      isAlive: () => !${n('Disposed')} && (!${n('Disposing')} || ${n('InternalTeardown')}),
      isReady: () => !${n('Setup')} && !${n('Disposing')},
      invoke: (callback) => ${n('Invoke')}('event', callback),
      getRun: () => ${n('RunValue')}, getResolvedProps: () => ${n('Props')},
      getRoot: () => ${n('RootEpoch')}?.active && ${n('RootEpoch')} === ${n('CurrentEpoch')} ? ${n('RootElement')} : null,
      registerObservedState: ${n('RegisterObservedState')},
    });` : ''}
${usesStyle ? `    const ${n('Style')} = ${n('CreateStyle')}({
      ensureSetup() { ${n('Alive')}(); if (!${n('Setup')}) throw new Error('[Vue source] style declaration requires setup'); },
      ensureRuntime() { ${n('Alive')}(); if (${n('Setup')}) throw new Error('[Vue source] style writes require runtime'); },
      isAlive: () => !${n('Disposed')} && (!${n('Disposing')} || ${n('InternalTeardown')}),
      project(tokens) {
        const root = ${n('RootElement')};
        if (!root || !${n('RootEpoch')}?.active || ${n('RootEpoch')} !== ${n('CurrentEpoch')}) return;
        if (tokens.length) root.setAttribute('data-pui-style', tokens.join(' '));
        else root.removeAttribute('data-pui-style');
      },
    });
    const ${n('DefValue')}: ${n('Def')} = Object.freeze({ feedback: Object.freeze({ style: ${n('Style')} }) });` : ''}
    const ${n('RunValue')}: ${n('Run')} = Object.freeze({ owner: Symbol(${JSON.stringify(ir.name)})${usesStyle ? `, feedback: ${n('DefValue')}.feedback` : ''} });
${contextCode}

    function ${n('IsRecord')}(value: unknown): value is Record<string, unknown> {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const prototype = Object.getPrototypeOf(value);
      return (prototype === Object.prototype || prototype === null) && Reflect.ownKeys(value).every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        return typeof key === 'string' && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
      });
    }
    function ${n('IsArray')}(value: unknown): value is unknown[] {
      if (!Array.isArray(value) || Object.keys(value).length !== value.length) return false;
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Array.prototype && prototype !== null) return false;
      return Reflect.ownKeys(value).every((key) => {
        if (key === 'length') return true;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        return typeof key === 'string' && /^(0|[1-9]\\d*)$/.test(key) && Number(key) < value.length && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
      });
    }

    function ${n('Alive')}(): void {
      if (${n('Disposed')} || (${n('Disposing')} && !${n('InternalTeardown')})) throw new Error('[Vue source] owner is disposed');
    }
    function ${n('PublicAlive')}(): void {
      if (${n('Disposed')} || ${n('Disposing')}) throw new Error('[Vue source] owner is disposed');
    }
    function ${n('RequireRun')}(run: ${n('Run')}): void {
      ${n('Alive')}();
      if (run !== ${n('RunValue')}) throw new Error('[Vue source] foreign run handle');
    }
    function ${n('RequestUpdate')}(run: ${n('Run')}): void {
      ${n('RequireRun')}(run);
      if (${n('Disposing')}) return;
      ${n('Requested')} = true;
      if (${n('Queued')}) return;
      ${n('Queued')} = true;
      const ticket = ${n('QueueTicket')};
      queueMicrotask(() => {
        if (ticket !== ${n('QueueTicket')} || ${n('Disposed')} || ${n('Disposing')}) return;
        ${n('Queued')} = false;
        if (!${n('Requested')}) return;
        ${n('Requested')} = false;
        if (${n('Present')}.value) ${n('Revision')}.value += 1;
      });
    }
    function ${n('SetPresent')}(run: ${n('Run')}, present: boolean): void {
      ${n('RequireRun')}(run);
      if (${n('Disposing')}) throw new Error('[Vue source] terminal presence is locked');
      if (typeof present !== 'boolean') throw new TypeError('[Vue source] presence must be boolean');
      ${n('Present')}.value = present;
    }
    function ${n('InvokeLife')}(kind: keyof typeof ${n('Life')}): void {
      for (const callback of ${n('Life')}[kind]) callback(${n('RunValue')});
    }
${usesRoot ? `    function ${n('UnbindRoot')}(epoch: ${n('Epoch')}): void {
      if (${n('RootEpoch')} !== epoch) return;
${usesStyle ? `      const root = ${n('RootElement')};` : ''}
      ${n('RootElement')} = null; ${n('RootEpoch')} = undefined;
${usesInteraction && usesStyle ? `      try { ${n('Interaction')}.unmount(); }
      finally { ${n('Style')}.unmount(); root?.removeAttribute('data-pui-style'); }`
  : usesInteraction ? `      ${n('Interaction')}.unmount();`
  : `      ${n('Style')}.unmount(); root?.removeAttribute('data-pui-style');`}
    }` : ''}
    function ${n('CommitUnmount')}(epoch: ${n('Epoch')}): void {
      epoch.active = false;
${usesRoot ? `      ${n('UnbindRoot')}(epoch);` : ''}
      if (!epoch.committed) return;
      epoch.committed = false;
      const previous = ${n('InternalTeardown')};
      ${n('InternalTeardown')} = ${n('Disposing')};
      try { ${n('InvokeLife')}('unmounted'); } finally { ${n('InternalTeardown')} = previous; }
    }
    function ${n('CreateState')}(kind: 'bool', semantic: string, initial: boolean): ${n('State')}<boolean>;
    function ${n('CreateState')}(kind: 'string', semantic: string, initial: string, options?: Omit<${n('Spec')}, 'kind'>): ${n('State')}<string>;
    function ${n('CreateState')}(kind: 'number.range' | 'number.discrete', semantic: string, initial: number, options?: Omit<${n('Spec')}, 'kind'>): ${n('State')}<number>;
    function ${n('CreateState')}(kind: ${n('Spec')}['kind'], semantic: string, initial: boolean | number | string, options: Omit<${n('Spec')}, 'kind'> = {}): unknown {
      if (typeof semantic !== 'string' || semantic.length === 0) throw new Error('[Vue source] invalid state semantic');
      const spec: ${n('Spec')} = Object.freeze({ ...options, ...(options.options ? { options: Object.freeze([...options.options]) } : {}), kind });
      function validate(value: boolean | number | string): void {
        if (kind === 'bool' ? typeof value !== 'boolean' : kind === 'string' ? typeof value !== 'string' : typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('[Vue source] invalid state value');
        if (spec.options?.length && (typeof value === 'boolean' || !spec.options.includes(value))) throw new RangeError('[Vue source] state value not in options');
        if (typeof value === 'number' && (kind === 'number.range' || (kind === 'number.discrete' && !spec.options?.length)) && (spec.min !== undefined && value < spec.min || spec.max !== undefined && value > spec.max)) throw new RangeError('[Vue source] state value out of range');
        if (typeof value === 'number' && kind === 'number.discrete' && !spec.options?.length && spec.step !== undefined && spec.step > 0 && !Number.isInteger((value - (spec.min ?? 0)) / spec.step)) throw new RangeError('[Vue source] state value violates step');
      }
      if (kind === 'number.range' && (typeof spec.min !== 'number' || typeof spec.max !== 'number' || Number.isNaN(spec.min) || Number.isNaN(spec.max) || spec.min > spec.max)) throw new RangeError('[Vue source] invalid state range');
      let value = initial;
      if (kind === 'number.range' && spec.clamp && typeof value === 'number') value = Math.min(spec.max!, Math.max(spec.min!, value));
      validate(value);
      const subscribers = new Set<(event: ${n('StateEvent')}<boolean | number | string>) => void>();
      const handle: ${n('State')}<boolean | number | string> = {
        spec,
        get() { ${n('Alive')}(); return value; },
        set(next, reason) {
          ${n('Alive')}(); validate(next);
          if (Object.is(value, next)) return;
          const event: ${n('StateEvent')}<boolean | number | string> = { type: 'next', prev: value, next, reason };
          value = next;
${usesStyle ? `          ${n('Style')}.refresh();` : ''}
${usesInteraction ? `          ${n('Interaction')}.refresh();` : ''}
          ${n('StateQueue')}.push(() => { for (const callback of subscribers) callback(event); });
          if (${n('EmittingState')}) return;
          ${n('EmittingState')} = true;
          try { while (${n('StateQueue')}.length) ${n('StateQueue')}.shift()!(); }
          finally { ${n('EmittingState')} = false; ${n('StateQueue')}.length = 0; }
        },
        subscribe(callback) { ${n('PublicAlive')}(); subscribers.add(callback); return () => { ${n('PublicAlive')}(); subscribers.delete(callback); }; },
        unsubscribe(off) { ${n('PublicAlive')}(); off(); },
      };
      ${n('States')}.add(handle);
      ${n('StateCleanup')}.push(() => subscribers.clear());
      return handle;
    }
    function ${n('Declare')}(key: string, value: unknown): void {
      if (Object.hasOwn(${n('Exposes')}, key)) throw new Error('[Vue source] duplicate exposure: ' + key);
      Object.defineProperty(${n('Exposes')}, key, { value, enumerable: true });
    }
    function ${n('ExposeState')}<T>(key: string, handle: ${n('PublicState')}<T>${usesInteraction ? ` | ${n('ObservedState')}<T>` : ''}): void {
      if (!${n('States')}.has(handle)) throw new Error('[Vue source] foreign state handle');
      let projection = ${n('PublicStates')}.get(handle);
      if (!projection) {
${usesInteraction ? `        if (!('spec' in handle)) throw new Error('[Vue source] unregistered observed state');` : ''}
        projection = Object.freeze({ get() { ${n('PublicAlive')}(); return handle.get(); }, subscribe: handle.subscribe, unsubscribe: handle.unsubscribe, spec: handle.spec });
        ${n('PublicStates')}.set(handle, projection);
      }
      ${n('Declare')}(key, projection);
    }
    function ${n('ExposeMethod')}<Args extends unknown[], Result>(key: string, callback: (...args: Args) => Result): void {
      const boundary = ${n('MethodChecks')}[key];
      ${n('Declare')}(key, (...args: unknown[]) => {
        ${n('PublicAlive')}();
        if (!boundary.args(args)) throw new TypeError('[Vue source] invalid method arguments: ' + key);
        // The specialized predicate just checked the concrete declared argument tuple.
        const checkedArgs = args as Args;
        const result = callback(...checkedArgs);
        if (!boundary.result(result)) throw new TypeError('[Vue source] invalid method result: ' + key);
        return result;
      });
    }
    function ${n('ExposeEvent')}(key: string, _spec?: unknown): void {
      ${n('Events')}.add(key);
      ${n('Declare')}(key, Object.freeze({ kind: 'event' as const }));
    }
    function ${n('Emit')}(run: ${n('Run')}, key: ${exposes.filter((entry) => entry.kind === 'event').map((entry) => JSON.stringify(entry.name)).join(' | ') || 'never'}, payload?: unknown, options?: unknown): void {
      ${n('RequireRun')}(run);
      if (!${n('Events')}.has(key) || !${n('EventChecks')}[key](payload)) throw new TypeError('[Vue source] undeclared event or invalid payload: ' + key);
      ${n('Context')}.emit(key, payload, options);
    }
    function ${n('ValidProp')}(key: string, value: unknown): boolean {
      const spec = ${n('PropSpecs')}[key];
      return ${n('PropChecks')}[key](value) && (!spec.options || spec.options.includes(value)) && (!spec.range || typeof value === 'number' && value >= (spec.range.min ?? -Infinity) && value <= (spec.range.max ?? Infinity));
    }
    function ${n('ResolveProps')}(raw: Record<string, unknown>, strict: boolean): Readonly<GeneratedResolvedProps> {
      const next: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(${n('PropSpecs')})) {
        const spec = ${n('PropSpecs')}[key], provided = Object.hasOwn(raw, key), candidate = raw[key];
        const empty = spec.empty ?? 'fallback';
        if (provided && candidate != null && ${n('ValidProp')}(key, candidate)) {
          next[key] = candidate; ${n('PreviousValid')}[key] = candidate; continue;
        }
        if (provided && candidate == null && empty === 'accept') { next[key] = null; continue; }
        const required = strict && empty === 'error';
        let found = false;
        function take(value: unknown): void {
          if (found || value === undefined || required && value === null || value !== null && !${n('ValidProp')}(key, value)) return;
          next[key] = value; found = true;
        }
        if (provided && Object.hasOwn(${n('PreviousValid')}, key)) take(${n('PreviousValid')}[key]);
        for (const layer of ${n('Defaults')}) if (Object.hasOwn(layer, key)) take(layer[key]);
        if (Object.hasOwn(spec, 'default')) take(spec.default);
        if (!found && required) throw new TypeError('[Vue source] missing/invalid required prop: ' + key);
        if (!found) next[key] = null;
        if (provided && next[key] !== null) ${n('PreviousValid')}[key] = next[key];
      }
      // Every declared key above passed its specialized predicate or canonical null fallback.
      const snapshot = Object.freeze(next) as Readonly<GeneratedResolvedProps>;
      return snapshot;
    }
    function ${n('DefineProps')}(declarations: Record<string, ${n('PropSpec')}>): void {
      for (const key of Object.keys(declarations)) {
        const incoming = declarations[key], previous = ${n('PropSpecs')}[key];
        if (!Object.hasOwn(${n('PropChecks')}, key)) throw new Error('[Vue source] undeclared prop schema');
        const rank = (empty: string) => empty === 'accept' ? 0 : empty === 'error' ? 2 : 1;
        if (previous && incoming.empty && rank(incoming.empty) > rank(previous.empty ?? 'fallback')) throw new Error('[Vue source] props cannot become stricter');
        if (previous?.options && (!incoming.options || previous.options.some((value) => !incoming.options!.includes(value)))) throw new Error('[Vue source] prop options cannot narrow');
        if (previous?.range && ((incoming.range?.min ?? -Infinity) > (previous.range.min ?? -Infinity) || (incoming.range?.max ?? Infinity) < (previous.range.max ?? Infinity))) throw new Error('[Vue source] prop range cannot narrow');
        ${n('PropSpecs')}[key] = { ...previous, ...incoming, ...(previous ? { empty: previous.empty ?? 'fallback' } : {}), ...(previous && Object.hasOwn(previous, 'default') ? { default: previous.default } : {}) };
      }
      ${n('Props')} = ${n('ResolveProps')}(${n('RawProps')}, false);
${usesStyle ? `      ${n('Style')}.refresh();` : ''}
${usesInteraction ? `      ${n('Interaction')}.refresh();` : ''}
    }
    function ${n('SetDefaults')}(defaults: Record<string, unknown>): void {
      for (const key of Object.keys(defaults)) if (!Object.hasOwn(${n('PropSpecs')}, key)) throw new Error('[Vue source] defaults require a declared prop');
      ${n('Defaults')}.unshift({ ...defaults });
      ${n('Props')} = ${n('ResolveProps')}(${n('RawProps')}, false);
${usesStyle ? `      ${n('Style')}.refresh();` : ''}
${usesInteraction ? `      ${n('Interaction')}.refresh();` : ''}
    }
    function ${n('WatchProps')}(keys: readonly string[], callback: (run: ${n('Run')}, next: Readonly<GeneratedResolvedProps>, previous: Readonly<GeneratedResolvedProps>, info: ${n('WatchInfo')}) => void): () => void {
      if (!keys.length || keys.some((key) => !Object.hasOwn(${n('PropSpecs')}, key))) throw new Error('[Vue source] watch requires declared prop keys');
      const entry = { keys: [...keys], callback, active: true };
      ${n('Watchers')}.push(entry);
      return () => { ${n('Alive')}(); entry.active = false; };
    }
    function ${n('ReadProps')}(run: ${n('Run')}): Readonly<GeneratedResolvedProps> { ${n('RequireRun')}(run); return ${n('Props')}; }
    function ${n('ReadRawProps')}(run: ${n('Run')}): Readonly<Record<string, unknown>> { ${n('RequireRun')}(run); return Object.freeze({ ...${n('RawProps')} }); }
    function ${n('IsProvided')}(run: ${n('Run')}, key: string): boolean { ${n('RequireRun')}(run); return Object.hasOwn(${n('RawProps')}, key); }
    function ${n('GetHostProps')}(): Record<string, unknown> {
      // Read the authored host snapshot, bypassing Vue Boolean casts and camelization.
      const raw: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(${n('Instance')}.vnode.props ?? {})) {
        const value = ${n('Instance')}.vnode.props![key];
        if (['key', 'ref', 'ref_for', 'ref_key'].includes(key) || key.startsWith('onVnode')) continue;
        if (!Object.hasOwn(${n('PropChecks')}, key) && (
          ['class', 'hostClass', 'surfaceClass', 'style', 'hostStyle', 'surfaceStyle'].includes(key) ||
          /^on[A-Z]/.test(key) && typeof value === 'function'
        )) continue;
        raw[key] = value;
      }
      return raw;
    }
    function ${n('NotifyProps')}(): void {
      if (${n('Disposed')} || ${n('Disposing')}) return;
      const raw = ${n('GetHostProps')}();
      const changed = Object.keys({ ...${n('RawProps')}, ...raw }).some((key) => Object.hasOwn(raw, key) !== Object.hasOwn(${n('RawProps')}, key) || !Object.is(raw[key], ${n('RawProps')}[key]));
      if (!changed) return;
      const previous = ${n('Props')};
      const next = ${n('ResolveProps')}(raw, true);
      ${n('RawProps')} = raw; ${n('Props')} = next;
${usesStyle ? `      ${n('Style')}.refresh();` : ''}
${usesInteraction ? `      ${n('Interaction')}.refresh();` : ''}
      const all = Object.keys(${n('PropSpecs')}).filter((key) => !Object.is(Reflect.get(previous, key), Reflect.get(next, key)));
      for (const watcher of ${n('Watchers')}) {
        if (!watcher.active) continue;
        const matched = watcher.keys.filter((key) => all.includes(key));
        if (matched.length) watcher.callback(${n('RunValue')}, next, previous, { changedKeysAll: all, changedKeysMatched: matched });
      }
    }
    function ${n('ActiveFrame')}(frame: ${n('Frame')}): void {
      ${n('Alive')}();
      if (!frame.epoch.active || frame.epoch !== ${n('CurrentEpoch')} || !${n('Present')}.value) throw new Error('[Vue source] stale view work');
    }
    function ${n('ReadFrameProps')}(frame: ${n('Frame')}): Readonly<GeneratedResolvedProps> { ${n('ActiveFrame')}(frame); return ${n('Props')}; }
    function ${n('ReadFrameRawProps')}(frame: ${n('Frame')}): Readonly<Record<string, unknown>> { ${n('ActiveFrame')}(frame); return Object.freeze({ ...${n('RawProps')} }); }
    function ${n('FrameProvided')}(frame: ${n('Frame')}, key: string): boolean { ${n('ActiveFrame')}(frame); return Object.hasOwn(${n('RawProps')}, key); }
    function ${n('Children')}(input: unknown): ${n('Vue')}.VNode | string | number | null | ${n('Vue')}.VNodeArrayChildren {
      if (input === null) return null;
      if (Array.isArray(input)) return input.map(${n('Children')});
      if (typeof input === 'string' || typeof input === 'number' || ${n('Vue')}.isVNode(input)) return input;
      throw new TypeError('[Vue source] invalid template child');
    }
    function ${n('Element')}(frame: ${n('Frame')}, tag: string, ...args: unknown[]): ${n('Vue')}.VNode {
      ${n('ActiveFrame')}(frame);
      let children: unknown = null;
      let attributes: Record<string, string> | null = null;
      if (args.length > 1 || args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0]) && !${n('Vue')}.isVNode(args[0])) {
        if (!${n('IsRecord')}(args[0])) throw new Error('[Vue source] unsupported template props');
        const keys = Object.keys(args[0]);
${usesStyle ? `        if (keys.length) {
          if (keys.length !== 1 || keys[0] !== 'style') throw new Error('[Vue source] unsupported template props');
          attributes = { 'data-pui-style': ${n('TemplateStyleTokens')}(args[0].style as ${n('StyleHandle')}) };
        }` : `        if (keys.length) throw new Error('[Vue source] unsupported template props');`}
        children = args.length > 1 ? args[1] : null;
      } else if (args.length) children = args[0];
      const normalized = ${n('Children')}(children);
      return ${n('Vue')}.h(tag, attributes, normalized ?? undefined);
    }
    function ${n('Slot')}(frame: ${n('Frame')}): ${n('Vue')}.VNode {
      ${n('ActiveFrame')}(frame);
      if (frame.slotUsed) throw new Error('[Vue source] multiple slots are not supported');
      frame.slotUsed = true;
      return ${n('Vue')}.h(${n('SlotView')}, { read: () => {
        ${n('SlotRevision')}.value;
        if (${n('Disposed')} || ${n('Disposing')} || !frame.epoch.active || frame.epoch !== ${n('CurrentEpoch')} || !${n('Present')}.value) return null;
        return ${n('Context')}.slots.default?.() ?? null;
      } });
    }

${hookCode}
    const ${n('Renderer')} = (() => {
      try {
        const renderer = (${fn(ir.setup, 3)})(${usesStyle ? n('DefValue') : 'undefined'});
${usesRoot ? `        ${n('Setup')} = false;` : ''}
        ${n('RawProps')} = ${n('GetHostProps')}();
        ${n('Props')} = ${n('ResolveProps')}(${n('RawProps')}, true);
${usesStyle ? `        ${n('Style')}.refresh();` : ''}
${usesInteraction ? `        ${n('Interaction')}.refresh();` : ''}
        ${n('InvokeLife')}('created');
        return renderer;
      } catch (error) {
        ${n('Disposing')} = true;
        try { ${usesInteraction ? `${n('Interaction')}.dispose();` : ''} }
        finally {
          try { ${usesStyle ? `${n('Style')}.dispose();` : ''} }
          finally {
            try { ${contextArtifacts ? `${n('Scope')}.dispose();` : ''} }
            finally {
              ${n('Disposed')} = true;
              for (const cleanup of ${n('StateCleanup')}) cleanup();
              ${n('StateQueue')}.length = 0; ${n('Watchers')}.length = 0;
            }
          }
        }
        throw error;
      }
    })();
    const ${n('Handle')}: GeneratedHandle = Object.freeze({
      update() { ${n('PublicAlive')}(); ${n('RequestUpdate')}(${n('RunValue')}); },
      getExposes() { ${n('PublicAlive')}(); return ${n('Exposes')} as GeneratedExposes; },
    });
    ${n('Context')}.expose(${n('Handle')});

    const ${n('View')} = ${n('Vue')}.defineComponent({
      name: 'CompiledView', inheritAttrs: false,
      props: { revision: { type: Number, required: true } },
      setup(viewProps) {
        let epoch: ${n('Epoch')} = { id: ++${n('EpochId')}, active: true, committed: false };
        ${n('CurrentEpoch')} = epoch;
        const activation = ${n('Vue')}.shallowRef(0);
        let deactivated = false;
        let drawnRevision = -1, drawnActivation = -1;
        let cached: ${n('Vue')}.VNodeArrayChildren = [];
${usesRoot ? `        let root: HTMLElement | null = null;
        function bindRoot(element: Element | ${n('Vue')}.ComponentPublicInstance | null): void {
          if (!element) { ${n('UnbindRoot')}(epoch); return; }
          if (!(element instanceof HTMLElement)) throw new TypeError('[Vue source] Root must be an HTMLElement');
          root = element;
          if (epoch !== ${n('CurrentEpoch')} || !epoch.active) return;
          if (${n('RootEpoch')} && (${n('RootElement')} !== root || ${n('RootEpoch')} !== epoch)) ${n('UnbindRoot')}(${n('RootEpoch')});
          ${n('RootElement')} = root; ${n('RootEpoch')} = root ? epoch : undefined;
          if (epoch.committed) {
${usesStyle ? `            ${n('Style')}.mount();` : ''}
${usesInteraction ? `            ${n('Interaction')}.mount();` : ''}
          }
        }` : ''}
        function commit(): void {
          if (${n('Disposed')} || ${n('Disposing')} || deactivated || !epoch.active || epoch !== ${n('CurrentEpoch')} || !${n('Present')}.value) return;
          if (!epoch.committed) {
            epoch.committed = true;
${usesStyle ? `            ${n('Style')}.mount();` : ''}
${usesInteraction ? `            ${n('Interaction')}.mount();` : ''}
            ${n('InvokeLife')}('mounted');
          }
          else ${n('InvokeLife')}('updated');
        }
        ${n('Vue')}.onMounted(commit);
        ${n('Vue')}.onUpdated(commit);
        ${n('Vue')}.onBeforeUnmount(() => { epoch.active = false; ${usesRoot ? `${n('UnbindRoot')}(epoch);` : ''} });
        ${n('Vue')}.onUnmounted(() => { ${n('CommitUnmount')}(epoch); });
        ${n('Vue')}.onDeactivated(() => { deactivated = true; ${n('CommitUnmount')}(epoch); });
        ${n('Vue')}.onActivated(() => {
          if (!deactivated || ${n('Disposed')} || ${n('Disposing')}) return;
          deactivated = false;
          epoch = { id: ++${n('EpochId')}, active: true, committed: false };
          ${n('CurrentEpoch')} = epoch;
${usesRoot ? `          ${n('RootElement')} = root; ${n('RootEpoch')} = root ? epoch : undefined;` : ''}
          activation.value += 1;
        });
        return () => {
          const revision = viewProps.revision!, active = activation.value;
          if (${n('Disposed')} || ${n('Disposing')} || deactivated || !epoch.active || epoch !== ${n('CurrentEpoch')} || !${n('Present')}.value) return null;
          if (drawnRevision !== revision || drawnActivation !== active) {
            drawnRevision = revision; drawnActivation = active;
            ${n('Requested')} = false;
            const frame: ${n('Frame')} = { epoch, slotUsed: false };
            const children = typeof ${n('Renderer')} === 'function' ? ${n('Children')}(${n('Renderer')}(frame)) : null;
            cached = children == null ? [] : Array.isArray(children) ? children : [children];
          }
          return ${n('Vue')}.h('div', { 'data-pui-root': ''${usesRoot ? ', ref: bindRoot' : ''} }, cached);
        };
      },
    });
    ${n('Vue')}.onBeforeUpdate(() => { ${n('NotifyProps')}(); ${n('SlotRevision')}.value += 1; });
    ${n('Vue')}.onBeforeUnmount(() => {
      ${n('Disposing')} = true;
      ${n('QueueTicket')} += 1;
      ${n('Requested')} = false;
${usesRoot ? `      if (${n('CurrentEpoch')}) ${n('UnbindRoot')}(${n('CurrentEpoch')});` : ''}
      if (${n('CurrentEpoch')}) ${n('CurrentEpoch')}.active = false;
    });
    ${n('Vue')}.onUnmounted(() => {
      ${n('InternalTeardown')} = true;
      try { ${n('InvokeLife')}('beforeDispose'); }
      finally {
        try { ${contextArtifacts ? `${n('Scope')}.dispose();` : ''} }
        finally {
          try { ${usesInteraction ? `${n('Interaction')}.dispose();` : ''} }
          finally {
            try { ${usesStyle ? `${n('Style')}.dispose();` : ''} }
            finally {
              ${n('InternalTeardown')} = false; ${n('Disposed')} = true;
              for (const cleanup of ${n('StateCleanup')}) cleanup();
              ${n('StateQueue')}.length = 0; ${n('Watchers')}.length = 0;
            }
          }
        }
      }
    });
    return () => ${n('Present')}.value && !${n('Disposing')} ? ${n('Vue')}.h(${n('View')}, { revision: ${n('Revision')}.value }) : null;
  },
});
export default ${componentName};
`;
  return {
    ok: true,
    value: {
      code, profile: 'vue-source-v1',
      ...((usesStyle || usesInteraction || contextArtifacts) ? { supportingFiles: [...(contextArtifacts?.files ?? []), ...(usesStyle ? [nativeStyleArtifact] : []), ...(usesInteraction ? [nativeInteractionArtifact] : [])] } : {}),
      dependencies: TARGET_PROFILES['vue-source-v1'].dependencies.map((dependency) => ({ ...dependency })),
      provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'vue-source-v1' },
    },
  };
}
