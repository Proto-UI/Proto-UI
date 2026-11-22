import { validateIR, validIdentifier } from './ir-validation';
import { pruneDeadValues } from './demand-pruning';
import { createHash } from 'node:crypto';
import { checkTargetOperations, TARGET_PROFILES } from './targets';
import { OPERATION_RULES } from './operations';
import { getSemanticGroupKeyV0 } from '../../core/src/spec/feedback/semantic-merge';
import { buildGpuiNativeStyleFiles } from './gpui-native-style';
import { GPUI_NATIVE_SDK_PATH, gpuiNativeSdkFiles, gpuiNativeSdkIdentity } from './gpui-native-sdk';
import { gpuiComponentCargoManifest } from './gpui-native-manifest';
import type { DataType } from './data-types';
import {
  nativeShape,
  NativeLexicalScope,
  moduleLexicalScope,
  type NativeShape,
} from './template-shape';
import { isDataValueType, isPublicValueType, lexicalStoredType, statementsTerminate } from './ir';
import { inferBinaryType, relationalOperandKind } from './expression-types';
import { valueAlternatives } from './value-types';
import {
  GPUI_MISSING_FOCUS_TREE,
  GPUI_UNAVAILABLE_OPERATIONS,
  gpuiScopeCapabilityDiagnostic,
} from './gpui-capabilities';
import { gpuiLexicalNames, gpuiExpressionChildren } from './gpui-lexical-names';
import { gpuiDataMethods } from './gpui-data-methods';
import { partitionModuleBindings } from './source-module-bindings';
import type { RuleCondition } from './rule-declarations';
import { gpuiTableFamily } from './gpui-native-table';
import { isDeepStrictEqual } from 'node:util';
import type {
  CompileResult,
  CompilerDiagnostic,
  ExpressionIR,
  FunctionIR,
  GeneratedModule,
  PrototypeIR,
  StatementIR,
} from './ir';

