import type { HitParticipationMode } from '@proto.ui/core';
import type { HitParticipationHostBridge } from '../caps';

const HIT_PARTICIPATION_MODE_MARK = Symbol.for('@proto.ui/module-hit-participation/__mode');
type HostElement = HTMLElement & Record<symbol, unknown>;
type TargetClaims = {
  owners: Map<object, HitParticipationMode>;
  previousValue: string;
  previousPriority: string;
};
const claimsByTarget = new WeakMap<HostElement, TargetClaims>();

function restore(target: HostElement, claims: TargetClaims): void {
  if (claims.previousValue) {
    target.style.setProperty('pointer-events', claims.previousValue, claims.previousPriority);
  } else {
    target.style.removeProperty('pointer-events');
  }
}

export function createWebHitParticipationHostBridge(): HitParticipationHostBridge {
  const owner = {};
  let applied = new Map<HostElement, HitParticipationMode>();
  return {
    sync({ regions }) {
      const next = new Map<HostElement, HitParticipationMode>();
      for (const region of regions) {
        if (region.target instanceof HTMLElement) {
          // Preserve same-owner region precedence; sharing is checked between owners.
          next.set(region.target as HostElement, region.mode);
        }
      }
      // Validate the entire replacement before releasing or writing any target.
      for (const [target, mode] of next) {
        for (const [other, otherMode] of claimsByTarget.get(target)?.owners ?? []) {
          if (other !== owner && otherMode !== mode) {
            throw new Error(
              `[HitParticipation] conflicting modes on a shared target: ${otherMode} and ${mode}.`
            );
          }
        }
      }
      for (const [target] of applied) {
        if (next.has(target)) continue;
        const claims = claimsByTarget.get(target);
        if (!claims) continue;
        claims.owners.delete(owner);
        if (claims.owners.size === 0) {
          restore(target, claims);
          delete target[HIT_PARTICIPATION_MODE_MARK];
          claimsByTarget.delete(target);
        }
      }
      for (const [target, mode] of next) {
        let claims = claimsByTarget.get(target);
        if (!claims) {
          claims = {
            owners: new Map(),
            previousValue: target.style.getPropertyValue('pointer-events'),
            previousPriority: target.style.getPropertyPriority('pointer-events'),
          };
          claimsByTarget.set(target, claims);
        }
        claims.owners.set(owner, mode);
        target[HIT_PARTICIPATION_MODE_MARK] = mode;
        if (mode === 'participating') restore(target, claims);
        else target.style.setProperty('pointer-events', 'none');
      }
      applied = next;
    },
  };
}
export const __HIT_PARTICIPATION_MODE_MARK = HIT_PARTICIPATION_MODE_MARK;
