import type { PropsBaseType } from '@proto.ui/types';

/** Logical host pixels or the host root text unit; never physical screen pixels. */
export type StaticHitInsetLength = Readonly<{ value: number; unit: 'px' | 'rem' }>;
export type StaticHitInsetSide = 'top' | 'right' | 'bottom' | 'left';
export type StaticHitInset = Readonly<Record<StaticHitInsetSide, StaticHitInsetLength>>;
export type StaticHitInsetInput = Readonly<Partial<StaticHitInset>>;

/** Snapshot plain data before any host mutation; absent edges are zero logical pixels. */
export function snapshotStaticHitInset(input: StaticHitInsetInput): StaticHitInset {
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const plain = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
    if (
      !value ||
      typeof value !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    ) {
      throw new Error('[HitParticipation] staticHitInset must be plain data.');
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (
        typeof key !== 'string' ||
        !keys.includes(key) ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      ) {
        throw new Error('[HitParticipation] invalid staticHitInset field.');
      }
      result[key] = descriptor.value;
    }
    return result;
  };
  const data = plain(input, sides);
  const result = {} as Record<StaticHitInsetSide, StaticHitInsetLength>;
  for (const side of sides) {
    const length = Object.hasOwn(data, side)
      ? plain(data[side], ['value', 'unit'])
      : { value: 0, unit: 'px' };
    if (
      typeof length.value !== 'number' ||
      !Number.isFinite(length.value) ||
      length.value < 0 ||
      (length.unit !== 'px' && length.unit !== 'rem')
    ) {
      throw new Error(
        '[HitParticipation] staticHitInset requires finite nonnegative px/rem lengths.'
      );
    }
    result[side] = Object.freeze({
      value: length.value === 0 ? 0 : length.value,
      unit: length.value === 0 ? 'px' : length.unit,
    });
  }
  return Object.freeze(result);
}

export type HitParticipationMode = 'participating' | 'disabled' | 'passthrough';

export type HitParticipationRegionRole = string & {};

export type HitParticipationConfigPatch = Readonly<{
  mode?: HitParticipationMode;
  staticHitInset?: StaticHitInsetInput | null;
  debugLabel?: string;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type HitParticipationConfig = Readonly<{
  mode: HitParticipationMode;
  staticHitInset?: StaticHitInset;
  debugLabel?: string;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type HitParticipationRegionOptions = Readonly<{
  role?: HitParticipationRegionRole;
  mode?: HitParticipationMode;
  staticHitInset?: StaticHitInsetInput | null;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type HitParticipationRegion = Readonly<{
  target: unknown;
  role?: HitParticipationRegionRole;
  mode: HitParticipationMode;
  staticHitInset?: StaticHitInset;
  meta?: Readonly<Record<string, unknown>>;
}>;

export interface HitParticipationHandle<P extends PropsBaseType = PropsBaseType> {
  configure(patch: HitParticipationConfigPatch): void;
  registerRegion(target: unknown, options?: HitParticipationRegionOptions): () => void;
  unregisterRegion(target: unknown): void;
}
