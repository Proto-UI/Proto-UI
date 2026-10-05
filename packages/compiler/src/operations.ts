import type { Phase, ValueType, FunctionContext, ModuleCapabilityType } from './ir';
import { isCapabilityAssignable } from './ir';
import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';

export type CallbackContext =
  | 'helper'
  | 'event'
  | 'props-watch'
  | 'context-watch'
  | 'context-update'
  | 'state-watch'
  | 'collection-meta'
  | 'positioning'
  | 'created'
  | 'mounted'
  | 'updated'
  | 'unmounted'
  | 'before-dispose'
  | 'expose-method';
export type SemanticResource =
  | 'props-schema'
  | 'props'
  | 'raw-props'
  | 'state'
  | 'expose'
  | 'context'
  | 'view-intent'
  | 'view'
  | 'event-route'
  | 'focus'
  | 'accessibility'
  | 'update-queue'
  | 'style';
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
  parameterPolicy?:
    | 'declared-method'
    | 'context-value'
    | 'nullable-context-value'
    | 'context-updater'
    | 'input-payload'
    | 'state-value';
  acceptsValue?: boolean;
}
export type ArgumentRole =
  | 'value'
  | 'static-key'
  | 'static-keys'
  | 'prop-key'
  | 'declared-prop-keys'
  | 'state-handle'
  | 'receiver-value'
  | 'context-key'
  | 'context-value'
  | 'context-next'
  | 'callback'
  | 'event-payload'
  | 'template-argument'
  | 'host-target';
