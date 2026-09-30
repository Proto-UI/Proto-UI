import type { Phase, ValueType, FunctionContext } from './ir';
import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';

export type CallbackContext =
  | 'helper' | 'event' | 'props-watch' | 'context-watch' | 'context-update'
  | 'created' | 'mounted' | 'updated' | 'unmounted' | 'before-dispose' | 'expose-method';
export type SemanticResource =
  | 'props-schema' | 'props' | 'raw-props' | 'state' | 'expose' | 'context'
  | 'view-intent' | 'view' | 'event-route' | 'focus' | 'accessibility' | 'update-queue';
export interface OperationEffect {
  kind: 'read' | 'write' | 'declare' | 'subscribe' | 'signal' | 'request-update';
  resource: SemanticResource;
  scope: 'instance' | 'view' | 'subscription';
}
export interface CallbackRule {
  at: number;
  phase: Phase;
  parameters: readonly ValueType[];
  context: CallbackContext;
  minParameters: number;
  maxParameters: number;
  returnType: ValueType;
  /** Synchronous value updaters retain their caller's origin; they cannot launder disposal authority. */
  contextFrom?: 'caller';
  /** A declared method signature, or parameterized context-key data, overrides coarse legacy types. */
  parameterPolicy?: 'declared-method' | 'context-value' | 'nullable-context-value' | 'context-updater';
  acceptsValue?: boolean;
}
export type ArgumentRole =
  | 'value' | 'static-key' | 'static-keys' | 'prop-key' | 'declared-prop-keys'
  | 'state-handle' | 'receiver-value' | 'context-key' | 'context-value' | 'context-next'
  | 'callback' | 'event-payload' | 'template-argument';
export interface ArgumentRule {
  role: ArgumentRole;
  types?: readonly ValueType[];
  optional?: boolean;
  /** Fields are checked structurally; this is a data contract, not a TypeScript AST schema. */
  schema?: DataType;
  callback?: Omit<CallbackRule, 'at'>;
}
export interface OperationRule {
  receiver: ValueType;
  path: string;
  phases: readonly Phase[];
  result: ValueType;
  min: number;
  max: number;
  callback?: CallbackRule;
  arguments: readonly ArgumentRule[];
  effects: readonly OperationEffect[];
  requiredCapabilities: readonly string[];
  /** When present, permission requires a concrete callback origin, never an unqualified helper. */
  contexts?: readonly CallbackContext[];
  resultFrom?: 'receiver-value' | 'context-value' | 'context-value-or-null';
}