/** Ordinary Rust functions, closures and GPUI elements. No serialized IR ships. */
export function emitGpuiSource(
  input: PrototypeIR,
  options: { componentName?: string; nativeSdkPath?: string; gpuiDependency?: 'workspace' } = {}
): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = gpuiLexicalNames(pruneDeadValues(validated.value));
  const admitted = checkTargetOperations(ir, {
    ...TARGET_PROFILES['gpui-source-v1'],
    implemented: true,
    operations: Object.keys(OPERATION_RULES) as (keyof typeof OPERATION_RULES)[],
  });
  if (!admitted.ok) return admitted;
  const admittedAnalysis = admitted.value;
  const componentName = options.componentName ?? 'CompiledComponent';
  if (
    !validIdentifier(componentName) ||
    !/^[A-Z][A-Za-z0-9_]*$/.test(componentName) ||
    ['Self', 'Owner', 'Value', 'GeneratedProps'].includes(componentName)
  )
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI_GPUI_NAME',
          category: 'invalid-input',
          message: 'Choose a non-reserved PascalCase Rust component identifier.',
          span: ir.setup.span,
        },
      ],
    };
  const diagnostics: CompilerDiagnostic[] = [];
  const hasLoneSurrogate = (value: string): boolean =>
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
  const styleTokens = new Map<string, ExpressionIR['span']>();
  const reached = new Set(admittedAnalysis.functions);
  const hookNames = new Map(ir.hooks.map((hook, index) => [hook.id, `authored_hook_${index}`]));
  const supported = new Set([
    'scheduler.delay',
    'delay.cancel',
    'presence.owner',
    'presence.publish',
    'presence.settle',
    'presence.isCurrent',
    'presence.onCompletionRequest',
    'presentation.snapshotCompletion',
    'meta.get',
    'capture.getState',
    'capture.getMethod',
    'capture.getAsHook',
    'capture.getAsHookHandle',
    'run.update',
    'style.tw',
    'rule.declare',
    'rule.dispose',
    'feedback.style.use',
    'feedback.style.release',
    'feedback.style.patch',
    'feedback.style.suppress',
    'feedback.style.clearPatch',
    'props.define',
    'props.setDefaults',
    'props.watch',
    'props.watchAll',
    'props.watchRaw',
    'props.watchRawAll',
    'props.get',
    'props.getRaw',
    'props.isProvided',
    'state.bool',
    'state.string',
    'state.enum',
    'state.numberDiscrete',
    'state.numberRange',
    'state.get',
    'state.set',
    'expose.state',
    'expose.value',
    'expose.method',
    'expose.event',
    'expose.emit',
    'lifecycle.setPresent',
    'lifecycle.onCreated',
    'lifecycle.onMounted',
    'lifecycle.onUpdated',
    'lifecycle.onUnmounted',
    'lifecycle.onBeforeDispose',
    'render.el',
    'render.slot',
    'render.read.props.get',
    'render.read.props.getRaw',
    'render.read.props.isProvided',
    'context.provide',
    'context.subscribe',
    'context.trySubscribe',
    'context.read',
    'context.tryRead',
    'context.update',
    'context.tryUpdate',
    'render.read.context.read',
    'render.read.context.tryRead',
    'hook.asTrigger',
    'hook.asFocusable',
    'hook.asAccessible',
    'hook.asControlLabel',
    'controlLabel.label',
    'controlLabel.target',
    'controlLabel.sync',
    'controlLabelRequest.isCurrent',
    'event.on',
    'event.onGlobal',
    'event.requestDefaultActionPrevention',
    'eventControl.requestDefaultActionPrevention',
    'focus.configure',
    'focus.setDisabled',
    'focus.focusSelf',
    'accessible.state',
    'accessible.action',
    'accessible.role',
    'accessible.nameFromContent',
    'hook.asFocusEntry',
    'hook.asFocusScope',
    'hook.asFocusRoving',
    'hook.asScrollSurface',
    'hook.asTableStructure',
    'hook.asBoundary',
    'hook.asHitParticipation',
    'hook.asCollection',
    'hook.asCollectionItem',
    'focusEntry.configure',
    'focusEntry.focus',
    'focusEntry.setDisabled',
    'focusScope.configure',
    'focusScope.getRoving',
    'focusRoving.configure',
    'focusRoving.focusFirst',
    'focusRoving.focusLast',
    'focusRoving.focusNext',
    'focusRoving.focusPrev',
    'focusRoving.focusSelected',
    'focus.focus',
    'focus.blur',
    'focus.setNavParticipation',
    'focus.setRovingStatus',
    'focus.focusFirst',
    'focus.focusLast',
    'focus.focusNext',
    'focus.focusPrev',
    'focus.focusSelected',
    'focus.restoreFocus',
    'focus.activate',
    'focus.deactivate',
    'focus.setLoop',
    'focus.setOrientation',
    'focus.isActive',
    'focus.isFocused',
    'accessible.id',
    'accessible.name',
    'accessible.description',
    'accessible.relation',
    'accessible.tree',
    'accessible.level',
    'anatomy.claim',
    'anatomy.subscribeParts',
    'anatomy.has',
    'anatomy.parts',
    'anatomy.partsOf',
    'anatomy.order.version',
    'anatomy.order.parts',
    'anatomy.order.partsOf',
    'anatomy.order.indexOfSelf',
    'anatomy.order.prevOfSelf',
    'anatomy.order.nextOfSelf',
    'anatomyPart.hasExpose',
    'anatomyPart.getExpose',
    'anatomyPart.hasHook',
    'tableStructure.configure',
    'tableStructure.getObjectRef',
    'tableStructure.getSnapshot',
    'host.get',
    'state.setDefault',
    'state.watch',
    'boundary.configure',
    'boundary.observe',
    'boundary.setStackActive',
    'boundary.registerRegion',
    'boundary.unregisterRegion',
    'boundary.classify',
    'boundary.notify',
    'boundary.subscribeOutside',
    'hitParticipation.configure',
    'hitParticipation.registerRegion',
    'hitParticipation.unregisterRegion',
    'scroll.configure',
    'scroll.sync',
    'scroll.request',
    'scroll.getSnapshot',
    'collection.configure',
    'collection.getItems',
    'collection.getCount',
    'collectionItem.configure',
    'collectionItem.getSnapshot',
    'hook.asTextControl',
    'textControl.on',
    'textControl.sync',
    'textControl.resetValue',
    'textControl.snapshot',
    'hook.asImageView',
    'imageView.on',
    'imageView.sync',
    'imageView.snapshot',
    'hook.asOverlay',
    'overlay.isOpen',
    'overlay.openOverlay',
    'overlay.close',
    'overlay.toggle',
    'overlay.configure',
    'overlay.updatePosition',
    'overlay.registerTrigger',
    'overlay.registerAnchor',
    'overlay.registerAnchorPart',
    'overlay.registerContent',
    'overlay.getPositionSnapshot',
    'overlay.keepMounted',
    'overlay.bindPresence',
    'positioning.connect',
    'positioning.update',
    'positioning.requestUpdate',
    'positioning.disconnect',
    'positioning.getSnapshot',
    'binding.release',
    'subscription.release',
  ]);
  const exceptionPrototypeMembers: Readonly<Record<string, boolean>> = {
    ['__proto__']: true,
    constructor: true,
    toString: true,
    toLocaleString: true,
    valueOf: true,
    hasOwnProperty: true,
    isPrototypeOf: true,
    propertyIsEnumerable: true,
    __defineGetter__: true,
    __defineSetter__: true,
    __lookupGetter__: true,
    __lookupSetter__: true,
  };
  function inspect(value: unknown, enclosingSpan = ir.setup.span): void {
    if (Array.isArray(value)) {
      value.forEach((item) => inspect(item, enclosingSpan));
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as ExpressionIR;
    // DataType literal nodes share the expression discriminant but have no span.
    // Carry the nearest real IR owner (e.g. the typed parameter), never invent one.
    const span = node.span ?? enclosingSpan;
    if (node.kind === 'function' && !reached.has(node.function)) return;
    if (
      node.kind === 'member' &&
      node.object.type === 'exception' &&
      Object.hasOwn(exceptionPrototypeMembers, node.property)
    )
      diagnostics.push({
        code: 'PUI_GPUI_EXCEPTION_PROPERTY',
        category: 'unsupported-input',
        message:
          'GPUI caught values expose data fields and scalar/list members; JavaScript prototype reflection has no admitted native lowering.',
        span,
      });
    if (node.kind === 'literal' && typeof node.value === 'string' && hasLoneSurrogate(node.value)) {
      diagnostics.push({
        code: 'PUI_GPUI_STRING_UNSUPPORTED',
        category: 'unsupported-input',
        message:
          'GPUI Rust strings cannot represent lone UTF-16 surrogates; no replacement encoding is emitted.',
        span,
      });
    }
    const handles =
      node.kind === 'style-handle'
        ? [node.handle]
        : node.kind === 'rule'
          ? node.declaration.intent.ops.flatMap((operation) => operation.handles)
          : [];
    for (const handle of handles)
      for (const token of handle.tokens) styleTokens.set(token, node.span);
    if (node.kind === 'operation' && GPUI_UNAVAILABLE_OPERATIONS.has(node.operation))
      diagnostics.push({
        code: 'PUI_GPUI_SDK_CAPABILITY',
        category: 'unsupported-input',
        message: `${node.operation} is unavailable in the default GPUI profile. ${GPUI_MISSING_FOCUS_TREE}`,
        span: node.span,
      });
    else if (node.kind === 'operation' && !supported.has(node.operation))
      diagnostics.push({
        code: 'PUI_GPUI_HOST_REQUIRED',
        category: 'unsupported-input',
        message: `GPUI operation ${node.operation} has no concrete pinned host lowering. No success fallback is emitted.`,
        span: node.span,
      });
    if (
      node.kind === 'operation' &&
      ((node.operation === 'controlLabel.label' && node.arguments.length > 0) ||
        (node.operation === 'controlLabel.target' && node.arguments.length > 1))
    )
      diagnostics.push({
        code: 'PUI_GPUI_CONTROL_LABEL_ANATOMY',
        category: 'unsupported-input',
        message:
          'GPUI ControlLabel supports direct typed InstanceAssociations; anatomy-pair descriptors require an explicit host lowering.',
        span: node.span,
      });
    if (
      node.kind === 'operation' &&
      node.operation === 'event.on' &&
      node.arguments[2]?.kind === 'record'
    ) {
      const type = node.arguments[0];
      const phaseMapped =
        type?.kind === 'literal' &&
        ['host:mousedown', 'host:mouseup', 'host:keydown', 'host:keyup'].includes(
          String(type.value)
        );
      for (const entry of node.arguments[2].entries)
        if (
          !phaseMapped &&
          entry.key === 'capture' &&
          entry.value.kind === 'literal' &&
          entry.value.value === true
        )
          diagnostics.push({
            code: 'PUI_GPUI_INPUT_REQUIRED',
            category: 'unsupported-input',
            message: 'This raw host event requires a native capture-phase mapping.',
            span: entry.value.span,
          });
    }
    Object.values(value).forEach((child) => inspect(child, span));
  }
  for (const declaration of ir.moduleDeclarations) {
    if (
      !['@proto.ui/text-control/declaration', '@proto.ui/image-view/declaration'].includes(
        declaration.id
      )
    )
      diagnostics.push({
        code: 'PUI_GPUI_MODULE_REQUIRED',
        category: 'unsupported-input',
        message: `GPUI Module ${declaration.id} has no concrete pinned host consumer.`,
        span: declaration.span,
      });
  }
  admittedAnalysis.functions.forEach((fn) => inspect(fn.body, fn.span));
  const nativeStyle = buildGpuiNativeStyleFiles(styleTokens.keys());
  for (const token of nativeStyle.unknown)
    diagnostics.push({
      code: 'PUI_GPUI_STYLE',
      category: 'unsupported-input',
      message: `The authoritative Proto style producer has no native declarations for ${JSON.stringify(token)}.`,
      span: styleTokens.get(token) ?? ir.setup.span,
    });
  if (diagnostics.length) return { ok: false, diagnostics };
  const local = (name: string) => `v_${Buffer.from(name, 'utf8').toString('hex')}`;
  // Encode original characters, never rewrite escape-like substrings in authored text.
  const string = (value: string, span = ir.setup.span): string => {
    if (hasLoneSurrogate(value)) {
      diagnostics.push({
        code: 'PUI_GPUI_STRING_UNSUPPORTED',
        category: 'unsupported-input',
        message:
          'GPUI Rust strings cannot represent lone UTF-16 surrogates; no replacement encoding is emitted.',
        span,
      });
      // Finish collecting diagnostics, then discard the entire generated module below.
      return '""';
    }
    return (
      '"' +
      Array.from(value, (character) => {
        if (character === '"' || character === '\\') return '\\' + character;
        const point = character.codePointAt(0)!;
        return point < 0x20 || point === 0x7f ? `\\u{${point.toString(16)}}` : character;
      }).join('') +
      '"'
    );
  };
  function staticValue(value: unknown, span = ir.setup.span): string {
    if (value === undefined) return 'Value::Undefined';
    if (Array.isArray(value))
      return `Value::Array(Rc::new(vec![${value.map((item) => staticValue(item, span)).join(', ')}]))`;
    if (value !== null && typeof value === 'object')
      return `record(vec![${Object.entries(value)
        .map(([key, item]) => `(${string(key, span)}, ${staticValue(item, span)})`)
        .join(', ')}])`;
    return literal(value as string | number | boolean | null, span);
  }
  const invalidSharedDeclaration = ir.staticDeclarations.find(
    (declaration) =>
      declaration.id === gpuiTableFamily.id &&
      (declaration.kind !== gpuiTableFamily.kind ||
        !isDeepStrictEqual(declaration.config, gpuiTableFamily.config))
  );
  if (invalidSharedDeclaration)
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI_GPUI_STATIC_ABI',
          category: 'unsupported-input',
          message: 'The shared native Table family must match its declared package ABI.',
          span: invalidSharedDeclaration.span,
        },
      ],
    };
  const staticArtifacts = ir.staticDeclarations.map((declaration) => {
    const digest = createHash('sha256').update(declaration.id).digest('hex').slice(0, 32);
    const name = `declaration_${digest}`;
    const path = `.proto-ui/declaration/${digest}.rs`;
    return {
      id: declaration.id,
      name,
      path,
      kind: 'source' as const,
      contents:
        declaration.id === gpuiTableFamily.id
          ? 'pub use crate::native::gpui_native_owner::TABLE_STRUCTURE_FAMILY as DECLARATION;\n'
          : `// Original static declaration ${JSON.stringify(declaration.id)}\nuse crate::native::gpui_native_owner::*;\nuse std::rc::Rc;\nuse serde_json::Value as Json;\npub static DECLARATION: StaticDeclaration = StaticDeclaration { id: ${string(declaration.id)}, kind: ${string(declaration.kind)}, config: || ${staticValue(declaration.config, declaration.span)} };\n`,
    };
  });
  function literal(value: string | number | boolean | null, span = ir.setup.span): string {
    if (value === null) return 'Value::Json(Json::Null)';
    if (typeof value === 'string') return `Value::string(${string(value, span)})`;
    if (typeof value === 'boolean') return `Value::boolean(${value})`;
    return `Value::number(${Object.is(value, -0) ? '-0.0' : Number.isInteger(value) ? `${value}.0` : String(value)})`;
  }
  const moduleScope = moduleLexicalScope(ir);
  // These operations use identity carried by their explicit receiver or are
  // pure value atoms. They do not close a module function over an instance.
  const ownerlessOperations = new Set([
    'delay.cancel',
    'presentation.snapshotCompletion',
    'capture.getState',
    'capture.getMethod',
    'capture.getAsHook',
    'capture.getAsHookHandle',
    'state.get',
    'state.set',
    'state.setDefault',
    'subscription.release',
    'binding.release',
    'feedback.style.release',
  ]);
  const moduleParts = partitionModuleBindings(
    ir,
    (operation) => !ownerlessOperations.has(operation)
  );
  const moduleBindings = new Map(
    moduleParts.shared.map((binding) => [binding.name, binding.value])
  );
  let templateScope = moduleScope;
  const functionDeclarations = new Map<FunctionIR, NativeLexicalScope>();
  const cellDepths = new Map<ExpressionIR, number>();
  const capturedCells = new Set<ExpressionIR>();
  let lexicalDepth = 0;
  const parameterBindings = new WeakMap<object, { fn: FunctionIR; index: number }>();
  const nativeRecordParameters = new Map<FunctionIR, Set<number>>();
  const nativeRecordReturns = new Set<FunctionIR>();
  const nativeRecordParameter = (fn: FunctionIR, index: number): boolean =>
    nativeRecordParameters.get(fn)?.has(index) ?? false;
  function nativeFunctionParameter(fn: FunctionIR, index: number): boolean {
    const type = fn.parameters[index]?.type;
    // The semantic template/array capabilities use the native child ABI.
    // Portable DataType arrays remain ordinary data, not native factories.
    return type === 'template' || type === 'array';
  }
  function parameterScope(fn: FunctionIR, declaration: NativeLexicalScope): NativeLexicalScope {
    return fn.parameters.reduce((scope, parameter, index) => {
      const local = scope.bind(parameter.name, {
        kind: 'reference',
        name: '\0gpui-parameter-' + parameter.name,
        type: nativeFunctionParameter(fn, index) ? 'template' : parameter.type,
        span: fn.span,
      });
      parameterBindings.set(local.lookup(parameter.name)!, { fn, index });
      return local;
    }, declaration);
  }
  function indexExpression(node: ExpressionIR, scope: NativeLexicalScope): void {
    const capabilityDiagnostic = gpuiScopeCapabilityDiagnostic(node, scope);
    if (capabilityDiagnostic) diagnostics.push(capabilityDiagnostic);
    if (node.kind === 'function') {
      functionDeclarations.set(node.function, scope);
      if (!reached.has(node.function)) return;
      lexicalDepth++;
      const parameters = parameterScope(node.function, scope);
      node.function.parameters.forEach((parameter) => {
        if (parameter.default) indexExpression(parameter.default, parameters);
      });
      indexBody(node.function.body, parameters);
      lexicalDepth--;
    } else if (node.kind === 'reference') {
      const value = scope.lookup(node.name)?.value;
      if (value?.kind === 'lexical-cell' && lexicalDepth > cellDepths.get(value)!)
        capturedCells.add(value);
    } else for (const child of gpuiExpressionChildren(node)) indexExpression(child, scope);
  }
  function indexBody(body: readonly StatementIR[], initial: NativeLexicalScope): void {
    let scope = initial;
    for (const statement of body)
      if (statement.kind === 'const') {
        scope = scope.bind(statement.name, statement.value);
        if (statement.value.kind === 'lexical-cell') cellDepths.set(statement.value, lexicalDepth);
      }
    for (const statement of body) {
      if (statement.kind === 'const') {
        if (statement.value.kind === 'lexical-cell') cellDepths.set(statement.value, lexicalDepth);
        indexExpression(statement.value, scope);
        scope = scope.bind(statement.name, statement.value);
      } else if (statement.kind === 'effect') indexExpression(statement.expression, scope);
      else if (statement.kind === 'return') {
        if (statement.value) indexExpression(statement.value, scope);
      } else if (statement.kind === 'throw') indexExpression(statement.value, scope);
      else if (statement.kind === 'try') {
        indexBody(statement.body, scope);
        if (statement.catch)
          indexBody(
            statement.catch.body,
            statement.catch.name
              ? scope.parameter(statement.catch.name, undefined, scope, null)
              : scope
          );
        if (statement.finally) indexBody(statement.finally, scope);
      } else {
        indexExpression(statement.condition, scope);
        indexBody(statement.then, scope);
        indexBody(statement.otherwise, scope);
      }
    }
  }
  indexBody(ir.moduleBindings ?? [], NativeLexicalScope.empty());
  functionDeclarations.set(ir.setup, moduleScope);
  indexBody(ir.setup.body, parameterScope(ir.setup, moduleScope));
  // Authored-hook functions have their own lexical entry rather than inheriting
  // a caller's same-spelled locals. The canonical admitted function objects are reused.
  for (const fn of admittedAnalysis.functions) {
    if (!functionDeclarations.has(fn)) {
      functionDeclarations.set(fn, moduleScope);
      indexBody(fn.body, parameterScope(fn, moduleScope));
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
  const functionResults = new Map<
    FunctionIR,
    { value?: ExpressionIR; scope: NativeLexicalScope }[]
  >();
  function returnedValues(fn: FunctionIR): { value?: ExpressionIR; scope: NativeLexicalScope }[] {
    const known = functionResults.get(fn);
    if (known) return known;
    const results: { value?: ExpressionIR; scope: NativeLexicalScope }[] = [];
    function collect(body: readonly StatementIR[], initial: NativeLexicalScope): boolean {
      let scope = initial;
      for (const statement of body) {
        if (statement.kind === 'const') scope = scope.bind(statement.name, statement.value);
        else if (statement.kind === 'return') {
          results.push({ value: statement.value, scope });
          return true;
        } else if (statement.kind === 'throw') return true;
        else if (statement.kind === 'if') {
          const then = collect(statement.then, scope),
            otherwise = collect(statement.otherwise, scope);
          if (then && otherwise) return true;
        } else if (statement.kind === 'try') {
          const start = results.length;
          const tried = collect(statement.body, scope);
          const caught = statement.catch
            ? collect(
                statement.catch.body,
                statement.catch.name
                  ? scope.parameter(statement.catch.name, undefined, scope, null)
                  : scope
              )
            : true;
          const end = results.length;
          const finalized = statement.finally ? collect(statement.finally, scope) : false;
          if (finalized) results.splice(start, end - start);
          if (finalized || (tried && caught)) return true;
        }
      }
      return false;
    }
    collect(fn.body, parameterScope(fn, functionDeclarations.get(fn) ?? moduleScope));
    functionResults.set(fn, results);
    return results;
  }
  function shapeHasNative(shape: NativeShape | null): boolean {
    return (
      !!shape &&
      (shape.kind === 'node' ||
        shape.kind === 'legacy-template' ||
        ((shape.kind === 'array' || shape.kind === 'union') && shape.items.some(shapeHasNative)))
    );
  }
  function snapshotAbi(
    node: ExpressionIR,
    scope = templateScope,
    seen = new Set<object>()
  ): boolean {
    if (node.kind === 'narrow') return snapshotAbi(node.value, scope, seen);
    if (node.kind === 'conditional')
      return snapshotAbi(node.then, scope, seen) || snapshotAbi(node.otherwise, scope, seen);
    if (node.kind === 'call') {
      const fn = functionTarget(node.callee, scope);
      return !!fn && returnsNative(fn);
    }
    if (node.kind === 'operation')
      return node.operation === 'render.el' || node.operation === 'render.slot';
    if (node.kind === 'helper-call') {
      const fn = helperFunction(node.name, scope);
      return !!fn && returnsNative(fn);
    }
    if (node.kind === 'reference') {
      const binding = scope.lookup(node.name);
      if (binding?.value && !seen.has(binding)) {
        const next = new Set(seen);
        next.add(binding);
        return snapshotAbi(binding.value, binding.environment, next);
      }
      return node.type === 'template' || node.type === 'array';
    }
    if (node.kind === 'array') return node.elements.some((item) => snapshotAbi(item, scope, seen));
    if (node.kind === 'binary' && ['&&', '||', '??'].includes(node.operator))
      return snapshotAbi(node.left, scope, seen) || snapshotAbi(node.right, scope, seen);
    // Canonical template facts stay owned by the shared lexical analyzer. This
    // predicate chooses a Rust ABI; it is not an emitted template representation.
    return shapeHasNative(nativeShape(node, scope));
  }
  function returnsNative(fn: FunctionIR): boolean {
    const mayCarryNative = (type: ExpressionIR['type']): boolean =>
      typeof type === 'string'
        ? ['template', 'array', 'record', 'unknown'].includes(type)
        : type.kind === 'object'
          ? type.fields.some((field) => mayCarryNative(field.type)) ||
            (!!type.index && mayCarryNative(type.index))
          : type.kind === 'value-union'
            ? type.members.some(mayCarryNative)
            : false;
    if (!mayCarryNative(fn.returnType)) return false;
    const previous = nativeReturns.get(fn);
    if (previous !== undefined) return previous;
    if (activeNativeReturns.has(fn))
      throw new Error('Recursive helper escaped checked GPUI ABI admission.');
    activeNativeReturns.add(fn);
    try {
      const result =
        fn !== ir.setup &&
        returnedValues(fn).some(({ value, scope }) => !!value && snapshotAbi(value, scope));
      nativeReturns.set(fn, result);
      return result;
    } finally {
      activeNativeReturns.delete(fn);
    }
  }
  function typedFunction(fn: FunctionIR): boolean {
    return (
      fn !== ir.setup &&
      (returnsNative(fn) ||
        nativeRecordReturns.has(fn) ||
        fn.parameters.some(
          (_, index) => nativeFunctionParameter(fn, index) || nativeRecordParameter(fn, index)
        ))
    );
  }
  let nativeIndex = 0;
  const freshNative = (): string => `pui_native_${nativeIndex++}`;
  function snapshotExpression(
    node: ExpressionIR,
    environment: ReadonlySet<string>,
    depth: number
  ): string {
    const value = expression(node, environment, depth);
    if (recordAbi(node)) return `(${value}).into_invalid_snapshot()`;
    return snapshotAbi(node)
      ? value
      : snapshotData(nativeShape(node, templateScope) ?? { kind: 'invalid' }, value);
  }

  // A record with native fields is a real finite Rust aggregate, not a Value
  // payload or an interpreted template. Its admitted observations are identity,
  // truthiness and lexical ownership; module-config member access is not admitted.
  function recordAbi(node: ExpressionIR, scope = templateScope, seen = new Set<object>()): boolean {
    if (node.kind === 'narrow') return recordAbi(node.value, scope, seen);
    if (node.kind === 'conditional')
      return recordAbi(node.then, scope, seen) || recordAbi(node.otherwise, scope, seen);
    if (node.kind === 'call') {
      const fn = functionTarget(node.callee, scope);
      return !!fn && nativeRecordReturns.has(fn);
    }
    if (node.kind === 'reference') {
      const binding = scope.lookup(node.name);
      if (!binding || seen.has(binding)) return false;
      const parameter = parameterBindings.get(binding);
      if (parameter && nativeRecordParameter(parameter.fn, parameter.index)) return true;
      const next = new Set(seen);
      next.add(binding);
      return !!binding.value && recordAbi(binding.value, binding.environment, next);
    }
    if (node.kind === 'record')
      return node.entries.some(
        (entry) => snapshotAbi(entry.value, scope) || recordAbi(entry.value, scope, seen)
      );
    if (node.kind === 'helper-call') {
      const fn = helperFunction(node.name, scope);
      return !!fn && nativeRecordReturns.has(fn);
    }
    if (node.kind === 'binary' && ['&&', '||', '??'].includes(node.operator))
      return recordAbi(node.left, scope, seen) || recordAbi(node.right, scope, seen);
    return false;
  }
  // Parameter/return facts are monotone and settle before any source emission.
  // A helper called with native and ordinary configurations gets one finite sum
  // ABI, independent of which call is visited first or its lifecycle context.
  function settleRecordAbis(): void {
    let changed: boolean;
    do {
      changed = false;
      function inspect(node: ExpressionIR, scope: NativeLexicalScope): void {
        if (node.kind === 'helper-call' || node.kind === 'call') {
          const fn =
            node.kind === 'helper-call'
              ? helperFunction(node.name, scope)
              : functionTarget(node.callee, scope);
          if (node.kind === 'call') inspect(node.callee, scope);
          node.arguments.forEach((argument, index) => {
            inspect(argument, scope);
            if (fn && recordAbi(argument, scope) && !nativeRecordParameter(fn, index)) {
              const parameters = nativeRecordParameters.get(fn) ?? new Set<number>();
              parameters.add(index);
              nativeRecordParameters.set(fn, parameters);
              changed = true;
            }
          });
        } else if (node.kind === 'operation') {
          if (node.receiver) inspect(node.receiver, scope);
          node.arguments.forEach((argument) => inspect(argument, scope));
        } else if (node.kind === 'array') node.elements.forEach((item) => inspect(item, scope));
        else if (node.kind === 'record')
          node.entries.forEach((entry) => inspect(entry.value, scope));
        else if (node.kind === 'binary') {
          inspect(node.left, scope);
          inspect(node.right, scope);
        } else if (node.kind === 'lexical-cell') inspect(node.value, scope);
        else if (node.kind === 'lexical-read' || node.kind === 'lexical-update')
          inspect(node.cell, scope);
        else if (node.kind === 'lexical-write') {
          inspect(node.cell, scope);
          inspect(node.value, scope);
        } else if (node.kind === 'unary') inspect(node.operand, scope);
        else if (node.kind === 'member') inspect(node.object, scope);
        else if (node.kind === 'rule') {
          inspect(node.receiver, scope);
          node.states.forEach((state) => inspect(state.value, scope));
        } else for (const child of gpuiExpressionChildren(node)) inspect(child, scope);
        // Nested functions are separately visited in their own declaration frame.
      }
      function body(
        fn: FunctionIR,
        statements: readonly StatementIR[],
        initial: NativeLexicalScope
      ): void {
        let scope = initial;
        for (const statement of statements) {
          if (statement.kind === 'const') {
            inspect(statement.value, scope);
            scope = scope.bind(statement.name, statement.value);
          } else if (statement.kind === 'effect') inspect(statement.expression, scope);
          else if (statement.kind === 'return') {
            if (statement.value) {
              inspect(statement.value, scope);
            }
          } else if (statement.kind === 'throw') inspect(statement.value, scope);
          else if (statement.kind === 'try') {
            body(fn, statement.body, scope);
            if (statement.catch)
              body(
                fn,
                statement.catch.body,
                statement.catch.name
                  ? scope.parameter(statement.catch.name, undefined, scope, null)
                  : scope
              );
            if (statement.finally) body(fn, statement.finally, scope);
          } else {
            inspect(statement.condition, scope);
            body(fn, statement.then, scope);
            body(fn, statement.otherwise, scope);
          }
        }
      }
      for (const fn of admittedAnalysis.functions) {
        body(
          fn,
          fn.body,
          parameterScope(fn, functionDeclarations.get(fn) ?? NativeLexicalScope.empty())
        );
        if (
          !nativeRecordReturns.has(fn) &&
          returnedValues(fn).some(({ value, scope }) => !!value && recordAbi(value, scope))
        ) {
          nativeRecordReturns.add(fn);
          changed = true;
        }
      }
    } while (changed);
  }
  settleRecordAbis();
  const nativeRecordLayouts = new Map<ExpressionIR, { index: number; fields: string[] }>();
  function recordExpression(
    node: ExpressionIR,
    environment: ReadonlySet<string>,
    depth: number
  ): string {
    const value = expression(node, environment, depth);
    return recordAbi(node) ? value : `__PuiNativeRecordValue::Ordinary(${value})`;
  }
  function nativeRecordLiteral(
    node: Extract<ExpressionIR, { kind: 'record' }>,
    environment: ReadonlySet<string>,
    depth: number
  ): string {
    const fields = node.entries.map((entry) =>
      snapshotAbi(entry.value)
        ? 'native::gpui_native_owner::NativeSnapshot'
        : recordAbi(entry.value)
          ? '__PuiNativeRecordValue'
          : 'Value'
    );
    let layout = nativeRecordLayouts.get(node);
    if (!layout) {
      layout = { index: nativeRecordLayouts.size, fields };
      nativeRecordLayouts.set(node, layout);
    } else if (layout.fields.some((field, index) => field !== fields[index])) {
      throw new Error(
        'One checked native record literal acquired inconsistent lexical Rust layouts.'
      );
    }
    const values = node.entries.map((entry) => ({
      name: freshNative(),
      code: callableType(entry.value.type)
        ? callableValue(entry.value, environment, depth)
        : expression(entry.value, environment, depth),
    }));
    const construction = `__PuiNativeRecordValue::Literal${layout.index}(Rc::new(__PuiNativeRecord${layout.index} { identity:Rc::new(()), ${values.map((value, index) => `_field_${index}:${value.name}`).join(', ')} }))`;
    // A shared helper's carrier can contain a completely ordinary record at a
    // particular call. Normalize that case once, at literal construction, so
    // crossing a host boundary never reconstructs or changes record identity.
    // These are finite compiler-known field projections, not a field/tag decoder.
    const ordinaryNames = values.map(() => freshNative());
    const projections = values.map((value, index) =>
      fields[index] === 'Value'
        ? `Some(${value.name}.clone())`
        : fields[index] === '__PuiNativeRecordValue'
          ? `${value.name}.ordinary_value()`
          : 'None::<Value>'
    );
    const ordinary = `record(vec![${node.entries.map((entry, index) => `(${string(entry.key, node.span)}, ${ordinaryNames[index]})`).join(', ')}])`;
    const normalized = `match (${projections.join(', ')},) { (${ordinaryNames.map((name) => `Some(${name})`).join(', ')},) => __PuiNativeRecordValue::Ordinary(${ordinary}), _ => ${construction} }`;
    return `{ ${values.map((value) => `let ${value.name} = ${value.code};`).join(' ')} ${normalized} }`;
  }
  function nativeRecordTypes(): string {
    if (!nativeRecordLayouts.size && !nativeRecordReturns.size && !nativeRecordParameters.size)
      return '';
    const layouts = [...nativeRecordLayouts.values()];
    return `${layouts.map((layout) => `struct __PuiNativeRecord${layout.index} { identity:Rc<()>, ${layout.fields.map((field, index) => `_field_${index}:${field}`).join(', ')} }`).join('\n')}
#[derive(Clone)]
enum __PuiNativeRecordValue { Ordinary(Value), ${layouts.map((layout) => `Literal${layout.index}(Rc<__PuiNativeRecord${layout.index}>)`).join(', ')} }
impl __PuiNativeRecordValue {
    fn identity(&self)->Option<&Rc<()>> { match self { Self::Ordinary(_)=>None, ${layouts.map((layout) => `Self::Literal${layout.index}(value)=>Some(&value.identity)`).join(', ')} } }
    fn truthy(&self)->bool { match self { Self::Ordinary(value)=>value.truthy(), _=>true } }
    fn nullish(&self)->bool { match self { Self::Ordinary(value)=>value.nullish(), _=>false } }
    fn equals(&self,other:&Self)->bool { match (self,other) { (Self::Ordinary(a),Self::Ordinary(b))=>strict_equal(a,b), _=>match(self.identity(),other.identity()){(Some(a),Some(b))=>Rc::ptr_eq(a,b),_=>false} } }
    fn equals_value(&self,other:&Value)->bool { matches!(self,Self::Ordinary(value) if strict_equal(value,other)) }
    fn ordinary_value(&self)->Option<Value> { match self { Self::Ordinary(value)=>Some(value.clone()), _=>None } }
    fn into_ordinary(self)->Value { match self { Self::Ordinary(value)=>value, _=>panic!("a native aggregate is not an ordinary host configuration") } }
    fn into_invalid_snapshot(self)->native::gpui_native_owner::NativeSnapshot {
        if let Self::Ordinary(value)=self { return native::gpui_native_owner::NativeSnapshot::invalid(value); }
        let identity=self.identity().expect("native aggregate identity").clone();
        // An invalid render result still owns every evaluated native field. It
        // cannot be painted or boxed back into the generic Value representation.
        native::gpui_native_owner::NativeSnapshot { identity, observation:None,valid:false,slot_count:0,passive_content:false,
            frame:Rc::new(move|_,_,_,_,_,_|{let _retained=&self;Vec::new()}),
            text:Rc::new(|_|String::new()) }
    }
}`;
  }

  function snapshotData(shape: NativeShape, value: string): string {
    if (shape.kind === 'legacy-template')
      throw new Error(
        'Legacy template annotation requires lexical provenance before native snapshot emission.'
      );
    if (shape.kind === 'node')
      throw new Error('Native node requires the typed native ABI, not Value coercion.');
    if (shape.kind === 'text')
      return `native::gpui_native_owner::NativeSnapshot::text_value(${value})`;
    if (shape.kind === 'null')
      return `{ let _ = ${value}; native::gpui_native_owner::NativeSnapshot::empty() }`;
    if (shape.kind === 'invalid' || shape.kind === 'undefined')
      return `native::gpui_native_owner::NativeSnapshot::invalid(${value})`;
    if (shape.kind === 'array') {
      const array = freshNative(),
        item = freshNative();
      return `{ let ${array} = ${value}; native::gpui_native_owner::NativeSnapshot::sequence(${array}.items().into_iter().map(|${item}| ${snapshotData({ kind: 'union', items: shape.items }, item)}).collect(), Some(${array})) }`;
    }
    if (shape.kind !== 'union')
      throw new Error('Unknown native data shape reached snapshot conversion.');
    const alternatives: NativeShape[] = [];
    const flatten = (item: NativeShape): void => {
      if (item.kind === 'union') item.items.forEach(flatten);
      else alternatives.push(item);
    };
    shape.items.forEach(flatten);
    const current = freshNative(),
      cases: string[] = [];
    if (alternatives.some((item) => item.kind === 'legacy-template'))
      throw new Error(
        'Legacy template union requires lexical provenance before native snapshot emission.'
      );
    if (alternatives.some((item) => item.kind === 'node'))
      throw new Error('A mixed native return must use its native function ABI.');
    if (alternatives.some((item) => item.kind === 'null'))
      cases.push(
        `if matches!(&${current}, Value::Json(Json::Null)) { native::gpui_native_owner::NativeSnapshot::empty() }`
      );
    if (alternatives.some((item) => item.kind === 'text'))
      cases.push(
        `if matches!(&${current}, Value::Number(_)|Value::Json(Json::String(_)|Json::Number(_))) { native::gpui_native_owner::NativeSnapshot::text_value(${current}) }`
      );
    const arrays = alternatives.filter(
      (item): item is Extract<NativeShape, { kind: 'array' }> => item.kind === 'array'
    );
    if (arrays.length)
      cases.push(
        `if matches!(&${current},Value::Array(_)|Value::Json(Json::Array(_))) { ${snapshotData({ kind: 'array', items: arrays.flatMap((item) => item.items) }, current)} }`
      );
    return `{ let ${current} = ${value}; ${cases.length ? cases.join(' else ') + ' else ' : ''}{ native::gpui_native_owner::NativeSnapshot::invalid(${current}) } }`;
  }

  function nativeElement(
    node: Extract<ExpressionIR, { kind: 'operation' }>,
    environment: ReadonlySet<string>,
    depth: number
  ): string {
    const [tag, second, third] = node.arguments;
    const props =
      second &&
      (second.type === 'template-props' ||
        (typeof second.type === 'object' &&
          second.type.kind === 'record' &&
          second.type.fields.length === 0));
    const tagName = freshNative(),
      propsName = freshNative(),
      childrenName = freshNative(),
      stylesName = freshNative();
    const child = node.arguments.length === 3 ? third : props ? undefined : second;
    const tagCode = tag ? expression(tag, environment, depth) : 'Value::Undefined';
    const propsCode = props && second ? expression(second, environment, depth) : 'Value::Undefined';
    const childCode = child
      ? snapshotExpression(child, environment, depth)
      : 'native::gpui_native_owner::NativeSnapshot::empty()';
    return `{ let ${tagName} = ${tagCode}; let _ = ${tagName}; let ${propsName} = ${propsCode}; let ${childrenName} = ${childCode};
      let ${stylesName} = if ${propsName}.nullish() { Vec::new() } else { let style = ${propsName}.member("style",false); if style.nullish(){Vec::new()}else{style_items(vec![style])} };
      let frame_children = ${childrenName}.clone(); let text_children = ${childrenName}.clone();
      native::gpui_native_owner::NativeSnapshot { identity:Rc::new(()),observation:None,valid:${childrenName}.valid,slot_count:${childrenName}.slot_count,passive_content:${childrenName}.passive_content,
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

  function functionTarget(node: ExpressionIR, scope = templateScope): FunctionIR | undefined {
    if (node.kind === 'narrow') return functionTarget(node.value, scope);
    if (node.kind === 'function') return node.function;
    if (node.kind === 'reference') return helperFunction(node.name, scope);
    return undefined;
  }
  function nativeCallable(node: ExpressionIR): FunctionIR | undefined {
    const fn = functionTarget(node);
    return fn && typedFunction(fn) ? fn : undefined;
  }
  // Follow callable provenance only. Template-result facts remain owned by
  // nativeShape; no source is evaluated and no plan is emitted to the consumer.
  function callableTargets(
    value: ExpressionIR,
    environment: NativeLexicalScope
  ): { fn: FunctionIR; environment: NativeLexicalScope }[] {
    const active = new Set<ExpressionIR>();
    const parameterFacts = new WeakMap<
      object,
      { fn: FunctionIR; environment: NativeLexicalScope }[]
    >();
    function resolve(
      node: ExpressionIR,
      scope: NativeLexicalScope
    ): { fn: FunctionIR; environment: NativeLexicalScope }[] {
      if (node.kind === 'function') return [{ fn: node.function, environment: scope }];
      if (node.kind === 'narrow') return resolve(node.value, scope);
      // An authored capture is nominal provenance, not a structural record.
      // Its render member is the setup result captured by that exact hook.
      // Preserve scalar/null render callbacks at the native renderer boundary
      // without converting arbitrary records or guessing a component identity.
      if (node.kind === 'member' && node.property === 'render') {
        const captures = valueAlternatives(node.object.type).filter(
          (type): type is Extract<ExpressionIR['type'], { kind: 'capture' }> =>
            typeof type !== 'string' && type.kind === 'capture'
        );
        if (captures.length) {
          if (active.has(node)) return [];
          active.add(node);
          try {
            return captures.flatMap((capture) => {
              const hook = ir.hooks.find((hook) => hook.id === capture.hookId);
              return hook
                ? returnedValues(hook.setup).flatMap((result) =>
                    result.value ? resolve(result.value, result.scope) : []
                  )
                : [];
            });
          } finally {
            active.delete(node);
          }
        }
      }
      if (node.kind === 'conditional')
        return [...resolve(node.then, scope), ...resolve(node.otherwise, scope)];
      if (node.kind === 'reference') {
        const binding = scope.lookup(node.name);
        return binding && parameterFacts.has(binding)
          ? parameterFacts.get(binding)!
          : binding?.value
            ? resolve(binding.value, binding.environment)
            : [];
      }
      if (node.kind !== 'helper-call' && node.kind !== 'call') return [];
      const binding = node.kind === 'helper-call' ? scope.lookup(node.name) : undefined;
      const functions =
        node.kind === 'call'
          ? resolve(node.callee, scope)
          : binding?.value
            ? resolve(binding.value, binding.environment)
            : [];
      // Analyze caller arguments before entering the callee. Finite repeated
      // wrapper(wrapper(draw)) may revisit one body call expression through a
      // different actual argument; it is not recursive authored execution.
      const arguments_ = node.arguments.map((argument) =>
        callableType(argument.type) ? resolve(argument, scope) : undefined
      );
      if (active.has(node)) return [];
      active.add(node);
      try {
        const found: { fn: FunctionIR; environment: NativeLexicalScope }[] = [];
        for (const target of functions) {
          let local = target.environment;
          target.fn.parameters.forEach((parameter, index) => {
            local = local.parameter(
              parameter.name,
              node.arguments[index],
              scope,
              node.arguments[index]
                ? nativeShape(node.arguments[index], scope)
                : { kind: 'undefined' }
            );
            if (callableType(parameter.type))
              parameterFacts.set(local.lookup(parameter.name)!, arguments_[index] ?? []);
          });
          function returns(body: readonly StatementIR[], initial: NativeLexicalScope): boolean {
            let current = initial;
            for (const statement of body) {
              if (statement.kind === 'const')
                current = current.bind(statement.name, statement.value);
              else if (statement.kind === 'return') {
                if (statement.value) found.push(...resolve(statement.value, current));
                return true;
              } else if (statement.kind === 'throw') return true;
              else if (statement.kind === 'try') {
                const start = found.length;
                const tried = returns(statement.body, current);
                const caught = statement.catch
                  ? returns(
                      statement.catch.body,
                      statement.catch.name
                        ? current.parameter(statement.catch.name, undefined, current, null)
                        : current
                    )
                  : true;
                const end = found.length;
                const finalized = statement.finally ? returns(statement.finally, current) : false;
                if (finalized) found.splice(start, end - start);
                if (finalized || (tried && caught)) return true;
              } else if (statement.kind === 'if') {
                const then = returns(statement.then, current),
                  otherwise = returns(statement.otherwise, current);
                if (then && otherwise) return true;
              }
            }
            return false;
          }
          returns(target.fn.body, local);
        }
        return found;
      } finally {
        active.delete(node);
      }
    }
    return resolve(value, environment);
  }
  function callableResultShape(fn: FunctionIR, declaration: NativeLexicalScope): NativeShape {
    const name = '\0gpui-render-entry';
    const bindings = declaration.bind(name, {
      kind: 'function',
      function: fn,
      type: 'function',
      span: fn.span,
    });
    const arguments_ = fn.parameters.map(
      (parameter) =>
        ({
          kind: 'reference',
          name: '\0entry-' + parameter.name,
          type: parameter.type,
          span: fn.span,
        }) as ExpressionIR
    );
    // Non-child capabilities/function values remain invalid children. This does
    // not turn an unknown template provenance into a runtime tree conversion.
    return (
      nativeShape(
        { kind: 'helper-call', name, arguments: arguments_, type: fn.returnType, span: fn.span },
        bindings
      ) ?? { kind: 'invalid' }
    );
  }
  function callableValue(
    node: ExpressionIR,
    environment: ReadonlySet<string>,
    depth: number
  ): string {
    const fn = nativeCallable(node);
    if (!fn) return expression(node, environment, depth);
    const name = freshNative(),
      value = expression(node, environment, depth);
    const args = fn.parameters
      .map((_, index) =>
        nativeFunctionParameter(fn, index)
          ? `native::gpui_native_owner::NativeSnapshot::invalid(arg(&arguments,${index}))`
          : nativeRecordParameter(fn, index)
            ? `__PuiNativeRecordValue::Ordinary(arg(&arguments,${index}))`
            : `arg(&arguments,${index})`
      )
      .join(', ');
    const called = `(${name}.call)(${args})`;
    const result = returnsNative(fn)
      ? called
      : nativeRecordReturns.has(fn)
        ? `(${called}).into_invalid_snapshot()`
        : snapshotData(
            callableResultShape(fn, functionDeclarations.get(fn) ?? templateScope),
            called
          );
    return `{ let ${name}=${value}; Value::NativeFunction{identity:${name}.identity.clone(),render:Rc::new(move |arguments:Vec<Value>| {${result}})} }`;
  }
  function rendererEntry(
    node: ExpressionIR,
    environment: ReadonlySet<string>,
    depth: number
  ): string {
    const value = callableValue(node, environment, depth);
    const functions = callableTargets(node, templateScope);
    const scalarShapes = functions
      .filter((target) => !typedFunction(target.fn))
      .map((target) => callableResultShape(target.fn, target.environment));
    const result = scalarShapes.length
      ? snapshotData({ kind: 'union', items: scalarShapes }, 'callback(arguments)')
      : 'panic!("checked native renderer entry has no scalar callback alternative")';
    // Capture the evaluated callable once. Only projection invokes it; native
    // repaint never re-runs a factory or reconstructs a lexical environment.
    return `{ let callable=${value}; match callable {
      Value::NativeFunction{render,..} => Value::Renderer(render),
      Value::Renderer(render) => Value::Renderer(render),
      ${valueAlternatives(node.type).includes('void') ? 'Value::Undefined => Value::Undefined,' : ''}
      Value::Function(callback) => Value::Renderer(Rc::new(move |arguments:Vec<Value>| { ${result} })),
      _ => panic!("checked setup result must be a callable")
    } }`;
  }

  const capturedBindings = new Set(
    admittedAnalysis.functions
      .flatMap((fn) => (fn.captures ?? []).map((capture) => capture.name))
      .filter((name) => !moduleBindings.has(name))
  );
  const callableType = (type: ExpressionIR['type']): boolean =>
    type === 'function' ||
    (typeof type !== 'string' &&
      (type.kind === 'callable' ||
        (type.kind === 'value-union' && type.members.some(callableType))));
  function valueRustType(value: ExpressionIR): string {
    if (value.kind === 'lexical-cell' || lexicalStoredType(value.type))
      return 'Rc<std::cell::RefCell<Value>>';
    if (value.kind === 'function' && typedFunction(value.function)) {
      const fn = value.function;
      return `native::gpui_native_owner::NativeCallable<dyn Fn(${fn.parameters.map((_, index) => parameterRustType(fn, index)).join(', ')}) -> ${functionRustResult(fn)}>`;
    }
    if (snapshotAbi(value)) return 'native::gpui_native_owner::NativeSnapshot';
    if (recordAbi(value)) return '__PuiNativeRecordValue';
    return 'Value';
  }
  function parameterRustType(fn: FunctionIR, index: number): string {
    return nativeFunctionParameter(fn, index)
      ? 'native::gpui_native_owner::NativeSnapshot'
      : nativeRecordParameter(fn, index)
        ? '__PuiNativeRecordValue'
        : 'Value';
  }
  function functionRustResult(fn: FunctionIR): string {
    return returnsNative(fn)
      ? 'native::gpui_native_owner::NativeSnapshot'
      : nativeRecordReturns.has(fn)
        ? '__PuiNativeRecordValue'
        : 'Value';
  }
  let uses = { names: new Set<string>(), owner: false };
  let emitsExceptions = false;
  function ownerReference(): string {
    uses.owner = true;
    return 'owner';
  }
  function functionValue(fn: FunctionIR, environment: ReadonlySet<string>, depth: number): string {
    if (!reached.has(fn)) {
      // The allocation can remain observable even when a closed callable-flow
      // proof excludes invocation. Keep its ordinary identity and native ABI;
      // defaults, captures and body operations are evaluated only on a call.
      const guard = 'panic!("compiler-proven uninvoked callable was invoked")';
      if (typedFunction(fn)) {
        const parameters = fn.parameters.map((_, index) => parameterRustType(fn, index));
        const result = functionRustResult(fn);
        return `{ let call:Rc<dyn Fn(${parameters.join(', ')})->${result}>=Rc::new(move |${parameters.map((type, index) => `_argument_${index}: ${type}`).join(', ')}| -> ${result} { ${guard} }); native::gpui_native_owner::NativeCallable { identity:Rc::new(()), call } }`;
      }
      return `Value::${returnsNative(fn) ? 'Renderer' : 'Function'}(Rc::new(move |_:Vec<Value>| { ${guard} }))`;
    }
    const indent = '    '.repeat(depth);
    const scope = new Set(environment);
    const parameterNames = new Set(fn.parameters.map((parameter) => parameter.name));
    parameterNames.forEach((name) => scope.add(name));
    const parentUses = uses;
    uses = { names: new Set<string>(), owner: false };
    const nativeReturn = returnsNative(fn),
      recordReturn = nativeRecordReturns.has(fn),
      typed = typedFunction(fn);
    const savedTemplateScope = templateScope;
    templateScope = parameterScope(fn, functionDeclarations.get(fn) ?? templateScope);
    let parameterSlots = '',
      parameters = '';
    for (const [index, parameter] of fn.parameters.entries()) {
      const type = typed ? parameterRustType(fn, index) : 'Value';
      const variable = local(parameter.name),
        incoming = typed ? `argument_${index}` : `arg(&arguments, ${index})`;
      if (capturedBindings.has(parameter.name))
        parameterSlots += `${indent}    let ${variable}: LexicalBinding<${type}> = lexical_binding();\n`;
      let value = incoming;
      if (parameter.default) {
        const fallback =
          typed && nativeFunctionParameter(fn, index)
            ? snapshotExpression(parameter.default, scope, depth + 1)
            : typed && nativeRecordParameter(fn, index)
              ? recordExpression(parameter.default, scope, depth + 1)
              : expression(parameter.default, scope, depth + 1);
        const absent =
          type === 'native::gpui_native_owner::NativeSnapshot'
            ? 'matches!(&argument.observation, Some(Value::Undefined))'
            : type === '__PuiNativeRecordValue'
              ? 'matches!(&argument, __PuiNativeRecordValue::Ordinary(Value::Undefined))'
              : 'matches!(&argument, Value::Undefined)';
        value = `{ let argument = ${incoming}; if ${absent} { ${fallback} } else { argument } }`;
      }
      parameters += capturedBindings.has(parameter.name)
        ? `${indent}    ${variable}.initialize(${value});\n`
        : `${indent}    let ${variable}: ${type} = ${value};\n`;
    }
    const moduleBody =
      fn.context === 'setup' ? statements(moduleParts.owned, scope, depth + 1, false) : '';
    if (fn.context === 'setup') moduleParts.owned.forEach((binding) => scope.add(binding.name));
    const body = statements(
      fn.body,
      scope,
      depth + 1,
      true,
      nativeReturn,
      fn === ir.setup,
      recordReturn
    );
    templateScope = savedTemplateScope;
    const functionUses = uses;
    uses = parentUses;
    const captures = [...environment]
      .filter(
        (name) =>
          functionUses.names.has(name) && !parameterNames.has(name) && !moduleBindings.has(name)
      )
      .map((name) => {
        uses.names.add(name);
        return `let ${local(name)} = ${local(name)}.clone();`;
      })
      .join(' ');
    const owner = functionUses.owner ? `let owner = ${ownerReference()}.clone();` : '';
    if (typed) {
      const signature = fn.parameters
        .map((_, index) => `argument_${index}: ${parameterRustType(fn, index)}`)
        .join(', ');
      const parameterTypes = fn.parameters
        .map((_, index) => parameterRustType(fn, index))
        .join(', ');
      const resultType = functionRustResult(fn);
      return `{ ${owner} ${captures} let call:Rc<dyn Fn(${parameterTypes})->${resultType}>=Rc::new(move |${signature}| -> ${resultType} {\n${parameterSlots}${parameters}${moduleBody}${body}${indent}}); native::gpui_native_owner::NativeCallable { identity:Rc::new(()), call } }`;
    }
    return `{ ${owner} ${captures} Value::${nativeReturn ? 'Renderer' : 'Function'}(Rc::new(move |${fn.parameters.length ? 'arguments' : '_'}: Vec<Value>| {\n${parameterSlots}${parameters}${moduleBody}${body}${indent}})) }`;
  }
  function expression(
    node: ExpressionIR,
    environment: ReadonlySet<string>,
    depth: number,
    bindReceiver = true
  ): string {
    if (
      node.kind === 'call' &&
      !node.optional &&
      node.callee.kind === 'reference' &&
      functionTarget(node.callee)
    ) {
      // A proven immutable lexical callable has the same direct native ABI as
      // the historical named-call node. Cells and computed callees keep the
      // ordinary evaluate-once Value call path below.
      return expression(
        {
          kind: 'helper-call',
          name: node.callee.name,
          arguments: node.arguments,
          type: node.type,
          span: node.span,
        },
        environment,
        depth
      );
    }
    if (bindReceiver && node.kind === 'operation' && node.receiver) {
      const name = freshNative(),
        variable = local(name);
      const receiverValue = expression(node.receiver, environment, depth);
      const inner = expression(
        {
          ...node,
          optional: false,
          receiver: { kind: 'reference', name, type: node.receiver.type, span: node.receiver.span },
        },
        environment,
        depth,
        false
      );
      return `{ let ${variable} = ${receiverValue}; ${node.optional ? `if ${variable}.nullish() { Value::Undefined } else { ${inner} }` : inner} }`;
    }
    if (node.kind === 'operation' && node.operation === 'render.el')
      return nativeElement(node, environment, depth);
    if (node.kind === 'operation' && node.operation === 'render.slot')
      return 'native::gpui_native_owner::NativeSnapshot::slot()';
    if (node.kind === 'helper-call') {
      uses.names.add(node.name);
      const fn = helperFunction(node.name);
      const args = node.arguments.map((argument, index) =>
        fn && nativeFunctionParameter(fn, index)
          ? snapshotExpression(argument, environment, depth)
          : fn && nativeRecordParameter(fn, index)
            ? recordExpression(argument, environment, depth)
            : callableType(argument.type)
              ? callableValue(argument, environment, depth)
              : expression(argument, environment, depth)
      );
      if (fn && typedFunction(fn)) {
        // Optional native formals receive the same explicit undefined observation
        // as an omitted Value formal; validity is checked only if selected as output.
        for (let index = args.length; index < fn.parameters.length; index++)
          args.push(
            nativeFunctionParameter(fn, index)
              ? 'native::gpui_native_owner::NativeSnapshot::invalid(Value::Undefined)'
              : nativeRecordParameter(fn, index)
                ? '__PuiNativeRecordValue::Ordinary(Value::Undefined)'
                : 'Value::Undefined'
          );
        return moduleBindings.has(node.name)
          ? `${local(node.name)}.with(|function| (function.call)(${args.join(', ')}))`
          : `(${local(node.name)}${capturedBindings.has(node.name) ? '.read()' : ''}.call)(${args.join(', ')})`;
      }
      return moduleBindings.has(node.name)
        ? `${local(node.name)}.with(|function| function.call_authored(vec![${args.join(', ')}]))`
        : `${local(node.name)}${capturedBindings.has(node.name) ? '.read()' : ''}.call_authored(vec![${args.join(', ')}])`;
    }
    const args =
      node.kind === 'operation'
        ? node.arguments.map((argument) =>
            callableType(argument.type)
              ? callableValue(argument, environment, depth)
              : recordAbi(argument)
                ? `(${expression(argument, environment, depth)}).into_ordinary()`
                : expression(argument, environment, depth)
          )
        : [];
    const argument = (index: number) => args[index] ?? 'Value::Undefined';
    let emittedReceiver: string | undefined;
    const receiver = () =>
      (emittedReceiver ??=
        node.kind === 'operation' && node.receiver
          ? expression(node.receiver, environment, depth)
          : `capability(&${ownerReference()})`);
    const receiverOwner = () => `&(${receiver()}).owner()`;
    switch (node.kind) {
      case 'narrow':
        return expression(node.value, environment, depth);
      case 'undefined':
        return 'Value::Undefined';
      case 'literal':
        return literal(node.value, node.span);
      case 'reference':
        uses.names.add(node.name);
        if (moduleBindings.has(node.name) && !lexicalStoredType(node.type))
          return `${local(node.name)}.with(|value| value.clone())`;
        if (capturedBindings.has(node.name)) return `${local(node.name)}.read()`;
        if (lexicalStoredType(node.type)) {
          const cell = templateScope.lookup(node.name)?.value;
          return `${local(node.name)}.clone()`;
        }
        return `${local(node.name)}.clone()`;
      case 'lexical-cell': {
        const value = `std::cell::RefCell::new(${expression(node.value, environment, depth)})`;
        return `Rc::new(${value})`;
      }
      case 'lexical-read':
        if (node.cell.kind === 'reference' && moduleBindings.has(node.cell.name))
          return `${local(node.cell.name)}.with(|cell| cell.borrow().clone())`;
        return `{ let value = (${expression(node.cell, environment, depth)}).borrow().clone(); value }`;
      case 'lexical-write':
        if (node.cell.kind === 'reference' && moduleBindings.has(node.cell.name))
          return `{ let value = ${expression(node.value, environment, depth)}; ${local(node.cell.name)}.with(|cell| *cell.borrow_mut() = value.clone()); value }`;
        return `{ let value = ${expression(node.value, environment, depth)}; *(${expression(node.cell, environment, depth)}).borrow_mut() = value.clone(); value }`;
      case 'lexical-update': {
        if (node.cell.kind === 'reference' && moduleBindings.has(node.cell.name))
          return `${local(node.cell.name)}.with(|cell| { let previous = cell.borrow().clone(); let value = Value::number(previous.scalar_number() ${node.delta === 1 ? '+' : '-'} 1.0); *cell.borrow_mut() = value.clone(); ${node.prefix ? 'value' : 'previous'} })`;
        const cell = expression(node.cell, environment, depth);
        return `{ let cell = ${cell}; let previous = cell.borrow().clone(); let value = Value::number(previous.scalar_number() ${node.delta === 1 ? '+' : '-'} 1.0); *cell.borrow_mut() = value.clone(); ${node.prefix ? 'value' : 'previous'} }`;
      }
      case 'context-key':
        return `native_context_key(&PUI_CONTEXT_KEY_${ir.contextKeys.findIndex((key) => key.id === node.keyId)}, ${string(node.keyId)})`;
      case 'style-handle':
        return `Value::Style(vec![${node.handle.tokens.map((token) => `(${string(token)}.into(), ${string(getSemanticGroupKeyV0(token))}.into())`).join(', ')}])`;
      case 'member':
        return `(${expression(node.object, environment, depth)}).${node.object.type === 'exception' ? 'caught_member' : 'member'}(${string(node.property, node.span)}, ${node.optional})`;
      case 'member-write':
        return `set_member(${expression(node.object, environment, depth)}, ${string(node.property, node.span)}, ${expression(node.value, environment, depth)})`;
      case 'element': {
        const object = expression(node.object, environment, depth),
          index = expression(node.index, environment, depth);
        return `{ let object = ${object}; ${node.optional ? `if object.nullish() { Value::Undefined } else { object.caught_member(&property_key(&(${index})), false) }` : `object.caught_member(&property_key(&(${index})), false)`} }`;
      }
      case 'conditional': {
        const emit = snapshotAbi(node)
          ? snapshotExpression
          : recordAbi(node)
            ? recordExpression
            : expression;
        return `if (${expression(node.condition, environment, depth)}).truthy() { ${emit(node.then, environment, depth)} } else { ${emit(node.otherwise, environment, depth)} }`;
      }
      case 'call': {
        const fn = nativeCallable(node.callee);
        const callable = expression(node.callee, environment, depth);
        const args = node.arguments.map((argument, index) =>
          fn && nativeFunctionParameter(fn, index)
            ? snapshotExpression(argument, environment, depth)
            : fn && nativeRecordParameter(fn, index)
              ? recordExpression(argument, environment, depth)
              : callableType(argument.type)
                ? callableValue(argument, environment, depth)
                : expression(argument, environment, depth)
        );
        if (fn) {
          for (let index = args.length; index < fn.parameters.length; index++)
            args.push(
              nativeFunctionParameter(fn, index)
                ? 'native::gpui_native_owner::NativeSnapshot::invalid(Value::Undefined)'
                : nativeRecordParameter(fn, index)
                  ? '__PuiNativeRecordValue::Ordinary(Value::Undefined)'
                  : 'Value::Undefined'
            );
          return `{ let callable = ${callable}; (callable.call)(${args.join(', ')}) }`;
        }
        const invocation = `callable.call_authored(vec![${args.join(', ')}])`;
        return `{ let callable = ${callable}; ${node.optional ? `if callable.nullish() { Value::Undefined } else { ${invocation} }` : invocation} }`;
      }
      case 'intrinsic': {
        const args = node.arguments.map((argument) => expression(argument, environment, depth));
        switch (node.name) {
          case 'number.isFinite':
            return `number_is_finite(&(${args[0]}))`;
          case 'number':
            return args.length
              ? `Value::number((${args[0]}).scalar_number())`
              : 'Value::number(0.)';
          case 'math.floor':
            return `Value::number((${args[0]}).num().floor())`;
          case 'math.round':
            return `math_round(${args[0]})`;
          case 'string': {
            if (!args.length) return 'Value::string("")';
            // GPUI values coerce scalars exactly as ECMAScript does; a
            // structured or unknown argument has no admitted native coercion.
            const type = node.arguments[0].type;
            const scalar = valueAlternatives(type).every(
              (member) =>
                member === 'string' ||
                member === 'number' ||
                member === 'boolean' ||
                member === 'null' ||
                member === 'void' ||
                (typeof member !== 'string' && member.kind === 'literal')
            );
            if (!scalar) throw new Error('GPUI supports String() only for scalar data arguments.');
            return `Value::string(&(${args[0]}).scalar_text())`;
          }
          case 'object.assign':
            throw new Error('GPUI does not yet support fresh-target Object.assign.');
          case 'object.freeze':
            return `freeze(${args[0]})`;
          case 'object.hasOwn':
            return `has_own(&(${args[0]}), &(${args[1]}))`;
          case 'array.every':
            return `array_every(${args[0]}, ${args[1]})`;
          case 'array.includes':
            throw new Error('GPUI does not yet support finite string array.includes.');
          case 'typeof':
            return `typeof_value(&(${args[0]}))`;
          case 'error':
            return `record(vec![("name", Value::string("Error")), ("message", Value::string(&(${args[0] ?? 'Value::Undefined'}).error_message()))])`;
          default:
            throw new Error('Checked GPUI intrinsic has no direct lowering.');
        }
      }
      case 'object-spread':
        return `{ let mut fields = std::collections::BTreeMap::new(); ${node.parts
          .map((part) =>
            part.kind === 'spread'
              ? `fields.extend(own_entries(${expression(part.value, environment, depth)}));`
              : `fields.insert(${string(part.key, node.span)}.into(), ${expression(part.value, environment, depth)});`
          )
          .join(' ')} record_map(fields) }`;
      case 'unary': {
        const operand = expression(node.operand, environment, depth);
        return node.operator === '!'
          ? `Value::boolean(!(${operand}).truthy())`
          : `Value::number(${node.operator === '-' ? '-' : ''}(${operand}).scalar_number())`;
      }
      case 'binary': {
        if (['&&', '||', '??'].includes(node.operator) && snapshotAbi(node)) {
          const left = snapshotExpression(node.left, environment, depth),
            right = snapshotExpression(node.right, environment, depth);
          const selectRight =
            node.operator === '??'
              ? 'left.nullish()'
              : `${node.operator === '||' ? '!' : ''}left.truthy()`;
          return `{ let left = ${left}; if ${selectRight} { ${right} } else { left } }`;
        }
        if (['&&', '||', '??'].includes(node.operator) && recordAbi(node)) {
          const left = recordExpression(node.left, environment, depth),
            right = recordExpression(node.right, environment, depth);
          const selectRight =
            node.operator === '??'
              ? 'left.nullish()'
              : `${node.operator === '||' ? '!' : ''}left.truthy()`;
          return `{ let left = ${left}; if ${selectRight} { ${right} } else { left } }`;
        }
        const left = expression(node.left, environment, depth),
          right = expression(node.right, environment, depth);
        if (node.operator === '&&' || node.operator === '||')
          return `{ let left = ${left}; if ${node.operator === '&&' ? '' : '!'}left.truthy() { ${right} } else { left } }`;
        if (node.operator === '??')
          return `{ let left = ${left}; if left.nullish() { ${right} } else { left } }`;
        if (node.operator === '===' || node.operator === '!==') {
          const leftNative = snapshotAbi(node.left),
            rightNative = snapshotAbi(node.right);
          const leftCallable = !!nativeCallable(node.left),
            rightCallable = !!nativeCallable(node.right);
          const leftRecord = recordAbi(node.left),
            rightRecord = recordAbi(node.right);
          if (
            !leftNative &&
            !rightNative &&
            !leftCallable &&
            !rightCallable &&
            !leftRecord &&
            !rightRecord
          )
            return `Value::boolean(${node.operator === '!==' ? '!' : ''}strict_equal(&(${left}), &(${right})))`;
          const leftName = freshNative(),
            rightName = freshNative();
          let equality: string;
          if (
            (leftNative && (rightCallable || rightRecord)) ||
            (leftCallable && (rightNative || rightRecord)) ||
            (leftRecord && (rightNative || rightCallable))
          )
            equality = 'false';
          else if (leftRecord && rightRecord) equality = `${leftName}.equals(&${rightName})`;
          else if (leftRecord) equality = `${leftName}.equals_value(&${rightName})`;
          else if (rightRecord) equality = `${rightName}.equals_value(&${leftName})`;
          else if (leftCallable && rightCallable)
            equality = `${leftName}.equals_native(&${rightName})`;
          else if (leftCallable || leftNative)
            equality = `${leftName}.${leftNative && rightNative ? 'equals' : 'equals_value'}(&${rightName})`;
          else if (rightCallable || rightNative)
            equality = `${rightName}.equals_value(&${leftName})`;
          else equality = `strict_equal(&${leftName}, &${rightName})`;
          // Every category, including provably unequal native child/callable,
          // evaluates both authored operands once in left-to-right order.
          return `{ let ${leftName} = ${left}; let ${rightName} = ${right}; Value::boolean(${node.operator === '!==' ? '!' : ''}${equality}) }`;
        }
        if (node.operator === '+') return `add(${left}, ${right})`;
        if (['<', '<=', '>', '>='].includes(node.operator)) {
          if (!isDataValueType(node.left.type) || !isDataValueType(node.right.type))
            throw new Error('Validated relational operands must be data.');
          const resultType = inferBinaryType(node.operator, node.left.type, node.right.type);
          if (
            typeof resultType !== 'string' &&
            resultType.kind === 'union' &&
            resultType.members.length === 0
          ) {
            // Shared inference retains bottom for unreachable comparisons, even when the
            // other operand has no relational domain. Recompute the validated semantic result
            // rather than inspecting the raw IR union representation. A typed divergent
            // result gives method-receiver positions a Value type without fabricating one.
            return `{ let _relational_left = ${left}; let _relational_right = ${right}; let _relational_result: Value = unreachable!("uninhabited Proto relational expression"); _relational_result }`;
          }
          const kind = relationalOperandKind(node.left.type, node.right.type);
          // Bind Value operands before reading either, preserving left-to-right, once-only evaluation.
          // Rust str ordering is Unicode scalar ordering; Proto compares UTF-16 code units.
          const compare =
            kind === 'string'
              ? `relational_left.text().encode_utf16().cmp(relational_right.text().encode_utf16()) ${node.operator} std::cmp::Ordering::Equal`
              : `relational_left.scalar_number() ${node.operator} relational_right.scalar_number()`;
          return `{ let relational_left = ${left}; let relational_right = ${right}; Value::boolean(${compare}) }`;
        }
        return `Value::number((${left}).scalar_number() ${node.operator} (${right}).scalar_number())`;
      }
      case 'array':
        return snapshotAbi(node)
          ? `native::gpui_native_owner::NativeSnapshot::sequence(vec![${node.elements.map((item) => snapshotExpression(item, environment, depth)).join(', ')}], None)`
          : `Value::Array(Rc::new(vec![${node.elements.map((item) => expression(item, environment, depth)).join(', ')}]))`;
      case 'record':
        return recordAbi(node)
          ? nativeRecordLiteral(node, environment, depth)
          : `record(vec![${node.entries.map((entry) => `(${string(entry.key, node.span)}, ${expression(entry.value, environment, depth)})`).join(', ')}])`;
      case 'function':
        return functionValue(node.function, environment, depth);

      case 'authored-hook':
        return `${hookNames.get(node.hookId)}(capability(&${ownerReference()}), ${node.arguments?.[0] ? expression(node.arguments[0], environment, depth) : 'Value::Undefined'})`;
      case 'static-capability':
        return `Value::StaticCapability(&${staticArtifacts.find((declaration) => declaration.id === node.declarationId)!.name}::DECLARATION)`;
      case 'rule': {
        const bindings = new Map(node.states.map((state) => [state.id, state.value]));
        function condition(value: RuleCondition): string {
          if (value.type === 'true' || value.type === 'false') return value.type;
          if (value.type === 'eq') {
            const signal =
              value.left.type === 'prop'
                ? `read_props(&${ownerReference()}, false).member(${string(value.left.key)}, false)`
                : `(${expression(bindings.get(value.left.id)!, environment, depth)}).get()`;
            return `strict_equal(&(${signal}), &(${literal(value.right)}))`;
          }
          if (value.type === 'not') return `!(${condition(value.expr)})`;
          return value.exprs.length
            ? `(${value.exprs.map(condition).join(value.type === 'all' ? ' && ' : ' || ')})`
            : value.type === 'all'
              ? 'true'
              : 'false';
        }
        const parentUses = uses;
        uses = { names: new Set<string>(), owner: false };
        const body = condition(node.declaration.when);
        const predicateUses = uses;
        uses = parentUses;
        const captures = [...environment]
          .filter((name) => predicateUses.names.has(name))
          .map((name) => {
            uses.names.add(name);
            return `let ${local(name)} = ${local(name)}.clone();`;
          })
          .join(' ');
        const owner = predicateUses.owner ? `let owner = ${ownerReference()}.clone();` : '';
        const predicate = `{${owner} ${captures} Value::Function(Rc::new(move |_| Value::boolean(${body})))}`;
        const handles = node.declaration.intent.ops
          .flatMap((operation) => operation.handles)
          .map(
            (handle) =>
              `Value::Style(vec![${handle.tokens.map((token) => `(${string(token)}.into(), ${string(getSemanticGroupKeyV0(token))}.into())`).join(', ')}])`
          );
        return `rule(&${ownerReference()}, ${predicate}, vec![${handles.join(', ')}])`;
      }
      case 'operation': {
        const builtin = (installation: string) =>
          `native_builtin_hook(&${ownerReference()}, ${string(node.operation.slice('hook.'.length))}, || ${installation})`;
        switch (node.operation) {
          case 'scheduler.delay':
            return `schedule_delay(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'delay.cancel':
            return `(${receiver()}).member("cancel", false).call_authored(vec![])`;
          case 'presence.owner':
            return `presence_owner(&${ownerReference()})`;
          case 'presence.publish':
            return `presence_publish(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'presence.settle':
            return `presence_settle(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'presence.isCurrent':
            return `presence_is_current(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'presence.onCompletionRequest':
            return `(${receiver()}).member("onCompletionRequest", false).call_authored(vec![${argument(0)}])`;
          case 'presentation.snapshotCompletion':
            return `snapshot_completion(${argument(0)})`;
          case 'meta.get':
            return `native_meta_get(${receiverOwner()}, ${argument(0)})`;
          case 'capture.getState':
          case 'capture.getMethod':
          case 'capture.getAsHook':
          case 'capture.getAsHookHandle':
            // Empty capture frames omit their getters. A capture lookup returns
            // undefined in that case, matching the optional getter operation;
            // child artifacts must not be flattened into this frame to fill it.
            return `{ let capture_getter = (${receiver()}).member(${string(node.operation.slice('capture.'.length))}, false); if capture_getter.nullish() { Value::Undefined } else { capture_getter.call_authored(vec![${argument(0)}]) } }`;
          case 'run.update':
            return `request_update(${receiverOwner()})`;
          case 'feedback.style.use':
            return `style_use(&${ownerReference()}, vec![${args.join(', ')}])`;
          case 'feedback.style.release':
            return `(${receiver()}).call_authored(vec![])`;
          case 'feedback.style.patch':
            return `patch(${receiverOwner()}, vec![${args.join(', ')}], false)`;
          case 'feedback.style.suppress':
            return `patch(${receiverOwner()}, vec![${args.join(', ')}], true)`;
          case 'feedback.style.clearPatch':
            return `clear_patch(${receiverOwner()})`;
          case 'rule.dispose':
            return `rule_dispose(&${ownerReference()}, ${receiver()})`;
          case 'props.define':
            return `props_define(&${ownerReference()}, ${argument(0)})`;
          case 'props.setDefaults':
            return `set_defaults(&${ownerReference()}, ${argument(0)})`;
          case 'props.watch':
          case 'props.watchRaw':
            return `watch_props(&${ownerReference()}, Some(${argument(0)}), ${node.operation === 'props.watchRaw'}, ${argument(1)})`;
          case 'props.watchAll':
          case 'props.watchRawAll':
            return `watch_props(&${ownerReference()}, None, ${node.operation === 'props.watchRawAll'}, ${argument(0)})`;
          case 'props.get':
          case 'render.read.props.get':
            return `read_props(${receiverOwner()}, false)`;
          case 'props.getRaw':
          case 'render.read.props.getRaw':
            return `read_props(${receiverOwner()}, true)`;
          case 'props.isProvided':
          case 'render.read.props.isProvided':
            return `is_provided(${receiverOwner()}, ${argument(0)})`;
          case 'state.bool':
          case 'state.string':
          case 'state.numberDiscrete':
          case 'state.numberRange':
            return `create_state(&${ownerReference()}, ${string(({ 'state.bool': 'bool', 'state.string': 'string', 'state.numberDiscrete': 'discrete', 'state.numberRange': 'range' } as const)[node.operation])}, ${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'state.enum':
            return `create_state(&${ownerReference()}, "enum", ${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'state.get':
            return `(${receiver()}).get()`;
          case 'state.set':
            return `state_set(${receiver()}, ${argument(0)}, ${argument(1)})`;
          case 'state.setDefault':
            return `state_default(${receiver()}, ${argument(0)})`;
          case 'state.watch':
            return `watch_state(&${ownerReference()}, ${receiver()}, ${argument(0)})`;
          case 'subscription.release':
          case 'binding.release':
            return `(${receiver()}).call_authored(vec![])`;
          case 'host.get':
            return `host_target(${receiverOwner()})`;
          case 'expose.state':
            return `expose_state(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'expose.value':
            return `expose_value(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'expose.method':
            return `expose_method(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'expose.event':
            return `expose_event(&${ownerReference()}, ${argument(0)})`;
          case 'expose.emit':
            return `emit(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'lifecycle.setPresent':
            return `set_present(${receiverOwner()}, ${argument(0)})`;
          case 'lifecycle.onCreated':
          case 'lifecycle.onMounted':
          case 'lifecycle.onUpdated':
          case 'lifecycle.onUnmounted':
          case 'lifecycle.onBeforeDispose':
            return `register_life(&${ownerReference()}, ${string(({ 'lifecycle.onCreated': 'created', 'lifecycle.onMounted': 'mounted', 'lifecycle.onUpdated': 'updated', 'lifecycle.onUnmounted': 'unmounted', 'lifecycle.onBeforeDispose': 'before-dispose' } as const)[node.operation])}, ${argument(0)})`;

          case 'context.provide':
            return `context_provide(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'context.subscribe':
          case 'context.trySubscribe':
            return `context_subscribe(&${ownerReference()}, ${argument(0)}, ${node.operation === 'context.trySubscribe'}, ${argument(1)})`;
          case 'context.read':
          case 'context.tryRead':
          case 'render.read.context.read':
          case 'render.read.context.tryRead':
            return `context_read(${receiverOwner()}, ${argument(0)}, ${node.operation.endsWith('tryRead')})`;
          case 'context.update':
          case 'context.tryUpdate':
            return `context_update(${receiverOwner()}, ${argument(0)}, ${argument(1)}, ${node.operation === 'context.tryUpdate'})`;
          case 'hook.asTrigger':
            return builtin(`as_trigger(&${ownerReference()})`);
          case 'hook.asFocusable':
            return builtin(`as_focusable(&${ownerReference()})`);
          case 'hook.asAccessible':
            return builtin(`as_accessible(&${ownerReference()})`);
          case 'hook.asControlLabel':
            return builtin(`module_handle(&${ownerReference()}, "control-label")`);
          case 'controlLabel.label':
            return `control_label_declare(${receiverOwner()}, "label", Value::Undefined)`;
          case 'controlLabel.target':
            return `control_label_declare(${receiverOwner()}, "target", ${argument(0)})`;
          case 'controlLabel.sync':
            return `control_label_sync(${receiverOwner()}, ${argument(0)})`;
          case 'controlLabelRequest.isCurrent':
            return `control_label_request_current(${receiver()})`;
          case 'focus.configure':
            return `focus_setup_config(${receiverOwner()}, "focus", ${argument(0)})`;
          case 'focus.setDisabled':
            return `focus_disabled(${receiverOwner()}, ${argument(0)})`;
          case 'focus.focus':
          case 'focus.focusSelf':
            return `focus_request(${receiverOwner()}, ${argument(0)}, false)`;
          case 'hook.asFocusEntry':
            return builtin(`focus_setup(&${ownerReference()}, "focus-entry")`);
          case 'hook.asFocusScope':
            return builtin(`focus_setup(&${ownerReference()}, "focus-scope")`);
          case 'hook.asFocusRoving':
            return builtin(`focus_setup(&${ownerReference()}, "focus-roving")`);
          case 'focusEntry.configure':
            return `focus_setup_config(${receiverOwner()}, "focus-entry", ${argument(0)})`;
          case 'focusScope.configure':
            return `focus_setup_config(${receiverOwner()}, "focus-scope", ${argument(0)})`;
          case 'focusRoving.configure':
            return `focus_setup_config(${receiverOwner()}, "focus-roving", ${argument(0)})`;
          case 'focusEntry.focus':
            return `focus_request(${receiverOwner()}, ${argument(0)}, true)`;
          case 'focusEntry.setDisabled':
            return `focus_entry_disabled(${receiverOwner()}, ${argument(0)})`;
          case 'focus.blur':
            return `focus_blur(${receiverOwner()})`;
          case 'focus.setNavParticipation':
            return `focus_nav(${receiverOwner()}, ${argument(0)})`;
          case 'focus.setRovingStatus':
            return `focus_status(${receiverOwner()}, ${argument(0)})`;
          case 'focusRoving.focusFirst':
          case 'focusRoving.focusLast':
          case 'focusRoving.focusNext':
          case 'focusRoving.focusPrev':
          case 'focusRoving.focusSelected':
          case 'focus.focusFirst':
          case 'focus.focusLast':
          case 'focus.focusNext':
          case 'focus.focusPrev':
          case 'focus.focusSelected':
            return `focus_navigate(${receiverOwner()}, ${node.operation.startsWith('focusRoving.')}, ${string(node.operation.slice(node.operation.indexOf('.') + 6).toLowerCase())}, ${argument(0)})`;
          case 'focus.restoreFocus':
            return `focus_restore(${receiverOwner()})`;
          case 'focus.activate':
            return `focus_activate(${receiverOwner()}, ${argument(0)})`;
          case 'focus.deactivate':
            return `focus_deactivate(${receiverOwner()}, ${argument(0)})`;
          case 'focus.setLoop':
            return `focus_set_roving(${receiverOwner()}, "loop", ${argument(0)})`;
          case 'focus.setOrientation':
            return `focus_set_roving(${receiverOwner()}, "orientation", ${argument(0)})`;
          case 'focus.isActive':
            return `focus_is_active(${receiverOwner()})`;
          case 'focus.isFocused':
            return `focus_is_focused(${receiverOwner()})`;
          case 'focusScope.getRoving':
            return `focus_get_roving(${receiverOwner()})`;
          case 'accessible.role':
            return `accessible_role(${receiverOwner()}, ${argument(0)})`;
          case 'accessible.state':
            return `accessible_state(${receiverOwner()}, ${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'accessible.action':
            return `accessible_action_spec(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'accessible.nameFromContent':
            return `name_content(${receiverOwner()})`;
          case 'accessible.id':
          case 'accessible.name':
          case 'accessible.description':
            return `accessible_text(${receiverOwner()}, ${string(node.operation.slice(11))}, ${argument(0)})`;
          case 'accessible.relation':
            return `accessible_relation(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'accessible.tree':
            return `accessible_tree(${receiverOwner()}, ${argument(0)})`;
          case 'accessible.level':
            return `accessible_level(${receiverOwner()}, ${argument(0)})`;
          case 'anatomy.claim':
            return `anatomy_claim(&${ownerReference()}, ${argument(0)}, ${argument(1)})`;
          case 'anatomy.subscribeParts':
            return `anatomy_subscribe(&${ownerReference()}, ${argument(0)}, ${argument(1)}, ${argument(2)})`;
          case 'anatomy.has':
            return `anatomy_has(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'anatomy.parts':
          case 'anatomy.order.parts':
            return `anatomy_parts(${receiverOwner()}, ${argument(0)}, Value::Undefined)`;
          case 'anatomy.partsOf':
          case 'anatomy.order.partsOf':
            return `anatomy_parts(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'anatomy.order.version':
            return `anatomy_version(${receiverOwner()}, ${argument(0)})`;
          case 'anatomy.order.indexOfSelf':
          case 'anatomy.order.prevOfSelf':
          case 'anatomy.order.nextOfSelf':
            return `anatomy_neighbor(${receiverOwner()}, ${argument(0)}, ${argument(1)}, ${node.operation.endsWith('prevOfSelf') ? -1 : node.operation.endsWith('nextOfSelf') ? 1 : 0})`;
          case 'anatomyPart.hasExpose':
            return `part_has_expose(${receiver()}, ${argument(0)})`;
          case 'anatomyPart.getExpose':
            return `part_get_expose(${receiver()}, ${argument(0)})`;
          case 'anatomyPart.hasHook':
            return `part_has_hook(${receiver()}, ${argument(0)})`;
          case 'hook.asCollection':
            return builtin(`collection_setup(&${ownerReference()}, false)`);
          case 'hook.asCollectionItem':
            return builtin(`collection_setup(&${ownerReference()}, true)`);
          case 'collection.configure':
            return `collection_configure(${receiverOwner()}, ${argument(0)}, false)`;
          case 'collectionItem.configure':
            return `collection_configure(${receiverOwner()}, ${argument(0)}, true)`;
          case 'collection.getItems':
            return `collection_items(${receiverOwner()})`;
          case 'collection.getCount':
            return `collection_count(${receiverOwner()})`;
          case 'collectionItem.getSnapshot':
            return `collection_item_snapshot(${receiverOwner()})`;
          case 'hook.asTableStructure':
            return `{ let pui_builtin_role=${argument(0)}; native_builtin_hook(&${ownerReference()}, &format!("asTableStructure:{}", pui_builtin_role.text()), || table_setup(&${ownerReference()}, pui_builtin_role)) }`;
          case 'tableStructure.configure':
            return `table_configure(${receiverOwner()}, ${argument(0)})`;
          case 'tableStructure.getObjectRef':
            return `table_object_ref(${receiverOwner()})`;
          case 'tableStructure.getSnapshot':
            return `table_snapshot(${receiverOwner()})`;
          case 'hook.asBoundary':
            return builtin(`boundary_setup(&${ownerReference()}, false)`);
          case 'hook.asHitParticipation':
            return builtin(`boundary_setup(&${ownerReference()}, true)`);
          case 'boundary.configure':
            return `boundary_configure(${receiverOwner()}, ${argument(0)}, false)`;
          case 'hitParticipation.configure':
            return `boundary_configure(${receiverOwner()}, ${argument(0)}, true)`;
          case 'boundary.observe':
            return `boundary_observe(${receiverOwner()}, ${argument(0)})`;
          case 'boundary.setStackActive':
            return `boundary_active(${receiverOwner()}, ${argument(0)})`;
          case 'boundary.registerRegion':
          case 'hitParticipation.registerRegion':
            return `boundary_register(${receiverOwner()}, ${argument(0)}, ${argument(1)}, ${node.operation.startsWith('hit')})`;
          case 'boundary.unregisterRegion':
          case 'hitParticipation.unregisterRegion':
            return `boundary_unregister(${receiverOwner()}, ${argument(0)}, ${node.operation.startsWith('hit')})`;
          case 'boundary.classify':
          case 'boundary.notify':
            return `boundary_classify(${receiverOwner()}, ${argument(0)}, ${node.operation === 'boundary.notify'})`;
          case 'boundary.subscribeOutside':
            return `boundary_subscribe(${receiverOwner()}, ${argument(0)})`;
          case 'hook.asScrollSurface':
            return builtin(`scroll_setup(&${ownerReference()})`);
          case 'scroll.configure':
            return `scroll_configure(${receiverOwner()}, ${argument(0)})`;
          case 'scroll.sync':
            return `scroll_sync(${receiverOwner()}, ${argument(0)})`;
          case 'scroll.request':
            return `scroll_request(${receiverOwner()}, ${argument(0)})`;
          case 'scroll.getSnapshot':
            return `scroll_snapshot(${receiverOwner()})`;
          case 'hook.asTextControl':
            return builtin(`text_setup(&${ownerReference()})`);
          case 'textControl.on':
            return `text_on(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'textControl.sync':
            return `text_sync(${receiverOwner()}, ${argument(0)})`;
          case 'textControl.resetValue':
            return `text_reset_value(${receiverOwner()}, ${argument(0)})`;
          case 'textControl.snapshot':
            return `text_snapshot(${receiverOwner()})`;
          case 'hook.asImageView':
            return builtin(`image_setup(&${ownerReference()})`);
          case 'imageView.on':
            return `image_on(${receiverOwner()}, ${argument(0)}, ${argument(1)})`;
          case 'imageView.sync':
            return `image_sync(${receiverOwner()}, ${argument(0)})`;
          case 'imageView.snapshot':
            return `image_snapshot(${receiverOwner()})`;
          case 'hook.asOverlay':
            return builtin(`overlay_setup(&${ownerReference()})`);
          case 'overlay.isOpen':
            return `overlay_is_open(${receiverOwner()})`;
          case 'overlay.openOverlay':
          case 'overlay.close':
          case 'overlay.toggle':
            return `overlay_intent(${receiverOwner()}, ${string(node.operation.slice('overlay.'.length))}, ${argument(0)})`;
          case 'overlay.configure':
            return `overlay_configure(${receiverOwner()}, ${argument(0)}, false)`;
          case 'overlay.updatePosition':
            return `overlay_configure(${receiverOwner()}, ${argument(0)}, true)`;
          case 'overlay.registerTrigger':
          case 'overlay.registerAnchor':
          case 'overlay.registerAnchorPart':
          case 'overlay.registerContent':
            return `overlay_register(${receiverOwner()}, ${argument(0)}, ${string(node.operation === 'overlay.registerTrigger' ? 'trigger' : node.operation === 'overlay.registerContent' ? 'content' : 'anchor')})`;
          case 'overlay.getPositionSnapshot':
            return `positioning_snapshot(${receiverOwner()})`;
          case 'overlay.keepMounted':
            return `overlay_keep_mounted(${receiverOwner()})`;
          case 'overlay.bindPresence':
            return `overlay_bind_presence(${receiverOwner()}, ${argument(0)})`;
          case 'positioning.connect':
            return `positioning_connect(${receiverOwner()}, ${argument(0)})`;
          case 'positioning.update':
            return `positioning_update(${receiverOwner()}, ${argument(0)})`;
          case 'positioning.requestUpdate':
            return `positioning_request(${receiverOwner()})`;
          case 'positioning.disconnect':
            return `positioning_disconnect(${receiverOwner()})`;
          case 'positioning.getSnapshot':
            return `positioning_snapshot(${receiverOwner()})`;
          case 'event.on':
          case 'event.onGlobal': {
            const listener =
              node.inputPayloadType === 'a11y-value-event' ? 'listen_numeric_value' : 'listen';
            return `${listener}(&${ownerReference()}, ${argument(0)}, ${node.operation === 'event.onGlobal'}, ${argument(1)}, ${argument(2)})`;
          }
          case 'event.requestDefaultActionPrevention':
          case 'eventControl.requestDefaultActionPrevention':
            return `prevent(${receiver()})`;
          default:
            throw new Error(`Checked GPUI operation has no direct lowering: ${node.operation}`);
        }
      }
    }
  }
  function statements(
    body: readonly StatementIR[],
    inherited: ReadonlySet<string>,
    depth: number,
    complete = true,
    nativeReturn = false,
    rendererResult = false,
    recordReturn = false,
    completion = false,
    discardReturn = false
  ): string {
    const scope = new Set(inherited),
      indent = '    '.repeat(depth);
    let code = '';
    const savedTemplateScope = templateScope;
    for (const statement of body)
      if (statement.kind === 'const') {
        scope.add(statement.name);
        templateScope = templateScope.bind(statement.name, statement.value);
      }
    for (const statement of body)
      if (statement.kind === 'const' && capturedBindings.has(statement.name)) {
        code += `${indent}let ${local(statement.name)}: LexicalBinding<${valueRustType(statement.value)}> = lexical_binding();\n`;
      }
    for (const statement of body) {
      code += `${indent}// Source ${JSON.stringify(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
      if (statement.kind === 'const') {
        const initialized = expression(statement.value, scope, depth);
        code += capturedBindings.has(statement.name)
          ? `${indent}${local(statement.name)}.initialize(${initialized});\n`
          : `${indent}let ${local(statement.name)} = ${initialized};\n`;
        scope.add(statement.name);
        templateScope = templateScope.bind(statement.name, statement.value);
      } else if (statement.kind === 'effect') {
        const value = statement.expression;
        if (value.kind === 'lexical-write')
          code +=
            value.cell.kind === 'reference' && moduleBindings.has(value.cell.name)
              ? `${indent}{ let value = ${expression(value.value, scope, depth)}; ${local(value.cell.name)}.with(|cell| *cell.borrow_mut() = value); }\n`
              : `${indent}{ let value = ${expression(value.value, scope, depth)}; *(${expression(value.cell, scope, depth)}).borrow_mut() = value; }\n`;
        else if (value.kind === 'lexical-update')
          code +=
            value.cell.kind === 'reference' && moduleBindings.has(value.cell.name)
              ? `${indent}${local(value.cell.name)}.with(|cell| { let next = cell.borrow().scalar_number() ${value.delta === 1 ? '+' : '-'} 1.0; *cell.borrow_mut() = Value::number(next); });\n`
              : `${indent}{ let cell = ${expression(value.cell, scope, depth)}; let next = cell.borrow().scalar_number() ${value.delta === 1 ? '+' : '-'} 1.0; *cell.borrow_mut() = Value::number(next); }\n`;
        else code += `${indent}${expression(value, scope, depth)};\n`;
      } else if (statement.kind === 'return') {
        const value = discardReturn
          ? '()'
          : statement.value
            ? rendererResult && callableType(statement.value.type)
              ? rendererEntry(statement.value, scope, depth)
              : nativeReturn
                ? snapshotExpression(statement.value, scope, depth)
                : recordReturn
                  ? recordExpression(statement.value, scope, depth)
                  : callableType(statement.value.type)
                    ? callableValue(statement.value, scope, depth)
                    : expression(statement.value, scope, depth)
            : nativeReturn
              ? 'native::gpui_native_owner::NativeSnapshot::invalid(Value::Undefined)'
              : recordReturn
                ? '__PuiNativeRecordValue::Ordinary(Value::Undefined)'
                : 'Value::Undefined';
        if (discardReturn && statement.value)
          code += `${indent}let _ = ${expression(statement.value, scope, depth)};\n`;
        code += `${indent}return ${completion ? `std::ops::ControlFlow${discardReturn ? '::<(), ()>' : ''}::Break(${value})` : value};\n`;
        templateScope = savedTemplateScope;
        return code;
      } else if (statement.kind === 'throw') {
        emitsExceptions = true;
        code += `${indent}throw_value(${expression(statement.value, scope, depth)});\n`;
        templateScope = savedTemplateScope;
        return code;
      } else if (statement.kind === 'try') {
        emitsExceptions = true;
        const finalOverrides =
          statement.finally !== undefined && statementsTerminate(statement.finally);
        const branch = (
          items: readonly StatementIR[],
          level: number,
          name?: string,
          discard = discardReturn
        ): string => {
          const outer = templateScope;
          const next = new Set(scope);
          if (name) {
            next.add(name);
            templateScope = templateScope.parameter(name, undefined, templateScope, null);
          }
          try {
            return (
              statements(
                items,
                next,
                level,
                false,
                nativeReturn,
                rendererResult,
                recordReturn,
                true,
                discard
              ) +
              (statementsTerminate(items)
                ? ''
                : `${'    '.repeat(level)}std::ops::ControlFlow${discard ? '::<(), ()>' : ''}::Continue(())\n`)
            );
          } finally {
            templateScope = outer;
          }
        };
        const level = depth + (statement.finally ? 2 : 1);
        const pad = '    '.repeat(level);
        const caught = statement.catch;
        const returnAbi = nativeReturn
          ? 'native::gpui_native_owner::NativeSnapshot'
          : recordReturn
            ? '__PuiNativeRecordValue'
            : 'Value';
        const bodyFlow = `std::ops::ControlFlow<${discardReturn || finalOverrides ? '()' : returnAbi}>`;
        const finalFlow = `std::ops::ControlFlow<${discardReturn ? '()' : returnAbi}>`;
        const operation = caught
          ? `match catch_authored::<${bodyFlow}>(|| {\n${branch(statement.body, level + 1, undefined, discardReturn || finalOverrides)}${pad}}) {\n${pad}    Ok(flow) => flow,\n${pad}    Err(${caught.name ? local(caught.name) : '_'}) => (|| -> ${bodyFlow} {\n${branch(caught.body, level + 2, caught.name, discardReturn || finalOverrides)}${pad}    })()\n${pad}}`
          : `{\n${branch(statement.body, level + 1, undefined, discardReturn || finalOverrides)}${pad}}`;
        const flow = statement.finally
          ? `${finalOverrides ? 'authored_finally_override' : 'authored_finally'}(|| -> ${bodyFlow} {\n${pad}${operation}\n${'    '.repeat(depth + 1)}}, || -> ${finalFlow} {\n${branch(statement.finally, depth + 2)}${'    '.repeat(depth + 1)}})`
          : operation;
        code += `${indent}match ${flow} {\n${indent}    std::ops::ControlFlow::Break(value) => return ${completion ? 'std::ops::ControlFlow::Break(value)' : 'value'},\n${indent}    std::ops::ControlFlow::Continue(()) => {}\n${indent}}\n`;
      } else
        code += `${indent}if (${expression(statement.condition, scope, depth)}).truthy() {\n${statements(statement.then, scope, depth + 1, false, nativeReturn, rendererResult, recordReturn, completion, discardReturn)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, scope, depth + 1, false, nativeReturn, rendererResult, recordReturn, completion, discardReturn)}${indent}}` : ''}\n`;
    }
    templateScope = savedTemplateScope;
    return complete
      ? `${code}${indent}${nativeReturn ? 'native::gpui_native_owner::NativeSnapshot::invalid(Value::Undefined)' : recordReturn ? '__PuiNativeRecordValue::Ordinary(Value::Undefined)' : 'Value::Undefined'}\n`
      : code;
  }
  function accepts(value: string, type: DataType, span = ir.setup.span): string {
    if (typeof type === 'string')
      return type === 'number'
        ? `${value}.as_f64().is_some_and(f64::is_finite)`
        : type === 'null' || type === 'void'
          ? `${value}.is_null()`
          : `${value}.is_${type === 'boolean' ? 'boolean' : 'string'}()`;
    if (type.kind === 'literal') {
      if (type.value === null) return `${value}.is_null()`;
      if (typeof type.value === 'string')
        return `${value}.as_str() == Some(${string(type.value, span)})`;
      if (typeof type.value === 'boolean') return `${value}.as_bool() == Some(${type.value})`;
      return `${value}.as_f64() == Some(${Number.isInteger(type.value) ? `${type.value}.0` : String(type.value)})`;
    }
    if (type.kind === 'union')
      return `(${type.members.map((member) => accepts(value, member, span)).join(' || ')})`;
    if (type.kind === 'array')
      return `${value}.as_array().is_some_and(|items| items.iter().all(|item| ${accepts('item', type.element, span)}))`;
    return `(${value}.is_object() && ${type.fields.map((field) => `${value}.get(${string(field.name, span)}).map_or(${Boolean(field.optional)}, |field| ${accepts('field', field.type, span)})`).join(' && ') || 'true'})`;
  }
  const propValidChecks = ir.props
    .map((prop) => `${string(prop.name, prop.span)} => ${accepts('value', prop.type, prop.span)},`)
    .join('\n        ');
  const contextChecks = ir.contextKeys
    .map((key) => `${string(key.id)} => ${accepts('value', key.type, key.span)},`)
    .join('\n        ');
  const propChecks =
    ir.props
      .map(
        (prop) =>
          `value.get(${string(prop.name, prop.span)}).map_or(true, |prop| prop.is_null() || ${accepts('prop', prop.type, prop.span)})`
      )
      .join(' && ') || 'true';
  const dataDeclarations: string[] = [];
  const dataNames = new Map<string, string>();
  function rustType(type: DataType, span = ir.setup.span): string {
    if (typeof type === 'string')
      return (
        { boolean: 'bool', number: 'f64', string: 'String', null: '()', void: '()' } as const
      )[type];
    if (type.kind === 'literal')
      return type.value === null
        ? '()'
        : rustType(
            typeof type.value === 'boolean'
              ? 'boolean'
              : typeof type.value === 'number'
                ? 'number'
                : 'string'
          );
    if (type.kind === 'array') return `Vec<${rustType(type.element, span)}>`;
    const key = JSON.stringify(type),
      prior = dataNames.get(key);
    if (prior) return prior;
    const name = `GeneratedData${dataNames.size}`;
    dataNames.set(key, name);
    if (type.kind === 'record')
      dataDeclarations.push(
        `#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]\npub struct ${name} {\n${type.fields.map((field, index) => `    #[serde(rename = ${string(field.name, span)}${field.optional ? ', default, skip_serializing_if = "Option::is_none"' : ''})]\n    pub field_${index}: ${field.optional ? `Option<${rustType(field.type, span)}>` : rustType(field.type, span)},`).join('\n')}\n}`
      );
    else
      dataDeclarations.push(
        `#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]\n#[serde(untagged)]\npub enum ${name} {\n${type.members.map((member, index) => `    Alternative${index}(${rustType(member, span)}),`).join('\n')}\n}`
      );
    return name;
  }
  const propsType = rustType({
    kind: 'record',
    fields: ir.props.map((prop) => ({ name: prop.name, type: prop.type, optional: true })),
  });
  const typedMethods: string[] = [],
    methodChecks: string[] = [],
    dataMethods: string[] = [];
  const dataMethodBindings = gpuiDataMethods(validated.value);
  const reachedMethodSites = admittedAnalysis.sites.filter(
    (site) => site.operation === 'expose.method'
  );
  const nativeInput = (type: ExpressionIR['type']): boolean =>
    isPublicValueType(type) ||
    type === 'context-key' ||
    (typeof type !== 'string' &&
      ((type.kind === 'object' &&
        type.fields.every((field) => nativeInput(field.type)) &&
        (!type.index || nativeInput(type.index))) ||
        (type.kind === 'value-union' && type.members.every(nativeInput))));
  function acceptsNative(value: string, type: ExpressionIR['type'], span = ir.setup.span): string {
    if (isDataValueType(type))
      return type === 'void'
        ? `matches!(${value}, Value::Undefined)`
        : `(${value}).try_data().is_some_and(|data| ${accepts('data', type, span)})`;
    if (type === 'context-key') return `matches!(${value}, Value::ContextKey(_))`;
    if (typeof type !== 'string') {
      if (type.kind === 'object')
        return `(matches!(${value}, Value::Record(_)) && ${type.fields.map((field) => `{let member=(${value}).member(${string(field.name, span)},false); ${field.optional ? 'matches!(&member,Value::Undefined) || ' : ''}${acceptsNative('&member', field.type, span)}}`).join(' && ') || 'true'})`;
      if (type.kind === 'value-union')
        return `(${type.members.map((member) => acceptsNative(value, member, span)).join(' || ')})`;
      if (type.kind === 'callable') return `matches!(${value}, Value::Function(_))`;
    }
    if (type === 'presentation-owner-ref') return `matches!(${value}, Value::Opaque(_))`;
    return `!(${value}).nullish()`;
  }
  for (const [index, exposure] of ir.exposes.entries()) {
    if (exposure.kind === 'value') {
      typedMethods.push(
        `    pub fn value_${index}(&self) -> Result<Value, Value> { catch_authored(|| { ensure(&Rc::downgrade(&self.owner)); self.owner.borrow().exposes.get(${string(exposure.name, exposure.span)}).cloned().unwrap_or_else(|| value_error("unknown exposed value")) }) }`
      );
      continue;
    }
    if (exposure.kind === 'state') {
      typedMethods.push(
        `    pub fn state_${index}(&self) -> Result<${rustType(exposure.type, exposure.span)}, Value> { self.state(${string(exposure.name, exposure.span)}).map(|value| serde_json::from_value(value).expect("checked exposed State")) }`
      );
      continue;
    }
    if (exposure.kind !== 'method') continue;
    if (
      !isPublicValueType(exposure.returnType) ||
      exposure.parameters.some((parameter) => !nativeInput(parameter.type))
    )
      return {
        ok: false,
        diagnostics: [
          {
            code: 'PUI_GPUI_PUBLIC_DATA',
            category: 'unsupported-input',
            message:
              'Native exposed methods require public values or ContextKey arguments and concrete public results; setup, Run and owned State authority cannot cross this boundary.',
            span: exposure.span,
          },
        ],
      };
    const portableReturn = isDataValueType(exposure.returnType);
    const returnType = exposure.returnType as DataType;
    const checkedPortableResult = portableReturn
      ? `let result = if matches!(result, Value::Undefined) { Json::Null } else { result.data() };
        if !(${accepts('result', returnType, exposure.span)}) { value_type_error("exposed method returned invalid portable data") }`
      : '';
    const parameters = exposure.parameters
      .map(
        (parameter, parameterIndex) =>
          `argument_${parameterIndex}: ${!isDataValueType(parameter.type) ? 'Value' : parameter.optional ? `Option<${rustType(parameter.type, exposure.span)}>` : rustType(parameter.type, exposure.span)}`
      )
      .join(', ');
    const args = exposure.parameters
      .map((parameter, parameterIndex) =>
        !isDataValueType(parameter.type)
          ? `argument_${parameterIndex}`
          : parameter.optional
            ? `argument_${parameterIndex}.map(|value| Value::json(serde_json::to_value(value).expect("portable argument"))).unwrap_or(Value::Undefined)`
            : `Value::json(serde_json::to_value(argument_${parameterIndex}).expect("portable argument"))`
      )
      .join(', ');
    typedMethods.push(`    pub fn method_${index}(&self, ${parameters}${parameters ? ', ' : ''}window: &mut Window, cx: &mut App) -> Result<${portableReturn ? rustType(returnType, exposure.span) : 'Value'}, Value> {
        catch_authored(|| {
        refresh_native_atoms(&self.owner, window, cx);
          #[cfg(feature = "experimental-focus-tree")] refresh_native_entry(&self.owner, window);
        let arguments = vec![${args}];
        let callback = self.owner.borrow().exposes.get(${string(exposure.name, exposure.span)}).cloned().unwrap_or_else(|| value_error("unknown exposed method"));
        check_method(${string(exposure.name, exposure.span)}, &arguments);
        let result = invoke(&self.owner, "expose-method", &callback, arguments);
        let drive = self.owner.borrow().native_drive.clone(); if let Some(drive) = drive { drive(window, cx); }
        ${
          portableReturn
            ? `${checkedPortableResult}
        serde_json::from_value(result).expect("checked exposed method result")`
            : 'result'
        }
        })
    }`);
    const checks =
      exposure.parameters
        .map(
          (parameter, parameterIndex) =>
            `arguments.get(${parameterIndex}).map_or(${Boolean(parameter.optional)}, |value| ${parameter.optional ? 'matches!(value, Value::Undefined) || ' : ''}${acceptsNative('value', parameter.type, exposure.span)})`
        )
        .join(' && ') || 'true';
    methodChecks.push(
      `        ${string(exposure.name, exposure.span)} => if !(arguments.len() <= ${exposure.parameters.length} && ${checks}) { value_type_error("invalid exposed method arguments") },`
    );
    const sourceBinding = dataMethodBindings.get(exposure.name);
    if (
      !sourceBinding ||
      !portableReturn ||
      !exposure.parameters.every((parameter) => isDataValueType(parameter.type)) ||
      !reachedMethodSites.some(
        ({ span }) =>
          span.file === exposure.span.file &&
          span.start === exposure.span.start &&
          span.end === exposure.span.end
      )
    )
      continue;
    const binding = moduleParts.shared.find((binding) =>
      sourceBinding.bindingId === undefined
        ? binding.name === sourceBinding.name && binding.bindingId === undefined
        : binding.bindingId === sourceBinding.bindingId
    );
    const value = binding?.value;
    if (
      !binding ||
      value?.kind !== 'function' ||
      !reached.has(value.function) ||
      typedFunction(value.function)
    )
      continue;
    dataMethods.push(`        ${string(exposure.name, exposure.span)} => {
            let arguments: Vec<Value> = arguments.into_iter().map(|value| value.map(Value::json).unwrap_or(Value::Undefined)).collect();
            check_method(name, &arguments);
            let callback = self.owner.borrow().exposes.get(name).cloned().unwrap_or_else(|| value_error("unknown exposed method"));
            let result = invoke(&self.owner, "expose-method", &callback, arguments);
            ${checkedPortableResult}
            result
        },`);
  }
  const hooks = ir.hooks
    .filter((hook) => admitted.value.authoredHooks.includes(hook.id))
    .map(
      (hook) =>
        `fn ${hookNames.get(hook.id)}(definition: Value, input: Value) -> Value {\n    let owner = definition.owner();\n    authored_hook(&owner, ${string(hook.name)}, ${string(hook.kind === 'hook' ? (hook.mode ?? 'once') : 'once')}, input, ${functionValue(hook.setup, new Set(), 1)}, ${hook.projectHandle ? functionValue(hook.projectHandle, new Set(), 1) : 'Value::Undefined'}, ${hook.configure ? functionValue(hook.configure, new Set(), 1) : 'Value::Undefined'})\n}`
    )
    .join('\n');
  const moduleSetups = ir.moduleDeclarations
    .map((declaration) =>
      declaration.id === '@proto.ui/text-control/declaration'
        ? `        text_declaration(&owner, ${declaration.config.lineMode === 'multiline'});`
        : `        image_declaration(&owner, ${staticValue(declaration.config, declaration.span)});`
    )
    .join('\n');
  const moduleCode = moduleParts.shared
    .map((binding) => {
      const value = binding.value;
      if (value.kind === 'lexical-cell')
        return `std::thread_local! { static ${local(binding.name)}: std::cell::RefCell<Value> = std::cell::RefCell::new(${expression(value.value, new Set(), 0)}); }`;
      let type = 'Value';
      if (value.kind === 'function' && typedFunction(value.function)) {
        const fn = value.function;
        const parameters = fn.parameters
          .map((_, index) =>
            nativeFunctionParameter(fn, index)
              ? 'native::gpui_native_owner::NativeSnapshot'
              : nativeRecordParameter(fn, index)
                ? '__PuiNativeRecordValue'
                : 'Value'
          )
          .join(', ');
        const result = returnsNative(fn)
          ? 'native::gpui_native_owner::NativeSnapshot'
          : nativeRecordReturns.has(fn)
            ? '__PuiNativeRecordValue'
            : 'Value';
        type = `native::gpui_native_owner::NativeCallable<dyn Fn(${parameters}) -> ${result}>`;
      }
      return `std::thread_local! { static ${local(binding.name)}: ${type} = ${expression(value, new Set(), 0)}; }`;
    })
    .join('\n');
  const setupCallable = functionValue(ir.setup, new Set(), 2);
  const nativeRecords = nativeRecordTypes();
  const code = `// Direct checked-source GPUI component. Supporting files are ordinary editable Rust.
  ${emitsExceptions ? '#[cfg(panic = "abort")] compile_error!("Authored exception lowering requires panic=unwind");' : ''}
  pub use proto_ui_gpui_native as native;
  use gpui::{prelude::*, App, Context, FocusHandle, Subscription, Window};
  use std::rc::Rc;
  use serde_json::Value as Json;
  use native::gpui_native_owner::*;
  ${moduleCode}
  ${staticArtifacts.map((declaration) => `#[path = ${string(declaration.path)}] mod ${declaration.name};`).join('\n')}
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
          _ => value_error("unknown exposed method"),
  } }
  ${ir.contextKeys.map((_, index) => `static PUI_CONTEXT_KEY_${index}: std::sync::OnceLock<NativeContextKey> = std::sync::OnceLock::new();`).join('\n')}
  ${dataDeclarations.join('\n')}
  ${nativeRecords}
  pub type GeneratedProps = ${propsType};
  ${hooks}
  #[derive(Clone)]
  pub struct ${componentName}Handle { pub owner: OwnerRef }
  impl ${componentName}Handle {
  ${typedMethods.join('\n')}${
    dataMethods.length
      ? `
      /// Calls this live instance's registered data-only method. None preserves an undefined argument slot.
      pub fn call_data_method(&self, name: &str, arguments: Vec<Option<Json>>) -> Result<Json, Value> {
          catch_authored(|| { ensure(&self.owner()); match name {
  ${dataMethods.join('\n')}
              _ => value_error("unknown or ineligible data method"),
          } })
      }`
      : ''
  }
      pub fn owner(&self) -> OwnerWeak { Rc::downgrade(&self.owner) }
      pub fn state(&self, name: &str) -> Result<Json, Value> { catch_authored(|| { let state=self.owner.borrow().exposes.get(name).cloned().unwrap_or_else(|| value_error("unknown exposed State")); state.get().data() }) }
      pub fn call(&self, name: &str, arguments: Vec<Json>, window: &mut Window, cx: &mut App) -> Result<Json, Value> {
          catch_authored(|| {
          refresh_native_atoms(&self.owner, window, cx);
          #[cfg(feature = "experimental-focus-tree")] refresh_native_entry(&self.owner, window);
          let callback = self.owner.borrow().exposes.get(name).cloned().unwrap_or_else(|| value_error("unknown exposed method"));
          let arguments: Vec<Value> = arguments.into_iter().map(Value::json).collect(); check_method(name, &arguments);
          let result = invoke(&self.owner, "expose-method", &callback, arguments);
          let drive = self.owner.borrow().native_drive.clone(); if let Some(drive) = drive { drive(window, cx); }
          if matches!(result, Value::Undefined) { Json::Null } else { result.data() }
          })
      }
      pub fn host_target(&self) -> Result<Value, Value> { catch_authored(|| { ensure(&self.owner()); Value::HostTarget(self.owner()) }) }
      pub fn take_events(&self) -> Vec<(String, Json)> { std::mem::take(&mut self.owner.borrow_mut().emitted) }
      pub fn take_failures(&self) -> Vec<NativeFailure> { take_native_failures(&self.owner) }
      pub fn dispose(&self, window: &mut Window, cx: &mut App) -> Result<(), Value> {
          catch_authored(|| {
          let drive = self.owner.borrow().native_drive.clone();
          let failure = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| Owner::dispose(&self.owner)));
          let driven = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { if let Some(drive) = drive { drive(window, cx); } }));
          if let Err(failure) = failure { std::panic::resume_unwind(failure); }
          if let Err(failure) = driven { std::panic::resume_unwind(failure); }
          })
      }
  }
  pub struct ${componentName} { pub owner: OwnerRef, focus: FocusHandle, window_input: Option<FocusHandle>, _focus_subscriptions: Vec<Subscription>, _window_activation: Option<(gpui::WindowId, Subscription)>, _focus_lost: Option<Subscription>, _global_key_capture: Option<Subscription>, _entry_readiness: Option<(gpui::WindowId, Subscription)> }
  impl ${componentName} {
      pub fn create_props(props: GeneratedProps, parent: Option<OwnerWeak>, window: &mut Window, cx: &mut App) -> Result<gpui::Entity<Self>, Value> { Self::create(serde_json::to_value(props).expect("portable Props"), parent, window, cx) }
      pub fn create(raw_props: Json, parent: Option<OwnerWeak>, window: &mut Window, cx: &mut App) -> Result<gpui::Entity<Self>, Value> { Self::create_with_associations(raw_props,parent,NativeInstanceAssociations::default(),window,cx) }
      pub fn create_with_associations(raw_props: Json, parent: Option<OwnerWeak>, associations: NativeInstanceAssociations, window: &mut Window, cx: &mut App) -> Result<gpui::Entity<Self>, Value> {
          let mut failure = None;
          let entity = cx.new(|cx| Self::new_with_associations(raw_props, parent, associations, window, cx).unwrap_or_else(|error| {
              failure = Some(error);
              // A failed construction still returns normally through GPUI's
              // entity insertion. This inert temporary is dropped immediately
              // below; it is never published or mounted as a native component.
              let owner = Owner::new(Json::Object(Default::default()), Default::default(), accepts_context, accepts_props, prop_valid, style_vocabulary());
              { let mut owner = owner.borrow_mut(); owner.disposed = true; owner.present = false; }
              Self { owner, focus: cx.focus_handle(), window_input: None, _focus_subscriptions: Vec::new(), _window_activation: None, _focus_lost: None, _global_key_capture: None, _entry_readiness: None }
          }));
          match failure { Some(error) => Err(error), None => Ok(entity) }
      }
      pub fn new_props(props: GeneratedProps, parent: Option<OwnerWeak>, window: &mut Window, cx: &mut Context<Self>) -> Result<Self, Value> { Self::new(serde_json::to_value(props).expect("portable Props"), parent, window, cx) }
      pub fn new(raw_props: Json, parent: Option<OwnerWeak>, window: &mut Window, cx: &mut Context<Self>) -> Result<Self, Value> { Self::new_with_associations(raw_props,parent,NativeInstanceAssociations::default(),window,cx) }
      pub fn new_with_associations(raw_props: Json, parent: Option<OwnerWeak>, associations: NativeInstanceAssociations, window: &mut Window, cx: &mut Context<Self>) -> Result<Self, Value> {
          catch_authored(|| {
          let owner_ref = Owner::new(raw_props, parent.unwrap_or_default(), accepts_context, accepts_props, prop_valid, style_vocabulary());
          let owner = Rc::downgrade(&owner_ref);
          ${
            admittedAnalysis.operations.includes('hook.asControlLabel')
              ? `let notify_view=cx.entity().downgrade();let notify_cx=cx.to_async();
          configure_control_label_host(&owner_ref,Rc::new(move||{let view=notify_view.clone();notify_cx.spawn(async move|cx|{let _=view.update(cx,|_,cx|cx.notify());}).detach();}));`
              : ''
          }
          set_instance_associations(&owner_ref, associations);
          let focus = cx.focus_handle();
          let view = cx.entity().downgrade();
          let drive_owner=owner.clone(); let drive_focus=focus.clone();
          let driving = Rc::new(std::cell::Cell::new(false));
          let drive_pending = Rc::new(std::cell::Cell::new(false));
          let drive: Drive = Rc::new(move |window, cx| {
              // Platform effects need owner storage and its real FocusHandle,
              // not another lease of the generated component. Preserve their
              // synchronous effect (notably physical focus) under public calls.
              if !driving.replace(true) {
                  if let Some(owner)=drive_owner.upgrade() {
                      native_host_callback(&owner, "drive", || { modules_drive(&owner, &drive_focus, window, cx); drive_queued_focus(&owner, window, cx); });
                  }
                  driving.set(false);
              }
              if drive_pending.replace(true) { return; }
              let view=view.clone(); let pending=drive_pending.clone();
              // A public handle can be called from Entity::update. Return the
              // current host lease before requesting another component update.
              // Authored calls, State writes and platform commands remain
              // synchronous; component refresh is coalesced at the host boundary.
              window.defer(cx, move |window, cx| {
                  pending.set(false);
                  let _ = view.update(cx, |view, cx| { if let Err(error) = view.drive(window, cx) { report_native_failure(&view.owner, "drive", error); } });
              });
          });
          { let mut owner = owner_ref.borrow_mut(); owner.native_drive = Some(drive); owner.window_id = Some(window.window_handle().window_id()); }
  ${moduleSetups}
          configure_native_atoms(&owner_ref, ${admittedAnalysis.operations.includes('scheduler.delay')}, ${admittedAnalysis.operations.includes('meta.get')});
          refresh_native_atoms(&owner_ref, window, cx);
          let _lexical_owner = enter_lexical_owner(&owner);
          let renderer = ${setupCallable}.call_authored(vec![capability(&owner)]);
          Owner::finish(&owner_ref, renderer);
          let focus_subscriptions = if native_focus_observation_needed(&owner_ref) {
          let focus_owner = owner_ref.clone();
          let on_focus = cx.on_focus(&focus, window, move |view, window, cx| {
              native_host_callback(&focus_owner, "focus", || {
              let epoch = focus_owner.borrow().epoch;
              if !ready(&focus_owner) || focus_owner.borrow().window_id != Some(window.window_handle().window_id()) { return; }
              #[cfg(feature = "experimental-focus-tree")] refresh_native_entry(&focus_owner, window);
              native_focus_fact(&focus_owner, view.focus.is_focused(window));
              if !ready(&focus_owner) || focus_owner.borrow().epoch != epoch { return; }
              dispatch(&focus_owner, "host:focus", false, event_fields("host:focus"));
              if ready(&focus_owner) && focus_owner.borrow().epoch == epoch { view.drive(window, cx).unwrap_or_else(|error| throw_value(error)); }
              });
          });
          let blur_owner = owner_ref.clone();
          let on_blur = cx.on_blur(&focus, window, move |view, window, cx| {
              native_host_callback(&blur_owner, "blur", || {
              let epoch = blur_owner.borrow().epoch;
              if !ready(&blur_owner) || blur_owner.borrow().window_id != Some(window.window_handle().window_id()) { return; }
              #[cfg(feature = "experimental-focus-tree")] refresh_native_entry(&blur_owner, window);
              native_focus_fact(&blur_owner, view.focus.is_focused(window));
              if !ready(&blur_owner) || blur_owner.borrow().epoch != epoch { return; }
              text_blur(&blur_owner, window, cx);
              dispatch(&blur_owner, "host:blur", false, event_fields("host:blur"));
              if ready(&blur_owner) && blur_owner.borrow().epoch == epoch { view.drive(window, cx).unwrap_or_else(|error| throw_value(error)); }
              });
          });
          vec![on_focus, on_blur]
          } else { Vec::new() };
          let global_key_capture = subscribe_global_key_capture(&owner_ref, cx);
          let window_input = window_input_needed(&owner_ref).then(|| cx.focus_handle().tab_stop(false));
          let focus_lost = window_input.as_ref().map(|_| cx.on_focus_lost(window, |view, window, cx| { let owner=view.owner.clone(); native_host_callback(&owner, "focus-lost", || { if view.owner.borrow().window_id == Some(window.window_handle().window_id()) { if let Some(focus) = &view.window_input { restore_window_input(&view.owner, focus, window, cx); } } }); }));
          let mut view = Self { owner: owner_ref, focus, window_input, _focus_subscriptions: focus_subscriptions, _window_activation: None, _focus_lost: focus_lost, _global_key_capture: global_key_capture, _entry_readiness: None };
          view.bind_window_activation(window, cx);
          view
          })
      }
      #[cfg(feature="test-support")]
      pub fn native_resource_counts(&self) -> Json { let mut counts=native::gpui_native_owner::native_resource_counts(&self.owner); counts["nativeSubscriptions"] = Json::from(self._focus_subscriptions.len() + usize::from(self._window_activation.is_some()) + usize::from(self._focus_lost.is_some()) + usize::from(self._global_key_capture.is_some()) + usize::from(self._entry_readiness.is_some())); counts }
      pub fn handle(&self) -> ${componentName}Handle { ${componentName}Handle { owner: self.owner.clone() } }
      pub fn set_props(&mut self, raw: Json, window: &mut Window, cx: &mut Context<Self>) -> Result<(), Value> { catch_authored(|| replace_props(&self.owner, raw))?; self.drive(window, cx) }
      pub fn set_slot(&mut self, slot: Vec<native::gpui_native_owner::NativeSnapshot>, cx: &mut Context<Self>) -> Result<(), Value> { catch_authored(|| { ensure(&Rc::downgrade(&self.owner)); assert_native_slot_children(&slot); let mut owner = self.owner.borrow_mut(); owner.slot = slot; owner.dirty = true; cx.notify(); }) }
      pub fn set_parent(&mut self, parent: Option<OwnerWeak>, cx: &mut Context<Self>) -> Result<(), Value> { catch_authored(|| { if let Err(error)=set_native_parent(&self.owner, parent.unwrap_or_default()){throw_error("NATIVE_PARENT_INVALID", error)} cx.notify(); }) }
      fn bind_window_activation(&mut self, window: &mut Window, cx: &mut Context<Self>) {
          if !native_focus_observation_needed(&self.owner) && !native::gpui_native_move::move_owner_has_binding(&self.owner) { self._window_activation.take(); return; }
          let id = window.window_handle().window_id();
          if self._window_activation.as_ref().is_some_and(|(bound, _)| *bound == id) { return; }
          self._window_activation.take();
          let owner = self.owner.clone();
          let subscription = cx.observe_window_activation(window, move |view, window, cx| {
              native_host_callback(&owner, "window-activation", || {
                  if owner.borrow().window_id == Some(window.window_handle().window_id()) && !window.is_window_active() {
                      native_window_blur(&owner);
                      view.drive(window, cx).unwrap_or_else(|error| throw_value(error));
                  }
              });
          });
          self._window_activation = Some((id, subscription));
      }
      #[cfg(feature = "experimental-focus-tree")]
      fn bind_entry_readiness(&mut self, window: &mut Window, cx: &mut Context<Self>) {
          if !self.owner.borrow().modules.hooks.contains("focus-entry") { return; }
          let window_id = window.window_handle().window_id();
          if self._entry_readiness.as_ref().is_some_and(|(bound, _)| *bound == window_id) { return; }
          self._entry_readiness.take();
          let view = cx.entity().downgrade();
          let subscription = window.observe_focus_tree(cx, move |_, window, cx| {
              let _ = view.update(cx, |view, cx| {
                  if view._entry_readiness.as_ref().is_some_and(|(bound, _)| *bound == window.window_handle().window_id()) { if let Err(error)=view.drive(window, cx){report_native_failure(&view.owner,"entry-readiness",error)} }
              });
          });
          self._entry_readiness = Some((window_id, subscription));
      }
      pub fn drive(&mut self, window: &mut Window, cx: &mut Context<Self>) -> Result<(), Value> {
          catch_authored(|| {
          if self.owner.borrow().disposed { self._entry_readiness.take(); self._window_activation.take(); self._focus_subscriptions.clear(); self._focus_lost.take(); self._global_key_capture.take(); cx.notify(); return; }
          modules_drive(&self.owner, &self.focus, window, cx);
          if self.owner.borrow().disposed { self._entry_readiness.take(); self._window_activation.take(); self._focus_subscriptions.clear(); self._focus_lost.take(); self._global_key_capture.take(); cx.notify(); return; }
          self.focus = self.focus.clone().tab_stop(native_tab_participation(&self.owner));
          drive_queued_focus(&self.owner, window, cx);
          let dirty = std::mem::take(&mut self.owner.borrow_mut().dirty); if dirty { cx.notify(); }
          })
      }
  }
  impl Drop for ${componentName} { fn drop(&mut self) { native_host_callback(&self.owner, "drop", || Owner::dispose(&self.owner)); } }
  impl gpui::Focusable for ${componentName} { fn focus_handle(&self, _: &App) -> FocusHandle { self.focus.clone() } }
  impl Render for ${componentName} {
      fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
          let report_owner = self.owner.clone();
          native_host_callback(&report_owner, "render", || {
          refresh_native_atoms(&self.owner, window, cx);
          Owner::project(&self.owner);
          if self.owner.borrow().disposed { self._entry_readiness.take(); self._window_activation.take(); return gpui::div().into_any_element(); }
          if !self.owner.borrow().present { self._window_activation.take(); detach_native_view(&self.owner); return gpui::div().into_any_element(); }
          bind_native_focus_window(&self.owner, window);
          self.bind_window_activation(window, cx);
          #[cfg(feature = "experimental-focus-tree")] self.bind_entry_readiness(window, cx);
          let drive = self.owner.borrow().native_drive.as_ref().expect("live native owner drive").clone();
          self.owner.borrow_mut().dirty = false;
          let snapshot = self.owner.borrow().projection.clone().expect("live native projection");
          self.focus = self.focus.clone().tab_stop(native_tab_participation(&self.owner));
          let element = paint_native_root(&snapshot, &self.owner, &self.focus, format!("compiled-root-{}", Rc::as_ptr(&self.owner) as usize), drive);
          if let Some(focus) = &self.window_input { window_input_scope(element, focus, &self.owner) } else { element }
          }).unwrap_or_else(|| gpui::div().into_any_element())
      }
  }
  `;
  const styleFixture = nativeStyle.files.find(
    (file) => file.path === '.proto-ui/fixtures/style-tokens.json'
  )!;
  const useWorkspace = options.gpuiDependency === 'workspace';
  const manifest = gpuiComponentCargoManifest(
    code,
    styleFixture.contents,
    staticArtifacts,
    options.nativeSdkPath ?? GPUI_NATIVE_SDK_PATH,
    useWorkspace
  );
  if (diagnostics.length) return { ok: false, diagnostics };
  return {
    ok: true,
    value: {
      code,
      profile: 'gpui-source-v1',
      supportingFiles: [
        { path: 'Cargo.toml', kind: 'source', contents: manifest },
        ...(options.nativeSdkPath === undefined ? gpuiNativeSdkFiles(useWorkspace) : []),
        styleFixture,
        ...staticArtifacts.map(({ path, kind, contents }) => ({ path, kind, contents })),
      ],
      dependencies: TARGET_PROFILES['gpui-source-v1'].dependencies.map((entry) =>
        useWorkspace && entry.name === 'gpui' ? { ...entry, version: 'workspace' } : entry
      ),
      provenance: {
        source: ir.source,
        irVersion: ir.schemaVersion,
        backend: 'gpui-source-v1',
        nativeSdk: {
          ...gpuiNativeSdkIdentity(useWorkspace),
          path: options.nativeSdkPath ?? GPUI_NATIVE_SDK_PATH,
          bundled: options.nativeSdkPath === undefined,
        },
      },
    },
  };
}
