import { hasViewportFixedInlineSize } from './portal-inline-size';

type Registration = { destination: HTMLElement; document: Document; token: object };
type Signal = { generation: number; notifying: boolean; listeners: Set<() => void> };
type MaterialEpochState = Signal & { owner: object | null; suspended: boolean };

export type WebPortalMaterialEpoch = {
  commitProjection(): void;
  suspend(): void;
  release(): void;
};
export type WebPortalDestinationBinding = Readonly<{
  destination: HTMLElement;
  /** Opaque policy identity, never source or optical eligibility. */
  registration: object | null;
}>;

// A default-body epoch must observe its author leaving the target document,
// even though its physical destination stays fixed. This opaque identity is
// only invalidation metadata; it never grants source or optical eligibility.
const crossDocumentFallbackPolicy = Object.freeze({});
const destinations = new WeakMap<Element, Registration>();
const registry: Signal = { generation: 0, notifying: false, listeners: new Set() };
const projections = new WeakMap<HTMLElement, Signal>();
const materialEpochs = new WeakMap<HTMLElement, MaterialEpochState>();

/**
 * Register an application-owned scene's overlay mount. This is a host policy,
 * never a portable Prototype prop or evidence that material pixels are eligible.
 * The scene contains both the author position and a distinct overlay mount in
 * its composed subtree. Keeping projection inside that scene preserves nested
 * author origins without inventing a second logical instance-tree mapping.
 * Replacing a registration retires its old disposer; disposal resolves afresh
 * against the nearest remaining scene, including an explicitly registered outer
 * scene. An invalid nearest registration instead falls back to document.body.
 */
export function registerWebPortalDestination(
  originScope: Element,
  destination: HTMLElement
): () => void {
  const entry = { destination, document: originScope.ownerDocument, token: {} };
  destinations.set(originScope, entry);
  notify(registry);
  return () => {
    if (destinations.get(originScope) !== entry) return;
    destinations.delete(originScope);
    notify(registry);
  };
}

/** Registration/replacement/disposal only; subscribing never acquires a view. */
export function subscribeWebPortalDestinations(listener: () => void): () => void {
  return subscribe(registry, listener);
}

export function getWebPortalDestinationGeneration(): number {
  return registry.generation;
}

export function resolveWebPortalDestination(origin: Node, target?: HTMLElement): HTMLElement;
export function resolveWebPortalDestination(origin: Node | null, target: HTMLElement): HTMLElement;
/**
 * Resolve from the logical author position, not the target's projected parent.
 * The Adapter re-resolves on author reparenting, destination invalidation and
 * view lifecycle changes. This helper never moves an application node. A private, cached engine
 * capability check may briefly insert an inert geometry fixture.
 * Before a target exists, keep the body default until cycle checks are possible.
 */
export function resolveWebPortalDestination(
  origin: Node | null,
  target?: HTMLElement
): HTMLElement {
  return target
    ? resolveWebPortalDestinationBinding(origin, target).destination
    : resolveWebPortalDestinationBinding(origin!).destination;
}

