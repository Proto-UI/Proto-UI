import { validateIR, validIdentifier } from './ir-validation';
import { createHash } from 'node:crypto';
import { checkTargetOperations, TARGET_PROFILES } from './targets';
import { OPERATION_RULES } from './operations';
import { getSemanticGroupKeyV0 } from '../../core/src/spec/feedback/semantic-merge';
import { buildGpuiNativeStyleFiles } from './gpui-native-style';
import { GPUI_NATIVE_SDK_PATH, GPUI_NATIVE_SDK_VERSION, gpuiNativeSdkFiles } from './gpui-native-sdk';
import type { DataType } from './data-types';
import { nativeShape, NativeLexicalScope, type NativeShape } from './template-shape';
import { isDataValueType, isPublicValueType } from './ir';
import { inferBinaryType, relationalOperandKind } from './expression-types';
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
  const hasLoneSurrogate = (value: string): boolean => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
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
  const activationSites = admitted.value.sites.filter((site) => site.operation === 'focus.activate');
  const reachedActivation = (node: ExpressionIR): boolean => activationSites.some((site) =>
    site.span.file === node.span.file && site.span.start === node.span.start && site.span.end === node.span.end);
  function hasActivationEntry(type: DataType): boolean {
    return typeof type !== 'string' && (type.kind === 'record'
      ? type.fields.some((field) => field.name === 'entry')
      : type.kind === 'union' && type.members.some(hasActivationEntry));
  }
  function inspect(value: unknown, enclosingSpan = ir.setup.span): void {
    if (Array.isArray(value)) { value.forEach((item) => inspect(item, enclosingSpan)); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as ExpressionIR;
    // DataType literal nodes share the expression discriminant but have no span.
    // Carry the nearest real IR owner (e.g. the typed parameter), never invent one.
    const span = node.span ?? enclosingSpan;
    if (node.kind === 'function' && !reached.has(node.function)) return;
    if (node.kind === 'literal' && typeof node.value === 'string' && hasLoneSurrogate(node.value)) {
      diagnostics.push({ code: 'PUI_GPUI_STRING_UNSUPPORTED', category: 'unsupported-input', message: 'GPUI Rust strings cannot represent lone UTF-16 surrogates; no replacement encoding is emitted.', span });
    }
    const handles = node.kind === 'style-handle' ? [node.handle] : node.kind === 'rule' ? node.declaration.intent.ops.flatMap((operation) => operation.handles) : [];
    for (const handle of handles) for (const token of handle.tokens) styleTokens.set(token, node.span);
    if (node.kind === 'operation' && !supported.has(node.operation)) diagnostics.push({ code: 'PUI_GPUI_HOST_REQUIRED', category: 'unsupported-input', message: `GPUI operation ${node.operation} has no concrete pinned host lowering. No success fallback is emitted.`, span: node.span });
    if (node.kind === 'operation' && node.operation === 'focus.activate' && reachedActivation(node) && node.arguments[0] &&
        isDataValueType(node.arguments[0].type) && hasActivationEntry(node.arguments[0].type))
      diagnostics.push({ code: 'PUI_GPUI_FOCUS_ACTIVATION_REQUIRED', category: 'unsupported-input', message: 'Per-activation focus entry policy has no pinned GPUI lowering. Existing focus activation without entry remains supported.', span: node.arguments[0].span });
    if (node.kind === 'operation' && node.operation === 'event.on' && node.arguments[2]?.kind === 'record') {
      const type = node.arguments[0];
      const phaseMapped = type?.kind === 'literal' && ['host:mousedown', 'host:mouseup', 'host:keydown', 'host:keyup'].includes(String(type.value));
      for (const entry of node.arguments[2].entries) if (!phaseMapped && entry.key === 'capture' && entry.value.kind === 'literal' && entry.value.value === true) diagnostics.push({ code: 'PUI_GPUI_INPUT_REQUIRED', category: 'unsupported-input', message: 'This raw host event requires a native capture-phase mapping.', span: entry.value.span });
    }
    Object.values(value).forEach((child) => inspect(child, span));
  }
  for (const declaration of ir.moduleDeclarations) {
    if (!['@proto.ui/text-control/declaration', '@proto.ui/image-view/declaration'].includes(declaration.id)) diagnostics.push({ code: 'PUI_GPUI_MODULE_REQUIRED', category: 'unsupported-input', message: `GPUI Module ${declaration.id} has no concrete pinned host consumer.`, span: declaration.span });
  }
  admitted.value.functions.forEach((fn) => inspect(fn.body, fn.span));
  const nativeStyle = buildGpuiNativeStyleFiles(styleTokens.keys());
  for (const token of nativeStyle.unknown) diagnostics.push({ code: 'PUI_GPUI_STYLE', category: 'unsupported-input', message: `The authoritative Proto style producer has no native declarations for ${JSON.stringify(token)}.`, span: styleTokens.get(token) ?? ir.setup.span });
  if (diagnostics.length) return { ok: false, diagnostics };
  const local = (name: string) => `v_${Buffer.from(name, 'utf8').toString('hex')}`;
  // Encode original characters, never rewrite escape-like substrings in authored text.
  const string = (value: string, span = ir.setup.span): string => {
    if (hasLoneSurrogate(value)) {
      diagnostics.push({ code: 'PUI_GPUI_STRING_UNSUPPORTED', category: 'unsupported-input', message: 'GPUI Rust strings cannot represent lone UTF-16 surrogates; no replacement encoding is emitted.', span });
      // Finish collecting diagnostics, then discard the entire generated module below.
      return '""';
    }
    return '"' + Array.from(value, (character) => {
      if (character === '"' || character === '\\') return '\\' + character;
      const point = character.codePointAt(0)!;
      return point < 0x20 || point === 0x7f ? `\\u{${point.toString(16)}}` : character;
    }).join('') + '"';
  };
  function staticValue(value: unknown, span = ir.setup.span): string {
    if (value === undefined) return 'Value::Undefined';
    if (Array.isArray(value)) return `Value::Array(Rc::new(vec![${value.map((item) => staticValue(item, span)).join(', ')}]))`;
    if (value !== null && typeof value === 'object') return `record(vec![${Object.entries(value).map(([key, item]) => `(${string(key, span)}, ${staticValue(item, span)})`).join(', ')}])`;
    return literal(value as string | number | boolean | null, span);
  }
  const staticArtifacts = ir.staticDeclarations.map((declaration) => {
    const digest = createHash('sha256').update(declaration.id).digest('hex').slice(0, 32);
    const name = `declaration_${digest}`;
    const path = `.proto-ui/declaration/${digest}.rs`;
    return { id: declaration.id, name, path, kind: 'source' as const, contents: `// Original static declaration ${JSON.stringify(declaration.id)}\nuse crate::native::gpui_native_owner::*;\nuse std::rc::Rc;\nuse serde_json::Value as Json;\npub static DECLARATION: StaticDeclaration = StaticDeclaration { id: ${string(declaration.id)}, kind: ${string(declaration.kind)}, config: || ${staticValue(declaration.config, declaration.span)} };\n` };
  });
  function literal(value: string | number | boolean | null, span = ir.setup.span): string {
    if (value === null) return 'Value::Json(Json::Null)';
    if (typeof value === 'string') return `Value::string(${string(value, span)})`;
    if (typeof value === 'boolean') return `Value::boolean(${value})`;
    return `Value::number(${Object.is(value, -0) ? '-0.0' : Number.isInteger(value) ? `${value}.0` : String(value)})`;
  }
  let templateScope = NativeLexicalScope.empty();
  const functionDeclarations = new Map<FunctionIR, NativeLexicalScope>();
  function nativeFunctionParameter(fn: FunctionIR, index: number): boolean {
    const type = fn.parameters[index]?.type;
    // The semantic template/array capabilities use the native child ABI.
    // Portable DataType arrays remain ordinary data, not native factories.
    return type === 'template' || type === 'array';
  }
  function parameterScope(fn: FunctionIR, declaration: NativeLexicalScope): NativeLexicalScope {
    return fn.parameters.reduce((scope, parameter, index) => scope.bind(parameter.name, {
      kind: 'reference', name: '\0gpui-parameter-' + parameter.name,
      type: nativeFunctionParameter(fn, index) ? 'template' : parameter.type, span: fn.span,
    }), declaration);
  }
  function indexExpression(node: ExpressionIR, scope: NativeLexicalScope): void {
    if (node.kind === 'function') {
      functionDeclarations.set(node.function, scope);
      indexBody(node.function.body, parameterScope(node.function, scope));
    } else if (node.kind === 'array') node.elements.forEach(item => indexExpression(item, scope));
    else if (node.kind === 'record') node.entries.forEach(entry => indexExpression(entry.value, scope));
    else if (node.kind === 'binary') { indexExpression(node.left, scope); indexExpression(node.right, scope); }
    else if (node.kind === 'unary') indexExpression(node.operand, scope);
    else if (node.kind === 'member') indexExpression(node.object, scope);
    else if (node.kind === 'operation' || node.kind === 'helper-call') {
      if (node.kind === 'operation' && node.receiver) indexExpression(node.receiver, scope);
      node.arguments.forEach(argument => indexExpression(argument, scope));
    } else if (node.kind === 'rule') {
      indexExpression(node.receiver, scope);
      node.states.forEach(state => indexExpression(state.value, scope));
    }
  }
  function indexBody(body: readonly StatementIR[], initial: NativeLexicalScope): void {
    let scope = initial;
    for (const statement of body) {
      if (statement.kind === 'const') {
        indexExpression(statement.value, scope);
        scope = scope.bind(statement.name, statement.value);
      } else if (statement.kind === 'effect') indexExpression(statement.expression, scope);
      else if (statement.kind === 'return') { if (statement.value) indexExpression(statement.value, scope); }
      else {
        indexExpression(statement.condition, scope);
        indexBody(statement.then, scope); indexBody(statement.otherwise, scope);
      }
    }
  }
  functionDeclarations.set(ir.setup, NativeLexicalScope.empty());
  indexBody(ir.setup.body, parameterScope(ir.setup, NativeLexicalScope.empty()));
  // Authored-hook functions have their own lexical entry rather than inheriting
  // a caller's same-spelled locals. The canonical admitted function objects are reused.
  for (const fn of admitted.value.functions) {
    if (!functionDeclarations.has(fn)) {
      functionDeclarations.set(fn, NativeLexicalScope.empty());
      indexBody(fn.body, parameterScope(fn, NativeLexicalScope.empty()));
    }
  }
  function helperFunction(name: string, scope = templateScope): FunctionIR | undefined {
    const seen = new Set<object>();
    let binding = scope.lookup(name);
    while (binding?.value && !seen.has(binding)) {
      seen.add(binding);
      const value = binding.value;
      if (value.kind === 'function') return value.function;
      if (value.kind !== 'reference') return undefined;
      binding = binding.environment.lookup(value.name);
    }
    return undefined;
  }
  const nativeReturns = new Map<FunctionIR, boolean>();
  const activeNativeReturns = new Set<FunctionIR>();
  function shapeHasNative(shape: NativeShape | null): boolean {
    return !!shape && (shape.kind === 'node' || shape.kind === 'legacy-template' ||
      (shape.kind === 'array' || shape.kind === 'union') && shape.items.some(shapeHasNative));
  }
  function snapshotAbi(node: ExpressionIR, scope = templateScope, seen = new Set<object>()): boolean {
    if (node.kind === 'operation') return node.operation === 'render.el' || node.operation === 'render.slot';
    if (node.kind === 'helper-call') {
      const fn = helperFunction(node.name, scope);
      return !!fn && returnsNative(fn);
    }
    if (node.kind === 'reference') {
      const binding = scope.lookup(node.name);
      if (binding?.value && !seen.has(binding)) {
        const next = new Set(seen); next.add(binding);
        return snapshotAbi(binding.value, binding.environment, next);
      }
      return node.type === 'template' || node.type === 'array';
    }
    if (node.kind === 'array') return node.elements.some(item => snapshotAbi(item, scope, seen));
    if (node.kind === 'binary' && ['&&', '||', '??'].includes(node.operator))
      return snapshotAbi(node.left, scope, seen) || snapshotAbi(node.right, scope, seen);
    // Canonical template facts stay owned by the shared lexical analyzer. This
    // predicate chooses a Rust ABI; it is not an emitted template representation.
    return shapeHasNative(nativeShape(node, scope));
  }
  function returnsNative(fn: FunctionIR): boolean {
    const previous = nativeReturns.get(fn);
    if (previous !== undefined) return previous;
    if (activeNativeReturns.has(fn)) throw new Error('Recursive helper escaped checked GPUI ABI admission.');
    activeNativeReturns.add(fn);
    try {
      function returned(body: readonly StatementIR[], initial: NativeLexicalScope): boolean {
        let scope = initial;
        for (const statement of body) {
          if (statement.kind === 'const') scope = scope.bind(statement.name, statement.value);
          else if (statement.kind === 'return') return !!statement.value && snapshotAbi(statement.value, scope);
          else if (statement.kind === 'if' && (returned(statement.then, scope) || returned(statement.otherwise, scope))) return true;
        }
        return false;
      }
      const result = fn !== ir.setup && returned(fn.body, parameterScope(fn, functionDeclarations.get(fn) ?? NativeLexicalScope.empty()));
      nativeReturns.set(fn, result);
      return result;
    } finally { activeNativeReturns.delete(fn); }
  }
  function typedFunction(fn: FunctionIR): boolean {
    return fn !== ir.setup && (returnsNative(fn) || fn.parameters.some((_, index) => nativeFunctionParameter(fn, index)));
  }
  let nativeIndex = 0;
  const freshNative = (): string => `pui_native_${nativeIndex++}`;
  function snapshotExpression(node: ExpressionIR, environment: ReadonlySet<string>, depth: number): string {
    const value = expression(node, environment, depth);
    return snapshotAbi(node) ? value : snapshotData(nativeShape(node, templateScope) ?? { kind: 'invalid' }, value);
  }

  function snapshotData(shape: NativeShape, value: string): string {
    if (shape.kind === 'legacy-template') throw new Error('Legacy template annotation requires lexical provenance before native snapshot emission.');
    if (shape.kind === 'node') throw new Error('Native node requires the typed native ABI, not Value coercion.');
    if (shape.kind === 'text') return `native::gpui_native_owner::NativeSnapshot::text_value(${value})`;
    if (shape.kind === 'null') return `{ let _ = ${value}; native::gpui_native_owner::NativeSnapshot::empty() }`;
    if ((shape.kind === 'invalid' || shape.kind === 'undefined')) return `native::gpui_native_owner::NativeSnapshot::invalid(${value})`;
    if (shape.kind === 'array') {
      const array = freshNative(), item = freshNative();
      return `{ let ${array} = ${value}; native::gpui_native_owner::NativeSnapshot::sequence(${array}.items().into_iter().map(|${item}| ${snapshotData({ kind: 'union', items: shape.items }, item)}).collect(), Some(${array})) }`;
    }
    if (shape.kind !== 'union') throw new Error('Unknown native data shape reached snapshot conversion.');
    const alternatives: NativeShape[] = [];
    const flatten = (item: NativeShape): void => { if (item.kind === 'union') item.items.forEach(flatten); else alternatives.push(item); };
    shape.items.forEach(flatten);
    const current = freshNative(), cases: string[] = [];
    if (alternatives.some(item => item.kind === 'legacy-template')) throw new Error('Legacy template union requires lexical provenance before native snapshot emission.');
    if (alternatives.some(item => item.kind === 'node')) throw new Error('A mixed native return must use its native function ABI.');
    if (alternatives.some(item => item.kind === 'null')) cases.push(`if matches!(&${current}, Value::Json(Json::Null)) { native::gpui_native_owner::NativeSnapshot::empty() }`);
    if (alternatives.some(item => item.kind === 'text')) cases.push(`if matches!(&${current}, Value::Number(_)|Value::Json(Json::String(_)|Json::Number(_))) { native::gpui_native_owner::NativeSnapshot::text_value(${current}) }`);
    const arrays = alternatives.filter((item): item is Extract<NativeShape, { kind: 'array' }> => item.kind === 'array');
    if (arrays.length) cases.push(`if matches!(&${current},Value::Array(_)|Value::Json(Json::Array(_))) { ${snapshotData({ kind:'array',items:arrays.flatMap(item=>item.items) },current)} }`);
    return `{ let ${current} = ${value}; ${cases.length ? cases.join(' else ') + ' else ' : ''}{ native::gpui_native_owner::NativeSnapshot::invalid(${current}) } }`;
  }

  function nativeElement(node: Extract<ExpressionIR, { kind:'operation' }>, environment: ReadonlySet<string>, depth: number): string {
    const [tag, second, third] = node.arguments;
    const props = second && (second.type === 'template-props' || typeof second.type === 'object' && second.type.kind === 'record' && second.type.fields.length === 0);
    const tagName = freshNative(), propsName = freshNative(), childrenName = freshNative(), stylesName = freshNative();
    const child = node.arguments.length === 3 ? third : props ? undefined : second;
    const tagCode = tag ? expression(tag,environment,depth) : 'Value::Undefined';
    const propsCode = props && second ? expression(second,environment,depth) : 'Value::Undefined';
    const childCode = child ? snapshotExpression(child,environment,depth) : 'native::gpui_native_owner::NativeSnapshot::empty()';
    return `{ let ${tagName} = ${tagCode}; let _ = ${tagName}; let ${propsName} = ${propsCode}; let ${childrenName} = ${childCode};
      let ${stylesName} = if ${propsName}.nullish() { Vec::new() } else { let style = ${propsName}.member("style",false); if style.nullish(){Vec::new()}else{style_items(vec![style])} };
      let frame_children = ${childrenName}.clone(); let text_children = ${childrenName}.clone();
      native::gpui_native_owner::NativeSnapshot { identity:Rc::new(()),observation:None,valid:${childrenName}.valid,slot_count:${childrenName}.slot_count,
        frame:Rc::new(move |owner,focus,parent_path,drive,slot,index| {
          let path=format!("{parent_path}-{}",*index);*index+=1;
          let tokens:Vec<String> = ${stylesName}.iter().map(|(token,_)|token.clone()).collect();
          let(style,fixed,translation)=native_presentation(owner,&tokens);
          let mut element=gpui::div().id(gpui::ElementId::Name(path.to_owned().into())); *element.style()=style;
          let mut child_index=0;for child in (frame_children.frame)(owner,focus,&path,drive,slot,&mut child_index){element=element.child(child);}
          let element=translated_element(element.into_any_element(),translation,None); vec![if fixed{viewport_root(element)}else{element}]
        }),text:Rc::new(move|slot|(text_children.text)(slot)) }
    }`;
  }

  function nativeCallable(node: ExpressionIR): FunctionIR | undefined {
    const fn = node.kind === 'function' ? node.function : node.kind === 'reference' ? helperFunction(node.name) : undefined;
    return fn && typedFunction(fn) ? fn : undefined;
  }
  // Follow callable provenance only. Template-result facts remain owned by
  // nativeShape; no source is evaluated and no plan is emitted to the consumer.
  function callableTargets(value: ExpressionIR, environment: NativeLexicalScope): { fn: FunctionIR; environment: NativeLexicalScope }[] {
    const active = new Set<ExpressionIR>();
    const parameterFacts = new WeakMap<object, { fn: FunctionIR; environment: NativeLexicalScope }[]>();
    function resolve(node: ExpressionIR, scope: NativeLexicalScope): { fn: FunctionIR; environment: NativeLexicalScope }[] {
      if (node.kind === 'function') return [{ fn: node.function, environment: scope }];
      if (node.kind === 'reference') {
        const binding = scope.lookup(node.name);
        return binding && parameterFacts.has(binding) ? parameterFacts.get(binding)! : binding?.value ? resolve(binding.value, binding.environment) : [];
      }
      if (node.kind !== 'helper-call') return [];
      const binding = scope.lookup(node.name);
      if (!binding?.value) return [];
      const functions = resolve(binding.value, binding.environment);
      // Analyze caller arguments before entering the callee. Finite repeated
      // wrapper(wrapper(draw)) may revisit one body call expression through a
      // different actual argument; it is not recursive authored execution.
      const arguments_ = node.arguments.map(argument => argument.type === 'function' ? resolve(argument, scope) : undefined);
      if (active.has(node)) return [];
      active.add(node);
      try {
        const found: { fn: FunctionIR; environment: NativeLexicalScope }[] = [];
        for (const target of functions) {
          let local = target.environment;
          target.fn.parameters.forEach((parameter, index) => {
            local = local.parameter(parameter.name, node.arguments[index], scope,
              node.arguments[index] ? nativeShape(node.arguments[index], scope) : { kind: 'undefined' });
            if (parameter.type === 'function') parameterFacts.set(local.lookup(parameter.name)!, arguments_[index] ?? []);
          });
          function returns(body: readonly StatementIR[], initial: NativeLexicalScope): boolean {
            let current = initial;
            for (const statement of body) {
              if (statement.kind === 'const') current = current.bind(statement.name, statement.value);
              else if (statement.kind === 'return') {
                if (statement.value) found.push(...resolve(statement.value, current));
                return true;
              } else if (statement.kind === 'if') {
                const then = returns(statement.then, current), otherwise = returns(statement.otherwise, current);
                if (then && otherwise) return true;
              }
            }
            return false;
          }
          returns(target.fn.body, local);
        }
        return found;
      } finally { active.delete(node); }
    }
    return resolve(value, environment);
  }
  function callableResultShape(fn: FunctionIR, declaration: NativeLexicalScope): NativeShape {
    const name = '\0gpui-render-entry';
    const bindings = declaration.bind(name, { kind:'function', function:fn, type:'function', span:fn.span });
    const arguments_ = fn.parameters.map(parameter => ({ kind:'reference', name:'\0entry-'+parameter.name, type:parameter.type, span:fn.span }) as ExpressionIR);
    // Non-child capabilities/function values remain invalid children. This does
    // not turn an unknown template provenance into a runtime tree conversion.
    return nativeShape({ kind:'helper-call', name, arguments:arguments_, type:fn.returnType, span:fn.span }, bindings) ?? { kind:'invalid' };
  }
  function callableValue(node: ExpressionIR, environment: ReadonlySet<string>, depth: number): string {
    const fn = nativeCallable(node);
    if (!fn) return expression(node, environment, depth);
    const name = freshNative(), value = expression(node, environment, depth);
    const args = fn.parameters.map((_, index) => nativeFunctionParameter(fn,index)
      ? `native::gpui_native_owner::NativeSnapshot::invalid(arg(&arguments,${index}))`
      : `arg(&arguments,${index})`).join(', ');
    const called = `(${name}.call)(${args})`;
    const result = returnsNative(fn) ? called : snapshotData(callableResultShape(fn,functionDeclarations.get(fn) ?? templateScope), called);
    return `{ let ${name}=${value}; Value::NativeFunction{identity:${name}.identity.clone(),render:Rc::new(move |arguments:Vec<Value>| {${result}})} }`;
  }
  function rendererEntry(node: ExpressionIR, environment: ReadonlySet<string>, depth: number): string {
    const value = callableValue(node, environment, depth);
    const functions = callableTargets(node, templateScope);
    const scalarShapes = functions.filter(target => !typedFunction(target.fn)).map(target => callableResultShape(target.fn,target.environment));
    const result = scalarShapes.length ? snapshotData({kind:'union',items:scalarShapes},'callback(arguments)')
      : 'panic!("checked native renderer entry has no scalar callback alternative")';
    // Capture the evaluated callable once. Only projection invokes it; native
    // repaint never re-runs a factory or reconstructs a lexical environment.
    return `{ let callable=${value}; match callable {
      Value::NativeFunction{render,..} => Value::Renderer(render),
      Value::Renderer(render) => Value::Renderer(render),
      Value::Function(callback) => Value::Renderer(Rc::new(move |arguments:Vec<Value>| { ${result} })),
      _ => panic!("checked setup result must be a callable")
    } }`;
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
    const nativeReturn = returnsNative(fn);
    const savedTemplateScope = templateScope;
    templateScope = functionDeclarations.get(fn) ?? templateScope;
    for(const [index,parameter] of fn.parameters.entries()) templateScope=templateScope.bind(parameter.name, {kind:'reference',name:'\0'+parameter.name,type:nativeFunctionParameter(fn,index)?'template':parameter.type,span:fn.span});
    const body = statements(fn.body, scope, depth + 1, true, nativeReturn, fn === ir.setup);
    templateScope = savedTemplateScope;
    const functionUses = uses;
    uses = parentUses;
    const captures = [...environment].filter((name) => functionUses.names.has(name) && !parameterNames.has(name)).map((name) => {
      uses.names.add(name);
      return `let ${local(name)} = ${local(name)}.clone();`;
    }).join(' ');
    const parameters = fn.parameters.flatMap((parameter, index) => functionUses.names.has(parameter.name) ? [`${indent}    let ${local(parameter.name)} = arg(&arguments, ${index});\n`] : []).join('');
    const owner = functionUses.owner ? `let owner = ${ownerReference()}.clone();` : '';
    if (typedFunction(fn)) {
      const signature = fn.parameters.map((parameter,index) => `${local(parameter.name)}: ${nativeFunctionParameter(fn,index) ? 'native::gpui_native_owner::NativeSnapshot' : 'Value'}`).join(', ');
      const parameterTypes = fn.parameters.map((_,index) => nativeFunctionParameter(fn,index) ? 'native::gpui_native_owner::NativeSnapshot' : 'Value').join(', ');
      const resultType = nativeReturn ? 'native::gpui_native_owner::NativeSnapshot' : 'Value';
      return `{ ${owner} ${captures} let call:Rc<dyn Fn(${parameterTypes})->${resultType}>=Rc::new(move |${signature}| -> ${resultType} {\n${body}${indent}}); NativeCallable { identity:Rc::new(()), call } }`;
    }
    return `{ ${owner} ${captures} Value::${nativeReturn ? 'Renderer' : 'Function'}(Rc::new(move |${parameters ? 'arguments' : '_'}: Vec<Value>| {\n${parameters}${body}${indent}})) }`;
  }
  function expression(node: ExpressionIR, environment: ReadonlySet<string>, depth: number): string {
    if (node.kind === 'operation' && node.operation === 'render.el') return nativeElement(node, environment, depth);
    if (node.kind === 'operation' && node.operation === 'render.slot') return 'native::gpui_native_owner::NativeSnapshot::slot()';
    if (node.kind === 'helper-call') {
      uses.names.add(node.name);
      const fn = helperFunction(node.name);
      const args = node.arguments.map((argument, index) => fn && nativeFunctionParameter(fn, index)
        ? snapshotExpression(argument, environment, depth)
        : argument.type === 'function' ? callableValue(argument, environment, depth) : expression(argument, environment, depth));
      if (fn && typedFunction(fn)) {
        // Optional native formals receive the same explicit undefined observation
        // as an omitted Value formal; validity is checked only if selected as output.
        for (let index = args.length; index < fn.parameters.length; index++) args.push(nativeFunctionParameter(fn, index)
          ? 'native::gpui_native_owner::NativeSnapshot::invalid(Value::Undefined)' : 'Value::Undefined');
        return `(${local(node.name)}.call)(${args.join(', ')})`;
      }
      return `${local(node.name)}.call(vec![${args.join(', ')}])`;
    }
    const args = node.kind === 'operation' ? node.arguments.map((argument) => argument.type === 'function'
      ? callableValue(argument, environment, depth) : expression(argument, environment, depth)) : [];
    const argument = (index: number) => args[index] ?? 'Value::Undefined';
    let emittedReceiver: string | undefined;
    const receiver = () => emittedReceiver ??= node.kind === 'operation' && node.receiver ? expression(node.receiver, environment, depth) : `capability(&${ownerReference()})`;
    const receiverOwner = () => `&(${receiver()}).owner()`;
    switch (node.kind) {
      case 'literal': return literal(node.value, node.span);
      case 'reference': uses.names.add(node.name); return `${local(node.name)}.clone()`;
      case 'context-key': return `Value::string(${string(node.keyId)})`;
      case 'style-handle': return `Value::Style(vec![${node.handle.tokens.map((token) => `(${string(token)}.into(), ${string(getSemanticGroupKeyV0(token))}.into())`).join(', ')}])`;
      case 'member': return `(${expression(node.object, environment, depth)}).member(${string(node.property, node.span)}, ${node.optional})`;
      case 'unary': {
        const operand = expression(node.operand, environment, depth);
        return node.operator === '!' ? `Value::boolean(!(${operand}).truthy())` : `Value::number(${node.operator === '-' ? '-' : ''}(${operand}).scalar_number())`;
      }
      case 'binary': {
        if (['&&', '||', '??'].includes(node.operator) && snapshotAbi(node)) {
          const left = snapshotExpression(node.left, environment, depth), right = snapshotExpression(node.right, environment, depth);
          const selectRight = node.operator === '??' ? 'left.nullish()' : `${node.operator === '||' ? '!' : ''}left.truthy()`;
          return `{ let left = ${left}; if ${selectRight} { ${right} } else { left } }`;
        }
        const left = expression(node.left, environment, depth), right = expression(node.right, environment, depth);
        if (node.operator === '&&' || node.operator === '||') return `{ let left = ${left}; if ${node.operator === '&&' ? '' : '!'}left.truthy() { ${right} } else { left } }`;
        if (node.operator === '??') return `{ let left = ${left}; if left.nullish() { ${right} } else { left } }`;
        if (node.operator === '===' || node.operator === '!==') {
          const leftNative = snapshotAbi(node.left), rightNative = snapshotAbi(node.right);
          const leftCallable = !!nativeCallable(node.left), rightCallable = !!nativeCallable(node.right);
          if (!leftNative && !rightNative && !leftCallable && !rightCallable)
            return `Value::boolean(${node.operator === '!==' ? '!' : ''}strict_equal(&(${left}), &(${right})))`;
          const leftName = freshNative(), rightName = freshNative();
          let equality: string;
          if (leftNative && rightCallable || leftCallable && rightNative) equality = 'false';
          else if (leftCallable && rightCallable) equality = `${leftName}.equals_native(&${rightName})`;
          else if (leftCallable || leftNative) equality = `${leftName}.${leftNative && rightNative ? 'equals' : 'equals_value'}(&${rightName})`;
          else if (rightCallable || rightNative) equality = `${rightName}.equals_value(&${leftName})`;
          else equality = `strict_equal(&${leftName}, &${rightName})`;
          // Every category, including provably unequal native child/callable,
          // evaluates both authored operands once in left-to-right order.
          return `{ let ${leftName} = ${left}; let ${rightName} = ${right}; Value::boolean(${node.operator === '!==' ? '!' : ''}${equality}) }`;
        }
        if (node.operator === '+') return `add(${left}, ${right})`;
        if (['<', '<=', '>', '>='].includes(node.operator)) {
          if (!isDataValueType(node.left.type) || !isDataValueType(node.right.type)) throw new Error('Validated relational operands must be data.');
          const resultType = inferBinaryType(node.operator, node.left.type, node.right.type);
          if (typeof resultType !== 'string' && resultType.kind === 'union' && resultType.members.length === 0) {
            // Shared inference retains bottom for unreachable comparisons, even when the
            // other operand has no relational domain. Recompute the validated semantic result
            // rather than inspecting the raw IR union representation. A typed divergent
            // result gives method-receiver positions a Value type without fabricating one.
            return `{ let _relational_left = ${left}; let _relational_right = ${right}; let _relational_result: Value = unreachable!("uninhabited Proto relational expression"); _relational_result }`;
          }
          const kind = relationalOperandKind(node.left.type, node.right.type);
          // Bind Value operands before reading either, preserving left-to-right, once-only evaluation.
          // Rust str ordering is Unicode scalar ordering; Proto compares UTF-16 code units.
          const compare = kind === 'string'
            ? `relational_left.text().encode_utf16().cmp(relational_right.text().encode_utf16()) ${node.operator} std::cmp::Ordering::Equal`
            : `relational_left.scalar_number() ${node.operator} relational_right.scalar_number()`;
          return `{ let relational_left = ${left}; let relational_right = ${right}; Value::boolean(${compare}) }`;
        }
        return `Value::number((${left}).scalar_number() ${node.operator} (${right}).scalar_number())`;
      }
      case 'array': return snapshotAbi(node)
        ? `native::gpui_native_owner::NativeSnapshot::sequence(vec![${node.elements.map(item => snapshotExpression(item, environment, depth)).join(', ')}], None)`
        : `Value::Array(Rc::new(vec![${node.elements.map(item => expression(item, environment, depth)).join(', ')}]))`;
      case 'record': return `record(vec![${node.entries.map((entry) => `(${string(entry.key, node.span)}, ${expression(entry.value, environment, depth)})`).join(', ')}])`;
      case 'function': return functionValue(node.function, environment, depth);

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
  function statements(body: readonly StatementIR[], inherited: ReadonlySet<string>, depth: number, complete = true, nativeReturn = false, rendererResult = false): string {
    const scope = new Set(inherited), indent = '    '.repeat(depth);
    let code = '';
    const savedTemplateScope=templateScope;
    for (const statement of body) {
      if (statement.kind === 'const' && statement.value.kind === 'function' && !reached.has(statement.value.function)) continue;
      code += `${indent}// Source ${JSON.stringify(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
      if (statement.kind === 'const') { code += `${indent}let ${local(statement.name)} = ${expression(statement.value, scope, depth)};\n`; scope.add(statement.name); templateScope=templateScope.bind(statement.name,statement.value); }
      else if (statement.kind === 'effect') code += `${indent}${expression(statement.expression, scope, depth)};\n`;
      else if (statement.kind === 'return') { code += `${indent}return ${statement.value ? rendererResult && statement.value.type === 'function' ? rendererEntry(statement.value, scope, depth) : nativeReturn ? snapshotExpression(statement.value, scope, depth) : statement.value.type === 'function' ? callableValue(statement.value, scope, depth) : expression(statement.value, scope, depth) : nativeReturn ? 'native::gpui_native_owner::NativeSnapshot::invalid(Value::Undefined)' : 'Value::Undefined'};\n`; templateScope=savedTemplateScope; return code; }
      else code += `${indent}if (${expression(statement.condition, scope, depth)}).truthy() {\n${statements(statement.then, scope, depth + 1, false, nativeReturn, rendererResult)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, scope, depth + 1, false, nativeReturn, rendererResult)}${indent}}` : ''}\n`;
    }
    templateScope=savedTemplateScope;
    return complete ? `${code}${indent}${nativeReturn ? "native::gpui_native_owner::NativeSnapshot::invalid(Value::Undefined)" : "Value::Undefined"}\n` : code;
  }
  function accepts(value: string, type: DataType, span = ir.setup.span): string {
    if (typeof type === 'string') return type === 'number' ? `${value}.as_f64().is_some_and(f64::is_finite)` : type === 'null' || type === 'void' ? `${value}.is_null()` : `${value}.is_${type === 'boolean' ? 'boolean' : 'string'}()`;
    if (type.kind === 'literal') {
      if (type.value === null) return `${value}.is_null()`;
      if (typeof type.value === 'string') return `${value}.as_str() == Some(${string(type.value, span)})`;
      if (typeof type.value === 'boolean') return `${value}.as_bool() == Some(${type.value})`;
      return `${value}.as_f64() == Some(${Number.isInteger(type.value) ? `${type.value}.0` : String(type.value)})`;
    }
    if (type.kind === 'union') return `(${type.members.map((member) => accepts(value, member, span)).join(' || ')})`;
    if (type.kind === 'array') return `${value}.as_array().is_some_and(|items| items.iter().all(|item| ${accepts('item', type.element, span)}))`;
    return `(${value}.is_object() && ${type.fields.map((field) => `${value}.get(${string(field.name, span)}).map_or(${Boolean(field.optional)}, |field| ${accepts('field', field.type, span)})`).join(' && ') || 'true'})`;
  }
  const propValidChecks = ir.props.map((prop) => `${string(prop.name, prop.span)} => ${accepts('value', prop.type, prop.span)},`).join('\n        ');
  const contextChecks = ir.contextKeys.map((key) => `${string(key.id)} => ${accepts('value', key.type, key.span)},`).join('\n        ');
  const propChecks = ir.props.map((prop) => `value.get(${string(prop.name, prop.span)}).map_or(true, |prop| prop.is_null() || ${accepts('prop', prop.type, prop.span)})`).join(' && ') || 'true';
  const dataDeclarations: string[] = [];
  const dataNames = new Map<string, string>();
  function rustType(type: DataType, span = ir.setup.span): string {
    if (typeof type === 'string') return ({ boolean: 'bool', number: 'f64', string: 'String', null: '()', void: '()' } as const)[type];
    if (type.kind === 'literal') return type.value === null ? '()' : rustType(typeof type.value === 'boolean' ? 'boolean' : typeof type.value === 'number' ? 'number' : 'string');
    if (type.kind === 'array') return `Vec<${rustType(type.element, span)}>`;
    const key = JSON.stringify(type), prior = dataNames.get(key);
    if (prior) return prior;
    const name = `GeneratedData${dataNames.size}`;
    dataNames.set(key, name);
    if (type.kind === 'record') dataDeclarations.push(`#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]\npub struct ${name} {\n${type.fields.map((field, index) => `    #[serde(rename = ${string(field.name, span)}${field.optional ? ', default, skip_serializing_if = "Option::is_none"' : ''})]\n    pub field_${index}: ${field.optional ? `Option<${rustType(field.type, span)}>` : rustType(field.type, span)},`).join('\n')}\n}`);
    else dataDeclarations.push(`#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]\n#[serde(untagged)]\npub enum ${name} {\n${type.members.map((member, index) => `    Alternative${index}(${rustType(member, span)}),`).join('\n')}\n}`);
    return name;
  }
  const propsType = rustType({ kind: 'record', fields: ir.props.map((prop) => ({ name: prop.name, type: prop.type, optional: true })) });
  const typedMethods: string[] = [], methodChecks: string[] = [];
  for (const [index, exposure] of ir.exposes.entries()) {
    if (exposure.kind === 'value') {
      typedMethods.push(`    pub fn value_${index}(&self) -> Value { ensure(&Rc::downgrade(&self.owner)); self.owner.borrow().exposes.get(${string(exposure.name, exposure.span)}).expect("exposed value").clone() }`);
      continue;
    }
    if (exposure.kind === 'state') {
      typedMethods.push(`    pub fn state_${index}(&self) -> ${rustType(exposure.type, exposure.span)} { serde_json::from_value(self.state(${string(exposure.name, exposure.span)})).expect("checked exposed State") }`);
      continue;
    }
    if (exposure.kind !== 'method') continue;
    if (!isPublicValueType(exposure.returnType) || exposure.parameters.some((parameter) => !isDataValueType(parameter.type))) return { ok: false, diagnostics: [{ code: 'PUI_GPUI_PUBLIC_DATA', category: 'unsupported-input', message: 'Native exposed methods require portable arguments and concrete public data or read-only nominal results.', span: exposure.span }] };
    const portableReturn = isDataValueType(exposure.returnType);
    const returnType = exposure.returnType as DataType;
    const parameters = exposure.parameters.map((parameter, parameterIndex) => `argument_${parameterIndex}: ${parameter.optional ? `Option<${rustType(parameter.type as DataType, exposure.span)}>` : rustType(parameter.type as DataType, exposure.span)}`).join(', ');
    const args = exposure.parameters.map((parameter, parameterIndex) => parameter.optional ? `argument_${parameterIndex}.map(|value| Value::json(serde_json::to_value(value).expect("portable argument"))).unwrap_or(Value::Undefined)` : `Value::json(serde_json::to_value(argument_${parameterIndex}).expect("portable argument"))`).join(', ');
    typedMethods.push(`    pub fn method_${index}(&self, ${parameters}${parameters ? ', ' : ''}window: &mut Window, cx: &mut App) -> ${portableReturn ? rustType(returnType, exposure.span) : 'Value'} {
        let arguments = vec![${args}];
        let callback = self.owner.borrow().exposes.get(${string(exposure.name, exposure.span)}).expect("exposed method").clone();
        check_method(${string(exposure.name, exposure.span)}, &arguments);
        let result = invoke(&self.owner, "expose-method", &callback, arguments);
        let drive = self.owner.borrow().native_drive.clone(); if let Some(drive) = drive { drive(window, cx); }
        ${portableReturn ? `let result = if matches!(result, Value::Undefined) { Json::Null } else { result.data() };
        assert!(${accepts('result', returnType, exposure.span)}, "exposed method returned invalid portable data");
        serde_json::from_value(result).expect("checked exposed method result")` : 'result'}
    }`);
    const checks = exposure.parameters.map((parameter, parameterIndex) => `arguments.get(${parameterIndex}).map_or(${Boolean(parameter.optional)}, |value| ${parameter.optional ? 'matches!(value, Value::Undefined) || ' : ''}{let value = value.data(); ${accepts('value', parameter.type as DataType, exposure.span)}})`).join(' && ') || 'true';
    methodChecks.push(`        ${string(exposure.name, exposure.span)} => assert!(arguments.len() <= ${exposure.parameters.length} && ${checks}, "invalid exposed method arguments"),`);
  }
  // Registry keys preserve UTF-16 name equality, including lone surrogates, without Rust escapes.
  const authoredHookKey = (name: string): string => JSON.stringify('u16:' + name.split('').map((unit) => unit.charCodeAt(0).toString(16).padStart(4, '0')).join(''));
  const hooks = ir.hooks.filter((hook) => admitted.value.authoredHooks.includes(hook.id)).map((hook) => `fn ${hookNames.get(hook.id)}(definition: Value) -> Value {\n    let owner = definition.owner();\n    authored_hook(&owner, ${authoredHookKey(hook.name)}, || { ${functionValue(hook.setup, new Set(), 1)}.call(vec![definition]); })\n}`).join('\n');
  const moduleSetups = ir.moduleDeclarations.map((declaration) => declaration.id === '@proto.ui/text-control/declaration'
    ? `        text_declaration(&owner, ${declaration.config.lineMode === 'multiline'});`
    : `        image_declaration(&owner, ${staticValue(declaration.config, declaration.span)});`).join('\n');
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
      pub fn set_slot(&mut self, slot: Vec<NativeSnapshot>, cx: &mut Context<Self>) { ensure(&Rc::downgrade(&self.owner)); assert_native_slot_children(&slot); let mut owner = self.owner.borrow_mut(); owner.slot = slot; owner.dirty = true; cx.notify(); }
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
          let snapshot = self.owner.borrow().projection.clone().expect("live native projection");
          self.focus = self.focus.clone().tab_stop(native_tab_participation(&self.owner));
          let element = paint_native_root(&snapshot, &self.owner, &self.focus, format!("compiled-root-{}", Rc::as_ptr(&self.owner) as usize), drive);
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
  if (diagnostics.length) return { ok: false, diagnostics };
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
