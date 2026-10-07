import { validateIR, validIdentifier } from './ir-validation';
import { createHash } from 'node:crypto';
import { checkTargetOperations, TARGET_PROFILES } from './targets';
import { OPERATION_RULES } from './operations';
import { getSemanticGroupKeyV0 } from '../../core/src/spec/feedback/semantic-merge';
import { buildGpuiNativeStyleFiles } from './gpui-native-style';
import { GPUI_NATIVE_SDK_PATH, GPUI_NATIVE_SDK_VERSION, gpuiNativeSdkFiles } from './gpui-native-sdk';
import type { DataType } from './data-types';
import { isDataValueType, isPublicValueType } from './ir';
import type { RuleCondition } from './rule-declarations';
import type { CompileResult, CompilerDiagnostic, ExpressionIR, FunctionIR, GeneratedModule, PrototypeIR, StatementIR } from './ir';

/** Ordinary Rust functions, closures and GPUI elements. No serialized IR ships. */
export function emitGpuiSource(input: PrototypeIR, options: { componentName?: string; nativeSdkPath?: string } = {}): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = validated.value;
  const admitted = checkTargetOperations(ir, { ...TARGET_PROFILES['gpui-source-v1'], implemented: true, operations: Object.keys(OPERATION_RULES) as (keyof typeof OPERATION_RULES)[] });
  if (!admitted.ok) return admitted;
  const componentName = options.componentName ?? 'CompiledComponent';
  if (!validIdentifier(componentName) || !/^[A-Z][A-Za-z0-9_]*$/.test(componentName) || ['Self', 'Owner', 'Value', 'GeneratedProps'].includes(componentName)) return { ok: false, diagnostics: [{ code: 'PUI_GPUI_NAME', category: 'invalid-input', message: 'Choose a non-reserved PascalCase Rust component identifier.', span: ir.setup.span }] };
  const diagnostics: CompilerDiagnostic[] = [];
  const styleTokens = new Map<string, ExpressionIR['span']>();
  const reached = new Set(admitted.value.functions);
  const hookNames = new Map(ir.hooks.map((hook, index) => [hook.id, `authored_hook_${index}`]));
  const supported = new Set([
    'run.update', 'style.tw', 'rule.declare', 'rule.dispose',
    'feedback.style.use', 'feedback.style.release', 'feedback.style.patch', 'feedback.style.suppress', 'feedback.style.clearPatch',
    'props.define', 'props.setDefaults', 'props.watch', 'props.watchAll', 'props.watchRaw', 'props.watchRawAll', 'props.get', 'props.getRaw', 'props.isProvided',
    'state.bool', 'state.string', 'state.enum', 'state.numberDiscrete', 'state.numberRange', 'state.get', 'state.set',
    'expose.state', 'expose.value', 'expose.method', 'expose.event', 'expose.emit',
    'lifecycle.setPresent', 'lifecycle.onCreated', 'lifecycle.onMounted', 'lifecycle.onUpdated', 'lifecycle.onUnmounted', 'lifecycle.onBeforeDispose',
    'render.el', 'render.slot', 'render.read.props.get', 'render.read.props.getRaw', 'render.read.props.isProvided',
    'context.provide', 'context.subscribe', 'context.trySubscribe', 'context.read', 'context.tryRead', 'context.update', 'context.tryUpdate', 'render.read.context.read', 'render.read.context.tryRead',
    'hook.asTrigger', 'hook.asFocusable', 'hook.asAccessible', 'event.on', 'event.onGlobal', 'event.requestDefaultActionPrevention',
    'focus.configure', 'focus.setDisabled', 'focus.focusSelf', 'accessible.state', 'accessible.action', 'accessible.role', 'accessible.nameFromContent',
    'hook.asFocusEntry', 'hook.asFocusScope', 'hook.asFocusRoving', 'hook.asScrollSurface', 'hook.asTableStructure', 'hook.asBoundary', 'hook.asHitParticipation', 'hook.asCollection', 'hook.asCollectionItem',
    'focusEntry.configure', 'focusEntry.focus', 'focusEntry.setDisabled',
    'focusScope.configure', 'focusScope.getRoving',
    'focusRoving.configure', 'focusRoving.focusFirst', 'focusRoving.focusLast', 'focusRoving.focusNext', 'focusRoving.focusPrev', 'focusRoving.focusSelected',
    'focus.focus', 'focus.blur', 'focus.setNavParticipation', 'focus.setRovingStatus', 'focus.focusFirst', 'focus.focusLast', 'focus.focusNext', 'focus.focusPrev', 'focus.focusSelected', 'focus.restoreFocus', 'focus.activate', 'focus.deactivate', 'focus.setLoop', 'focus.setOrientation', 'focus.isActive', 'focus.isFocused',
    'accessible.id', 'accessible.name', 'accessible.description', 'accessible.relation', 'accessible.tree', 'accessible.level',
    'anatomy.claim', 'anatomy.subscribeParts', 'anatomy.has', 'anatomy.parts', 'anatomy.partsOf', 'anatomy.order.version', 'anatomy.order.parts', 'anatomy.order.partsOf', 'anatomy.order.indexOfSelf', 'anatomy.order.prevOfSelf', 'anatomy.order.nextOfSelf', 'anatomyPart.hasExpose', 'anatomyPart.getExpose', 'anatomyPart.hasHook',
    'tableStructure.configure', 'tableStructure.getObjectRef', 'tableStructure.getSnapshot',
    'host.get', 'state.setDefault', 'state.watch',
    'hook.asTransition', 'transition.configure', 'transitionControls.enter', 'transitionControls.leave', 'transitionControls.complete',
    'boundary.configure', 'boundary.observe', 'boundary.setStackActive', 'boundary.registerRegion', 'boundary.unregisterRegion', 'boundary.classify', 'boundary.notify', 'boundary.subscribeOutside',
    'hitParticipation.configure', 'hitParticipation.registerRegion', 'hitParticipation.unregisterRegion',
    'scroll.configure', 'scroll.request', 'scroll.getSnapshot',
    'collection.configure', 'collection.getItems', 'collection.getCount', 'collectionItem.configure', 'collectionItem.getSnapshot',
    'hook.asTextControl', 'textControl.on', 'textControl.sync', 'textControl.snapshot',
    'hook.asImageView', 'imageView.on', 'imageView.sync', 'imageView.snapshot',
    'hook.asOverlay', 'overlay.isOpen', 'overlay.openOverlay', 'overlay.close', 'overlay.toggle', 'overlay.configure', 'overlay.updatePosition', 'overlay.registerTrigger', 'overlay.registerAnchor', 'overlay.registerAnchorPart', 'overlay.registerContent', 'overlay.getPositionSnapshot', 'overlay.keepMounted', 'overlay.bindPresence',
    'positioning.connect', 'positioning.update', 'positioning.requestUpdate', 'positioning.disconnect', 'positioning.getSnapshot',
    'binding.release', 'subscription.release',
  ]);
  function inspect(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as ExpressionIR;
    if (node.kind === 'function' && !reached.has(node.function)) return;
    const handles = node.kind === 'style-handle' ? [node.handle] : node.kind === 'rule' ? node.declaration.intent.ops.flatMap((operation) => operation.handles) : [];
    for (const handle of handles) for (const token of handle.tokens) styleTokens.set(token, node.span);
    if (node.kind === 'operation' && !supported.has(node.operation)) diagnostics.push({ code: 'PUI_GPUI_HOST_REQUIRED', category: 'unsupported-input', message: `GPUI operation ${node.operation} has no concrete pinned host lowering. No success fallback is emitted.`, span: node.span });
    if (node.kind === 'operation' && node.operation === 'event.on' && node.arguments[2]?.kind === 'record') {
      const type = node.arguments[0];
      const phaseMapped = type?.kind === 'literal' && ['host:mousedown', 'host:mouseup', 'host:keydown', 'host:keyup'].includes(String(type.value));
      for (const entry of node.arguments[2].entries) if (!phaseMapped && entry.key === 'capture' && entry.value.kind === 'literal' && entry.value.value === true) diagnostics.push({ code: 'PUI_GPUI_INPUT_REQUIRED', category: 'unsupported-input', message: 'This raw host event requires a native capture-phase mapping.', span: entry.value.span });
    }
    Object.values(value).forEach(inspect);
  }
  for (const declaration of ir.moduleDeclarations) {
    if (!['@proto.ui/text-control/declaration', '@proto.ui/image-view/declaration'].includes(declaration.id)) diagnostics.push({ code: 'PUI_GPUI_MODULE_REQUIRED', category: 'unsupported-input', message: `GPUI Module ${declaration.id} has no concrete pinned host consumer.`, span: declaration.span });
  }
  admitted.value.functions.forEach((fn) => inspect(fn.body));
  const nativeStyle = buildGpuiNativeStyleFiles(styleTokens.keys());
  for (const token of nativeStyle.unknown) diagnostics.push({ code: 'PUI_GPUI_STYLE', category: 'unsupported-input', message: `The authoritative Proto style producer has no native declarations for ${JSON.stringify(token)}.`, span: styleTokens.get(token) ?? ir.setup.span });
  if (diagnostics.length) return { ok: false, diagnostics };
  const local = (name: string) => `v_${Buffer.from(name, 'utf8').toString('hex')}`;
  const string = (value: string): string => JSON.stringify(value).replace(/\\u([0-9a-fA-F]{4})/g, (_match, digits: string) => `\\u{${digits}}`);
  function staticValue(value: unknown): string {
    if (value === undefined) return 'Value::Undefined';
    if (Array.isArray(value)) return `Value::Array(Rc::new(vec![${value.map(staticValue).join(', ')}]))`;
    if (value !== null && typeof value === 'object') return `record(vec![${Object.entries(value).map(([key, item]) => `(${string(key)}, ${staticValue(item)})`).join(', ')}])`;
    return literal(value as string | number | boolean | null);
  }
  const staticArtifacts = ir.staticDeclarations.map((declaration) => {
    const digest = createHash('sha256').update(declaration.id).digest('hex').slice(0, 32);
    const name = `declaration_${digest}`;
    const path = `.proto-ui/declaration/${digest}.rs`;
    return { id: declaration.id, name, path, kind: 'source' as const, contents: `// Original static declaration ${JSON.stringify(declaration.id)}\nuse crate::native::gpui_native_owner::*;\nuse std::rc::Rc;\nuse serde_json::Value as Json;\npub static DECLARATION: StaticDeclaration = StaticDeclaration { id: ${string(declaration.id)}, kind: ${string(declaration.kind)}, config: || ${staticValue(declaration.config)} };\n` };
  });
  function literal(value: string | number | boolean | null): string {
    if (value === null) return 'Value::Json(Json::Null)';
    if (typeof value === 'string') return `Value::string(${string(value)})`;
    if (typeof value === 'boolean') return `Value::boolean(${value})`;
    return `Value::number(${Object.is(value, -0) ? '-0.0' : Number.isInteger(value) ? `${value}.0` : String(value)})`;
  }
  let uses = { names: new Set<string>(), owner: false };
  function ownerReference(): string { uses.owner = true; return 'owner'; }
  function functionValue(fn: FunctionIR, environment: ReadonlySet<string>, depth: number): string {
    const indent = '    '.repeat(depth);
    const scope = new Set(environment);
    const parameterNames = new Set(fn.parameters.map((parameter) => parameter.name));
    parameterNames.forEach((name) => scope.add(name));
    const parentUses = uses;
    uses = { names: new Set<string>(), owner: false };
    const body = statements(fn.body, scope, depth + 1);
    const functionUses = uses;
    uses = parentUses;
    const captures = [...environment].filter((name) => functionUses.names.has(name) && !parameterNames.has(name)).map((name) => {
      uses.names.add(name);
      return `let ${local(name)} = ${local(name)}.clone();`;
    }).join(' ');
    const parameters = fn.parameters.flatMap((parameter, index) => functionUses.names.has(parameter.name) ? [`${indent}    let ${local(parameter.name)} = arg(&arguments, ${index});\n`] : []).join('');
    const owner = functionUses.owner ? `let owner = ${ownerReference()}.clone();` : '';
    return `{ ${owner} ${captures} Value::Function(Rc::new(move |${parameters ? 'arguments' : '_'}: Vec<Value>| {\n${parameters}${body}${indent}})) }`;
  }
  function expression(node: ExpressionIR, environment: ReadonlySet<string>, depth: number): string {
    const args = node.kind === 'operation' || node.kind === 'helper-call' ? node.arguments.map((arg) => expression(arg, environment, depth)) : [];
    const argument = (index: number) => args[index] ?? 'Value::Undefined';
    let emittedReceiver: string | undefined;
    const receiver = () => emittedReceiver ??= node.kind === 'operation' && node.receiver ? expression(node.receiver, environment, depth) : `capability(&${ownerReference()})`;
    const receiverOwner = () => `&(${receiver()}).owner()`;
    switch (node.kind) {
      case 'literal': return literal(node.value);
      case 'reference': uses.names.add(node.name); return `${local(node.name)}.clone()`;
      case 'context-key': return `Value::string(${string(node.keyId)})`;
      case 'style-handle': return `Value::Style(vec![${node.handle.tokens.map((token) => `(${string(token)}.into(), ${string(getSemanticGroupKeyV0(token))}.into())`).join(', ')}])`;
      case 'member': return `(${expression(node.object, environment, depth)}).member(${string(node.property)}, ${node.optional})`;
      case 'unary': {
        const operand = expression(node.operand, environment, depth);
        return node.operator === '!' ? `Value::boolean(!(${operand}).truthy())` : `Value::number(${node.operator === '-' ? '-' : ''}(${operand}).scalar_number())`;
      }
      case 'binary': {
        const left = expression(node.left, environment, depth), right = expression(node.right, environment, depth);
        if (node.operator === '&&' || node.operator === '||') return `{ let left = ${left}; if ${node.operator === '&&' ? '' : '!'}left.truthy() { ${right} } else { left } }`;
        if (node.operator === '??') return `{ let left = ${left}; if left.nullish() { ${right} } else { left } }`;
        if (node.operator === '===' || node.operator === '!==') return `Value::boolean(${node.operator === '!==' ? '!' : ''}strict_equal(&(${left}), &(${right})))`;
        if (node.operator === '+') return `add(${left}, ${right})`;
        if (['<', '<=', '>', '>='].includes(node.operator)) return typeof node.left.type === 'string' && node.left.type === 'string' ? `Value::boolean((${left}).text() ${node.operator} (${right}).text())` : `Value::boolean((${left}).scalar_number() ${node.operator} (${right}).scalar_number())`;
        return `Value::number((${left}).scalar_number() ${node.operator} (${right}).scalar_number())`;
      }
      case 'array': return `Value::Array(Rc::new(vec![${node.elements.map((item) => expression(item, environment, depth)).join(', ')}]))`;
      case 'record': return `record(vec![${node.entries.map((entry) => `(${string(entry.key)}, ${expression(entry.value, environment, depth)})`).join(', ')}])`;
      case 'function': return functionValue(node.function, environment, depth);
      case 'helper-call': uses.names.add(node.name); return `${local(node.name)}.call(vec![${args.join(', ')}])`;
      case 'authored-hook': return `${hookNames.get(node.hookId)}(capability(&${ownerReference()}))`;
      case 'static-capability': return `Value::StaticCapability(&${staticArtifacts.find((declaration) => declaration.id === node.declarationId)!.name}::DECLARATION)`;
      case 'rule': {
        const bindings = new Map(node.states.map((state) => [state.id, state.value]));
        function condition(value: RuleCondition): string {
          if (value.type === 'true' || value.type === 'false') return value.type;
          if (value.type === 'eq') {
            const signal = value.left.type === 'prop' ? `read_props(&${ownerReference()}, false).member(${string(value.left.key)}, false)` : `(${expression(bindings.get(value.left.id)!, environment, depth)}).get()`;
            return `strict_equal(&(${signal}), &(${literal(value.right)}))`;
          }
          if (value.type === 'not') return `!(${condition(value.expr)})`;
          return value.exprs.length ? `(${value.exprs.map(condition).join(value.type === 'all' ? ' && ' : ' || ')})` : value.type === 'all' ? 'true' : 'false';
        }
        const parentUses = uses;
        uses = { names: new Set<string>(), owner: false };
        const body = condition(node.declaration.when);
        const predicateUses = uses;
        uses = parentUses;
        const captures = [...environment].filter((name) => predicateUses.names.has(name)).map((name) => {
          uses.names.add(name);
          return `let ${local(name)} = ${local(name)}.clone();`;
        }).join(' ');
        const owner = predicateUses.owner ? `let owner = ${ownerReference()}.clone();` : '';
        const predicate = `{${owner} ${captures} Value::Function(Rc::new(move |_| Value::boolean(${body})))}`;
        const handles = node.declaration.intent.ops.flatMap((operation) => operation.handles).map((handle) => `Value::Style(vec![${handle.tokens.map((token) => `(${string(token)}.into(), ${string(getSemanticGroupKeyV0(token))}.into())`).join(', ')}])`);
        return `rule(&${ownerReference()}, ${predicate}, vec![${handles.join(', ')}])`;
      }
      case 'operation': {
        switch (node.operation) {
          case 'run.update': return `request_update(${receiverOwner()})`;
          case 'feedback.style.use': return `style_use(&${ownerReference()}, vec![${args.join(', ')}])`;
          case 'feedback.style.release': return `(${receiver()}).call(vec![])`;
          case 'feedback.style.patch': return `patch(${receiverOwner()}, vec![${args.join(', ')}], false)`;
          case 'feedback.style.suppress': return `patch(${receiverOwner()}, vec![${args.join(', ')}], true)`;
          case 'feedback.style.clearPatch': return `clear_patch(${receiverOwner()})`;
          case 'rule.dispose': return `rule_dispose(&${ownerReference()}, ${receiver()})`;
          case 'props.define': return `props_define(&${ownerReference()}, ${argument(0)})`;
          case 'props.setDefaults': return `set_defaults(&${ownerReference()}, ${argument(0)})`;
          case 'props.watch': case 'props.watchRaw': return `watch_props(&${ownerReference()}, Some(${argument(0)}), ${node.operation === 'props.watchRaw'}, ${argument(1)})`;
          case 'props.watchAll': case 'props.watchRawAll': return `watch_props(&${ownerReference()}, None, ${node.operation === 'props.watchRawAll'}, ${argument(0)})`;
          case 'props.get': case 'render.read.props.get': return `read_props(${receiverOwner()}, false)`;
          case 'props.getRaw': case 'render.read.props.getRaw': return `read_props(${receiverOwner()}, true)`;
          case 'props.isProvided': case 'render.read.props.isProvided': return `is_provided(${receiverOwner()}, ${argument(0)})`;
          case 'state.bool': case 'state.string': case 'state.numberDiscrete': case 'state.numberRange': return `create_state(&${ownerReference()}, ${string(({ 'state.bool': 'bool', 'state.string': 'string', 'state.numberDiscrete': 'discrete', 'state.numberRange': 'range' } as const)[node.operation])}, ${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'state.enum': return `create_state(&${ownerReference()}, "enum", ${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'state.get': return `(${receiver()}).get()`;
          case 'state.set': return `state_set(${receiver()}, ${argument(0)}, ${argument(1)})`;
          case 'state.setDefault': return `state_default(${receiver()}, ${argument(0)})`;
          case 'state.watch': return `watch_state(&${ownerReference()}, ${receiver()}, ${argument(0)})`;
          case 'subscription.release': case 'binding.release': return `(${receiver()}).call(vec![])`;
          case 'host.get': return `host_target(${receiverOwner()})`;
          case 'expose.state': return `expose_state(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'expose.value': return `expose_value(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'expose.method': return `expose_method(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'expose.event': return `expose_event(&${ownerReference()}, ${argument(0)})`;
          case 'expose.emit': return `emit(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'lifecycle.setPresent': return `set_present(${receiverOwner()}, ${argument(0)})`;
          case 'lifecycle.onCreated': case 'lifecycle.onMounted': case 'lifecycle.onUpdated': case 'lifecycle.onUnmounted': case 'lifecycle.onBeforeDispose': return `register_life(&${ownerReference()}, ${string(({ 'lifecycle.onCreated': 'created', 'lifecycle.onMounted': 'mounted', 'lifecycle.onUpdated': 'updated', 'lifecycle.onUnmounted': 'unmounted', 'lifecycle.onBeforeDispose': 'before-dispose' } as const)[node.operation])}, ${argument(0)})`;
          case 'render.el': return `element(${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'render.slot': return 'slot()';
          case 'context.provide': return `context_provide(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'context.subscribe': case 'context.trySubscribe': return `context_subscribe(&${ownerReference()}, ${argument(0)}, ${node.operation === 'context.trySubscribe'}, ${argument(1)})`;
          case 'context.read': case 'context.tryRead': case 'render.read.context.read': case 'render.read.context.tryRead': return `context_read(${receiverOwner()}, ${argument(0)}, ${node.operation.endsWith('tryRead')})`;
          case 'context.update': case 'context.tryUpdate': return `context_update(${receiverOwner()}, ${argument(0)}, ${argument(1)}, ${node.operation === 'context.tryUpdate'})`;
          case 'hook.asTrigger': return `as_trigger(&${ownerReference()})`;
          case 'hook.asFocusable': return `as_focusable(&${ownerReference()})`;
          case 'hook.asAccessible': return `as_accessible(&${ownerReference()})`;
          case 'focus.configure': return `focus_setup_config(${receiverOwner()}, "focus", ${argument(0)})`;
          case 'focus.setDisabled': return `focus_disabled(${receiverOwner()}, ${argument(0)})`;
          case 'focus.focus': case 'focus.focusSelf': return `focus_request(${receiverOwner()}, ${argument(0)}, false)`;
          case 'hook.asFocusEntry': return `focus_setup(&${ownerReference()}, "focus-entry")`;
          case 'hook.asFocusScope': return `focus_setup(&${ownerReference()}, "focus-scope")`;
          case 'hook.asFocusRoving': return `focus_setup(&${ownerReference()}, "focus-roving")`;
          case 'focusEntry.configure': return `focus_setup_config(${receiverOwner()}, "focus-entry", ${argument(0)})`;
          case 'focusScope.configure': return `focus_setup_config(${receiverOwner()}, "focus-scope", ${argument(0)})`;
          case 'focusRoving.configure': return `focus_setup_config(${receiverOwner()}, "focus-roving", ${argument(0)})`;
          case 'focusEntry.focus': return `focus_request(${receiverOwner()}, ${argument(0)}, true)`;
          case 'focusEntry.setDisabled': return `focus_entry_disabled(${receiverOwner()}, ${argument(0)})`;
          case 'focus.blur': return `focus_blur(${receiverOwner()})`;
          case 'focus.setNavParticipation': return `focus_nav(${receiverOwner()}, ${argument(0)})`;
          case 'focus.setRovingStatus': return `focus_status(${receiverOwner()}, ${argument(0)})`;
          case 'focusRoving.focusFirst': case 'focusRoving.focusLast': case 'focusRoving.focusNext': case 'focusRoving.focusPrev': case 'focusRoving.focusSelected':
          case 'focus.focusFirst': case 'focus.focusLast': case 'focus.focusNext': case 'focus.focusPrev': case 'focus.focusSelected': return `focus_navigate(${receiverOwner()}, ${node.operation.startsWith('focusRoving.')}, ${string(node.operation.slice(node.operation.indexOf('.') + 6).toLowerCase())}, ${argument(0)})`;
          case 'focus.restoreFocus': return `focus_restore(${receiverOwner()})`;
          case 'focus.activate': return `focus_activate(${receiverOwner()}, ${argument(0)})`;
          case 'focus.deactivate': return `focus_deactivate(${receiverOwner()}, ${argument(0)})`;
          case 'focus.setLoop': return `focus_set_roving(${receiverOwner()}, "loop", ${argument(0)})`;
          case 'focus.setOrientation': return `focus_set_roving(${receiverOwner()}, "orientation", ${argument(0)})`;
          case 'focus.isActive': return `focus_is_active(${receiverOwner()})`;
          case 'focus.isFocused': return `focus_is_focused(${receiverOwner()})`;
          case 'focusScope.getRoving': return `focus_get_roving(${receiverOwner()})`;
          case 'accessible.role': return `accessible_role(${receiverOwner()}, ${argument(0)})`;
          case 'accessible.state': return `accessible_state(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'accessible.action': return `accessible_action_spec(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'accessible.nameFromContent': return `name_content(${receiverOwner()})`;
          case 'accessible.id': case 'accessible.name': case 'accessible.description': return `accessible_text(${receiverOwner()}, ${string(node.operation.slice(11))}, ${argument(0)})`;
          case 'accessible.relation': return `accessible_relation(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'accessible.tree': return `accessible_tree(${receiverOwner()}, ${argument(0)})`;
          case 'accessible.level': return `accessible_level(${receiverOwner()}, ${argument(0)})`;
          case 'anatomy.claim': return `anatomy_claim(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'anatomy.subscribeParts': return `anatomy_subscribe(&${ownerReference()}, ${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'anatomy.has': return `anatomy_has(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'anatomy.parts': case 'anatomy.order.parts': return `anatomy_parts(${receiverOwner()}, ${argument(0)}, Value::Undefined)`;
          case 'anatomy.partsOf': case 'anatomy.order.partsOf': return `anatomy_parts(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'anatomy.order.version': return `anatomy_version(${receiverOwner()}, ${argument(0)})`;
          case 'anatomy.order.indexOfSelf': case 'anatomy.order.prevOfSelf': case 'anatomy.order.nextOfSelf': return `anatomy_neighbor(${receiverOwner()}, ${argument(0)}, ${argument(1)}, ${node.operation.endsWith('prevOfSelf') ? -1 : node.operation.endsWith('nextOfSelf') ? 1 : 0})`;
          case 'anatomyPart.hasExpose': return `part_has_expose(${receiver()}, ${argument(0)})`;
          case 'anatomyPart.getExpose': return `part_get_expose(${receiver()}, ${argument(0)})`;
          case 'anatomyPart.hasHook': return `part_has_hook(${receiver()}, ${argument(0)})`;
          case 'hook.asCollection': return `collection_setup(&${ownerReference()}, false)`;
          case 'hook.asCollectionItem': return `collection_setup(&${ownerReference()}, true)`;
          case 'collection.configure': return `collection_configure(${receiverOwner()}, ${argument(0)}, false)`;
          case 'collectionItem.configure': return `collection_configure(${receiverOwner()}, ${argument(0)}, true)`;
          case 'collection.getItems': return `collection_items(${receiverOwner()})`;
          case 'collection.getCount': return `collection_count(${receiverOwner()})`;
          case 'collectionItem.getSnapshot': return `collection_item_snapshot(${receiverOwner()})`;
          case 'hook.asTransition': return `transition_setup(&${ownerReference()})`;
          case 'transition.configure': return `transition_configure(${receiverOwner()}, ${argument(0)})`;
          case 'transitionControls.enter': case 'transitionControls.leave': case 'transitionControls.complete': return `transition_control(${receiverOwner()}, ${string(node.operation.slice('transitionControls.'.length))})`;
          case 'hook.asTableStructure': return `table_setup(&${ownerReference()}, ${argument(0)})`;
          case 'tableStructure.configure': return `table_configure(${receiverOwner()}, ${argument(0)})`;
          case 'tableStructure.getObjectRef': return `table_object_ref(${receiverOwner()})`;
          case 'tableStructure.getSnapshot': return `table_snapshot(${receiverOwner()})`;
          case 'hook.asBoundary': return `boundary_setup(&${ownerReference()}, false)`;
          case 'hook.asHitParticipation': return `boundary_setup(&${ownerReference()}, true)`;
          case 'boundary.configure': return `boundary_configure(${receiverOwner()}, ${argument(0)}, false)`;
          case 'hitParticipation.configure': return `boundary_configure(${receiverOwner()}, ${argument(0)}, true)`;
          case 'boundary.observe': return `boundary_observe(${receiverOwner()}, ${argument(0)})`;
          case 'boundary.setStackActive': return `boundary_active(${receiverOwner()}, ${argument(0)})`;
          case 'boundary.registerRegion': case 'hitParticipation.registerRegion': return `boundary_register(${receiverOwner()}, ${argument(0)}, ${argument(1)}, ${node.operation.startsWith('hit')})`;
          case 'boundary.unregisterRegion': case 'hitParticipation.unregisterRegion': return `boundary_unregister(${receiverOwner()}, ${argument(0)}, ${node.operation.startsWith('hit')})`;
          case 'boundary.classify': case 'boundary.notify': return `boundary_classify(${receiverOwner()}, ${argument(0)}, ${node.operation === 'boundary.notify'})`;
          case 'boundary.subscribeOutside': return `boundary_subscribe(${receiverOwner()}, ${argument(0)})`;
          case 'hook.asScrollSurface': return `scroll_setup(&${ownerReference()})`;
          case 'scroll.configure': return `scroll_configure(${receiverOwner()}, ${argument(0)})`;
          case 'scroll.request': return `scroll_request(${receiverOwner()}, ${argument(0)})`;
          case 'scroll.getSnapshot': return `scroll_snapshot(${receiverOwner()})`;
          case 'hook.asTextControl': return `text_setup(&${ownerReference()})`;
          case 'textControl.on': return `text_on(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'textControl.sync': return `text_sync(${receiverOwner()}, ${argument(0)})`;
          case 'textControl.snapshot': return `text_snapshot(${receiverOwner()})`;
          case 'hook.asImageView': return `image_setup(&${ownerReference()})`;
          case 'imageView.on': return `image_on(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'imageView.sync': return `image_sync(${receiverOwner()}, ${argument(0)})`;
          case 'imageView.snapshot': return `image_snapshot(${receiverOwner()})`;
          case 'hook.asOverlay': return `overlay_setup(&${ownerReference()})`;
          case 'overlay.isOpen': return `overlay_is_open(${receiverOwner()})`;
          case 'overlay.openOverlay': case 'overlay.close': case 'overlay.toggle': return `overlay_intent(${receiverOwner()}, ${string(node.operation.slice('overlay.'.length))}, ${argument(0)})`;
          case 'overlay.configure': return `overlay_configure(${receiverOwner()}, ${argument(0)}, false)`;
          case 'overlay.updatePosition': return `overlay_configure(${receiverOwner()}, ${argument(0)}, true)`;
          case 'overlay.registerTrigger': case 'overlay.registerAnchor': case 'overlay.registerAnchorPart': case 'overlay.registerContent': return `overlay_register(${receiverOwner()}, ${argument(0)}, ${string(node.operation === 'overlay.registerTrigger' ? 'trigger' : node.operation === 'overlay.registerContent' ? 'content' : 'anchor')})`;
          case 'overlay.getPositionSnapshot': return `positioning_snapshot(${receiverOwner()})`;
          case 'overlay.keepMounted': return `overlay_keep_mounted(${receiverOwner()})`;
          case 'overlay.bindPresence': return `overlay_bind_presence(${receiverOwner()}, ${argument(0)})`;
          case 'positioning.connect': return `positioning_connect(${receiverOwner()}, ${argument(0)})`;
          case 'positioning.update': return `positioning_update(${receiverOwner()}, ${argument(0)})`;
          case 'positioning.requestUpdate': return `positioning_request(${receiverOwner()})`;
          case 'positioning.disconnect': return `positioning_disconnect(${receiverOwner()})`;
          case 'positioning.getSnapshot': return `positioning_snapshot(${receiverOwner()})`;
          case 'event.on': case 'event.onGlobal': return `listen(&${ownerReference()}, ${argument(0)}, ${node.operation === 'event.onGlobal'}, ${argument(1)}, ${argument(2)})`;
          case 'event.requestDefaultActionPrevention': return `prevent(${receiver()})`;
          default: throw new Error(`Checked GPUI operation has no direct lowering: ${node.operation}`);
        }
      }
    }
  }
  function statements(body: readonly StatementIR[], inherited: ReadonlySet<string>, depth: number, complete = true): string {
    const scope = new Set(inherited), indent = '    '.repeat(depth);
    let code = '';
    for (const statement of body) {
      if (statement.kind === 'const' && statement.value.kind === 'function' && !reached.has(statement.value.function)) continue;
      code += `${indent}// Source ${JSON.stringify(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
      if (statement.kind === 'const') { code += `${indent}let ${local(statement.name)} = ${expression(statement.value, scope, depth)};\n`; scope.add(statement.name); }
      else if (statement.kind === 'effect') code += `${indent}${expression(statement.expression, scope, depth)};\n`;
      else if (statement.kind === 'return') { code += `${indent}return ${statement.value ? expression(statement.value, scope, depth) : 'Value::Undefined'};\n`; return code; }
      else code += `${indent}if (${expression(statement.condition, scope, depth)}).truthy() {\n${statements(statement.then, scope, depth + 1, false)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, scope, depth + 1, false)}${indent}}` : ''}\n`;
    }
    return complete ? `${code}${indent}Value::Undefined\n` : code;
  }
  function accepts(value: string, type: DataType): string {
    if (typeof type === 'string') return type === 'number' ? `${value}.as_f64().is_some_and(f64::is_finite)` : type === 'null' || type === 'void' ? `${value}.is_null()` : `${value}.is_${type === 'boolean' ? 'boolean' : 'string'}()`;
    if (type.kind === 'literal') {
      if (type.value === null) return `${value}.is_null()`;
      if (typeof type.value === 'string') return `${value}.as_str() == Some(${string(type.value)})`;
      if (typeof type.value === 'boolean') return `${value}.as_bool() == Some(${type.value})`;
      return `${value}.as_f64() == Some(${Number.isInteger(type.value) ? `${type.value}.0` : String(type.value)})`;
    }
    if (type.kind === 'union') return `(${type.members.map((member) => accepts(value, member)).join(' || ')})`;
    if (type.kind === 'array') return `${value}.as_array().is_some_and(|items| items.iter().all(|item| ${accepts('item', type.element)}))`;
    return `(${value}.is_object() && ${type.fields.map((field) => `${value}.get(${string(field.name)}).map_or(${Boolean(field.optional)}, |field| ${accepts('field', field.type)})`).join(' && ') || 'true'})`;
  }
  const propValidChecks = ir.props.map((prop) => `${string(prop.name)} => ${accepts('value', prop.type)},`).join('\n        ');
  const contextChecks = ir.contextKeys.map((key) => `${string(key.id)} => ${accepts('value', key.type)},`).join('\n        ');
  const propChecks = ir.props.map((prop) => `value.get(${string(prop.name)}).map_or(true, |prop| prop.is_null() || ${accepts('prop', prop.type)})`).join(' && ') || 'true';
  const dataDeclarations: string[] = [];
  const dataNames = new Map<string, string>();
  function rustType(type: DataType): string {
    if (typeof type === 'string') return ({ boolean: 'bool', number: 'f64', string: 'String', null: '()', void: '()' } as const)[type];
    if (type.kind === 'literal') return type.value === null ? '()' : rustType(typeof type.value === 'boolean' ? 'boolean' : typeof type.value === 'number' ? 'number' : 'string');
    if (type.kind === 'array') return `Vec<${rustType(type.element)}>`;
    const key = JSON.stringify(type), prior = dataNames.get(key);
    if (prior) return prior;
    const name = `GeneratedData${dataNames.size}`;
    dataNames.set(key, name);
    if (type.kind === 'record') dataDeclarations.push(`#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]\npub struct ${name} {\n${type.fields.map((field, index) => `    #[serde(rename = ${string(field.name)}${field.optional ? ', default, skip_serializing_if = "Option::is_none"' : ''})]\n    pub field_${index}: ${field.optional ? `Option<${rustType(field.type)}>` : rustType(field.type)},`).join('\n')}\n}`);
    else dataDeclarations.push(`#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]\n#[serde(untagged)]\npub enum ${name} {\n${type.members.map((member, index) => `    Alternative${index}(${rustType(member)}),`).join('\n')}\n}`);
    return name;
  }
  const propsType = rustType({ kind: 'record', fields: ir.props.map((prop) => ({ name: prop.name, type: prop.type, optional: true })) });
  const typedMethods: string[] = [], methodChecks: string[] = [];
  for (const [index, exposure] of ir.exposes.entries()) {
    if (exposure.kind === 'value') {
      typedMethods.push(`    pub fn value_${index}(&self) -> Value { ensure(&Rc::downgrade(&self.owner)); self.owner.borrow().exposes.get(${string(exposure.name)}).expect("exposed value").clone() }`);
      continue;
    }
    if (exposure.kind === 'state') {
      typedMethods.push(`    pub fn state_${index}(&self) -> ${rustType(exposure.type)} { serde_json::from_value(self.state(${string(exposure.name)})).expect("checked exposed State") }`);
      continue;
    }
    if (exposure.kind !== 'method') continue;
    if (!isPublicValueType(exposure.returnType) || exposure.parameters.some((parameter) => !isDataValueType(parameter.type))) return { ok: false, diagnostics: [{ code: 'PUI_GPUI_PUBLIC_DATA', category: 'unsupported-input', message: 'Native exposed methods require portable arguments and concrete public data or read-only nominal results.', span: exposure.span }] };
    const portableReturn = isDataValueType(exposure.returnType);
    const returnType = exposure.returnType as DataType;
    const parameters = exposure.parameters.map((parameter, parameterIndex) => `argument_${parameterIndex}: ${parameter.optional ? `Option<${rustType(parameter.type as DataType)}>` : rustType(parameter.type as DataType)}`).join(', ');
    const args = exposure.parameters.map((parameter, parameterIndex) => parameter.optional ? `argument_${parameterIndex}.map(|value| Value::json(serde_json::to_value(value).expect("portable argument"))).unwrap_or(Value::Undefined)` : `Value::json(serde_json::to_value(argument_${parameterIndex}).expect("portable argument"))`).join(', ');
    typedMethods.push(`    pub fn method_${index}(&self, ${parameters}${parameters ? ', ' : ''}window: &mut Window, cx: &mut App) -> ${portableReturn ? rustType(returnType) : 'Value'} {
        let arguments = vec![${args}];
        let callback = self.owner.borrow().exposes.get(${string(exposure.name)}).expect("exposed method").clone();
        check_method(${string(exposure.name)}, &arguments);
        let result = invoke(&self.owner, "expose-method", &callback, arguments);
        let drive = self.owner.borrow().native_drive.clone(); if let Some(drive) = drive { drive(window, cx); }
        ${portableReturn ? `let result = if matches!(result, Value::Undefined) { Json::Null } else { result.data() };
        assert!(${accepts('result', returnType)}, "exposed method returned invalid portable data");
        serde_json::from_value(result).expect("checked exposed method result")` : 'result'}
    }`);
    const checks = exposure.parameters.map((parameter, parameterIndex) => `arguments.get(${parameterIndex}).map_or(${Boolean(parameter.optional)}, |value| ${parameter.optional ? 'matches!(value, Value::Undefined) || ' : ''}{let value = value.data(); ${accepts('value', parameter.type as DataType)}})`).join(' && ') || 'true';
    methodChecks.push(`        ${string(exposure.name)} => assert!(arguments.len() <= ${exposure.parameters.length} && ${checks}, "invalid exposed method arguments"),`);
  }
  const hooks = ir.hooks.filter((hook) => admitted.value.authoredHooks.includes(hook.id)).map((hook) => `fn ${hookNames.get(hook.id)}(definition: Value) -> Value {\n    let owner = definition.owner();\n    ${functionValue(hook.setup, new Set(), 1)}.call(vec![definition])\n}`).join('\n');
  const moduleSetups = ir.moduleDeclarations.map((declaration) => declaration.id === '@proto.ui/text-control/declaration'
    ? `        text_declaration(&owner, ${declaration.config.lineMode === 'multiline'});`
    : `        image_declaration(&owner, ${staticValue(declaration.config)});`).join('\n');
  const code = `// Direct checked-source GPUI component. Supporting files are ordinary editable Rust.
  pub use proto_ui_gpui_native as native;
  use gpui::{prelude::*, App, Context, FocusHandle, Subscription, Window};
  use std::rc::Rc;
  use serde_json::Value as Json;
  use native::gpui_native_owner::*;
  ${staticArtifacts.map((declaration) => `#[path = ${string(declaration.path)}] mod ${declaration.name};`).join("\n")}
  fn style_vocabulary() -> &'static native::gpui_native_style::StyleVocabulary {
      static VOCABULARY: std::sync::OnceLock<native::gpui_native_style::StyleVocabulary> = std::sync::OnceLock::new();
      VOCABULARY.get_or_init(|| native::gpui_native_style::StyleVocabulary::from_json(include_str!(".proto-ui/fixtures/style-tokens.json")).expect("compiler-produced style vocabulary"))
  }
  fn accepts_context(key: &str, value: &Json) -> bool {
      match key {
          ${contextChecks}
          _ => false,
      }
  }
  fn accepts_props(value: &Json) -> bool { value.is_object() && ${propChecks} }
  fn prop_valid(key: &str, value: &Json) -> bool { match key { ${propValidChecks} _ => false } }
  fn check_method(name: &str, arguments: &[Value]) { match name {
  ${methodChecks.join('\n')}
          _ => panic!("unknown exposed method"),
  } }
  ${dataDeclarations.join('\n')}
  pub type GeneratedProps = ${propsType};
  ${hooks}
  #[derive(Clone)]
  pub struct ${componentName}Handle { pub owner: OwnerRef }
  impl ${componentName}Handle {
  ${typedMethods.join('\n')}
      pub fn owner(&self) -> OwnerWeak { Rc::downgrade(&self.owner) }
      pub fn state(&self, name: &str) -> Json { self.owner.borrow().exposes.get(name).expect("unknown exposed State").clone().get().data() }
      pub fn call(&self, name: &str, arguments: Vec<Json>, window: &mut Window, cx: &mut App) -> Json {
          let callback = self.owner.borrow().exposes.get(name).expect("unknown exposed method").clone();
          let arguments: Vec<Value> = arguments.into_iter().map(Value::json).collect(); check_method(name, &arguments);
          let result = invoke(&self.owner, "expose-method", &callback, arguments);
          let drive = self.owner.borrow().native_drive.clone(); if let Some(drive) = drive { drive(window, cx); }
          if matches!(result, Value::Undefined) { Json::Null } else { result.data() }
      }
      pub fn host_target(&self) -> Value { ensure(&self.owner()); Value::HostTarget(self.owner()) }
      pub fn take_events(&self) -> Vec<(String, Json)> { std::mem::take(&mut self.owner.borrow_mut().emitted) }
      pub fn dispose(&self, window: &mut Window, cx: &mut App) { let drive = self.owner.borrow().native_drive.clone(); Owner::dispose(&self.owner); if let Some(drive) = drive { drive(window, cx); } }
  }
  pub struct ${componentName} { pub owner: OwnerRef, focus: FocusHandle, window_input: Option<FocusHandle>, _focus_subscriptions: [Subscription; 3], _focus_lost: Option<Subscription>, _global_key_capture: Option<Subscription> }
  impl ${componentName} {
      pub fn new_props(props: GeneratedProps, parent: Option<OwnerWeak>, window: &mut Window, cx: &mut Context<Self>) -> Self { Self::new(serde_json::to_value(props).expect("portable Props"), parent, window, cx) }
      pub fn new(raw_props: Json, parent: Option<OwnerWeak>, window: &mut Window, cx: &mut Context<Self>) -> Self {
          let owner_ref = Owner::new(raw_props, parent.unwrap_or_default(), accepts_context, accepts_props, prop_valid, style_vocabulary());
          let owner = Rc::downgrade(&owner_ref);
          let view = cx.entity().downgrade();
          let drive: Drive = Rc::new(move |window, cx| { let _ = view.update(cx, |view, cx| view.drive(window, cx)); });
          { let mut owner = owner_ref.borrow_mut(); owner.native_drive = Some(drive); owner.window_id = Some(window.window_handle().window_id()); }
  ${moduleSetups}
          let renderer = ${functionValue(ir.setup, new Set(), 2)}.call(vec![capability(&owner)]);
          Owner::finish(&owner_ref, renderer);
          let focus = cx.focus_handle();
          let focus_owner = owner_ref.clone();
          let on_focus = cx.on_focus(&focus, window, move |view, window, cx| { native_focus_fact(&focus_owner, true); dispatch(&focus_owner, "host:focus", false, event_fields("host:focus")); view.drive(window, cx); });
          let blur_owner = owner_ref.clone();
          let on_blur = cx.on_blur(&focus, window, move |view, window, cx| { native_focus_fact(&blur_owner, false); text_blur(&blur_owner, window, cx); dispatch(&blur_owner, "host:blur", false, event_fields("host:blur")); view.drive(window, cx); });
          let activation_owner = owner_ref.clone();
          let on_activation = cx.observe_window_activation(window, move |view, window, cx| { if !window.is_window_active() { native_window_blur(&activation_owner); view.drive(window, cx); } });
          let global_key_capture = subscribe_global_key_capture(&owner_ref, cx);
          let window_input = window_input_needed(&owner_ref).then(|| cx.focus_handle().tab_stop(false));
          let focus_lost = window_input.as_ref().map(|_| cx.on_focus_lost(window, |view, window, cx| { if let Some(focus) = &view.window_input { restore_window_input(&view.owner, focus, window, cx); } }));
          Self { owner: owner_ref, focus, window_input, _focus_subscriptions: [on_focus, on_blur, on_activation], _focus_lost: focus_lost, _global_key_capture: global_key_capture }
      }
      pub fn handle(&self) -> ${componentName}Handle { ${componentName}Handle { owner: self.owner.clone() } }
      pub fn set_props(&mut self, raw: Json, window: &mut Window, cx: &mut Context<Self>) { replace_props(&self.owner, raw); self.drive(window, cx); }
      pub fn set_slot(&mut self, slot: Vec<Value>, cx: &mut Context<Self>) { let mut owner = self.owner.borrow_mut(); owner.slot = slot; owner.dirty = true; cx.notify(); }
      pub fn set_parent(&mut self, parent: Option<OwnerWeak>, cx: &mut Context<Self>) -> Result<(), &'static str> { set_native_parent(&self.owner, parent.unwrap_or_default())?; cx.notify(); Ok(()) }
      pub fn drive(&mut self, window: &mut Window, cx: &mut Context<Self>) {
          if self.owner.borrow().disposed { cx.notify(); return; }
          modules_drive(&self.owner, &self.focus, window, cx);
          self.focus = self.focus.clone().tab_stop(native_tab_participation(&self.owner));
          drive_queued_focus(&self.owner, window, cx);
          let dirty = std::mem::take(&mut self.owner.borrow_mut().dirty); if dirty { cx.notify(); }
      }
  }
  impl Drop for ${componentName} { fn drop(&mut self) { Owner::dispose(&self.owner); } }
  impl gpui::Focusable for ${componentName} { fn focus_handle(&self, _: &App) -> FocusHandle { self.focus.clone() } }
  impl Render for ${componentName} {
      fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
          Owner::project(&self.owner);
          if self.owner.borrow().disposed || !self.owner.borrow().present { return gpui::div().into_any_element(); }
          let drive = self.owner.borrow().native_drive.as_ref().expect("live native owner drive").clone();
          self.owner.borrow_mut().dirty = false;
          let value = self.owner.borrow().projection.clone();
          self.focus = self.focus.clone().tab_stop(native_tab_participation(&self.owner));
          let element = paint(&value, &self.owner, &self.focus, true, format!("compiled-root-{}", Rc::as_ptr(&self.owner) as usize), drive);
          if let Some(focus) = &self.window_input { window_input_scope(element, focus, &self.owner) } else { element }
      }
  }
  `;
  const styleFixture = nativeStyle.files.find((file) => file.path === '.proto-ui/fixtures/style-tokens.json')!;
  const packageDigest = createHash('sha256').update(code).update('\0').update(styleFixture.contents);
  for (const artifact of staticArtifacts) packageDigest.update('\0').update(artifact.path).update('\0').update(artifact.contents);
  const manifest = `[package]
  name = "generated-gpui-${packageDigest.digest('hex').slice(0, 32)}"
  version = "0.1.0"
  edition = "2021"
  
  [lib]
  name = "generated_gpui_component"
  path = "Component.rs"
  
  [dependencies]
  proto-ui-gpui-native = { version = "=${GPUI_NATIVE_SDK_VERSION}", path = ${JSON.stringify(options.nativeSdkPath ?? GPUI_NATIVE_SDK_PATH)} }
  gpui = { git = "https://github.com/zed-industries/zed", rev = "62e5991dd0f0c8a3af8d5e7e9c4652490d468db8" }
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"
  
  [dev-dependencies]
  gpui = { git = "https://github.com/zed-industries/zed", rev = "62e5991dd0f0c8a3af8d5e7e9c4652490d468db8", features = ["test-support"] }
  `;
  return { ok: true, value: {
      code, profile: 'gpui-source-v1',
      supportingFiles: [
        { path: 'Cargo.toml', kind: 'source', contents: manifest },
        ...(options.nativeSdkPath === undefined ? gpuiNativeSdkFiles() : []),
        styleFixture,
        ...staticArtifacts.map(({ path, kind, contents }) => ({ path, kind, contents })),
      ],
      dependencies: [...TARGET_PROFILES['gpui-source-v1'].dependencies],
      provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'gpui-source-v1' },
    } };
}
