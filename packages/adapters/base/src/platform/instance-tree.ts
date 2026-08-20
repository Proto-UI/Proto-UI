import type { Prototype } from '@proto.ui/core';

const PROTO_PARENT_INSTANCE = Symbol.for('@proto.ui/adapter-base/__proto_parent_instance');
const TRIGGER_OWNER_MARK = Symbol.for('@proto.ui/as-trigger/confirm-owner');

type ElementWithProtoParent = HTMLElement & Record<symbol, unknown>;

type DynamicEventTarget = EventTarget & {
  setTarget(target: EventTarget | null): void;
  getTarget(): EventTarget | null;
};

export function releaseWebTriggerSurface(target: HTMLElement): void {
  target.removeAttribute('tabindex');
  for (const attr of target.getAttributeNames()) {
    if (attr === 'role' || attr.startsWith('aria-') || attr.startsWith('data-pui-a11y-')) {
      target.removeAttribute(attr);
    }
  }
}

function createDynamicEventTarget(): DynamicEventTarget {
  type Registration = {
    type: string;
    listener: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  };

  let target: EventTarget | null = null;
  const registrations: Registration[] = [];
  const capture = (options?: boolean | AddEventListenerOptions | EventListenerOptions) =>
    typeof options === 'boolean' ? options : options?.capture === true;

  const bridge = {
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (!listener) return;
      if (
        registrations.some(
          (entry) =>
            entry.type === type &&
            entry.listener === listener &&
            capture(entry.options) === capture(options)
        )
      ) {
        return;
      }
      registrations.push({ type, listener, options });
      target?.addEventListener(type, listener, options);
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ) {
      if (!listener) return;
      const index = registrations.findIndex(
        (entry) =>
          entry.type === type &&
          entry.listener === listener &&
          capture(entry.options) === capture(options)
      );
      if (index < 0) return;
      const [entry] = registrations.splice(index, 1);
      target?.removeEventListener(type, listener, entry?.options);
    },
    dispatchEvent(event: Event) {
      return target?.dispatchEvent(event) ?? false;
    },
    setTarget(nextTarget: EventTarget | null) {
      if (target === nextTarget) return;
      if (target) {
        for (const entry of registrations) {
          target.removeEventListener(entry.type, entry.listener, entry.options);
        }
      }
      target = nextTarget;
      if (target) {
        for (const entry of registrations) {
          target.addEventListener(entry.type, entry.listener, entry.options);
        }
      }
    },
    getTarget() {
      return target;
    },
  };

  return bridge as DynamicEventTarget;
}

export type LogicalInstanceToken = object & {
  readonly __protoUiLogicalInstance?: true;
};

function writeProtoParentMark(instance: HTMLElement, parent: HTMLElement | null): void {
  const target = instance as ElementWithProtoParent;
  if (parent) {
    target[PROTO_PARENT_INSTANCE] = parent;
    return;
  }
  delete target[PROTO_PARENT_INSTANCE];
}

function readProtoParentMark(instance: HTMLElement): HTMLElement | null {
  const mark = (instance as ElementWithProtoParent)[PROTO_PARENT_INSTANCE];
  return mark instanceof HTMLElement ? mark : null;
}

export type InstanceTreeMarkerOptions = {
  releaseTriggerSurface?: (target: HTMLElement) => void;
};

