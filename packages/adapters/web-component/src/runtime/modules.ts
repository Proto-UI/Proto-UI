import {
  cancelWebEventDefaultAction,
  createCapsWiring,
  createWebMoveGestureHost,
  type LogicalInstanceToken,
} from '@proto.ui/adapter-base';
import {
  HOST_ELEMENT_CAP,
  type EffectsPort,
  type FocusEntryConfig,
  type FocusRequestOptions,
  type ScrollProjectionPreference,
} from '@proto.ui/core';
import {
  createDomOrderObserver,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_MERGE_GROUP_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { A11Y_PROJECT_CAP, createWebA11yProjector } from '@proto.ui/module-a11y';
import { createWebBoundaryHostBridge, BOUNDARY_HOST_BRIDGE_CAP } from '@proto.ui/module-boundary';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import {
  EVENT_CANCEL_DEFAULT_ACTION_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_GLOBAL_INPUT_SCOPE_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import {
  createExposeStateWebNameMap,
  createExposeStateWebNativeVariantPolicy,
  EXPOSE_STATE_WEB_MAP_CAP,
  EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
  EXPOSE_STATE_WEB_MODE_CAP,
} from '@proto.ui/module-expose-state-web';
import {
  FOCUS_BLUR_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_IS_NATIVELY_FOCUSABLE_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_SET_ENTRY_FOCUSABLE_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
  FOCUS_TARGET_READY_CAP,
  FOCUS_SAMPLE_SCOPE_TARGETS_CAP,
} from '@proto.ui/module-focus';
import {
  createWebHitParticipationHostBridge,
  HIT_PARTICIPATION_HOST_BRIDGE_CAP,
} from '@proto.ui/module-hit-participation';
import {
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
  OVERLAY_MODAL_CAP,
  createWebOverlayModal,
  type OverlayModal,
  type OverlayLayerScheduler,
} from '@proto.ui/module-overlay';
import {
  ANCHORED_POSITION_HOST_CAP,
  createFloatingUiAnchoredPositionHost,
} from '@proto.ui/module-positioning';
import {
  createWebTextControlHost,
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
  type WebTextControl,
} from '@proto.ui/module-text-control';
import {
  createWebImageViewHost,
  IMAGE_VIEW_HOST_CAP,
  IMAGE_VIEW_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-image-view';
import { type RawPropsSource, RAW_PROPS_SOURCE_CAP } from '@proto.ui/module-props';
import { RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP } from '@proto.ui/module-rule-expose-state-web';
import {
  RULE_META_GET_CAP,
  RULE_META_COLOR_SCHEME_SOURCE_CAP,
  type ColorSchemeInvalidationSource,
} from '@proto.ui/module-rule-meta';
import { createWebScrollSurfaceHost, SCROLL_SURFACE_HOST_CAP } from '@proto.ui/module-scroll';
import { type PropsBaseType } from '@proto.ui/types';
import { createWebComponentPortalMount } from '../portal-mount';
import {
  composedParentElement,
  deepestActiveElement,
  observeWebComponentRadioFocus,
  sampleWebComponentScopeTargets,
} from '../focus-scope-targets';

import {
  getLogicalEventTarget,
  getLogicalParent,
  getLogicalPrototype,
  getLogicalRoot,
  getLogicalTriggerSurfaceRoot,
  releaseTriggerSurface,
  mergeLogicalTriggerGroup,
  subscribeLogicalTriggerSurface,
} from '../platform/instance-tree';

const TRIGGER_OWNER_MARK = Symbol.for('@proto.ui/as-trigger/confirm-owner');
const WEB_COMPONENT_TEXT_CONTROL_HOST_OPTIONS = Object.freeze({ stopPropagation: true });
const WEB_COMPONENT_IMAGE_VIEW_HOST_OPTIONS = Object.freeze({ stopPropagation: true });

// attachShadow() produces no MutationObserver record, so an open root that an
// already-upgraded descendant attaches after observation started is invisible
// to DOM observation and to upgrade watches alike. While at least one caller
// observes a region, wrap the window's attachShadow once (reference-counted)
// and report late open roots to every subscriber; the original method is
// restored when the last subscriber unsubscribes.
type LateAttachShadowSubscriber = {
  contains(host: Element): boolean;
  onLateRoot(): void;
};
const lateAttachShadowWatches = new WeakMap<
  Window,
  {
    count: number;
    original: Element['attachShadow'];
    patched: Element['attachShadow'];
    subscribers: Set<LateAttachShadowSubscriber>;
  }
>();

function watchLateAttachShadow(
  view: (Window & typeof globalThis) | null,
  contains: (host: Element) => boolean,
  onLateRoot: () => void
): (() => void) | null {
  const ElementCtor = view?.Element;
  if (!ElementCtor) return null;
  let watch = lateAttachShadowWatches.get(view as Window);
  if (!watch) {
    const subscribers = new Set<LateAttachShadowSubscriber>();
    const original = ElementCtor.prototype.attachShadow;
    const patched = function (this: Element, init: ShadowRootInit): ShadowRoot {
      const root = original.call(this, init);
      // Defer past the attaching turn so callers that populate the root
      // synchronously (e.g. connectedCallback) are sampled with content.
      if (root.mode === 'open' && subscribers.size > 0) {
        const host = this;
        queueMicrotask(() => {
          for (const subscriber of subscribers) {
            if (subscriber.contains(host)) subscriber.onLateRoot();
          }
        });
      }
      return root;
    };
    ElementCtor.prototype.attachShadow = patched as typeof original;
    watch = { count: 0, original, patched: patched as typeof original, subscribers };
    lateAttachShadowWatches.set(view as Window, watch);
  }
  const subscriber: LateAttachShadowSubscriber = { contains, onLateRoot };
  watch.subscribers.add(subscriber);
  watch.count += 1;
  return () => {
    const current = lateAttachShadowWatches.get(view as Window);
    if (!current) return;
    current.subscribers.delete(subscriber);
    current.count -= 1;
    if (current.count === 0) {
      // Ownership-safe restore: page code or an independently bundled copy may
      // have wrapped attachShadow after this watch. Never clobber a method
      // installed after ours; in that case our empty pass-through wrapper
      // stays in the chain rather than silently deleting the newer patch.
      if (ElementCtor.prototype.attachShadow === current.patched) {
        ElementCtor.prototype.attachShadow = current.original;
      }
      lateAttachShadowWatches.delete(view as Window);
    }
  };
}

type EntryStyleMethodPatch = {
  target: Record<string, unknown>;
  key: string;
  original: (...args: unknown[]) => unknown;
  patched: (...args: unknown[]) => unknown;
};

type EntryStyleSetterPatch = {
  target: object;
  key: string;
  original?: PropertyDescriptor;
  patched: NonNullable<PropertyDescriptor['set']>;
};

const entryStyleWatches = new WeakMap<
  Window,
  {
    subscribers: Set<() => void>;
    methodPatches: EntryStyleMethodPatch[];
    setterPatches: EntryStyleSetterPatch[];
    observer: MutationObserver;
    stopEvents: () => void;
  }
>();

function isEntryStylesheetElement(node: Node | null): node is Element {
  return (
    !!node && node.nodeType === 1 && (node as Element).matches('style,link[rel~="stylesheet"]')
  );
}

function containsEntryStylesheetElement(node: Node): boolean {
  return (
    isEntryStylesheetElement(node) ||
    (node.nodeType === 1 && !!(node as Element).querySelector('style,link[rel~="stylesheet"]'))
  );
}

function invalidatesEntryStyles(record: MutationRecord): boolean {
  if (record.type === 'characterData') {
    return isEntryStylesheetElement(record.target.parentElement);
  }
  if (record.type === 'attributes') return isEntryStylesheetElement(record.target);
  return (
    isEntryStylesheetElement(record.target as Node) ||
    [...record.addedNodes, ...record.removedNodes].some(containsEntryStylesheetElement)
  );
}

function isNamedRadioForEntry(node: Node, names: ReadonlySet<string>): boolean {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  if (element.namespaceURI === 'http://www.w3.org/1999/xhtml' && element.localName === 'input') {
    const input = element as HTMLInputElement;
    if (input.type === 'radio' && names.has(input.name)) return true;
  }
  return [...element.querySelectorAll<HTMLInputElement>('input[type="radio"][name]')].some(
    (radio) => names.has(radio.name)
  );
}

function containsReferencedRadioForm(node: Node, formIds: ReadonlySet<string>): boolean {
  if (node.nodeType !== 1 || formIds.size === 0) return false;
  const element = node as Element;
  if (
    element.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
    element.localName === 'form' &&
    formIds.has(element.id)
  ) {
    return true;
  }
  return [...element.querySelectorAll<HTMLFormElement>('form[id]')].some((form) =>
    formIds.has(form.id)
  );
}

function invalidatesEntryRadioGroup(
  record: MutationRecord,
  names: ReadonlySet<string>,
  formIds: ReadonlySet<string>
): boolean {
  if (record.type === 'childList') {
    return [...record.addedNodes, ...record.removedNodes].some(
      (node) => isNamedRadioForEntry(node, names) || containsReferencedRadioForm(node, formIds)
    );
  }
  if (record.target.nodeType !== 1) return false;
  const element = record.target as Element;
  if (element.namespaceURI === 'http://www.w3.org/1999/xhtml' && element.localName === 'form') {
    return (
      record.attributeName === 'id' &&
      (formIds.has(element.id) || formIds.has(record.oldValue ?? ''))
    );
  }
  if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || element.localName !== 'input') {
    return false;
  }
  const input = element as HTMLInputElement;
  const currentOrPreviousNameMatches =
    names.has(input.name) || (record.attributeName === 'name' && names.has(record.oldValue ?? ''));
  if (!currentOrPreviousNameMatches) return false;
  const currentOrPreviousTypeIsRadio =
    input.type === 'radio' ||
    (record.attributeName === 'type' && (record.oldValue ?? '').toLowerCase() === 'radio');
  return currentOrPreviousTypeIsRadio;
}

function listenToEntryEvents(
  targets: Iterable<EventTarget>,
  types: readonly string[],
  listener: EventListener
) {
  for (const target of targets)
    for (const type of types) target.addEventListener(type, listener, true);
  return () => {
    for (const target of targets)
      for (const type of types) target.removeEventListener(type, listener, true);
  };
}

function matchingSelectorParen(selector: string, open: number): number {
  let depth = 1;
  let quote = '';
  for (let index = open + 1; index < selector.length; index += 1) {
    const character = selector[index]!;
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') depth += 1;
    else if (character === ')' && --depth === 0) return index;
  }
  return -1;
}

function containsDocumentRootSelectorList(selector: string): boolean {
  let depth = 0;
  let bracketDepth = 0;
  let quote = '';
  let compoundStart = 0;
  const matchesLastCompound = (end: number) =>
    containsDocumentRootCompound(selector.slice(compoundStart, end));
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index]!;
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[') {
      bracketDepth += 1;
      continue;
    }
    if (character === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth) continue;
    if (character === '(') depth += 1;
    else if (character === ')') depth = Math.max(0, depth - 1);
    else if (!depth && character === ',') {
      if (matchesLastCompound(index)) return true;
      compoundStart = index + 1;
    } else if (
      !depth &&
      (character === '>' || character === '+' || character === '~' || /\s/.test(character))
    ) {
      compoundStart = index + 1;
    }
  }
  return matchesLastCompound(selector.length);
}

