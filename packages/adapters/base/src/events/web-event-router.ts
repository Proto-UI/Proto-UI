// packages/adapters/base/src/events/web-event-router.ts

type Unsub = () => void;
const PRESS_COMMIT_EMITTED_ROOTS = Symbol.for('@proto.ui/router/press-commit-emitted-roots');
const PROTO_PARENT_INSTANCE_MARK = Symbol.for('@proto.ui/adapter-base/__proto_parent_instance');
const PROTO_INSTANCE_MARKS = [
  Symbol.for('@proto.ui/adapter-web-component/__proto_instance'),
  Symbol.for('@proto.ui/adapter-react/__proto_instance'),
  Symbol.for('@proto.ui/adapter-vue/__proto_instance'),
] as const;
const TRIGGER_OWNER_MARK = Symbol.for('@proto.ui/as-trigger/confirm-owner');
const REJECTED_TRIGGER_ROUTE = Symbol('rejected-trigger-route');
const GLOBAL_ROOT_EVENT_TYPES: Record<string, string> = {
  pointerdown: 'pointer.down',
  pointermove: 'pointer.move',
  pointerup: 'pointer.up',
  pointercancel: 'pointer.cancel',
  click: 'press.commit',
  contextmenu: 'context.menu',
};

type ElementWithSymbols = HTMLElement & Record<symbol, unknown>;

export type SemanticEventRouteResolution = {
  matched: true;
  accepted: boolean;
  surface: object;
};

type Listener = {
  type: string;
  target?: EventTarget;
  cb: any;
  options?: any;
  wrapped?: any;
};

const payloadStateByNativeEvent = new WeakMap<object, Record<PropertyKey, unknown>>();
const activeRouterByRoot = new WeakMap<HTMLElement, object>();

