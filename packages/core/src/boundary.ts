import type { PropsBaseType } from '@proto.ui/types';

export type BoundaryClassification = 'inside' | 'outside' | 'unknown';

export type BoundaryObservation = 'pointer.press' | 'focus.move';

export type BoundaryRegionRole = 'trigger' | 'anchor' | 'content' | (string & {});

export type BoundaryConfigPatch = Readonly<{
  debugLabel?: string;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type BoundaryConfig = Readonly<{
  debugLabel?: string;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type BoundaryRegionOptions = Readonly<{
  role?: BoundaryRegionRole;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type BoundaryRegion = Readonly<{
  target: unknown;
  role?: BoundaryRegionRole;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type BoundarySample = Readonly<{
  type?: string;
  target?: unknown;
  nativeEvent?: unknown;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type BoundaryOutsideEvent = Readonly<{
  classification: 'outside';
  /** Present for runtime-owned observations; manual notify may omit it. */
  observation?: BoundaryObservation;
  sample?: BoundarySample;
}>;

export interface BoundaryHandle<P extends PropsBaseType = PropsBaseType> {
  configure(patch: BoundaryConfigPatch): void;
  observe(observation: BoundaryObservation): void;
  setStackActive(active: boolean): void;
  registerRegion(target: unknown, options?: BoundaryRegionOptions): () => void;
  unregisterRegion(target: unknown): void;
  classify(sample?: BoundarySample): BoundaryClassification;
  notify(sample?: BoundarySample): BoundaryClassification;
  subscribeOutside(cb: (event: BoundaryOutsideEvent) => void): () => void;
}
