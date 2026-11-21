import { pruneDeadValues } from './demand-pruning';
import { traceCallableDemand } from './callable-effects';
import { OPERATION_RULES } from './operations';
import { validateNativeInteraction } from './native-interaction';
import { GPUI_NATIVE_SDK_VERSION } from './gpui-native-sdk';
import { GPUI_UNAVAILABLE_OPERATIONS, GPUI_MISSING_FOCUS_TREE } from './gpui-capabilities';
import {
  observableSemantics,
  type ObservableSemantics,
  type PropsUpdatePolicy,
} from './observable-semantics';
import type {
  CompileResult,
  CompilerDiagnostic,
  ExpressionIR,
  FunctionIR,
  Operation,
  PrototypeIR,
  SourceSpan,
  StatementIR,
} from './ir';

export type FrameworkId = 'react' | 'vue' | 'vue2' | 'web-component' | 'gpui' | 'qt' | 'flutter';
export type TargetMode = 'runtime-backed' | 'source';
export type TargetProfileId =
  | 'react-runtime-v1'
  | 'react-dom-source-v1'
  | 'vue-source-v1'
  | 'vue2-source-v1'
  | 'web-component-source-v1'
  | 'gpui-source-v1'
  | 'qt-source-v1'
  | 'flutter-source-v1'
  | 'react-dom-ssr-v1'
  | 'vue-ssr-v1'
  | 'vue2-ssr-v1'
  | 'web-component-ssr-v1';
export type HostCapability =
  | 'view-render'
  | 'input-events'
  | 'focus-target'
  | 'accessibility-tree'
  | 'style-projection'
  | 'context-scope';

export interface TargetDependency {
  readonly name: string;
  readonly version: string;
  readonly role: 'target' | 'host-bridge' | 'semantic-runtime';
}
export interface TargetHelper {
  readonly name: string;
  readonly version: string;
  readonly classification: 'semantic-runtime' | 'host-bridge' | 'native-lowering';
  readonly delivery: 'dependency' | 'inline' | 'supporting-file';
}
export interface TargetProfile {
  readonly id: TargetProfileId;
  readonly framework: FrameworkId;
  /** A concrete consumer version, not a claim about all versions of this framework. */
  readonly version: string | null;
  readonly mode: TargetMode;
  readonly implemented: boolean;
  readonly operations: readonly Operation[];
  readonly hostCapabilities: readonly HostCapability[];
  readonly dependencies: readonly TargetDependency[];
  readonly helpers: readonly TargetHelper[];
  readonly observableSemantics: ObservableSemantics;
}
export interface TargetSelection {
  profile?: string;
  framework?: FrameworkId;
  version?: string;
  mode?: TargetMode;
  /** Host policy is an explicit update request after changed input, never a Props-channel effect. */
  propsUpdatePolicy?: PropsUpdatePolicy;
  /** Restrict the available host; omission uses the profile's declared host. */
  hostCapabilities?: readonly HostCapability[];
  span?: SourceSpan;
}