export function createWebProtoEventRouter(opt: {
  rootEl: HTMLElement;
  /** Physical native editor ingress for focus/blur only; no event redispatch. */
  focusEventTarget?: EventTarget;
  instanceToken?: object;
  /** Official tree's conservative reachability filter; never grants delivery. */
  isSemanticEventRouteCandidate?: (root: HTMLElement, targets: EventTarget[]) => boolean;
  resolveSemanticEventRoute?: (
    target: EventTarget | null,
    /** Query-local visited ancestors; never retained across routing decisions. */
    visited?: Set<Node>
  ) => SemanticEventRouteResolution | null;
  /** @deprecated Use resolveSemanticEventRoute so non-surface hits can be rejected. */
  resolveEventRouteOwner?: (target: EventTarget | null) => object | null;
  globalEl?: EventTarget; // window by default
  isEnabled: () => boolean; // bridge to eventGate
}) {
  // proto semantic bus: press.*, pointer.*, key.*, context.menu...
  const protoRootBus = new EventTarget();
  const protoGlobalBus = new EventTarget();

  const rootEl = opt.rootEl;
  const globalEl = opt.globalEl ?? window;
  const routerIdentity = {};
  activeRouterByRoot.set(rootEl, routerIdentity);
  const isEnabled = () => activeRouterByRoot.get(rootEl) === routerIdentity && opt.isEnabled();
  let suppressFollowupDirectClick = false;

  // --- helper: emit proto event to proto bus ---
  function emit(target: EventTarget, type: string, native: any) {
    const ev = new CustomEvent(type, { detail: createProtoEventPayload(type, native) });
    target.dispatchEvent(ev);
  }

  function emitPressCommitOnce(native: Event, suppressDirectClick = false) {
    if (hasPressCommitBeenEmittedForRoot(native)) return;
    markPressCommitEmittedForRoot(native);
    if (suppressDirectClick) suppressFollowupDirectClick = true;
    emit(protoRootBus, 'press.commit', native);
  }

  function isCommitKey(key: string) {
    return key === 'Enter' || key === ' ';
  }

  function isNativeMouseClick(event: Event): event is MouseEvent {
    const candidate = event as MouseEvent;
    return (
      event.type === 'click' &&
      typeof candidate.detail === 'number' &&
      typeof candidate.clientX === 'number' &&
      typeof candidate.clientY === 'number' &&
      typeof candidate.button === 'number'
    );
  }

  function isWithinRoot(target: EventTarget | null) {
    return target === rootEl || (target instanceof Node && rootEl.contains(target));
  }

  function getLinkedProtoParent(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const linkedParent = (target as ElementWithSymbols)[PROTO_PARENT_INSTANCE_MARK];
    return linkedParent instanceof HTMLElement ? linkedParent : null;
  }

  function isProtoInstanceNode(target: EventTarget | null): target is HTMLElement {
    if (!(target instanceof HTMLElement)) return false;
    return PROTO_INSTANCE_MARKS.some((mark) => (target as ElementWithSymbols)[mark] === true);
  }

  function getTriggerRouteOwner(target: EventTarget | null): object | HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const owner = (target as ElementWithSymbols)[TRIGGER_OWNER_MARK];
    if (owner === true) return target;
    return owner && (typeof owner === 'object' || typeof owner === 'function')
      ? (owner as object)
      : null;
  }

  function getNearestProtoInstance(
    target: EventTarget | null,
    visited = new Set<Node>()
  ): HTMLElement | null {
    let cur: Node | null = target instanceof Node ? target : null;
    while (cur) {
      if (visited.has(cur)) return null;
      visited.add(cur);

      if (typeof ShadowRoot !== 'undefined' && cur instanceof ShadowRoot) {
        cur = cur.host;
        continue;
      }

      if (isProtoInstanceNode(cur)) return cur;

      const linkedParent = getLinkedProtoParent(cur);
      if (linkedParent && linkedParent !== cur) {
        cur = linkedParent;
        continue;
      }

      cur = cur.parentNode;
    }
    return null;
  }

  function getNearestTriggerOwner(
    target: EventTarget | null,
    visited = new Set<Node>()
  ): object | HTMLElement | null {
    let cur: Node | null = target instanceof Node ? target : null;
    while (cur) {
      if (visited.has(cur)) return null;
      visited.add(cur);
      if (typeof ShadowRoot !== 'undefined' && cur instanceof ShadowRoot) {
        cur = cur.host;
        continue;
      }
      const owner = getTriggerRouteOwner(cur);
      if (owner) return owner;
      cur = cur.parentNode;
    }
    return null;
  }

  function resolveOwningTrigger(
    native: Event,
    options?: { includeActiveFallback?: boolean }
  ): object | HTMLElement | null | typeof REJECTED_TRIGGER_ROUTE {
    if (opt.resolveSemanticEventRoute) {
      const visited = new Set<Node>();
      if (typeof native.composedPath === 'function') {
        for (const entry of native.composedPath()) {
          const resolution = opt.resolveSemanticEventRoute(entry, visited);
          if (!resolution) continue;
          return resolution.accepted ? resolution.surface : REJECTED_TRIGGER_ROUTE;
        }
      }
      const resolution = opt.resolveSemanticEventRoute(native.target, visited);
      if (resolution) {
        return resolution.accepted ? resolution.surface : REJECTED_TRIGGER_ROUTE;
      }
      if (options?.includeActiveFallback !== false) {
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        const activeResolution = opt.resolveSemanticEventRoute(active, visited);
        if (activeResolution) {
          return activeResolution.accepted ? activeResolution.surface : REJECTED_TRIGGER_ROUTE;
        }
      }
    }
    if (opt.resolveEventRouteOwner) {
      if (typeof native.composedPath === 'function') {
        for (const entry of native.composedPath()) {
          const owner = opt.resolveEventRouteOwner(entry);
          if (owner) return owner;
        }
      }
      const targetOwner = opt.resolveEventRouteOwner(native.target);
      if (targetOwner) return targetOwner;
      if (options?.includeActiveFallback !== false) {
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        const activeOwner = opt.resolveEventRouteOwner(active);
        if (activeOwner) return activeOwner;
      }
    }
    const visited = new Set<Node>();
    if (typeof native.composedPath === 'function') {
      for (const entry of native.composedPath()) {
        const owner = getNearestTriggerOwner(entry, visited);
        if (owner) return owner;
      }
    }
    const targetOwner = getNearestTriggerOwner(native.target, visited);
    if (targetOwner) return targetOwner;
    if (options?.includeActiveFallback === false) return null;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    return getNearestTriggerOwner(active, visited);
  }

  function resolveOwningProtoInstance(
    native: Event,
    options?: { includeActiveFallback?: boolean }
  ) {
    const visited = new Set<Node>();
    if (typeof native.composedPath === 'function') {
      for (const entry of native.composedPath()) {
        const owner = getNearestProtoInstance(entry, visited);
        if (owner) return owner;
      }
    }
    const targetOwner = getNearestProtoInstance(native.target, visited);
    if (targetOwner) return targetOwner;
    if (options?.includeActiveFallback === false) return null;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    return getNearestProtoInstance(active, visited);
  }

  function shouldRouteToCurrentRoot(native: Event, options?: { includeActiveFallback?: boolean }) {
    if (opt.isSemanticEventRouteCandidate) {
      const targets = typeof native.composedPath === 'function' ? native.composedPath() : [];
      if (native.target) targets.push(native.target);
      if (
        options?.includeActiveFallback !== false &&
        typeof document !== 'undefined' &&
        document.activeElement
      )
        targets.push(document.activeElement);
      if (!opt.isSemanticEventRouteCandidate(rootEl, targets)) return false;
    }
    const triggerOwner = resolveOwningTrigger(native, options);
    if (triggerOwner === REJECTED_TRIGGER_ROUTE) return false;
    if (triggerOwner) return triggerOwner === (opt.instanceToken ?? rootEl);

    const owner = resolveOwningProtoInstance(native, options);
    if (owner) return owner === rootEl;
    return isWithinRoot(native.target);
  }

  function shouldRouteGlobalRootEvent(
    native: Event,
    options?: { includeActiveFallback?: boolean }
  ) {
    // Keep native listener order and Portal fallback semantics. An instance
    // without a consumer has no root delivery to resolve. pointerdown also
    // resets the keyboard follow-up click state for press consumers.
    if (
      !rootProxy.__hasProtoListeners(GLOBAL_ROOT_EVENT_TYPES[native.type]) &&
      !(native.type === 'pointerdown' && rootProxy.__hasProtoListeners('press.commit'))
    )
      return false;
    if (isWithinRoot(native.target)) return false;
    return shouldRouteToCurrentRoot(native, options);
  }

  type EventWithSymbols = Event & Record<symbol, Set<EventTarget> | undefined>;

  function getPressCommitEmittedRoots(native: Event): Set<EventTarget> {
    const seen = (native as EventWithSymbols)[PRESS_COMMIT_EMITTED_ROOTS];
    if (seen instanceof Set) return seen;
    const next = new Set<EventTarget>();
    (native as EventWithSymbols)[PRESS_COMMIT_EMITTED_ROOTS] = next;
    return next;
  }

  function hasPressCommitBeenEmittedForRoot(native: Event) {
    return getPressCommitEmittedRoots(native).has(rootEl);
  }

  function markPressCommitEmittedForRoot(native: Event) {
    getPressCommitEmittedRoots(native).add(rootEl);
  }

  function hasFocusedDescendant() {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    return active instanceof Node && rootEl.contains(active);
  }

  function shouldSuppressFollowupClick(native: MouseEvent) {
    // Keyboard direct activation of a native descendant button often synthesizes
    // a follow-up click with detail===0. The semantic keyboard commit has already
    // been emitted on keydown, so suppress the zero-detail click once here.
    if (!suppressFollowupDirectClick) return false;
    if (native.detail !== 0) {
      suppressFollowupDirectClick = false;
      return false;
    }
    suppressFollowupDirectClick = false;
    return true;
  }

  // -------------------------
  // (A) 固定监听：解释“协议语义事件”
  // -------------------------
  // 这些是你愿意为每个组件实例支付的固定成本（尽量少）
  const unsubs: Unsub[] = [];

  // pointer -> pointer.*
  unsubs.push(
    listen(rootEl, 'pointerdown', (e) => {
      if (!isEnabled()) return;
      suppressFollowupDirectClick = false;
      emit(protoRootBus, 'pointer.down', e);
    })
  );
  unsubs.push(
    listen(rootEl, 'pointermove', (e) => {
      if (!isEnabled()) return;
      emit(protoRootBus, 'pointer.move', e);
    })
  );
  unsubs.push(
    listen(rootEl, 'pointerup', (e) => {
      if (!isEnabled()) return;
      emit(protoRootBus, 'pointer.up', e);
    })
  );
  unsubs.push(
    listen(rootEl, 'pointercancel', (e) => {
      if (!isEnabled()) return;
      emit(protoRootBus, 'pointer.cancel', e);
    })
  );
  unsubs.push(
    listen(rootEl, 'pointerenter', (e) => {
      if (!isEnabled()) return;
      emit(protoRootBus, 'pointer.enter', e);
    })
  );
  unsubs.push(
    listen(rootEl, 'pointerleave', (e) => {
      if (!isEnabled()) return;
      emit(protoRootBus, 'pointer.leave', e);
    })
  );

  // portal fallback: globally mounted nodes do not bubble pointer events to rootEl
  unsubs.push(
    listen(globalEl, 'pointerdown', (e) => {
      if (!isEnabled()) return;
      if (!shouldRouteGlobalRootEvent(e, { includeActiveFallback: false })) return;
      suppressFollowupDirectClick = false;
      emit(protoRootBus, 'pointer.down', e);
    })
  );

  unsubs.push(
    listen(globalEl, 'pointermove', (e) => {
      if (!isEnabled()) return;
      if (!shouldRouteGlobalRootEvent(e, { includeActiveFallback: false })) return;
      emit(protoRootBus, 'pointer.move', e);
    })
  );

  unsubs.push(
    listen(globalEl, 'pointerup', (e) => {
      if (!isEnabled()) return;
      if (!shouldRouteGlobalRootEvent(e, { includeActiveFallback: false })) return;
      emit(protoRootBus, 'pointer.up', e);
    })
  );

  unsubs.push(
    listen(globalEl, 'pointercancel', (e) => {
      if (!isEnabled()) return;
      if (!shouldRouteGlobalRootEvent(e, { includeActiveFallback: false })) return;
      emit(protoRootBus, 'pointer.cancel', e);
    })
  );

  // key -> key.* (global)
  unsubs.push(
    listen(globalEl, 'keydown', (e: KeyboardEvent) => {
      if (!isEnabled()) return;
      emit(protoGlobalBus, 'key.down', e);
      if (rootProxy.__hasProtoListeners('key.down') && shouldRouteToCurrentRoot(e)) {
        emit(protoRootBus, 'key.down', e);
      }
      if (!isCommitKey(e.key)) {
        suppressFollowupDirectClick = false;
        return;
      }
      if (!rootProxy.__hasProtoListeners('press.commit')) return;
      if (shouldRouteToCurrentRoot(e)) {
        emitPressCommitOnce(e, true);
        return;
      }
      if (!isWithinRoot(e.target)) return;
      if (!hasFocusedDescendant()) return;
      emitPressCommitOnce(e, true);
    })
  );

  unsubs.push(
    listen(rootEl, 'keydown', (e: KeyboardEvent) => {
      if (!isEnabled()) return;
      if (!isCommitKey(e.key)) return;
      emitPressCommitOnce(e, true);
    })
  );

  unsubs.push(
    listen(globalEl, 'keyup', (e: KeyboardEvent) => {
      if (!isEnabled()) return;
      emit(protoGlobalBus, 'key.up', e);
      if (rootProxy.__hasProtoListeners('key.up') && shouldRouteToCurrentRoot(e)) {
        emit(protoRootBus, 'key.up', e);
      }
    })
  );

  // click -> press.commit (root)
  // 只响应真实的 MouseEvent；由 event.emit() 分发的 CustomEvent 不触发 press.commit，
  // 避免组件暴露的合成 click 事件（如 asButton）导致重复 toggle。
  unsubs.push(
    listen(rootEl, 'click', (e) => {
      if (!isEnabled()) return;
      if (!isNativeMouseClick(e)) return;
      if (!shouldRouteToCurrentRoot(e)) return;
      if (shouldSuppressFollowupClick(e)) return;
      suppressFollowupDirectClick = false;
      emit(protoRootBus, 'press.commit', e);
    })
  );

  unsubs.push(
    listen(globalEl, 'click', (e) => {
      if (!isEnabled()) return;
      if (!isNativeMouseClick(e)) return;
      if (!shouldRouteGlobalRootEvent(e, { includeActiveFallback: false })) return;
      if (shouldSuppressFollowupClick(e)) return;
      suppressFollowupDirectClick = false;
      emit(protoRootBus, 'press.commit', e);
    })
  );

  // contextmenu -> context.menu
  unsubs.push(
    listen(rootEl, 'contextmenu', (e) => {
      if (!isEnabled()) return;
      emit(protoRootBus, 'context.menu', e);
    })
  );

  unsubs.push(
    listen(globalEl, 'contextmenu', (e) => {
      if (!isEnabled()) return;
      if (!shouldRouteGlobalRootEvent(e, { includeActiveFallback: false })) return;
      emit(protoRootBus, 'context.menu', e);
    })
  );

  // -------------------------
  // (B) 懒绑定：host:* host-bound events
  // -------------------------
  const rootProxy = createProxyTarget({
    protoBus: protoRootBus,
    // hostTarget：先工作假设= rootEl；未来可以换成更准确的 host 专用 target
    hostTarget: rootEl,
    focusEventTarget: opt.focusEventTarget,
    isEnabled,
    // 注：rootProxy 不做“解释”，只做“路由 + gating”
  });

  const globalProxy = createProxyTarget({
    protoBus: protoGlobalBus,
    hostTarget: globalEl,
    isEnabled,
  });

  return {
    /** Inject these into EVENT_*_TARGET_CAP */
    rootTarget: rootProxy as EventTarget,
    globalTarget: globalProxy as EventTarget,
    /** Adapter-private ingress for a trusted physical host target. */
    dispatchHostRootEvent(type: string, event: Event) {
      rootProxy.__dispatchHost(type, event);
    },

    dispose() {
      if (activeRouterByRoot.get(rootEl) === routerIdentity) activeRouterByRoot.delete(rootEl);
      for (const u of unsubs.splice(0)) u();
      rootProxy.__dispose?.();
      globalProxy.__dispose?.();
    },
  };
}

