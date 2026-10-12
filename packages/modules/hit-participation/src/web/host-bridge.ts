import {
  snapshotStaticHitInset,
  type HitParticipationMode,
  type StaticHitInset,
} from '@proto.ui/core';
import type { HitParticipationHostBridge } from '../caps';
import {
  prepareStaticHitInset,
  staticHitInsetRootChanged,
  type StaticHitInsetLease,
} from './static-hit-inset';

const HIT_PARTICIPATION_MODE_MARK = Symbol.for('@proto.ui/module-hit-participation/__mode');
type HostElement = HTMLElement & Record<symbol, unknown>;
type Claim = { mode: HitParticipationMode; inset?: StaticHitInset };
type TargetClaims = {
  owners: Map<object, Claim>;
  previousValue: string;
  previousPriority: string;
  projectedValue?: string;
  projectedPriority?: string;
  insetLease?: StaticHitInsetLease;
};
const claimsByTarget = new WeakMap<HostElement, TargetClaims>();
const sameInset = (a?: StaticHitInset, b?: StaticHitInset) =>
  JSON.stringify(a) === JSON.stringify(b);

function restore(target: HostElement, claims: TargetClaims): void {
  // Restore only our last projection; never erase a host author's later declaration.
  if (
    claims.projectedValue === undefined ||
    target.style.getPropertyValue('pointer-events') !== claims.projectedValue ||
    target.style.getPropertyPriority('pointer-events') !== claims.projectedPriority
  )
    return;
  if (claims.previousValue)
    target.style.setProperty('pointer-events', claims.previousValue, claims.previousPriority);
  else target.style.removeProperty('pointer-events');
  claims.projectedValue = undefined;
  claims.projectedPriority = undefined;
}

export function createWebHitParticipationHostBridge(): HitParticipationHostBridge {
  const owner = {};
  let applied = new Map<HostElement, Claim>();
  return {
    supportsStaticHitInset: true,
    sync({ regions }) {
      const next = new Map<HostElement, Claim>();
      for (const region of regions) {
        if (region.target instanceof HTMLElement) {
          next.set(region.target as HostElement, {
            mode: region.mode,
            ...(region.staticHitInset
              ? { inset: snapshotStaticHitInset(region.staticHitInset) }
              : {}),
          });
        } else if (region.staticHitInset) {
          throw new Error(
            '[HitParticipation] staticHitInset unsupported: target is not an HTMLElement.'
          );
        }
      }
      const acquire = new Map<HostElement, () => StaticHitInsetLease>();
      // Validate the whole replacement, including physical prerequisites, before writes.
      for (const [target, claim] of next) {
        const existing = claimsByTarget.get(target);
        for (const [other, otherClaim] of existing?.owners ?? []) {
          if (
            other !== owner &&
            (otherClaim.mode !== claim.mode || !sameInset(otherClaim.inset, claim.inset))
          ) {
            throw new Error(
              '[HitParticipation] conflicting modes or staticHitInset on a shared target.'
            );
          }
        }
        if (claim.inset) {
          const prepared = prepareStaticHitInset(target, claim.inset, existing?.insetLease);
          if (
            !existing?.insetLease ||
            !sameInset(existing.insetLease.inset, claim.inset) ||
            staticHitInsetRootChanged(target, existing.insetLease)
          )
            acquire.set(target, prepared);
        }
      }
      for (const [target] of applied) {
        if (next.has(target)) continue;
        const claims = claimsByTarget.get(target);
        if (!claims) continue;
        claims.owners.delete(owner);
        if (claims.owners.size === 0) {
          restore(target, claims);
          claims.insetLease?.release();
          if (target[HIT_PARTICIPATION_MODE_MARK] === applied.get(target)?.mode)
            delete target[HIT_PARTICIPATION_MODE_MARK];
          claimsByTarget.delete(target);
        }
      }
      for (const [target, claim] of next) {
        let claims = claimsByTarget.get(target);
        if (!claims) {
          claims = {
            owners: new Map(),
            previousValue: target.style.getPropertyValue('pointer-events'),
            previousPriority: target.style.getPropertyPriority('pointer-events'),
          };
          claimsByTarget.set(target, claims);
        }
        claims.owners.set(owner, claim);
        if (!claim.inset && claims.insetLease) {
          claims.insetLease.release();
          claims.insetLease = undefined;
        }
        const activate = acquire.get(target);
        if (activate) {
          claims.insetLease?.release();
          claims.insetLease = activate();
        }
        target[HIT_PARTICIPATION_MODE_MARK] = claim.mode;
        if (claim.mode === 'participating') restore(target, claims);
        else {
          const value = target.style.getPropertyValue('pointer-events');
          const priority = target.style.getPropertyPriority('pointer-events');
          if (
            claims.projectedValue !== undefined &&
            (value !== claims.projectedValue || priority !== claims.projectedPriority)
          ) {
            claims.previousValue = value;
            claims.previousPriority = priority;
          }
          target.style.setProperty('pointer-events', 'none');
          claims.projectedValue = 'none';
          claims.projectedPriority = '';
        }
      }
      applied = next;
    },
  };
}
export const __HIT_PARTICIPATION_MODE_MARK = HIT_PARTICIPATION_MODE_MARK;
