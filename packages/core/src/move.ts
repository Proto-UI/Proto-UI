/**
 * A host-local point used only while a move gesture session is active.
 * Units and coordinate spaces are owned by the host and are never author state.
 */
export type MoveGesturePoint = Readonly<{
  x: number;
  y: number;
}>;

export type MoveGestureAxis = 'horizontal' | 'vertical' | 'both';
export type MoveGestureInput = 'mouse' | 'touch' | 'pen' | 'unknown';
/** Directional recognition is an opt-in draft; immediate remains the default consumer policy. */
export type MoveGestureActivation = 'immediate' | 'directional';

export type MoveGestureSample = Readonly<{
  input: MoveGestureInput;
  position: MoveGesturePoint;
  delta: MoveGesturePoint;
  totalDelta: MoveGesturePoint;
  timestamp: number;
  /** Optional finite association into the privileged binding's ordered origin targets. */
  originIndex?: number | null;
}>;

export type MoveGestureCancelReason =
  | 'host-cancel'
  | 'lost-ownership'
  | 'target-detached'
  | 'target-replaced'
  | 'disposed';

/**
 * Internal host binding for one continuous primary-contact move gesture.
 * It deliberately does not model drag payloads, drop targets, collision, or
 * collection reorder semantics.
 */
export type MoveGestureHostBinding = Readonly<{
  target: unknown;
  axis: MoveGestureAxis;
  activation: MoveGestureActivation;
  /** Privileged hit-test targets; original contact association survives capture. */
  originTargets?: readonly unknown[];
  shouldStart?(sample: MoveGestureSample): boolean;
  onStart(sample: MoveGestureSample): void;
  onMove(sample: MoveGestureSample): void;
  onEnd(sample: MoveGestureSample): void;
  onCancel(reason: MoveGestureCancelReason): void;
}>;

export interface MoveGestureHostLease {
  update(binding: MoveGestureHostBinding): void;
  dispose(): void;
}

export interface MoveGestureHost {
  attach(binding: MoveGestureHostBinding): MoveGestureHostLease;
}
