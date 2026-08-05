export type HostSurfaceTargetChange<TTarget> = Readonly<{
  previous: TTarget | null;
  current: TTarget | null;
}>;

export type HostSurfaceProjection<TTarget> = {
  readonly boundaryTarget: TTarget;
  getSurfaceTarget(): TTarget | null;
  setSurfaceTarget(target: TTarget | null): void;
  subscribeSurfaceTarget(listener: (change: HostSurfaceTargetChange<TTarget>) => void): () => void;
};

/**
 * Keeps adapter-private logical boundary and presentation surface roles distinct.
 * Most adapters collapse both roles onto the same target. Wrapper-backed or
 * replaceable host views can rebind only the presentation role.
 */
export function createHostSurfaceProjection<TTarget>(
  boundaryTarget: TTarget,
  initialSurfaceTarget: TTarget | null = boundaryTarget
): HostSurfaceProjection<TTarget> {
  let surfaceTarget = initialSurfaceTarget;
  const listeners = new Set<(change: HostSurfaceTargetChange<TTarget>) => void>();

  return {
    boundaryTarget,
    getSurfaceTarget: () => surfaceTarget,
    setSurfaceTarget(next) {
      if (Object.is(surfaceTarget, next)) return;
      const change = Object.freeze({ previous: surfaceTarget, current: next });
      surfaceTarget = next;
      for (const listener of Array.from(listeners)) listener(change);
    },
    subscribeSurfaceTarget(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