export function createInstanceTreeMarkers(
  symbolName: string,
  options: InstanceTreeMarkerOptions = {}
) {
  const PROTO_INSTANCE = Symbol.for(symbolName);
  const PROTO_BY_INSTANCE = new WeakMap<HTMLElement, Prototype<any>>();
  const TOKEN_BY_INSTANCE = new WeakMap<HTMLElement, LogicalInstanceToken>();
  const INSTANCE_BY_TOKEN = new WeakMap<LogicalInstanceToken, HTMLElement>();
  const PROTO_BY_TOKEN = new WeakMap<LogicalInstanceToken, Prototype<any>>();
  const PARENT_BY_TOKEN = new WeakMap<LogicalInstanceToken, LogicalInstanceToken>();
  const CHILDREN_BY_TOKEN = new WeakMap<LogicalInstanceToken, Set<LogicalInstanceToken>>();
  const TRIGGER_GROUP_ANCHOR_BY_TOKEN = new WeakMap<LogicalInstanceToken, LogicalInstanceToken>();
  const EVENT_TARGET_BY_TOKEN = new WeakMap<LogicalInstanceToken, DynamicEventTarget>();
  const BOUND_EVENT_TARGET_BY_TOKEN = new WeakMap<LogicalInstanceToken, EventTarget>();
  const TRIGGER_GROUP_MEMBERS_BY_ANCHOR = new WeakMap<
    LogicalInstanceToken,
    Set<LogicalInstanceToken>
  >();
  const TRIGGER_GROUP_SURFACE_BY_ANCHOR = new WeakMap<LogicalInstanceToken, LogicalInstanceToken>();
  const TRIGGER_SURFACE_LISTENERS = new WeakMap<LogicalInstanceToken, Set<() => void>>();
  const TRIGGER_TOKENS = new WeakSet<LogicalInstanceToken>();

  function notifyTriggerSurface(owner: LogicalInstanceToken): void {
    syncTriggerGroupEventTargets(owner);
    const members = TRIGGER_GROUP_MEMBERS_BY_ANCHOR.get(owner);
    if (!members) return;
    const surface = TRIGGER_GROUP_SURFACE_BY_ANCHOR.get(owner);
    for (const member of members) {
      const memberRoot = INSTANCE_BY_TOKEN.get(member);
      if (memberRoot && member !== surface) options.releaseTriggerSurface?.(memberRoot);
      for (const listener of TRIGGER_SURFACE_LISTENERS.get(member) ?? []) listener();
    }
  }

  function syncTriggerGroupEventTargets(owner: LogicalInstanceToken): void {
    for (const member of TRIGGER_GROUP_MEMBERS_BY_ANCHOR.get(owner) ?? []) {
      syncLogicalEventTarget(member);
    }
  }

  function registerTriggerMember(
    token: LogicalInstanceToken,
    owner: LogicalInstanceToken,
    makeSurface: boolean
  ): void {
    let members = TRIGGER_GROUP_MEMBERS_BY_ANCHOR.get(owner);
    if (!members) {
      members = new Set();
      TRIGGER_GROUP_MEMBERS_BY_ANCHOR.set(owner, members);
    }
    members.delete(token);
    members.add(token);
    const currentSurface = TRIGGER_GROUP_SURFACE_BY_ANCHOR.get(owner);
    let parent = currentSurface ? PARENT_BY_TOKEN.get(currentSurface) : undefined;
    let currentIsDeeper = false;
    while (parent) {
      if (parent === token) {
        currentIsDeeper = true;
        break;
      }
      parent = PARENT_BY_TOKEN.get(parent);
    }

    if ((makeSurface && !currentIsDeeper) || !currentSurface) {
      const previousRoot = currentSurface ? INSTANCE_BY_TOKEN.get(currentSurface) : null;
      TRIGGER_GROUP_SURFACE_BY_ANCHOR.set(owner, token);
      const nextRoot = INSTANCE_BY_TOKEN.get(token);
      if (previousRoot && previousRoot !== nextRoot) {
        options.releaseTriggerSurface?.(previousRoot);
      }
    } else if (makeSurface && currentIsDeeper) {
      const supersededRoot = INSTANCE_BY_TOKEN.get(token);
      const currentRoot = currentSurface ? INSTANCE_BY_TOKEN.get(currentSurface) : null;
      if (supersededRoot && supersededRoot !== currentRoot) {
        options.releaseTriggerSurface?.(supersededRoot);
      }
    }
  }

  function unregisterTriggerMember(
    token: LogicalInstanceToken,
    owner: LogicalInstanceToken = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token
  ): void {
    const members = TRIGGER_GROUP_MEMBERS_BY_ANCHOR.get(owner);
    if (!members?.delete(token)) return;
    if (TRIGGER_GROUP_SURFACE_BY_ANCHOR.get(owner) !== token) return;

    const connected = Array.from(members).filter(
      (member) => INSTANCE_BY_TOKEN.get(member)?.isConnected
    );
    const fallback = connected.at(-1) ?? Array.from(members).at(-1) ?? owner;
    TRIGGER_GROUP_SURFACE_BY_ANCHOR.set(owner, fallback);
    notifyTriggerSurface(owner);
  }

  function syncLogicalEventTarget(token: LogicalInstanceToken): void {
    const bridge = getLogicalEventTarget(token) as DynamicEventTarget;
    const owner = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token;
    const surface = TRIGGER_GROUP_SURFACE_BY_ANCHOR.get(owner) ?? owner;
    if (surface !== token) {
      bridge.setTarget(getLogicalEventTarget(surface));
      return;
    }
    bridge.setTarget(BOUND_EVENT_TARGET_BY_TOKEN.get(token) ?? null);
  }

  function mergeTriggerGroup(token: LogicalInstanceToken, owner: LogicalInstanceToken): void {
    const previousOwner = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token;
    if (previousOwner !== owner) unregisterTriggerMember(token, previousOwner);
    TRIGGER_GROUP_ANCHOR_BY_TOKEN.set(token, owner);
    TRIGGER_TOKENS.add(token);
    registerTriggerMember(token, owner, true);
    (token as Record<symbol, unknown>)[TRIGGER_OWNER_MARK] = owner;
    projectTriggerGroupAnchor(token);
    syncLogicalEventTarget(token);
    notifyTriggerSurface(owner);
  }

  function recomputeTriggerGroup(token: LogicalInstanceToken): void {
    if (!TRIGGER_TOKENS.has(token)) return;
    let owner = token;
    let parent = PARENT_BY_TOKEN.get(token);
    while (parent && TRIGGER_TOKENS.has(parent)) {
      owner = parent;
      parent = PARENT_BY_TOKEN.get(parent);
    }
    mergeTriggerGroup(token, owner);
  }

  function recomputeTriggerBranch(token: LogicalInstanceToken): void {
    recomputeTriggerGroup(token);
    for (const child of CHILDREN_BY_TOKEN.get(token) ?? []) {
      recomputeTriggerBranch(child);
    }
  }

  function setLogicalParentInternal(
    token: LogicalInstanceToken,
    parent: LogicalInstanceToken | null
  ): void {
    const previous = PARENT_BY_TOKEN.get(token);
    if (previous === parent || (!previous && !parent)) return;
    if (previous) CHILDREN_BY_TOKEN.get(previous)?.delete(token);
    if (parent) {
      PARENT_BY_TOKEN.set(token, parent);
      let children = CHILDREN_BY_TOKEN.get(parent);
      if (!children) {
        children = new Set();
        CHILDREN_BY_TOKEN.set(parent, children);
      }
      children.add(token);
    } else {
      PARENT_BY_TOKEN.delete(token);
    }
    recomputeTriggerBranch(token);
  }

  function projectTriggerGroupAnchor(token: LogicalInstanceToken): void {
    const root = INSTANCE_BY_TOKEN.get(token);
    if (!root) return;
    const owner = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token);
    if (owner && TRIGGER_TOKENS.has(token)) {
      (root as ElementWithProtoParent)[TRIGGER_OWNER_MARK] = owner;
    } else delete (root as ElementWithProtoParent)[TRIGGER_OWNER_MARK];
  }

  function createLogicalInstance(proto: Prototype<any>): LogicalInstanceToken {
    // Tokens intentionally remain extensible: semantic modules attach
    // cross-adapter ownership marks (for example as-trigger confirmation).
    const token = {} as LogicalInstanceToken;
    PROTO_BY_TOKEN.set(token, proto);
    TRIGGER_GROUP_ANCHOR_BY_TOKEN.set(token, token);
    return token;
  }

  function bindLogicalParent(
    token: LogicalInstanceToken,
    parent: LogicalInstanceToken | null
  ): void {
    setLogicalParentInternal(token, parent);
  }

  function markProtoInstance(
    el: HTMLElement,
    proto: Prototype<any>,
    token: LogicalInstanceToken = createLogicalInstance(proto)
  ): LogicalInstanceToken {
    (el as any)[PROTO_INSTANCE] = true;
    PROTO_BY_INSTANCE.set(el, proto);
    TOKEN_BY_INSTANCE.set(el, token);
    INSTANCE_BY_TOKEN.set(token, el);
    PROTO_BY_TOKEN.set(token, proto);
    projectTriggerGroupAnchor(token);

    if (TRIGGER_TOKENS.has(token)) {
      const owner = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token;
      registerTriggerMember(token, owner, true);
      notifyTriggerSurface(owner);
    }

    const parentRoot = getProtoParent(el);
    const parentToken = parentRoot ? TOKEN_BY_INSTANCE.get(parentRoot) : undefined;
    if (parentToken) setLogicalParentInternal(token, parentToken);
    for (const descendant of el.querySelectorAll<HTMLElement>('*')) {
      const descendantToken = TOKEN_BY_INSTANCE.get(descendant);
      if (!descendantToken) continue;
      const nearestParent = getProtoParent(descendant);
      if (nearestParent !== el) continue;
      setLogicalParentInternal(descendantToken, token);
    }
    return token;
  }

  function unbindProtoInstance(token: LogicalInstanceToken, el?: HTMLElement): void {
    const current = INSTANCE_BY_TOKEN.get(token);
    if (!current || (el && current !== el)) return;
    INSTANCE_BY_TOKEN.delete(token);
    TOKEN_BY_INSTANCE.delete(current);
    PROTO_BY_INSTANCE.delete(current);
    delete (current as any)[PROTO_INSTANCE];
    delete (current as ElementWithProtoParent)[TRIGGER_OWNER_MARK];
    unregisterTriggerMember(token);
  }

  function mergeLogicalTriggerGroup(
    token: LogicalInstanceToken,
    anchor: LogicalInstanceToken
  ): void {
    mergeTriggerGroup(token, anchor);
    for (const child of CHILDREN_BY_TOKEN.get(token) ?? []) recomputeTriggerBranch(child);
    queueMicrotask(() => {
      notifyTriggerSurface(anchor);
      queueMicrotask(() => notifyTriggerSurface(anchor));
    });
  }

  function getLogicalTriggerGroupAnchor(token: LogicalInstanceToken): LogicalInstanceToken {
    return TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token;
  }

  function getLogicalEventRouteSurfaceForTarget(
    target: EventTarget | null
  ): LogicalInstanceToken | null {
    let cur: Node | null = target instanceof Node ? target : null;
    const visited = new Set<Node>();
    while (cur) {
      if (visited.has(cur)) return null;
      visited.add(cur);

      if (typeof ShadowRoot !== 'undefined' && cur instanceof ShadowRoot) {
        cur = cur.host;
        continue;
      }

      if (cur instanceof HTMLElement) {
        const token = TOKEN_BY_INSTANCE.get(cur);
        if (token) {
          const owner = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token;
          return TRIGGER_GROUP_SURFACE_BY_ANCHOR.get(owner) ?? token;
        }

        const linkedParent = readProtoParentMark(cur) ?? PROTO_PARENT_BY_INSTANCE.get(cur) ?? null;
        if (linkedParent && linkedParent !== cur) {
          cur = linkedParent;
          continue;
        }
      }

      cur = cur.parentNode;
    }
    return null;
  }

  function resolveLogicalTriggerEventRouteForTarget(
    target: EventTarget | null
  ): { matched: true; accepted: boolean; surface: LogicalInstanceToken } | null {
    let cur: Node | null = target instanceof Node ? target : null;
    const visited = new Set<Node>();
    while (cur) {
      if (visited.has(cur)) return null;
      visited.add(cur);

      if (typeof ShadowRoot !== 'undefined' && cur instanceof ShadowRoot) {
        cur = cur.host;
        continue;
      }

      if (cur instanceof HTMLElement) {
        const token = TOKEN_BY_INSTANCE.get(cur);
        if (token && TRIGGER_TOKENS.has(token)) {
          const owner = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token;
          const surface = TRIGGER_GROUP_SURFACE_BY_ANCHOR.get(owner) ?? token;
          return { matched: true, accepted: token === surface, surface };
        }

        const linkedParent = readProtoParentMark(cur) ?? PROTO_PARENT_BY_INSTANCE.get(cur) ?? null;
        if (linkedParent && linkedParent !== cur) {
          cur = linkedParent;
          continue;
        }
      }

      cur = cur.parentNode;
    }
    return null;
  }

  function getLogicalTriggerSurfaceOwner(token: LogicalInstanceToken): LogicalInstanceToken {
    const owner = TRIGGER_GROUP_ANCHOR_BY_TOKEN.get(token) ?? token;
    return TRIGGER_GROUP_SURFACE_BY_ANCHOR.get(owner) ?? token;
  }

  function getLogicalTriggerSurfaceRoot(token: LogicalInstanceToken): HTMLElement | null {
    return INSTANCE_BY_TOKEN.get(getLogicalTriggerSurfaceOwner(token)) ?? null;
  }

  function subscribeLogicalTriggerSurface(
    token: LogicalInstanceToken,
    listener: () => void
  ): () => void {
    let listeners = TRIGGER_SURFACE_LISTENERS.get(token);
    if (!listeners) {
      listeners = new Set();
      TRIGGER_SURFACE_LISTENERS.set(token, listeners);
    }
    listeners.add(listener);
    return () => listeners?.delete(listener);
  }

  function getLogicalEventTarget(token: LogicalInstanceToken): EventTarget {
    let target = EVENT_TARGET_BY_TOKEN.get(token);
    if (!target) {
      target = createDynamicEventTarget();
      EVENT_TARGET_BY_TOKEN.set(token, target);
    }
    return target;
  }

  function bindLogicalEventTarget(token: LogicalInstanceToken, target: EventTarget): void {
    BOUND_EVENT_TARGET_BY_TOKEN.set(token, target);
    syncLogicalEventTarget(token);
  }

  function unbindLogicalEventTarget(token: LogicalInstanceToken, target?: EventTarget): void {
    const bridge = EVENT_TARGET_BY_TOKEN.get(token);
    const bound = BOUND_EVENT_TARGET_BY_TOKEN.get(token);
    if (!bridge || (target && bound !== target)) return;
    BOUND_EVENT_TARGET_BY_TOKEN.delete(token);
    syncLogicalEventTarget(token);
  }

  const PROTO_PARENT_BY_INSTANCE = new WeakMap<HTMLElement, HTMLElement>();

  function setProtoParent(instance: HTMLElement, parent: HTMLElement | null): void {
    if (parent) {
      PROTO_PARENT_BY_INSTANCE.set(instance, parent);
      writeProtoParentMark(instance, parent);
    } else {
      PROTO_PARENT_BY_INSTANCE.delete(instance);
      writeProtoParentMark(instance, null);
    }

    const token = TOKEN_BY_INSTANCE.get(instance);
    if (!token) return;
    const parentRoot = parent ? (isProtoInstance(parent) ? parent : getProtoParent(parent)) : null;
    const parentToken = parentRoot ? TOKEN_BY_INSTANCE.get(parentRoot) : undefined;
    setLogicalParentInternal(token, parentToken ?? null);
  }

  /** Removes a temporary host projection without changing logical ownership. */
  function clearProtoParentProjection(instance: HTMLElement): void {
    PROTO_PARENT_BY_INSTANCE.delete(instance);
    writeProtoParentMark(instance, null);
  }

  function getProtoParent(instance: HTMLElement): HTMLElement | null {
    let cur: Node | null =
      readProtoParentMark(instance) ??
      PROTO_PARENT_BY_INSTANCE.get(instance) ??
      instance.parentNode;
    while (cur) {
      if (typeof ShadowRoot !== 'undefined' && cur instanceof ShadowRoot) {
        cur = cur.host;
        continue;
      }
      if (isProtoInstance(cur)) return cur as HTMLElement;

      if (cur instanceof HTMLElement) {
        const linkedParent =
          readProtoParentMark(cur) ?? PROTO_PARENT_BY_INSTANCE.get(cur as HTMLElement) ?? null;
        if (linkedParent && linkedParent !== cur) {
          cur = linkedParent;
          continue;
        }
      }

      cur = cur.parentNode;
    }
    return null;
  }

  function getPrototypeByInstance(instance: HTMLElement): Prototype<any> | null {
    return PROTO_BY_INSTANCE.get(instance) ?? null;
  }

  function getLogicalParent(token: LogicalInstanceToken): LogicalInstanceToken | null {
    return PARENT_BY_TOKEN.get(token) ?? null;
  }

  function getLogicalRoot(token: LogicalInstanceToken): HTMLElement | null {
    return INSTANCE_BY_TOKEN.get(token) ?? null;
  }

  function getLogicalPrototype(token: LogicalInstanceToken): Prototype<any> | null {
    return PROTO_BY_TOKEN.get(token) ?? null;
  }

  function isProtoInstance(node: Node | null): node is HTMLElement {
    if (!node) return false;
    return (node as any)[PROTO_INSTANCE] === true;
  }

  return {
    PROTO_INSTANCE,
    createLogicalInstance,
    bindLogicalParent,
    markProtoInstance,
    unbindProtoInstance,
    setProtoParent,
    clearProtoParentProjection,
    getProtoParent,
    getPrototypeByInstance,
    getLogicalParent,
    getLogicalRoot,
    getLogicalPrototype,
    mergeLogicalTriggerGroup,
    getLogicalTriggerGroupAnchor,
    /** @deprecated Use mergeLogicalTriggerGroup. */
    setLogicalEventRouteOwner: mergeLogicalTriggerGroup,
    /** @deprecated Use getLogicalTriggerGroupAnchor. */
    getLogicalEventRouteOwner: getLogicalTriggerGroupAnchor,
    getLogicalEventRouteSurfaceForTarget,
    resolveLogicalTriggerEventRouteForTarget,
    getLogicalTriggerSurfaceOwner,
    getLogicalTriggerSurfaceRoot,
    subscribeLogicalTriggerSurface,
    getLogicalEventTarget,
    bindLogicalEventTarget,
    unbindLogicalEventTarget,
    isProtoInstance,
  };
}
