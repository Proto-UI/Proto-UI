import type { ValueType } from './ir';
import { CONTROL_LABEL_SELECTION_POLICIES } from '../../core/src/control-label';
import { joinValueTypes, objectValueType } from './value-types';
import { SVG_SCALAR_TYPE, SVG_ROOT_PROPS_TYPE, SVG_PATH_PROPS_TYPE } from './svg-templates';

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
        // Receipts retain the shared channel type independently of target admission.
        { kind: 'literal', value: 'blockSize' },
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
/** Neutral logical lengths preserve the public Positioning value contract. */
export const AVAILABLE_LAYOUT_UNIT_TYPE = literals(
  'logical',
  'root-text',
  'available',
  'available-minus-root-text'
);
export const AVAILABLE_LAYOUT_LENGTH_TYPE = readonlyRecord({
  unit: AVAILABLE_LAYOUT_UNIT_TYPE,
  value: 'number',
});
const stateBound = (type: ValueType, primitive: 'boolean' | 'number' | 'string'): ValueType =>
  joinValueTypes([type, `state:${primitive}`, `borrowed:${primitive}`, `observed:${primitive}`]);
export const AVAILABLE_LAYOUT_EDGE_TYPE = literals('top', 'right', 'bottom', 'left');
export const AVAILABLE_LAYOUT_EXTENT_TYPE = literals('intrinsic', 'fraction');
export const AVAILABLE_LAYOUT_LENGTH_BINDING_TYPE = readonlyRecord({
  unit: stateBound(AVAILABLE_LAYOUT_UNIT_TYPE, 'string'),
  value: stateBound('number', 'number'),
});
export const AVAILABLE_LAYOUT_BINDING_TYPE = objectValueType([
  { name: 'enabled', type: stateBound('boolean', 'boolean'), optional: true, readonly: true },
  { name: 'edge', type: stateBound(AVAILABLE_LAYOUT_EDGE_TYPE, 'string'), readonly: true },
  { name: 'extent', type: stateBound(AVAILABLE_LAYOUT_EXTENT_TYPE, 'string'), readonly: true },
  { name: 'fraction', type: stateBound('number', 'number'), optional: true, readonly: true },
  { name: 'minimum', type: AVAILABLE_LAYOUT_LENGTH_BINDING_TYPE, optional: true, readonly: true },
  { name: 'maximum', type: AVAILABLE_LAYOUT_LENGTH_BINDING_TYPE, optional: true, readonly: true },
  {
    name: 'displacement',
    type: joinValueTypes(['state:number', 'borrowed:number', 'observed:number']),
    optional: true,
    readonly: true,
  },
]);
export const AXIS_INPUT_CANCEL_REASON_TYPE = literals(
  'host-cancel',
  'lost-ownership',
  'target-detached',
  'target-replaced',
  'disposed',
  'disabled',
  'configuration-changed',
  'invalid-geometry',
  'basis-changed'
);
export const AXIS_INPUT_SAMPLE_TYPE = joinValueTypes([
  readonlyRecord({
    phase: literals('start', 'move', 'end'),
    position: 'number',
    delta: 'number',
    totalDelta: 'number',
  }),
  readonlyRecord({
    phase: { kind: 'literal', value: 'cancel' },
    reason: AXIS_INPUT_CANCEL_REASON_TYPE,
  }),
]);