const setup: readonly Phase[] = ['setup'];
const callbackPhase: readonly Phase[] = ['callback'];
const runtime: readonly Phase[] = ['callback', 'render'];
const render: readonly Phase[] = ['render'];
const aliveContexts: readonly CallbackContext[] = [
  'event', 'props-watch', 'context-watch', 'created', 'mounted',
  'updated', 'unmounted', 'expose-method',
];
const key: ArgumentRule = { role: 'static-key', types: ['string'] };
const record: ArgumentRule = { role: 'value', types: ['record'] };
const boolean: ArgumentRule = { role: 'value', types: ['boolean'] };
const contextKey: ArgumentRule = { role: 'context-key' };
const stringSpec: DataType = { kind: 'record', fields: [
  { name: 'options', type: { kind: 'array', element: 'string' }, optional: true },
] };
const discreteSpec: DataType = { kind: 'record', fields: [
  { name: 'options', type: { kind: 'array', element: 'number' }, optional: true },
  { name: 'min', type: 'number', optional: true }, { name: 'max', type: 'number', optional: true },
  { name: 'step', type: 'number', optional: true },
] };
const rangeSpec: DataType = { kind: 'record', fields: [
  { name: 'min', type: 'number' }, { name: 'max', type: 'number' },
  { name: 'clamp', type: 'boolean', optional: true },
] };
const exposeEventSpec: DataType = { kind: 'record', fields: [
  { name: 'payload', type: { kind: 'union', members: [
    { kind: 'literal', value: 'void' }, { kind: 'literal', value: 'any' }, { kind: 'literal', value: 'json' },
  ] }, optional: true },
  { name: 'options', type: { kind: 'record', fields: [] }, optional: true },
] };
const hostEventOptions: ArgumentRule = { role: 'value', types: ['record'], optional: true, schema: {
  kind: 'record', fields: [
    { name: 'capture', type: 'boolean', optional: true }, { name: 'once', type: 'boolean', optional: true },
    { name: 'passive', type: 'boolean', optional: true },
  ],
} };
function effect(kind: OperationEffect['kind'], resource: SemanticResource, scope: OperationEffect['scope'] = 'instance'): OperationEffect {
  return { kind, resource, scope };
}
function cb(context: CallbackContext, parameters: readonly ValueType[], options: Partial<Omit<CallbackRule, 'at' | 'phase' | 'context' | 'parameters'>> = {}): ArgumentRule {
  return { role: 'callback', callback: {
    phase: 'callback', context, parameters, minParameters: 0,
    maxParameters: parameters.length, returnType: 'void', ...options,
  } };
}
function rule(receiver: ValueType, path: string, phases: readonly Phase[], result: ValueType,
  args: readonly ArgumentRule[], effects: readonly OperationEffect[],
  options: Partial<Pick<OperationRule, 'contexts' | 'resultFrom' | 'requiredCapabilities'>> = {}): OperationRule {
  const callbackAt = args.findIndex((arg) => arg.callback && !arg.callback.acceptsValue);
  return {
    receiver, path, phases, result, arguments: args, effects,
    min: args.filter((arg) => !arg.optional).length, max: args.length,
    requiredCapabilities: [], ...options,
    ...(callbackAt < 0 ? {} : { callback: { at: callbackAt, ...args[callbackAt].callback! } }),
  };
}
const watchParameters: readonly ValueType[] = ['run', 'props', 'props', 'record'];
const rawWatchParameters: readonly ValueType[] = ['run', 'record', 'record', 'record'];
const optionalRecord: ArgumentRule = { ...record, optional: true };
const contextNext: ArgumentRule = { role: 'context-next', callback: {
  phase: 'callback', context: 'context-update', parameters: ['record'],
  minParameters: 0, maxParameters: 1, returnType: 'record',
  parameterPolicy: 'context-updater', acceptsValue: true, contextFrom: 'caller',
} };

