/** Generic reached native ControlLabel lowering; shares the versioned host ABI without a Runtime dependency. */
export const nativeControlLabelArtifact = {
  path: '.proto-ui/interaction/control-label-v1.ts',
  kind: 'source' as const,
  contents: String.raw`// Reached native ControlLabel v1. Opaque association, target-owned naming and host input only.
// No Prototype protocol, interpreter, synthetic target click or Proto package import.
import type { NativeControlLabel, NativeControlLabelHandle, NativeControlLabelRequest, NativeControlLabelAnatomyPair } from './adapter-modules-v1';
type ControlLabelOptions = Readonly<{ naming: boolean; activation: boolean }>;
type ControlLabelActivationSource = 'pointer' | 'accessibility';
type ControlLabelHostLease = Readonly<{ view(): ControlLabelView | null; setActivation(enabled: boolean): void; dispose(): void }>;
type ControlLabelHost = Readonly<{ attach(options: { kind: 'label' | 'target'; activation: boolean; onActivate(source: ControlLabelActivationSource): void; onViewChange(): void }): ControlLabelHostLease }>;
declare const controlLabelBrand: unique symbol;
export type ControlLabelRef = Readonly<{ [controlLabelBrand]: true }>;
type ControlLabelReferenceAuthority = Readonly<{
  version: 1;
  create(): object;
  is(value: unknown): boolean;
}>;

/**
 * Compatible independently bundled implementations share nominal admission.
 * Operations never expose the WeakSet or admit an arbitrary caller object.
 * This interoperability ABI is not a security boundary.
 */
function referenceAuthority(): ControlLabelReferenceAuthority {
  const key = Symbol.for('@proto.ui/control-label/ref/v1');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  if (descriptor) {
    const service = descriptor.value as ControlLabelReferenceAuthority | undefined;
    if (
      descriptor.get ||
      descriptor.set ||
      descriptor.configurable ||
      descriptor.writable ||
      !service ||
      !Object.isFrozen(service) ||
      service.version !== 1 ||
      typeof service.create !== 'function' ||
      typeof service.is !== 'function'
    )
      throw new TypeError('[ControlLabel] incompatible same-realm reference ABI; expected v1');
    return service;
  }
  const references = new WeakSet<object>();
  const service: ControlLabelReferenceAuthority = Object.freeze({
    version: 1 as const,
    create() {
      const ref = Object.freeze({
        toJSON(): never {
          throw new TypeError(
            '[ControlLabel] opaque references cannot be serialized; use an explicit renderer association key'
          );
        },
      });
      references.add(ref);
      return ref;
    },
    is(value: unknown) {
      return typeof value === 'object' && value !== null && references.has(value);
    },
  });
  Object.defineProperty(globalThis, key, { value: service });
  return service;
}

/** Explicit pair identity, never a host ID, lookup key or serializable value. */
export function createControlLabelRef(): ControlLabelRef {
  return referenceAuthority().create() as ControlLabelRef;
}

export function isControlLabelRef(value: unknown): value is ControlLabelRef {
  return referenceAuthority().is(value);
}


export type ControlLabelView = Readonly<{
  /** Host-private identities; never author Props, State or Context values. */
  identity: object;
  scope: object;
}>;
export type ControlLabelParticipant = Readonly<{
  owner: object;
  kind: 'label' | 'target';
  ref: ControlLabelRef;
  /** Opaque source identity; the target host owns any local A11y translation. */
  semanticRef: object;
  view(): ControlLabelView | null;
  options(): ControlLabelOptions;
  name(
    label: object,
    view: ControlLabelView
  ): { dispose(): void; isActive(): boolean } | null;
  activate(isCurrent: () => boolean, source: ControlLabelActivationSource): void;
  diagnostic(code: string | null): void;
}>;
export type ControlLabelBinding = Readonly<{
  refresh(): void;
  requestActivation(source?: ControlLabelActivationSource): void;
  dispose(): void;
}>;
type ControlLabelPairAuthority = Readonly<{
  version: 1;
  bind(participant: ControlLabelParticipant): ControlLabelBinding;
}>;

type Pair = {
  label: ControlLabelParticipant;
  target: ControlLabelParticipant;
  labelView: ControlLabelView;
  targetView: ControlLabelView;
  naming: boolean;
  activation: boolean;
  nameLease: { dispose(): void; isActive(): boolean } | null;
};
type Group = {
  participants: Map<object, ControlLabelParticipant>;
  revision: number;
  pair: Pair | null;
  refreshing: boolean;
  dirty: boolean;
};
const groups = new WeakMap<ControlLabelRef, Group>();

function current(group: Group, pair: Pair): boolean {
  if (group.pair !== pair) return false;
  const label = pair.label.view();
  const target = pair.target.view();
  return (
    group.pair === pair &&
    group.participants.get(pair.label.owner) === pair.label &&
    group.participants.get(pair.target.owner) === pair.target &&
    label?.identity === pair.labelView.identity &&
    target?.identity === pair.targetView.identity &&
    label?.scope === pair.labelView.scope &&
    target?.scope === pair.targetView.scope &&
    pair.label.options().activation === pair.activation &&
    pair.label.options().naming === pair.naming
  );
}

function withdraw(group: Group): void {
  const pair = group.pair;
  group.pair = null;
  pair?.nameLease?.dispose();
}

function refresh(group: Group): void {
  if (group.refreshing) {
    group.dirty = true;
    return;
  }
  group.refreshing = true;
  try {
    do {
      group.dirty = false;
      const revision = group.revision;
      const participants = [...group.participants.values()];
      const live = participants
        .map((participant) => ({ participant, view: participant.view() }))
        .filter(
          (entry): entry is { participant: ControlLabelParticipant; view: ControlLabelView } =>
            entry.view !== null
        );
      if (revision !== group.revision) {
        group.dirty = true;
        continue;
      }
      const labels = live.filter((entry) => entry.participant.kind === 'label');
      const targets = live.filter((entry) => entry.participant.kind === 'target');
      let code: string | null =
        labels.length > 1 || targets.length > 1
          ? 'duplicate-binding'
          : labels.length !== 1 || targets.length !== 1
            ? 'missing-binding'
            : labels[0]!.view.scope !== targets[0]!.view.scope
              ? 'foreign-tree-scope'
              : null;
      if (code) {
        withdraw(group);
      } else {
        const label = labels[0]!;
        const target = targets[0]!;
        const options = label.participant.options();
        const previous = group.pair;
        if (
          !previous ||
          !current(group, previous) ||
          previous.label !== label.participant ||
          previous.target !== target.participant ||
          (previous.naming && !previous.nameLease?.isActive())
        ) {
          withdraw(group);
          if (revision !== group.revision) {
            group.dirty = true;
            continue;
          }
          const pair: Pair = {
            label: label.participant,
            target: target.participant,
            labelView: label.view,
            targetView: target.view,
            naming: options.naming,
            activation: options.activation,
            nameLease: null,
          };
          group.pair = pair;
          try {
            if (options.naming)
              pair.nameLease = target.participant.name(label.participant.semanticRef, label.view);
          } catch (error) {
            if (group.pair === pair) withdraw(group);
            throw error;
          }
          if (!current(group, pair)) {
            withdraw(group);
            group.dirty = true;
            continue;
          }
        }
        if (group.pair?.naming && !group.pair.nameLease?.isActive()) code = 'name-conflict';
      }
      for (const participant of participants) participant.diagnostic(code);
    } while (group.dirty);
  } finally {
    group.refreshing = false;
  }
}

/** One lease per logical owner. An obsolete release never withdraws its successor. */
function bindParticipant(participant: ControlLabelParticipant): ControlLabelBinding {
  if (!isControlLabelRef(participant.ref))
    throw new TypeError('[ControlLabel] invalid opaque association reference');
  let group = groups.get(participant.ref);
  if (!group) {
    group = { participants: new Map(), revision: 0, pair: null, refreshing: false, dirty: false };
    groups.set(participant.ref, group);
  }
  const ownGroup = group;
  ownGroup.participants.set(participant.owner, participant);
  ownGroup.revision += 1;
  try {
    refresh(ownGroup);
  } catch (error) {
    if (ownGroup.participants.get(participant.owner) === participant) {
      ownGroup.participants.delete(participant.owner);
      ownGroup.revision += 1;
      try {
        refresh(ownGroup);
      } catch {
        /* Preserve the first binding failure. */
      }
    }
    throw error;
  }
  return {
    refresh() {
      if (ownGroup.participants.get(participant.owner) === participant) refresh(ownGroup);
    },
    requestActivation(source = 'pointer') {
      if (
        participant.kind !== 'label' ||
        ownGroup.participants.get(participant.owner) !== participant
      )
        return;
      refresh(ownGroup);
      const pair = ownGroup.pair;
      if (!pair || pair.label !== participant || !pair.activation || !current(ownGroup, pair))
        return;
      pair.target.activate(() => current(ownGroup, pair), source);
    },
    dispose() {
      if (ownGroup.participants.get(participant.owner) !== participant) return;
      ownGroup.participants.delete(participant.owner);
      ownGroup.revision += 1;
      refresh(ownGroup);
    },
  };
}

/** One same-realm domain includes runtime and separately emitted native graphs. */
export function bindControlLabel(participant: ControlLabelParticipant): ControlLabelBinding {
  const key = Symbol.for('@proto.ui/control-label/pairs/v1');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  if (descriptor) {
    const service = descriptor.value as ControlLabelPairAuthority | undefined;
    if (
      descriptor.get ||
      descriptor.set ||
      descriptor.configurable ||
      descriptor.writable ||
      !service ||
      !Object.isFrozen(service) ||
      service.version !== 1 ||
      typeof service.bind !== 'function'
    )
      throw new TypeError('[ControlLabel] incompatible same-realm pairing ABI; expected v1');
    return service.bind(participant);
  }
  const service: ControlLabelPairAuthority = Object.freeze({
    version: 1 as const,
    bind: bindParticipant,
  });
  Object.defineProperty(globalThis, key, { value: service });
  return service.bind(participant);
}

export type GeneratedIdLease = Readonly<{ dispose(): void }>;

type GeneratedIdAuthority = Readonly<{
  version: 1;
  own(element: Element, id: string, baseline: string | null): GeneratedIdLease;
  retain(element: Element, id: string): GeneratedIdLease | null;
}>;

/** Shared physical ID lifetime only; it neither resolves nor admits semantic refs. */
function generatedIdAuthority(): GeneratedIdAuthority {
  const key = Symbol.for('@proto.ui/a11y/generated-id/v1');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  if (descriptor) {
    const service = descriptor.value as GeneratedIdAuthority | undefined;
    if (
      descriptor.get ||
      descriptor.set ||
      descriptor.configurable ||
      descriptor.writable ||
      !service ||
      !Object.isFrozen(service) ||
      service.version !== 1 ||
      typeof service.own !== 'function' ||
      typeof service.retain !== 'function'
    )
      throw new TypeError('[A11y] incompatible same-realm generated-ID ABI; expected v1');
    return service;
  }
  type Entry = { baseline: string | null; owners: Set<object> };
  const entries = new WeakMap<Element, Map<string, Entry>>();
  const lease = (element: Element, id: string, entry: Entry): GeneratedIdLease => {
    const owner = {};
    entry.owners.add(owner);
    return Object.freeze({
      dispose() {
        if (!entry.owners.delete(owner) || entry.owners.size) return;
        const byId = entries.get(element);
        if (byId?.get(id) !== entry) return;
        // Clear ownership before host writes can reenter with a successor.
        byId.delete(id);
        if (!byId.size) entries.delete(element);
        if (element.getAttribute('id') !== id) return;
        try {
          if (entry.baseline === null) element.removeAttribute('id');
          else element.setAttribute('id', entry.baseline);
        } catch (error) {
          // Preserve generated provenance for a later acquisition if the host
          // refused cleanup. Do not replace a successor's independently installed receipt.
          try {
            if (
              element.getAttribute('id') === id &&
              !entry.owners.size &&
              !entries.get(element)?.has(id)
            ) {
              let retry = entries.get(element);
              if (!retry) entries.set(element, (retry = new Map()));
              retry.set(id, entry);
            }
          } catch {
            /* Preserve the original host cleanup failure. */
          }
          throw error;
        }
      },
    });
  };
  const service: GeneratedIdAuthority = Object.freeze({
    version: 1 as const,
    own(element: Element, id: string, baseline: string | null) {
      const current = element.getAttribute('id');
      if (!id || (current !== id && current !== baseline))
        throw new Error('[A11y] generated-ID ownership requires the current physical baseline');
      let byId = entries.get(element);
      if (!byId) entries.set(element, (byId = new Map()));
      let entry = byId.get(id);
      if (!entry) byId.set(id, (entry = { baseline, owners: new Set() }));
      // Publish the receipt before the physical write: a synchronous host reaction
      // may install a successor which must retain this generated ID, never mistake it for authored data.
      const receipt = lease(element, id, entry);
      try {
        if (current !== id) element.setAttribute('id', id);
        if (element.getAttribute('id') !== id)
          throw new Error('[A11y] generated-ID write was superseded by the host');
        return receipt;
      } catch (error) {
        try {
          receipt.dispose();
        } catch {
          /* The acquisition failure remains primary. */
        }
        throw error;
      }
    },
    retain(element: Element, id: string) {
      if (!id || element.getAttribute('id') !== id) return null;
      const entry = entries.get(element)?.get(id);
      return entry ? lease(element, id, entry) : null;
    },
  });
  Object.defineProperty(globalThis, key, { value: service });
  return service;
}

export function ownGeneratedId(
  element: Element,
  id: string,
  baseline: string | null
): GeneratedIdLease {
  return generatedIdAuthority().own(element, id, baseline);
}

export function retainGeneratedId(element: Element, id: string): GeneratedIdLease | null {
  return generatedIdAuthority().retain(element, id);
}


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
type ScopeMember = { anchor: Node; notify(): void; nameId?: () => string | null };
type ScopeObserver = { observer: MutationObserver; members: Set<ScopeMember> };
const observers = new WeakMap<Node, ScopeObserver>();

/** One observer per actual tree scope; no document-wide scan per participant. */
function observeScope(scope: Node, anchor: Node, notify: () => void, nameId?: () => string | null): () => void {
  const document = scope.nodeType === 9 ? (scope as Document) : scope.ownerDocument;
  const Observer = document?.defaultView?.MutationObserver;
  if (!Observer) return () => {};
  let entry = observers.get(scope);
  if (!entry) {
    const members = new Set<ScopeMember>();
    const observer = new Observer((mutations) => {
      // Index changed IDs once per scope batch. Naming participants recheck only
      // their current ID; containment-only subscriptions keep their narrow path.
      const changedIds = new Set<string>();
      const collectIds = (node: Node) => {
        if (node.nodeType !== 1) return;
        const element = node as Element, ownId = element.getAttribute('id');
        if (ownId) changedIds.add(ownId);
        for (const descendant of element.querySelectorAll('[id]')) { const id = descendant.getAttribute('id'); if (id) changedIds.add(id); }
      };
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'id') {
          if (mutation.oldValue) changedIds.add(mutation.oldValue);
          const current = (mutation.target as Element).getAttribute('id'); if (current) changedIds.add(current);
        } else if (mutation.type === 'childList') for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) collectIds(node);
      }
      for (const member of [...members]) {
        const name = member.nameId?.();
        const affected = Boolean(name && changedIds.has(name)) || mutations.some((mutation) => {
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
      attributeOldValue: true,
      attributeFilter: ['id', 'aria-label', 'aria-labelledby'],
    });
    entry = { observer, members };
    observers.set(scope, entry);
  }
  const ownEntry = entry;
  const member = { anchor, notify, nameId };
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
  // One document-wide click sequence number lets a gesture receipt verify that
  // the click it is lent to is the first click after its release, without
  // wall-clock expiry: a touch tap's synthesized click can legally land in a
  // later task, while a synthetic click after an intercepted native one must
  // stay rejected.
  const clickCounts = new WeakMap<Document, { count: number; last: MouseEvent | null }>();
  const documentClicks = (document: Document) => {
    let entry = clickCounts.get(document);
    if (!entry) clickCounts.set(document, (entry = { count: 0, last: null }));
    return entry;
  };
  let clicks = 0;
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
        clicksAtRelease: number;
      };
      let pending: PointerReceipt | null = null;
      let capturedClick: {
        event: MouseEvent;
        clicksBefore: number;
        gesture: PointerReceipt | null;
        cancel(): void;
      } | null = null;
      const clearCapturedClick = () => {
        capturedClick?.cancel();
        capturedClick = null;
      };
      const clearPending = () => {
        pending = null;
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
              clicksAtRelease: 0,
            };
          };
          const countClick = (event: MouseEvent) => {
            const entry = documentClicks(document);
            if (entry.last === event) return;
            entry.last = event;
            entry.count += 1;
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
              pending.clicksAtRelease = documentClicks(document).count;
            }
          };
          const captureClick = (event: MouseEvent) => {
            countClick(event);
            clearCapturedClick();
            const receipt = {
              event,
              clicksBefore: documentClicks(document).count,
              gesture: pending,
              cancel: () => {},
            };
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
              receipt !== null &&
              gesture != null &&
              gesture.released &&
              event.isTrusted === gesture.down.isTrusted &&
              event.isTrusted === gesture.up?.isTrusted &&
              receipt.clicksBefore - gesture.clicksAtRelease === 1;
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
            document.addEventListener('click', countClick, true);
            next.addEventListener('click', captureClick, true);
            next.addEventListener('click', click);
            cleanListeners = () => {
              next.removeEventListener('pointerdown', down);
              next.removeEventListener('pointerup', up, true);
              document.removeEventListener('pointermove', move, true);
              document.removeEventListener('pointerup', up, true);
              document.removeEventListener('pointercancel', cancel, true);
              document.removeEventListener('click', countClick, true);
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

export type NativeControlLabelInput = Readonly<{ controlLabel?: object | null }>;

/** Association is a separate identity channel. It is never a resolved Prop. */
export function validateNativeInstanceAssociations(input: unknown): Readonly<{ controlLabel: ControlLabelRef | null }> {
  if (input === undefined) return Object.freeze({ controlLabel: null });
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    throw new TypeError('[ControlLabel] instanceAssociations must be a plain object');
  if (Object.getOwnPropertySymbols(input).length || Object.getOwnPropertyNames(input).some(key => key !== 'controlLabel'))
    throw new TypeError('[ControlLabel] unknown instance association key');
  const ref = Object.hasOwn(input, 'controlLabel') ? (input as { controlLabel?: unknown }).controlLabel : null;
  if (ref != null && !isControlLabelRef(ref)) throw new TypeError('[ControlLabel] invalid opaque association reference');
  return Object.freeze({ controlLabel: ref ?? null });
}

type NativeNameLease = Readonly<{ dispose(): void; isActive(): boolean }>;
let nextLabelId = 1;
function idMatches(scope: Node, id: string): Element[] {
  if (!('querySelectorAll' in scope)) return [];
  const escaped = id.replace(/[\0-\x1f\x7f"\\]/g, value => '\\' + value.charCodeAt(0).toString(16) + ' ');
  return Array.from((scope as Document | ShadowRoot).querySelectorAll('[id="' + escaped + '"]'));
}
function idTokens(value: string | null): string[] { return value?.trim().split(/\s+/).filter(Boolean) ?? []; }

/** Target-owned derived A11y contribution, backed by the real rendered source. */
function claimNativeControlLabelName(options: { getRoot(): HTMLElement | null; hasAuthoredName(): boolean; beginNameProjection(): () => void }, source: ControlLabelView): NativeNameLease | null {
  const target = options.getRoot(), label = source.identity as HTMLElement;
  if (!target?.isConnected || !label || label.nodeType !== 1 || !label.isConnected || !label.ownerDocument ||
    label.ownerDocument !== target.ownerDocument || label.getRootNode() !== source.scope || target.getRootNode() !== source.scope)
    return null;
  if (options.hasAuthoredName() || target.getAttribute('aria-label')?.trim() || idTokens(target.getAttribute('aria-labelledby')).length) return null;
  const baselineId = label.getAttribute('id'), baselineName = target.getAttribute('aria-labelledby');
  let id = baselineId?.trim() ? baselineId : '', idLease: GeneratedIdLease | null = null;
  let live = true, nameInstalled = false;
  let endProjection: (() => void) | null = null;
  const release = () => {
    if (!live) return;
    live = false;
    let failed = false, failure: unknown;
    try {
      if (nameInstalled) {
        const current = target.getAttribute('aria-labelledby'), tokens = idTokens(current);
        if (tokens.includes(id)) {
          const remaining = tokens.filter(token => token !== id);
          if (remaining.length) target.setAttribute('aria-labelledby', remaining.join(' '));
          else if (baselineName === null) target.removeAttribute('aria-labelledby');
          else target.setAttribute('aria-labelledby', baselineName);
        }
      }
    } catch (error) { failed = true; failure = error; }
    try { const end = endProjection; endProjection = null; end?.(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    try { idLease?.dispose(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
  };
  try {
    if (id) {
      const matches = idMatches(label.getRootNode(), id);
      if (matches.length !== 1 || matches[0] !== label) return null;
      idLease = retainGeneratedId(label, id);
    } else {
      do { id = 'pui-control-label-' + nextLabelId++; } while (idMatches(label.getRootNode(), id).length);
      idLease = ownGeneratedId(label, id, baselineId);
    }
    endProjection = options.beginNameProjection();
    // Host writes can reenter the owner; recheck before publishing an IDREF.
    if (options.getRoot() !== target || !target.isConnected || !label.isConnected || label.getRootNode() !== source.scope ||
      target.getRootNode() !== source.scope || options.hasAuthoredName() || target.getAttribute('aria-label')?.trim() ||
      idTokens(target.getAttribute('aria-labelledby')).length || label.getAttribute('id') !== id) { release(); return null; }
    nameInstalled = true;
    target.setAttribute('aria-labelledby', id);
    return Object.freeze({
      isActive() {
        const tokens = idTokens(target.getAttribute('aria-labelledby'));
        return live && options.getRoot() === target && target.isConnected && label.isConnected &&
          target.getRootNode() === source.scope && label.getRootNode() === source.scope &&
          label.getAttribute('id') === id && !options.hasAuthoredName() && !target.getAttribute('aria-label')?.trim() &&
          tokens.length === 1 && tokens[0] === id && idMatches(label.getRootNode(), id).length === 1;
      },
      dispose: release,
    });
  } catch (error) { try { release(); } catch {} throw error; }
}

const anatomyPairs = new WeakMap<object, WeakMap<object, Map<string, { ref: ControlLabelRef; count: number }>>>();
function acquireNativeAnatomyPair(pair: NativeControlLabelAnatomyPair, domain: object) {
  let domains = anatomyPairs.get(pair.family);
  if (!domains) anatomyPairs.set(pair.family, domains = new WeakMap());
  let pairs = domains.get(domain);
  if (!pairs) domains.set(domain, pairs = new Map());
  const key = JSON.stringify([pair.labelRole, pair.targetRole]);
  let entry = pairs.get(key);
  if (!entry) pairs.set(key, entry = { ref: createControlLabelRef(), count: 0 });
  entry.count++;
  let active = true;
  return { ref: entry.ref, dispose() { if (!active) return; active = false; if (--entry!.count === 0 && pairs!.get(key) === entry) pairs!.delete(key); } };
}

export function createNativeControlLabel<Run>(options: {
  identity: object;
  ensureSetup(operation: string): void;
  isAlive(): boolean;
  isSetupComplete(): boolean;
  isReady?(): boolean;
  getRoot(): HTMLElement | null;
  getAssociations(): unknown;
  getRun(): Run;
  invoke<T>(callback: () => T): T;
  hasAuthoredName(): boolean;
  beginNameProjection(): () => void;
  resolveAnatomy(pair: NativeControlLabelAnatomyPair, kind: 'label' | 'target'): object | null;
  subscribeAnatomy(callback: () => void): () => void;
}): { facade: NativeControlLabel<Run>; refresh(): void; mount(): void; unmount(): void; dispose(): void } {
  let kind: 'label' | 'target' | null = null, activate: ((run: Run, request: NativeControlLabelRequest) => void) | null = null;
  let settings: ControlLabelOptions = { naming: true, activation: false };
  let ref: ControlLabelRef | null = null, binding: ControlLabelBinding | null = null, host: ControlLabelHostLease | null = null;
  let physicalRoot: HTMLElement | null = null, mounted = false, disposed = false, generation = 0;
  let diagnostic: string | null = null;
  let sourceWatch: (() => void) | null = null;
  let pair: NativeControlLabelAnatomyPair | null = null, anatomyDomain: object | null = null;
  let anatomyLease: ReturnType<typeof acquireNativeAnatomyPair> | null = null, anatomyOff: (() => void) | null = null;
  const alive = () => { if (disposed || !options.isAlive()) throw new Error('[ControlLabel] invalid after terminal disposal'); };
  const setDiagnostic = (code: string | null) => {
    if (diagnostic === code) return;
    diagnostic = code;
    if (code && code !== 'missing-binding' && code !== 'missing-anatomy-domain') console.warn('[ControlLabel] ' + code);
  };
  function release() {
    const retired = ++generation, oldBinding = binding, oldHost = host, oldSourceWatch = sourceWatch;
    binding = null; host = null; physicalRoot = null; sourceWatch = null;
    let failed = false, failure: unknown;
    try { oldSourceWatch?.(); } catch (error) { failed = true; failure = error; }
    try { oldBinding?.dispose(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    try { oldHost?.dispose(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
    return retired;
  }
  function refresh() {
    if (disposed || !options.isAlive() || !options.isSetupComplete()) return;
    const association = validateNativeInstanceAssociations(options.getAssociations());
    if (association.controlLabel && !kind) throw new Error('[ControlLabel] this Prototype has not declared Label or target participation');
    if (pair && association.controlLabel) throw new Error('[ControlLabel] explicit and anatomy association modes are mutually exclusive');
    let nextRef = association.controlLabel;
    if (pair && kind) {
      const domain = options.resolveAnatomy(pair, kind);
      if (domain !== anatomyDomain || domain && !anatomyLease) {
        const epoch = release();
        if (disposed || epoch !== generation) return;
        const previous = anatomyLease; anatomyLease = null; anatomyDomain = domain; ref = null;
        previous?.dispose();
        if (disposed || epoch !== generation) return;
        if (domain) anatomyLease = acquireNativeAnatomyPair(pair, domain);
      }
      nextRef = anatomyLease?.ref ?? null;
      if (!domain) setDiagnostic('missing-anatomy-domain');
    }
    const nextRoot = mounted ? options.getRoot() : null;
    if (ref !== nextRef || physicalRoot !== nextRoot && (binding || host)) {
      const epoch = release();
      if (disposed || epoch !== generation) return;
      ref = nextRef;
    }
    if (!kind || !ref || !mounted || !nextRoot || !(options.isReady?.() ?? true)) {
      if (binding || host) release();
      if (!pair || ref) setDiagnostic(ref ? 'missing-binding' : null);
      return;
    }
    if (binding) { binding.refresh(); return; }
    const epoch = ++generation;
    try {
      const nextHost = createWebControlLabelHost(() => mounted && !disposed && options.isAlive() && (options.isReady?.() ?? true) ? options.getRoot() : null).attach({
        kind, activation: kind === 'label' && settings.activation,
        onActivate(source) { if (epoch === generation && !disposed) binding?.requestActivation(source); },
        onViewChange() { if (epoch === generation && !disposed) binding?.refresh(); },
      });
      if (disposed || epoch !== generation) { nextHost.dispose(); return; }
      host = nextHost; physicalRoot = nextRoot;
      const nextBinding = bindControlLabel({
        owner: options.identity, kind, ref, semanticRef: options.identity,
        view: () => epoch === generation && mounted && !disposed && options.isAlive() && (options.isReady?.() ?? true) ? nextHost.view() : null,
        options: () => settings,
        name: (_identity, view) => {
          const previous = sourceWatch; sourceWatch = null; previous?.();
          const element = view.identity as Element;
          let watching = true, stop: (() => void) | null = null;
          const retire = () => { if (!watching) return; watching = false; if (sourceWatch === retire) sourceWatch = null; stop?.(); };
          if (element?.nodeType === 1) stop = observeScope(view.scope as Node, element,
            () => { if (epoch === generation && !disposed) binding?.refresh(); }, () => element.getAttribute('id'));
          sourceWatch = retire;
          let naming: NativeNameLease | null;
          try { naming = claimNativeControlLabelName(options, view); }
          catch (error) { try { retire(); } catch {} throw error; }
          // An inactive lease retains only conflict recovery observation. Pair
          // withdrawal retires it just like a successfully projected name.
          return Object.freeze({
            isActive: () => naming?.isActive() ?? false,
            dispose() {
              let failed = false, failure: unknown;
              try { retire(); } catch (error) { failed = true; failure = error; }
              try { naming?.dispose(); } catch (error) { if (!failed) { failed = true; failure = error; } }
              if (failed) throw failure;
            },
          });
        },
        activate(isCurrent, source) {
          if (!isCurrent() || !activate || epoch !== generation || disposed) return;
          options.invoke(() => {
            if (!isCurrent() || !activate || epoch !== generation || disposed || !mounted || !options.isAlive()) return;
            activate(options.getRun(), Object.freeze({ source, isCurrent }));
          });
        },
        diagnostic(code) { if (epoch === generation && !disposed) setDiagnostic(code); },
      });
      if (disposed || epoch !== generation) nextBinding.dispose();
      else binding = nextBinding;
    } catch (error) { if (epoch === generation && !disposed) { if (!pair) ref = null; try { release(); } catch {} } throw error; }
  }
  function declare(next: 'label' | 'target', callback: typeof activate, anatomy?: NativeControlLabelAnatomyPair): NativeControlLabelHandle {
    alive(); options.ensureSetup('controlLabel.declare');
    if (kind) throw new Error('[ControlLabel] one subject or target declaration per instance');
    if (next === 'target' && typeof callback !== 'function') throw new TypeError('[ControlLabel] target requires an activation callback');
    if (anatomy && (!anatomy.family?.roles || typeof anatomy.labelRole !== 'string' || typeof anatomy.targetRole !== 'string' ||
      anatomy.labelRole === anatomy.targetRole || !Object.hasOwn(anatomy.family.roles, anatomy.labelRole) || !Object.hasOwn(anatomy.family.roles, anatomy.targetRole) ||
      Reflect.ownKeys(anatomy).some(key => !['family', 'labelRole', 'targetRole'].includes(String(key)))))
      throw new TypeError('[ControlLabel] anatomy pair requires one declared family and distinct declared label/target roles');
    kind = next; activate = callback; pair = anatomy ? Object.freeze({ ...anatomy }) : null;
    if (pair) anatomyOff = options.subscribeAnatomy(refresh);
    return Object.freeze({ sync(nextSettings: ControlLabelOptions) {
      alive();
      if (!nextSettings || typeof nextSettings.naming !== 'boolean' || typeof nextSettings.activation !== 'boolean') throw new TypeError('[ControlLabel] naming and activation require explicit booleans');
      if (settings.naming === nextSettings.naming && settings.activation === nextSettings.activation) return;
      settings = Object.freeze({ naming: nextSettings.naming, activation: nextSettings.activation });
      host?.setActivation(kind === 'label' && settings.activation); binding?.refresh();
    } });
  }
  return {
    facade: Object.freeze({ label: (pair?: NativeControlLabelAnatomyPair) => declare('label', null, pair), target: (callback: (run: Run, request: NativeControlLabelRequest) => void, pair?: NativeControlLabelAnatomyPair) => declare('target', callback, pair) }),
    refresh,
    mount() { alive(); mounted = true; refresh(); },
    unmount() { if (disposed) return; mounted = false; release(); },
    dispose() {
      if (disposed) return;
      disposed = true; mounted = false; activate = null; ref = null;
      const ownOff = anatomyOff; anatomyOff = null;
      let failed = false, failure: unknown;
      // Capture each lease before clearing so a failing release cannot strand another.
      const ownAnatomy = anatomyLease; anatomyLease = null; anatomyDomain = null;
      for (const run of [release, () => ownOff?.(), () => ownAnatomy?.dispose()]) try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } }
      if (failed) throw failure;
    },
  };
}
`,
};