/** Core Scroll requests retain their discriminants and Anatomy authority in portable IR. */
export const SCROLL_AXIS_TYPE = literals('horizontal', 'vertical');
export const SCROLL_END_FOLLOW_STATE_TYPE = literals('off', 'pending', 'following', 'paused');
export const SCROLL_END_FOLLOW_REQUEST_STATUS_TYPE = literals(
  'idle',
  'pending',
  'applied',
  'rejected'
);
export const FOCUS_ROVING_MEMBER_STATUS_TYPE = objectValueType([
  { name: 'selected', type: 'boolean', optional: true, readonly: true },
  { name: 'active', type: 'boolean', optional: true, readonly: true },
]);
export const ANCHORED_POSITION_SIDE_TYPE = literals('top', 'right', 'bottom', 'left');
export const ANCHORED_POSITION_ALIGN_TYPE = literals('start', 'center', 'end');
export const ANCHORED_POSITION_STRATEGY_TYPE = literals('absolute', 'fixed');
export const ANCHORED_COLLISION_BOUNDARY_TYPE = literals('clippingAncestors', 'viewport');
/** Core OverlayConfigPatch keeps the governed layout handles in their named field. */
export const OVERLAY_CONFIG_PATCH_TYPE = objectValueType([
  ...[
    'defaultOpen',
    'closeOnEscape',
    'closeOnOutsidePress',
    'closeOnFocusOutside',
    'closeOnAnchorPress',
    'closeOnTriggerPress',
    'boundaryStack',
    'anchored',
    'availableSpace',
    'avoidCollisions',
    'excludeAnchorTranslation',
    'portal',
    'modal',
  ].map((name) => ({ name, type: 'boolean' as ValueType, optional: true, readonly: true })),
  ...['sideOffset', 'alignOffset', 'collisionPadding', 'layerOffset'].map((name) => ({
    name,
    type: 'number' as ValueType,
    optional: true,
    readonly: true,
  })),
  { name: 'placement', type: ANCHORED_POSITION_SIDE_TYPE, optional: true, readonly: true },
  { name: 'align', type: ANCHORED_POSITION_ALIGN_TYPE, optional: true, readonly: true },
  { name: 'strategy', type: ANCHORED_POSITION_STRATEGY_TYPE, optional: true, readonly: true },
  {
    name: 'collisionBoundary',
    type: ANCHORED_COLLISION_BOUNDARY_TYPE,
    optional: true,
    readonly: true,
  },
  { name: 'availableLayout', type: AVAILABLE_LAYOUT_BINDING_TYPE, optional: true, readonly: true },
  {
    name: 'entry',
    type: literals('first', 'selected', 'content', 'manual'),
    optional: true,
    readonly: true,
  },
  {
    name: 'restore',
    type: literals('trigger', 'previous', 'none'),
    optional: true,
    readonly: true,
  },
  { name: 'layerRole', type: 'string', optional: true, readonly: true },
  {
    name: 'meta',
    type: { kind: 'object', fields: [], index: 'unknown' },
    optional: true,
    readonly: true,
  },
]);
export const ANCHORED_POSITION_CONFIG_TYPE = objectValueType([
  { name: 'side', type: ANCHORED_POSITION_SIDE_TYPE, readonly: true },
  { name: 'align', type: ANCHORED_POSITION_ALIGN_TYPE, readonly: true },
  { name: 'sideOffset', type: 'number', readonly: true },
  { name: 'alignOffset', type: 'number', readonly: true },
  { name: 'strategy', type: ANCHORED_POSITION_STRATEGY_TYPE, readonly: true },
  { name: 'avoidCollisions', type: 'boolean', readonly: true },
  { name: 'collisionBoundary', type: ANCHORED_COLLISION_BOUNDARY_TYPE, readonly: true },
  { name: 'collisionPadding', type: 'number', readonly: true },
  { name: 'excludeAnchorTranslation', type: 'boolean', optional: true, readonly: true },
]);
export const TARGET_ALIGNMENT_CONSTRAINTS_TYPE = readonlyRecord({
  boundary: { kind: 'literal', value: 'layout-viewport' },
  margin: 'number',
  minimumTargetSpanCount: 'number',
  inlineOverflow: { kind: 'literal', value: 'preserve-start' },
  expandOnScroll: 'boolean',
});
export const TARGET_ALIGNMENT_STATUS_TYPE = joinValueTypes([
  readonlyRecord({ status: { kind: 'literal', value: 'applied' } }),
  readonlyRecord({
    status: { kind: 'literal', value: 'pending-target' },
    reason: literals('missing-target', 'detached-target'),
  }),
  readonlyRecord({
    status: { kind: 'literal', value: 'unavailable' },
    reason: literals(
      'unsupported-host',
      'invalid-association',
      'invalid-geometry',
      'ownership-lost',
      'size-conflict'
    ),
  }),
]);
export const OVERLAY_TARGET_ALIGNMENT_BINDING_TYPE = objectValueType([
  { name: 'family', type: 'anatomy-family', readonly: true },
  ...[
    'surface',
    'scrollport',
    'blockReference',
    'inlineReference',
    'blockTarget',
    'inlineTarget',
  ].map((name) => ({ name, type: 'anatomy-part' as ValueType, readonly: true })),
  { name: 'atStart', type: 'boolean', readonly: true },
  { name: 'atEnd', type: 'boolean', readonly: true },
  { name: 'constraints', type: TARGET_ALIGNMENT_CONSTRAINTS_TYPE, readonly: true },
  {
    name: 'sizeMatch',
    type: readonlyRecord({
      reference: 'anatomy-part',
      targets: { kind: 'value-array', element: 'anatomy-part', readonly: true },
    }),
    optional: true,
    readonly: true,
  },
  {
    name: 'onAlignment',
    type: {
      kind: 'callable',
      parameters: [{ name: 'status', type: TARGET_ALIGNMENT_STATUS_TYPE }],
      returnType: 'void',
    },
    readonly: true,
  },
]);
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
  RenderFn: {
    kind: 'callable',
    parameters: [{ name: 'renderer', type: 'render' }],
    returnType: 'template',
  },
  SvgScalar: SVG_SCALAR_TYPE,
  SvgRootProps: SVG_ROOT_PROPS_TYPE,
  SvgPathProps: SVG_PATH_PROPS_TYPE,
  ControlLabelRequest: 'control-label-request',
  ControlLabelSelectionPolicy: literals(...CONTROL_LABEL_SELECTION_POLICIES),
  DefHandle: 'def',
  RunHandle: 'run',
  ProtoEventPayload: 'event',
  CollectionItemSnapshot: 'collection-snapshot',
  CollectionItemSnapshotExposed: 'collection-snapshot',
  RendererHandle: 'render',
  A11ySetValueEventPayload: 'a11y-value-event',
  OwnedDecorationTarget: 'decoration-target',
  DelayTask: 'delay-task',
  Unsubscribe: 'binding-disposer',
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
  AvailableLayoutUnit: AVAILABLE_LAYOUT_UNIT_TYPE,
  AvailableLayoutEdge: AVAILABLE_LAYOUT_EDGE_TYPE,
  AvailableLayoutExtent: AVAILABLE_LAYOUT_EXTENT_TYPE,
  AvailableLayoutLength: AVAILABLE_LAYOUT_LENGTH_TYPE,
  AvailableLayoutLengthBinding: AVAILABLE_LAYOUT_LENGTH_BINDING_TYPE,
  AvailableLayoutBinding: AVAILABLE_LAYOUT_BINDING_TYPE,
  AxisInputCancelReason: AXIS_INPUT_CANCEL_REASON_TYPE,
  AxisInputSample: AXIS_INPUT_SAMPLE_TYPE,
  AxisInputHandle: 'axis-input',
  AnatomyFamily: 'anatomy-family',
  AnatomyPartView: 'anatomy-part',
  OverlayHandle: 'overlay',
  OverlayModuleHandle: 'overlay',
  OverlayTargetAlignmentBinding: OVERLAY_TARGET_ALIGNMENT_BINDING_TYPE,
  TargetAlignmentConstraints: TARGET_ALIGNMENT_CONSTRAINTS_TYPE,
  TargetAlignmentStatus: TARGET_ALIGNMENT_STATUS_TYPE,
  AnchoredPositionSide: ANCHORED_POSITION_SIDE_TYPE,
  AnchoredPositionAlign: ANCHORED_POSITION_ALIGN_TYPE,
  AnchoredPositionStrategy: ANCHORED_POSITION_STRATEGY_TYPE,
  AnchoredCollisionBoundary: ANCHORED_COLLISION_BOUNDARY_TYPE,
  AnchoredPositionConfig: ANCHORED_POSITION_CONFIG_TYPE,
  AnchoredPositionSnapshot: readonlyRecord({
    side: ANCHORED_POSITION_SIDE_TYPE,
    align: ANCHORED_POSITION_ALIGN_TYPE,
    strategy: ANCHORED_POSITION_STRATEGY_TYPE,
  }),
  ScrollAxis: SCROLL_AXIS_TYPE,
  ScrollEndFollowState: SCROLL_END_FOLLOW_STATE_TYPE,
  ScrollEndFollowRequestStatus: SCROLL_END_FOLLOW_REQUEST_STATUS_TYPE,
  FocusRovingMemberStatus: FOCUS_ROVING_MEMBER_STATUS_TYPE,
  ScrollSurfacePositionRequest: SCROLL_POSITION_REQUEST_TYPE,
  ScrollSurfaceRevealRequest: SCROLL_REVEAL_REQUEST_TYPE,
  ScrollSurfaceRequest: SCROLL_REQUEST_TYPE,
  ScrollSurfaceRequestOutcome: SCROLL_REQUEST_OUTCOME_TYPE,
  HookConfigApi: HOOK_API_TYPE,
  AsHookConfigApi: HOOK_API_TYPE,
  HookConfigureTools: HOOK_TOOLS_TYPE,
  AsHookConfigureTools: HOOK_TOOLS_TYPE,
};
