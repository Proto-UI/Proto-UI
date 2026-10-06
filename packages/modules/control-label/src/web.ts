import type { ControlLabelHost } from './caps';

const INTERACTIVE =
  'a[href],button,input,textarea,select,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[role="textbox"],[role="combobox"],[role="menuitem"],[role="tab"],[tabindex]:not([tabindex="-1"])';
type ScopeMember = { anchor: Node; notify(): void };
type ScopeObserver = { observer: MutationObserver; members: Set<ScopeMember> };
const observers = new WeakMap<Node, ScopeObserver>();

/** One observer per actual tree scope; no document-wide scan per participant. */
function observeScope(scope: Node, anchor: Node, notify: () => void): () => void {
  const document = scope.nodeType === 9 ? (scope as Document) : scope.ownerDocument;
  const Observer = document?.defaultView?.MutationObserver;
  if (!Observer) return () => {};
  let entry = observers.get(scope);
  if (!entry) {
    const members = new Set<ScopeMember>();
    const observer = new Observer((mutations) => {
      for (const member of [...members]) {
        const affected = mutations.some((mutation) => {
          if (mutation.type === 'attributes') return mutation.target === member.anchor;
          return [...mutation.addedNodes, ...mutation.removedNodes].some(
            (node) => node === member.anchor || node.contains(member.anchor)
          );
        });
        if (affected && members.has(member)) member.notify();
      }
    });
    observer.observe(scope, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'aria-labelledby'],
    });
    entry = { observer, members };
    observers.set(scope, entry);
  }
  const ownEntry = entry;
  const member = { anchor, notify };
  ownEntry.members.add(member);
  return () => {
    ownEntry.members.delete(member);
    if (!ownEntry.members.size) {
      ownEntry.observer.disconnect();
      if (observers.get(scope) === ownEntry) observers.delete(scope);
    }
  };
}

/** A trusted non-pointer activation can be supplied by accessibility tooling.
 * This classifier is not evidence that a particular assistive technology was run. */
export function isTrustedNonPointerLabelActivation(facts: {
  trusted: boolean;
  detail: number;
  pointerId?: number;
  pointerType?: string;
}): boolean {
  return (
    facts.trusted &&
    (facts.pointerId === undefined
      ? facts.detail === 0
      : facts.pointerId === -1 && facts.pointerType === '')
  );
}