function listen(t: any, type: string, cb: (ev: any) => void): Unsub {
  t.addEventListener(type, cb as any);
  return () => t.removeEventListener(type, cb as any);
}

function createProtoEventPayload(type: string, native: any) {
  const target: Record<PropertyKey, unknown> = {
    type,
    nativeEvent: native,
    target: native?.target,
    key: typeof native?.key === 'string' ? native.key : undefined,
    shiftKey: typeof native?.shiftKey === 'boolean' ? native.shiftKey : undefined,
    altKey: typeof native?.altKey === 'boolean' ? native.altKey : undefined,
    ctrlKey: typeof native?.ctrlKey === 'boolean' ? native.ctrlKey : undefined,
    metaKey: typeof native?.metaKey === 'boolean' ? native.metaKey : undefined,
    requestDefaultPrevented:
      typeof native?.preventDefault === 'function' ? () => native.preventDefault() : undefined,
    preventDefault:
      typeof native?.preventDefault === 'function' ? () => native.preventDefault() : undefined,
    stopPropagation:
      typeof native?.stopPropagation === 'function' ? () => native.stopPropagation() : undefined,
  };

  if (!native || (typeof native !== 'object' && typeof native !== 'function')) return target;

  let sharedState = payloadStateByNativeEvent.get(native);
  if (!sharedState) {
    sharedState = {};
    payloadStateByNativeEvent.set(native, sharedState);
  }
  const state = sharedState;

  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      return state[prop];
    },
    set(obj, prop, value) {
      if (prop in obj) obj[prop] = value;
      else state[prop] = value;
      return true;
    },
    has(obj, prop) {
      return prop in obj || prop in state;
    },
  });
}

