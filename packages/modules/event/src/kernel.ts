// packages/modules/event/src/kernel.ts
import type { EventTypeV0, HostEventListenerOptions } from '@proto.ui/types';
import type { EventDiag, EventDispatch } from './types';

type TargetKind = 'root' | 'global';

type Reg = {
  id: string;
  debugLabel?: string; // dev-only

  kind: TargetKind;
  type: EventTypeV0;
  options?: HostEventListenerOptions;

  wrapper?: (event: unknown) => void;
  deactivate?: () => void;
  boundTarget?: EventTarget;
};

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === 'object' && (x.constructor === Object || x.constructor == null);
}

function sameOptions(a: any, b: any) {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return false;

  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!Object.is(a[k], b[k])) return false;
    }
    return true;
  }

  return false;
}

function matchReg(r: Reg, kind: TargetKind, type: EventTypeV0, options?: any) {
  return r.kind === kind && r.type === type && sameOptions(r.options, options);
}

export class EventKernel {
  private regs: Reg[] = [];
  private seq = 0;

  private nextId() {
    this.seq++;
    return `ev_${this.seq}`;
  }

  on(kind: TargetKind, type: EventTypeV0, options?: any) {
    const id = this.nextId();
    this.regs.push({ id, kind, type, options });
    return id;
  }

  offById(id: string) {
    for (let i = this.regs.length - 1; i >= 0; i--) {
      const r = this.regs[i]!;
      if (r.id !== id) continue;

      if (r.wrapper && r.boundTarget) {
        r.deactivate?.();
        r.boundTarget.removeEventListener(r.type as any, r.wrapper as any, r.options as any);
      }

      this.regs.splice(i, 1);
      return true;
    }
    return false;
  }

  /**
   * Remove ONE matching registration (latest-first), by (kind,type,options).
   * This is optional but often convenient for runtime facade.
   */
  offLatest(kind: TargetKind, type: EventTypeV0, options?: any) {
    for (let i = this.regs.length - 1; i >= 0; i--) {
      const r = this.regs[i]!;
      if (!matchReg(r, kind, type, options)) continue;

      if (r.wrapper && r.boundTarget) {
        r.deactivate?.();
        r.boundTarget.removeEventListener(r.type as any, r.wrapper as any, r.options as any);
      }

      this.regs.splice(i, 1);
      return true;
    }
    return false;
  }

  setLabel(id: string, label: string) {
    for (let i = this.regs.length - 1; i >= 0; i--) {
      const r = this.regs[i]!;
      if (r.id !== id) continue;
      r.debugLabel = label;
      return true;
    }
    return false;
  }

  bindAll(
    dispatch: EventDispatch,
    getTarget: (kind: TargetKind, type: EventTypeV0) => EventTarget
  ) {
    const pending: Array<{
      registration: Reg;
      target: EventTarget;
      wrapper: (event: unknown) => void;
      deactivate: () => void;
    }> = [];

    for (const r of this.regs) {
      if (r.wrapper && r.boundTarget) continue;

      const target = getTarget(r.kind, r.type);
      let active = true;
      const wrapper = (event: unknown) => {
        if (!active) return;
        dispatch(r.id, event, r.type);
      };
      const deactivate = () => {
        active = false;
      };

      pending.push({ registration: r, target, wrapper, deactivate });
    }

    // HC-EVENT-0001 / #466 third pass: installation is transactional across
    // attachment failures, not only target-resolution failures. If any
    // addEventListener throws, every attachment made for this plan is rolled
    // back before the error propagates, so no partial listener set survives.
    const attached: Array<{
      registration: Reg;
      target: EventTarget;
      wrapper: (event: unknown) => void;
      deactivate: () => void;
    }> = [];

    try {
      for (const { registration, target, wrapper, deactivate } of pending) {
        target.addEventListener(
          registration.type as any,
          wrapper as any,
          registration.options as any
        );

        attached.push({ registration, target, wrapper, deactivate });
        registration.wrapper = wrapper;
        registration.deactivate = deactivate;
        registration.boundTarget = target;
      }
    } catch (error) {
      for (const { registration, target, wrapper, deactivate } of attached) {
        // Fail closed before attempting physical removal. If removal throws,
        // a surviving host callback is inert and cannot dispatch.
        deactivate();
        try {
          target.removeEventListener(
            registration.type as any,
            wrapper as any,
            registration.options as any
          );
        } catch {
          // Removal failure during rollback must not mask the original error.
        }
        registration.wrapper = undefined;
        registration.deactivate = undefined;
        registration.boundTarget = undefined;
      }
      throw error;
    }
  }

  unbindAll() {
    for (const r of this.regs) {
      if (!r.wrapper || !r.boundTarget) continue;
      const target = r.boundTarget;
      const wrapper = r.wrapper;
      r.deactivate?.();
      r.wrapper = undefined;
      r.deactivate = undefined;
      r.boundTarget = undefined;
      target.removeEventListener(r.type as any, wrapper as any, r.options as any);
    }
  }

  cleanupAll() {
    this.unbindAll();
    this.regs.length = 0;
  }

  snapshot(): readonly EventDiag[] {
    return this.regs.map((r) => ({
      id: r.id,
      kind: r.kind,
      type: String(r.type),
      bound: !!r.boundTarget && !!r.wrapper,
      label: r.debugLabel,
    }));
  }

  hasAny(kind: TargetKind) {
    return this.regs.some((r) => r.kind === kind);
  }

  hasAnyAtAll() {
    return this.regs.length > 0;
  }
}
