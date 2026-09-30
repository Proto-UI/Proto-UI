import { OPERATION_RULES } from './operations';
import { validateNativeInteraction } from './native-interaction';
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
  | 'flutter-source-v1';
export type HostCapability = 'view-render' | 'input-events' | 'focus-target' | 'accessibility-tree' | 'style-projection' | 'context-scope';

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
}
export interface TargetSelection {
  profile?: string;
  framework?: FrameworkId;
  version?: string;
  mode?: TargetMode;
  /** Restrict the available host; omission uses the profile's declared host. */
  hostCapabilities?: readonly HostCapability[];
  span?: SourceSpan;
}

const nativeOperations: readonly Operation[] = Object.freeze([
  'run.update',
  'style.tw', 'rule.declare', 'rule.dispose',
  'feedback.style.use', 'feedback.style.release', 'feedback.style.patch', 'feedback.style.suppress', 'feedback.style.clearPatch',
  'props.define', 'props.setDefaults', 'props.watch', 'props.get', 'props.getRaw', 'props.isProvided',
  'hook.asTrigger', 'hook.asFocusable', 'hook.asAccessible',
  'event.on', 'event.onGlobal', 'event.requestDefaultActionPrevention',
  'focus.configure', 'focus.setDisabled', 'focus.focusSelf',
  'accessible.state', 'accessible.action', 'accessible.role', 'accessible.nameFromContent',
  'state.bool', 'state.string', 'state.numberDiscrete', 'state.numberRange', 'state.get', 'state.set',
  'expose.state', 'expose.event', 'expose.method', 'expose.emit',
  'lifecycle.setPresent', 'lifecycle.onCreated', 'lifecycle.onMounted', 'lifecycle.onUpdated',
  'lifecycle.onUnmounted', 'lifecycle.onBeforeDispose',
  'render.el', 'render.slot',
  'render.read.props.get', 'render.read.props.getRaw', 'render.read.props.isProvided',
  'context.provide', 'context.subscribe', 'context.trySubscribe',
  'context.read', 'context.tryRead', 'context.update', 'context.tryUpdate',
  'render.read.context.read', 'render.read.context.tryRead',
]);
const reactDependencies: readonly TargetDependency[] = Object.freeze([
  Object.freeze({ name: 'react', version: '19.2.6', role: 'target' as const }),
  Object.freeze({ name: 'react-dom', version: '19.2.6', role: 'target' as const }),
]);
const nativeSharedHelpers: readonly TargetHelper[] = Object.freeze([
  { name: '.proto-ui/context/scope-v1.ts', version: '1', classification: 'native-lowering', delivery: 'supporting-file' },
  { name: '.proto-ui/style/native-v1.ts', version: '1', classification: 'native-lowering', delivery: 'supporting-file' },
  { name: '.proto-ui/interaction/native-v1.ts', version: '1', classification: 'native-lowering', delivery: 'supporting-file' },
]);
const nativeHostCapabilities: readonly HostCapability[] = Object.freeze([
  'view-render', 'context-scope', 'style-projection', 'input-events', 'focus-target', 'accessibility-tree',
]);
function freezeProfile(profile: TargetProfile): TargetProfile {
  return Object.freeze({
    ...profile,
    operations: Object.freeze([...profile.operations]),
    hostCapabilities: Object.freeze([...profile.hostCapabilities]),
    dependencies: Object.freeze(profile.dependencies.map((dependency) => Object.freeze(dependency))),
    helpers: Object.freeze(profile.helpers.map((helper) => Object.freeze(helper))),
  });
}
function unimplemented(framework: Exclude<FrameworkId, 'react'>): TargetProfile {
  return freezeProfile({
    id: `${framework}-source-v1`, framework, version: null, mode: 'source', implemented: false,
    operations: [], hostCapabilities: [], dependencies: [], helpers: [],
  });
}