/** Host-only intent. Never looks up a target or dispatches a synthetic target click. */
export function createWebControlLabelHost(
  getTarget: () => HTMLElement | null,
  subscribeTargetChange?: (listener: () => void) => () => void
): ControlLabelHost {
  return {
    attach({ kind, activation, onActivate, onViewChange }) {
      let actionable = kind === 'label' && activation;
      let disposed = false;
      let target: HTMLElement | null = null;
      let eventDocument: Document | null = null;
      let observedChain: readonly Node[] = [];
      let scopeOffs: Array<() => void> = [];
      let cleanListeners = () => {};
      let pending: {
        id: number;
        x: number;
        y: number;
        root: Node;
        down: PointerEvent;
        up: PointerEvent | null;
        released: boolean;
      } | null = null;
      const view = () => {
        const current = getTarget();
        return !disposed && current?.isConnected
          ? { identity: current, scope: current.getRootNode() }
          : null;
      };
      const observeCurrentScopes = (element: HTMLElement | null) => {
        // Retain the last connected scopes while a physical node is temporarily
        // absent, so reinsertion into its ShadowRoot is observable without a
        // document-wide shadow-tree search.
        if (element && !element.isConnected && observedChain.length > 0) return;
        const chain: Node[] = [];
        const anchors: Node[] = [];
        let anchor: Node | null = element;
        while (anchor) {
          const scope = anchor.getRootNode();
          chain.push(scope);
          anchors.push(anchor);
          anchor = 'host' in scope ? (scope as ShadowRoot).host : null;
        }
        if (
          chain.length === observedChain.length &&
          chain.every((scope, i) => scope === observedChain[i]) &&
          element === target
        )
          return;
        for (const off of scopeOffs) off();
        scopeOffs = [];
        observedChain = chain;
        chain.forEach((scope, i) => scopeOffs.push(observeScope(scope, anchors[i]!, sync)));
      };
      const sync = () => {
        if (disposed) return;
        const next = getTarget();
        if (next === target && (next?.ownerDocument ?? null) === eventDocument) {
          observeCurrentScopes(next);
          onViewChange();
          return;
        }
        cleanListeners();
        pending = null;
        // Observe before replacing target so same-scope physical replacements
        // do not accidentally retain the previous anchor subscription.
        observeCurrentScopes(next);
        target = next;
        eventDocument = next?.ownerDocument ?? null;
        if (next) {
          const document = next.ownerDocument;
          const eligible = (event: Event) => {
            for (const node of event.composedPath()) {
              if (node === next) return true;
              if (node instanceof document.defaultView!.Element && node.matches(INTERACTIVE))
                return false;
            }
            return false;
          };
          const down = (event: PointerEvent) => {
            pending = null;
            if (
              !actionable ||
              event.defaultPrevented ||
              event.button !== 0 ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              !eligible(event)
            )
              return;
            pending = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              root: next.getRootNode(),
              down: event,
              up: null,
              released: false,
            };
          };
          const move = (event: PointerEvent) => {
            if (
              pending &&
              event.pointerId === pending.id &&
              Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 6
            )
              pending = null;
          };
          const cancel = () => {
            pending = null;
          };
          const up = (event: PointerEvent) => {
            if (!pending || pending.id !== event.pointerId) return;
            move(event);
            if (pending) {
              pending.up = event;
              pending.released = eligible(event);
            }
          };
          const click = (event: MouseEvent) => {
            const gesture = pending;
            pending = null;
            if (
              !actionable ||
              event.button !== 0 ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              !eligible(event)
            )
              return;
            const nonPointer = isTrustedNonPointerLabelActivation({
              trusted: event.isTrusted,
              detail: event.detail,
              ...('pointerId' in event
                ? {
                    pointerId: (event as PointerEvent).pointerId,
                    pointerType: (event as PointerEvent).pointerType,
                  }
                : {}),
            });
            if (!gesture?.released && !nonPointer) return;
            const root = next.getRootNode();
            // Preserve the originating user-activation turn for native editor
            // focus. This custom host intent is committed synchronously; only
            // cancellation observed before this listener can veto it. A later
            // listener cannot retroactively roll back the target operation.
            if (
              disposed ||
              target !== next ||
              getTarget() !== next ||
              !next.isConnected ||
              event.defaultPrevented
            )
              return;
            if (gesture && gesture.root !== root) return;
            onActivate(gesture?.released ? 'pointer' : 'accessibility');
          };
          if (kind === 'label') {
            next.addEventListener('pointerdown', down);
            next.addEventListener('pointerup', up, true);
            document.addEventListener('pointermove', move, true);
            document.addEventListener('pointerup', up, true);
            document.addEventListener('pointercancel', cancel, true);
            next.addEventListener('click', click);
            cleanListeners = () => {
              next.removeEventListener('pointerdown', down);
              next.removeEventListener('pointerup', up, true);
              document.removeEventListener('pointermove', move, true);
              document.removeEventListener('pointerup', up, true);
              document.removeEventListener('pointercancel', cancel, true);
              next.removeEventListener('click', click);
            };
          }
        }
        onViewChange();
      };
      const off = subscribeTargetChange?.(sync);
      sync();
      return {
        view,
        setActivation(enabled) {
          if (disposed) return;
          actionable = kind === 'label' && enabled;
          if (!actionable) pending = null;
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          pending = null;
          off?.();
          cleanListeners();
          for (const off of scopeOffs) off();
          scopeOffs = [];
          observedChain = [];
          target = null;
        },
      };
    },
  };
}