function containsDocumentRootCompound(selector: string): boolean {
  let bracketDepth = 0;
  let quote = '';
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index]!;
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[') {
      bracketDepth += 1;
      continue;
    }
    if (character === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth) continue;
    if (character === ':') {
      let end = index + 1;
      while (/[\w-]/.test(selector[end] ?? '')) end += 1;
      const name = selector.slice(index + 1, end).toLowerCase();
      if (name === 'root' && selector[end] !== '(') return true;
      if (selector[end] === '(') {
        const close = matchingSelectorParen(selector, end);
        if (close < 0) return false;
        if (
          (name === 'is' || name === 'where') &&
          containsDocumentRootSelectorList(selector.slice(end + 1, close))
        )
          return true;
        // Root-looking tokens inside :not(), :has(), attribute-like custom
        // pseudos or other functions do not make the current subject a root.
        index = close;
      }
      continue;
    }
    if (!/[a-zA-Z_]/.test(character)) continue;
    const previous = selector[index - 1];
    if (previous && !/[\s,>+~(]/.test(previous)) continue;
    let end = index + 1;
    while (/[\w-]/.test(selector[end] ?? '')) end += 1;
    const name = selector.slice(index, end).toLowerCase();
    if (name === 'html' || name === 'body') return true;
    index = end - 1;
  }
  return false;
}

function hasDocumentRootRelationalSubject(selector: string): boolean {
  let depth = 0;
  let bracketDepth = 0;
  let quote = '';
  const compoundStarts = [0];
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index]!;
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[') {
      bracketDepth += 1;
      continue;
    }
    if (character === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth) continue;
    if (character === ':' && selector.slice(index + 1, index + 4).toLowerCase() === 'has') {
      let open = index + 4;
      while (/\s/.test(selector[open] ?? '')) open += 1;
      if (
        selector[open] === '(' &&
        containsDocumentRootCompound(selector.slice(compoundStarts[depth] ?? 0, index))
      )
        return true;
    }
    if (character === '(') {
      depth += 1;
      compoundStarts[depth] = index + 1;
    } else if (character === ')') {
      compoundStarts.length = depth;
      depth = Math.max(0, depth - 1);
    } else if (character === ',' || character === '>' || character === '+' || character === '~') {
      compoundStarts[depth] = index + 1;
    } else if (/\s/.test(character)) {
      compoundStarts[depth] = index + 1;
    }
  }
  return false;
}