/** The single admission/emission vocabulary. Paths are exact public handle names. */
export const OPERATION_RULES = {
  'hook.asTrigger': rule('void', 'asTrigger', setup, 'void', [], [effect('declare', 'event-route')], { requiredCapabilities: ['input-events'] }),
  'hook.asFocusable': rule('void', 'asFocusable', setup, 'focus', [], [effect('declare', 'focus')], { requiredCapabilities: ['focus-target'] }),
  'hook.asAccessible': rule('void', 'asAccessible', setup, 'accessible', [], [effect('declare', 'accessibility')], { requiredCapabilities: ['accessibility-tree'] }),
  'run.update': rule('run', 'update', callbackPhase, 'void', [], [effect('request-update', 'update-queue')]),
  'props.define': rule('def', 'props.define', setup, 'void', [record], [effect('declare', 'props-schema')]),
  'props.setDefaults': rule('def', 'props.setDefaults', setup, 'void', [record], [effect('write', 'props-schema')]),
  'props.watch': rule('def', 'props.watch', setup, 'function', [{ role: 'declared-prop-keys' }, cb('props-watch', watchParameters)], [effect('subscribe', 'props', 'subscription')]),
  'props.watchAll': rule('def', 'props.watchAll', setup, 'function', [cb('props-watch', watchParameters)], [effect('subscribe', 'props', 'subscription')]),
  'props.watchRaw': rule('def', 'props.watchRaw', setup, 'function', [{ role: 'static-keys' }, cb('props-watch', rawWatchParameters)], [effect('subscribe', 'raw-props', 'subscription')]),
  'props.watchRawAll': rule('def', 'props.watchRawAll', setup, 'function', [cb('props-watch', rawWatchParameters)], [effect('subscribe', 'raw-props', 'subscription')]),
  'props.get': rule('run', 'props.get', runtime, 'props', [], [effect('read', 'props')]),
  'props.getRaw': rule('run', 'props.getRaw', runtime, 'record', [], [effect('read', 'raw-props')]),
  'props.isProvided': rule('run', 'props.isProvided', runtime, 'boolean', [{ role: 'prop-key' }], [effect('read', 'raw-props')]),
  'render.read.props.get': rule('render', 'read.props.get', render, 'props', [], [effect('read', 'props')]),
  'render.read.props.getRaw': rule('render', 'read.props.getRaw', render, 'record', [], [effect('read', 'raw-props')]),
  'render.read.props.isProvided': rule('render', 'read.props.isProvided', render, 'boolean', [{ role: 'prop-key' }], [effect('read', 'raw-props')]),
  'state.bool': rule('def', 'state.bool', setup, 'state:boolean', [key, boolean], [effect('declare', 'state')]),
  'state.string': rule('def', 'state.string', setup, 'state:string', [key, { role: 'value', types: ['string'] }, { ...optionalRecord, schema: stringSpec }], [effect('declare', 'state')]),
  'state.numberDiscrete': rule('def', 'state.numberDiscrete', setup, 'state:number', [key, { role: 'value', types: ['number'] }, { ...optionalRecord, schema: discreteSpec }], [effect('declare', 'state')]),
  'state.numberRange': rule('def', 'state.numberRange', setup, 'state:number', [key, { role: 'value', types: ['number'] }, { ...record, schema: rangeSpec }], [effect('declare', 'state')]),
  'state.get': rule('state:boolean', 'get', ['setup', 'callback', 'render'], 'unknown', [], [effect('read', 'state')], { resultFrom: 'receiver-value' }),
  'state.set': rule('state:boolean', 'set', callbackPhase, 'void', [{ role: 'receiver-value' }, { role: 'value', optional: true }], [effect('write', 'state')]),
  'expose.state': rule('def', 'expose.state', setup, 'void', [key, { role: 'state-handle' }], [effect('declare', 'expose')]),
  'expose.event': rule('def', 'expose.event', setup, 'void', [key, { ...optionalRecord, schema: exposeEventSpec }], [effect('declare', 'expose')]),
  'expose.method': rule('def', 'expose.method', setup, 'void', [key, cb('expose-method', [], { parameterPolicy: 'declared-method', maxParameters: Number.MAX_SAFE_INTEGER, returnType: 'unknown' })], [effect('declare', 'expose')]),
  'expose.emit': rule('run', 'expose.emit', callbackPhase, 'void', [key, { role: 'event-payload', optional: true }, optionalRecord], [effect('signal', 'expose')]),
  'lifecycle.setPresent': rule('run', 'lifecycle.setPresent', callbackPhase, 'void', [boolean], [effect('write', 'view-intent')], { contexts: aliveContexts }),
  'lifecycle.onCreated': rule('def', 'lifecycle.onCreated', setup, 'void', [cb('created', ['run'])], [effect('subscribe', 'view-intent')]),
  'lifecycle.onMounted': rule('def', 'lifecycle.onMounted', setup, 'void', [cb('mounted', ['run'])], [effect('subscribe', 'view')]),
  'lifecycle.onUpdated': rule('def', 'lifecycle.onUpdated', setup, 'void', [cb('updated', ['run'])], [effect('subscribe', 'view')]),
  'lifecycle.onUnmounted': rule('def', 'lifecycle.onUnmounted', setup, 'void', [cb('unmounted', ['run'])], [effect('subscribe', 'view')]),
  'lifecycle.onBeforeDispose': rule('def', 'lifecycle.onBeforeDispose', setup, 'void', [cb('before-dispose', ['run'])], [effect('subscribe', 'view-intent')]),
  'event.on': rule('def', 'event.on', setup, 'unknown', [key, cb('event', ['run', 'event']), hostEventOptions], [effect('subscribe', 'event-route', 'subscription')], { requiredCapabilities: ['input-events'] }),
  'event.onGlobal': rule('def', 'event.onGlobal', setup, 'unknown', [key, cb('event', ['run', 'event']), hostEventOptions], [effect('subscribe', 'event-route', 'subscription')], { requiredCapabilities: ['input-events'] }),
  'event.requestDefaultActionPrevention': rule('event', 'control.requestDefaultActionPrevention', callbackPhase, 'void', [{ ...optionalRecord, schema: { kind: 'record', fields: [
    { name: 'reason', type: 'string', optional: true }, { name: 'source', type: 'string', optional: true },
  ] } }], [effect('write', 'event-route', 'view')], { contexts: ['event'], requiredCapabilities: ['input-events'] }),
  'focus.configure': rule('focus', 'configure', setup, 'void', [record], [effect('declare', 'focus')], { requiredCapabilities: ['focus-target'] }),
  'focus.setDisabled': rule('focus', 'setDisabled', callbackPhase, 'void', [boolean], [effect('write', 'focus')], { requiredCapabilities: ['focus-target'] }),
  'focus.focusSelf': rule('focus', 'focusSelf', callbackPhase, 'void', [{ role: 'value', types: ['record', 'focus-options'], optional: true }], [effect('signal', 'focus', 'view')], { requiredCapabilities: ['focus-target'] }),
  'accessible.state': rule('accessible', 'state', setup, 'void', [key, { role: 'state-handle' }], [effect('declare', 'accessibility')], { requiredCapabilities: ['accessibility-tree'] }),
  'accessible.action': rule('accessible', 'action', setup, 'void', [key, optionalRecord], [effect('declare', 'accessibility')], { requiredCapabilities: ['accessibility-tree'] }),
  'accessible.role': rule('accessible', 'role', setup, 'void', [{ role: 'value', types: ['string', 'state:string'] }], [effect('declare', 'accessibility')], { requiredCapabilities: ['accessibility-tree'] }),
  'accessible.nameFromContent': rule('accessible', 'nameFromContent', setup, 'void', [], [effect('declare', 'accessibility')], { requiredCapabilities: ['accessibility-tree'] }),
  'render.el': rule('render', 'el', render, 'template', [key, { role: 'template-argument', optional: true }, { role: 'template-argument', optional: true }], [effect('write', 'view', 'view')], { requiredCapabilities: ['view-render'] }),
  'render.slot': rule('render', 'slot', render, 'template', [], [effect('write', 'view', 'view')], { requiredCapabilities: ['view-render'] }),
  'context.provide': rule('def', 'context.provide', setup, 'void', [contextKey, { role: 'context-value' }], [effect('declare', 'context')]),
  'context.subscribe': rule('def', 'context.subscribe', setup, 'function', [contextKey, { ...cb('context-watch', ['run', 'record', 'record'], { parameterPolicy: 'context-value' }), optional: true }], [effect('subscribe', 'context', 'subscription')]),
  'context.trySubscribe': rule('def', 'context.trySubscribe', setup, 'function', [contextKey, { ...cb('context-watch', ['run', 'record', 'record'], { parameterPolicy: 'nullable-context-value' }), optional: true }], [effect('subscribe', 'context', 'subscription')]),
  'context.read': rule('run', 'context.read', runtime, 'record', [contextKey], [effect('read', 'context')], { resultFrom: 'context-value' }),
  'context.tryRead': rule('run', 'context.tryRead', runtime, 'unknown', [contextKey], [effect('read', 'context')], { resultFrom: 'context-value-or-null' }),
  'context.update': rule('run', 'context.update', callbackPhase, 'void', [contextKey, contextNext], [effect('write', 'context')]),
  'context.tryUpdate': rule('run', 'context.tryUpdate', callbackPhase, 'boolean', [contextKey, contextNext], [effect('write', 'context')]),
  'render.read.context.read': rule('render', 'read.context.read', render, 'record', [contextKey], [effect('read', 'context')], { resultFrom: 'context-value' }),
  'render.read.context.tryRead': rule('render', 'read.context.tryRead', render, 'unknown', [contextKey], [effect('read', 'context')], { resultFrom: 'context-value-or-null' }),
} satisfies Record<string, OperationRule>;

