import type { ValueType } from './ir';
import { CONTROL_LABEL_SELECTION_POLICIES } from '../../core/src/control-label';
import { joinValueTypes, objectValueType } from './value-types';

const literals = (...values: string[]): ValueType => ({
  kind: 'union',
  members: values.map((value) => ({ kind: 'literal', value })),
});
const record = (fields: Record<string, ValueType>): ValueType =>
  objectValueType(Object.entries(fields).map(([name, type]) => ({ name, type })));
const readonlyRecord = (fields: Record<string, ValueType>): ValueType =>
  objectValueType(Object.entries(fields).map(([name, type]) => ({ name, type, readonly: true })));

export const ATTEMPT_TOKEN_TYPE = readonlyRecord({ ownerEpoch: 'number', phaseAttempt: 'number' });
export const PRESENTATION_COMPLETION_TYPE = joinValueTypes([
  { kind: 'literal', value: 'timer' },
  readonlyRecord({ kind: { kind: 'literal', value: 'presentation' }, timeoutMs: 'number' }),
]);
export const PRESENTATION_OUTCOME_TYPE = literals(
  'finished',
  'reduced-motion',
  'unknown-preference',
  'hidden',
  'missing-capability',
  'unsupported-endpoint',
  'unresolved-units',
  'unresolved-input',
  'projection-failed',
  'projection-ownership-lost',
  'deadline',
  'zero-duration',
  'invalid-policy',
  'scheduler-failed'
);
export const PRESENCE_PHASE_TYPE = literals(
  'closed',
  'preparing',
  'entering',
  'entered',
  'leaving'
);
export const PRESENTATION_FRAME_TYPE = readonlyRecord({
  owner: 'presentation-owner-ref',
  revision: 'number',
  phase: PRESENCE_PHASE_TYPE,
  attempt: joinValueTypes([ATTEMPT_TOKEN_TYPE, 'null']),
  completion: literals('timer', 'presentation'),
  durationMs: 'number',
  timeoutMs: joinValueTypes(['number', 'null']),
});
export const PRESENTATION_RECEIPT_TYPE = readonlyRecord({
  owner: 'presentation-owner-ref',
  attempt: ATTEMPT_TOKEN_TYPE,
  viewBinding: 'presentation-view-binding',
  ownerRevision: 'number',
  targetRevision: 'number',
  channels: {
    kind: 'array',
    element: {
      kind: 'union',
      members: [
        { kind: 'literal', value: 'translate' },
        { kind: 'literal', value: 'opacity' },
      ],
    },
  },
  outcome: PRESENTATION_OUTCOME_TYPE,
});
export const COMPLETION_REQUEST_TYPE = readonlyRecord({ receipt: PRESENTATION_RECEIPT_TYPE });

/** Presentation keeps State identity in IR; a user-supplied getter is not a readable State. */
export const AFFINE_LENGTH_TYPE: ValueType = record({
  px: 'number',
  rootText: 'number',
  ownBox: 'number',
});
export const TRANSLATION_TYPE: ValueType = {
  kind: 'array',
  element: AFFINE_LENGTH_TYPE as import('./data-types').DataType,
};
export const PRESENCE_ENDPOINT_TYPE: ValueType = objectValueType([
  {
    name: 'translate',
    optional: true,
    readonly: true,
    type: joinValueTypes([
      TRANSLATION_TYPE,
      readonlyRecord({
        source: joinValueTypes(['state:string', 'observed:string', 'borrowed:string']),
        cases: { kind: 'object', fields: [], index: TRANSLATION_TYPE },
      }),
    ]),
  },
  { name: 'opacity', optional: true, readonly: true, type: 'number' },
]);
export const PRESENTATION_DECLARATION_TYPE: ValueType = readonlyRecord({
  owner: 'presentation-owner-ref',
  closed: PRESENCE_ENDPOINT_TYPE,
  entered: PRESENCE_ENDPOINT_TYPE,
  easing: { kind: 'array', element: 'number' },
});

export const SHADER_PASS_TYPE: ValueType = objectValueType([
  { name: 'id', type: 'string' },
  { name: 'kernel', type: literals('copy-rgba8-v1', 'tint-rgba8-v1') },
  { name: 'input', type: 'string' },
  { name: 'tint', type: { kind: 'array', element: 'number' }, optional: true },
]);
export const SHADER_PRESENTATION_SOURCE_TYPE: ValueType = joinValueTypes([
  readonlyRecord({
    kind: { kind: 'literal', value: 'owned-pixels' },
    width: 'number',
    height: 'number',
    pixels: { kind: 'array', element: 'number' },
    colorSpace: { kind: 'literal', value: 'linear-srgb' },
    alpha: { kind: 'literal', value: 'premultiplied' },
    origin: { kind: 'literal', value: 'top-left' },
  }),
  readonlyRecord({ kind: { kind: 'literal', value: 'owned-scene' }, slot: 'string' }),
]);
export const SHADER_PRESENTATION_TYPE: ValueType = readonlyRecord({
  version: { kind: 'literal', value: 1 },
  source: SHADER_PRESENTATION_SOURCE_TYPE,
  passes: { kind: 'array', element: SHADER_PASS_TYPE as import('./data-types').DataType },
  output: 'string',
  fallback: { kind: 'array', element: 'number' },
});

