import type { State } from './state';
export type AnchoredPositionSide = 'top' | 'right' | 'bottom' | 'left';
export type AnchoredPositionAlign = 'start' | 'center' | 'end';
export type AnchoredPositionStrategy = 'absolute' | 'fixed';
export type AnchoredCollisionBoundary = 'clippingAncestors' | 'viewport';

export type AnchoredPositionConfig = Readonly<{
  side: AnchoredPositionSide;
  align: AnchoredPositionAlign;
  sideOffset: number;
  alignOffset: number;
  strategy: AnchoredPositionStrategy;
  avoidCollisions: boolean;
  collisionBoundary: AnchoredCollisionBoundary;
  collisionPadding: number;
  /**
   * When true, the host ignores the anchor element's own CSS translation
   * (matrix m41/m42) when measuring anchored geometry. Interaction
   * decorations such as hover lift or press-down are then excluded from
   * floating placement. When false or omitted, the host positions against
   * the anchor's actual rendered geometry, which is the default: legitimate
   * translations (centering, application animation) must keep placing the
   * floating element where the user sees the anchor.
   */
  excludeAnchorTranslation?: boolean;
}>;

export type AnchoredPositionSnapshot = Readonly<{
  side: AnchoredPositionSide;
  align: AnchoredPositionAlign;
  strategy: AnchoredPositionStrategy;
}>;

export type TargetAlignmentConstraints = Readonly<{
  boundary: 'layout-viewport';
  margin: number;
  minimumTargetSpanCount: number;
  inlineOverflow: 'preserve-start';
  expandOnScroll: boolean;
}>;

export type TargetAlignmentStatus =
  | Readonly<{ status: 'applied' }>
  | Readonly<{ status: 'pending-target'; reason: 'missing-target' | 'detached-target' }>
  | Readonly<{
      status: 'unavailable';
      reason:
        | 'unsupported-host'
        | 'invalid-association'
        | 'invalid-geometry'
        | 'ownership-lost'
        | 'size-conflict';
    }>;

/** Opaque host geometry roles. Semantic selection remains with the declaring prototype. */
export type TargetAlignmentConnection = Readonly<{
  surface: unknown;
  scrollport: unknown;
  blockReference: unknown;
  inlineReference: unknown;
  blockTarget: unknown;
  inlineTarget: unknown;
  atStart: boolean;
  atEnd: boolean;
  constraints: TargetAlignmentConstraints;
  /** Optional neutral used-border-box matching, owned by this geometry lease. */
  sizeMatch?: Readonly<{ reference: unknown; targets: readonly unknown[] }>;
}>;

export type AnchoredPositionConnection = Readonly<{
  anchor: unknown;
  floating: unknown;
  config: AnchoredPositionConfig;
  onResolved?(snapshot: AnchoredPositionSnapshot): void;
  targetAlignment?: TargetAlignmentConnection;
  onAlignment?(status: TargetAlignmentStatus): void;
}>;

export interface AnchoredPositionHandle {
  connect(connection: AnchoredPositionConnection): void;
  update(config: AnchoredPositionConfig): void;
  requestUpdate(): void;
  disconnect(): void;
  getSnapshot(): AnchoredPositionSnapshot | null;
}

/** A host-logical root-content region; no browser or platform objects cross this boundary. */
export type AvailableSpaceRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type AvailableSpaceFrame = Readonly<{
  rect: AvailableSpaceRect | null;
  revision: number;
  viewEpoch: number;
}>;
export type AvailableSpaceConnection = Readonly<{ target: unknown; boundary: 'root-content' }>;
export interface AvailableSpaceHandle {
  /** Setup-only; resolved and observed by Positioning, never by the prototype host. */
  bindLayout?(binding: AvailableLayoutBinding): void;
  connect(connection: AvailableSpaceConnection): void;
  requestUpdate(): void;
  disconnect(): void;
}

/** Neutral constrained layout intent; host measurements never become author State. */
export type AvailableLayoutEdge = 'top' | 'right' | 'bottom' | 'left';
export type AvailableLayoutExtent = 'intrinsic' | 'fraction';
export type AvailableLayoutUnit =
  | 'logical'
  | 'root-text'
  | 'available'
  | 'available-minus-root-text';
export type AvailableLayoutValue<T> = T | State<T>;
export type AvailableLayoutLengthBinding = Readonly<{
  unit: AvailableLayoutValue<AvailableLayoutUnit>;
  value: AvailableLayoutValue<number>;
}>;
export type AvailableLayoutLength = Readonly<{ unit: AvailableLayoutUnit; value: number }>;
export type AvailableLayoutBinding = Readonly<{
  enabled?: AvailableLayoutValue<boolean>;
  edge: AvailableLayoutValue<AvailableLayoutEdge>;
  extent: AvailableLayoutValue<AvailableLayoutExtent>;
  fraction?: AvailableLayoutValue<number>;
  minimum?: AvailableLayoutLengthBinding;
  maximum?: AvailableLayoutLengthBinding;
  displacement?: State<number>;
}>;
export type AvailableLayoutSnapshot = Readonly<{
  edge: AvailableLayoutEdge;
  extent: AvailableLayoutExtent;
  fraction: number;
  minimum: AvailableLayoutLength;
  maximum: AvailableLayoutLength;
  displacement: number;
}>;
export type AvailableLayoutFrame =
  | Readonly<{ status: 'ready'; value: AvailableLayoutSnapshot }>
  | Readonly<{ status: 'disabled' | 'invalid' }>;