/** The only target registry: future identities are explicit metadata, never emitter fallbacks. */
export const TARGET_PROFILES: Readonly<Record<TargetProfileId, TargetProfile>> = Object.freeze({
  'react-runtime-v1': freezeProfile({
    id: 'react-runtime-v1', framework: 'react', version: '19.2.6', mode: 'runtime-backed',
    implemented: true, operations: Object.keys(OPERATION_RULES) as Operation[],
    hostCapabilities: ['view-render', 'input-events', 'focus-target', 'accessibility-tree', 'style-projection','context-scope'],
    dependencies: [
      ...reactDependencies,
      { name: '@proto.ui/core', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
      { name: '@proto.ui/hooks', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
      { name: '@proto.ui/adapter-react', version: '0.3.0-alpha.1', role: 'host-bridge' },
    ],
    helpers: [
      { name: '@proto.ui/core', version: '0.3.0-alpha.1', classification: 'semantic-runtime', delivery: 'dependency' },
      { name: '@proto.ui/hooks', version: '0.3.0-alpha.1', classification: 'semantic-runtime', delivery: 'dependency' },
      { name: '@proto.ui/adapter-react', version: '0.3.0-alpha.1', classification: 'host-bridge', delivery: 'dependency' },
    ],
  }),
  'react-dom-source-v1': freezeProfile({
    id: 'react-dom-source-v1', framework: 'react', version: '19.2.6', mode: 'source',
    implemented: true, operations: nativeOperations, hostCapabilities: nativeHostCapabilities,
    dependencies: reactDependencies,
    helpers: [
      { name: 'createOwner', version: '1', classification: 'native-lowering', delivery: 'inline' },
      { name: 'resolveProps', version: '1', classification: 'native-lowering', delivery: 'inline' },
      { name: 'createState', version: '1', classification: 'native-lowering', delivery: 'inline' },
      { name: 'element', version: '1', classification: 'native-lowering', delivery: 'inline' },
      ...nativeSharedHelpers,
    ],
  }),
  'vue-source-v1': freezeProfile({
    id: 'vue-source-v1', framework: 'vue', version: '3.5.31', mode: 'source', implemented: true,
    operations: nativeOperations, hostCapabilities: nativeHostCapabilities,
    dependencies: [{name:'vue',version:'3.5.31',role:'target'}],
    helpers: [{name:'createOwner',version:'1',classification:'native-lowering',delivery:'inline'}, ...nativeSharedHelpers],
  }),
  'vue2-source-v1': freezeProfile({
    id: 'vue2-source-v1', framework: 'vue2', version: '2.6.14', mode: 'source', implemented: true,
    operations: nativeOperations, hostCapabilities: nativeHostCapabilities,
    dependencies: [{name:'vue',version:'2.6.14',role:'target'}],
    helpers: [{name:'createOwner',version:'1',classification:'native-lowering',delivery:'inline'}, ...nativeSharedHelpers],
  }),
  'web-component-source-v1': freezeProfile({
    id: 'web-component-source-v1', framework: 'web-component', version: 'custom-elements-v1', mode: 'source', implemented: true,
    operations: nativeOperations, hostCapabilities: nativeHostCapabilities,
    dependencies: [],
    helpers: [{name:'createOwner',version:'1',classification:'native-lowering',delivery:'inline'}, ...nativeSharedHelpers],
  }),
  'gpui-source-v1': unimplemented('gpui'),
  'qt-source-v1': unimplemented('qt'),
  'flutter-source-v1': unimplemented('flutter'),
});

const selectionSpan: SourceSpan = {
  file: '<target>', start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1,
};
function unsupported<T>(code: string, message: string, span: SourceSpan): CompileResult<T> {
  return { ok: false, diagnostics: [{ code, category: 'unsupported-input', message, span }] };
}

export function resolveTargetProfile(
  selection: string | TargetSelection = 'react-runtime-v1'
): CompileResult<TargetProfile> {
  const options: TargetSelection = typeof selection === 'string' ? { profile: selection } : selection;
  const span = options.span ?? selectionSpan;
  const framework = options.framework ?? 'react';
  const id = options.profile ?? (framework === 'react'
    ? options.mode === 'source' ? 'react-dom-source-v1' : 'react-runtime-v1'
    : `${framework}-source-v1`);
  const profile = Object.hasOwn(TARGET_PROFILES, id) ? TARGET_PROFILES[id as TargetProfileId] : undefined;
  if (!profile) return unsupported('PUI4001', `Unknown target profile ${JSON.stringify(id)}. Choose an implemented profile explicitly; no implicit fallback is available.`, span);
  if (!profile.implemented) return unsupported('PUI4001', `Target profile ${id} identifies ${profile.framework}, but no working emitter is implemented. Choose an implemented profile explicitly.`, span);
  if ((options.framework && options.framework !== profile.framework) || (options.mode && options.mode !== profile.mode)) {
    return unsupported('PUI4001', `Profile ${id} targets ${profile.framework} in ${profile.mode} mode; select a matching framework/mode instead of requesting an implicit bridge.`, span);
  }
  if (options.version !== undefined && options.version !== profile.version) {
    return unsupported('PUI4002', `Profile ${id} supports the concrete target version ${profile.version}; requested ${JSON.stringify(options.version)} has not been admitted.`, span);
  }
  if (options.hostCapabilities) {
    for (const capability of options.hostCapabilities) {
      if (!profile.hostCapabilities.includes(capability)) return unsupported('PUI4004', `Profile ${id} does not implement host capability ${JSON.stringify(capability)}. Supplying a capability name cannot enable an unimplemented lowering.`, span);
    }
    return { ok: true, value: freezeProfile({ ...profile, hostCapabilities: [...new Set(options.hostCapabilities)] }) };
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
interface HelperBinding {
  fn: FunctionIR;
  scope: Scope;
}
type Scope = Map<string, HelperBinding | undefined>;

/** Check the reached semantic call graph, not filenames, source hashes or requirements labels.
 * Both dynamic branches are conservatively reached; function declarations are reached on use.
 * Callbacks and the returned render function are entry points even if not invoked during setup.
 * The input is checked semantic IR; structural/type validation remains the preceding stage.
 */
export function checkTargetOperations(
  ir: PrototypeIR,
  profile: TargetProfile
): CompileResult<TargetOperationAnalysis> {
  const resolved = resolveTargetProfile({
    profile: profile.id, framework: profile.framework, mode: profile.mode,
    ...(profile.version === null ? {} : { version: profile.version }),
    hostCapabilities: profile.hostCapabilities, span: ir.setup.span,
  });
  if (!resolved.ok) return resolved;
  const selected = resolved.value;
  const allowed = new Set(selected.operations);
  const capabilities = new Set(selected.hostCapabilities);
  const operations = new Set<Operation>();
  const sites: { operation: Operation; span: SourceSpan }[] = [];
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook]));
  const reachedHooks = new Set<string>();
  const activeHooks = new Set<string>();
  const reachedFunctions = new Set<FunctionIR>();
  const activeFunctions = new Set<FunctionIR>();
  const diagnostics: CompilerDiagnostic[] = [];
  function diagnostic(code: string, message: string, span: SourceSpan): void {
    diagnostics.push({ code, category: 'unsupported-input', message, span });
  }
  function fn(value: FunctionIR, outer: Scope): void {
    if (activeFunctions.has(value)) {
      diagnostic('PUI4005', 'Recursive function expansion is not supported by this target. Remove the recursive helper call.', value.span);
      return;
    }
    if (reachedFunctions.has(value)) return;
    reachedFunctions.add(value);
    activeFunctions.add(value);
    const scope = new Map(outer);
    for (const parameter of value.parameters) scope.set(parameter.name, undefined);
    statements(value.body, scope);
    activeFunctions.delete(value);
  }
  function expression(value: ExpressionIR, scope: Scope): void {
    switch (value.kind) {
      case 'literal': return;
      case 'style-handle':
        operations.add('style.tw'); sites.push({operation:'style.tw',span:value.span});
        if (!allowed.has('style.tw')) diagnostic('PUI4003',`Static style handles are not implemented by ${selected.id}.`,value.span);
        return;
      case 'rule':
        operations.add('rule.declare'); sites.push({operation:'rule.declare',span:value.span});
        if (!allowed.has('rule.declare')) diagnostic('PUI4003',`Declarative Rule projection is not implemented by ${selected.id}.`,value.span);
        else if (!capabilities.has('style-projection')) diagnostic('PUI4004',`Rule projection requires host capability style-projection, which is unavailable in ${selected.id}.`,value.span);
        expression(value.receiver,scope);
        for (const state of value.states) expression(state.value,scope);
        return;
      case 'context-key':
        if (!capabilities.has('context-scope')) diagnostic('PUI4007', `Context key ${JSON.stringify(value.keyId)} requires a declared logical Context scope in ${selected.id}.`, value.span);
        return;
      case 'reference': {
        const binding = scope.get(value.name);
        if (binding) fn(binding.fn, binding.scope);
        return;
      }
      case 'member': expression(value.object, scope); return;
      case 'unary': expression(value.operand, scope); return;
      case 'binary': expression(value.left, scope); expression(value.right, scope); return;
      case 'array': for (const element of value.elements) expression(element, scope); return;
      case 'record':
        if (value.type === 'template-props' && !capabilities.has('style-projection'))
          diagnostic('PUI4004', `TemplateStyleHandle requires host capability style-projection, which is unavailable in ${selected.id}.`, value.span);
        for (const entry of value.entries) expression(entry.value, scope);
        return;
      case 'function': fn(value.function, scope); return;
      case 'helper-call': {
        for (const argument of value.arguments) expression(argument, scope);
        const binding = scope.get(value.name);
        if (!binding) diagnostic('PUI4005', `Helper ${JSON.stringify(value.name)} has no admitted semantic function body. Declare a static helper; opaque Module or capability functions cannot be lowered.`, value.span);
        else fn(binding.fn, binding.scope);
        return;
      }
      case 'authored-hook': {
        const hook = hooks.get(value.hookId);
        if (!hook) diagnostic('PUI4006', `Authored hook ${JSON.stringify(value.hookId)} has no semantic body. Include its static source graph before choosing a target.`, value.span);
        else if (activeHooks.has(hook.id)) diagnostic('PUI4006', `Recursive authored hook ${JSON.stringify(hook.id)} cannot be expanded. Remove the recursive composition.`, value.span);
        else if (!reachedHooks.has(hook.id)) {
          reachedHooks.add(hook.id);
          activeHooks.add(hook.id);
          fn(hook.setup, new Map());
          activeHooks.delete(hook.id);
        }
        return;
      }
      case 'operation': {
        operations.add(value.operation);
        sites.push({ operation: value.operation, span: value.span });
        if (!allowed.has(value.operation)) {
          const action = selected.mode === 'source'
            ? 'Choose react-runtime-v1 explicitly if its bridge cost is acceptable, or remove this operation; native output never falls back to Runtime/Adapter.'
            : 'Use an operation with an admitted compiler contract; an Adapter manifest cannot enable an unknown Module operation.';
          diagnostic('PUI4003', `Operation ${value.operation} is not implemented by ${selected.id}. ${action}`, value.span);
        } else {
          const rule = OPERATION_RULES[value.operation];
          for (const capability of rule.requiredCapabilities) {
            if (!capabilities.has(capability as HostCapability)) diagnostic('PUI4004', `Operation ${value.operation} requires host capability ${capability}, which is unavailable in ${selected.id}. Select a host/profile that implements this capability.`, value.span);
          }
        }
        if (value.receiver) expression(value.receiver, scope);
        for (const argument of value.arguments) expression(argument, scope);
        return;
      }
    }
  }
  function statements(body: readonly StatementIR[], scope: Scope): void {
    for (const statement of body) {
      switch (statement.kind) {
        case 'const':
          if (statement.value.kind === 'function') {
            scope.set(statement.name, { fn: statement.value.function, scope: new Map(scope) });
          } else {
            const binding = statement.value.kind === 'reference' ? scope.get(statement.value.name) : undefined;
            if (!binding) expression(statement.value, scope);
            scope.set(statement.name, binding);
          }
          break;
        case 'effect': expression(statement.expression, scope); break;
        case 'if':
          expression(statement.condition, scope);
          statements(statement.then, new Map(scope));
          statements(statement.otherwise, new Map(scope));
          break;
        case 'return':
          if (statement.value) expression(statement.value, scope);
          return;
      }
    }
  }
  fn(ir.setup, new Map());
  if (selected.mode === 'source') diagnostics.push(...validateNativeInteraction(ir, reachedFunctions));
  return diagnostics.length
    ? { ok: false, diagnostics }
    : { ok: true, value: { profile: selected, operations: [...operations], sites, authoredHooks: [...reachedHooks], functions: [...reachedFunctions] } };
}
