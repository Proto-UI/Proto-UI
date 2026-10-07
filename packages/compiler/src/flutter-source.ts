import { createHash } from 'node:crypto';
import { validateIR } from './ir-validation';
import { isDataValueType, type CompileResult, type ExpressionIR, type FunctionIR, type GeneratedModule, type PrototypeIR, type StatementIR, type StaticValue, type ValueType } from './ir';
import type { DataType } from './data-types';
import { isAssignable } from './data-types';
import { OPERATION_RULES } from './operations';
import type { RuleCondition } from './rule-declarations';
import { getSemanticGroupKeyV0 } from '../../core/src/spec/feedback/semantic-merge';
import { flutterNativeSource } from './flutter-native-host';

/** Checked statements become ordinary Dart; the supporting host has no semantic IR. */
export function emitFlutterSource(input: PrototypeIR, options: { componentName?: string } = {}): CompileResult<GeneratedModule> {
  const checked = validateIR(input);
  if (!checked.ok) return checked;
  const ir = checked.value;
  const component = options.componentName ?? 'CompiledComponent';
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(component) || ['Widget', 'State', 'StatefulWidget', 'GeneratedProps', 'GeneratedResolvedProps'].includes(component))
    return { ok: false, diagnostics: [{ code: 'PUI_FLUTTER_NAME', category: 'invalid-input', message: 'Choose an uppercase Dart component identifier.', span: ir.setup.span }] };
  const id = (value: string) => `v_${Buffer.from(value).toString('hex')}`;
  const publicName = (value: string) => /^[A-Za-z][A-Za-z0-9_]*$/.test(value) && !['abstract','as','assert','async','await','base','break','case','catch','class','const','continue','covariant','default','deferred','do','dynamic','else','enum','export','extends','extension','external','factory','false','final','finally','for','Function','get','hide','if','implements','import','in','interface','is','late','library','mixin','new','null','of','on','operator','part','required','rethrow','return','sealed','set','show','static','super','switch','sync','this','throw','true','try','typedef','var','void','when','while','with','yield'].includes(value) ? value : id(value);
  const quote = (value: unknown) => JSON.stringify(value).replaceAll('$', '\\$');
  const keys = new Map(ir.contextKeys.map((key) => [key.id, { name: `key_${createHash('sha256').update(key.id).digest('hex').slice(0,24)}`, path: `.proto_ui/context_${createHash('sha256').update(key.id).digest('hex').slice(0,24)}.dart` }]));
  const hooks = new Map(ir.hooks.map((hook, index) => [hook.id, `_hook${index}`]));
  const staticCapabilities = new Map(ir.staticDeclarations.map((declaration) => [declaration.id,{name:`capability_${createHash('sha256').update(declaration.id).digest('hex').slice(0,24)}`,path:`.proto_ui/capability_${createHash('sha256').update(declaration.id).digest('hex').slice(0,24)}.dart`}]));
  function staticData(value: StaticValue): string {
    if (value === null || typeof value !== 'object') return quote(value);
    if (Array.isArray(value)) return `<Object?>[${value.map(staticData).join(', ')}]`;
    return `<String, Object?>{${Object.entries(value).map(([key,item]) => `${quote(key)}: ${staticData(item)}`).join(', ')}}`;
  }
  const shapes = new Map<string, Extract<DataType, {kind:'record'}>>();
  function shapeKey(shape: Extract<DataType, {kind:'record'}>): string {
    function canonical(value: DataType): unknown {
      if (typeof value === 'string') return value;
      if (value.kind === 'record') return { kind: 'record', fields: [...value.fields].sort((a,b) => a.name.localeCompare(b.name)).map((field) => ({name: field.name, type: canonical(field.type), optional: !!field.optional})) };
      if (value.kind === 'array') return {kind:'array',element:canonical(value.element)};
      if (value.kind === 'union') return {kind:'union',members:value.members.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))};
      return value;
    }
    return createHash('sha256').update(JSON.stringify(canonical(shape))).digest('hex').slice(0,24);
  }
  let helperBindings = new Map<string, FunctionIR>();
  let localTypes = new Map<string,ValueType>();
  function data(type: DataType): string {
    if (typeof type === 'string') return ({ boolean: 'bool', number: 'double', string: 'String', null: 'Null', void: 'void' } as const)[type];
    if (type.kind === 'literal') return type.value === null ? 'Null' : typeof type.value === 'number' ? 'double' : typeof type.value === 'boolean' ? 'bool' : 'String';
    if (type.kind === 'array') return `List<${data(type.element)}>`;
    if (type.kind === 'record') { if (!type.fields.length) return 'NativeEmptyRecord'; const hash = shapeKey(type); shapes.set(hash,type); type.fields.forEach((field) => data(field.type)); return `NativeData_${hash}`; }
    const members = type.members.filter((member) => member !== 'null' && member !== 'void');
    const names = [...new Set(members.map(data))];
    const base = names.length === 0 ? type.members.includes('null') ? 'Null' : 'Never' : names.length === 1 ? names[0] + (type.members.includes('null') && !names[0].endsWith('?') ? '?' : '') : 'Object?';
    return type.members.includes('void') ? `NativeOptional<${base}>` : base;
  }
  function type(type: ValueType): string {
    if (isDataValueType(type)) return data(type);
    if (typeof type !== 'string') throw new Error('Invalid Dart type');
    if (type.startsWith('nullable:')) return `${typeName(type.slice(9))}?`;
    if (type.startsWith('optional:')) return `NativeOptional<${typeName(type.slice(9))}>`;
    if (type.startsWith('state:')) return `NativeState<${data(type.slice(6) as DataType)}>`;
    if (type.startsWith('observed:')) return `NativeObserved<${data(type.slice(9) as DataType)}>`;
    if (type.startsWith('borrowed:')) return `NativeState<${data(type.slice(9) as DataType)}>`;
    if (type.startsWith('state-event:') || type.startsWith('state-next:')) return `NativeStateWatchEvent<${data(type.slice(type.indexOf(':')+1) as DataType)}>`;
    return typeName(type);
  }
  function typeName(name: string): string {
    if (name === 'transition') return 'NativeTransition';
    if (name === 'state-disconnect') return 'NativeStateWatchEvent<Object?>';
    if (name === 'binding-disposer' || name === 'transition-action') return 'void Function()';
    if (name === 'boundary-outside-event') return 'NativeBoundaryOutsideEvent';
    if (name === 'boundary-sample') return 'NativeBoundarySample';
    if (name === 'collection-item') return 'NativeCollectionItem<GeneratedResolvedProps>';
    if (name === 'collection-snapshot') return 'NativeCollectionSnapshot';
    if (name === 'collection-snapshot-list') return 'List<NativeCollectionSnapshot>';
    return ({ def: '_Owner', run: 'NativeRun<GeneratedResolvedProps>', render: 'NativeFrame<GeneratedResolvedProps>', props: 'GeneratedResolvedProps', focus: 'NativeFocus', accessible: 'NativeAccessible', event: 'NativeInput', 'host-event': 'NativeInput', 'context-key': 'NativeContextKey<Object?>', 'style-handle': 'NativeStyleHandle', 'style-disposer': 'void Function()', 'subscription-disposer': 'void Function()', 'rule-handle': 'NativeRule', 'template-props': 'Map<String, Object?>', 'module-config': 'Map<String, Object?>', record: 'Map<String, Object?>', array: 'List<Object?>', template: 'Widget', function: 'Function', unknown: 'Object?', 'host-target': 'NativeHostTarget', 'focus-entry': 'NativeFocusEntry', 'focus-scope': 'NativeFocusScope', 'focus-roving': 'NativeFocusRoving', 'focus-scope-key': 'NativeFocusScopeKey', 'focus-roving-key': 'NativeFocusRovingKey', 'anatomy-family': 'NativeAnatomyFamily', 'anatomy-part': 'NativeAnatomyPart', 'anatomy-parts': 'List<NativeAnatomyPart>', 'anatomy-order': 'NativeAnatomy', collection: 'NativeCollection', 'collection-item': 'NativeCollectionItem', boundary: 'NativeBoundary<GeneratedResolvedProps>', 'hit-participation': 'NativeHitParticipation', positioning: 'NativePositioning', overlay: 'NativeOverlay', scroll: 'NativeScroll', 'scroll-axis': 'NativeScrollAxisFacts', 'scroll-follow': 'NativeScrollFollowFacts', 'text-control': 'NativeTextControl<GeneratedResolvedProps>', 'image-view': 'NativeImageView<GeneratedResolvedProps>', 'table-structure': 'NativeTableStructure', 'table-states': 'NativeTableStates', 'table-snapshot': 'NativeTableSnapshot', 'table-row': 'NativeTableRow', 'table-cell': 'NativeTableCell', 'table-diagnostic': 'NativeTableDiagnostic', 'table-row-list': 'List<NativeTableRow>', 'table-cell-list': 'List<NativeTableCell>', 'table-diagnostic-list': 'List<NativeTableDiagnostic>', 'a11y-ref-list': 'List<NativeA11yRef>', 'transition-controls': 'NativeTransitionControls', 'action': 'void Function()', 'a11y-ref': 'NativeA11yRef' } as Record<string,string>)[name];
  }
  function predicate(value: string, spec: DataType, known = false): string {
    if (typeof spec === 'string') return spec === 'void' || spec === 'null' ? known ? 'true' : `${value} == null` : spec === 'number' ? known ? `${value}.isFinite` : `(${value} is num && ${value}.isFinite)` : known ? 'true' : `${value} is ${data(spec)}`;
    if (spec.kind === 'literal') return `${value} == ${quote(spec.value)}`;
    if (spec.kind === 'union') {
      if (spec.members.includes('void')) return `(${known ? '' : `${value} is ${data(spec)} && `}(!${value}.present || ${predicate(`${value}.value`,{kind:'union',members:spec.members.filter((member) => member !== 'void')},known)}))`;
      if (known && spec.members.every((member) => typeof member !== 'string' && member.kind === 'literal')) return `(${spec.members.map((member) => predicate(value,member,true)).join(' || ')})`;
      return `(${spec.members.map((entry) => predicate(value,entry)).join(' || ') || 'false'})`;
    }
    if (spec.kind === 'array') return `(${known ? '' : `${value} is ${data(spec)} && `}${value}.every((item) => ${predicate('item',spec.element,true)}))`;
    return `(${known ? 'true' : `${value} is ${data(spec)}`}${spec.fields.map((field) => ` && ${field.optional ? `(!${value}.${publicName(field.name)}.present || ${predicate(`${value}.${publicName(field.name)}.value`,field.type,true)})` : `(${value}.${publicName(field.name)}.present && ${predicate(`${value}.${publicName(field.name)}.value`,field.type,true)})`}`).join('')})`;
  }
  function nativeData(value: string, spec: DataType, knownRecord = false): string {
    if (typeof spec === 'string') return spec === 'number' ? `(${value} as num).toDouble()` : `(${value} as ${data(spec)})`;
    if (spec.kind === 'literal') return `(${value} as ${data(spec)})`;
    if (spec.kind === 'array') return `(${value} as List<Object?>).map((item) => ${nativeData('item',spec.element)}).toList(growable: false)`;
    if (spec.kind === 'union') {
      const member = spec.members.find((entry) => entry !== 'null' && entry !== 'void');
      if (member && spec.members.length === 2 && spec.members.includes('null')) return `nativeProject<Object?, ${data(spec)}>(${value}, (item) => item == null ? null : ${nativeData('item',member)})`;
      return `(${value} as ${data(spec)})`;
    }
    if (!spec.fields.length) return 'const NativeEmptyRecord()';
    return `nativeProject<Map<String, Object?>, ${data(spec)}>(${value}${knownRecord ? '' : ' as Map<String, Object?>'}, (record) => ${data(spec)}Value(${spec.fields.map((field) => `${publicName(field.name)}: ${field.optional ? `!record.containsKey(${quote(field.name)}) ? const NativeOptional<Never>.absent() : ` : ''}NativeOptional.value(${nativeData(`record[${quote(field.name)}]`,field.type)})`).join(', ')}))`;
  }
  function callback(value: ExpressionIR, supplied: string[], depth: number): string {
    if (value.kind !== 'function') throw new Error('Checked callback must have an authored body');
    return `(${fn(value.function,depth)})(${supplied.slice(0,value.function.parameters.length).join(', ')})`;
  }
  function fn(value: FunctionIR, depth: number): string {
    const previousBindings = helperBindings;
    const previousTypes = localTypes;
    localTypes = new Map(previousTypes);
    value.parameters.forEach((parameter) => localTypes.set(parameter.name,parameter.type));
    helperBindings = new Map(previousBindings);
    value.parameters.forEach((parameter) => helperBindings.delete(parameter.name));
    const params = value.parameters.map((p, index) => `${p.optional && !value.parameters[index-1]?.optional ? '[' : ''}${p.optional ? `NativeOptional<${type(p.type)}>` : type(p.type)} ${id(p.name)}${p.optional ? ' = const NativeOptional.absent()' : ''}${p.optional && index === value.parameters.length-1 ? ']' : ''}`).join(', ') || (value.phase === 'render' ? `${type('render')} _` : '');
    const scoped = value.phase === 'callback' && !['helper','context-update'].includes(value.context);
    const body = statements(value.body,depth+1,value.returnType);
    helperBindings = previousBindings;
    localTypes = previousTypes;
    return `(${params}) ${scoped ? `=> _owner.inScope(${quote(value.context)}, () ` : ''}{\n${body}${type(value.returnType).startsWith('NativeOptional<') ? `${'  '.repeat(depth+1)}return const NativeOptional.absent();\n` : ''}${'  '.repeat(depth)}}${scoped ? ')' : ''}`;
  }
  function style(handle: { tokens: readonly string[] }): string {
    return `NativeStyleHandle(<String>[${handle.tokens.map(quote).join(', ')}], <String>[${handle.tokens.map((token) => quote(getSemanticGroupKeyV0(token))).join(', ')}])`;
  }
  function expr(value: ExpressionIR, depth: number): string {
    switch (value.kind) {
      case 'literal': return typeof value.value === 'number' ? Object.is(value.value,-0) ? '-0.0' : /[.eE]/.test(quote(value.value)) ? quote(value.value) : `${quote(value.value)}.0` : quote(value.value);
      case 'reference': { const original = localTypes.get(value.name); return typeof original === 'string' && original.startsWith('nullable:') && value.type === original.slice(9) ? `${id(value.name)}!` : typeof original === 'string' && original.startsWith('optional:') && value.type === original.slice(9) ? `${id(value.name)}.value` : id(value.name); }
      case 'context-key': return keys.get(value.keyId)!.name;
      case 'static-capability': return staticCapabilities.get(value.declarationId)!.name;
      case 'style-handle': return style(value.handle);
      case 'rule': {
        const bindings = new Map(value.states.map((entry) => [entry.id,entry.value]));
        const condition = (node: RuleCondition): string => node.type === 'true' || node.type === 'false' ? node.type : node.type === 'eq' ? `(${node.left.type === 'prop' ? `_owner.props.${publicName(node.left.key)}` : `${expr(bindings.get(node.left.id)!,depth)}.get()`} == ${quote(node.right)})` : node.type === 'not' ? `!(${condition(node.expr)})` : `(${node.exprs.map(condition).join(node.type === 'all' ? ' && ' : ' || ') || (node.type === 'all' ? 'true' : 'false')})`;
        return `_owner.style.rule(() => ${condition(value.declaration.when)}, <NativeStyleHandle>[${value.declaration.intent.ops.flatMap((op) => op.handles).map(style).join(', ')}])`;
      }
      case 'member': {
        const receiver = expr(value.object,depth);
        if (typeof value.object.type === 'string' && value.object.type.startsWith('state-next:') && (value.property === 'prev' || value.property === 'next')) return `${receiver}.${value.property}!`;
        if (typeof value.object.type === 'string' && (value.object.type.startsWith('nullable:') || value.object.type.startsWith('optional:'))) {
          const access = `target.${value.property}`;
          const projected = typeof value.type === 'string' && value.type.startsWith('optional:') || type(value.type).startsWith('NativeOptional<');
          return `nativeProject<Object?, ${type(value.type)}>(nativeValue(${receiver}), (item) { ${value.optional ? `if (item == null || item is NativeVoid) return ${projected ? 'const NativeOptional<Never>.absent()' : 'null'}; ` : ''}final target = item as ${typeName(value.object.type.slice(value.object.type.indexOf(':') + 1))}; return ${projected ? `nativeOptionalResult(${access})` : access}; })`;
        }
        if (typeof value.object.type === 'string' && (value.object.type.endsWith('-list') || value.object.type === 'anatomy-parts')) return value.property === 'length' ? `${receiver}.length.toDouble()` : `nativeIndex(${receiver}, ${Number(value.property)})`;
        if (value.object.type === 'event' && value.property === 'key') return `(${receiver}.key == null ? const NativeOptional<String>.absent() : NativeOptional<String>.value(${receiver}.key!))`;
        if (value.object.type === 'event' && ['ctrlKey','shiftKey','altKey','metaKey','repeat'].includes(value.property)) return `NativeOptional<bool>.value(${receiver}.${value.property})`;
        if (typeof value.object.type !== 'string' && value.object.type.kind === 'array') return value.property === 'length' ? `${receiver}.length.toDouble()` : `nativeIndex(${receiver}, ${Number(value.property)})`;
        if (typeof value.object.type !== 'string' && value.object.type.kind === 'union') {
          const alternatives = value.object.type.members;
          const optionalResult = type(value.type).startsWith('NativeOptional<');
          const resultType = type(value.type);
          const branches = alternatives.filter((entry) => typeof entry !== 'string' && (entry.kind === 'record' || entry.kind === 'array')).map((entry) => {
            if (typeof entry === 'string' || entry.kind !== 'record' && entry.kind !== 'array') throw new Error('Invalid member alternative');
            const access = entry.kind === 'array' ? value.property === 'length' ? 'value.length.toDouble()' : `nativeIndex(value, ${Number(value.property)})` : `value.${publicName(value.property)}${entry.fields.find((field) => field.name === value.property)?.optional ? '' : '.value'}`;
            return `if (value is ${data(entry)}) return ${optionalResult ? `nativeOptionalResult<${resultType.slice(15,-1)}>(${access})` : access};`;
          });
          return `nativeProject<Object?, ${resultType}>(nativeValue(${receiver}), (value) { ${branches.join(' ')} ${value.optional && optionalResult ? `return const NativeOptional<Never>.absent();` : `throw StateError('Invalid checked member receiver');`} })`;
        }
        if (value.optional && type(value.type).startsWith('NativeOptional<') && typeof value.object.type !== 'string' && value.object.type.kind === 'record') {
          return `nativeOptionalResult<${type(value.type).slice(15,-1)}>((${receiver}).${publicName(value.property)})`;
        }
        if (typeof value.object.type !== 'string' && value.object.type.kind === 'record') return `(${receiver}).${publicName(value.property)}${value.object.type.fields.find((field) => field.name === value.property)?.optional ? '' : '.value'}`;
        if (value.object.type === 'props') return `(${receiver}).${publicName(value.property)}`;
        if (value.object.type === 'record' || value.object.type === 'template-props') return `((${receiver})${value.optional ? '?' : ''}[${quote(value.property)}] as ${type(value.type)})`;
        if (type(value.type).startsWith('NativeOptional<')) return `nativeOptionalNullable(${receiver}.${value.property})`;
        return `(${receiver})${value.optional ? '?' : ''}.${value.property}`;
      }
      case 'unary': return value.operator === '!' ? `!nativeTruthy(${expr(value.operand,depth)})` : `(${value.operator === '-' ? '-' : ''}nativeNumber(${expr(value.operand,depth)}))`;
      case 'binary': {
        const left = expr(value.left,depth), right = expr(value.right,depth);
        if (value.operator === '===' || value.operator === '!==') return `${value.operator === '!==' ? '!' : ''}nativeSame(${left}, ${right})`;
        if (value.operator === '&&' || value.operator === '||') return type(value.type).startsWith('NativeOptional<') ? `nativeOptionalResult<${type(value.type).slice(15,-1)}>(nativeLogical(${left}, () => ${right}, ${value.operator === '&&'}))` : `(nativeValue(nativeLogical(${left}, () => ${right}, ${value.operator === '&&'})) as ${type(value.type)})`;
        if (value.operator === '??') return type(value.type).startsWith('NativeOptional<') ? `nativeOptionalResult<${type(value.type).slice(15,-1)}>(nativeCoalesce(${left}, () => ${right}))` : `(nativeCoalesce(${left}, () => ${right}) as ${type(value.type)})`;
        if (['<','<=','>','>='].includes(value.operator)) return `nativeCompare(${left}, ${right}, ${quote(value.operator)})`;
        if (value.operator === '+') return type(value.type) === 'String' ? `(nativeString(${left}) + nativeString(${right}))` : type(value.type) === 'double' ? `(nativeNumber(${left}) + nativeNumber(${right}))` : `nativeAdd(${left}, ${right})`;
        return value.operator === '%' ? `(nativeNumber(${left}).remainder(nativeNumber(${right})))` : `(nativeNumber(${left}) ${value.operator} nativeNumber(${right}))`;
      }
      case 'array': return `<${typeof value.type !== 'string' && value.type.kind === 'array' ? data(value.type.element) : 'Object?'}>[${value.elements.map((item) => expr(item,depth)).join(', ')}]`;
      case 'record': {
        if (typeof value.type !== 'string' && value.type.kind === 'record') {
          if (!value.type.fields.length) return 'NativeEmptyRecord()';
          return `${data(value.type)}Value(${value.type.fields.map((field) => { const entry = value.entries.find((entry) => entry.key === field.name); return `${publicName(field.name)}: ${entry ? `NativeOptional.value(${expr(entry.value,depth)})` : 'const NativeOptional<Never>.absent()'}`; }).join(', ')})`;
        }
        return `<String, Object?>{${value.entries.map((entry) => `${quote(entry.key)}: ${expr(entry.value,depth)}`).join(', ')}}`;
      }
      case 'function': return fn(value.function,depth);
      case 'helper-call': return `${id(value.name)}(${value.arguments.map((arg,index) => helperBindings.get(value.name)?.parameters[index]?.optional && !type(arg.type).startsWith('NativeOptional<') ? `NativeOptional.value(${expr(arg,depth)})` : expr(arg,depth)).join(', ')})`;
      case 'authored-hook': return `_owner.withFrame(() => ${hooks.get(value.hookId)}(${ir.hooks.find((hook) => hook.id === value.hookId)!.setup.parameters.length ? '_owner' : ''}))`;
      case 'operation': {
        const op = value.operation;
        const operationContract = OPERATION_RULES[op];
        const args = value.arguments.map((arg,index) => op === 'expose.event' && index === 1 ? '' : arg.kind === 'record' && operationContract.arguments[index]?.role === 'value' && operationContract.arguments[index]?.types?.some((type) => type === 'record' || type === 'module-config') ? configuration(arg,depth) : expr(arg,depth));
        const receiver = value.receiver ? expr(value.receiver,depth) : '_owner';
        switch (op) {
          case 'hook.asTrigger': return '_owner.asTrigger()';
          case 'hook.asFocusable': return `_owner.install('asFocusable', () => _owner.focus)`;
          case 'hook.asAccessible': return `_owner.install('asAccessible', () => _owner.accessible)`;
          case 'hook.asFocusEntry': return `_owner.install('asFocusEntry', () => _owner.focusEntry ??= NativeFocusEntry(_owner))`;
          case 'hook.asFocusScope': return `_owner.install('asFocusScope', () => _owner.focusScope ??= NativeFocusScope(_owner))`;
          case 'hook.asFocusRoving': return `_owner.install('asFocusRoving', () => _owner.focusRoving ??= NativeFocusRoving(_owner))`;
          case 'hook.asOverlay': return `_owner.install('asOverlay', () => _owner.overlay ??= NativeOverlay(_owner))`;
          case 'hook.asScrollSurface': return `_owner.install('asScrollSurface', () => _owner.scroll ??= NativeScroll(_owner))`;
          case 'hook.asTextControl': return `_owner.install('asTextControl', () => _owner.textControl ?? (throw StateError('TextControl requires a static declaration')))`;
          case 'hook.asImageView': return `_owner.install('asImageView', () => _owner.imageView ?? (throw StateError('ImageView requires a static declaration')))`;
          case 'hook.asCollection': return `_owner.install('asCollection', () => _owner.collection ??= NativeCollection(_owner))`;
          case 'hook.asCollectionItem': return `_owner.install('asCollectionItem', () => _owner.collectionItem ??= NativeCollectionItem(_owner))`;
          case 'hook.asBoundary': return `_owner.install('asBoundary', () => _owner.boundary ??= NativeBoundary(_owner))`;
          case 'hook.asHitParticipation': return `_owner.install('asHitParticipation', () => _owner.hitParticipation ??= NativeHitParticipation(_owner))`;
          case 'hook.asTableStructure': return `_owner.install('asTableStructure', () => _owner.declareTableStructure(${args[0]}))`;
          case 'hook.asTransition': return `_owner.install('asTransition', () => _owner.declareTransition())`;
          case 'run.update': return `${receiver}.update()`;
          case 'props.define': return `_owner.defineProps(${configuration(value.arguments[0],depth)})`;
          case 'props.setDefaults': return `_owner.setDefaults(${configuration(value.arguments[0],depth)})`;
          case 'props.watch': case 'props.watchAll': case 'props.watchRaw': case 'props.watchRawAll': {
            const all = op.endsWith('All'), raw = op.includes('Raw'), cb = value.arguments[all ? 0 : 1];
            return `_owner.watch(${all ? 'null' : `<String>[${value.arguments[0].kind === 'array' ? value.arguments[0].elements.map((item) => expr(item,depth)).join(', ') : ''}]`}, ${raw}, (run, next, prev, info) => ${callback(cb,['run',raw ? 'next' : '_owner.makeProps(next)',raw ? 'prev' : '_owner.makeProps(prev)','info'],depth)})`;
          }
          case 'props.get': case 'render.read.props.get': return `${receiver}.props`;
          case 'props.getRaw': case 'render.read.props.getRaw': return `${receiver}.rawProps`;
          case 'props.isProvided': case 'render.read.props.isProvided': return `${receiver}.isProvided(${args.join(', ')})`;
          case 'state.bool': return `_owner.state<bool>('bool', ${args.join(', ')})`;
          case 'state.string': return `_owner.state<String>('string', ${args.slice(0,2).join(', ')}${args[2] ? `, ${configuration(value.arguments[2],depth)}` : ''})`;
          case 'state.enum': return `_owner.state<String>('enum', ${args.slice(0,2).join(', ')}, ${configuration(value.arguments[2],depth)})`;
          case 'state.numberDiscrete': case 'state.numberRange': return `_owner.state<double>(${quote(op === 'state.numberDiscrete' ? 'number.discrete' : 'number.range')}, ${args.slice(0,2).join(', ')}${args[2] ? `, ${configuration(value.arguments[2],depth)}` : ''})`;
          case 'state.get': return `${receiver}.get()`;
          case 'state.set': return `${receiver}.set(${args.join(', ')})`;
          case 'expose.state': { const name = value.arguments[0]; if (name.kind !== 'literal') throw new Error('Invalid exposure'); return `_owner.bind${id(String(name.value))}(${args[1]})`; }
          case 'expose.value': { const name = value.arguments[0]; if (name.kind !== 'literal') throw new Error('Invalid exposure'); return `_owner.bind${id(String(name.value))}(${args[1]})`; }
          case 'expose.method': { const name = value.arguments[0]; if (name.kind !== 'literal') throw new Error('Invalid exposure'); return `_owner.bind${id(String(name.value))}(${args[1]})`; }
          case 'expose.event': { const name = value.arguments[0]; if (name.kind !== 'literal') throw new Error('Invalid event'); const exposure = ir.exposes.find((entry) => entry.name === name.value); if (exposure?.kind !== 'event') throw new Error('Missing event signature'); return `_owner.declareEvent<${data(exposure.payload) === 'void' ? 'Null' : data(exposure.payload)}>(${args[0]}, (value) => ${predicate('value',exposure.payload)})`; }
          case 'expose.emit': return `${receiver}.emit(${args.slice(0,2).join(', ')})`;
          case 'host.get': return `${receiver}.getHost()`;
          case 'state.setDefault': return `${receiver}.setDefault(${args.join(', ')})`;
          case 'state.watch': return `_owner.watchState(${receiver}, (run, event) => ${callback(value.arguments[0],['run','event'],depth)})`;
          case 'binding.release': case 'subscription.release': return `${receiver}()`;
          case 'lifecycle.setPresent': return `${receiver}.setPresent(${args.join(', ')})`;
          case 'lifecycle.onCreated': case 'lifecycle.onMounted': case 'lifecycle.onUpdated': case 'lifecycle.onUnmounted': case 'lifecycle.onBeforeDispose': return `_owner.on(${quote(op.slice('lifecycle.on'.length).replace(/^./,(c) => c.toLowerCase()))}, (run) => ${callback(value.arguments[0],['run'],depth)})`;
          case 'event.on': case 'event.onGlobal': return `_owner.listen(${args[0]}, (run, event) => ${callback(value.arguments[1],['run','event'],depth)}, global: ${op === 'event.onGlobal'}${value.arguments[2] ? `, options: ${configuration(value.arguments[2],depth)}` : ''})`;
          case 'event.requestDefaultActionPrevention': return `${receiver}.requestDefaultActionPrevention()`;
          case 'focus.configure': return `${receiver}.configure(${configuration(value.arguments[0],depth)})`;
          case 'focus.setDisabled': case 'focus.focusSelf': return `${receiver}.${op.slice(6)}(${op === 'focus.setDisabled' ? args.join(', ') : value.arguments[0] ? configuration(value.arguments[0],depth) : ''})`;
          case 'accessible.state': return `${receiver}.state(${args.join(', ')})`;
          case 'accessible.action': return `${receiver}.action(${args[0]}${value.arguments[1] ? `, ${configuration(value.arguments[1],depth)}` : ''})`;
          case 'accessible.role': return `${receiver}.role(${args.join(', ')})`;
          case 'accessible.nameFromContent': return `${receiver}.nameFromContent()`;
          case 'feedback.style.use': return `_owner.style.use(<NativeStyleHandle>[${args.join(', ')}])`;
          case 'feedback.style.release': return `${receiver}()`;
          case 'feedback.style.patch': case 'feedback.style.suppress': return `${receiver}.style.${op.endsWith('patch') ? 'patch' : 'suppress'}(<NativeStyleHandle>[${args.join(', ')}])`;
          case 'feedback.style.clearPatch': return `${receiver}.style.clearPatch()`;
          case 'rule.dispose': return `${receiver}.dispose()`;
          case 'context.provide': return `_owner.context.provide(${args.join(', ')})`;
          case 'context.subscribe': case 'context.trySubscribe': {
            const optional = op === 'context.trySubscribe';
            const cb = value.arguments[1];
            return `_owner.context.subscribe(${args[0]}, ${optional}${cb ? `, (next, prev) => _owner.invoke((run) => ${callback(cb,['run',optional ? 'next' : 'next!',optional ? 'prev' : 'prev!'],depth)})` : ''})`;
          }
          case 'context.read': case 'render.read.context.read': return `${receiver}.context.read(${args[0]})`;
          case 'context.tryRead': case 'render.read.context.tryRead': return `${receiver}.context.tryRead(${args[0]})`;
          case 'context.update': case 'context.tryUpdate': {
            const next = value.arguments[1];
            return `${receiver}.context.${op === 'context.tryUpdate' ? 'tryUpdate' : 'update'}(${args[0]}, ${next.kind === 'function' ? args[1] : `(_) => ${args[1]}`})`;
          }
          case 'render.el': return `${receiver}.el(${args[0]}${args[1] ? `, ${value.arguments[1].type === 'template-props' || value.arguments[1].kind === 'record' && value.arguments[1].entries.length === 0 ? configuration(value.arguments[1],depth) : args[1]}` : ''}${args[2] ? `, ${args[2]}` : ''})`;
          case 'render.slot': return `${receiver}.slot()`;
          case 'anatomy.claim': return `_owner.anatomy.claim(${args[0]}, ${configuration(value.arguments[1],depth)})`;
          case 'anatomy.subscribeParts': return `_owner.anatomy.subscribeParts(${args[0]}, ${args[1]}, (parts) => _owner.invoke((run) => ${callback(value.arguments[2],['run','parts'],depth)}))`;
          case 'anatomy.has': return `${receiver}.anatomy.has(${args.join(', ')})`;
          case 'anatomy.parts': case 'anatomy.order.parts': case 'anatomy.partsOf': case 'anatomy.order.partsOf': return `${receiver}.anatomy.parts(${args.join(', ')})`;
          case 'anatomy.order.version': return `${receiver}.anatomy.orderVersion(${args.join(', ')}).toDouble()`;
          case 'anatomy.order.indexOfSelf': return `${receiver}.anatomy.indexOfSelf(${args.join(', ')}).toDouble()`;
          case 'anatomy.order.prevOfSelf': case 'anatomy.order.nextOfSelf': return `${receiver}.anatomy.neighbor(${args.join(', ')}, ${op === 'anatomy.order.prevOfSelf' ? '-1' : '1'})`;
          case 'textControl.on': case 'imageView.on': {
            const cb = value.arguments[1];
            const eventType = cb.kind === 'function' ? cb.function.parameters[1]?.type : undefined;
            return `${receiver}.on(${args[0]}, (run, event) => ${callback(cb,['run',eventType && isDataValueType(eventType) ? nativeData('event',eventType) : 'event'],depth)})`;
          }
          case 'boundary.subscribeOutside': {
            const cb = value.arguments[0];
            const eventType = cb.kind === 'function' ? cb.function.parameters[0]?.type : undefined;
            return `${receiver}.subscribeOutside((event) => ${callback(cb,[eventType && isDataValueType(eventType) ? nativeData('event',eventType) : 'event'],depth)})`;
          }
          case 'style.tw': throw new Error('Checked styles must be statically resolved');
          case 'rule.declare': throw new Error('Checked Rules must be statically resolved');
          default: {
            const contract = OPERATION_RULES[op];
            if (contract.receiver === 'def' || contract.receiver === 'run' || contract.receiver === 'render' || contract.receiver === 'void') throw new Error(`Flutter lowering missing operation ${op}`);
            const values = value.arguments.map((arg,index) => contract.arguments[index]?.role === 'value' && contract.arguments[index]?.types?.includes('record') || arg.kind === 'record' ? configuration(arg,depth) : args[index]);
            const call = `${receiver}.${contract.path}(${values.join(', ')})`;
            return isDataValueType(value.type) && typeof value.type !== 'string' ? nativeData(call,value.type,true) : call;
          }
        }
      }
    }
  }
  function configuration(value: ExpressionIR, depth: number): string {
    if (value.kind === 'record') return `<String, Object?>{${value.entries.map((entry) => {
      if (entry.value.kind === 'function' && entry.key === 'getMeta') {
        const resultType = entry.value.function.returnType;
        const call = callback(entry.value,['run'],depth);
        const fields = typeof resultType !== 'string' && resultType.kind === 'record' ? resultType.fields : undefined;
        return `${quote(entry.key)}: (NativeRun<GeneratedResolvedProps> run) => ${fields ? `nativeConfig(${call}, (result) => <String,Object?>{${fields.map((field) => `${field.optional ? `if (result.${publicName(field.name)}.present) ` : ''}${quote(field.name)}: result.${publicName(field.name)}.value`).join(', ')}})` : call}`;
      }
      if (entry.value.kind === 'function' && entry.key === 'onResolved') {
        const parameter = entry.value.function.parameters[0];
        return `${quote(entry.key)}: (Map<String,Object?> snapshot) => ${callback(entry.value,[parameter && isDataValueType(parameter.type) ? nativeData('snapshot',parameter.type) : 'snapshot'],depth)}`;
      }
      return `${quote(entry.key)}: ${entry.value.kind === 'record' ? configuration(entry.value,depth) : expr(entry.value,depth)}`;
    }).join(', ')}}`;
    const shape = typeof value.type !== 'string' && value.type.kind === 'record' ? value.type : undefined;
    if (shape) return `nativeConfig(${expr(value,depth)}, (config) => <String, Object?>{${shape.fields.map((field) => `${field.optional ? `if (config.${publicName(field.name)}.present) ` : ''}${quote(field.name)}: config.${publicName(field.name)}.value`).join(', ')}})`;
    return expr(value,depth);
  }
  function statements(body: readonly StatementIR[], depth: number, returnType: ValueType): string {
    const previousBindings = helperBindings;
    const previousTypes = localTypes;
    localTypes = new Map(previousTypes);
    helperBindings = new Map(previousBindings);
    const indent = '  '.repeat(depth);
    let result = '';
    for (const statement of body) {
      result += `${indent}// Source ${quote(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
      if (statement.kind === 'const') {
        if (statement.value.kind === 'function') helperBindings.set(statement.name,statement.value.function);
        else if (statement.value.kind === 'reference' && helperBindings.has(statement.value.name)) helperBindings.set(statement.name,helperBindings.get(statement.value.name)!);
        else helperBindings.delete(statement.name);
        result += `${indent}final ${id(statement.name)} = ${expr(statement.value,depth)};\n`;
        localTypes.set(statement.name,statement.value.type);
      }
      else if (statement.kind === 'effect') result += `${indent}${expr(statement.expression,depth)};\n`;
      else if (statement.kind === 'return') { result += `${indent}return${statement.value ? ` ${type(returnType).startsWith('NativeOptional<') && !type(statement.value.type).startsWith('NativeOptional<') ? `NativeOptional.value(${expr(statement.value,depth)})` : expr(statement.value,depth)}` : type(returnType).startsWith('NativeOptional<') ? ' const NativeOptional.absent()' : ''};\n`; break; }
      else result += `${indent}if (nativeTruthy(${expr(statement.condition,depth)})) {\n${statements(statement.then,depth+1,returnType)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise,depth+1,returnType)}${indent}}` : ''}\n`;
    }
    helperBindings = previousBindings;
    localTypes = previousTypes;
    return result;
  }
  const methodType = (entry: Extract<PrototypeIR['exposes'][number], {kind:'method'}>) => `${type(entry.returnType)} Function(${entry.parameters.map((p,index) => `${p.optional && !entry.parameters[index-1]?.optional ? '[' : ''}${p.optional ? `NativeOptional<${type(p.type)}>` : type(p.type)}${p.optional && index === entry.parameters.length-1 ? ']' : ''}`).join(', ')})`;
  const publicExposes = ir.exposes.map((entry) => entry.kind === 'state'
    ? `  NativeObserved<${data(entry.type)}> get ${publicName(entry.name)} => controller.owner.${id(entry.name)};`
    : entry.kind === 'value' ? `  ${type(entry.type)} get ${publicName(entry.name)} => controller.owner.${id(entry.name)};`
    : entry.kind === 'method' ? `  ${methodType(entry)} get ${publicName(entry.name)} => controller.owner.${id(entry.name)};`
    : `  NativeEvent<${data(entry.payload) === 'void' ? 'Null' : data(entry.payload)}> get ${publicName(entry.name)} => controller.owner.event<${data(entry.payload) === 'void' ? 'Null' : data(entry.payload)}>(${quote(entry.name)});`).join('\n');
  const exposureBindings = ir.exposes.filter((entry) => entry.kind !== 'event').map((entry) => {
    const t = entry.kind === 'state' ? `NativeObserved<${data(entry.type)}>` : entry.kind === 'value' ? type(entry.type) : methodType(entry);
    const params = entry.kind === 'method' ? entry.parameters.map((p,index) => `${p.optional && !entry.parameters[index-1]?.optional ? '[' : ''}${p.optional ? `NativeOptional<${type(p.type)}>` : type(p.type)} ${id(p.name)}${p.optional ? ' = const NativeOptional.absent()' : ''}${p.optional && index === entry.parameters.length-1 ? ']' : ''}`).join(', ') : '';
    const methodBody = entry.kind === 'method' ? `(${params}) {\n      ensureExternal();\n${entry.parameters.map((parameter) => isDataValueType(parameter.type) ? `      if (!(${parameter.optional ? `!${id(parameter.name)}.present || ${predicate(`${id(parameter.name)}.value`,parameter.type,true)}` : predicate(id(parameter.name),parameter.type,true)})) throw ArgumentError('Invalid Expose method argument');` : '').filter(Boolean).join('\n')}\n      ${entry.returnType === 'void' ? `inScope('expose-method', () => value(${entry.parameters.map((p) => id(p.name)).join(', ')}));` : `final result = inScope('expose-method', () => value(${entry.parameters.map((p) => id(p.name)).join(', ')}));\n      ${isDataValueType(entry.returnType) ? `if (!(${predicate('result',entry.returnType,true)})) throw ArgumentError('Invalid Expose method result');` : ''}\n      return result;`}\n    }` : '';
    const moduleFallback = entry.kind === 'method' && entry.parameters.length === 0 && isDataValueType(entry.returnType) && typeof entry.returnType !== 'string'
      ? `() => ${nativeData(`(super.publicExposure(${quote(entry.name)}) as Object? Function())()`,entry.returnType)}`
      : `(super.publicExposure(${quote(entry.name)}) as ${t})`;
    return `  ${t}? _bound_${id(entry.name)};
  ${t} get ${id(entry.name)} { ensureExternal(); return _bound_${id(entry.name)} ?? (${moduleFallback}); }
  void bind${id(entry.name)}(${t} value) {
    ensureSetup(); declareExpose(${quote(entry.name)});
    _bound_${id(entry.name)} = ${entry.kind === 'method' ? methodBody : entry.kind === 'state' ? 'value.external' : 'value'};
  }`;
  }).join('\n');
  const orderedHooks: PrototypeIR['hooks'] = [];
  const visitedHooks = new Set<string>();
  const activeHooks = new Set<string>();
  function orderHook(hook: PrototypeIR['hooks'][number]): void {
    if (visitedHooks.has(hook.id)) return;
    if (activeHooks.has(hook.id)) throw new Error('Recursive authored hook cannot be emitted as native closure composition');
    activeHooks.add(hook.id);
    function visit(value: unknown): void {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== 'object') return;
      const node = value as Record<string, unknown>;
      if (node.kind === 'authored-hook') {
        const dependency = ir.hooks.find((entry) => entry.id === node.hookId);
        if (dependency) orderHook(dependency);
      }
      Object.values(node).forEach(visit);
    }
    visit(hook.setup); activeHooks.delete(hook.id); visitedHooks.add(hook.id); orderedHooks.push(hook);
  }
  ir.hooks.forEach(orderHook);
  const hookAssignments = orderedHooks.map((hook) => `      final ${hooks.get(hook.id)} = ${fn(hook.setup,3)};`).join('\n');
  const setupCode = ir.setup.returnType === 'void'
    ? `      (${fn(ir.setup,3)})(${ir.setup.parameters.length ? '_owner' : ''});\n      _owner.renderer = (frame) => frame.slot();`
    : `      final author = (${fn(ir.setup,3)})(${ir.setup.parameters.length ? '_owner' : ''});\n      _owner.renderer = (frame) => nativeChildren(author(frame));`;
  ir.props.forEach((entry) => data(entry.type));
  ir.contextKeys.forEach((entry) => data(entry.type));
  const code = `// Flutter direct source v1. Source graph SHA-256: ${ir.source.sha256}
// Native helper costs: owner/epochs, constrained state, props/watch, Context, style, input/focus/Semantics/layout.
import 'package:flutter/widgets.dart';
import '.proto_ui/flutter_native.dart';
export '.proto_ui/flutter_native.dart';
${[...shapes.keys()].map((hash) => `import '.proto_ui/data_${hash}.dart';\nexport '.proto_ui/data_${hash}.dart';`).join('\n')}
${ir.contextKeys.map((key) => `import '${keys.get(key.id)!.path}';`).join('\n')}
${ir.staticDeclarations.map((declaration) => `import '${staticCapabilities.get(declaration.id)!.path}';`).join('\n')}

class GeneratedProps {
  GeneratedProps({${ir.props.map((p) => `NativeProvided<${data(p.type)}> ${publicName(p.name)} = const NativeProvided.absent()`).join(', ')}${ir.props.length ? ', ' : ''}Map<String, Object?> extra = const {}})
    : raw = Map.unmodifiable({...extra, ${ir.props.map((p) => `if (${publicName(p.name)}.present) ${quote(p.name)}: ${publicName(p.name)}.value`).join(', ')}});
  final Map<String, Object?> raw;
}
class GeneratedResolvedProps {
  GeneratedResolvedProps(this.raw);
  final Map<String, Object?> raw;
${ir.props.map((p) => `  ${data(p.type)} get ${publicName(p.name)} => raw[${quote(p.name)}] as ${data(p.type)};`).join('\n')}
}
class GeneratedExposes {
  GeneratedExposes(this.controller);
  final ${component}Controller controller;
${publicExposes}
}
class ${component}Controller {
  _Owner? _owner;
  _Owner get owner {
    final value = _owner;
    if (value == null) throw StateError('Component is not attached');
    value.ensureExternal(); return value;
  }
  GeneratedExposes getExposes() => GeneratedExposes(this);
  GeneratedDriver get driver => GeneratedDriver(this);
  void update() => owner.requestUpdate();
  void setProps(GeneratedProps next) => owner.applyProps(next.raw);
  void setPresent(bool present) => owner.externalPresent(present);
  bool get ready => owner.ready;
  int get viewEpoch => owner.epoch;
  FocusNode get focusNode => owner.focus.node;
  void dispose() { final value = owner; try { value.close(); } finally { value.requestHostUpdate(terminal: true); } }
}
class GeneratedDriver {
  GeneratedDriver(this.controller);
  final ${component}Controller controller;
  NativeHostTarget get root => controller.owner.hostTarget;
  NativeFocus get focus => controller.owner.focus;
  NativeFocusScope? get focusScope => controller.owner.focusScope;
  NativeFocusRoving? get focusRoving => controller.owner.focusRoving;
  NativeTextControl<GeneratedResolvedProps>? get textControl => controller.owner.textControl;
  NativeImageView<GeneratedResolvedProps>? get imageView => controller.owner.imageView;
  NativeScroll? get scroll => controller.owner.scroll;
  NativeOverlay? get overlay => controller.owner.overlay;
  NativePositioning? get positioning => controller.owner.positioning;
  NativeBoundary<GeneratedResolvedProps>? get boundary => controller.owner.boundary;
  NativeAnatomy get anatomy => controller.owner.anatomy;
  T invoke<T>(T Function(GeneratedDriver) callback) => controller.owner.inScope('native-driver', () => callback(this));
}
class _Owner extends NativeOwner<GeneratedResolvedProps> {
  _Owner(void Function() invalidate, NativeContextScope? parent)
    : super(invalidate, parent, makeProps: GeneratedResolvedProps.new,
      checks: <String, bool Function(Object?)>{${ir.props.map((p) => `${quote(p.name)}: (value) => ${predicate('value',p.type)}`).join(', ')}});
${exposureBindings}
  @override Object? publicExposure(String name) {
    ensureAlive();
    switch (name) {
${ir.exposes.filter((entry) => entry.kind !== 'event').map((entry) => `      case ${quote(entry.name)}: return ${id(entry.name)};`).join('\n')}
      default: return super.publicExposure(name);
    }
  }
}
class ${component} extends StatefulWidget {
  const ${component}({super.key, this.props, this.controller, this.child});
  final GeneratedProps? props;
  final ${component}Controller? controller;
  final Widget? child;
  @override State<${component}> createState() => _${component}State();
}
class _${component}State extends State<${component}> {
  _Owner? _instance;
  @override void didChangeDependencies() {
    super.didChangeDependencies();
    final parent = NativeContextHost.maybeOf(context);
    final existing = _instance;
    if (existing != null) { existing.context.parent = parent; return; }
    final _owner = _Owner(() { if (mounted) setState(() {}); }, parent);
    _owner.logicalContext = context;
    _instance = _owner;
    if (widget.controller?._owner != null) throw StateError('Controller already owns a component');
    widget.controller?._owner = _owner;
    try {
${ir.moduleDeclarations.map((declaration) => declaration.id === '@proto.ui/text-control/declaration' ? `      _owner.declareTextControl(${declaration.config.lineMode === 'multiline'});` : declaration.id === '@proto.ui/image-view/declaration' ? `      _owner.declareImageView(${staticData(declaration.config)});` : (() => { throw new Error(`Flutter has no native consumer for Module ${declaration.id}`); })()).join('\n')}
${hookAssignments}
${setupCode}
      _owner.finishSetup(widget.props?.raw ?? const {});
    } catch (error, stack) {
      try { _owner.close(); } catch (cleanupError, cleanupStack) {
        FlutterError.reportError(FlutterErrorDetails(exception: cleanupError, stack: cleanupStack));
      }
      Error.throwWithStackTrace(error, stack);
    }
  }
  @override void didUpdateWidget(covariant ${component} oldWidget) {
    super.didUpdateWidget(oldWidget);
    final owner = _instance!;
    if (oldWidget.controller != widget.controller) {
      if (widget.controller?._owner != null) throw StateError('Controller already owns a component');
      oldWidget.controller?._owner = null; widget.controller?._owner = owner;
    }
    owner.applyProps(widget.props?.raw ?? const {});
  }
  @override Widget build(BuildContext context) => _instance!.build(widget.child);
  @override void deactivate() { _instance?.deactivate(); super.deactivate(); }
  @override void activate() { super.activate(); _instance?.activate(); }
  @override void dispose() {
    final owner = _instance;
    widget.controller?._owner = null;
    try { owner?.close(); } finally { super.dispose(); }
  }
}
`;
  return { ok: true, value: { code, profile: 'flutter-source-v1', supportingFiles: [
    { path: '.proto_ui/flutter_native.dart', contents: flutterNativeSource, kind: 'source' },
    ...ir.staticDeclarations.map((declaration) => {
      const metadata = staticData(declaration.config);
      const factory = declaration.id === '@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY' ? 'nativeTableFamily' : declaration.kind === 'anatomy-family' ? `NativeAnatomyFamily(${quote(declaration.name)}, ${metadata})` : declaration.kind === 'focus-scope-key' ? `NativeFocusScopeKey(${quote(declaration.name)}, ${metadata})` : declaration.kind === 'focus-roving-key' ? `NativeFocusRovingKey(${quote(declaration.name)}, ${metadata})` : 'NativeA11yRef()';
      return {path:staticCapabilities.get(declaration.id)!.path,kind:'source' as const,contents:`import 'flutter_native.dart';\n// Source ${quote(declaration.span.file)}:${declaration.span.line}:${declaration.span.column}\nfinal ${staticCapabilities.get(declaration.id)!.name} = ${factory};\n`};
    }),
    ...[...shapes].map(([hash, shape]) => {
      const bases = [...shapes].filter(([otherHash, other]) => otherHash !== hash && isAssignable(shape,other));
      const absentFields = new Map(bases.flatMap(([,base]) => base.fields.filter((field) => !shape.fields.some((own) => own.name === field.name)).map((field) => [field.name,field] as const)));
      const declaration = `abstract interface class NativeData_${hash} {\n${shape.fields.map((field) => `  NativeOptional<${data(field.type)}> get ${publicName(field.name)};`).join('\n')}\n}\nclass NativeData_${hash}Value implements NativeData_${hash}${bases.length ? `, ${bases.map(([other]) => `NativeData_${other}`).join(', ')}` : ''} {\n  const NativeData_${hash}Value({${shape.fields.map((field) => `${field.optional ? '' : 'required '}this.${publicName(field.name)}${field.optional ? ' = const NativeOptional<Never>.absent()' : ''}`).join(', ')}});\n${shape.fields.map((field) => `  final NativeOptional<${data(field.type)}> ${publicName(field.name)};`).join('\n')}\n${[...absentFields.values()].map((field) => `  NativeOptional<Never> get ${publicName(field.name)} => const NativeOptional<Never>.absent();`).join('\n')}\n}\n`;
      const imports = [...new Set([...declaration.matchAll(/NativeData_([0-9a-f]{24})/g)].map((match) => match[1]))].filter((other) => other !== hash);
      return {path: `.proto_ui/data_${hash}.dart`, kind: 'source' as const, contents: `import 'flutter_native.dart';\n${imports.map((other) => `import 'data_${other}.dart';`).join('\n')}\n${declaration}`};
    }),
    ...ir.contextKeys.map((key) => ({ path: keys.get(key.id)!.path, kind: 'source' as const, contents: `import 'flutter_native.dart';\n${[...shapes.keys()].map((hash) => `import 'data_${hash}.dart';`).join('\n')}\n// Source ${quote(key.span.file)}:${key.span.line}:${key.span.column}\nfinal ${keys.get(key.id)!.name} = NativeContextKey<${data(key.type)}>(${quote(key.name)}, (value) => ${predicate('value',key.type)});\n` })),
    { path: 'pubspec.yaml', kind: 'declaration', contents: 'name: compiled_proto_component\npublish_to: none\nenvironment:\n  sdk: ">=3.13.4 <4.0.0"\n  flutter: ">=3.47.5"\ndependencies:\n  flutter:\n    sdk: flutter\n' },
  ], dependencies: [{ name: 'flutter', version: '3.47.5', role: 'target' }, { name: 'dart', version: '3.13.4', role: 'target' }], provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'flutter-source-v1' } } };
}