export function resolveWebPortalDestinationBinding(
  origin: Node,
  target?: HTMLElement
): WebPortalDestinationBinding;
export function resolveWebPortalDestinationBinding(
  origin: Node | null,
  target: HTMLElement
): WebPortalDestinationBinding;
/** Resolve destination and its nearest policy identity in one guarded read. */
export function resolveWebPortalDestinationBinding(
  origin: Node | null,
  target?: HTMLElement
): WebPortalDestinationBinding {
  const doc = target?.ownerDocument ?? documentOf(origin!);
  // Geometry/host reads may replace body or adopt the target reentrantly.
  // Resolve fallback at return time rather than returning a detached/foreign body.
  const fallback = (registration: object | null = null): WebPortalDestinationBinding => {
    const currentDocument = target?.ownerDocument ?? documentOf(origin!);
    return {
      destination: currentDocument.body,
      registration:
        origin && documentOf(origin) !== currentDocument
          ? crossDocumentFallbackPolicy
          : registration,
    };
  };
  if (!target || !origin?.isConnected || documentOf(origin) !== doc) return fallback();
  const generation = registry.generation;
  const authorChain = ancestry(origin);
  for (const node of authorChain) {
    if (node.nodeType !== 1) continue;
    const scope = node as Element;
    const entry = destinations.get(scope);
    if (!entry) continue;
    const unavailable = () => fallback(entry.token);
    const destination = entry.destination;
    const destinationChain = ancestry(destination);
    if (
      entry.document !== doc ||
      !scope.isConnected ||
      scope.ownerDocument !== doc ||
      !destination.isConnected ||
      destination.ownerDocument !== doc ||
      destination === scope ||
      !destinationChain.includes(scope) ||
      destinationChain.includes(target)
    ) {
      return unavailable();
    }
    // Admission is based on actual computed ancestor styles, not a caller's
    // "clipping safe" assertion. Include the destination, slots and shadow hosts.
    const view = doc.defaultView;
    if (!view) return unavailable();
    const body = doc.body;
    let inlineSize = false;
    try {
      for (const ancestor of destinationChain) {
        if (ancestor.nodeType !== 1) continue;
        const css = view.getComputedStyle(ancestor as Element);
        if (!isClippingSafe(css, true)) return unavailable();
        inlineSize ||= css.getPropertyValue('container-type').trim() === 'inline-size';
      }
      if (inlineSize) {
        if (!hasViewportFixedInlineSize(doc)) return unavailable();
        // Fixture insertion/removal can alter :has() or :last-child selectors.
        // Read actual eligibility again after cleanup, even for cached support.
        for (const ancestor of destinationChain) {
          if (
            ancestor.nodeType === 1 &&
            !isClippingSafe(view.getComputedStyle(ancestor as Element), true)
          )
            return unavailable();
        }
      }
    } catch {
      return unavailable();
    }
    // Host reads can be reentrant. Never publish a registration superseded
    // during validation; the subscription's newer reconciliation owns that turn.
    return doc.body === body &&
      doc.defaultView === view &&
      registry.generation === generation &&
      destinations.get(scope) === entry &&
      destination.isConnected &&
      destination.ownerDocument === doc &&
      target.ownerDocument === doc &&
      origin.isConnected &&
      documentOf(origin) === doc &&
      sameChain(authorChain, ancestry(origin)) &&
      sameChain(destinationChain, ancestry(destination))
      ? { destination, registration: entry.token }
      : fallback();
  }
  return fallback();
}

/** Called by an Adapter only after its renderer/native projection commits. */
export function notifyWebPortalProjection(host: HTMLElement): void {
  notify(projectionSignal(host));
}

/** A registry change is not a physical projection commit. Keep these separate. */
export function subscribeWebPortalProjection(host: HTMLElement, listener: () => void): () => void {
  return subscribe(projectionSignal(host), listener);
}

export function getWebPortalProjectionGeneration(host: HTMLElement): number {
  return projections.get(host)?.generation ?? 0;
}

/**
 * Begin a physical view's portal/material policy lease. An open view keeps its
 * selected destination; later policy changes can withdraw material without a
 * DOM move, synthetic input, or a false projection-commit notification.
 * A new epoch remains suspended until its first real projection commits.
 * Later suspension is irreversible; only a new committed epoch can reset it.
 * An unsuspended epoch is not evidence of source eligibility or enhanced paint.
 */
export function beginWebPortalMaterialEpoch(host: HTMLElement): WebPortalMaterialEpoch {
  const state = materialEpochState(host);
  const owner = {};
  let released = false;
  let blocked = false;
  let committed = false;
  state.owner = owner;
  state.suspended = true;
  notify(state);
  return {
    commitProjection() {
      if (released || blocked || committed || state.owner !== owner) return;
      committed = true;
      state.suspended = false;
      notify(state);
    },
    suspend() {
      if (released || blocked || state.owner !== owner) return;
      blocked = true;
      state.suspended = true;
      notify(state);
    },
    release() {
      if (released) return;
      released = true;
      if (state.owner !== owner) return;
      state.owner = null;
      state.suspended = true;
      notify(state);
    },
  };
}

/** Internal transport snapshot: opaque ownership only, never material eligibility. */
export function getWebPortalMaterialEpochSnapshot(host: HTMLElement): Readonly<{
  owner: object | null;
  suspended: boolean;
  generation: number;
}> {
  const state = materialEpochs.get(host);
  return Object.freeze({
    owner: state?.owner ?? null,
    suspended: state?.suspended ?? true,
    generation: state?.generation ?? 0,
  });
}