export interface ArgumentRule {
  role: ArgumentRole;
  types?: readonly ValueType[];
  optional?: boolean;
  fields?: Readonly<Record<string, ArgumentRule>>;
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
const bindingPhase: readonly Phase[] = ['setup', 'callback'];
const runtime: readonly Phase[] = ['callback', 'render'];
const render: readonly Phase[] = ['render'];
const aliveContexts: readonly CallbackContext[] = [
  'event',
  'props-watch',
  'context-watch',
  'created',
  'mounted',
  'updated',
  'unmounted',
  'expose-method',
  'state-watch',
  'collection-meta',
  'positioning',
];
const key: ArgumentRule = { role: 'static-key', types: ['string'] };
const record: ArgumentRule = { role: 'value', types: ['record'] };
const boolean: ArgumentRule = { role: 'value', types: ['boolean'] };
const contextKey: ArgumentRule = { role: 'context-key' };
const stringSpec: DataType = {
  kind: 'record',
  fields: [{ name: 'options', type: { kind: 'array', element: 'string' }, optional: true }],
};
const discreteSpec: DataType = {
  kind: 'record',
  fields: [
    { name: 'options', type: { kind: 'array', element: 'number' }, optional: true },
    { name: 'min', type: 'number', optional: true },
    { name: 'max', type: 'number', optional: true },
    { name: 'step', type: 'number', optional: true },
  ],
};
const rangeSpec: DataType = {
  kind: 'record',
  fields: [
    { name: 'min', type: 'number' },
    { name: 'max', type: 'number' },
    { name: 'clamp', type: 'boolean', optional: true },
  ],
};
const exposeEventSpec: DataType = {
  kind: 'record',
  fields: [
    {
      name: 'payload',
      type: {
        kind: 'union',
        members: [
          { kind: 'literal', value: 'void' },
          { kind: 'literal', value: 'any' },
          { kind: 'literal', value: 'json' },
        ],
      },
      optional: true,
    },
    { name: 'options', type: { kind: 'record', fields: [] }, optional: true },
  ],
};
const hostEventOptions: ArgumentRule = {
  role: 'value',
  types: ['record'],
  optional: true,
  schema: {
    kind: 'record',
    fields: [
      { name: 'capture', type: 'boolean', optional: true },
      { name: 'once', type: 'boolean', optional: true },
      { name: 'passive', type: 'boolean', optional: true },
    ],
  },
};
function effect(
  kind: OperationEffect['kind'],
  resource: SemanticResource,
  scope: OperationEffect['scope'] = 'instance'
): OperationEffect {
  return { kind, resource, scope };
}
function cb(
  context: CallbackContext,
  parameters: readonly ValueType[],
  options: Partial<Omit<CallbackRule, 'at' | 'phase' | 'context' | 'parameters'>> = {}
): ArgumentRule {
  return {
    role: 'callback',
    callback: {
      phase: 'callback',
      context,
      parameters,
      minParameters: 0,
      maxParameters: parameters.length,
      returnType: 'void',
      ...options,
    },
  };
}
function rule(
  receiver: ValueType,
  path: string,
  phases: readonly Phase[],
  result: ValueType,
  args: readonly ArgumentRule[],
  effects: readonly OperationEffect[],
  options: Partial<Pick<OperationRule, 'contexts' | 'resultFrom' | 'requiredCapabilities'>> = {}
): OperationRule {
  const callbackAt = args.findIndex((arg) => arg.callback && !arg.callback.acceptsValue);
  return {
    receiver,
    path,
    phases,
    result,
    arguments: args,
    effects,
    min: args.filter((arg) => !arg.optional).length,
    max: args.length,
    requiredCapabilities: [],
    ...options,
    ...(callbackAt < 0 ? {} : { callback: { at: callbackAt, ...args[callbackAt].callback! } }),
  };
}
function styleRule(
  receiver: ValueType,
  path: string,
  phases: readonly Phase[],
  result: ValueType
): OperationRule {
  const contract = rule(
    receiver,
    path,
    phases,
    result,
    [{ role: 'value', types: ['style-handle'], optional: true }],
    [effect(phases === setup ? 'declare' : 'write', 'style')],
    { requiredCapabilities: ['style-projection'] }
  );
  return { ...contract, max: Number.MAX_SAFE_INTEGER };
}
const watchParameters: readonly ValueType[] = ['run', 'props', 'props', 'record'];
const rawWatchParameters: readonly ValueType[] = ['run', 'record', 'record', 'record'];
const optionalRecord: ArgumentRule = { ...record, optional: true };
const capabilityConfig: ArgumentRule = { role: 'value', types: ['record', 'module-config'] };
const textSnapshot: DataType = {
  kind: 'record',
  fields: [
    { name: 'value', type: 'string' },
    { name: 'composing', type: 'boolean' },
  ],
};
const textEvent: DataType = {
  kind: 'record',
  fields: [
    { name: 'type', type: 'string' },
    { name: 'value', type: 'string' },
    { name: 'composing', type: 'boolean' },
    { name: 'data', type: { kind: 'union', members: ['string', 'null'] } },
    { name: 'inputType', type: { kind: 'union', members: ['string', 'null'] } },
  ],
};
const imageSnapshot: DataType = {
  kind: 'record',
  fields: [
    { name: 'source', type: 'string' },
    { name: 'loadingStatus', type: 'string' },
    { name: 'fit', type: 'string' },
  ],
};
const imageEvent: DataType = {
  kind: 'record',
  fields: [
    { name: 'status', type: 'string' },
    { name: 'previousStatus', type: 'string' },
    { name: 'source', type: 'string' },
  ],
};
const positionSnapshot: DataType = {
  kind: 'record',
  fields: [
    { name: 'side', type: 'string' },
    { name: 'align', type: 'string' },
    { name: 'strategy', type: 'string' },
  ],
};
const scrollAxisSnapshot: DataType = {
  kind: 'record',
  fields: [
    { name: 'position', type: 'number' },
    { name: 'visibleRatio', type: 'number' },
    { name: 'canScrollBefore', type: 'boolean' },
    { name: 'canScrollAfter', type: 'boolean' },
    { name: 'atEnd', type: 'boolean' },
  ],
};
const scrollSnapshot: DataType = {
  kind: 'record',
  fields: [
    { name: 'axes', type: 'string' },
    { name: 'horizontal', type: scrollAxisSnapshot },
    { name: 'vertical', type: scrollAxisSnapshot },
    { name: 'scrolling', type: 'boolean' },
    { name: 'projection', type: 'string' },
    {
      name: 'endFollow',
      type: {
        kind: 'record',
        fields: [
          { name: 'state', type: 'string' },
          { name: 'requestStatus', type: 'string' },
        ],
      },
    },
  ],
};
export const FOCUS_OPTIONS_TYPE: DataType = {
  kind: 'record',
  fields: [
    {
      name: 'reason',
      optional: true,
      type: {
        kind: 'union',
        members: [
          { kind: 'literal', value: 'programmatic' },
          { kind: 'literal', value: 'keyboard' },
          { kind: 'literal', value: 'pointer' },
        ],
      },
    },
    { name: 'preventScroll', optional: true, type: 'boolean' },
  ],
};
const rovingOptions: ArgumentRule = {
  role: 'value',
  optional: true,
  schema: {
    kind: 'record',
    fields: [...FOCUS_OPTIONS_TYPE.fields, { name: 'defer', type: 'boolean', optional: true }],
  },
};
const contextNext: ArgumentRule = {
  role: 'context-next',
  callback: {
    phase: 'callback',
    context: 'context-update',
    parameters: ['record'],
    minParameters: 0,
    maxParameters: 1,
    returnType: 'record',
    parameterPolicy: 'context-updater',
    acceptsValue: true,
    contextFrom: 'caller',
  },
};

export const PACKAGED_HOOKS: Readonly<Record<string, Readonly<Record<string, SemanticOperation>>>> =
  {
    '@proto.ui/prototypes-base': { asTransition: 'hook.asTransition' },
    '@proto.ui/prototypes-base/tools': { asTransition: 'hook.asTransition' },
    '@proto.ui/prototypes-base/transition': { asTransition: 'hook.asTransition' },
  };

/** The single admission/emission vocabulary. Paths are exact public handle names. */
export const OPERATION_RULES = {
  'style.tw': rule(
    'void',
    'tw',
    ['setup', 'callback', 'render'],
    'style-handle',
    [{ role: 'value', types: ['string'] }],
    [effect('declare', 'style')]
  ),
  'rule.declare': rule(
    'def',
    'rule',
    setup,
    'rule-handle',
    [record],
    [effect('declare', 'style')],
    { requiredCapabilities: ['style-projection'] }
  ),
  'rule.dispose': rule('rule-handle', 'dispose', setup, 'void', [], [effect('write', 'style')], {
    requiredCapabilities: ['style-projection'],
  }),
  'feedback.style.use': styleRule('def', 'feedback.style.use', setup, 'style-disposer'),
  'feedback.style.release': rule(
    'style-disposer',
    'call',
    setup,
    'void',
    [],
    [effect('write', 'style')],
    { requiredCapabilities: ['style-projection'] }
  ),
  'subscription.release': rule(
    'subscription-disposer',
    'call',
    setup,
    'void',
    [],
    [effect('write', 'view', 'subscription')]
  ),
  'binding.release': rule(
    'binding-disposer',
    'call',
    bindingPhase,
    'void',
    [],
    [effect('write', 'view', 'subscription')]
  ),
  'transitionAction.call': rule(
    'transition-action',
    'call',
    callbackPhase,
    'void',
    [],
    [effect('write', 'view-intent')]
  ),
  'feedback.style.patch': styleRule('run', 'feedback.style.patch', callbackPhase, 'void'),
  'feedback.style.suppress': styleRule('run', 'feedback.style.suppress', callbackPhase, 'void'),
  'feedback.style.clearPatch': rule(
    'run',
    'feedback.style.clearPatch',
    callbackPhase,
    'void',
    [],
    [effect('write', 'style')],
    { requiredCapabilities: ['style-projection'] }
  ),
  'hook.asTrigger': rule(
    'void',
    'asTrigger',
    setup,
    'void',
    [],
    [effect('declare', 'event-route')],
    { requiredCapabilities: ['input-events'] }
  ),
  'hook.asFocusable': rule(
    'void',
    'asFocusable',
    setup,
    'focus',
    [],
    [effect('declare', 'focus')],
    { requiredCapabilities: ['focus-target'] }
  ),
  'hook.asAccessible': rule(
    'void',
    'asAccessible',
    setup,
    'accessible',
    [],
    [effect('declare', 'accessibility')],
    { requiredCapabilities: ['accessibility-tree'] }
  ),
  'run.update': rule(
    'run',
    'update',
    callbackPhase,
    'void',
    [],
    [effect('request-update', 'update-queue')]
  ),
  'props.define': rule(
    'def',
    'props.define',
    setup,
    'void',
    [record],
    [effect('declare', 'props-schema')]
  ),
  'props.setDefaults': rule(
    'def',
    'props.setDefaults',
    setup,
    'void',
    [record],
    [effect('write', 'props-schema')]
  ),
  'props.watch': rule(
    'def',
    'props.watch',
    setup,
    'function',
    [{ role: 'declared-prop-keys' }, cb('props-watch', watchParameters)],
    [effect('subscribe', 'props', 'subscription')]
  ),
  'props.watchAll': rule(
    'def',
    'props.watchAll',
    setup,
    'function',
    [cb('props-watch', watchParameters)],
    [effect('subscribe', 'props', 'subscription')]
  ),
  'props.watchRaw': rule(
    'def',
    'props.watchRaw',
    setup,
    'function',
    [{ role: 'static-keys' }, cb('props-watch', rawWatchParameters)],
    [effect('subscribe', 'raw-props', 'subscription')]
  ),
  'props.watchRawAll': rule(
    'def',
    'props.watchRawAll',
    setup,
    'function',
    [cb('props-watch', rawWatchParameters)],
    [effect('subscribe', 'raw-props', 'subscription')]
  ),
  'props.get': rule('run', 'props.get', runtime, 'props', [], [effect('read', 'props')]),
  'props.getRaw': rule('run', 'props.getRaw', runtime, 'record', [], [effect('read', 'raw-props')]),
  'props.isProvided': rule(
    'run',
    'props.isProvided',
    runtime,
    'boolean',
    [{ role: 'prop-key' }],
    [effect('read', 'raw-props')]
  ),
  'render.read.props.get': rule(
    'render',
    'read.props.get',
    render,
    'props',
    [],
    [effect('read', 'props')]
  ),
  'render.read.props.getRaw': rule(
    'render',
    'read.props.getRaw',
    render,
    'record',
    [],
    [effect('read', 'raw-props')]
  ),
  'render.read.props.isProvided': rule(
    'render',
    'read.props.isProvided',
    render,
    'boolean',
    [{ role: 'prop-key' }],
    [effect('read', 'raw-props')]
  ),
  'state.bool': rule(
    'def',
    'state.bool',
    setup,
    'state:boolean',
    [key, boolean],
    [effect('declare', 'state')]
  ),
  'state.string': rule(
    'def',
    'state.string',
    setup,
    'state:string',
    [key, { role: 'value', types: ['string'] }, { ...optionalRecord, schema: stringSpec }],
    [effect('declare', 'state')]
  ),
  'state.numberDiscrete': rule(
    'def',
    'state.numberDiscrete',
    setup,
    'state:number',
    [key, { role: 'value', types: ['number'] }, { ...optionalRecord, schema: discreteSpec }],
    [effect('declare', 'state')]
  ),
  'state.numberRange': rule(
    'def',
    'state.numberRange',
    setup,
    'state:number',
    [key, { role: 'value', types: ['number'] }, { ...record, schema: rangeSpec }],
    [effect('declare', 'state')]
  ),
  'state.enum': rule(
    'def',
    'state.enum',
    setup,
    'state:string',
    [
      key,
      { role: 'value', types: ['string'] },
      {
        ...record,
        schema: {
          kind: 'record',
          fields: [{ name: 'options', type: { kind: 'array', element: 'string' } }],
        },
      },
    ],
    [effect('declare', 'state')]
  ),
  'state.get': rule(
    'state:boolean',
    'get',
    ['setup', 'callback', 'render'],
    'unknown',
    [],
    [effect('read', 'state')],
    { resultFrom: 'receiver-value' }
  ),
  'state.set': rule(
    'state:boolean',
    'set',
    callbackPhase,
    'void',
    [{ role: 'receiver-value' }, { role: 'value', optional: true }],
    [effect('write', 'state')]
  ),
  'state.setDefault': rule(
    'state:boolean',
    'setDefault',
    setup,
    'void',
    [{ role: 'receiver-value' }],
    [effect('write', 'state')]
  ),
  'state.watch': rule(
    'state:boolean',
    'watch',
    setup,
    'binding-disposer',
    [cb('state-watch', ['run', 'record'], { parameterPolicy: 'state-value' })],
    [effect('subscribe', 'state', 'subscription')]
  ),
  'expose.state': rule(
    'def',
    'expose.state',
    setup,
    'void',
    [key, { role: 'state-handle' }],
    [effect('declare', 'expose')]
  ),
  'expose.value': rule(
    'def',
    'expose.value',
    setup,
    'void',
    [key, { role: 'value' }],
    [effect('declare', 'expose')]
  ),
  'expose.event': rule(
    'def',
    'expose.event',
    setup,
    'void',
    [key, { ...optionalRecord, schema: exposeEventSpec }],
    [effect('declare', 'expose')]
  ),
  'expose.method': rule(
    'def',
    'expose.method',
    setup,
    'void',
    [
      key,
      cb('expose-method', [], {
        parameterPolicy: 'declared-method',
        maxParameters: Number.MAX_SAFE_INTEGER,
        returnType: 'unknown',
      }),
    ],
    [effect('declare', 'expose')]
  ),
  'expose.emit': rule(
    'run',
    'expose.emit',
    callbackPhase,
    'void',
    [key, { role: 'event-payload', optional: true }, optionalRecord],
    [effect('signal', 'expose')]
  ),
  'lifecycle.setPresent': rule(
    'run',
    'lifecycle.setPresent',
    callbackPhase,
    'void',
    [boolean],
    [effect('write', 'view-intent')],
    { contexts: aliveContexts }
  ),
  'lifecycle.onCreated': rule(
    'def',
    'lifecycle.onCreated',
    setup,
    'void',
    [cb('created', ['run'])],
    [effect('subscribe', 'view-intent')]
  ),
  'lifecycle.onMounted': rule(
    'def',
    'lifecycle.onMounted',
    setup,
    'void',
    [cb('mounted', ['run'])],
    [effect('subscribe', 'view')]
  ),
  'lifecycle.onUpdated': rule(
    'def',
    'lifecycle.onUpdated',
    setup,
    'void',
    [cb('updated', ['run'])],
    [effect('subscribe', 'view')]
  ),
  'lifecycle.onUnmounted': rule(
    'def',
    'lifecycle.onUnmounted',
    setup,
    'void',
    [cb('unmounted', ['run'])],
    [effect('subscribe', 'view')]
  ),
  'lifecycle.onBeforeDispose': rule(
    'def',
    'lifecycle.onBeforeDispose',
    setup,
    'void',
    [cb('before-dispose', ['run'])],
    [effect('subscribe', 'view-intent')]
  ),
  'event.on': rule(
    'def',
    'event.on',
    setup,
    'unknown',
    [key, cb('event', ['run', 'event'], { parameterPolicy: 'input-payload' }), hostEventOptions],
    [effect('subscribe', 'event-route', 'subscription')],
    { requiredCapabilities: ['input-events'] }
  ),
  'event.onGlobal': rule(
    'def',
    'event.onGlobal',
    setup,
    'unknown',
    [key, cb('event', ['run', 'event'], { parameterPolicy: 'input-payload' }), hostEventOptions],
    [effect('subscribe', 'event-route', 'subscription')],
    { requiredCapabilities: ['input-events'] }
  ),
  'event.requestDefaultActionPrevention': rule(
    'event',
    'control.requestDefaultActionPrevention',
    callbackPhase,
    'void',
    [
      {
        ...optionalRecord,
        schema: {
          kind: 'record',
          fields: [
            { name: 'reason', type: 'string', optional: true },
            { name: 'source', type: 'string', optional: true },
          ],
        },
      },
    ],
    [effect('write', 'event-route', 'view')],
    { contexts: ['event'], requiredCapabilities: ['input-events'] }
  ),
  'focus.configure': rule(
    'focus',
    'configure',
    setup,
    'void',
    [capabilityConfig],
    [effect('declare', 'focus')],
    { requiredCapabilities: ['focus-target'] }
  ),
  'focus.setDisabled': rule(
    'focus',
    'setDisabled',
    callbackPhase,
    'void',
    [boolean],
    [effect('write', 'focus')],
    { requiredCapabilities: ['focus-target'] }
  ),
  'focus.focusSelf': rule(
    'focus',
    'focusSelf',
    callbackPhase,
    'void',
    [{ role: 'value', schema: FOCUS_OPTIONS_TYPE, optional: true }],
    [effect('signal', 'focus', 'view')],
    { requiredCapabilities: ['focus-target'] }
  ),
  'accessible.state': rule(
    'accessible',
    'state',
    setup,
    'void',
    [key, { role: 'state-handle' }],
    [effect('declare', 'accessibility')],
    { requiredCapabilities: ['accessibility-tree'] }
  ),
  'accessible.action': rule(
    'accessible',
    'action',
    setup,
    'void',
    [key, optionalRecord],
    [effect('declare', 'accessibility')],
    { requiredCapabilities: ['accessibility-tree'] }
  ),
  'accessible.role': rule(
    'accessible',
    'role',
    setup,
    'void',
    [{ role: 'value', types: ['string', 'state:string', 'observed:string'] }],
    [effect('declare', 'accessibility')],
    { requiredCapabilities: ['accessibility-tree'] }
  ),
  'accessible.nameFromContent': rule(
    'accessible',
    'nameFromContent',
    setup,
    'void',
    [],
    [effect('declare', 'accessibility')],
    { requiredCapabilities: ['accessibility-tree'] }
  ),
  'render.el': rule(
    'render',
    'el',
    render,
    'template',
    [
      key,
      { role: 'template-argument', optional: true },
      { role: 'template-argument', optional: true },
    ],
    [effect('write', 'view', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'render.slot': rule('render', 'slot', render, 'template', [], [effect('write', 'view', 'view')], {
    requiredCapabilities: ['view-render'],
  }),
  'context.provide': rule(
    'def',
    'context.provide',
    setup,
    'void',
    [contextKey, { role: 'context-value' }],
    [effect('declare', 'context')]
  ),
  'context.subscribe': rule(
    'def',
    'context.subscribe',
    setup,
    'function',
    [
      contextKey,
      {
        ...cb('context-watch', ['run', 'record', 'record'], { parameterPolicy: 'context-value' }),
        optional: true,
      },
    ],
    [effect('subscribe', 'context', 'subscription')]
  ),
  'context.trySubscribe': rule(
    'def',
    'context.trySubscribe',
    setup,
    'function',
    [
      contextKey,
      {
        ...cb('context-watch', ['run', 'record', 'record'], {
          parameterPolicy: 'nullable-context-value',
        }),
        optional: true,
      },
    ],
    [effect('subscribe', 'context', 'subscription')]
  ),
  'context.read': rule(
    'run',
    'context.read',
    runtime,
    'record',
    [contextKey],
    [effect('read', 'context')],
    { resultFrom: 'context-value' }
  ),
  'context.tryRead': rule(
    'run',
    'context.tryRead',
    runtime,
    'unknown',
    [contextKey],
    [effect('read', 'context')],
    { resultFrom: 'context-value-or-null' }
  ),
  'context.update': rule(
    'run',
    'context.update',
    callbackPhase,
    'void',
    [contextKey, contextNext],
    [effect('write', 'context')]
  ),
  'context.tryUpdate': rule(
    'run',
    'context.tryUpdate',
    callbackPhase,
    'boolean',
    [contextKey, contextNext],
    [effect('write', 'context')]
  ),
  'render.read.context.read': rule(
    'render',
    'read.context.read',
    render,
    'record',
    [contextKey],
    [effect('read', 'context')],
    { resultFrom: 'context-value' }
  ),
  'render.read.context.tryRead': rule(
    'render',
    'read.context.tryRead',
    render,
    'unknown',
    [contextKey],
    [effect('read', 'context')],
    { resultFrom: 'context-value-or-null' }
  ),
  // Full Adapter module families: setup-time hook admission and runtime handle operations.
  'hook.asFocusEntry': rule(
    'void',
    'asFocusEntry',
    setup,
    'focus-entry',
    [],
    [effect('declare', 'focus')],
    { requiredCapabilities: ['focus-target'] }
  ),
  'hook.asFocusScope': rule(
    'void',
    'asFocusScope',
    setup,
    'focus-scope',
    [],
    [effect('declare', 'focus')],
    { requiredCapabilities: ['focus-target'] }
  ),
  'hook.asFocusRoving': rule(
    'void',
    'asFocusRoving',
    setup,
    'focus-roving',
    [],
    [effect('declare', 'focus')],
    { requiredCapabilities: ['focus-target'] }
  ),
  'hook.asOverlay': rule('void', 'asOverlay', setup, 'overlay', [], [effect('declare', 'view')], {
    requiredCapabilities: ['view-render'],
  }),
  'hook.asScrollSurface': rule(
    'void',
    'asScrollSurface',
    setup,
    'scroll',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'hook.asTextControl': rule(
    'void',
    'asTextControl',
    setup,
    'text-control',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'hook.asImageView': rule(
    'void',
    'asImageView',
    setup,
    'image-view',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'hook.asTableStructure': rule(
    'void',
    'asTableStructure',
    setup,
    'table-structure',
    [{ role: 'value', types: ['string'] }],
    [effect('declare', 'accessibility')],
    { requiredCapabilities: ['accessibility-tree'] }
  ),
  'hook.asBoundary': rule(
    'void',
    'asBoundary',
    setup,
    'boundary',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'hook.asHitParticipation': rule(
    'void',
    'asHitParticipation',
    setup,
    'hit-participation',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'hook.asCollection': rule(
    'void',
    'asCollection',
    setup,
    'collection',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'hook.asCollectionItem': rule(
    'void',
    'asCollectionItem',
    setup,
    'collection-item',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'hook.asTransition': rule(
    'void',
    'asTransition',
    setup,
    'transition',
    [],
    [effect('declare', 'view')],
    { requiredCapabilities: ['view-render'] }
  ),
  'transition.configure': rule(
    'transition',
    'configure',
    setup,
    'void',
    [record],
    [effect('declare', 'view-intent')]
  ),
  'transitionControls.enter': rule(
    'transition-controls',
    'enter',
    callbackPhase,
    'void',
    [],
    [effect('write', 'view-intent')]
  ),
  'transitionControls.leave': rule(
    'transition-controls',
    'leave',
    callbackPhase,
    'void',
    [],
    [effect('write', 'view-intent')]
  ),
  'transitionControls.complete': rule(
    'transition-controls',
    'complete',
    callbackPhase,
    'void',
    [],
    [effect('write', 'view-intent')]
  ),
  'focusEntry.configure': rule(
    'focus-entry',
    'configure',
    setup,
    'void',
    [capabilityConfig],
    [effect('declare', 'focus')]
  ),
  'focusEntry.focus': rule(
    'focus-entry',
    'focus',
    callbackPhase,
    'void',
    [{ role: 'value', optional: true, schema: FOCUS_OPTIONS_TYPE }],
    [effect('write', 'focus')]
  ),
  'focusEntry.setDisabled': rule(
    'focus-entry',
    'setDisabled',
    callbackPhase,
    'void',
    [boolean],
    [effect('write', 'focus')]
  ),
  'focusScope.configure': rule(
    'focus-scope',
    'configure',
    setup,
    'void',
    [capabilityConfig],
    [effect('declare', 'focus')]
  ),
  'focusRoving.configure': rule(
    'focus-roving',
    'configure',
    setup,
    'void',
    [capabilityConfig],
    [effect('declare', 'focus')]
  ),
  'focusRoving.focusFirst': rule(
    'focus-roving',
    'focusFirst',
    callbackPhase,
    'void',
    [rovingOptions],
    [effect('write', 'focus')]
  ),
  'focusRoving.focusLast': rule(
    'focus-roving',
    'focusLast',
    callbackPhase,
    'void',
    [rovingOptions],
    [effect('write', 'focus')]
  ),
  'focusRoving.focusNext': rule(
    'focus-roving',
    'focusNext',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focusRoving.focusPrev': rule(
    'focus-roving',
    'focusPrev',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focusRoving.focusSelected': rule(
    'focus-roving',
    'focusSelected',
    callbackPhase,
    'void',
    [rovingOptions],
    [effect('write', 'focus')]
  ),
  'focus.focus': rule(
    'focus',
    'focus',
    callbackPhase,
    'void',
    [{ role: 'value', optional: true, schema: FOCUS_OPTIONS_TYPE }],
    [effect('write', 'focus')]
  ),
  'focus.blur': rule('focus', 'blur', callbackPhase, 'void', [], [effect('write', 'focus')]),
  'focus.setNavParticipation': rule(
    'focus',
    'setNavParticipation',
    callbackPhase,
    'void',
    [{ role: 'value', types: ['string'] }],
    [effect('write', 'focus')]
  ),
  'focus.setRovingStatus': rule(
    'focus',
    'setRovingStatus',
    callbackPhase,
    'void',
    [record],
    [effect('write', 'focus')]
  ),
  'focus.focusFirst': rule(
    'focus-scope',
    'focusFirst',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focus.focusLast': rule(
    'focus-scope',
    'focusLast',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focus.focusNext': rule(
    'focus-scope',
    'focusNext',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focus.focusPrev': rule(
    'focus-scope',
    'focusPrev',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focus.focusSelected': rule(
    'focus-scope',
    'focusSelected',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focus.restoreFocus': rule(
    'focus-scope',
    'restoreFocus',
    callbackPhase,
    'void',
    [],
    [effect('write', 'focus')]
  ),
  'focus.activate': rule(
    'focus-scope',
    'activate',
    callbackPhase,
    'void',
    [{ role: 'value', optional: true, schema: FOCUS_OPTIONS_TYPE }],
    [effect('write', 'focus')]
  ),
  'focus.deactivate': rule(
    'focus-scope',
    'deactivate',
    callbackPhase,
    'void',
    [{ role: 'value', optional: true, schema: FOCUS_OPTIONS_TYPE }],
    [effect('write', 'focus')]
  ),
  'focus.setLoop': rule(
    'focus-roving',
    'setLoop',
    callbackPhase,
    'void',
    [boolean],
    [effect('write', 'focus')]
  ),
  'focus.setOrientation': rule(
    'focus-roving',
    'setOrientation',
    callbackPhase,
    'void',
    [{ role: 'value', types: ['string'] }],
    [effect('write', 'focus')]
  ),
  'focus.isActive': rule(
    'focus-scope',
    'isActive',
    runtime,
    'boolean',
    [],
    [effect('read', 'focus')]
  ),
  'focus.isFocused': rule('focus', 'isFocused', runtime, 'boolean', [], [effect('read', 'focus')]),
  'focusScope.getRoving': rule(
    'focus-scope',
    'getRoving',
    bindingPhase,
    'nullable:focus-roving',
    [],
    [effect('declare', 'focus')]
  ),
  'accessible.id': rule(
    'accessible',
    'id',
    setup,
    'void',
    [{ role: 'value', types: ['string', 'state:string', 'observed:string'] }],
    [effect('declare', 'accessibility')]
  ),
  'accessible.name': rule(
    'accessible',
    'name',
    setup,
    'void',
    [{ role: 'value', types: ['string', 'state:string', 'observed:string'] }],
    [effect('declare', 'accessibility')]
  ),
  'accessible.description': rule(
    'accessible',
    'description',
    setup,
    'void',
    [{ role: 'value', types: ['string', 'state:string', 'observed:string'] }],
    [effect('declare', 'accessibility')]
  ),
  'accessible.relation': rule(
    'accessible',
    'relation',
    setup,
    'void',
    [key, capabilityConfig],
    [effect('declare', 'accessibility')]
  ),
  'accessible.tree': rule(
    'accessible',
    'tree',
    setup,
    'void',
    [capabilityConfig],
    [effect('declare', 'accessibility')]
  ),
  'accessible.level': rule(
    'accessible',
    'level',
    setup,
    'void',
    [{ role: 'value', types: ['number', 'state:number', 'observed:number'] }],
    [effect('declare', 'accessibility')]
  ),
  'anatomy.claim': rule(
    'def',
    'anatomy.claim',
    setup,
    'void',
    [{ role: 'value', types: ['anatomy-family'] }, record],
    [effect('declare', 'view')]
  ),
  'anatomy.subscribeParts': rule(
    'def',
    'anatomy.subscribeParts',
    setup,
    'subscription-disposer',
    [
      { role: 'value', types: ['anatomy-family'] },
      { role: 'static-key' },
      cb('mounted', ['run', 'anatomy-parts']),
    ],
    [effect('subscribe', 'view', 'subscription')]
  ),
  'anatomy.has': rule(
    'run',
    'anatomy.has',
    runtime,
    'boolean',
    [{ role: 'value', types: ['anatomy-family'] }, { role: 'static-key' }],
    [effect('read', 'view')]
  ),
  'anatomy.parts': rule(
    'run',
    'anatomy.parts',
    runtime,
    'anatomy-parts',
    [{ role: 'value', types: ['anatomy-family'] }],
    [effect('read', 'view')]
  ),
  'anatomy.partsOf': rule(
    'run',
    'anatomy.partsOf',
    runtime,
    'anatomy-parts',
    [{ role: 'value', types: ['anatomy-family'] }, { role: 'static-key' }],
    [effect('read', 'view')]
  ),
  'anatomy.order.version': rule(
    'run',
    'anatomy.order.version',
    runtime,
    'number',
    [{ role: 'value', types: ['anatomy-family'] }],
    [effect('read', 'view')]
  ),
  'anatomy.order.parts': rule(
    'run',
    'anatomy.order.parts',
    runtime,
    'anatomy-parts',
    [{ role: 'value', types: ['anatomy-family'] }],
    [effect('read', 'view')]
  ),
  'anatomy.order.partsOf': rule(
    'run',
    'anatomy.order.partsOf',
    runtime,
    'anatomy-parts',
    [{ role: 'value', types: ['anatomy-family'] }, { role: 'static-key' }],
    [effect('read', 'view')]
  ),
  'anatomy.order.indexOfSelf': rule(
    'run',
    'anatomy.order.indexOfSelf',
    runtime,
    'number',
    [{ role: 'value', types: ['anatomy-family'] }, { role: 'static-key' }],
    [effect('read', 'view')]
  ),
  'anatomy.order.prevOfSelf': rule(
    'run',
    'anatomy.order.prevOfSelf',
    runtime,
    'nullable:anatomy-part',
    [{ role: 'value', types: ['anatomy-family'] }, { role: 'static-key' }],
    [effect('read', 'view')]
  ),
  'anatomy.order.nextOfSelf': rule(
    'run',
    'anatomy.order.nextOfSelf',
    runtime,
    'nullable:anatomy-part',
    [{ role: 'value', types: ['anatomy-family'] }, { role: 'static-key' }],
    [effect('read', 'view')]
  ),
  'anatomyPart.hasExpose': rule(
    'anatomy-part',
    'hasExpose',
    runtime,
    'boolean',
    [key],
    [effect('read', 'expose')]
  ),
  'anatomyPart.getExpose': rule(
    'anatomy-part',
    'getExpose',
    runtime,
    'unknown',
    [key],
    [effect('read', 'expose')]
  ),
  'anatomyPart.hasHook': rule(
    'anatomy-part',
    'hasHook',
    runtime,
    'boolean',
    [key],
    [effect('read', 'view')]
  ),
  'tableStructure.configure': rule(
    'table-structure',
    'configure',
    callbackPhase,
    'void',
    [record],
    [effect('write', 'accessibility')]
  ),
  'tableStructure.getObjectRef': rule(
    'table-structure',
    'getObjectRef',
    ['setup', 'callback', 'render'],
    'a11y-ref',
    [],
    [effect('read', 'accessibility')]
  ),
  'tableStructure.getSnapshot': rule(
    'table-structure',
    'getSnapshot',
    runtime,
    'nullable:table-snapshot',
    [],
    [effect('read', 'accessibility')]
  ),
  'host.get': rule(
    'run',
    'host.get',
    callbackPhase,
    'nullable:host-target',
    [],
    [effect('read', 'view')]
  ),
  'collection.configure': rule(
    'collection',
    'configure',
    setup,
    'void',
    [capabilityConfig],
    [effect('declare', 'view')]
  ),
  'collection.getItems': rule(
    'collection',
    'getItems',
    runtime,
    'collection-snapshot-list',
    [],
    [effect('read', 'view')]
  ),
  'collection.getCount': rule(
    'collection',
    'getCount',
    runtime,
    'number',
    [],
    [effect('read', 'view')]
  ),
  'collectionItem.configure': rule(
    'collection-item',
    'configure',
    setup,
    'void',
    [
      {
        ...capabilityConfig,
        fields: { getMeta: cb('collection-meta', ['run'], { returnType: 'record' }) },
      },
    ],
    [effect('declare', 'view')]
  ),
  'collectionItem.getSnapshot': rule(
    'collection-item',
    'getSnapshot',
    runtime,
    'collection-snapshot',
    [],
    [effect('read', 'view')]
  ),
  'boundary.configure': rule(
    'boundary',
    'configure',
    setup,
    'void',
    [record],
    [effect('declare', 'view')]
  ),
  'boundary.observe': rule(
    'boundary',
    'observe',
    setup,
    'void',
    [{ role: 'value', types: ['string'] }],
    [effect('write', 'view')]
  ),
  'boundary.setStackActive': rule(
    'boundary',
    'setStackActive',
    callbackPhase,
    'void',
    [boolean],
    [effect('write', 'view')]
  ),
  'boundary.registerRegion': rule(
    'boundary',
    'registerRegion',
    bindingPhase,
    'binding-disposer',
    [{ role: 'host-target' }, { ...record, optional: true }],
    [effect('subscribe', 'view', 'subscription')]
  ),
  'boundary.unregisterRegion': rule(
    'boundary',
    'unregisterRegion',
    callbackPhase,
    'void',
    [{ role: 'host-target' }],
    [effect('write', 'view')]
  ),
  'boundary.classify': rule(
    'boundary',
    'classify',
    callbackPhase,
    'string',
    [{ ...record, optional: true }],
    [effect('read', 'view')]
  ),
  'boundary.notify': rule(
    'boundary',
    'notify',
    callbackPhase,
    'string',
    [{ ...record, optional: true }],
    [effect('signal', 'view')]
  ),
  'boundary.subscribeOutside': rule(
    'boundary',
    'subscribeOutside',
    bindingPhase,
    'binding-disposer',
    [cb('event', ['boundary-outside-event'])],
    [effect('subscribe', 'view', 'subscription')]
  ),
  'hitParticipation.configure': rule(
    'hit-participation',
    'configure',
    setup,
    'void',
    [record],
    [effect('declare', 'view')]
  ),
  'hitParticipation.registerRegion': rule(
    'hit-participation',
    'registerRegion',
    bindingPhase,
    'binding-disposer',
    [{ role: 'host-target' }, { ...record, optional: true }],
    [effect('subscribe', 'view', 'subscription')]
  ),
  'hitParticipation.unregisterRegion': rule(
    'hit-participation',
    'unregisterRegion',
    callbackPhase,
    'void',
    [{ role: 'host-target' }],
    [effect('write', 'view')]
  ),
  'overlay.isOpen': rule(
    'overlay',
    'isOpen',
    ['setup', 'callback', 'render'],
    'boolean',
    [],
    [effect('read', 'view')]
  ),
  'overlay.openOverlay': rule(
    'overlay',
    'openOverlay',
    callbackPhase,
    'void',
    [{ role: 'value', types: ['string'], optional: true }],
    [effect('write', 'view')]
  ),
  'overlay.close': rule(
    'overlay',
    'close',
    callbackPhase,
    'void',
    [{ role: 'value', types: ['string'], optional: true }],
    [effect('write', 'view')]
  ),
  'overlay.toggle': rule(
    'overlay',
    'toggle',
    callbackPhase,
    'void',
    [{ role: 'value', types: ['string'], optional: true }],
    [effect('write', 'view')]
  ),
  'overlay.configure': rule(
    'overlay',
    'configure',
    setup,
    'void',
    [record],
    [effect('declare', 'view')]
  ),
  'overlay.updatePosition': rule(
    'overlay',
    'updatePosition',
    callbackPhase,
    'void',
    [record],
    [effect('write', 'view')]
  ),
  'overlay.registerTrigger': rule(
    'overlay',
    'registerTrigger',
    bindingPhase,
    'void',
    [{ role: 'host-target' }],
    [effect('declare', 'view')]
  ),
  'overlay.registerAnchor': rule(
    'overlay',
    'registerAnchor',
    bindingPhase,
    'void',
    [{ role: 'host-target' }],
    [effect('declare', 'view')]
  ),
  'overlay.registerAnchorPart': rule(
    'overlay',
    'registerAnchorPart',
    bindingPhase,
    'void',
    [{ role: 'value', types: ['anatomy-part', 'nullable:anatomy-part', 'null'] }],
    [effect('declare', 'view')]
  ),
  'overlay.registerContent': rule(
    'overlay',
    'registerContent',
    bindingPhase,
    'void',
    [{ role: 'host-target' }],
    [effect('declare', 'view')]
  ),
  'overlay.getPositionSnapshot': rule(
    'overlay',
    'getPositionSnapshot',
    runtime,
    { kind: 'union', members: [positionSnapshot, 'null'] },
    [],
    [effect('read', 'view')]
  ),
  'overlay.keepMounted': rule(
    'overlay',
    'keepMounted',
    setup,
    'void',
    [],
    [effect('write', 'view')]
  ),
  'overlay.bindPresence': rule(
    'overlay',
    'bindPresence',
    setup,
    'void',
    [capabilityConfig],
    [effect('subscribe', 'view', 'subscription')]
  ),
  'scroll.configure': rule(
    'scroll',
    'configure',
    setup,
    'void',
    [record],
    [effect('declare', 'view')]
  ),
  'scroll.bindComposedChrome': rule(
    'scroll',
    'bindComposedChrome',
    setup,
    'void',
    [capabilityConfig],
    [effect('declare', 'view')]
  ),
  'scroll.request': rule(
    'scroll',
    'request',
    callbackPhase,
    'void',
    [record],
    [effect('write', 'view')]
  ),
  'scroll.getSnapshot': rule(
    'scroll',
    'getSnapshot',
    runtime,
    scrollSnapshot,
    [],
    [effect('read', 'view')]
  ),
  'textControl.on': rule(
    'text-control',
    'on',
    setup,
    'subscription-disposer',
    [{ role: 'static-key' }, cb('event', ['run', textEvent])],
    [effect('subscribe', 'view', 'subscription')]
  ),
  'textControl.sync': rule(
    'text-control',
    'sync',
    callbackPhase,
    'void',
    [record],
    [effect('write', 'view')]
  ),
  'textControl.snapshot': rule(
    'text-control',
    'snapshot',
    runtime,
    { kind: 'union', members: [textSnapshot, 'null'] },
    [],
    [effect('read', 'view')]
  ),
  'imageView.on': rule(
    'image-view',
    'on',
    setup,
    'subscription-disposer',
    [{ role: 'static-key' }, cb('event', ['run', imageEvent])],
    [effect('subscribe', 'view', 'subscription')]
  ),
  'imageView.sync': rule(
    'image-view',
    'sync',
    callbackPhase,
    'void',
    [record],
    [effect('write', 'view')]
  ),
  'imageView.snapshot': rule(
    'image-view',
    'snapshot',
    runtime,
    { kind: 'union', members: [imageSnapshot, 'null'] },
    [],
    [effect('read', 'view')]
  ),
  'positioning.connect': rule(
    'positioning',
    'connect',
    bindingPhase,
    'void',
    [{ ...capabilityConfig, fields: { onResolved: cb('positioning', [positionSnapshot]) } }],
    [effect('declare', 'view')]
  ),
  'positioning.update': rule(
    'positioning',
    'update',
    callbackPhase,
    'void',
    [record],
    [effect('write', 'view')]
  ),
  'positioning.requestUpdate': rule(
    'positioning',
    'requestUpdate',
    callbackPhase,
    'void',
    [],
    [effect('write', 'view')]
  ),
  'positioning.disconnect': rule(
    'positioning',
    'disconnect',
    callbackPhase,
    'void',
    [],
    [effect('write', 'view')]
  ),
  'positioning.getSnapshot': rule(
    'positioning',
    'getSnapshot',
    runtime,
    { kind: 'union', members: [positionSnapshot, 'null'] },
    [],
    [effect('read', 'view')]
  ),
} satisfies Record<string, OperationRule>;

export type SemanticOperation = keyof typeof OPERATION_RULES;
export interface OperationContractIssue {
  code:
    | 'unknown-operation'
    | 'phase'
    | 'context'
    | 'receiver'
    | 'arity'
    | 'argument-type'
    | 'static-key'
    | 'undeclared-key'
    | 'callback-arity'
    | 'callback-type'
    | 'callback-context'
    | 'callback-return'
    | 'missing-signature';
  message: string;
  argument?: number;
  parameter?: number;
}
export interface OperationBindings {
  callbackContext?: CallbackContext;
  propNames?: ReadonlySet<string>;
  contextValueType?: DataType;
  stateValueType?: 'boolean' | 'number' | 'string';
  eventPayloadType?: DataType;
  inputPayloadType?: 'event' | 'host-event';
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
  return Object.hasOwn(OPERATION_RULES, operation)
    ? OPERATION_RULES[operation as SemanticOperation]
    : undefined;
}
function data(type: ValueType): DataType | undefined {
  if (typeof type === 'string')
    return type === 'boolean' ||
      type === 'number' ||
      type === 'string' ||
      type === 'null' ||
      type === 'void'
      ? type
      : undefined;
  try {
    return parseDataType(type);
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
function assignable(actual: ValueType, expected: ValueType): boolean {
  if (actual === expected || isCapabilityAssignable(actual, expected)) return true;
  const a = data(actual);
  const e = data(expected);
  if (a && e) return isAssignable(a, e);
  return expected === 'record'
    ? actual === 'props' || (typeof a === 'object' && a.kind === 'record')
    : expected === 'array'
      ? typeof a === 'object' && a.kind === 'array'
      : false;
}
export function isTemplateChildType(type: ValueType): boolean {
  if (typeof type === 'string')
    return ['array', 'template', 'string', 'number', 'null'].includes(type);
  switch (type.kind) {
    case 'union':
      return type.members.every(isTemplateChildType);
    case 'array':
      return isTemplateChildType(type.element);
    case 'literal':
      return (
        type.value === null || typeof type.value === 'string' || typeof type.value === 'number'
      );
    default:
      return false;
  }
}
function templateProps(type: ValueType): boolean {
  return (
    type === 'template-props' ||
    (typeof type !== 'string' && type.kind === 'record' && type.fields.length === 0)
  );
}
export function stateValue(receiver?: ValueType): 'boolean' | 'number' | 'string' | undefined {
  if (
    receiver === 'state:boolean' ||
    receiver === 'observed:boolean' ||
    receiver === 'borrowed:boolean'
  )
    return 'boolean';
  if (
    receiver === 'state:number' ||
    receiver === 'observed:number' ||
    receiver === 'borrowed:number'
  )
    return 'number';
  if (
    receiver === 'state:string' ||
    receiver === 'observed:string' ||
    receiver === 'borrowed:string'
  )
    return 'string';
  return undefined;
}
const capabilityMembers: Readonly<Record<string, Readonly<Record<string, ValueType>>>> = {
  focus: {
    focused: 'observed:boolean',
    focusVisible: 'observed:boolean',
    focusable: 'observed:boolean',
  },
  'focus-scope': { active: 'observed:boolean', hasFocused: 'observed:boolean' },
  'focus-roving': { active: 'observed:boolean', hasFocused: 'observed:boolean' },
  'anatomy-part': { role: 'string' },
  collection: { count: 'state:number' },
  'collection-item': {
    collectionIndex: 'state:number',
    collectionTotal: 'state:number',
    collectionFirst: 'state:boolean',
    collectionLast: 'state:boolean',
  },
  'collection-snapshot': { index: 'number', total: 'number', first: 'boolean', last: 'boolean' },
  overlay: { open: 'observed:boolean' },
  scroll: {
    axes: 'observed:string',
    horizontal: 'scroll-axis',
    vertical: 'scroll-axis',
    scrolling: 'observed:boolean',
    projection: 'observed:string',
    endFollow: 'scroll-follow',
  },
  'scroll-axis': {
    position: 'observed:number',
    visibleRatio: 'observed:number',
    canScrollBefore: 'observed:boolean',
    canScrollAfter: 'observed:boolean',
    atEnd: 'observed:boolean',
  },
  'scroll-follow': { state: 'observed:string', requestStatus: 'observed:string' },
  'table-structure': { role: 'string', states: 'table-states' },
  'table-states': {
    a11yRole: 'state:string',
    rowCount: 'state:number',
    columnCount: 'state:number',
    row: 'state:number',
    column: 'state:number',
    rowSpan: 'state:number',
    columnSpan: 'state:number',
  },
  transition: {
    transitionState: 'borrowed:string',
    isPresent: 'borrowed:boolean',
    controls: 'transition-controls',
  },
  'transition-controls': {
    enter: 'transition-action',
    leave: 'transition-action',
    complete: 'transition-action',
  },
  'boundary-outside-event': {
    classification: { kind: 'literal', value: 'outside' },
    sample: 'optional:boundary-sample',
  },
  'boundary-sample': {
    type: { kind: 'union', members: ['string', 'void'] },
    target: 'optional:host-target',
    nativeEvent: 'unknown',
    meta: 'record',
  },
  'table-snapshot': {
    root: 'a11y-ref',
    caption: 'optional:a11y-ref',
    rowCount: 'number',
    columnCount: 'number',
    rows: 'table-row-list',
    valid: 'boolean',
    diagnostics: 'table-diagnostic-list',
  },
  'table-row': { ref: 'a11y-ref', index: 'number', cells: 'table-cell-list' },
  'table-cell': {
    ref: 'a11y-ref',
    kind: 'string',
    row: 'number',
    column: 'number',
    rowSpan: 'number',
    columnSpan: 'number',
    columnHeaders: 'a11y-ref-list',
    rowHeaders: 'a11y-ref-list',
    orderedHeaders: 'a11y-ref-list',
  },
  'table-diagnostic': {
    code: 'string',
    ref: 'optional:a11y-ref',
    row: { kind: 'union', members: ['number', 'void'] },
    headerKey: { kind: 'union', members: ['string', 'void'] },
  },
};
const capabilityListMembers: Readonly<Record<string, ModuleCapabilityType>> = {
  'anatomy-parts': 'anatomy-part',
  'a11y-ref-list': 'a11y-ref',
  'collection-snapshot-list': 'collection-snapshot',
  'table-row-list': 'table-row',
  'table-cell-list': 'table-cell',
  'table-diagnostic-list': 'table-diagnostic',
};
export function capabilityBinaryType(
  operator: string,
  left: ValueType,
  right: ValueType
): ValueType | undefined {
  if (operator !== '??' || typeof left !== 'string' || !/^(nullable|optional):/.test(left))
    return undefined;
  const base = left.slice(left.indexOf(':') + 1) as ModuleCapabilityType;
  if (right === base || right === `nullable:${base}` || right === `optional:${base}`) return right;
  if (right === 'null') return `nullable:${base}`;
  if (right === 'void') return `optional:${base}`;
  return undefined;
}
export function capabilityMemberType(
  owner: ValueType,
  property: string,
  optional = false
): ValueType | undefined {
  if (typeof owner !== 'string') return undefined;
  if (/^state-(event|next):(boolean|number|string)$/.test(owner)) {
    const next = owner.startsWith('state-next:');
    if (property === 'type')
      return next
        ? { kind: 'literal', value: 'next' }
        : {
            kind: 'union',
            members: [
              { kind: 'literal', value: 'next' },
              { kind: 'literal', value: 'disconnect' },
            ],
          };
    if (property === 'reason') return 'unknown';
    if (property === 'next' || property === 'prev') {
      const primitive = owner.slice(owner.indexOf(':') + 1) as 'boolean' | 'number' | 'string';
      return next ? primitive : { kind: 'union', members: [primitive, 'void'] };
    }
  }
  if (owner === 'state-disconnect')
    return property === 'type'
      ? { kind: 'literal', value: 'disconnect' }
      : property === 'reason'
        ? { kind: 'literal', value: 'unmount' }
        : undefined;
  if (/^(nullable|optional):/.test(owner)) {
    if (!optional) return undefined;
    const member = capabilityMemberType(owner.slice(owner.indexOf(':') + 1) as ValueType, property);
    if (member === undefined) return undefined;
    const memberData = data(member);
    if (memberData) return parseDataType({ kind: 'union', members: [memberData, 'void'] });
    return typeof member === 'string' && member.startsWith('optional:')
      ? member
      : (`optional:${member}` as ValueType);
  }
  if (Object.hasOwn(capabilityListMembers, owner)) {
    if (property === 'length') return 'number';
    if (/^(0|[1-9]\d*)$/.test(property) && Number(property) < 0xffffffff)
      return `optional:${capabilityListMembers[owner]}`;
  }
  return Object.hasOwn(capabilityMembers, owner) &&
    Object.hasOwn(capabilityMembers[owner], property)
    ? capabilityMembers[owner][property]
    : undefined;
}
function nullable(type: DataType): DataType {
  return { kind: 'union', members: [type, 'null'] };
}
export function operationResultType(
  operation: string,
  receiver?: ValueType,
  bindings: OperationBindings = {}
): ValueType | undefined {
  const contract = lookup(operation);
  if (!contract) return undefined;
  switch (contract.resultFrom) {
    case 'receiver-value':
      return stateValue(receiver);
    case 'context-value':
      return bindings.contextValueType;
    case 'context-value-or-null':
      return bindings.contextValueType ? nullable(bindings.contextValueType) : undefined;
    default:
      return contract.result;
  }
}
export function operationCallbackRule(operation: string, index: number): CallbackRule | undefined {
  const signature = lookup(operation)?.arguments[index]?.callback;
  return signature ? { at: index, ...signature } : undefined;
}
export function operationArgumentRule(operation: string, index: number): ArgumentRule | undefined {
  return lookup(operation)?.arguments[index];
}
export function validateOperationPhase(
  operation: string,
  phase: Phase,
  context?: CallbackContext
): readonly OperationContractIssue[] {
  const contract = lookup(operation);
  if (!contract) return [{ code: 'unknown-operation', message: `Unknown operation ${operation}.` }];
  if (!contract.phases.includes(phase))
    return [{ code: 'phase', message: `${operation} is not permitted in ${phase}.` }];
  if (contract.contexts && (!context || !contract.contexts.includes(context))) {
    return [
      {
        code: 'context',
        message: `${operation} requires ${contract.contexts.join(', ')} context; received ${context ?? 'unspecified'}.`,
      },
    ];
  }
  return [];
}

/** Check callback capability types exactly: annotating a run/event/data parameter as another
 * capability must not grant authority. Callbacks may omit unused trailing parameters. */
export function validateOperationCallback(
  callback: OperationCallback,
  signature: CallbackRule,
  bindings: OperationBindings = {}
): readonly OperationContractIssue[] {
  const issues: OperationContractIssue[] = [];
  let parameters: readonly { type: ValueType; optional?: boolean }[] = signature.parameters.map(
    (type) => ({ type })
  );
  let result = signature.returnType;
  let max = signature.maxParameters;
  if (signature.parameterPolicy === 'declared-method') {
    if (!bindings.methodParameters || bindings.methodReturnType === undefined)
      return [
        {
          code: 'missing-signature',
          message: 'Expose methods require a checked parameter and return signature.',
        },
      ];
    parameters = bindings.methodParameters;
    result = bindings.methodReturnType;
    max = parameters.length;
  } else if (signature.parameterPolicy === 'input-payload') {
    if (!bindings.inputPayloadType)
      return [
        {
          code: 'missing-signature',
          message: 'Input callbacks require a resolved portable or raw-host payload boundary.',
        },
      ];
    parameters = [{ type: 'run' }, { type: bindings.inputPayloadType }];
  } else if (signature.parameterPolicy === 'state-value') {
    if (!bindings.stateValueType)
      return [
        {
          code: 'missing-signature',
          message: 'State watchers require a resolved primitive State value type.',
        },
      ];
    parameters = [{ type: 'run' }, { type: `state-event:${bindings.stateValueType}` }];
  } else if (signature.parameterPolicy) {
    if (!bindings.contextValueType)
      return [
        {
          code: 'missing-signature',
          message: 'Context callbacks require a resolved key value type.',
        },
      ];
    const value =
      signature.parameterPolicy === 'nullable-context-value'
        ? nullable(bindings.contextValueType)
        : bindings.contextValueType;
    parameters =
      signature.parameterPolicy === 'context-updater'
        ? [{ type: value }]
        : [{ type: 'run' }, { type: value }, { type: value }];
    if (signature.parameterPolicy === 'context-updater') result = value;
  }
  const context = signature.contextFrom === 'caller' ? bindings.callbackContext : signature.context;
  if (!context || callback.phase !== signature.phase || callback.context !== context)
    issues.push({
      code: 'callback-context',
      message: `Callback must have ${signature.phase}/${context ?? 'resolved caller'} authority.`,
    });
  if (callback.parameters.length < signature.minParameters || callback.parameters.length > max)
    issues.push({
      code: 'callback-arity',
      message: `Callback accepts at most ${max} parameters and at least ${signature.minParameters}.`,
    });
  callback.parameters.forEach((parameter, index) => {
    const expected = parameters[index];
    if (!expected) return;
    const actualData = data(parameter.type);
    const expectedData = data(expected.type);
    if (
      actualData && expectedData
        ? !dataTypeEqual(actualData, expectedData)
        : parameter.type !== expected.type
    )
      issues.push({
        code: 'callback-type',
        message: `Callback parameter ${index + 1} does not match its semantic type.`,
        parameter: index,
      });
    if (expected.optional && !parameter.optional)
      issues.push({
        code: 'callback-type',
        message: `Callback parameter ${index + 1} must accept omission.`,
        parameter: index,
      });
  });
  // Like the public void callback signature, unused return values are allowed for registration
  // callbacks. Exposed methods and context updaters have observable return contracts instead.
  if (
    (signature.parameterPolicy === 'declared-method' ||
      signature.parameterPolicy === 'context-updater' ||
      signature.returnType !== 'void') &&
    (callback.returnType === undefined || !assignable(callback.returnType, result))
  )
    issues.push({
      code: 'callback-return',
      message: 'Callback return type does not match its semantic signature.',
    });
  return issues;
}

function staticKey(argument: OperationArgument): argument is OperationArgument & { value: string } {
  return (
    argument.kind === 'literal' && typeof argument.value === 'string' && argument.value.length > 0
  );
}
function argumentData(argument: OperationArgument): DataType | undefined {
  if (
    argument.kind === 'literal' &&
    (argument.value === null ||
      typeof argument.value === 'string' ||
      typeof argument.value === 'number' ||
      typeof argument.value === 'boolean')
  )
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

function jsonData(type: DataType | undefined): boolean {
  if (type === undefined) return false;
  if (typeof type === 'string') return type !== 'void';
  switch (type.kind) {
    case 'literal':
      return true;
    case 'array':
      return jsonData(type.element);
    case 'record':
      return type.fields.every((field) => jsonData(field.type));
    case 'union':
      return type.members.every(jsonData);
  }
}

function propDeclarationIssues(input: OperationArgument): readonly OperationContractIssue[] {
  const issues: OperationContractIssue[] = [];
  const invalid = (message: string) => issues.push({ code: 'argument-type', message, argument: 0 });
  if (input.kind !== 'record' || !input.entries) {
    invalid('Props declarations must be literal records.');
    return issues;
  }
  for (const entry of input.entries) {
    const descriptor = entry.value;
    if (descriptor.kind !== 'record' || !descriptor.entries) {
      invalid(`Prop ${entry.key} requires a literal descriptor record.`);
      continue;
    }
    const type = descriptor.entries.find((field) => field.key === 'type')?.value;
    const options = descriptor.entries.find((field) => field.key === 'options')?.value;
    if (
      type?.kind !== 'literal' ||
      typeof type.value !== 'string' ||
      !['any', 'boolean', 'string', 'number', 'object', 'enum'].includes(type.value)
    ) {
      invalid(`Prop ${entry.key} requires a supported explicit type.`);
      continue;
    }
    if (type.value === 'enum') {
      if (
        options?.kind !== 'array' ||
        !options.elements?.length ||
        options.elements.some(
          (option) => option.kind !== 'literal' || typeof option.value !== 'string'
        )
      )
        invalid(`Enum prop ${entry.key} requires a nonempty literal string options array.`);
    } else if (options !== undefined) invalid(`Only enum props accept options: ${entry.key}.`);
    for (const field of descriptor.entries) {
      if (
        field.key === 'empty' &&
        (field.value.kind !== 'literal' ||
          !['accept', 'fallback', 'error'].includes(String(field.value.value)))
      )
        invalid(`Prop ${entry.key} has an invalid empty behavior.`);
      if (
        field.key === 'range' &&
        !(field.value.kind === 'literal' && field.value.value === null)
      ) {
        if (field.value.kind !== 'record' || !field.value.entries)
          invalid(`Prop ${entry.key} requires a checked range record.`);
        else if (
          field.value.entries.some(
            (bound) => ['min', 'max'].includes(bound.key) && bound.value.type !== 'number'
          )
        )
          invalid(`Prop ${entry.key} range bounds must be numbers.`);
      }
      if (field.key === 'default' && !jsonData(argumentData(field.value)))
        invalid(`Prop ${entry.key} default must be JSON data.`);
      if (field.key === 'enum')
        invalid(`Prop ${entry.key} must use type enum with options, not the legacy enum field.`);
    }
  }
  return issues;
}

/** Receiver, argument and callback validation shared by source admission and external IR.
 * Declaration/reference resolution (prop/expose/context ownership) remains caller-owned. */
export function validateOperationArguments(
  operation: string,
  args: readonly OperationArgument[],
  receiver?: ValueType,
  bindings: OperationBindings = {}
): readonly OperationContractIssue[] {
  const contract = lookup(operation);
  if (!contract) return [{ code: 'unknown-operation', message: `Unknown operation ${operation}.` }];
  const issues: OperationContractIssue[] = [];
  if (
    contract.receiver === 'state:boolean'
      ? !stateValue(receiver)
      : (receiver ?? 'void') !== contract.receiver
  )
    issues.push({ code: 'receiver', message: `${operation} has an incompatible receiver.` });
  if (
    (operation === 'state.set' || operation === 'state.setDefault') &&
    typeof receiver === 'string' &&
    receiver.startsWith('observed:')
  )
    issues.push({ code: 'receiver', message: 'Observed facts have no write authority.' });
  if (operation === 'state.watch' && typeof receiver === 'string' && receiver.startsWith('state:'))
    issues.push({
      code: 'receiver',
      message:
        'Owned State has no watch authority; only Borrowed and Observed handles may register watchers.',
    });
  if (args.length < contract.min || args.length > contract.max)
    issues.push({
      code: 'arity',
      message: `${operation} requires ${contract.min}..${contract.max} arguments.`,
    });
  if (
    (operation === 'event.on' || operation === 'event.onGlobal') &&
    args.length > 2 &&
    (!staticKey(args[0]) || !args[0].value.startsWith('host:'))
  )
    issues.push({
      code: 'argument-type',
      message: 'Listener options are only admitted for explicit host:* extension events.',
      argument: 2,
    });
  args.forEach((argument, index) => {
    const requirement =
      contract.arguments[index] ??
      (['feedback.style.use', 'feedback.style.patch', 'feedback.style.suppress'].includes(operation)
        ? contract.arguments[0]
        : undefined);
    if (!requirement) return;
    const reject = (code: OperationContractIssue['code'], message: string) =>
      issues.push({ code, message, argument: index });
    if (requirement.types && !requirement.types.some((type) => assignable(argument.type, type)))
      reject('argument-type', `Argument ${index + 1} has an incompatible type.`);
    if (requirement.schema) {
      const actual = argumentData(argument);
      const expected: DataType = requirement.optional
        ? { kind: 'union', members: [requirement.schema, 'void'] }
        : requirement.schema;
      if (!actual || !isAssignable(actual, expected))
        reject('argument-type', `Argument ${index + 1} does not satisfy its data schema.`);
    }
    switch (requirement.role) {
      case 'host-target':
        if (
          !['host-target', 'nullable:host-target', 'optional:host-target', 'null', 'void'].includes(
            String(argument.type)
          )
        )
          reject('argument-type', 'A target-native opaque host reference or null is required.');
        break;
      case 'static-key':
      case 'prop-key':
        if (!staticKey(argument)) reject('static-key', 'A nonempty static string key is required.');
        else if (
          requirement.role === 'prop-key' &&
          bindings.propNames &&
          !bindings.propNames.has(argument.value)
        )
          reject('undeclared-key', `Unknown prop ${argument.value}.`);
        break;
      case 'static-keys':
      case 'declared-prop-keys':
        if (
          argument.kind !== 'array' ||
          !argument.elements?.length ||
          argument.elements.some((item) => !staticKey(item))
        )
          reject('static-key', 'A nonempty literal array of nonempty static keys is required.');
        else if (
          requirement.role === 'declared-prop-keys' &&
          bindings.propNames &&
          argument.elements.some((item) => !bindings.propNames!.has(item.value as string))
        )
          reject('undeclared-key', 'Watch keys must name declared props.');
        break;
      case 'state-handle':
        if (!stateValue(argument.type)) reject('argument-type', 'A state handle is required.');
        break;
      case 'receiver-value': {
        const expected = stateValue(receiver);
        if (!expected || !assignable(argument.type, expected))
          reject('argument-type', 'State write type differs from its receiver value type.');
        break;
      }
      case 'context-key':
        if (argument.type !== ('context-key' as ValueType))
          reject('argument-type', 'A declared context key capability is required.');
        if (!bindings.contextValueType)
          reject('missing-signature', 'Context key value type must be resolved before admission.');
        break;
      case 'context-value':
      case 'context-next':
        if (requirement.role === 'context-next' && argument.kind === 'function') break;
        if (!bindings.contextValueType || !assignable(argument.type, bindings.contextValueType))
          reject('argument-type', 'Context value does not match its declared key type.');
        break;
      case 'event-payload':
        if (!bindings.eventPayloadType)
          reject('missing-signature', 'Emitted events require a declared payload signature.');
        else if (!assignable(argument.type, bindings.eventPayloadType))
          reject('argument-type', 'Event payload does not match the declared signature.');
        break;
      case 'template-argument':
        if (
          args.length === 3
            ? index === 1
              ? !templateProps(argument.type)
              : !isTemplateChildType(argument.type)
            : !templateProps(argument.type) && !isTemplateChildType(argument.type)
        )
          reject(
            'argument-type',
            'Element props accept only one style handle; children must be template nodes, text, finite numbers, arrays or null.'
          );
        break;
    }
    if (
      requirement.callback &&
      (!requirement.callback.acceptsValue || argument.kind === 'function')
    ) {
      if (argument.kind !== 'function' || argument.type !== 'function' || !argument.function)
        reject('argument-type', 'An inline checked callback is required.');
      else
        for (const issue of validateOperationCallback(
          argument.function,
          { at: index, ...requirement.callback },
          bindings
        ))
          issues.push({ ...issue, argument: index });
    }
    if (requirement.fields && argument.kind === 'record')
      for (const entry of argument.entries ?? []) {
        const field = requirement.fields[entry.key];
        if (!field) continue;
        if (field.types && !field.types.some((type) => assignable(entry.value.type, type)))
          reject('argument-type', `Configuration field ${entry.key} has an incompatible type.`);
        if (field.callback) {
          if (entry.value.kind !== 'function' || !entry.value.function)
            reject(
              'argument-type',
              `Configuration field ${entry.key} requires a checked callback.`
            );
          else
            for (const issue of validateOperationCallback(
              entry.value.function,
              { at: index, ...field.callback },
              bindings
            ))
              issues.push({ ...issue, argument: index });
        }
      }
  });
  if (operation === 'expose.emit' && args.length < 2) {
    if (!bindings.eventPayloadType)
      issues.push({
        code: 'missing-signature',
        message: 'Emitted events require a declared payload signature.',
        argument: 1,
      });
    else if (!isAssignable('void', bindings.eventPayloadType))
      issues.push({
        code: 'argument-type',
        message: 'This event requires a payload.',
        argument: 1,
      });
  }
  if (operation === 'props.define' && args[0]) issues.push(...propDeclarationIssues(args[0]));
  if (operation === 'props.setDefaults' && args[0]?.kind === 'record') {
    for (const entry of args[0].entries ?? []) {
      if (bindings.propNames && !bindings.propNames.has(entry.key))
        issues.push({
          code: 'undeclared-key',
          message: `Unknown default prop ${entry.key}.`,
          argument: 0,
        });
      if (!jsonData(argumentData(entry.value)))
        issues.push({
          code: 'argument-type',
          message: `Prop default ${entry.key} must be JSON data.`,
          argument: 0,
        });
    }
  }
  return issues;
}
