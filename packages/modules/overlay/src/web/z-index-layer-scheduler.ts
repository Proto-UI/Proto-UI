import type { OverlayLayerScheduler } from '../caps';

export type OverlayZIndexLayerSchedulerOptions = Readonly<{
  baseZIndex?: number;
  step?: number;
  roleOffsets?: Readonly<Record<string, number>>;
}>;

const DEFAULT_BASE_Z_INDEX = 10000;
const DEFAULT_STEP = 1;
const DEFAULT_ROLE_OFFSETS: Readonly<Record<string, number>> = Object.freeze({
  overlay: 0,
  'dialog-mask': 1000,
  'dialog-content': 1010,
});

function toInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.trunc(value);
}

export function createZIndexOverlayLayerScheduler(
  options: OverlayZIndexLayerSchedulerOptions = {}
): OverlayLayerScheduler {
  const baseZIndex = toInteger(options.baseZIndex, DEFAULT_BASE_Z_INDEX);
  const step = Math.max(1, toInteger(options.step, DEFAULT_STEP));
  const roleOffsets = {
    ...DEFAULT_ROLE_OFFSETS,
    ...(options.roleOffsets ?? {}),
  };

  let sequence = 0;

  return {
    attach(target, request) {
      const role =
        typeof request.role === 'string' && request.role.trim().length > 0
          ? request.role
          : 'overlay';
      const offset = toInteger(request.offset, 0);
      const roleOffset = toInteger(roleOffsets[role], 0);
      const zIndex = baseZIndex + sequence * step + roleOffset + offset;
      sequence += 1;

      const hadInline = target.style.getPropertyValue('z-index').length > 0;
      const prev = target.style.zIndex;
      const priority = target.style.getPropertyPriority('z-index');
      let active = true;

      target.style.setProperty('z-index', String(zIndex), priority);

      return () => {
        if (!active) return;
        active = false;
        if (hadInline) {
          target.style.setProperty('z-index', prev, priority);
          return;
        }
        target.style.removeProperty('z-index');
      };
    },
  };
}
