import type { ControlLabelHost } from './caps';

// Native interactive content plus authored editing/focus intent. Conditional
// media stay passive without controls; readonly/disabled controls still own
// their input and must not activate an unrelated associated target.
const INTERACTIVE =
  'a[href],area[href],button,input:not([type="hidden" i]),textarea,select,summary,details,embed,iframe,label,audio[controls],video[controls],img[usemap],img[controls],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])';
// ARIA's widget category also contains passive progressbar and tabpanel roles.
// Only input/action/selection widgets belong here; an ordinary meter, separator
// or content container is not turned into an interaction boundary by its role.
const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'grid',
  'gridcell',
  'link',
  'listbox',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'radiogroup',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'textbox',
  'tree',
  'treegrid',
  'treeitem',
]);
function isInteractive(element: Element): boolean {
  return (
    element.matches(INTERACTIVE) ||
    (element
      .getAttribute('role')
      ?.split(/\s+/)
      .some((role) => INTERACTIVE_ROLES.has(role)) ??
      false)
  );
}
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

type DetachedMember = { element: HTMLElement; notify(): void };
type DetachedTracker = { members: Set<DetachedMember>; frame: number | null };
const detachedTrackers = new WeakMap<Window, DetachedTracker>();

/** Only live, previously connected views enter this shared discovery loop.
 * An unknown (including closed) ShadowRoot cannot be observed in advance. */
function observeDetached(element: HTMLElement, notify: () => void): () => void {
  const window = element.ownerDocument.defaultView;
  if (!window?.requestAnimationFrame) return () => {};
  let entry = detachedTrackers.get(window);
  if (!entry) {
    entry = { members: new Set(), frame: null };
    detachedTrackers.set(window, entry);
  }
  const ownEntry = entry;
  const member = { element, notify };
  const retire = () => {
    if (ownEntry.frame !== null) window.cancelAnimationFrame(ownEntry.frame);
    ownEntry.frame = null;
    if (detachedTrackers.get(window) === ownEntry) detachedTrackers.delete(window);
  };
  const schedule = () => {
    if (
      detachedTrackers.get(window) !== ownEntry ||
      ownEntry.frame !== null ||
      !ownEntry.members.size
    )
      return;
    ownEntry.frame = window.requestAnimationFrame(() => {
      if (detachedTrackers.get(window) !== ownEntry) return;
      ownEntry.frame = null;
      try {
        for (const current of [...ownEntry.members]) {
          if (!ownEntry.members.has(current) || !current.element.isConnected) continue;
          ownEntry.members.delete(current);
          current.notify();
        }
      } finally {
        // Notification may dispose this tracker and install a successor.
        if (!ownEntry.members.size) retire();
        else schedule();
      }
    });
  };
  ownEntry.members.add(member);
  schedule();
  return () => {
    ownEntry.members.delete(member);
    if (!ownEntry.members.size) retire();
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
      let lastConnected: HTMLElement | null = null;
      let detachedOff: (() => void) | null = null;
      let cleanListeners = () => {};
      type PointerReceipt = {
        id: number;
        x: number;
        y: number;
        root: Node;
        down: PointerEvent;
        up: PointerEvent | null;
        released: boolean;
      };
      let pending: PointerReceipt | null = null;
      let releaseExpiry: (() => void) | null = null;
      let capturedClick: {
        event: MouseEvent;
        gesture: PointerReceipt | null;
        cancel(): void;
      } | null = null;
      const clearCapturedClick = () => {
        capturedClick?.cancel();
        capturedClick = null;
      };
      const clearPending = () => {
        pending = null;
        releaseExpiry?.();
        releaseExpiry = null;
      };
      const view = () => {
        const current = getTarget();
        return !disposed && current?.isConnected
          ? { identity: current, scope: current.getRootNode() }
          : null;
      };
      const observeCurrentScopes = (element: HTMLElement | null) => {
        if (element && !element.isConnected && element === lastConnected) {
          // Keep the previous observers for same-scope reinsertion, plus one
          // shared Window frame for movement into an otherwise unknown scope.
          detachedOff ??= observeDetached(element, sync);
          return;
        }
        const off = detachedOff;
        detachedOff = null;
        off?.();
        lastConnected = element?.isConnected ? element : null;
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
        clearPending();
        clearCapturedClick();
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
              if (node instanceof document.defaultView!.Element && isInteractive(node))
                return false;
            }
            return false;
          };
          const down = (event: PointerEvent) => {
            clearPending();
            clearCapturedClick();
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
              clearPending();
          };
          const cancel = () => {
            clearPending();
            clearCapturedClick();
          };
          const up = (event: PointerEvent) => {
            if (!pending || pending.id !== event.pointerId) return;
            move(event);
            if (pending) {
              pending.up = event;
              pending.released = eligible(event);
              // Native click follows this release in its activation turn. If an
              // earlier listener swallows it, no later task may borrow the receipt.
              releaseExpiry?.();
              const released = pending;
              const timer = setTimeout(() => {
                if (pending === released) pending = null;
                if (releaseExpiry === cancelExpiry) releaseExpiry = null;
              }, 0);
              const cancelExpiry = () => clearTimeout(timer);
              releaseExpiry = cancelExpiry;
            }
          };
          const captureClick = (event: MouseEvent) => {
            clearCapturedClick();
            const receipt = { event, gesture: pending, cancel: () => {} };
            clearPending();
            capturedClick = receipt;
            // Use a task checkpoint: native listener boundaries may drain
            // microtasks before this event reaches its bubble listener.
            const timer = setTimeout(() => {
              if (capturedClick === receipt) capturedClick = null;
            }, 0);
            receipt.cancel = () => clearTimeout(timer);
          };
          const click = (event: MouseEvent) => {
            const receipt = capturedClick?.event === event ? capturedClick : null;
            const gesture = receipt?.gesture;
            if (receipt) clearCapturedClick();
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
            const pointer =
              gesture?.released &&
              event.isTrusted === gesture.down.isTrusted &&
              event.isTrusted === gesture.up?.isTrusted;
            if (!pointer && !nonPointer) return;
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
            onActivate(pointer ? 'pointer' : 'accessibility');
          };
          if (kind === 'label') {
            next.addEventListener('pointerdown', down);
            next.addEventListener('pointerup', up, true);
            document.addEventListener('pointermove', move, true);
            document.addEventListener('pointerup', up, true);
            document.addEventListener('pointercancel', cancel, true);
            next.addEventListener('click', captureClick, true);
            next.addEventListener('click', click);
            cleanListeners = () => {
              next.removeEventListener('pointerdown', down);
              next.removeEventListener('pointerup', up, true);
              document.removeEventListener('pointermove', move, true);
              document.removeEventListener('pointerup', up, true);
              document.removeEventListener('pointercancel', cancel, true);
              next.removeEventListener('click', captureClick, true);
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
          if (!actionable) {
            clearPending();
            clearCapturedClick();
          }
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          clearPending();
          clearCapturedClick();
          off?.();
          cleanListeners();
          const stopDetached = detachedOff;
          detachedOff = null;
          stopDetached?.();
          lastConnected = null;
          for (const off of scopeOffs) off();
          scopeOffs = [];
          observedChain = [];
          target = null;
        },
      };
    },
  };
}