export type SemanticOperation = keyof typeof OPERATION_RULES;
export interface OperationContractIssue {
  code: 'unknown-operation' | 'phase' | 'context' | 'receiver' | 'arity' | 'argument-type'
    | 'static-key' | 'undeclared-key' | 'callback-arity' | 'callback-type' | 'callback-context' | 'callback-return' | 'missing-signature';
  message: string;
  argument?: number;
  parameter?: number;
}
export interface OperationBindings {
  callbackContext?: CallbackContext;
  propNames?: ReadonlySet<string>;
  contextValueType?: DataType;
  eventPayloadType?: DataType;
  methodParameters?: readonly { type: ValueType; optional?: boolean }[];
  methodReturnType?: ValueType;
}
export interface OperationArgument {
  kind: string;
  type: ValueType;
  value?: unknown;
  elements?: readonly OperationArgument[];
  entries?: readonly { key: string; value: OperationArgument }[];
  function?: OperationCallback;
}
export interface OperationCallback {
  phase: Phase;
  context?: FunctionContext;
  parameters: readonly { type: ValueType; optional?: boolean }[];
  returnType?: ValueType;
}

function lookup(operation: string): OperationRule | undefined {
  return Object.hasOwn(OPERATION_RULES, operation) ? OPERATION_RULES[operation as SemanticOperation] : undefined;
}
function data(type: ValueType): DataType | undefined {
  if (typeof type === 'string')
    return type === 'boolean' || type === 'number' || type === 'string' || type === 'null' || type === 'void' ? type : undefined;
  try { return parseDataType(type); } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
function assignable(actual: ValueType, expected: ValueType): boolean {
  if (actual === expected) return true;
  const a = data(actual);
  const e = data(expected);
  if (a && e) return isAssignable(a, e);
  return expected === 'record' ? actual === 'props' || actual === 'focus-options' || (typeof a === 'object' && a.kind === 'record')
    : expected === 'array' ? typeof a === 'object' && a.kind === 'array'
    : false;
}
function stateValue(receiver?: ValueType): ValueType | undefined {
  if (receiver === 'state:boolean') return 'boolean';
  if (receiver === 'state:number') return 'number';
  if (receiver === 'state:string') return 'string';
  return undefined;
}
function nullable(type: DataType): DataType {
  return { kind: 'union', members: [type, 'null'] };
}
export function operationResultType(operation: string, receiver?: ValueType, bindings: OperationBindings = {}): ValueType | undefined {
  const contract = lookup(operation);
  if (!contract) return undefined;
  switch (contract.resultFrom) {
    case 'receiver-value': return stateValue(receiver);
    case 'context-value': return bindings.contextValueType;
    case 'context-value-or-null': return bindings.contextValueType ? nullable(bindings.contextValueType) : undefined;
    default: return contract.result;
  }
}
export function operationCallbackRule(operation: string, index: number): CallbackRule | undefined {
  const signature = lookup(operation)?.arguments[index]?.callback;
  return signature ? { at: index, ...signature } : undefined;
}
export function validateOperationPhase(operation: string, phase: Phase, context?: CallbackContext): readonly OperationContractIssue[] {
  const contract = lookup(operation);
  if (!contract) return [{ code: 'unknown-operation', message: `Unknown operation ${operation}.` }];
  if (!contract.phases.includes(phase)) return [{ code: 'phase', message: `${operation} is not permitted in ${phase}.` }];
  if (contract.contexts && (!context || !contract.contexts.includes(context))) {
    return [{ code: 'context', message: `${operation} requires ${contract.contexts.join(', ')} context; received ${context ?? 'unspecified'}.` }];
  }
  return [];
}

/** Check callback capability types exactly: annotating a run/event/data parameter as another
 * capability must not grant authority. Callbacks may omit unused trailing parameters. */
export function validateOperationCallback(callback: OperationCallback, signature: CallbackRule, bindings: OperationBindings = {}): readonly OperationContractIssue[] {
  const issues: OperationContractIssue[] = [];
  let parameters: readonly { type: ValueType; optional?: boolean }[] = signature.parameters.map((type) => ({ type }));
  let result = signature.returnType;
  let max = signature.maxParameters;
  if (signature.parameterPolicy === 'declared-method') {
    if (!bindings.methodParameters || bindings.methodReturnType === undefined)
      return [{ code: 'missing-signature', message: 'Expose methods require a checked parameter and return signature.' }];
    parameters = bindings.methodParameters;
    result = bindings.methodReturnType;
    max = parameters.length;
  } else if (signature.parameterPolicy) {
    if (!bindings.contextValueType)
      return [{ code: 'missing-signature', message: 'Context callbacks require a resolved key value type.' }];
    const value = signature.parameterPolicy === 'nullable-context-value' ? nullable(bindings.contextValueType) : bindings.contextValueType;
    parameters = signature.parameterPolicy === 'context-updater' ? [{ type: value }] : [{ type: 'run' }, { type: value }, { type: value }];
    if (signature.parameterPolicy === 'context-updater') result = value;
  }
  const context = signature.contextFrom === 'caller' ? bindings.callbackContext : signature.context;
  if (!context || callback.phase !== signature.phase || callback.context !== context)
    issues.push({ code: 'callback-context', message: `Callback must have ${signature.phase}/${context ?? 'resolved caller'} authority.` });
  if (callback.parameters.length < signature.minParameters || callback.parameters.length > max)
    issues.push({ code: 'callback-arity', message: `Callback accepts at most ${max} parameters and at least ${signature.minParameters}.` });
  callback.parameters.forEach((parameter, index) => {
    const expected = parameters[index];
    if (!expected) return;
    const actualData = data(parameter.type);
    const expectedData = data(expected.type);
    if (actualData && expectedData ? !dataTypeEqual(actualData, expectedData) : parameter.type !== expected.type)
      issues.push({ code: 'callback-type', message: `Callback parameter ${index + 1} does not match its semantic type.`, parameter: index });
    if (expected.optional && !parameter.optional)
      issues.push({ code: 'callback-type', message: `Callback parameter ${index + 1} must accept omission.`, parameter: index });
  });
  // Like the public void callback signature, unused return values are allowed for registration
  // callbacks. Exposed methods and context updaters have observable return contracts instead.
  if ((signature.parameterPolicy === 'declared-method' || signature.parameterPolicy === 'context-updater') &&
      (callback.returnType === undefined || !assignable(callback.returnType, result)))
    issues.push({ code: 'callback-return', message: 'Callback return type does not match its semantic signature.' });
  return issues;
}

function staticKey(argument: OperationArgument): argument is OperationArgument & { value: string } {
  return argument.kind === 'literal' && typeof argument.value === 'string' && argument.value.length > 0;
}
function argumentData(argument: OperationArgument): DataType | undefined {
  if (argument.kind === 'literal' && (argument.value === null || typeof argument.value === 'string' ||
      typeof argument.value === 'number' || typeof argument.value === 'boolean'))
    return { kind: 'literal', value: argument.value };
  if (argument.kind === 'record' && argument.entries) {
    const fields: { name: string; type: DataType }[] = [];
    for (const entry of argument.entries) {
      const type = argumentData(entry.value);
      if (!type) return undefined;
      fields.push({ name: entry.key, type });
    }
    return { kind: 'record', fields };
  }
  if (argument.kind === 'array' && argument.elements) {
    const types = argument.elements.map(argumentData);
    if (types.some((type) => type === undefined)) return undefined;
    return { kind: 'array', element: { kind: 'union', members: types as DataType[] } };
  }
  return data(argument.type);
}

/** Receiver, argument and callback validation shared by source admission and external IR.
 * Declaration/reference resolution (prop/expose/context ownership) remains caller-owned. */
export function validateOperationArguments(operation: string, args: readonly OperationArgument[], receiver?: ValueType, bindings: OperationBindings = {}): readonly OperationContractIssue[] {
  const contract = lookup(operation);
  if (!contract) return [{ code: 'unknown-operation', message: `Unknown operation ${operation}.` }];
  const issues: OperationContractIssue[] = [];
  if (contract.receiver === 'state:boolean' ? !stateValue(receiver) : (receiver ?? 'void') !== contract.receiver)
    issues.push({ code: 'receiver', message: `${operation} has an incompatible receiver.` });
  if (args.length < contract.min || args.length > contract.max)
    issues.push({ code: 'arity', message: `${operation} requires ${contract.min}..${contract.max} arguments.` });
  if ((operation === 'event.on' || operation === 'event.onGlobal') && args.length > 2 &&
      (!staticKey(args[0]) || !args[0].value.startsWith('host:')))
    issues.push({ code: 'argument-type', message: 'Listener options are only admitted for explicit host:* extension events.', argument: 2 });
  args.forEach((argument, index) => {
    const requirement = contract.arguments[index];
    if (!requirement) return;
    const reject = (code: OperationContractIssue['code'], message: string) => issues.push({ code, message, argument: index });
    if (requirement.types && !requirement.types.some((type) => assignable(argument.type, type)))
      reject('argument-type', `Argument ${index + 1} has an incompatible type.`);
    if (requirement.schema) {
      const actual = argumentData(argument);
      if (!actual || !isAssignable(actual, requirement.schema)) reject('argument-type', `Argument ${index + 1} does not satisfy its data schema.`);
    }
    switch (requirement.role) {
      case 'static-key':
      case 'prop-key':
        if (!staticKey(argument)) reject('static-key', 'A nonempty static string key is required.');
        else if (requirement.role === 'prop-key' && bindings.propNames && !bindings.propNames.has(argument.value))
          reject('undeclared-key', `Unknown prop ${argument.value}.`);
        break;
      case 'static-keys':
      case 'declared-prop-keys':
        if (argument.kind !== 'array' || !argument.elements?.length || argument.elements.some((item) => !staticKey(item)))
          reject('static-key', 'A nonempty literal array of nonempty static keys is required.');
        else if (requirement.role === 'declared-prop-keys' && bindings.propNames && argument.elements.some((item) => !bindings.propNames!.has(item.value as string)))
          reject('undeclared-key', 'Watch keys must name declared props.');
        break;
      case 'state-handle':
        if (!stateValue(argument.type)) reject('argument-type', 'A state handle is required.');
        break;
      case 'receiver-value': {
        const expected = stateValue(receiver);
        if (!expected || !assignable(argument.type, expected)) reject('argument-type', 'State write type differs from its receiver value type.');
        break;
      }
      case 'context-key':
        if (argument.type !== ('context-key' as ValueType)) reject('argument-type', 'A declared context key capability is required.');
        if (!bindings.contextValueType) reject('missing-signature', 'Context key value type must be resolved before admission.');
        break;
      case 'context-value':
      case 'context-next':
        if (requirement.role === 'context-next' && argument.kind === 'function') break;
        if (!bindings.contextValueType || !assignable(argument.type, bindings.contextValueType))
          reject('argument-type', 'Context value does not match its declared key type.');
        break;
      case 'event-payload':
        if (!bindings.eventPayloadType) reject('missing-signature', 'Emitted events require a declared payload signature.');
        else if (!assignable(argument.type, bindings.eventPayloadType)) reject('argument-type', 'Event payload does not match the declared signature.');
        break;
      case 'template-argument':
        if (!['record', 'array', 'template', 'string', 'number', 'boolean', 'null'].some((type) => assignable(argument.type, type as ValueType)))
          reject('argument-type', 'Element arguments must be template props or children.');
        break;
    }
    if (requirement.callback && (!requirement.callback.acceptsValue || argument.kind === 'function')) {
      if (argument.kind !== 'function' || argument.type !== 'function' || !argument.function)
        reject('argument-type', 'An inline checked callback is required.');
      else for (const issue of validateOperationCallback(argument.function, { at: index, ...requirement.callback }, bindings))
        issues.push({ ...issue, argument: index });
    }
  });
  if (operation === 'expose.emit' && args.length < 2) {
    if (!bindings.eventPayloadType)
      issues.push({ code: 'missing-signature', message: 'Emitted events require a declared payload signature.', argument: 1 });
    else if (!isAssignable('void', bindings.eventPayloadType))
      issues.push({ code: 'argument-type', message: 'This event requires a payload.', argument: 1 });
  }
  return issues;
}
