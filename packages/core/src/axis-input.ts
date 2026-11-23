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
      /** Signed fractions of the start-time displacement basis (geometry span by default); intentionally not clamped. */
      delta: number;
      totalDelta: number;
      /** Opt-in start origin in the declared role's public order; null means input background. */
      originIndex?: number | null;
    }>
  | Readonly<{ phase: 'cancel'; reason: AxisInputCancelReason }>;

export type AxisInputCancelReason =
  | MoveGestureCancelReason
  | 'disabled'
  | 'configuration-changed'
  | 'invalid-geometry'
  | 'basis-changed';

export type AxisInputConfig = Readonly<{
  axis: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
  disabled: boolean;
  readOnly: boolean;
  /** Additional reversal, useful for a vertical value axis increasing upwards. */
  reverse: boolean;
  /** Draft opt-in recognition. Omitted initially means immediate; partial sync retains. */
  activation?: 'immediate' | 'directional';
  /** Omitted initial policy preserves start geometry; partial sync keeps the current policy. */
  contactBasis?: 'preserve-start' | 'cancel-on-extent-change';
}>;

export type AxisInputBinding = Readonly<{
  anatomy: AnatomyFamily;
  /** This hook's own claimed role, not an arbitrary family-wide input selector. */
  inputRole: string;
  /** The same part or its nearest same-family ancestor with this role. */
  geometryRole: string;
  /** Optional unique same-domain presentation part whose extent is excluded from travel. */
  travelRole?: string;
  /** Sum of same-owner parts' extents for delta normalization; position is unchanged. */
  deltaBasisRole?: string;
  /** Same-owner role whose original input hit is observed without acquiring another contact. */
  originRole?: string;
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
  /** Host-private presentation geometry; never becomes an input or focus target. */
  travelTarget?: unknown;
  /** Host-private same-owner parts; zero-sized collapsed parts are allowed. */
  deltaBasisTargets?: readonly unknown[];
  /** Privileged ordered targets for originRole; never exposed to a prototype. */
  originTargets?: readonly unknown[];
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