function collectEntryStyleDependencies(
  view: Window & typeof globalThis,
  roots: Iterable<Document | ShadowRoot>,
  target: HTMLElement,
  ancestors: readonly Element[]
) {
  const queries = new Set<string>();
  const visitedSheets = new Set<CSSStyleSheet>();
  let relational = 0;
  const candidates = [target, ...ancestors, ...target.querySelectorAll('*')];
  const collectMedia = (media: MediaList | null | undefined) => {
    const query = media?.mediaText;
    if (query) queries.add(query);
  };
  const visitRule = (rule: CSSRule) => {
    if (rule.type === 3 || rule.type === 4)
      collectMedia((rule as CSSImportRule | CSSMediaRule).media);
    if (rule.type === 3) {
      const imported = (rule as CSSImportRule).styleSheet;
      if (imported) visitSheet(imported);
    }
    if (rule.type === 1) {
      let selector = (rule as CSSStyleRule).selectorText;
      if (rule.parentRule?.type === 1)
        selector = selector.replaceAll(
          '&',
          `:is(${(rule.parentRule as CSSStyleRule).selectorText})`
        );
      if (selector.includes(':has(') && hasDocumentRootRelationalSubject(selector)) relational = 2;
      if (!relational && selector.includes(':has(')) {
        try {
          const probe = selector.replace(/:has\([^)]*\)/g, ':where(*)');
          relational = candidates.some((candidate) => candidate.matches(probe)) ? 1 : 0;
        } catch {
          // Unknown selector syntax is correctness-sensitive: retain a bounded
          // external-chain fallback rather than silently missing a change.
          relational = 1;
        }
      }
    }
    if ('cssRules' in rule)
      for (const nested of (rule as CSSGroupingRule).cssRules) visitRule(nested);
  };
  const visitSheet = (sheet: CSSStyleSheet) => {
    if (visitedSheets.has(sheet)) return;
    visitedSheets.add(sheet);
    collectMedia(sheet.media);
    try {
      for (const rule of sheet.cssRules) visitRule(rule);
    } catch {
      // Cross-origin sheets remain opaque; their owner media still applies.
      relational ||= 1;
    }
  };
  for (const root of roots)
    for (const sheet of [...(root.styleSheets ?? []), ...(root.adoptedStyleSheets ?? [])])
      visitSheet(sheet);
  return [[...queries].map((query) => view.matchMedia(query)), relational] as const;
}

function watchEntryStyleInvalidation(
  view: (Window & typeof globalThis) | null,
  onInvalidate: () => void
): (() => void) | null {
  const Sheet = view?.CSSStyleSheet;
  const StyleSheetCtor = view?.StyleSheet;
  const Declaration = view?.CSSStyleDeclaration;
  const DocumentCtor = view?.Document;
  const ShadowRootCtor = view?.ShadowRoot;
  const Grouping = (
    view as unknown as {
      CSSGroupingRule?: { prototype: Record<string, unknown> };
    }
  )?.CSSGroupingRule;
  const Observer = view?.MutationObserver;
  const doc = view?.document;
  if (!view || !Sheet || !Declaration || !Observer || !doc?.documentElement) return null;
  let watch = entryStyleWatches.get(view as Window);
  if (!watch) {
    const subscribers = new Set<() => void>();
    let pending = false;
    const notify = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        for (const subscriber of subscribers) subscriber();
      });
    };
    const methodPatches: EntryStyleMethodPatch[] = [];
    const patchMethods = (target: Record<string, unknown>, keys: readonly string[]) => {
      for (const key of keys) {
        const original = target[key];
        if (typeof original !== 'function') continue;
        const patched = function (this: unknown, ...args: unknown[]) {
          const result = Reflect.apply(original, this, args);
          if (
            key === 'replace' &&
            result &&
            typeof (result as PromiseLike<unknown>).then === 'function'
          )
            Promise.resolve(result).then(notify, () => {});
          else notify();
          return result;
        };
        target[key] = patched;
        methodPatches.push({
          target,
          key,
          original: original as (...args: unknown[]) => unknown,
          patched,
        });
      }
    };
    for (const [target, keys] of [
      [Sheet.prototype, ['insertRule', 'deleteRule', 'replaceSync', 'replace']],
      [Grouping, ['insertRule', 'deleteRule']],
      [Declaration.prototype, ['setProperty', 'removeProperty']],
      [view.MediaList?.prototype, ['appendMedium', 'deleteMedium']],
    ] as const) {
      if (target) patchMethods(target as unknown as Record<string, unknown>, keys);
    }
    for (const FormControl of [
      view.HTMLButtonElement,
      view.HTMLFieldSetElement,
      view.HTMLInputElement,
      view.HTMLObjectElement,
      view.HTMLOutputElement,
      view.HTMLSelectElement,
      view.HTMLTextAreaElement,
    ]) {
      if (FormControl)
        patchMethods(FormControl.prototype as unknown as Record<string, unknown>, [
          'setCustomValidity',
        ]);
    }
    const ElementInternalsCtor = (
      view as unknown as {
        ElementInternals?: { prototype: Record<string, unknown> };
      }
    ).ElementInternals;
    if (ElementInternalsCtor) patchMethods(ElementInternalsCtor.prototype, ['setValidity']);

    const setterPatches: EntryStyleSetterPatch[] = [];
    const patchSetter = (target: object, key: string, cssName?: string) => {
      const original = Object.getOwnPropertyDescriptor(target, key);
      if (original ? !original.configurable || !original.set : !cssName) return;
      const patched = function (this: unknown, value: unknown) {
        if (original?.set) original.set.call(this, value);
        else (this as CSSStyleDeclaration).setProperty(cssName!, String(value));
        notify();
      };
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: original?.enumerable ?? true,
        get:
          original?.get ??
          function (this: CSSStyleDeclaration) {
            return this.getPropertyValue(cssName!);
          },
        set: patched,
      });
      setterPatches.push({ target, key, original, patched });
    };
    patchSetter(Declaration.prototype, 'visibility', 'visibility');
    patchSetter(Declaration.prototype, 'display', 'display');
    patchSetter(Declaration.prototype, 'contentVisibility', 'content-visibility');
    patchSetter(Declaration.prototype, 'cssText');
    if (StyleSheetCtor) patchSetter(StyleSheetCtor.prototype, 'disabled');
    if (DocumentCtor) patchSetter(DocumentCtor.prototype, 'adoptedStyleSheets');
    if (ShadowRootCtor) patchSetter(ShadowRootCtor.prototype, 'adoptedStyleSheets');
    for (const [Ctor, keys] of [
      [view.CSSStyleRule, ['selectorText']],
      [view.MediaList, ['mediaText']],
      [view.HTMLInputElement, ['checked', 'indeterminate', 'value']],
      [view.HTMLTextAreaElement, ['value']],
      [view.HTMLOptionElement, ['selected']],
      [view.HTMLSelectElement, ['selectedIndex']],
    ] as const) {
      if (Ctor) for (const key of keys) patchSetter(Ctor.prototype, key);
    }

    const observer = new Observer((records) => {
      if (records.some(invalidatesEntryStyles)) notify();
    });
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'rel', 'media', 'disabled'],
    });
    const onLoad = (event: Event) => {
      if (isEntryStylesheetElement(event.target as Node | null)) notify();
    };
    const stopEvents = listenToEntryEvents([doc], ['load'], onLoad);
    watch = {
      subscribers,
      methodPatches,
      setterPatches,
      observer,
      stopEvents,
    };
    entryStyleWatches.set(view as Window, watch);
  }
  watch.subscribers.add(onInvalidate);
  return () => {
    const current = entryStyleWatches.get(view as Window);
    if (!current) return;
    current.subscribers.delete(onInvalidate);
    if (current.subscribers.size > 0) return;
    current.observer.disconnect();
    current.stopEvents();
    for (const patch of current.methodPatches) {
      if (patch.target[patch.key] === patch.patched) patch.target[patch.key] = patch.original;
    }
    for (const patch of current.setterPatches) {
      const descriptor = Object.getOwnPropertyDescriptor(patch.target, patch.key);
      if (descriptor?.set === patch.patched) {
        if (patch.original) Object.defineProperty(patch.target, patch.key, patch.original);
        else delete (patch.target as Record<string, unknown>)[patch.key];
      }
    }
    entryStyleWatches.delete(view as Window);
  };
}

