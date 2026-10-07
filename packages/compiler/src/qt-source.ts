import { validateIR, validIdentifier } from './ir-validation';
import { OPERATION_RULES } from './operations';
import { buildQtContextArtifacts, emitQtContextValidation } from './qt-native-context';
import { emitQtStyleHandle, qtStyleSource, qtStyleToken } from './qt-native-style';
import { qtInteractionSource } from './qt-native-interaction';
import { qtOwnerSource } from './qt-native-owner';
import { qtNodeSource } from './qt-native-view';
import { qtHostArtifacts } from './qt-native-host';
import { qtControlsSource } from './qt-native-controls';
import { qtTopologySource } from './qt-native-topology';
import { qtPresentationSource } from './qt-native-presentation';
import { qtTableProjectionSource } from './qt-native-table';
import { buildNativeStaticDeclarations } from './native-static-declarations';
import type { DataType } from './data-types';
import { isDataValueType, isPublicValueType } from './ir';
import type { CompileResult, CompilerDiagnostic, ExpressionIR, FunctionIR, GeneratedModule, PrototypeIR, StatementIR, ValueType } from './ir';
import type { RuleCondition } from './rule-declarations';

/** Emit normal Qt Quick 6.4 source: authored statements are ordinary JavaScript closures. */
export function emitQtSource(input: PrototypeIR, options: { componentName?: string } = {}): CompileResult<GeneratedModule> {
  const checked = validateIR(input);
  if (!checked.ok) return checked;
  const ir = checked.value;
  const componentName = options.componentName ?? 'CompiledComponent';
  if (!validIdentifier(componentName)) return { ok: false, diagnostics: [{ code: 'PUI_QT_NAME', category: 'invalid-input', message: 'Choose a valid Qt component identifier.', span: ir.setup.span }] };
  const names = new Set<string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') for (const [key, member] of Object.entries(value)) { if (key === 'name' && typeof member === 'string') names.add(member); collect(member); }
  };
  collect(ir);
  let p = 'puiQt';
  while ([...names].some((name) => name.startsWith(p))) p += '_';
  const context = buildQtContextArtifacts(ir);
  const staticDeclarations = buildNativeStaticDeclarations(ir.staticDeclarations, ir.moduleDeclarations);
  const qualifier = `${p[0].toUpperCase()}${p.slice(1)}`;
  const keys = new Map(ir.contextKeys.map((key, index) => [key.id, `${qualifier}Key${index}.key`]));
  const hooks = new Map(ir.hooks.map((hook, index) => [hook.id, `${p}Hook${index}`]));
  const staticNames = new Map([...staticDeclarations.capabilities].map(([id], index) => [id, `${qualifier}Static${index}.declaration`]));
  function staticLiteral(value: unknown): string {
    if(value===null||typeof value!=='object')return typeof value==='number'&&Object.is(value,-0)?'-0':JSON.stringify(value);
    if(Array.isArray(value))return `Object.freeze([${value.map(staticLiteral).join(',')}])`;
    return `Object.freeze({${Object.entries(value).map(([key,item])=>`[${JSON.stringify(key)}]:${staticLiteral(item)}`).join(',')}})`;
  }
  const staticFiles = [...staticDeclarations.capabilities].map(([id, capability]) => {
    const declaration = ir.staticDeclarations.find((entry) => entry.id === id)!;
    const value = declaration.kind === 'anatomy-family'
      ? `Object.freeze({debugName:${JSON.stringify(declaration.name)},roles:${staticLiteral(declaration.config.roles ?? {})},relations:${staticLiteral(declaration.config.relations ?? [])},profiles:${staticLiteral(declaration.config.profiles ?? {})}})`
      : declaration.kind === 'a11y-ref' ? 'Object.freeze({})'
      : `Object.freeze({id:Symbol(${JSON.stringify(declaration.kind === 'focus-scope-key' ? '@proto.ui/focus-scope' : '@proto.ui/focus-roving')}),meta:${staticLiteral(declaration.config)}})`;
    return {path:capability.file.replace(/\.ts$/,'.mjs'),kind:'source' as const,contents:`// Checked declaration ${JSON.stringify(id)}; reference identity, not a debug-name lookup.\nexport const declaration = ${value};\n`};
  });
  const diagnostics: CompilerDiagnostic[] = [];
  const tokenTable: Record<string, Record<string, unknown>> = Object.create(null);
  const handles = (node: ExpressionIR, tokens: readonly string[]): void => {
    for (const token of tokens) {
      const result = qtStyleToken(token);
      if (!result) diagnostics.push({ code: 'PUI_QT_STYLE', category: 'unsupported-input', message: `Qt Quick has no declared native projection for token ${JSON.stringify(token)}.`, span: node.span });
      else tokenTable[token] = result;
    }
  };
  let needsGlobalInput = false;
  const inspect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as ExpressionIR;
    if (node.kind === 'style-handle') handles(node, node.handle.tokens);
    if (node.kind === 'rule') for (const operation of node.declaration.intent.ops) for (const handle of operation.handles) handles(node, handle.tokens);
    if (node.kind === 'operation' && node.operation === 'style.tw') {
      const argument = node.arguments[0];
      if (argument?.kind === 'literal' && typeof argument.value === 'string') handles(node, argument.value.trim().split(/\s+/).filter(Boolean));
      else diagnostics.push({code:'PUI_QT_DYNAMIC_STYLE',category:'unsupported-input',message:'Qt native tw values require the checked static token grammar; dynamic CSS is not a native style mapping.',span:node.span});
    }
    if (node.kind === 'operation' && ['event.onGlobal', 'hook.asOverlay', 'hook.asBoundary'].includes(node.operation)) needsGlobalInput = true;
    for (const member of Object.values(value)) inspect(member);
  };
  inspect(ir.setup); ir.hooks.forEach((hook) => inspect(hook.setup));
  for (const entry of ir.exposes) if (entry.kind === 'method') {
    for (const type of [...entry.parameters.map((parameter) => parameter.type), entry.returnType]) if (!isPublicValueType(type)) {
      diagnostics.push({code:'PUI_QT_PUBLIC_DATA',category:'unsupported-input',message:'Qt public methods require concrete portable data or approved public snapshot signatures; setup and Run capabilities cannot cross the QML public boundary.',span:entry.span});
    }
  }
  if (diagnostics.length) return {ok:false,diagnostics};
  function fn(node: FunctionIR, depth: number): string {
    return `function(${node.parameters.map((parameter) => parameter.name).join(', ')}) {\n${statements(node.body, depth + 1)}${'    '.repeat(depth)}}`;
  }
  function expression(node: ExpressionIR, depth: number): string {
    switch (node.kind) {
      case 'literal': return typeof node.value==='number'&&Object.is(node.value,-0)?'-0':JSON.stringify(node.value);
      case 'reference': return node.name;
      case 'context-key': return keys.get(node.keyId)!;
      case 'static-capability': return staticNames.get(node.declarationId)!;
      case 'style-handle': return emitQtStyleHandle(node.handle);
      case 'rule': {
        const bound = new Map(node.states.map((state) => [state.id, state.value]));
        const condition = (value: RuleCondition): string => {
          if (value.type === 'true' || value.type === 'false') return value.type;
          if (value.type === 'eq') return `(${value.left.type === 'prop' ? `${p}Owner.getProps()[${JSON.stringify(value.left.key)}]` : `${expression(bound.get(value.left.id)!, depth)}.get()`} === ${JSON.stringify(value.right)})`;
          if (value.type === 'not') return `!(${condition(value.expr)})`;
          return `(${value.exprs.map(condition).join(value.type === 'all' ? ' && ' : ' || ') || (value.type === 'all' ? 'true' : 'false')})`;
        };
        return `${p}Owner.style.rule(function() { return ${condition(node.declaration.when)}; }, [${node.declaration.intent.ops.flatMap((op) => op.handles).map(emitQtStyleHandle).join(', ')}])`;
      }
      case 'member': {
        const object = expression(node.object, depth);
        return node.optional ? `(function(${p}Optional) { return ${p}Optional == null ? undefined : ${p}Optional[${JSON.stringify(node.property)}]; })(${object})` : `(${object})[${JSON.stringify(node.property)}]`;
      }
      case 'unary': return `(${node.operator}${expression(node.operand, depth)})`;
      case 'binary': return node.operator === '??' ? `(function(${p}Optional) { return ${p}Optional == null ? ${expression(node.right, depth)} : ${p}Optional; })(${expression(node.left, depth)})` : `(${expression(node.left, depth)} ${node.operator} ${expression(node.right, depth)})`;
      case 'array': return `[${node.elements.map((item) => expression(item, depth)).join(', ')}]`;
      case 'record': return `{${node.entries.map((entry) => `[${JSON.stringify(entry.key)}]: ${expression(entry.value, depth)}`).join(', ')}}`;
      case 'function': return fn(node.function, depth);
      case 'helper-call': return `${node.name}(${node.arguments.map((item) => expression(item, depth)).join(', ')})`;
      case 'authored-hook': return `${hooks.get(node.hookId)}()`;
      case 'operation': {
        const args = node.arguments.map((item) => expression(item, depth)).join(', ');
        if (node.operation === 'style.tw') {
          const argument = node.arguments[0];
          if (argument?.kind !== 'literal' || typeof argument.value !== 'string') throw new Error('Unchecked dynamic Qt style reached source emission');
          return emitQtStyleHandle({kind:'tw',tokens:argument.value.trim().split(/\s+/).filter(Boolean)});
        }
        if (node.operation.startsWith('hook.')) return `${p}Owner.interaction.${OPERATION_RULES[node.operation].path}(${args})`;
        if (node.operation === 'feedback.style.release' || node.operation === 'binding.release' || node.operation === 'subscription.release') return `(${expression(node.receiver!, depth)})()`;
        return `${expression(node.receiver!, depth)}.${OPERATION_RULES[node.operation].path}(${args})`;
      }
    }
  }
  function statements(body: readonly StatementIR[], depth: number): string {
    const indent = '    '.repeat(depth);
    let result = '';
    for (const statement of body) {
      const origin = `${indent}// Source ${JSON.stringify(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
      switch (statement.kind) {
        case 'const': result += `${origin}${indent}const ${statement.name} = ${expression(statement.value, depth)};\n`; break;
        case 'effect': result += `${origin}${indent}${expression(statement.expression, depth)};\n`; break;
        case 'return': return `${result}${origin}${indent}return${statement.value ? ` ${expression(statement.value, depth)}` : ''};\n`;
        case 'if': result += `${origin}${indent}if (${expression(statement.condition, depth)}) {\n${statements(statement.then, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, depth + 1)}${indent}}` : ''}\n`; break;
      }
    }
    return result;
  }
  let sequence = 0;
  function predicate(value: string, type: DataType): string {
    if (typeof type === 'string') return type === 'null' ? `${value} === null` : type === 'void' ? `${value} === undefined` : `(typeof ${value} === ${JSON.stringify(type)}${type === 'number' ? ` && Number.isFinite(${value})` : ''})`;
    if (type.kind === 'literal') return `${value} === ${JSON.stringify(type.value)}`;
    if (type.kind === 'union') return `(${type.members.map((member) => predicate(value, member)).join(' || ')})`;
    if (type.kind === 'array') { const item = `${p}Item${sequence++}`; return `(Array.isArray(${value}) && Object.keys(${value}).length === ${value}.length && ${value}.every(function(${item}) { return ${predicate(item, type.element)}; }))`; }
    const fieldNames = JSON.stringify(type.fields.map((field) => field.name));
    return `(${value} !== null && typeof ${value} === 'object' && !Array.isArray(${value}) && (Object.getPrototypeOf(${value}) === Object.prototype || Object.getPrototypeOf(${value}) === null) && Object.keys(${value}).every(function(key) { return ${fieldNames}.indexOf(key) >= 0 && Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(${value}, key), 'value'); })${type.fields.map((field) => ` && (${field.optional ? `!Object.prototype.hasOwnProperty.call(${value}, ${JSON.stringify(field.name)}) || ` : `Object.prototype.hasOwnProperty.call(${value}, ${JSON.stringify(field.name)}) && `}${predicate(`${value}[${JSON.stringify(field.name)}]`, field.type)})`).join('')})`;
  }
  const qmlType = (type: ValueType): string => type === 'boolean' ? 'bool' : type === 'number' ? 'real' : type === 'string' ? 'string' : 'var';
  const propChecks = `{${ir.props.map((prop) => `[${JSON.stringify(prop.name)}]: function(value) { return ${predicate('value', prop.type)}; }`).join(', ')}}`;
  const eventChecks = `{${ir.exposes.filter((entry) => entry.kind === 'event').map((entry) => `[${JSON.stringify(entry.name)}]: function(value) { return ${predicate('value', entry.payload)}; }`).join(', ')}}`;
  const publicPredicate = (value: string, type: ValueType): string => isDataValueType(type) ? predicate(value,type) : `${typeof type === 'string' && type.startsWith('nullable:') ? `${value} === null || ` : ''}${typeof type === 'string' && type.startsWith('optional:') ? `${value} === undefined || ` : ''}(${value} !== null && typeof ${value} === 'object')`;
  const methodChecks = `{${ir.exposes.filter((entry) => entry.kind === 'method').map((entry) => `[${JSON.stringify(entry.name)}]: {args:function(args) { return args.length <= ${entry.parameters.length}${entry.parameters.map((parameter, index) => ` && (${parameter.optional ? `args[${index}] === undefined || ` : ''}${publicPredicate(`args[${index}]`, parameter.type)})`).join('')}; },result:function(value) { return ${publicPredicate('value', entry.returnType)}; }}`).join(', ')}}`;
  const publicApi = ir.exposes.map((entry, index) => {
    const key = JSON.stringify(entry.name);
    if (entry.kind === 'event') return `    signal exposedEvent${index}(${entry.payload === 'void' ? '' : `${qmlType(entry.payload)} payload`})`;
    if (entry.kind === 'value') return `    readonly property var exposedValue${index}: ${p}Ready ? ${p}Owner.getExposes()[${key}] : undefined`;
    if (entry.kind === 'state') return `    readonly property ${qmlType(entry.type)} exposedState${index}: { var revision = ${p}Revision; return ${p}Ready ? ${p}Owner.getExposes()[${key}].get() : ${entry.type === 'boolean' ? 'false' : entry.type === 'number' ? '0' : '""'} }`;
    return `    function exposedMethod${index}(${entry.parameters.map((parameter) => `${parameter.name}: ${qmlType(parameter.type)}`).join(', ')}): ${qmlType(entry.returnType)} {\n        if (!${p}Owner) throw new Error('Qt component is not ready')\n        return ${p}Owner.getExposes()[${key}](${entry.parameters.map((parameter) => parameter.name).join(', ')})\n    }`;
  }).join('\n');
  const eventDispatch = ir.exposes.map((entry, index) => entry.kind === 'event' ? `        if (key === ${JSON.stringify(entry.name)}) exposedEvent${index}(${entry.payload === 'void' ? '' : 'payload'})` : '').filter(Boolean).join('\n');
  const code = `// Editable ordinary Qt Quick 6.4.2 source. No Proto Runtime/Core/Adapter dependency.
// Authored templates are cached and reconciled only at explicit update or view epoch entry.
// Helper cost: owned Props/State/Context resources, Qt native facts/style repaint, QML node reconciliation.
// Public Props are a full presence-preserving rawProps map; mutation requires a replacement snapshot.
import QtQuick 6.4
import QtQuick.Window 6.4
import QtQml 6.4 as Qml
import PuiQtNative 1.0
import "./.proto-ui/qt/QtOwner.mjs" as ${qualifier}Native
import "./.proto-ui/qt/context/QtContextScope.mjs" as ${qualifier}Context
import "./.proto-ui/qt" as ${qualifier}View
${ir.contextKeys.map((key, index) => `import ${JSON.stringify(context.keys.get(key.id)!.file)} as ${qualifier}Key${index}`).join('\n')}
${[...staticDeclarations.capabilities].map(([,capability],index) => `import ${JSON.stringify('./'+capability.file.replace(/\.ts$/,'.mjs'))} as ${qualifier}Static${index}`).join('\n')}

FocusScope {
    id: ${p}Host
    objectName: ${JSON.stringify(componentName)}
    property var rawProps: ({})
    property Item logicalParent: null
    readonly property Window nativeWindow: ${p}Host.Window.window
    default property alias slotContent: ${p}Parking.data
    readonly property var logicalOwner: !${p}Closed && ${p}Owner ? ${p}Owner.identity : null
    readonly property var exposes: !${p}Closed && ${p}Owner ? ${p}Owner.exposes : ({})
    readonly property bool disposed: ${p}Closed
    readonly property int viewEpoch: ${p}Epoch
    readonly property bool present: ${p}Present
    readonly property Item nativeRoot: ${p}Root
    property var ${p}Owner: null
    property bool ${p}Closed: false
    property bool ${p}Ready: false
    property int ${p}Revision: 0
    property int ${p}Epoch: 0
    property bool ${p}Present: false
    property Item ${p}Root: null
    implicitWidth: ${p}Root ? ${p}Root.implicitWidth : 0
    implicitHeight: ${p}Root ? ${p}Root.implicitHeight : 0
${publicApi}
    signal exposed(string key, var payload)
    signal nativeHostEvent(string type, var event)
    onNativeHostEvent: (type, event) => { if (${p}Owner && !${p}Closed) ${p}Owner.nativeEvent(type, event) }
    property Item ${p}Parking: Item { id: ${p}Parking; readonly property Item logicalParent: ${p}Host; parent: ${p}Host; visible: parent !== ${p}Host; width: childrenRect.width; height: childrenRect.height; implicitWidth: childrenRect.width; implicitHeight: childrenRect.height }
    property Item ${p}Content: Item { parent: ${p}Host; anchors.fill: parent }
    property Qml.Component ${p}NodeComponent: Qml.Component { ${qualifier}View.QtNode {} }
    property NativeInputObserver ${p}InputObserver: NativeInputObserver {
        root: ${needsGlobalInput ? `${p}Root` : 'null'}
        onObserved: (name, event) => { if (${p}Owner && !${p}Closed) ${p}Owner.globalNativeEvent(name, event) }
    }
    function ensureOwner() {
        if (${p}Closed) throw new Error('Qt component is terminally disposed')
        if (${p}Owner) return ${p}Owner
        ${p}Owner = ${qualifier}Native.createOwner(${p}Host, {
            parking: ${p}Parking, slot: ${p}Parking, content: ${p}Content,
            createNode: function(parent) { return ${p}NodeComponent.createObject(parent) },
            connected: function() { return ${p}Host.Window.window !== null },
            later: function(callback) { Qt.callLater(callback) },
            rootChanged: function(root) { ${p}Root = root },
            epochChanged: function(epoch, present) { ${p}Epoch = epoch; ${p}Present = present },
            changed: function() { ++${p}Revision },
            emit: function(key, payload) { ${p}Host.deliverExpose(key, payload) },
            propChecks: ${propChecks}, eventChecks: ${eventChecks}, methodChecks: ${methodChecks},
            styleTable: ${JSON.stringify(tokenTable)},
            declarations: ${JSON.stringify(ir.moduleDeclarations)},
            tableFamilies: [${staticNames.get('@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY') ?? ''}],
            contextCheck: ${emitQtContextValidation(ir, keys, `${qualifier}Context.acceptsContextValue`)}
        })
        const ${p}Def = ${p}Owner.def
${ir.hooks.map((hook) => `        const ${hooks.get(hook.id)} = function() { return (${fn(hook.setup, 2)})(${p}Def); };`).join('\n')}
        try {
            ${p}Owner.setRender((${fn(ir.setup, 3)})(${p}Def))
            ${p}Owner.hydrate(rawProps)
            ${p}Owner.created()
            ${p}Ready = true
            ++${p}Revision
        } catch (error) {
            try { ${p}Owner.dispose() } finally { ${p}Owner = null; ${p}Closed = true }
            throw error
        }
        return ${p}Owner
    }
    function deliverExpose(key, payload) {
        exposed(key, payload)
${eventDispatch}
    }
    function setProps(next) { if (${p}Closed) throw new Error('Qt component disposed'); rawProps = next }
    function update() { ensureOwner().update() }
    function getExposes() { return ensureOwner().getExposes() }
    function dispose() { if (${p}Closed) return; ${p}Closed = true; ${p}Ready = false; if (${p}Owner) ${p}Owner.dispose() }
    onRawPropsChanged: if (${p}Owner && !${p}Closed) ${p}Owner.hydrate(rawProps)
    onParentChanged: if (${p}Owner && !${p}Closed) Qt.callLater(function() { if (!${p}Closed) ${p}Owner.topologyChanged() })
    onNativeWindowChanged: if (${p}Owner && !${p}Closed) Qt.callLater(function() { if (!${p}Closed) ${p}Owner.topologyChanged() })
    onLogicalParentChanged: if (${p}Owner && !${p}Closed) Qt.callLater(function() { if (!${p}Closed) ${p}Owner.topologyChanged() })
    Qml.Component.onCompleted: { ensureOwner(); ${p}Owner.reconcile() }
    Qml.Component.onDestruction: dispose()
}
`;
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, value: { code, profile: 'qt-source-v1', supportingFiles: [...context.files,...staticFiles,
    {path:'.proto-ui/qt/QtOwner.mjs',contents:qtOwnerSource,kind:'source'},
    {path:'.proto-ui/qt/QtStyle.mjs',contents:qtStyleSource,kind:'source'},
    {path:'.proto-ui/qt/QtInteraction.mjs',contents:qtInteractionSource,kind:'source'},
    {path:'.proto-ui/qt/QtControls.mjs',contents:qtControlsSource,kind:'source'},
    {path:'.proto-ui/qt/QtTopology.mjs',contents:qtTopologySource,kind:'source'},
    {path:'.proto-ui/qt/QtPresentation.mjs',contents:qtPresentationSource,kind:'source'},
    {path:'.proto-ui/qt/QtTableProjection.mjs',contents:qtTableProjectionSource,kind:'source'},
    {path:'.proto-ui/qt/QtNode.qml',contents:qtNodeSource,kind:'source'},
    ...qtHostArtifacts,
  ], dependencies: ['QtCore','QtGui','QtQml','QtQuick'].map((name) => ({name,version:'6.4.2',role:'target' as const})), provenance: {source:ir.source,irVersion:ir.schemaVersion,backend:'qt-source-v1'} } };
}
