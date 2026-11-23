import { isExposeStateExternalHandle, type ExposeStatePort } from '@proto.ui/module-expose-state';
import type { ExposeStateWebPort } from '@proto.ui/module-expose-state-web';

export type ShadowPercentageSource = Readonly<{ isCurrent(): boolean }>;

/**
 * A view-local receipt for the current owner's existing percentage channel.
 * Capture precedes Web capability installation; publication validates the live
 * map and the actual boundary projection. Inherited CSS is never evidence.
 */
export function captureShadowPercentageSource({
  host,
  exposeState,
  exposeStateWeb,
  isOwnerCurrent,
}: {
  host: HTMLElement;
  exposeState: ExposeStatePort | undefined;
  exposeStateWeb: ExposeStateWebPort | undefined;
  isOwnerCurrent(): boolean;
}): ShadowPercentageSource | null {
  if (!exposeState || !exposeStateWeb || !isOwnerCurrent()) return null;
  const handle = exposeState.get('percentage');
  if (!isExposeStateExternalHandle(handle)) return null;
  const { spec } = handle;
  if (spec.kind !== 'number.range' || spec.min !== 0 || spec.max !== 100) return null;
  const stateId = '__stateId' in handle ? handle.__stateId : undefined;
  const semantic = '__stateSemantic' in handle ? handle.__stateSemantic : undefined;
  if (typeof stateId !== 'number' || !Number.isInteger(stateId) || stateId <= 0) return null;
  if (semantic !== 'percentage') return null;

  return {
    isCurrent() {
      try {
        if (!isOwnerCurrent() || exposeState.get('percentage') !== handle) return false;
        if (!exposeStateWeb.isActive()) return false;
        const bindings = exposeStateWeb.getExposedStateMap();
        const binding = bindings.get(String(stateId));
        if (
          binding?.stateId !== String(stateId) ||
          binding.key !== 'percentage' ||
          binding.semantic !== 'percentage' ||
          binding.kind !== 'number.range' ||
          binding.cssVar !== '--pui-percentage'
        )
          return false;
        // A second mapped source is a collision, even if it currently emits
        // the same number. The map alone is not proof of actual emission.
        if (
          [...bindings.values()].some(
            (other) => other !== binding && other.cssVar === '--pui-percentage'
          )
        )
          return false;
        const value = handle.get();
        return (
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 100 &&
          host.style.getPropertyValue('--pui-percentage') === String(value) &&
          host.style.getPropertyPriority('--pui-percentage') === '' &&
          exposeStateWeb.isCurrentCssVarProjection?.(handle, host, '--pui-percentage') === true &&
          isOwnerCurrent() &&
          exposeStateWeb.isActive() &&
          bindings.get(String(stateId)) === binding
        );
      } catch {
        // A retired owner/handle cannot authorize a queued view publication.
        return false;
      }
    },
  };
}