/** Core Scroll requests retain their discriminants and Anatomy authority in portable IR. */
export const SCROLL_AXIS_TYPE = literals('horizontal', 'vertical');
export const SCROLL_POSITION_REQUEST_TYPE = joinValueTypes([
  record({ kind: { kind: 'literal', value: 'by' }, axis: SCROLL_AXIS_TYPE, delta: 'number' }),
  record({ kind: { kind: 'literal', value: 'to' }, axis: SCROLL_AXIS_TYPE, position: 'number' }),
  record({
    kind: { kind: 'literal', value: 'page' },
    axis: SCROLL_AXIS_TYPE,
    direction: literals('before', 'after'),
  }),
  record({
    kind: { kind: 'literal', value: 'control-drag' },
    axis: SCROLL_AXIS_TYPE,
    position: 'number',
  }),
  record({ kind: { kind: 'literal', value: 'to-end' }, axis: SCROLL_AXIS_TYPE }),
]);
export const SCROLL_REVEAL_REQUEST_TYPE = record({
  kind: { kind: 'literal', value: 'reveal' },
  axis: { kind: 'literal', value: 'vertical' },
  family: 'anatomy-family',
  part: 'anatomy-part',
});
export const SCROLL_REQUEST_TYPE = joinValueTypes([
  SCROLL_POSITION_REQUEST_TYPE,
  SCROLL_REVEAL_REQUEST_TYPE,
]);
export const SCROLL_REQUEST_OUTCOME_TYPE = joinValueTypes([
  record({ kind: { kind: 'literal', value: 'dispatched' } }),
  record({ kind: { kind: 'literal', value: 'queued' } }),
  record({
    kind: { kind: 'literal', value: 'rejected' },
    reason: literals('not-mounted', 'not-declared', 'unavailable'),
  }),
]);

/** These are ordinary per-installation records; they grant no definition or Run authority. */
export const HOOK_API_TYPE: ValueType = record({
  name: 'string',
  order: 'number',
  store: { kind: 'object', fields: [], index: 'unknown' },
});
export const HOOK_TOOLS_TYPE: ValueType = record({
  warn: { kind: 'callable', parameters: [{ name: 'message', type: 'string' }], returnType: 'void' },
  conflict: {
    kind: 'callable',
    parameters: [{ name: 'message', type: 'string' }],
    returnType: { kind: 'union', members: [] },
  },
});

/** Canonical core type exports describe host atoms, never authored component protocols. */
export const CORE_VALUE_TYPES: Readonly<Record<string, ValueType>> = {
  RenderFn: 'function',
  ControlLabelRequest: 'control-label-request',
  ControlLabelSelectionPolicy: literals(...CONTROL_LABEL_SELECTION_POLICIES),
  DefHandle: 'def',
  RunHandle: 'run',
  RendererHandle: 'render',
  A11ySetValueEventPayload: 'a11y-value-event',
  DelayTask: 'delay-task',
  ContextKey: 'context-key',
  PresentationOwnerRef: 'presentation-owner-ref',
  PresentationOwnerWriter: 'presentation-owner-writer',
  PresentationViewBinding: 'presentation-view-binding',
  PresenceOwnerDeclaration: 'presence-owner',
  ShaderPresentationDeclaration: SHADER_PRESENTATION_TYPE,
  ShaderPresentationSource: SHADER_PRESENTATION_SOURCE_TYPE,
  ShaderPass: SHADER_PASS_TYPE,
  AffineLength: AFFINE_LENGTH_TYPE,
  Translation: TRANSLATION_TYPE,
  PresenceEndpoint: PRESENCE_ENDPOINT_TYPE,
  PresencePresentationDeclaration: PRESENTATION_DECLARATION_TYPE,
  AttemptToken: ATTEMPT_TOKEN_TYPE,
  PresencePhase: PRESENCE_PHASE_TYPE,
  PresentationCompletionConfig: PRESENTATION_COMPLETION_TYPE,
  PresentationOutcome: PRESENTATION_OUTCOME_TYPE,
  PresentationOwnerFrame: PRESENTATION_FRAME_TYPE,
  PresentationReceipt: PRESENTATION_RECEIPT_TYPE,
  CompletionRequest: COMPLETION_REQUEST_TYPE,
  ScrollAxis: SCROLL_AXIS_TYPE,
  ScrollSurfacePositionRequest: SCROLL_POSITION_REQUEST_TYPE,
  ScrollSurfaceRevealRequest: SCROLL_REVEAL_REQUEST_TYPE,
  ScrollSurfaceRequest: SCROLL_REQUEST_TYPE,
  ScrollSurfaceRequestOutcome: SCROLL_REQUEST_OUTCOME_TYPE,
  HookConfigApi: HOOK_API_TYPE,
  AsHookConfigApi: HOOK_API_TYPE,
  HookConfigureTools: HOOK_TOOLS_TYPE,
  AsHookConfigureTools: HOOK_TOOLS_TYPE,
};
