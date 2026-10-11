import type { PropsBaseType } from '@proto.ui/types';
import type { AnatomyFamily } from './anatomy';
import type { RunHandle } from './handles';
import type { MoveGestureCancelReason } from './move';

/** Experimental dimensionless input seam. Domain values and keyboard intent stay in the consumer. */
export type AxisInputSample =
  | Readonly<{
      phase: 'start' | 'move' | 'end';
      /** Position clamped to the geometry interval. */
      position: number;
      /** Signed fractions of the start-time geometry span; intentionally not clamped. */
      delta: number;
      totalDelta: number;
    }>
  | Readonly<{ phase: 'cancel'; reason: AxisInputCancelReason }>;

export type AxisInputCancelReason =
  | MoveGestureCancelReason
  | 'disabled'
  | 'configuration-changed'
  | 'invalid-geometry';

export type AxisInputConfig = Readonly<{
  axis: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
  disabled: boolean;
  readOnly: boolean;
  /** Additional reversal, useful for a vertical value axis increasing upwards. */
  reverse: boolean;
}>;

export type AxisInputBinding = Readonly<{
  anatomy: AnatomyFamily;
  /** This hook's own claimed role, not an arbitrary family-wide input selector. */
  inputRole: string;
  /** The same part or its nearest same-family ancestor with this role. */
  geometryRole: string;
}>;

export type AxisInputHandle<P extends PropsBaseType = PropsBaseType> = Readonly<{
  configure(binding: AxisInputBinding): void;
  on(callback: (run: RunHandle<P>, sample: AxisInputSample) => void): void;
  sync(config: Partial<AxisInputConfig>): void;
}>;

/** Privileged host attachment. Opaque targets are never exposed by AxisInputHandle. */
export type AxisInputHostBinding = Readonly<{
  inputTarget: unknown;
  geometryTarget: unknown;
  config: AxisInputConfig;
  onSample(sample: AxisInputSample): void;
}>;
export interface AxisInputHostLease {
  update(binding: AxisInputHostBinding): void;
  dispose(): void;
}
export interface AxisInputHost {
  attach(binding: AxisInputHostBinding): AxisInputHostLease;
}