export function isWebPortalMaterialSuspended(host: HTMLElement): boolean {
  return materialEpochs.get(host)?.suspended ?? false;
}

/** Policy invalidation only: no physical projection is implied by this signal. */
export function subscribeWebPortalMaterialSuspension(
  host: HTMLElement,
  listener: () => void
): () => void {
  return subscribe(materialEpochState(host), listener);
}

export function getWebPortalMaterialSuspensionGeneration(host: HTMLElement): number {
  return materialEpochs.get(host)?.generation ?? 0;
}

function materialEpochState(host: HTMLElement): MaterialEpochState {
  let state = materialEpochs.get(host);
  if (!state) {
    state = {
      owner: null,
      suspended: false,
      generation: 0,
      notifying: false,
      listeners: new Set(),
    };
    materialEpochs.set(host, state);
  }
  return state;
}

function projectionSignal(host: HTMLElement): Signal {
  let signal = projections.get(host);
  if (!signal) {
    signal = { generation: 0, notifying: false, listeners: new Set() };
    projections.set(host, signal);
  }
  return signal;
}

function subscribe(signal: Signal, listener: () => void): () => void {
  // Separate leases even when the callback identity is shared.
  const subscribed = () => listener();
  signal.listeners.add(subscribed);
  return () => {
    signal.listeners.delete(subscribed);
  };
}

function notify(signal: Signal): void {
  ++signal.generation;
  if (signal.notifying) return;
  signal.notifying = true;
  try {
    let current: number;
    do {
      current = signal.generation;
      for (const listener of [...signal.listeners]) {
        if (current !== signal.generation) break;
        if (!signal.listeners.has(listener)) continue;
        try {
          listener();
        } catch (error) {
          // One failing lease cannot strand other consumers or prevent the
          // caller from receiving its disposer. Preserve normal error reporting.
          queueMicrotask(() => {
            throw error;
          });
        }
      }
    } while (current !== signal.generation);
  } finally {
    signal.notifying = false;
  }
}

function documentOf(node: Node): Document {
  return node.nodeType === 9 ? (node as Document) : node.ownerDocument!;
}

function ancestry(origin: Node): Node[] {
  const result: Node[] = [];
  const seen = new Set<Node>();
  for (let node: Node | null = origin; node && !seen.has(node); ) {
    seen.add(node);
    result.push(node);
    node =
      (node as Element).assignedSlot ??
      node.parentNode ??
      (node.nodeType === 11 ? (node as ShadowRoot).host : null);
  }
  return result;
}

function sameChain(a: Node[], b: Node[]): boolean {
  return a.length === b.length && a.every((node, index) => node === b[index]);
}

function isClippingSafe(css: CSSStyleDeclaration, inlineSize: boolean): boolean {
  const neutral = (key: string, allowed: string) => {
    const value = css.getPropertyValue(key).trim();
    return !value || value === allowed;
  };
  // Ordinary overflow cannot be accepted on a promise that today's popup fits;
  // a later placement or paintOutset can exceed that component's clip.
  if (!['overflow', 'overflow-x', 'overflow-y'].every((key) => neutral(key, 'visible')))
    return false;
  if (
    ![
      'transform',
      'translate',
      'rotate',
      'scale',
      'perspective',
      'filter',
      'backdrop-filter',
      '-webkit-backdrop-filter',
      'clip-path',
      'mask-image',
      '-webkit-mask-image',
      'mask-border-source',
    ].every((key) => neutral(key, 'none'))
  ) {
    return false;
  }
  if (/\b(layout|paint|strict|content)\b/.test(css.contain)) return false;
  if (
    /\b(transform|translate|rotate|scale|perspective|filter|backdrop-filter|contain)\b/.test(
      css.willChange
    )
  ) {
    return false;
  }
  return (
    neutral('clip', 'auto') &&
    neutral('transform-style', 'flat') &&
    (neutral('container-type', 'normal') ||
      (inlineSize && css.getPropertyValue('container-type').trim() === 'inline-size')) &&
    neutral('content-visibility', 'visible') &&
    (neutral('zoom', 'normal') || neutral('zoom', '1')) &&
    css.display !== 'none' &&
    css.visibility !== 'hidden' &&
    css.visibility !== 'collapse'
  );
}