export function createRebindableWebOverlayModal(doc: Document) {
  let currentDocument = doc;
  let current = createWebOverlayModal(doc);
  let locked = false;
  return {
    lock() {
      locked = true;
      current.lock();
    },
    unlock() {
      locked = false;
      current.unlock();
    },
    adoptDocument(nextDocument: Document) {
      if (currentDocument === nextDocument) return;
      current.unlock();
      currentDocument = nextDocument;
      current = createWebOverlayModal(nextDocument);
      if (locked) current.lock();
    },
  } satisfies OverlayModal & { adoptDocument(doc: Document): void };
}

function resolveWebComponentTriggerSurface(
  root: HTMLElement,
  logicalSurface: HTMLElement | null
): HTMLElement | null {
  if (!(root as unknown as Record<symbol, unknown>)[TRIGGER_OWNER_MARK]) {
    return logicalSurface;
  }

  let surface = root;
  while (true) {
    const next = Array.from(surface.querySelectorAll<HTMLElement>('[data-pui-root]')).find(
      (candidate) => {
        if (!(candidate as unknown as Record<symbol, unknown>)[TRIGGER_OWNER_MARK]) return false;
        let parent = candidate.parentElement;
        while (parent && parent !== surface && !parent.hasAttribute('data-pui-root')) {
          parent = parent.parentElement;
        }
        return parent === surface;
      }
    );
    if (!next) return surface;
    surface = next;
  }
}

type WebComponentOwnerModulesArgs<Props extends PropsBaseType> = {
  el: HTMLElement;
  instanceToken: LogicalInstanceToken;
  rawPropsSource: RawPropsSource<Props>;
  textControlTarget: WebTextControl | null;
  imageViewTarget: HTMLImageElement | null;
  getMeta: (key: string) => unknown;
  colorSchemeSource?: ColorSchemeInvalidationSource;
  exposeStateWebMode?: {
    allowContinuousAttr?: boolean;
    allowStringVar?: boolean;
  };
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  overlayLayerScheduler?: OverlayLayerScheduler;
};

