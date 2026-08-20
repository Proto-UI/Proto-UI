// packages/modules/event/src/impl.ts
import type { ProtoPhase, CapsVaultView } from '@proto.ui/core';
import { illegalPhase } from '@proto.ui/core';

import { ModuleBase } from '@proto.ui/module-base';

import type { EventDispatch, EventInternalCallback } from './types';
import { EventKernel } from './kernel';
import type { EventListenerToken, EventTypeV0 } from '@proto.ui/types';
import {
  EVENT_CANCEL_DEFAULT_ACTION_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
  EXPOSE_EVENT_SINK_CAP,
} from './caps';
import { eventInvalidArg, eventTargetUnavailable } from './error';

const CORE_EVENT_TYPES = [
  'press.start',
  'press.end',
  'press.cancel',
  'press.commit',
  'key.down',
  'key.up',
] as const;

const OPTIONAL_EVENT_TYPES = [
  'pointer.down',
  'pointer.move',
  'pointer.up',
  'pointer.cancel',
  'pointer.enter',
  'pointer.leave',
  'nav.focus',
  'nav.blur',
  'text.focus',
  'text.blur',
  'input',
  'change',
  'context.menu',
] as const;

function isValidEventType(type: any): type is EventTypeV0 {
  if (typeof type !== 'string' || !type) return false;
  if ((CORE_EVENT_TYPES as readonly string[]).includes(type)) return true;
  if ((OPTIONAL_EVENT_TYPES as readonly string[]).includes(type)) return true;
  if (type.startsWith('host:')) return type.length > 'host:'.length;
  return false;
}

function isEventTargetLike(x: any): x is EventTarget {
  return (
    !!x &&
    (typeof x === 'object' || typeof x === 'function') &&
    typeof (x as any).addEventListener === 'function' &&
    typeof (x as any).removeEventListener === 'function'
  );
}

export class EventModuleImpl extends ModuleBase {
  private readonly kernel = new EventKernel();
  private readonly prototypeName: string;

  private overriddenRootTarget: EventTarget | null = null;
  private overriddenSemanticRootTarget: EventTarget | null = null;

  private lastDispatch: EventDispatch | null = null;
  private isBound = false;

  private internalCallbacks = new Map<string, EventInternalCallback>();

  constructor(caps: CapsVaultView, prototypeName: string) {
    super(caps);
    this.prototypeName = prototypeName;
  }

  // -------------------------
  // setup-only API (guarded)
  // -------------------------

  private ensureSetup(op: string) {
    // Prefer system caps (most precise)
    this.sys?.ensureSetup(op);

    // Fallback: proto-phase based (for tests that don't wire sys)
    if (!this.sys && this.protoPhase !== 'setup') {
      throw illegalPhase(op, this.protoPhase, {
        prototypeName: this.prototypeName,
      });
    }
  }

  private ensureRuntime(op: string) {
    this.sys?.ensureRuntime(op);
  }

  private makeToken(
    id: string,
    kind: 'root' | 'global',
    type: EventTypeV0,
    options?: any
  ): EventListenerToken {
    const meta = {
      kind,
      type: String(type),
      options, // optional: 也可以只放 shallow clone / 或省略
      label: undefined as string | undefined,
    };

    const token: EventListenerToken = {
      id,
      meta,
      [Symbol.for('__eventTokenBrand')]: 'EventListenerToken',
      desc: (text: string) => {
        this.ensureSetup('def.event.token.desc');
        const __DEV__ = true;
        if (__DEV__) {
          const t = typeof text === 'string' ? text.trim() : '';
          if (t) {
            meta.label = t; // ✅ token 自身可读
            this.kernel.setLabel(id, t); // ✅ diagnostics 仍可用
          }
        }
        return token;
      },
    } as any;

    return token;
  }

  redirectRoot(target: EventTarget) {
    this.ensureSetup('event.port.redirectRoot');
    if (!isEventTargetLike(target)) {
      throw eventInvalidArg(`[Event] redirectRoot() requires an EventTarget-like object.`, {
        prototypeName: this.prototypeName,
        target,
      });
    }
    this.overriddenRootTarget = target;
  }

  redirectSemanticRoot(target: EventTarget) {
    this.ensureSetup('event.port.redirectSemanticRoot');
    if (!isEventTargetLike(target)) {
      throw eventInvalidArg(`[Event] redirectSemanticRoot() requires an EventTarget-like object.`, {
        prototypeName: this.prototypeName,
        target,
      });
    }
    this.overriddenSemanticRootTarget = target;
  }

  on(type: EventTypeV0, options?: any): EventListenerToken {
    this.ensureSetup('def.event.on');
    this.guardArgs(type);
    const id = this.kernel.on('root', type, options);
    return this.makeToken(id, 'root', type, options);
  }

  onGlobal(type: EventTypeV0, options?: any): EventListenerToken {
    this.ensureSetup('def.event.onGlobal');
    this.guardArgs(type);
    const id = this.kernel.on('global', type, options);
    return this.makeToken(id, 'global', type, options);
  }

  onInternal(type: EventTypeV0, cb: EventInternalCallback, options?: any): EventListenerToken {
    this.ensureSetup('event.port.on');
    this.guardArgs(type);
    if (typeof cb !== 'function') {
      throw eventInvalidArg(`[Event] internal listener requires a callback.`, {
        prototypeName: this.prototypeName,
        type,
      });
    }
    const id = this.kernel.on('root', type, options);
    this.internalCallbacks.set(id, cb);
    return this.makeToken(id, 'root', type, options);
  }