const nativeOperations: readonly Operation[] = Object.freeze([
  'scheduler.delay',
  'delay.cancel',
  'presence.owner',
  'presence.onCompletionRequest',
  'presence.publish',
  'presence.settle',
  'presence.isCurrent',
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
  'subscription.release',
  'binding.release',
  'props.define',
  'props.setDefaults',
  'props.watch',
  'props.get',
  'props.getRaw',
  'props.isProvided',
  'hook.asTrigger',
  'hook.asFocusable',
  'hook.asAccessible',
  'hook.asFocusEntry',
  'hook.asFocusScope',
  'hook.asFocusRoving',
  'hook.asOverlay',
  'hook.asScrollSurface',
  'hook.asTextControl',
  'hook.asImageView',
  'hook.asTableStructure',
  'hook.asBoundary',
  'hook.asHitParticipation',
  'hook.asCollection',
  'hook.asCollectionItem',
  'event.on',
  'event.onGlobal',
  'event.requestDefaultActionPrevention',
  'focus.configure',
  'focus.setDisabled',
  'focus.focusSelf',
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
  'focusScope.getRoving',
  'focusEntry.configure',
  'focusEntry.focus',
  'focusEntry.setDisabled',
  'focusScope.configure',
  'focusRoving.configure',
  'focusRoving.focusFirst',
  'focusRoving.focusLast',
  'focusRoving.focusNext',
  'focusRoving.focusPrev',
  'focusRoving.focusSelected',
  'accessible.state',
  'accessible.action',
  'accessible.role',
  'accessible.nameFromContent',
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
  'collection.configure',
  'collection.getItems',
  'collection.getCount',
  'collectionItem.configure',
  'collectionItem.getSnapshot',
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
  'scroll.configure',
  'scroll.bindComposedChrome',
  'scroll.request',
  'scroll.getSnapshot',
  'textControl.on',
  'textControl.sync',
  'textControl.snapshot',
  'imageView.on',
  'imageView.sync',
  'imageView.snapshot',
  'positioning.connect',
  'positioning.update',
  'positioning.requestUpdate',
  'positioning.disconnect',
  'positioning.getSnapshot',
  'state.bool',
  'state.string',
  'state.enum',
  'state.numberDiscrete',
  'state.numberRange',
  'state.get',
  'state.set',
  'state.setDefault',
  'state.watch',
  'expose.state',
  'expose.event',
  'expose.method',
  'expose.emit',
  'expose.value',
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
]);
const reactDependencies: readonly TargetDependency[] = Object.freeze([
  Object.freeze({ name: 'react', version: '19.2.6', role: 'target' as const }),
  Object.freeze({ name: 'react-dom', version: '19.2.6', role: 'target' as const }),
]);
const nativeSharedHelpers: readonly TargetHelper[] = Object.freeze([
  {
    name: '.proto-ui/context/scope-v1.ts',
    version: '1',
    classification: 'native-lowering',
    delivery: 'supporting-file',
  },
  {
    name: '.proto-ui/style/native-v1.ts',
    version: '1',
    classification: 'native-lowering',
    delivery: 'supporting-file',
  },
  {
    name: '.proto-ui/interaction/native-v1.ts',
    version: '1',
    classification: 'native-lowering',
    delivery: 'supporting-file',
  },
  {
    name: '.proto-ui/interaction/adapter-modules-v1.ts',
    version: '1',
    classification: 'native-lowering',
    delivery: 'supporting-file',
  },
]);
const floatingUiDependency: readonly TargetDependency[] = Object.freeze([
  Object.freeze({ name: '@floating-ui/dom', version: '1.8.0', role: 'target' as const }),
]);
const nativeHostCapabilities: readonly HostCapability[] = Object.freeze([
  'view-render',
  'context-scope',
  'style-projection',
  'input-events',
  'focus-target',
  'accessibility-tree',
]);
function freezeProfile(
  profile: Omit<TargetProfile, 'observableSemantics'> & {
    observableSemantics?: ObservableSemantics;
  }
): TargetProfile {
  return Object.freeze({
    ...profile,
    observableSemantics:
      profile.observableSemantics ?? observableSemantics(profile.framework, profile.mode),
    operations: Object.freeze([...profile.operations]),
    hostCapabilities: Object.freeze([...profile.hostCapabilities]),
    dependencies: Object.freeze(
      profile.dependencies.map((dependency) => Object.freeze(dependency))
    ),
    helpers: Object.freeze(profile.helpers.map((helper) => Object.freeze(helper))),
  });
}
function unimplemented(framework: Exclude<FrameworkId, 'react'>): TargetProfile {
  return freezeProfile({
    id: `${framework}-source-v1`,
    framework,
    version: null,
    mode: 'source',
    implemented: false,
    operations: [],
    hostCapabilities: [],
    dependencies: [],
    helpers: [],
  });
}

const webOperations: readonly Operation[] = Object.freeze([
  ...nativeOperations,
  'accessible.part',
  'eventControl.requestDefaultActionPrevention',
  'hook.asControlLabel',
  'controlLabel.label',
  'controlLabel.target',
  'controlLabel.sync',
  'controlLabelRequest.isCurrent',
]);