/** Owner/instance capabilities that remain valid without rendered children. */
export function createWebComponentOwnerModules<Props extends PropsBaseType>(
  args: WebComponentOwnerModulesArgs<Props>
) {
  const { el, instanceToken, rawPropsSource, getMeta, colorSchemeSource, setExposes } = args;
  const getTriggerSurface = () => {
    if (args.textControlTarget) return args.textControlTarget;
    if (args.imageViewTarget) return args.imageViewTarget;
    const target = getLogicalTriggerSurfaceRoot(instanceToken);
    const surface = resolveWebComponentTriggerSurface(el, target);
    return surface?.isConnected ? surface : null;
  };
  const normalizeOwnedSurface = () => {
    const surface = getTriggerSurface();
    if (surface && surface !== el) releaseTriggerSurface(el);
  };
  subscribeLogicalTriggerSurface(instanceToken, normalizeOwnedSurface);
  queueMicrotask(() => queueMicrotask(normalizeOwnedSurface));
  // The custom element is the persistent owner shell, so semantic and
  // expose-state projection remain valid while its internal view is absent.
  const physicalControl = () => args.textControlTarget;
  const physicalImage = () => args.imageViewTarget;

  return createCapsWiring()
    .use('text-control', [
      [
        TEXT_CONTROL_HOST_CAP,
        createWebTextControlHost(physicalControl, WEB_COMPONENT_TEXT_CONTROL_HOST_OPTIONS),
      ],
      [TEXT_CONTROL_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('image-view', [
      [
        IMAGE_VIEW_HOST_CAP,
        createWebImageViewHost(physicalImage, WEB_COMPONENT_IMAGE_VIEW_HOST_OPTIONS),
      ],
      [IMAGE_VIEW_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('a11y', [
      [
        A11Y_PROJECT_CAP,
        createWebA11yProjector(getTriggerSurface, (listener) =>
          subscribeLogicalTriggerSurface(instanceToken, listener)
        ),
      ],
    ])
    .use('expose-event', [
      [
        EXPOSE_EVENT_SINK_CAP,
        (key: string, payload?: unknown, options?: Record<string, unknown>) => {
          el.dispatchEvent(
            new CustomEvent(key, {
              detail: payload,
              bubbles: true,
              cancelable: true,
              ...options,
            })
          );
        },
      ],
    ])
    .use('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
      [FOCUS_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [FOCUS_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('expose-state', [
      [
        EXPOSES_RECORD_SINK_CAP,
        (record: Record<string, unknown>) => {
          setExposes(record ?? {});
        },
      ],
    ])
    .use('expose-state-web', () => [
      [HOST_ELEMENT_CAP, el],
      [EXPOSE_STATE_WEB_MAP_CAP, createExposeStateWebNameMap],
      ...(args.exposeStateWebMode
        ? [[EXPOSE_STATE_WEB_MODE_CAP, args.exposeStateWebMode] as const]
        : []),
    ])
    .use('context', [
      [CONTEXT_INSTANCE_TOKEN_CAP, instanceToken],
      [CONTEXT_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
    ])
    .use('anatomy', [
      [ANATOMY_INSTANCE_TOKEN_CAP, instanceToken],
      [ANATOMY_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [ANATOMY_GET_PROTO_CAP, (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken)],
      [ANATOMY_ROOT_TARGET_CAP, (inst: unknown) => getLogicalRoot(inst as LogicalInstanceToken)],
    ])
    .use('as-trigger', [
      [AS_TRIGGER_INSTANCE_CAP, instanceToken],
      [AS_TRIGGER_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [
        AS_TRIGGER_MERGE_GROUP_CAP,
        (inst: unknown, anchor: unknown) =>
          mergeLogicalTriggerGroup(inst as LogicalInstanceToken, anchor as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
        (inst: unknown) => getLogicalEventTarget(inst as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_PROTO_CAP,
        (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken),
      ],
    ])
    .use('rule-meta', [
      [RULE_META_GET_CAP, getMeta],
      ...(colorSchemeSource
        ? [[RULE_META_COLOR_SCHEME_SOURCE_CAP, colorSchemeSource] as const]
        : []),
    ])
    .use('rule-expose-state-web', [
      [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, createExposeStateWebNativeVariantPolicy],
    ])
    .use('overlay', () => [
      ...(args.overlayLayerScheduler
        ? [[OVERLAY_LAYER_SCHEDULER_CAP, args.overlayLayerScheduler] as const]
        : []),
    ])
    .build();
}

export function createWebComponentModules<Props extends PropsBaseType>(args: {
  el: HTMLElement;
  instanceToken: LogicalInstanceToken;
  router: {
    rootTarget: EventTarget;
    globalTarget: EventTarget;
  };
  rawPropsSource: RawPropsSource<Props>;
  effectsPort: EffectsPort;
  textControlTarget: WebTextControl | null;
  imageViewTarget: HTMLImageElement | null;
  getMeta: (key: string) => unknown;
  colorSchemeSource?: ColorSchemeInvalidationSource;
  exposeStateWebMode?: {
    allowContinuousAttr?: boolean;
    allowStringVar?: boolean;
  };
  scrollProjection?: ScrollProjectionPreference;
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  isViewReady: () => boolean;
  subscribeTargetReady: (listener: () => void) => () => void;
  retryTargetReady: () => void;
  overlayLayerScheduler?: OverlayLayerScheduler;
  overlayModal?: OverlayModal;
}) {
  const {
    el,
    instanceToken,
    router,
    rawPropsSource,
    effectsPort,
    getMeta,
    colorSchemeSource,
    exposeStateWebMode,
    scrollProjection,
    setExposes,
  } = args;

  const getConnectedTriggerSurface = () => {
    const target = getLogicalTriggerSurfaceRoot(instanceToken);
    const surface = resolveWebComponentTriggerSurface(el, target);
    return surface?.isConnected ? surface : null;
  };
  // A11y must project while the rematerialized host is still behind the reveal
  // barrier; focus remains gated until that host is ready for interaction.
  const getTriggerSurface = () => (args.isViewReady() ? getConnectedTriggerSurface() : null);
  let entryObserver: MutationObserver | null = null;
  let entryImageObserver: MutationObserver | null = null;
  let entryExternalStyleObserver: MutationObserver | null = null;
  let entryRadioGroupObserver: MutationObserver | null = null;
  let entryResizeObserver: ResizeObserver | null = null;
  let stopEntryRadioStateWatch: (() => void) | null = null;
  let stopEntryImageStateWatch: (() => void) | null = null;
  let stopEntryAttachShadowWatch: (() => void) | null = null;
  let stopEntryStyleWatch: (() => void) | null = null;
  let stopEntryMotionWatch: (() => void) | null = null;
  let stopEntrySlotWatch: (() => void) | null = null;
  let stopEntryUpgradeWatch: (() => void) | null = null;
  let entryObserverGeneration = 0;
  let radioFocusHistory: ReturnType<typeof observeWebComponentRadioFocus> | null = null;
  const stopEntryObserver = () => {
    entryObserverGeneration += 1;
    entryObserver?.disconnect();
    entryImageObserver?.disconnect();
    entryExternalStyleObserver?.disconnect();
    entryRadioGroupObserver?.disconnect();
    entryObserver =
      entryImageObserver =
      entryExternalStyleObserver =
      entryRadioGroupObserver =
        null;
    entryResizeObserver?.disconnect();
    entryResizeObserver = null;
    stopEntryRadioStateWatch?.();
    stopEntryImageStateWatch?.();
    stopEntryAttachShadowWatch?.();
    stopEntryStyleWatch?.();
    stopEntryMotionWatch?.();
    stopEntrySlotWatch?.();
    stopEntryUpgradeWatch?.();
    stopEntryRadioStateWatch =
      stopEntryImageStateWatch =
      stopEntryAttachShadowWatch =
      stopEntryStyleWatch =
      stopEntryMotionWatch =
      stopEntrySlotWatch =
      stopEntryUpgradeWatch =
        null;
  };
  const subscribeFocusTarget = (listener: () => void) => {
    const history = observeWebComponentRadioFocus(el);
    const offReady = args.subscribeTargetReady(() => {
      history.rebind();
      listener();
    });
    const offSurface = subscribeLogicalTriggerSurface(instanceToken, listener);
    radioFocusHistory = history;
    return () => {
      history.dispose();
      // An old epoch's cleanup owns its captured listener, not a successor's
      // native focus history or entry observation.
      if (radioFocusHistory === history) {
        radioFocusHistory = null;
        stopEntryObserver();
      }
      offReady();
      offSurface();
    };
  };
  const physicalControl = () => args.textControlTarget;
  const physicalImage = () => args.imageViewTarget;
  // Keep canonical instance-facing state markers on the custom-element
  // boundary while mirroring only the generated selector context needed by
  // translated feedback.style tokens on a split presentation surface.
  const presentationSurface = args.textControlTarget ?? args.imageViewTarget ?? el;

  return createCapsWiring()
    .use('text-control', [
      [
        TEXT_CONTROL_HOST_CAP,
        createWebTextControlHost(physicalControl, WEB_COMPONENT_TEXT_CONTROL_HOST_OPTIONS),
      ],
      [TEXT_CONTROL_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('image-view', [
      [
        IMAGE_VIEW_HOST_CAP,
        createWebImageViewHost(physicalImage, WEB_COMPONENT_IMAGE_VIEW_HOST_OPTIONS),
      ],
      [IMAGE_VIEW_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('feedback', [[EFFECTS_CAP, effectsPort]])
    .use('a11y', [
      [
        A11Y_PROJECT_CAP,
        createWebA11yProjector(
          () => physicalControl() ?? physicalImage() ?? getConnectedTriggerSurface(),
          (listener) => subscribeLogicalTriggerSurface(instanceToken, listener)
        ),
      ],
    ])
    .use('event', [
      [EVENT_ROOT_TARGET_CAP, () => router.rootTarget],
      [EVENT_GLOBAL_TARGET_CAP, () => router.globalTarget],
      [EVENT_GLOBAL_INPUT_SCOPE_CAP, () => el.ownerDocument],
      [EVENT_CANCEL_DEFAULT_ACTION_CAP, cancelWebEventDefaultAction],
    ])
    .use('expose-event', [
      [
        EXPOSE_EVENT_SINK_CAP,
        (key: string, payload?: unknown, options?: Record<string, unknown>) => {
          const ev = new CustomEvent(key, {
            detail: payload,
            bubbles: true,
            cancelable: true,
            ...options,
          });
          el.dispatchEvent(ev);
        },
      ],
    ])
    .use('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
      [FOCUS_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [FOCUS_TARGET_READY_CAP, subscribeFocusTarget],
      [
        FOCUS_SAMPLE_SCOPE_TARGETS_CAP,
        (container: HTMLElement, direction?: 'next' | 'prev') =>
          sampleWebComponentScopeTargets(
            container,
            isNativelyFocusable,
            direction,
            (radio) => radioFocusHistory?.order(radio) ?? 0,
            () => radioFocusHistory?.recent() ?? null
          ),
      ],
      [FOCUS_ROOT_TARGET_CAP, () => physicalControl() ?? getTriggerSurface()],
      [FOCUS_IS_NATIVELY_FOCUSABLE_CAP, (target: HTMLElement) => isNativelyFocusable(target)],
      [
        FOCUS_SET_FOCUSABLE_CAP,
        (target: HTMLElement, enabled: boolean, options?: { programmatic?: boolean }) => {
          // Explicit focus-target policy owns both tabindex=0 and the
          // programmatic-only tabindex=-1; a previous entry observer must not
          // overwrite it after the target becomes enabled.
          if (options?.programmatic) stopEntryObserver();
          const surface = physicalControl() ?? getLogicalTriggerSurfaceRoot(instanceToken);
          projectFocusable(target, enabled && (!surface || surface === target), options);
        },
      ],
      [
        FOCUS_RESOLVE_ENTRY_TARGET_CAP,
        (target: HTMLElement, config: FocusEntryConfig) => resolveFocusEntryTarget(target, config),
      ],
      [
        FOCUS_SET_ENTRY_FOCUSABLE_CAP,
        (target: HTMLElement, config: FocusEntryConfig, enabled: boolean) => {
          stopEntryObserver();
          if (!enabled) {
            projectFocusable(target, false);
            return;
          }

          const observerGeneration = entryObserverGeneration;
          const isCurrentEntryObservation = () =>
            entryObserverGeneration === observerGeneration && entryObserver !== null;
          let projectedTargetTabIndex = target.getAttribute('tabindex');
          const projectEntry = () => {
            const resolved = resolveFocusEntryTarget(target, config);
            projectFocusable(target, resolved === target);
            projectedTargetTabIndex = target.getAttribute('tabindex');
          };
          const projectCurrent = () => {
            if (isCurrentEntryObservation()) projectEntry();
          };
          projectEntry();
          // Entry policy can be projected before descendant custom elements
          // restore their tabindex on reveal. Track the same DOM inputs used
          // by the resolver, without requesting focus or manufacturing facts.
          const Observer = target.ownerDocument.defaultView?.MutationObserver;
          if (config.strategy === 'descendant-first' && Observer) {
            const view = target.ownerDocument.defaultView;
            const Resize = view?.ResizeObserver;
            if (Resize) entryResizeObserver = new Resize(projectCurrent);
            // The late-attach watch below is installed once but must always
            // consult the currently observed region, so the root set lives
            // outside observeTree() and is refreshed on every resample
            // instead of being captured from the first scan.
            const observedRoots = new Set<Node>();
            const pendingUpgrades = new Map<string, [(() => void) | null]>();
            stopEntryUpgradeWatch = () => {
              for (const subscription of pendingUpgrades.values()) subscription[0] = null;
              pendingUpgrades.clear();
            };
            const observeTree = () => {
              if (!isCurrentEntryObservation()) return;
              entryObserver?.disconnect();
              entryImageObserver?.disconnect();
              entryExternalStyleObserver?.disconnect();
              entryRadioGroupObserver?.disconnect();
              entryResizeObserver?.disconnect();
              stopEntryRadioStateWatch?.();
              stopEntryImageStateWatch?.();
              stopEntrySlotWatch?.();
              stopEntryMotionWatch?.();
              stopEntryRadioStateWatch =
                stopEntryImageStateWatch =
                stopEntrySlotWatch =
                stopEntryMotionWatch =
                  null;
              let hasArea = false;
              const radioTrees = new Set<Document | ShadowRoot>();
              const mediaRoots = new Set<Document | ShadowRoot>([target.ownerDocument]);
              const radioNames = new Set<string>();
              const radioFormIds = new Set<string>();
              const options: MutationObserverInit = {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: [
                  'tabindex',
                  'disabled',
                  'aria-disabled',
                  'hidden',
                  'inert',
                  'aria-hidden',
                  'href',
                  'contenteditable',
                  'controls',
                  'type',
                  'open',
                  'usemap',
                  'src',
                  'srcset',
                  'slot',
                  'name',
                  'form',
                  'checked',
                  'id',
                  'class',
                  'style',
                ],
              };
              // attachShadow() itself produces no light-tree record, so a
              // descendant custom element that upgrades (or otherwise attaches
              // an open root) after observation starts would keep the host
              // fallback forever. Upgrade notifications are the bounded
              // readiness signal: resample once per newly defined name.
              const registry = target.ownerDocument.defaultView?.customElements;
              observedRoots.clear();
              const observe = (root: HTMLElement | ShadowRoot) => {
                observedRoots.add(root);
                if (root.nodeType === 11) mediaRoots.add(root as ShadowRoot);
                entryObserver?.observe(root, options);
                if (root.nodeType === 1) entryResizeObserver?.observe(root as HTMLElement);
                hasArea ||= !!root.querySelector('area');
                // Radio-group ownership never crosses a Document/ShadowRoot
                // boundary. Observe only trees containing a relevant named
                // radio instead of every document hosting a Focus Entry.
                for (const radio of root.querySelectorAll<HTMLInputElement>(
                  'input[type="radio"][name]'
                )) {
                  radioNames.add(radio.name);
                  const formId = radio.getAttribute('form') || radio.form?.id;
                  if (formId) radioFormIds.add(formId);
                  const tree = radio.getRootNode();
                  if (tree.nodeType === 9 || (tree.nodeType === 11 && !!(tree as ShadowRoot).host))
                    radioTrees.add(tree as Document | ShadowRoot);
                }
                if (root.nodeType === 1 && (root as HTMLElement).shadowRoot)
                  observe((root as HTMLElement).shadowRoot!);
                for (const descendant of root.querySelectorAll<HTMLElement>('*')) {
                  entryResizeObserver?.observe(descendant);
                  if (descendant.shadowRoot) observe(descendant.shadowRoot);
                  else if (registry) {
                    const name = descendant.localName;
                    if (!name.includes('-') || pendingUpgrades.has(name) || registry.get(name))
                      continue;
                    const subscription: [() => void] = [
                      () => {
                        pendingUpgrades.delete(name);
                        refreshTree();
                      },
                    ];
                    pendingUpgrades.set(name, subscription);
                    registry.whenDefined(name).then(
                      () => subscription.pop()?.(),
                      () => subscription.pop()
                    );
                  }
                }
              };
              observe(target);
              const belongsToObservedEntryTree = (node: Node) => {
                for (const root of observedRoots) {
                  if (root === node || root.contains(node)) return true;
                }
                return false;
              };
              entryExternalStyleObserver ??= new Observer((records) => {
                if (!isCurrentEntryObservation()) return;
                if (
                  records.some(
                    (record) =>
                      !belongsToObservedEntryTree(record.target) || invalidatesEntryStyles(record)
                  )
                )
                  projectEntry();
              });
              // The entry region can itself be slotted or nested below
              // selector-bearing ancestors outside its owned subtree. Their
              // Arbitrary author attributes can participate in descendant
              // selectors, so observe every attribute on only this bounded
              // composed chain instead of guessing a global allowlist.
              let externalAncestor = composedParentElement(target);
              const externalAncestors: Element[] = [];
              const externalSlots = new Set<HTMLSlotElement>();
              const externalStyleRoots = new Set<ShadowRoot>();
              const motionTargets = new Set<Element>([target]);
              const targetRoot = target.getRootNode();
              if (
                targetRoot.nodeType === 11 &&
                !!(targetRoot as ShadowRoot).host &&
                !observedRoots.has(targetRoot)
              ) {
                externalStyleRoots.add(targetRoot as ShadowRoot);
                mediaRoots.add(targetRoot as ShadowRoot);
              }
              while (externalAncestor) {
                externalAncestors.push(externalAncestor);
                motionTargets.add(externalAncestor);
                // Container-query eligibility can change solely because a
                // composed ancestor crosses a size threshold. Reuse the
                // view-epoch observer over this already bounded chain.
                entryResizeObserver?.observe(externalAncestor);
                entryObserver?.observe(externalAncestor, {
                  attributes: true,
                });
                const externalRoot = externalAncestor.getRootNode();
                if (
                  externalRoot.nodeType === 11 &&
                  !!(externalRoot as ShadowRoot).host &&
                  !observedRoots.has(externalRoot)
                ) {
                  externalStyleRoots.add(externalRoot as ShadowRoot);
                  mediaRoots.add(externalRoot as ShadowRoot);
                }
                if (
                  externalAncestor.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
                  externalAncestor.localName === 'slot'
                )
                  externalSlots.add(externalAncestor as HTMLSlotElement);
                externalAncestor = composedParentElement(externalAncestor);
              }
              const [mediaQueries, relationalDependency] = collectEntryStyleDependencies(
                view!,
                mediaRoots,
                target,
                externalAncestors
              );
              if (relationalDependency === 1) {
                for (const ancestor of externalAncestors) {
                  if (
                    ancestor === target.ownerDocument.body ||
                    ancestor === target.ownerDocument.documentElement
                  )
                    continue;
                  entryExternalStyleObserver.observe(ancestor, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                  });
                }
              }
              if (relationalDependency === 2) {
                entryExternalStyleObserver.observe(target.ownerDocument.documentElement, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                });
              }
              const stopEntryEnvironmentEvents = listenToEntryEvents(
                [view!, ...mediaQueries],
                ['resize', 'change'],
                projectCurrent
              );
              const projectionEvents = [
                'transitionend',
                'transitioncancel',
                'animationend',
                'animationcancel',
                'input',
                'change',
                'pointerover',
                'pointerout',
                'focusin',
                'focusout',
              ];
              const stopProjectionEvents = listenToEntryEvents(
                motionTargets,
                projectionEvents,
                projectCurrent
              );
              const onExternalStyleEvent = (event: Event) => {
                if (isEntryStylesheetElement(event.composedPath()[0] as Node)) refreshTree();
              };
              const stopExternalStyleEvents = listenToEntryEvents(
                externalStyleRoots,
                ['load', 'error'],
                onExternalStyleEvent
              );
              stopEntryMotionWatch = () => {
                stopEntryEnvironmentEvents();
                stopProjectionEvents();
                stopExternalStyleEvents();
              };
              if (externalStyleRoots.size > 0) {
                for (const root of externalStyleRoots) {
                  entryExternalStyleObserver.observe(root, {
                    subtree: true,
                    childList: true,
                    characterData: true,
                    attributes: true,
                    attributeFilter: ['href', 'rel', 'media', 'disabled'],
                  });
                }
              }
              if (externalSlots.size > 0) {
                stopEntrySlotWatch = listenToEntryEvents(
                  externalSlots,
                  ['slotchange'],
                  refreshTree
                );
              }
              // An already-upgraded descendant can still attach an open root
              // later (from a method, timer, or state transition), which is
              // invisible to both DOM mutation records and upgrade watches.
              // While this region is observed, wrap the window's attachShadow
              // with a reference-counted watch that resamples once a late open
              // root lands inside an already-observed root.
              stopEntryAttachShadowWatch ??= watchLateAttachShadow(
                target.ownerDocument.defaultView,
                (host) => {
                  for (const root of observedRoots) {
                    if (root === host || root.contains(host)) return true;
                  }
                  return false;
                },
                refreshTree
              );
              // Both entry resolvers consult document-level image-map bindings.
              // Only regions with areas need this extra observation; unrelated
              // document mutations must not resample ordinary entry regions.
              if (hasArea) {
                entryImageObserver ??= new Observer((records) => {
                  if (!isCurrentEntryObservation()) return;
                  const containsImage = (node: Node) =>
                    node.nodeType === 1 &&
                    ((node as Element).localName === 'img' ||
                      !!(node as Element).querySelector('img'));
                  if (
                    records.some((record) =>
                      record.type === 'childList'
                        ? [...record.addedNodes, ...record.removedNodes].some(containsImage)
                        : containsImage(record.target)
                    )
                  )
                    projectEntry();
                });
                entryImageObserver.observe(target.ownerDocument, {
                  subtree: true,
                  childList: true,
                  attributes: true,
                  attributeFilter: [
                    'usemap',
                    'src',
                    'srcset',
                    'hidden',
                    'inert',
                    'aria-hidden',
                    'open',
                    'class',
                    'style',
                  ],
                });
                for (const image of target.ownerDocument.querySelectorAll('img[usemap]'))
                  entryResizeObserver?.observe(image);
                const onImageState = (event: Event) => {
                  const image = event.target;
                  if (
                    isCurrentEntryObservation() &&
                    !!image &&
                    typeof image === 'object' &&
                    (image as Node).nodeType === 1 &&
                    (image as Element).localName === 'img' &&
                    (image as Element).hasAttribute('usemap')
                  )
                    projectEntry();
                };
                stopEntryImageStateWatch = listenToEntryEvents(
                  [target.ownerDocument],
                  ['load', 'error'],
                  onImageState
                );
              }
              // Native radio checkedness is property state: a click on a group
              // member outside this entry region, or a form reset, need not
              // produce any MutationObserver record. Observe only the DOM
              // trees that own named radios in the region and re-evaluate
              // after the native state transition has settled.
              if (radioTrees.size > 0) {
                entryRadioGroupObserver = new Observer((records) => {
                  if (!isCurrentEntryObservation()) return;
                  if (
                    records.some(
                      (record) =>
                        !belongsToObservedEntryTree(record.target) &&
                        invalidatesEntryRadioGroup(record, radioNames, radioFormIds)
                    )
                  ) {
                    refreshTree();
                  }
                });
                for (const tree of radioTrees) {
                  entryRadioGroupObserver.observe(tree, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    attributeOldValue: true,
                    attributeFilter: ['name', 'form', 'type', 'disabled', 'id'],
                  });
                }
                const eventOrigin = (event: Event) => event.composedPath()[0] ?? event.target;
                const onRadioState = (event: Event) => {
                  const origin = eventOrigin(event);
                  if (
                    !origin ||
                    typeof origin !== 'object' ||
                    (origin as Node).nodeType !== 1 ||
                    (origin as Element).namespaceURI !== 'http://www.w3.org/1999/xhtml'
                  )
                    return;
                  const element = origin as HTMLInputElement;
                  if (
                    event.type === 'change'
                      ? element.localName !== 'input' || element.type !== 'radio' || !element.name
                      : element.localName !== 'form'
                  )
                    return;
                  queueMicrotask(projectCurrent);
                };
                stopEntryRadioStateWatch = listenToEntryEvents(
                  radioTrees,
                  ['change', 'reset'],
                  onRadioState
                );
              }
            };
            function refreshTree() {
              if (!isCurrentEntryObservation()) return;
              projectEntry();
              observeTree();
            }
            entryObserver = new Observer((records) => {
              if (!isCurrentEntryObservation()) return;
              if (
                records.some(
                  (record) =>
                    record.target !== target ||
                    record.attributeName !== 'tabindex' ||
                    target.getAttribute('tabindex') !== projectedTargetTabIndex
                )
              ) {
                // Ignore only the Adapter's currently projected target value.
                // A delegated surface can also receive an author/runtime write;
                // a different value must be resampled and restored exactly once.
                // New native descendants can own open roots. A single DOM
                // subtree observation never crosses those boundaries.
                refreshTree();
              }
            });
            if (view) stopEntryStyleWatch = watchEntryStyleInvalidation(view, refreshTree);
            observeTree();
          }
        },
      ],
      [
        FOCUS_REQUEST_FOCUS_CAP,
        (target: HTMLElement, options?: FocusRequestOptions) => {
          target.focus(
            typeof options?.preventScroll === 'boolean'
              ? { preventScroll: options.preventScroll }
              : undefined
          );
          // A focused editor inside an open ShadowRoot leaves
          // document.activeElement on the host; only the deepest active
          // element proves the request landed.
          const applied = deepestActiveElement(target.ownerDocument) === target;
          if (!applied) args.retryTargetReady();
          return applied;
        },
      ],
      [FOCUS_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
      [
        FOCUS_BLUR_CAP,
        (target: HTMLElement) => {
          target.blur();
        },
      ],
    ])
    .use('expose-state', [
      [
        EXPOSES_RECORD_SINK_CAP,
        (record: Record<string, unknown>) => {
          setExposes(record ?? {});
        },
      ],
    ])
    .use('expose-state-web', () => [
      [HOST_ELEMENT_CAP, el],
      [EXPOSE_STATE_WEB_MAP_CAP, createExposeStateWebNameMap],
      [
        EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
        () => (presentationSurface === el ? [] : [presentationSurface]),
      ],
      ...(exposeStateWebMode ? [[EXPOSE_STATE_WEB_MODE_CAP, exposeStateWebMode] as const] : []),
    ])
    .use('context', [
      [CONTEXT_INSTANCE_TOKEN_CAP, instanceToken],
      [CONTEXT_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
    ])
    .use('anatomy', [
      [ANATOMY_INSTANCE_TOKEN_CAP, instanceToken],
      [ANATOMY_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [ANATOMY_GET_PROTO_CAP, (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken)],
      [ANATOMY_ROOT_TARGET_CAP, (inst: unknown) => getLogicalRoot(inst as LogicalInstanceToken)],
      [ANATOMY_ORDER_OBSERVER_CAP, createDomOrderObserver],
    ])
    .use('as-trigger', [
      [AS_TRIGGER_INSTANCE_CAP, instanceToken],
      [AS_TRIGGER_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [
        AS_TRIGGER_MERGE_GROUP_CAP,
        (inst: unknown, anchor: unknown) =>
          mergeLogicalTriggerGroup(inst as LogicalInstanceToken, anchor as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
        (inst: unknown) => getLogicalEventTarget(inst as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_PROTO_CAP,
        (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken),
      ],
    ])
    .use('rule-meta', [
      [RULE_META_GET_CAP, getMeta],
      ...(colorSchemeSource
        ? [[RULE_META_COLOR_SCHEME_SOURCE_CAP, colorSchemeSource] as const]
        : []),
    ])
    .use('rule-expose-state-web', [
      [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, createExposeStateWebNativeVariantPolicy],
    ])
    .use('hit-participation', [
      [HOST_ELEMENT_CAP, el],
      [HIT_PARTICIPATION_HOST_BRIDGE_CAP, createWebHitParticipationHostBridge()],
    ])
    .use('boundary', [
      [HOST_ELEMENT_CAP, el],
      [BOUNDARY_HOST_BRIDGE_CAP, createWebBoundaryHostBridge()],
    ])
    .use('positioning', [[ANCHORED_POSITION_HOST_CAP, createFloatingUiAnchoredPositionHost()]])
    .use('scroll', [
      [
        SCROLL_SURFACE_HOST_CAP,
        createWebScrollSurfaceHost(el, {
          moveGestureHost: createWebMoveGestureHost(),
          preference: scrollProjection,
        }),
      ],
    ])
    .use('overlay', () => [
      [HOST_ELEMENT_CAP, el],
      [OVERLAY_GLOBAL_MOUNT_CAP, createWebComponentPortalMount()],
      [OVERLAY_MODAL_CAP, args.overlayModal ?? createWebOverlayModal(el.ownerDocument)],
      ...(args.overlayLayerScheduler
        ? [[OVERLAY_LAYER_SCHEDULER_CAP, args.overlayLayerScheduler] as const]
        : []),
    ])
    .build();
}

function isNativelyFocusable(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'iframe') {
    return true;
  }
  if (tag === 'input') return (el as HTMLInputElement).type !== 'hidden';
  if (tag === 'a') return el.hasAttribute('href');
  if (tag === 'area') {
    const map = el.closest('map');
    if (!el.hasAttribute('href') || !map?.name || !el.isConnected) return false;
    return Array.from(el.ownerDocument.querySelectorAll('img[usemap]')).some(
      (image) =>
        image.getAttribute('usemap') === `#${map.name}` &&
        !image.closest('[hidden],[inert],[aria-hidden="true"]')
    );
  }
  if (tag === 'audio' || tag === 'video') return el.hasAttribute('controls');
  if (tag === 'summary') {
    const parent = el.parentElement;
    return (
      parent?.tagName.toLowerCase() === 'details' &&
      Array.from(parent.children).find((child) => child.tagName.toLowerCase() === 'summary') === el
    );
  }
  return false;
}

function projectFocusable(
  target: HTMLElement,
  enabled: boolean,
  options?: { programmatic?: boolean }
): void {
  if (enabled) {
    target.setAttribute('tabindex', '0');
  } else if (options?.programmatic || isNativelyFocusable(target)) {
    target.setAttribute('tabindex', '-1');
  } else {
    target.removeAttribute('tabindex');
  }
}

function resolveFocusEntryTarget(
  container: HTMLElement,
  config: { strategy: 'self' | 'descendant-first'; fallback: 'self' | 'none' }
): HTMLElement | null {
  if (config.strategy === 'descendant-first') {
    const descendant = sampleWebComponentScopeTargets(
      container,
      isNativelyFocusable,
      'next',
      undefined,
      undefined,
      true
    ).targets.find((target) => target !== container);
    if (descendant) return descendant;
  }

  if (config.fallback === 'self') return container;
  return null;
}
