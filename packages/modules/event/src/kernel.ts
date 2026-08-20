// packages/modules/event/src/kernel.ts
import { EventTypeV0 } from '@proto.ui/types';
import type { EventDiag, EventDispatch } from './types';

type TargetKind = 'root' | 'global';

type Reg = {
  id: string;
  debugLabel?: string; // dev-only

  kind: TargetKind;
  type: EventTypeV0;
  options?: EventListenerOptions;

  wrapper?: (ev: any) => void;
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
      wrapper: (ev: any) => void;
    }> = [];

    for (const r of this.regs) {
      if (r.wrapper && r.boundTarget) continue;

      const target = getTarget(r.kind, r.type);
      const wrapper = (ev: any) => dispatch(r.id, ev);

      pending.push({ registration: r, target, wrapper });
    }

    for (const { registration, target, wrapper } of pending) {
      target.addEventListener(
        registration.type as any,
        wrapper as any,
        registration.options as any
      );

      registration.wrapper = wrapper;
      registration.boundTarget = target;
    }
  }

  unbindAll() {
    for (const r of this.regs) {
      if (!r.wrapper || !r.boundTarget) continue;
      r.boundTarget.removeEventListener(r.type as any, r.wrapper as any, r.options as any);
      r.wrapper = undefined;
      r.boundTarget = undefined;
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
