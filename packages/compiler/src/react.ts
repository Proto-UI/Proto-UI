import { pruneDeadValues } from './demand-pruning';
import {
  emitJavaScriptValue,
  emitJavaScriptRecord,
  emitJavaScriptParameters,
  formatJavaScriptValueType,
  emitOptionalOperation,
  createJavaScriptValueReader,
  emitJavaScriptMember,
} from './native-value-lowering';
import { createHash } from 'node:crypto';
import { validateIR, validIdentifier } from './ir-validation';
import { OPERATION_RULES, privilegedCaptureType } from './operations';
import { formatDataType } from './data-types';
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
  AuthoredHookIR,
} from './ir';
import type { RuleCondition } from './rule-declarations';
import { observableSemantics, type PropsUpdatePolicy } from './observable-semantics';

/** Direct checked semantic calls; never input-source evaluation or an IR interpreter. */
export function emitReact(
  input: PrototypeIR,
  options: { componentName?: string; propsUpdatePolicy?: PropsUpdatePolicy } = {}
): CompileResult<GeneratedModule> {
  const checked = validateIR(input);
  if (!checked.ok) return checked;
  const ir = pruneDeadValues(checked.value);
  const readValue = createJavaScriptValueReader(ir, typeName);
  const componentName = options.componentName ?? 'CompiledComponent';
  if (
    !validIdentifier(componentName) ||
    ['prototype', 'createComponent', 'GeneratedProps', 'GeneratedExposes'].includes(componentName)
  )
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
  const names = new Set([componentName]);
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object')
      for (const [key, item] of Object.entries(value)) {
        if (key === 'name' && typeof item === 'string') names.add(item);
        collect(item);
      }
  };
  collect(ir.setup);
  ir.hooks.forEach((hook) => collect(hook.setup));
  let p = '__pui';
  while ([...names].some((name) => name.startsWith(p))) p += '_';
  const core = `${p}Core`;
  const hooks = new Map(ir.hooks.map((hook, index) => [hook.id, `${p}Hook${index}`]));
  const keys = new Map<string, { name: string; file: string }>(
    ir.contextKeys.map((key, index) => [
      key.id,
      {
        name: `${p}Context${index}`,
        file: `context-${createHash('sha256').update(key.id).digest('hex').slice(0, 24)}.ts`,
      },
    ])
  );
  const staticNames = new Map(
    ir.staticDeclarations.map((declaration, index) => [
      declaration.id,
      {
        name: `${p}Static${index}`,
        file: `static-${createHash('sha256').update(declaration.id).digest('hex').slice(0, 24)}.ts`,
      },
    ])
  );
  function typeName(type: ValueType): string {
    if (type === 'delay-task') return `${core}.DelayTask`;
    if (type === 'presence-owner') return `${core}.PresenceOwnerDeclaration<GeneratedProps>`;
    if (type === 'presentation-owner-ref') return `${core}.PresentationOwnerRef`;
    if (type === 'presentation-owner-writer') return `${core}.PresentationOwnerWriter`;
    if (type === 'presentation-view-binding') return `${core}.PresentationViewBinding`;
    if (type === 'context-key')
      return "import('@proto.ui/types').ContextKey<import('@proto.ui/types').JsonObject>";
    if (typeof type !== 'string' && type.kind === 'capture')
      return `${core}.AsHookResult<GeneratedProps, ${hookContract(ir.hooks.find((hook) => hook.id === type.hookId)!)}>`;
    if (typeof type === 'string' && type.startsWith('lexical:')) return type.slice(8);
    if (typeof type !== 'string') return formatJavaScriptValueType(type, typeName);
    if (type === 'exception') return 'unknown';
    if (isDataValueType(type)) return formatDataType(type);
    if (type === 'def') return `${core}.DefHandle<GeneratedProps, GeneratedExposes>`;
    if (type === 'run') return `${core}.RunHandle<GeneratedProps>`;
    if (type === 'render') return `Parameters<${core}.RenderFn>[0]`;
    if (type === 'props') return `${core}.PropsSnapshot<GeneratedProps>`;
    if (type === 'event') return `Parameters<${core}.ProtoEventCallback<GeneratedProps>>[1]`;
    if (type === 'event-control')
      return `Parameters<${core}.ProtoEventCallback<GeneratedProps>>[1]['control']`;
    if (type === 'event-or-control')
      return `(Parameters<${core}.ProtoEventCallback<GeneratedProps>>[1] | Parameters<${core}.ProtoEventCallback<GeneratedProps>>[1]['control'])`;
    if (type === 'style-handle') return `${core}.StyleHandle`;
    if (type === 'rule-handle') return `${core}.RuleHandle`;
    if (typeof type === 'string' && type.startsWith('state:'))
      return `${core}.State<${type.slice(6)}>`;
    if (type.startsWith('nullable:')) return `${typeName(type.slice(9) as ValueType)} | null`;
    if (type.startsWith('optional:')) return `${typeName(type.slice(9) as ValueType)} | undefined`;
    if (type.startsWith('observed:'))
      return `${core}.ObservedStateHandle<${type.slice(9)}, GeneratedProps>`;
    if (type.startsWith('borrowed:'))
      return `${core}.BorrowedStateHandle<${type.slice(9)}, GeneratedProps>`;
    if (type.startsWith('state-event:'))
      return `Parameters<${core}.StateWatchCallback<${type.slice(12)}, GeneratedProps>>[1]`;
    if (type.startsWith('state-next:'))
      return `Extract<Parameters<${core}.StateWatchCallback<${type.slice(11)}, GeneratedProps>>[1], {type:'next'}>`;
    if (type === 'state-disconnect') return `{type:'disconnect';reason:'unmount'}`;
    const nativeTypes: Readonly<Record<string, string>> = {
      focus: 'FocusableHandle',
      accessible: 'AccessibleHandle',
      'control-label': 'ControlLabelFacade',
      'control-label-handle': 'ControlLabelHandle',
      'control-label-request': 'ControlLabelRequest',
      'focus-entry': 'FocusEntryHandle',
      'focus-scope': 'FocusScopeHandle',
      'focus-roving': 'FocusRovingHandle',
      'anatomy-family': 'AnatomyFamily',
      'anatomy-part': 'AnatomyPartView',
      'anatomy-order': 'AnatomyOrderView',
      'collection': 'CollectionHandles',
      'collection-item': 'CollectionItemHandles',
      'collection-snapshot': 'CollectionItemSnapshot',
      boundary: 'BoundaryHandle',
      'hit-participation': 'HitParticipationHandle',
      positioning: 'AnchoredPositionHandle',
      overlay: 'OverlayHandle',
      scroll: 'ScrollSurfaceHandle',
      'scroll-axis': 'ScrollAxisFactsHandle',
      'scroll-follow': 'ScrollEndFollowFactsHandle',
      'a11y-ref': 'A11ySemanticObjectRef',
      'focus-scope-key': 'FocusScopeKey',
      'focus-roving-key': 'FocusRovingKey',
      'text-control': 'TextControlHandle',
      'boundary-outside-event': 'BoundaryOutsideEvent',
      'boundary-sample': 'BoundarySample',
    };
    if (Object.hasOwn(nativeTypes, type)) return `${core}.${nativeTypes[type]}`;
    if (type === 'anatomy-parts') return `readonly ${core}.AnatomyPartView[]`;
    if (type === 'collection-snapshot-list') return `readonly ${core}.CollectionItemSnapshot[]`;
    if (type === 'a11y-ref-list') return `readonly ${core}.A11ySemanticObjectRef[]`;
    const tableTypes: Readonly<Record<string, string>> = {
      'table-structure': 'TableStructureHandle',
      'table-states': 'TableStructureStateHandles',
      'table-snapshot': 'TableStructureSnapshot',
      'table-row': 'TableStructureRowSnapshot',
      'table-cell': 'TableStructureCellSnapshot',
      'table-diagnostic': 'TableStructureDiagnostic',
    };
    if (Object.hasOwn(tableTypes, type))
      return `import('@proto.ui/module-table-structure').${tableTypes[type]}`;
    if (['style-disposer', 'subscription-disposer', 'binding-disposer'].includes(type))
      return '() => void';
    if (type === 'record') return 'Record<string, unknown>';
    if (type === 'array') return 'readonly unknown[]';
    return 'unknown';
  }
  function parameters(values: readonly ParameterIR[]): string {
    return emitJavaScriptParameters(values, (value) => expression(value, 0), typeName);
  }
  function hookContract(hook: AuthoredHookIR): string {
    const capture = hook.capture;
    if (!capture) return '{}';
    const states = capture.states
      .map((state) => `${JSON.stringify(state.name)}: ${typeName(state.type)}`)
      .join('; ');
    const children = capture.children
      .map((child) => {
        const privileged = privilegedCaptureType(child.id);
        if (privileged) return `${JSON.stringify(child.name)}: ${typeName(privileged)}`;
        const nested = ir.hooks.find((candidate) => candidate.id === child.id)!;
        const result = nested.projectHandle
          ? typeName(nested.projectHandle.returnType)
          : `${core}.AsHookResult<GeneratedProps, ${hookContract(nested)}>`;
        return `${JSON.stringify(child.name)}: ${result}`;
      })
      .join('; ');
    return `{ state: { ${states} }; asHooks: { ${children} } }`;
  }
  function fn(value: FunctionIR, depth: number): string {
    return `(${emitJavaScriptParameters(value.parameters, (item) => expression(item, depth), typeName)})${value.context === 'helper' && value.returnType !== 'function' && value.returnType !== 'unknown' ? `: ${typeName(value.returnType)}` : ''} => {\n${statements(value.body, depth + 1)}${'  '.repeat(depth)}}`;
  }
  function expression(value: ExpressionIR, depth: number): string {
    switch (value.kind) {
      case 'narrow':
      case 'member-write':
      case 'element':
      case 'conditional':
      case 'call':
      case 'intrinsic':
      case 'object-spread':
        return emitJavaScriptValue(value, (item) => expression(item, depth), typeName)!;
      case 'undefined':
        return '(void 0)';
      case 'literal':
        return JSON.stringify(value.value);
      case 'reference':
        return readValue(value, value.name);
      case 'lexical-cell':
        return expression(value.value, depth);
      case 'lexical-read':
        return readValue(value, expression(value.cell, depth));
      case 'lexical-write':
        return `(${expression(value.cell, depth)} = ${expression(value.value, depth)})`;
      case 'lexical-update': {
        const cell = expression(value.cell, depth),
          operator = value.delta === 1 ? '++' : '--';
        return `(${value.prefix ? operator + cell : cell + operator})`;
      }
      case 'context-key':
        return keys.get(value.keyId)!.name;
      case 'style-handle':
        return `${core}.tw(${JSON.stringify(value.handle.tokens.join(' '))})`;
      case 'rule': {
        const declaration = value.declaration;
        const states = new Map(value.states.map((state) => [state.id, state.value]));
        const builder = `${p}When`,
          intent = `${p}Intent`;
        const condition = (node: RuleCondition): string => {
          if (node.type === 'true' || node.type === 'false')
            return `${builder}.${node.type === 'true' ? 't' : 'f'}()`;
          if (node.type === 'eq') {
            const signal =
              node.left.type === 'prop'
                ? `${builder}.prop(${JSON.stringify(node.left.key)})`
                : `${builder}.state(${expression(states.get(node.left.id)!, depth)})`;
            return `${signal}.eq(${JSON.stringify(node.right)})`;
          }
          if (node.type === 'not') return `${builder}.not(${condition(node.expr)})`;
          return `${builder}.${node.type}(${node.exprs.map(condition).join(', ')})`;
        };
        const operations = declaration.intent.ops
          .map(
            (operation) =>
              `${intent}.feedback.style.use(${operation.handles.map((handle) => `${core}.tw(${JSON.stringify(handle.tokens.join(' '))})`).join(', ')});`
          )
          .join(' ');
        const metadata = `${declaration.label === undefined ? '' : `label: ${JSON.stringify(declaration.label)}, `}${declaration.note === undefined ? '' : `note: ${JSON.stringify(declaration.note)}, `}`;
        return `${expression(value.receiver, depth)}.rule({ ${metadata}when: (${builder}) => ${condition(declaration.when)}, intent: (${intent}) => { ${operations} } })`;
      }
      case 'member':
        return emitJavaScriptMember(
          value,
          (item) => expression(item, depth),
          typeName,
          true,
          readValue
        );
      case 'unary':
        return `(${value.operator}${expression(value.operand, depth)})`;
      case 'binary':
        return `(${expression(value.left, depth)} ${value.operator} ${expression(value.right, depth)})`;
      case 'array':
        return `[${value.elements.map((item) => expression(item, depth)).join(', ')}]`;
      case 'record':
        return emitJavaScriptRecord(value, (item) => expression(item, depth), typeName);
      case 'function':
        return fn(value.function, depth);
      case 'helper-call':
        return `${value.name}(${value.arguments.map((argument) => expression(argument, depth)).join(', ')})`;
      case 'authored-hook':
        return `${hooks.get(value.hookId)}(${(value.arguments ?? []).map((item) => expression(item, depth)).join(', ')})`;
      case 'static-capability':
        return staticNames.get(value.declarationId)!.name;
      case 'operation': {
        const optional = emitOptionalOperation(
          value,
          (item) => expression(item, depth),
          `${p}OptionalReceiver`,
          typeName
        );
        if (optional !== undefined) return optional;
        if (value.operation === 'scheduler.delay')
          return `${core}.delay(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
        if (value.operation === 'presentation.snapshotCompletion')
          return `${core}.snapshotPresentationCompletionConfig(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
        if (value.operation === 'meta.get')
          return `${expression(value.receiver!, depth)}.meta?.get(${value.arguments.map((item) => expression(item, depth)).join(', ')})`;
        if (value.operation === 'state.get')
          return `(${expression(value.receiver!, depth)}.get() as ${typeName(value.type)})`;
        if (value.operation.startsWith('capture.'))
          return `(${expression(value.receiver!, depth)}.${OPERATION_RULES[value.operation].path}?.(${value.arguments.map((item) => expression(item, depth)).join(', ')}) as ${typeName(value.type)})`;
        const rule = OPERATION_RULES[value.operation];
        if (rule.path === 'call')
          return `(${expression(value.receiver!, depth)})(${value.arguments.map((argument) => expression(argument, depth)).join(', ')})`;
        const callee = value.operation.startsWith('hook.')
          ? `${p}Hooks.${rule.path}`
          : `${expression(value.receiver!, depth)}.${rule.path}`;
        return `${callee}(${value.arguments.map((argument) => expression(argument, depth)).join(', ')})`;
      }
    }
  }
  function statements(body: readonly StatementIR[], depth: number): string {
    const indent = '  '.repeat(depth);
    return body
      .map((statement) => {
        const origin = `${indent}// Source ${JSON.stringify(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
        switch (statement.kind) {
          case 'const':
            return `${origin}${indent}${statement.value.kind === 'lexical-cell' ? 'let' : 'const'} ${statement.name}${['lexical-cell', 'record', 'object-spread'].includes(statement.value.kind) ? `: ${typeName(statement.value.type)}` : ''} = ${expression(statement.value, depth)};\n`;
          case 'effect':
            return `${origin}${indent}${expression(statement.expression, depth)};\n`;
          case 'return':
            return `${origin}${indent}return${statement.value ? ` ${expression(statement.value, depth)}` : ''};\n`;
          case 'throw':
            return `${origin}${indent}throw ${expression(statement.value, depth)};\n`;
          case 'try':
            return `${origin}${indent}try {\n${statements(statement.body, depth + 1)}${indent}}${statement.catch ? ` catch${statement.catch.name ? ` (${statement.catch.name})` : ''} {\n${statements(statement.catch.body, depth + 1)}${indent}}` : ''}${statement.finally ? ` finally {\n${statements(statement.finally, depth + 1)}${indent}}` : ''}\n`;
          case 'if':
            return `${origin}${indent}if (${expression(statement.condition, depth)}) {\n${statements(statement.then, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, depth + 1)}${indent}}` : ''}\n`;
        }
      })
      .join('');
  }
  const props = ir.props
    .map((prop) => `  ${JSON.stringify(prop.name)}?: ${formatDataType(prop.type)};`)
    .join('\n');
  const exposes = ir.exposes
    .map((value) => {
      const type =
        value.kind === 'state'
          ? `${core}.ExposeState<${value.type}>`
          : value.kind === 'value'
            ? `${core}.ExposeValue<${typeName(value.type)}>`
            : value.kind === 'event'
              ? `${core}.ExposeEvent<${formatDataType(value.payload)}>`
              : `${core}.ExposeMethod<(${parameters(value.parameters)}) => ${typeName(value.returnType)}>`;
      return `  ${JSON.stringify(value.name)}: ${type};`;
    })
    .join('\n');
  const hookCode =
    statements(ir.moduleBindings ?? [], 0) +
    ir.hooks
      .map((hook) => {
        const contract = hookContract(hook);
        const result =
          hook.kind === 'hook'
            ? typeName(hook.optionsType ?? 'void')
            : hook.projectHandle
              ? typeName(hook.projectHandle.returnType)
              : `${core}.AsHookResult<GeneratedProps, ${contract}>`;
        return `const ${hooks.get(hook.id)} = ${core}.${hook.kind === 'hook' ? 'defineHook' : 'defineAsHook'}<GeneratedProps, GeneratedExposes, ${contract}, ${result}>({\n  name: ${JSON.stringify(hook.name)},${hook.kind === 'hook' ? `\n  mode: ${JSON.stringify(hook.mode ?? 'once')},` : ''}\n  setup: ${fn(hook.setup, 1)},${hook.projectHandle ? `\n  projectHandle: ${fn(hook.projectHandle, 1)},` : ''}${hook.configure ? `\n  configure: ${fn(hook.configure, 1)},` : ''}\n});\n`;
      })
      .join('\n');
  const contextImports = [
    ...ir.contextKeys.map(
      (key) =>
        `import { key as ${keys.get(key.id)!.name} } from ${JSON.stringify('./' + keys.get(key.id)!.file.replace(/\.ts$/, ''))};`
    ),
    ...[...staticNames.values()].map(
      (entry) =>
        `import { declaration as ${entry.name} } from ${JSON.stringify('./' + entry.file.replace(/\.ts$/, ''))};`
    ),
  ].join('\n');
  const supportingFiles = ir.contextKeys.map((key) => ({
    path: keys.get(key.id)!.file,
    kind: 'source' as const,
    contents: `import { createContextKey } from '@proto.ui/core';\n// Original declaration ${JSON.stringify(key.id)}\nexport const key = createContextKey<${formatDataType(key.type)}>(${JSON.stringify(key.name)});\n`,
  }));
  for (const declaration of ir.staticDeclarations) {
    const factory =
      declaration.kind === 'anatomy-family'
        ? 'createAnatomyFamily'
        : declaration.kind === 'a11y-ref'
          ? 'createA11ySemanticObjectRef'
          : declaration.kind === 'focus-scope-key'
            ? 'createFocusScopeKey'
            : 'createFocusRovingKey';
    const arguments_ =
      declaration.kind === 'anatomy-family'
        ? `${JSON.stringify(declaration.name)}, ${JSON.stringify(declaration.config)}`
        : declaration.kind === 'a11y-ref'
          ? ''
          : JSON.stringify(declaration.config);
    supportingFiles.push({
      path: staticNames.get(declaration.id)!.file,
      kind: 'source',
      contents:
        declaration.id === '@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY'
          ? `export { TABLE_STRUCTURE_FAMILY as declaration } from '@proto.ui/module-table-structure';\n`
          : `import { ${factory} } from '@proto.ui/core';\nexport const declaration = ${factory}(${arguments_});\n`,
    });
  }
  const code = `// Editable generated source. Profile: react-runtime-v1.\n// Retains Proto-UI Runtime and React Adapter; NOT zero-runtime output.\n// Source graph SHA-256: ${ir.source.sha256}\nimport * as ${p}React from 'react';\nimport * as ${core} from '@proto.ui/core';\nimport * as ${p}Hooks from '@proto.ui/hooks';\nimport { createReactAdapter as ${p}CreateAdapter } from '@proto.ui/adapter-react';\nimport type { ReactAdapterOptions as ${p}Options } from '@proto.ui/adapter-react';\n${contextImports}\n\nexport type GeneratedProps = {\n${props}\n};\nexport type GeneratedExposes = {\n${exposes}\n};\n\n${hookCode}\nexport const prototype = ${core}.definePrototype<GeneratedProps, GeneratedExposes>({\n  name: ${JSON.stringify(ir.name)},\n  setup: ${fn(ir.setup, 1)},\n});\nconst ${p}Adapt = ${p}CreateAdapter(${p}React);\nexport function createComponent(options?: ${p}Options<GeneratedProps>) {\n  return ${p}Adapt(prototype, { autoUpdateOnPropsChange: ${options.propsUpdatePolicy !== 'explicit'}, ...options });\n}\nexport const ${componentName} = createComponent();\nexport default ${componentName};\n`;
  return {
    ok: true,
    value: {
      code,
      profile: 'react-runtime-v1',
      supportingFiles,
      dependencies: [
        { name: 'react', version: '19.2.6', role: 'target' },
        { name: 'react-dom', version: '19.2.6', role: 'target' },
        { name: '@proto.ui/core', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
        { name: '@proto.ui/hooks', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
        { name: '@proto.ui/adapter-react', version: '0.3.0-alpha.1', role: 'host-bridge' },
      ],
      provenance: {
        source: ir.source,
        irVersion: ir.schemaVersion,
        backend: 'react-runtime-v1',
        observableSemantics: observableSemantics(
          'react',
          'runtime-backed',
          options.propsUpdatePolicy
        ),
      },
    },
  };
}