/** The only target registry: future identities are explicit metadata, never emitter fallbacks. */
export const TARGET_PROFILES: Readonly<Record<TargetProfileId, TargetProfile>> = Object.freeze({
  'react-runtime-v1': freezeProfile({
    id: 'react-runtime-v1',
    framework: 'react',
    version: '19.2.6',
    mode: 'runtime-backed',
    implemented: true,
    operations: Object.keys(OPERATION_RULES) as Operation[],
    hostCapabilities: [
      'view-render',
      'input-events',
      'focus-target',
      'accessibility-tree',
      'style-projection',
      'context-scope',
    ],
    dependencies: [
      ...reactDependencies,
      { name: '@proto.ui/core', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
      { name: '@proto.ui/hooks', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
      { name: '@proto.ui/adapter-react', version: '0.3.0-alpha.1', role: 'host-bridge' },
    ],
    helpers: [
      {
        name: '@proto.ui/core',
        version: '0.3.0-alpha.1',
        classification: 'semantic-runtime',
        delivery: 'dependency',
      },
      {
        name: '@proto.ui/hooks',
        version: '0.3.0-alpha.1',
        classification: 'semantic-runtime',
        delivery: 'dependency',
      },
      {
        name: '@proto.ui/adapter-react',
        version: '0.3.0-alpha.1',
        classification: 'host-bridge',
        delivery: 'dependency',
      },
    ],
  }),
  'react-dom-source-v1': freezeProfile({
    id: 'react-dom-source-v1',
    framework: 'react',
    version: '19.2.6',
    mode: 'source',
    implemented: true,
    operations: webOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: [...reactDependencies, ...floatingUiDependency],
    helpers: [
      { name: 'createOwner', version: '1', classification: 'native-lowering', delivery: 'inline' },
      { name: 'resolveProps', version: '1', classification: 'native-lowering', delivery: 'inline' },
      { name: 'createState', version: '1', classification: 'native-lowering', delivery: 'inline' },
      { name: 'element', version: '1', classification: 'native-lowering', delivery: 'inline' },
      ...nativeSharedHelpers,
    ],
  }),
  'vue-source-v1': freezeProfile({
    id: 'vue-source-v1',
    framework: 'vue',
    version: '3.5.31',
    mode: 'source',
    implemented: true,
    operations: webOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: [{ name: 'vue', version: '3.5.31', role: 'target' }, ...floatingUiDependency],
    helpers: [
      { name: 'createOwner', version: '1', classification: 'native-lowering', delivery: 'inline' },
      ...nativeSharedHelpers,
    ],
  }),
  'vue2-source-v1': freezeProfile({
    id: 'vue2-source-v1',
    framework: 'vue2',
    version: '2.6.14',
    mode: 'source',
    implemented: true,
    operations: webOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: [{ name: 'vue', version: '2.6.14', role: 'target' }, ...floatingUiDependency],
    helpers: [
      { name: 'createOwner', version: '1', classification: 'native-lowering', delivery: 'inline' },
      ...nativeSharedHelpers,
    ],
  }),
  'web-component-source-v1': freezeProfile({
    id: 'web-component-source-v1',
    framework: 'web-component',
    version: 'custom-elements-v1',
    mode: 'source',
    implemented: true,
    operations: webOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: floatingUiDependency,
    helpers: [
      { name: 'createOwner', version: '1', classification: 'native-lowering', delivery: 'inline' },
      ...nativeSharedHelpers,
    ],
  }),
  'gpui-source-v1': freezeProfile({
    id: 'gpui-source-v1',
    framework: 'gpui',
    version: 'git:62e5991dd0f0c8a3af8d5e7e9c4652490d468db8',
    mode: 'source',
    implemented: true,
    operations: nativeOperations.filter((operation) => !GPUI_UNAVAILABLE_OPERATIONS.has(operation)),
    hostCapabilities: nativeHostCapabilities,
    dependencies: [
      { name: 'gpui', version: 'git:62e5991dd0f0c8a3af8d5e7e9c4652490d468db8', role: 'target' },
      { name: 'serde', version: '1.0', role: 'target' },
      { name: 'serde_json', version: '1.0', role: 'target' },
      { name: 'proto-ui-gpui-native', version: GPUI_NATIVE_SDK_VERSION, role: 'host-bridge' },
      { name: 'unicode-segmentation', version: '=1.13.3', role: 'target' },
      { name: 'data-url', version: '=0.3.2', role: 'target' },
      { name: 'image', version: '=0.25.10', role: 'target' },
    ],
    helpers: [
      {
        name: 'proto-ui-gpui-native',
        version: GPUI_NATIVE_SDK_VERSION,
        classification: 'native-lowering',
        delivery: 'supporting-file',
      },
      {
        name: 'prototype-style-vocabulary',
        version: '1',
        classification: 'native-lowering',
        delivery: 'supporting-file',
      },
    ],
  }),
  'qt-source-v1': unimplemented('qt'),
  'flutter-source-v1': unimplemented('flutter'),
  'react-dom-ssr-v1': freezeProfile({
    id: 'react-dom-ssr-v1',
    framework: 'react',
    version: '19.2.6',
    mode: 'source',
    implemented: false,
    operations: nativeOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: [...reactDependencies, ...floatingUiDependency],
    helpers: nativeSharedHelpers,
  }),
  'vue-ssr-v1': freezeProfile({
    id: 'vue-ssr-v1',
    framework: 'vue',
    version: '3.5.31',
    mode: 'source',
    implemented: false,
    operations: nativeOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: [
      { name: 'vue', version: '3.5.31', role: 'target' },
      { name: '@vue/server-renderer', version: '3.5.31', role: 'target' },
      ...floatingUiDependency,
    ],
    helpers: nativeSharedHelpers,
  }),
  'vue2-ssr-v1': freezeProfile({
    id: 'vue2-ssr-v1',
    framework: 'vue2',
    version: '2.6.14',
    mode: 'source',
    implemented: false,
    operations: nativeOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: [
      { name: 'vue', version: '2.6.14', role: 'target' },
      { name: 'vue-server-renderer', version: '2.6.14', role: 'target' },
      ...floatingUiDependency,
    ],
    helpers: nativeSharedHelpers,
  }),
  'web-component-ssr-v1': freezeProfile({
    id: 'web-component-ssr-v1',
    framework: 'web-component',
    version: 'custom-elements-v1',
    mode: 'source',
    implemented: false,
    operations: nativeOperations,
    hostCapabilities: nativeHostCapabilities,
    dependencies: floatingUiDependency,
    helpers: nativeSharedHelpers,
  }),
});

const selectionSpan: SourceSpan = {
  file: '<target>',
  start: 0,
  end: 0,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};
function unsupported<T>(code: string, message: string, span: SourceSpan): CompileResult<T> {
  return { ok: false, diagnostics: [{ code, category: 'unsupported-input', message, span }] };
}

export function resolveTargetProfile(
  selection: string | TargetSelection = 'react-runtime-v1'
): CompileResult<TargetProfile> {
  const options: TargetSelection =
    typeof selection === 'string' ? { profile: selection } : selection;
  const span = options.span ?? selectionSpan;
  const framework = options.framework ?? 'react';
  const id =
    options.profile ??
    (framework === 'react'
      ? options.mode === 'source'
        ? 'react-dom-source-v1'
        : 'react-runtime-v1'
      : `${framework}-source-v1`);
  let profile = Object.hasOwn(TARGET_PROFILES, id)
    ? TARGET_PROFILES[id as TargetProfileId]
    : undefined;
  if (!profile)
    return unsupported(
      'PUI4001',
      `Unknown target profile ${JSON.stringify(id)}. Choose an implemented profile explicitly; no implicit fallback is available.`,
      span
    );
  if (!profile.implemented)
    return unsupported(
      'PUI4001',
      `Target profile ${id} identifies ${profile.framework}, but no working emitter is implemented. Choose an implemented profile explicitly.`,
      span
    );
  if (
    (options.framework && options.framework !== profile.framework) ||
    (options.mode && options.mode !== profile.mode)
  ) {
    return unsupported(
      'PUI4001',
      `Profile ${id} targets ${profile.framework} in ${profile.mode} mode; select a matching framework/mode instead of requesting an implicit bridge.`,
      span
    );
  }
  if (options.version !== undefined && options.version !== profile.version) {
    return unsupported(
      'PUI4002',
      `Profile ${id} supports the concrete target version ${profile.version}; requested ${JSON.stringify(options.version)} has not been admitted.`,
      span
    );
  }
  if (options.propsUpdatePolicy !== undefined) {
    if (!['explicit', 'host'].includes(options.propsUpdatePolicy)) {
      return unsupported(
        'PUI4008',
        `Unknown props update policy ${JSON.stringify(options.propsUpdatePolicy)}.`,
        span
      );
    }
    if (profile.framework === 'gpui' && options.propsUpdatePolicy !== 'explicit') {
      return unsupported(
        'PUI4008',
        'GPUI currently admits explicit props update intent only.',
        span
      );
    }
    profile = freezeProfile({
      ...profile,
      observableSemantics: observableSemantics(
        profile.framework,
        profile.mode,
        options.propsUpdatePolicy
      ),
    });
  }
  if (options.hostCapabilities) {
    for (const capability of options.hostCapabilities) {
      if (!profile.hostCapabilities.includes(capability))
        return unsupported(
          'PUI4004',
          `Profile ${id} does not implement host capability ${JSON.stringify(capability)}. Supplying a capability name cannot enable an unimplemented lowering.`,
          span
        );
    }
    return {
      ok: true,
      value: freezeProfile({
        ...profile,
        hostCapabilities: [...new Set(options.hostCapabilities)],
      }),
    };
  }
  return { ok: true, value: profile };
}

export interface TargetOperationAnalysis {
  readonly profile: TargetProfile;
  readonly operations: readonly Operation[];
  readonly sites: readonly { operation: Operation; span: SourceSpan }[];
  readonly authoredHooks: readonly string[];
  readonly functions: readonly FunctionIR[];
}
/** Calls, host callbacks and outward callables are invocation roots. Creation alone is inert. */
export function checkTargetOperations(
  input: PrototypeIR,
  profile: TargetProfile
): CompileResult<TargetOperationAnalysis> {
  const ir = pruneDeadValues(input);
  const resolved = resolveTargetProfile({
    profile: profile.id,
    framework: profile.framework,
    mode: profile.mode,
    propsUpdatePolicy: profile.observableSemantics.props.update,
    ...(profile.version === null ? {} : { version: profile.version }),
    hostCapabilities: profile.hostCapabilities,
    span: ir.setup.span,
  });
  if (!resolved.ok) return resolved;
  const selected = resolved.value;
  const allowed = new Set(selected.operations);
  const capabilities = new Set(selected.hostCapabilities);
  const operations = new Set<Operation>();
  const sites: { operation: Operation; span: SourceSpan }[] = [];
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook]));
  const reachedHooks = new Set<string>(),
    reachedFunctions = new Set<FunctionIR>();
  const visited = new Set<ExpressionIR>(),
    diagnostics: CompilerDiagnostic[] = [];
  let opaque = false;
  function diagnostic(code: string, message: string, span: SourceSpan) {
    diagnostics.push({ code, category: 'unsupported-input', message, span });
  }
  function operation(value: Operation, span: SourceSpan) {
    operations.add(value);
    sites.push({ operation: value, span });
    if (!allowed.has(value)) {
      if (selected.id === 'gpui-source-v1' && GPUI_UNAVAILABLE_OPERATIONS.has(value))
        diagnostic('PUI_GPUI_SDK_CAPABILITY', `${value}: ${GPUI_MISSING_FOCUS_TREE}`, span);
      else
        diagnostic(
          'PUI4003',
          `Operation ${value} is not implemented by ${selected.id}. Select an explicit supported profile; native output never falls back to Runtime/Adapter.`,
          span
        );
      return;
    }
    for (const required of OPERATION_RULES[value].requiredCapabilities)
      if (!capabilities.has(required as HostCapability))
        diagnostic(
          'PUI4004',
          `Operation ${value} requires host capability ${required}, which is unavailable in ${selected.id}.`,
          span
        );
  }
  function expression(value: ExpressionIR) {
    if (visited.has(value)) return;
    visited.add(value);
    switch (value.kind) {
      case 'operation':
        operation(value.operation, value.span);
        break;
      case 'style-handle':
        operation('style.tw', value.span);
        break;
      case 'rule':
        operation('rule.declare', value.span);
        break;
      case 'intrinsic':
        if (
          value.name === 'string' &&
          !['react', 'vue', 'vue2', 'web-component'].includes(selected.framework)
        )
          diagnostic('PUI4003', `String coercion is not implemented by ${selected.id}.`, value.span);
        if (
          value.name === 'object.assign' &&
          !['react', 'vue', 'vue2', 'web-component'].includes(selected.framework)
        )
          diagnostic(
            'PUI4003',
            `Object.assign is not implemented by ${selected.id}.`,
            value.span
          );
        break;
      case 'context-key':
        if (!capabilities.has('context-scope'))
          diagnostic(
            'PUI4007',
            `Context key ${JSON.stringify(value.keyId)} requires a declared logical Context scope in ${selected.id}.`,
            value.span
          );
        break;
      case 'member':
        if (
          value.object.type === 'event' &&
          ['pointerType', 'pointerButtons'].includes(value.property) &&
          ![
            'react-runtime-v1',
            'react-dom-source-v1',
            'vue-source-v1',
            'vue2-source-v1',
            'web-component-source-v1',
          ].includes(selected.id)
        )
          diagnostic(
            'PUI4003',
            `Portable pointer sample facts are not implemented by ${selected.id}.`,
            value.span
          );
        break;
      case 'record':
        if (value.type === 'template-props' && !capabilities.has('style-projection'))
          diagnostic(
            'PUI4004',
            `TemplateStyleHandle requires host capability style-projection, which is unavailable in ${selected.id}.`,
            value.span
          );
        break;
    }
  }
  function hook(value: Extract<ExpressionIR, { kind: 'authored-hook' }>, recursive = false) {
    if (!hooks.has(value.hookId))
      diagnostic(
        'PUI4006',
        `Authored hook ${JSON.stringify(value.hookId)} has no semantic body.`,
        value.span
      );
    if (recursive)
      diagnostic(
        'PUI4006',
        `Recursive authored hook ${JSON.stringify(value.hookId)} cannot be installed.`,
        value.span
      );
    reachedHooks.add(value.hookId);
  }
  traceCallableDemand(ir, {
    expression,
    function: (fn) => reachedFunctions.add(fn),
    hook,
    opaque() {
      opaque = true;
    },
  });
  if (opaque) {
    // Unknown or recursive callable provenance never permits an elision proof.
    // Retain the checked native program conservatively; this is not a runtime fallback.
    function retain(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(retain);
        return;
      }
      const node = value as Record<string, unknown>;
      if (Array.isArray(node.body) && Array.isArray(node.parameters))
        reachedFunctions.add(value as FunctionIR);
      if (typeof node.kind === 'string' && node.span && node.type !== undefined)
        expression(value as ExpressionIR);
      if (node.kind === 'authored-hook')
        hook(value as Extract<ExpressionIR, { kind: 'authored-hook' }>);
      for (const [key, child] of Object.entries(node))
        if (!['type', 'span', 'captures', 'capture'].includes(key)) retain(child);
    }
    retain(ir.moduleBindings);
    retain(ir.setup);
    ir.hooks.forEach((item) => {
      retain(item.setup);
      retain(item.projectHandle);
      retain(item.configure);
    });
  }
  if (selected.mode === 'source')
    diagnostics.push(...validateNativeInteraction(ir, reachedFunctions));
  return diagnostics.length
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          profile: selected,
          operations: [...operations],
          sites,
          authoredHooks: [...reachedHooks],
          functions: [...reachedFunctions],
        },
      };
}