  onGlobalInternal(
    type: EventTypeV0,
    cb: EventInternalCallback,
    options?: any
  ): EventListenerToken {
    this.ensureSetup('event.port.onGlobal');
    this.guardArgs(type);
    if (typeof cb !== 'function') {
      throw eventInvalidArg(`[Event] internal global listener requires a callback.`, {
        prototypeName: this.prototypeName,
        type,
      });
    }
    const id = this.kernel.on('global', type, options);
    this.internalCallbacks.set(id, cb);
    return this.makeToken(id, 'global', type, options);
  }

  off(token: EventListenerToken) {
    this.ensureSetup('def.event.off');
    const id = (token as any)?.id;
    if (typeof id !== 'string' || !id) {
      throw eventInvalidArg(`[Event] invalid token.`, {
        prototypeName: this.prototypeName,
        token,
      });
    }
    this.internalCallbacks.delete(id);
    this.kernel.offById(id);
  }

  // -------------------------
  // runtime port
  // -------------------------

  bind(dispatch: EventDispatch) {
    this.ensureRuntime('rt.event.bind');

    const needsRoot = this.kernel.hasAny('root');
    const needsGlobal = this.kernel.hasAny('global');

    // v0 contract: no registrations => no-op (must not read targets)
    if (!needsRoot && !needsGlobal) return;

    const rootGetter = this.caps.has(EVENT_ROOT_TARGET_CAP)
      ? this.caps.get(EVENT_ROOT_TARGET_CAP)
      : undefined;

    const globalGetter = this.caps.has(EVENT_GLOBAL_TARGET_CAP)
      ? this.caps.get(EVENT_GLOBAL_TARGET_CAP)
      : undefined;

    const root = needsRoot ? (rootGetter?.() ?? null) : null;

    const global = needsGlobal ? (globalGetter?.() ?? null) : null;
    if (needsGlobal && !global) {
      throw eventTargetUnavailable(`[Event] global target unavailable during bind().`, {
        prototypeName: this.prototypeName,
      });
    }

    this.lastDispatch = dispatch;

    this.kernel.bindAll(dispatch, (kind, type) => {
      if (kind === 'global') return global as EventTarget;
      const target =
        this.overriddenRootTarget ??
        (String(type).startsWith('host:') ? null : this.overriddenSemanticRootTarget) ??
        root;
      if (!target) {
        throw eventTargetUnavailable(`[Event] root target unavailable during bind().`, {
          prototypeName: this.prototypeName,
          type,
        });
      }
      return target;
    });
    this.isBound = true;
  }

  unbind() {
    this.ensureRuntime('rt.event.unbind');
    this.kernel.unbindAll();
    this.isBound = false;
  }

  getDiagnostics() {
    return this.kernel.snapshot();
  }

  requestDefaultActionPrevented(ev: any, options?: { reason?: string; source?: string }) {
    const detail = ev?.detail ?? ev;
    if (typeof detail?.requestDefaultPrevented === 'function') {
      detail.requestDefaultPrevented(options);
      return;
    }

    const nativeEvent = detail?.nativeEvent ?? ev?.nativeEvent ?? ev;
    if (this.caps.has(EVENT_CANCEL_DEFAULT_ACTION_CAP)) {
      const cancel = this.caps.get(EVENT_CANCEL_DEFAULT_ACTION_CAP);
      cancel?.({
        event: nativeEvent,
        reason: options?.reason,
        source: options?.source,
      });
      return;
    }

    if (typeof detail?.preventDefault === 'function') {
      detail.preventDefault();
      return;
    }
    if (typeof nativeEvent?.preventDefault === 'function') {
      nativeEvent.preventDefault();
    }
  }

  dispatchInternal(id: string, ev: any) {
    const cb = this.internalCallbacks.get(id);
    if (!cb) return;
    cb(ev);
  }

  // -------------------------
  // lifecycle + caps wiring
  // -------------------------

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);

    if (phase === 'unmounted') {
      this.kernel.cleanupAll();
      this.lastDispatch = null;
      this.isBound = false;
      this.overriddenRootTarget = null;
      this.overriddenSemanticRootTarget = null;
      this.internalCallbacks.clear();
    }
  }

  protected override onCapsEpoch(_epoch: number): void {
    if (this.caps.has(EXPOSE_EVENT_SINK_CAP)) {
      throw eventInvalidArg(
        `[Event] EXPOSE_EVENT_SINK_CAP must be wired to the expose-event module, not event.`,
        { prototypeName: this.prototypeName, targetModule: 'expose-event' }
      );
    }

    // Targets might change. If already bound and we have a dispatch,
    // rebind immediately to avoid stale listeners.
    if (!this.isBound) return;
    if (!this.lastDispatch) return;

    this.kernel.unbindAll();
    this.isBound = false;

    this.bind(this.lastDispatch);
  }

  // -------------------------
  // helpers
  // -------------------------

  private guardArgs(type: EventTypeV0) {
    if (!isValidEventType(type)) {
      throw eventInvalidArg(`[Event] invalid event type: ${String(type)}`, {
        prototypeName: this.prototypeName,
        type,
      });
    }
  }
}