function createProxyTarget(args: {
  protoBus: EventTarget;
  hostTarget: EventTarget;
  focusEventTarget?: EventTarget;
  isEnabled: () => boolean;
}) {
  // 记录已转发到 host 的监听器，便于 remove 时精确解绑
  const hostListeners: Listener[] = [];
  const protoListeners: (Listener & { capture: boolean; cleanup: () => void })[] = [];

  // 为 host-bound 分支加 gating：eventGate disable 后，这些也不应该再进 proto 回调
  // 这点非常关键，否则“unmount 后还能触发回调”的竞态会回来。
  function wrapWithGate(cb: any) {
    return (ev: any) => {
      if (!args.isEnabled()) return;
      cb(ev);
    };
  }

  function parseType(type: string) {
    if (type.startsWith('host:')) {
      return { kind: 'host' as const, inner: type.slice('host:'.length) };
    }
    return { kind: 'proto' as const, inner: type };
  }

  const api: any = {
    addEventListener(type: string, cb: any, options?: any) {
      const p = parseType(String(type));

      if (p.kind === 'proto') {
        const signal = options?.signal;
        if (!cb || signal?.aborted) return;
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        const once = Boolean(options?.once);
        if (protoListeners.some((r) => r.type === p.inner && r.cb === cb && r.capture === capture))
          return;
        const record = {
          type: p.inner,
          cb,
          options,
          capture,
          wrapped: undefined as any,
          cleanup: () => {},
        };
        record.cleanup = () => {
          const index = protoListeners.indexOf(record);
          if (index < 0) return;
          protoListeners.splice(index, 1);
          args.protoBus.removeEventListener(p.inner, record.wrapped, capture);
          signal?.removeEventListener('abort', record.cleanup);
        };
        record.wrapped = (event: Event) => {
          if (once) record.cleanup();
          if (typeof cb === 'function') cb.call(args.protoBus, event);
          else cb.handleEvent(event);
        };
        args.protoBus.addEventListener(p.inner, record.wrapped, {
          capture,
          once,
          signal,
          passive: Boolean(options?.passive),
        });
        protoListeners.push(record);
        signal?.addEventListener('abort', record.cleanup, { once: true });
        return;
      }

      // host:*
      const wrapped = wrapWithGate(cb);
      const target =
        p.inner === 'focus' || p.inner === 'blur'
          ? (args.focusEventTarget ?? args.hostTarget)
          : args.hostTarget;
      hostListeners.push({ type: p.inner, target, cb, options, wrapped } as any);
      target.addEventListener(p.inner, wrapped as any, options);
    },

    removeEventListener(type: string, cb: any, options?: any) {
      const p = parseType(String(type));

      if (p.kind === 'proto') {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        protoListeners
          .find((r) => r.type === p.inner && r.cb === cb && r.capture === capture)
          ?.cleanup();
        return;
      }

      // latest-first removal aligns with your v0 matching习惯
      for (let i = hostListeners.length - 1; i >= 0; i--) {
        const r: any = hostListeners[i];
        if (r.type !== p.inner) continue;
        if (r.cb !== cb) continue;
        // options 匹配这里先用 Object.is（和 DOM 一样复杂就复杂了）
        // 你若坚持“plain object shallow compare”，可以把 sameOptions 搬进来
        if (!Object.is(r.options, options)) continue;

        (r.target ?? args.hostTarget).removeEventListener(p.inner, r.wrapped as any, options);
        hostListeners.splice(i, 1);
        return;
      }
    },

    dispatchEvent(ev: Event) {
      // 对外暴露的 dispatch：默认只派发到 protoBus
      // （hostTarget 的 dispatch 由真实 DOM 自己完成）
      return args.protoBus.dispatchEvent(ev);
    },

    __hasProtoListeners(type: string) {
      return protoListeners.some((r) => r.type === type);
    },

    /** Private adapter ingress; does not emit another public DOM event. */
    __dispatchHost(type: string, event: Event) {
      for (const listener of hostListeners) {
        if (listener.type !== type) continue;
        listener.wrapped?.(event);
      }
    },
    // best-effort cleanup (not required by EventTarget)
    __dispose() {
      for (const r of [...protoListeners]) r.cleanup();
      // 主动解绑所有已懒绑定的 host listener，避免残留
      for (const r of hostListeners.splice(0)) {
        (r.target ?? args.hostTarget).removeEventListener(
          r.type,
          // @ts-ignore
          r.wrapped as any,
          r.options
        );
      }
    },
  };

  return api;
}
