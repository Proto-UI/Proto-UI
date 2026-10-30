import { createDynamicChildrenModel, type DynamicChildEntry } from './demo-dynamic-children';
import { createDynamicCommitQueue } from './demo-dynamic-commit-queue';
import { createCanonicalMotionPalette } from './canonical-motion-palette';
import {
  createPreviewMaterialSink,
  findPreviewMaterialProvider,
} from './preview-material-provider';
import { createDemoAssociationScope } from './demo-associations';
import { setElementProps, setElementAssociations } from '@proto.ui/adapter-web-component';
import type { ReactRuntime } from '@proto.ui/adapter-react';
import type { VueRuntime as AdapterVueRuntime } from '@proto.ui/adapter-vue';
import type { Prototype } from '@proto.ui/core';
import { getPrototype } from './registry';
import { claimHostMount, type HostMountLease } from './runtimes/host-mount';
import type {
  DemoChild,
  DemoNode,
  DemoRenderOptions,
  DemoRenderResult,
  DemoRuntimeApi,
  DemoSurfaceStyle,
} from './demo-types';
import { ensurePreviewWcRegistered } from './wc-registry';
import type { RuntimeId } from './runtimes/ids';

import runtimeUrls from 'virtual:proto-ui/runtime-retry-urls';
import { retryableModule } from './runtimes/retryable-module';

const reactAdapter = retryableModule(
  () => import('@proto.ui/adapter-react'),
  runtimeUrls.reactAdapter
);
const reactRuntime = retryableModule(
  () => import('./runtimes/react-runtime'),
  runtimeUrls.reactRuntime
);
const vueAdapter = retryableModule(() => import('@proto.ui/adapter-vue'), runtimeUrls.vueAdapter);
const vueRuntime = retryableModule(() => import('./runtimes/vue-runtime'), runtimeUrls.vueRuntime);
const vue2Adapter = retryableModule(
  () => import('@proto.ui/adapter-vue2'),
  runtimeUrls.vue2Adapter
);
const vue2Runtime = retryableModule(
  () => import('./runtimes/vue2-runtime'),
  runtimeUrls.vue2Runtime
);
const reactModules = () => Promise.all([reactAdapter(), reactRuntime()]);
const vueModules = () => Promise.all([vueAdapter(), vueRuntime()]);
const vue2Modules = () => Promise.all([vue2Adapter(), vue2Runtime()]);

type PropsBaseType = Record<string, unknown>;

const reactComponentCache = new WeakMap<object, Map<string, any>>();
const vueComponentCache = new WeakMap<object, Map<string, any>>();
const wcSurfaceProps = new WeakMap<HTMLElement, Record<string, unknown>>();
const wcRawProps = new WeakMap<HTMLElement, Record<string, unknown>>();

const EMPTY_DEMO_RENDER: DemoRenderResult = { destroy: () => {} };

function unsupportedRuntime(runtime: never): Error {
  return new Error(`[PrototypePreviewer] unsupported runtime: ${String(runtime)}`);
}

/**
 * Resolve a framework's browser dependency before replacing the currently
 * mounted demo. The renderer still owns the host lease and performs its own
 * load so direct callers remain safe; browser module imports are cached.
 */
// Framework adapters load through dynamic import() so the static entry closure
// (and its package budget) never includes React/Vue; prepareDemoRuntime warms
// the chunk so the runtime switch does not flash a skeleton.
export async function prepareDemoRuntime(runtime: RuntimeId): Promise<void> {
  switch (runtime) {
    case 'wc':
      return;
    case 'react':
      await (await reactModules())[1].loadReact();
      return;
    case 'vue':
      await (await vueModules())[1].loadVue();
      return;
    case 'vue2':
      await (await vue2Modules())[1].loadVue2();
      return;
    default:
      throw unsupportedRuntime(runtime);
  }
}

function ownsLease(opt: DemoRenderOptions, lease: HostMountLease): boolean {
  return lease.isCurrent() && opt.isCurrent?.() !== false;
}

/** Revoke failed host work without hiding either the original or cleanup error. */
export function revokeFailedDemoRender(
  lease: Pick<HostMountLease, 'release'>,
  failure: unknown
): never {
  try {
    lease.release();
  } catch (cleanupFailure) {
    throw new AggregateError(
      [failure, cleanupFailure],
      '[PrototypePreviewer] dynamic host commit failed and render cleanup also failed',
      { cause: failure }
    );
  }
  throw failure;
}

function abandonLease(lease: HostMountLease): DemoRenderResult {
  lease.release();
  return EMPTY_DEMO_RENDER;
}

function runCleanupSteps(steps: readonly (() => void)[]): void {
  let cleanupFailed = false;
  let cleanupFailure: unknown;
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      if (!cleanupFailed) {
        cleanupFailed = true;
        cleanupFailure = error;
      }
    }
  }
  if (cleanupFailed) throw cleanupFailure;
}

function reactStylePropertyName(property: string): string {
  if (property.startsWith('--')) return property;
  if (property === 'float') return 'cssFloat';
  const normalized = property.startsWith('-ms-') ? property.slice(1) : property;
  return normalized.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function normalizeReactSurfaceStyle(
  surfaceStyle: DemoSurfaceStyle,
  document: Document
): Record<string, string> {
  const normalized: Record<string, string> = {};
  const entries = Array.isArray(surfaceStyle) ? surfaceStyle : [surfaceStyle];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      const declaration = document.createElement('span').style;
      declaration.cssText = entry;
      for (let index = 0; index < declaration.length; index += 1) {
        const property = declaration.item(index);
        normalized[reactStylePropertyName(property)] = declaration.getPropertyValue(property);
      }
      continue;
    }
    for (const [property, value] of Object.entries(entry)) {
      normalized[reactStylePropertyName(property)] = value;
    }
  }
  return normalized;
}

function getScopedComponentCache<T extends object>(
  cache: WeakMap<object, Map<string, T>>,
  adapter: object
): Map<string, T> {
  let scopedCache = cache.get(adapter);
  if (!scopedCache) {
    scopedCache = new Map<string, T>();
    cache.set(adapter, scopedCache);
  }
  return scopedCache;
}

type DemoInstance = {
  getExposes?(): Record<string, unknown>;
  update?(): void;
  invokeInCallbackScope?(fn: () => void): void;
};

function callInScope(inst: DemoInstance, fn: () => void) {
  if (typeof inst.invokeInCallbackScope === 'function') {
    let invoked = false;
    let result: unknown;
    inst.invokeInCallbackScope(() => {
      invoked = true;
      result = fn();
    });
    // Some adapters expose invokeInCallbackScope early but wire it later.
    // Fallback to direct invocation so first-click controls are not dropped.
    if (!invoked) {
      return fn();
    }
    return result;
  }
  return fn();
}

function renderDemoNodeWc(
  node: DemoChild,
  parent: HTMLElement,
  instances: HTMLElement[],
  associations: ReturnType<typeof createDemoAssociationScope>,
  isCurrent: () => boolean
) {
  if (!isCurrent()) return;
  if (typeof node === 'string') {
    parent.appendChild(document.createTextNode(node));
    return;
  }
  if (node.kind === 'text') {
    parent.appendChild(document.createTextNode(node.text));
    return;
  }
  if (node.kind === 'box') {
    const el = document.createElement(node.tag ?? 'div');
    for (const [name, value] of Object.entries(node.attrs ?? {})) {
      el.setAttribute(name, value);
    }
    if (node.className) el.className = node.className;
    if (node.ref) el.setAttribute('data-demo-ref', node.ref);
    parent.appendChild(el);
    const kids = node.children ?? [];
    for (const child of kids) renderDemoNodeWc(child, el, instances, associations, isCurrent);
    return;
  }

  const proto = getPrototype(node.prototypeId);
  const wcName = ensurePreviewWcRegistered(node.prototypeId, proto);

  const el = document.createElement(wcName);
  instances.push(el);
  if (node.ref) el.setAttribute('data-demo-ref', node.ref);
  const surfaceProps = {
    surfaceClassName: node.className,
    surfaceStyle: node.surfaceStyle,
  };
  wcSurfaceProps.set(el, surfaceProps);
  wcRawProps.set(el, { ...(node.props ?? {}) });
  setElementAssociations(el, associations.resolve(node.associations) ?? {});
  setElementProps(el, {
    ...(node.props ?? {}),
    ...surfaceProps,
  });

  // Materialize authored children before connecting the custom element so the
  // Web Component adapter can project slots or reject contentless children.
  const kids = node.children ?? [];
  for (const child of kids) renderDemoNodeWc(child, el, instances, associations, isCurrent);
  if (isCurrent()) parent.appendChild(el);
}

function collectDemoRefs(host: HTMLElement): Record<string, HTMLElement> {
  const refs: Record<string, HTMLElement> = Object.create(null);
  host.querySelectorAll('[data-demo-ref]').forEach((el) => {
    const ref = el.getAttribute('data-demo-ref');
    if (ref) refs[ref] = el as HTMLElement;
  });
  return refs;
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => {
    if (o != null && typeof o === 'object') {
      return (o as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

/** Website onX convention over the WC Adapter's outward CustomEvent carrier. */
function createWcDemoCallbacks(isCurrent: () => boolean) {
  type Binding = { callback: (payload: unknown) => void; listener: EventListener };
  const bindings = new Map<HTMLElement, Map<string, Binding>>();
  let live = true;

  return {
    patch(el: HTMLElement, next: Record<string, unknown>) {
      if (!live || !isCurrent()) return;
      for (const [prop, value] of Object.entries(next)) {
        if (!live || !isCurrent()) return;
        if (!/^on[A-Z]/.test(prop)) continue;
        // Match the existing React/Vue callback convention: only the first
        // character after `on` is lowercased; the rest of the key is exact.
        const key = prop[2]!.toLowerCase() + prop.slice(3);
        const owned = bindings.get(el) ?? new Map<string, Binding>();
        const existing = owned.get(key);
        if (typeof value !== 'function') {
          if (existing) {
            owned.delete(key);
            el.removeEventListener(key, existing.listener);
          }
          if (owned.size === 0) bindings.delete(el);
          continue;
        }
        const callback = value as Binding['callback'];
        if (existing) {
          existing.callback = callback;
          continue;
        }
        const binding: Binding = {
          callback,
          listener(event) {
            if (!live || !isCurrent() || !el.isConnected) return;
            // A native click and an outward click may share a name. The brand
            // works across realms without relying on window.CustomEvent.
            const CustomEventCtor = el.ownerDocument.defaultView?.CustomEvent;
            if (!CustomEventCtor) return;
            if (
              !(event instanceof CustomEventCtor) &&
              Object.prototype.toString.call(event) !== '[object CustomEvent]'
            )
              return;
            // The native detail getter performs the WebIDL brand check across
            // realms. A forged toStringTag alone must not identify a signal.
            const readDetail = Object.getOwnPropertyDescriptor(
              CustomEventCtor.prototype,
              'detail'
            )?.get;
            if (!readDetail) return;
            let payload: unknown;
            try {
              payload = readDetail.call(event);
            } catch {
              return;
            }
            // `target` alone can be retargeted across a shadow boundary. Only
            // the persistent owner itself emits this instance's outward signal.
            if (event.composedPath()[0] !== el) return;
            if (!live || !isCurrent()) return;
            const current = binding.callback;
            current(payload);
          },
        };
        owned.set(key, binding);
        bindings.set(el, owned);
        el.addEventListener(key, binding.listener);
        if (!live || !isCurrent()) {
          el.removeEventListener(key, binding.listener);
          return;
        }
      }
    },
    release(element: HTMLElement) {
      const owned = bindings.get(element);
      if (!owned) return;
      bindings.delete(element);
      runCleanupSteps(
        [...owned].map(
          ([key, binding]) =>
            () =>
              element.removeEventListener(key, binding.listener)
        )
      );
    },
    dispose() {
      if (!live) return;
      live = false;
      const steps: Array<() => void> = [];
      for (const [el, owned] of bindings)
        for (const [key, binding] of owned)
          steps.push(() => el.removeEventListener(key, binding.listener));
      bindings.clear();
      runCleanupSteps(steps);
    },
  };
}

async function renderDemoWc(
  opt: DemoRenderOptions,
  lease: HostMountLease
): Promise<DemoRenderResult> {
  const { host, demo } = opt;
  const associations = createDemoAssociationScope();
  const dynamic = createDynamicChildrenModel(demo);
  for (const prototypeId of dynamic.prototypeIds) getPrototype(prototypeId);
  let dynamicQueue: ReturnType<typeof createDynamicCommitQueue> | undefined;
  let dynamicCleanup = () => dynamic.dispose();
  const owner = `demo-${++nextDemoOwner}`;
  let refs: Record<string, HTMLElement> = Object.create(null);
  const instances: HTMLElement[] = [];
  const callbacks = createWcDemoCallbacks(() => ownsLease(opt, lease));
  let cleanup: ReturnType<NonNullable<typeof demo.setup>>;

  // Own resources before connecting instances or calling setup: either can
  // fail or reenter the host, including after moving a portal out of its tree.
  if (
    !lease.commit(() => {
      const currentCleanup = cleanup;
      cleanup = undefined;
      const cleanupSteps: Array<() => void> = [
        () => dynamicCleanup(),
        () => callbacks.dispose(),
        () => {
          if (typeof currentCleanup === 'function') currentCleanup();
        },
      ];
      // A globally mounted overlay is no longer a physical descendant of the
      // preview host. Remove every rendered instance explicitly so portaled
      // parts disconnect and dispose together with their logical demo tree.
      for (let index = instances.length - 1; index >= 0; index -= 1) {
        const instance = instances[index];
        if (instance) cleanupSteps.push(() => instance.remove());
      }
      cleanupSteps.push(() => associations.dispose());
      cleanupSteps.push(() => {
        for (const ref of Object.keys(refs)) delete refs[ref];
      });
      runCleanupSteps(cleanupSteps);
    })
  )
    return EMPTY_DEMO_RENDER;

  renderDemoNodeWc(demo.root, host, instances, associations, () => ownsLease(opt, lease));
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  for (const instance of instances) instance.setAttribute('data-demo-owner', owner);
  for (const element of host.querySelectorAll('[data-demo-ref]'))
    element.setAttribute('data-demo-owner', owner);
  refs = ownedDemoRefs(host, owner);
  const api: DemoRuntimeApi = {
    setChildren: (ref, children) => dynamicQueue!.setChildren(ref, children),
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease)) return;
      const el = refs[ref];
      const surface = el && wcSurfaceProps.get(el);
      if (!surface) return;
      surface.surfaceStyle = next;
      api.setProps(ref, {});
    },
    call(ref, path, ...args) {
      if (!ownsLease(opt, lease)) return;
      const el = refs[ref] as DemoInstance & HTMLElement;
      if (!el) return;
      const exposes = el.getExposes?.() ?? {};
      const fn = resolvePath(exposes, path);
      if (typeof fn !== 'function') return;
      return fn(...args);
    },
    getExposes(ref) {
      if (!ownsLease(opt, lease)) return;
      const el = refs[ref] as DemoInstance & HTMLElement;
      return el?.getExposes?.();
    },
    removeProps(ref, names) {
      if (!ownsLease(opt, lease)) return;
      const el = refs[ref];
      const current = el && wcRawProps.get(el);
      if (!current) return;
      const keys = [...names];
      if (!ownsLease(opt, lease)) return;
      // Authored callbacks are owned listeners in WC, so withdrawal retires
      // those bindings before projecting the full raw snapshot.
      callbacks.patch(el, Object.fromEntries(keys.map((name) => [name, undefined])));
      if (!ownsLease(opt, lease)) return;
      for (const name of keys) delete current[name];
      api.setProps(ref, {});
    },
    setProps(ref, next) {
      if (!ownsLease(opt, lease)) return;
      const el = refs[ref] as DemoInstance &
        HTMLElement & { setProps?(v: Record<string, unknown>): void; update?(): void };
      if (!el) return;
      const current = wcRawProps.get(el);
      if (!current) return;
      // Keep every original prop, including ordinary function-valued props.
      // The additive callback projection does not inspect private declarations
      // or reinterpret getExposes(), which intentionally omits event metadata.
      // Read caller-owned getters once, then recheck before acquiring resources.
      const patch = { ...next };
      if (!ownsLease(opt, lease)) return;
      callbacks.patch(el, patch);
      if (!ownsLease(opt, lease)) return;
      // DemoRuntimeApi updates are patches. The WC adapter deliberately accepts
      // full snapshots, so retain the authored props before projecting one.
      Object.assign(current, patch);
      el.setProps?.({ ...current, ...(wcSurfaceProps.get(el) ?? {}) });
      if (ownsLease(opt, lease)) el.update?.();
    },
  };

  type WcOwnedNode = { authored: DemoChild; node: Node; children: WcOwnedNode[] };
  const managed = new Map<string, Map<number, WcOwnedNode>>();
  const dynamicRefsOwned = new Set<string>();
  const kind = (node: DemoChild): string =>
    typeof node === 'string' || node.kind === 'text'
      ? 'text'
      : node.kind === 'box'
        ? `box:${node.tag ?? 'div'}`
        : `proto:${node.prototypeId}:${node.rootTag ?? 'div'}`;
  const textValue = (node: DemoChild) =>
    typeof node === 'string' ? node : node.kind === 'text' ? node.text : '';
  const childKey = (node: DemoChild, index: number) =>
    typeof node !== 'string' && node.kind !== 'text' && node.ref
      ? `ref:${node.ref}`
      : `index:${index}`;
  function retireOwned(record: WcOwnedNode) {
    const authored = record.authored;
    const steps: Array<() => void> = record.children.map((child) => () => retireOwned(child));
    if (typeof authored !== 'string' && authored.kind !== 'text') {
      if (authored.ref)
        steps.push(() => {
          if (refs[authored.ref!] === record.node) delete refs[authored.ref!];
        });
      if (authored.kind === 'proto') {
        const element = record.node as HTMLElement;
        steps.push(() => callbacks.release(element));
        steps.push(() => {
          wcRawProps.delete(element);
          wcSurfaceProps.delete(element);
          const index = instances.indexOf(element);
          if (index >= 0) instances.splice(index, 1);
        });
      }
    }
    steps.push(() => {
      record.node.parentNode?.removeChild(record.node);
    });
    runCleanupSteps(steps);
  }

  function createOwned(authored: DemoChild): WcOwnedNode {
    const document = host.ownerDocument;
    if (typeof authored === 'string' || authored.kind === 'text')
      return { authored, node: document.createTextNode(textValue(authored)), children: [] };
    const element =
      authored.kind === 'box'
        ? document.createElement(authored.tag ?? 'div')
        : document.createElement(
            ensurePreviewWcRegistered(authored.prototypeId, getPrototype(authored.prototypeId))
          );
    const record: WcOwnedNode = { authored, node: element, children: [] };
    element.setAttribute('data-demo-owner', owner);
    if (authored.ref) element.setAttribute('data-demo-ref', authored.ref);
    if (authored.kind === 'box') {
      for (const [name, value] of Object.entries(authored.attrs ?? {}))
        element.setAttribute(name, value);
      if (authored.className) element.className = authored.className;
    } else {
      instances.push(element);
      const surface = { surfaceClassName: authored.className, surfaceStyle: authored.surfaceStyle };
      wcSurfaceProps.set(element, surface);
      wcRawProps.set(element, { ...(authored.props ?? {}) });
      setElementAssociations(element, associations.resolve(authored.associations) ?? {});
      setElementProps(element, { ...(authored.props ?? {}), ...surface });
    }
    element.setAttribute('data-demo-owner', owner);
    if (authored.ref) element.setAttribute('data-demo-ref', authored.ref);
    else element.removeAttribute('data-demo-ref');
    for (const child of authored.children ?? []) {
      const rendered = createOwned(child);
      record.children.push(rendered);
      element.appendChild(rendered.node);
    }
    return record;
  }
  function placeOwned(
    parent: HTMLElement,
    ordered: readonly WcOwnedNode[],
    current: () => boolean
  ) {
    if (!current()) return;
    // Existing nested authored slots retain shape in this first public version.
    // A same-order list (including Adapter-projected children) needs no moves.
    const present = ordered.filter((record) => parent.contains(record.node));
    if (
      present.length === ordered.length &&
      present.every(
        (record, index) =>
          index === 0 ||
          !!(
            present[index - 1]!.node.compareDocumentPosition(record.node) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
      )
    )
      return;
    let anchor: Node | null = null;
    for (let index = ordered.length - 1; index >= 0; index--) {
      if (!current()) return;
      const node = ordered[index]!.node;
      // Portaled descendants remain owned for disposal, never reclaimed.
      if (node.isConnected && !parent.contains(node)) continue;
      if (node.parentNode === parent && node.nextSibling === anchor) {
        anchor = node;
        continue;
      }
      if (anchor && anchor.parentNode !== parent)
        throw new Error('[PrototypePreviewer] nested dynamic structure changes require a new key');
      const move = (
        parent as HTMLElement & { moveBefore?: (node: Node, before: Node | null) => void }
      ).moveBefore;
      if (typeof move === 'function' && node.isConnected && parent.isConnected)
        move.call(parent, node, anchor);
      else parent.insertBefore(node, anchor);
      if (!current()) return;
      anchor = node;
    }
  }

  function patchOwned(record: WcOwnedNode, next: DemoChild, current: () => boolean): WcOwnedNode {
    if (!current()) return record;
    if (kind(record.authored) !== kind(next)) {
      const replacement = createOwned(next);
      retireOwned(record);
      return replacement;
    }
    const previous = record.authored;
    if (typeof next === 'string' || next.kind === 'text') {
      if (record.node.textContent !== textValue(next)) record.node.textContent = textValue(next);
      record.authored = next;
      return record;
    }
    if (typeof previous === 'string' || previous.kind === 'text')
      throw new Error('Unexpected dynamic node identity');
    const element = record.node as HTMLElement;
    if (previous.ref !== next.ref) {
      if (previous.ref && refs[previous.ref] === element) delete refs[previous.ref];
      if (next.ref) element.setAttribute('data-demo-ref', next.ref);
      else element.removeAttribute('data-demo-ref');
    }
    if (next.kind === 'box' && previous.kind === 'box') {
      for (const name of Object.keys(previous.attrs ?? {}))
        if (!Object.hasOwn(next.attrs ?? {}, name)) element.removeAttribute(name);
      for (const [name, value] of Object.entries(next.attrs ?? {}))
        element.setAttribute(name, value);
      if (next.className) element.className = next.className;
      else element.removeAttribute('class');
    } else if (next.kind === 'proto' && previous.kind === 'proto') {
      const sameRef = previous.ref === next.ref;
      if (!sameRef) callbacks.release(element);
      const props = sameRef ? { ...(wcRawProps.get(element) ?? {}) } : {};
      for (const name of Object.keys(previous.props ?? {}))
        if (!Object.hasOwn(next.props ?? {}, name)) delete props[name];
      Object.assign(props, next.props ?? {});
      const previousSurface = wcSurfaceProps.get(element);
      const surface = {
        surfaceClassName: next.className,
        surfaceStyle:
          sameRef && previousSurface?.surfaceStyle !== previous.surfaceStyle
            ? previousSurface?.surfaceStyle
            : next.surfaceStyle,
      };
      const previousProps = wcRawProps.get(element) ?? {};
      callbacks.patch(element, {
        ...props,
        ...Object.fromEntries(
          Object.keys(previousProps)
            .filter((name) => !Object.hasOwn(props, name))
            .map((name) => [name, undefined])
        ),
      });
      if (!current()) return record;
      wcRawProps.set(element, props);
      wcSurfaceProps.set(element, surface);
      setElementAssociations(element, associations.resolve(next.associations) ?? {});
      if (!current()) return record;
      setElementProps(element, { ...props, ...surface });
      if (current()) (element as HTMLElement & DemoInstance).update?.();
    }
    if (!current()) return record;
    element.setAttribute('data-demo-owner', owner);
    if (next.ref) element.setAttribute('data-demo-ref', next.ref);
    else element.removeAttribute('data-demo-ref');
    const oldChildren = new Map(
      record.children.map((child, index) => [childKey(child.authored, index), child])
    );
    const children: WcOwnedNode[] = [];
    for (const [index, child] of (next.children ?? []).entries()) {
      if (!current()) return record;
      const key = childKey(child, index),
        old = oldChildren.get(key);
      if (old) oldChildren.delete(key);
      children.push(old ? patchOwned(old, child, current) : createOwned(child));
    }
    for (const old of oldChildren.values()) retireOwned(old);
    if (!current()) return record;
    placeOwned(element, children, current);
    if (!current()) return record;
    record.children = children;
    record.authored = next;
    return record;
  }
  const publishDynamicRefs = () => {
    for (const ref of dynamicRefsOwned) delete refs[ref];
    dynamicRefsOwned.clear();
    const visit = (record: WcOwnedNode) => {
      const node = record.authored;
      if (typeof node !== 'string' && node.kind !== 'text' && node.ref) {
        refs[node.ref] = record.node as HTMLElement;
        dynamicRefsOwned.add(node.ref);
      }
      for (const child of record.children) visit(child);
    };
    for (const slot of managed.values()) for (const record of slot.values()) visit(record);
  };
  dynamicQueue = createDynamicCommitQueue(
    dynamic,
    () => ownsLease(opt, lease),
    async (tx, current) => {
      try {
        if (!current()) return;
        const parent = refs[tx.slotRef];
        if (!parent) throw new Error(`[PrototypePreviewer] missing dynamic slot ${tx.slotRef}`);
        const old = managed.get(tx.slotRef) ?? new Map<number, WcOwnedNode>();
        const next = new Map<number, WcOwnedNode>();
        for (const entry of tx.entries) {
          if (!current()) return;
          const record = old.get(entry.identity);
          next.set(
            entry.identity,
            record ? patchOwned(record, entry.node, current) : createOwned(entry.node)
          );
        }
        for (const [identity, record] of old) if (!next.has(identity)) retireOwned(record);
        if (!current()) return;
        managed.set(tx.slotRef, next);
        placeOwned(parent, [...next.values()], current);
        if (!current()) return;
        // Let the existing Adapter project newly authored slot children; this is
        // not an assertion that every asynchronous Prototype effect has settled.
        await Promise.resolve();
        if (!current()) return;
        publishDynamicRefs();
      } catch (error) {
        // A host failure is terminal for this render, never a partially healthy
        // committed tree. Invalid authored updates were rejected before mutation.
        revokeFailedDemoRender(lease, error);
      }
    },
    () => {
      if (!ownsLease(opt, lease)) return;
      try {
        associations.reconcile(
          associationKeys(
            dynamic.root,
            dynamic.slotRefs.map((ref) => dynamic.getCommitted(ref))
          )
        );
      } catch (error) {
        revokeFailedDemoRender(lease, error);
      }
    }
  );
  dynamicCleanup = () => {
    dynamicQueue?.dispose();
    const steps: Array<() => void> = [];
    for (const slot of managed.values())
      for (const record of slot.values()) steps.push(() => retireOwned(record));
    steps.push(() => {
      managed.clear();
      for (const ref of dynamicRefsOwned) delete refs[ref];
      dynamicRefsOwned.clear();
      dynamic.dispose();
    });
    runCleanupSteps(steps);
  };

  const setupCleanup = demo.setup?.({ host, refs, api });
  if (!ownsLease(opt, lease)) {
    if (typeof setupCleanup === 'function') setupCleanup();
    return abandonLease(lease);
  }
  cleanup = setupCleanup;

  return {
    destroy: () => {
      lease.release();
    },
  };
}

let nextDemoOwner = 0;
// The generated token contains only CSS identifier characters. It is an
// ownership marker, not a style rule or security boundary. Native boxes/WC
// retain their directly owned data marker; framework prototypes consume the
// adapters' existing generic host-class channel (not a new demo-only prop).
function demoOwnerSelector(owner: string): string {
  return `[data-demo-owner="${owner}"], .pui-owner-${owner}`;
}
function demoOwnedRefSelector(owner: string): string {
  return `[data-demo-owner="${owner}"][data-demo-ref], .pui-owner-${owner}[data-demo-ref]`;
}
function demoOwnerHostClass(authored: unknown, owner: string): string {
  return [typeof authored === 'string' ? authored : '', `pui-owner-${owner}`]
    .filter(Boolean)
    .join(' ');
}
function ownedDemoRefs(host: HTMLElement, owner: string): Record<string, HTMLElement> {
  const refs: Record<string, HTMLElement> = Object.create(null);
  const selector = demoOwnedRefSelector(owner);
  const nodes = new Set([
    ...host.querySelectorAll<HTMLElement>(selector),
    ...host.ownerDocument.querySelectorAll<HTMLElement>(selector),
  ]);
  if (host.matches(selector)) nodes.add(host);
  for (const node of nodes) {
    const ref = node.getAttribute('data-demo-ref');
    if (ref) refs[ref] = node;
  }
  return refs;
}
function publishDemoRefs(target: Record<string, HTMLElement>, next: Record<string, HTMLElement>) {
  for (const ref of Object.keys(target)) if (!Object.hasOwn(next, ref)) delete target[ref];
  Object.assign(target, next);
}
function observeOwnedDemoRefs(
  host: HTMLElement,
  owner: string,
  refs: Record<string, HTMLElement>,
  current: () => boolean
): () => void {
  const selector = demoOwnerSelector(owner);
  const Observer = host.ownerDocument.defaultView?.MutationObserver;
  if (!Observer) return () => {};
  const containsOwner = (node: Node) =>
    node.nodeType === 1 &&
    ((node as Element).matches(selector) || !!(node as Element).querySelector(selector));
  const observer = new Observer((records) => {
    if (!current()) return;
    if (
      !records.some((record) => [...record.addedNodes, ...record.removedNodes].some(containsOwner))
    )
      return;
    const next = ownedDemoRefs(host, owner);
    if (current()) publishDemoRefs(refs, next);
  });
  observer.observe(host, { childList: true, subtree: true });
  if (host.ownerDocument.documentElement)
    observer.observe(host.ownerDocument.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}
function associationKeys(
  root: DemoChild,
  entries: Iterable<readonly DynamicChildEntry[]>
): Set<string> {
  const keys = new Set<string>();
  const walk = (node: DemoChild) => {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto' && node.associations) keys.add(node.associations.controlLabel);
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  for (const children of entries) for (const entry of children) walk(entry.node);
  return keys;
}
function dynamicRefs(entries: readonly DynamicChildEntry[]) {
  const refs = new Map<string, { node: Exclude<DemoNode, { kind: 'text' }>; identity: string }>();
  const walk = (node: DemoChild, owner: number) => {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.ref)
      refs.set(node.ref, {
        node,
        identity: `${owner}:${node.kind}:${node.kind === 'proto' ? node.prototypeId + ':' + (node.rootTag ?? 'div') : (node.tag ?? 'div')}`,
      });
    for (const child of node.children ?? []) walk(child, owner);
  };
  for (const entry of entries) walk(entry.node, entry.identity);
  return refs;
}
/** Retain imperative-only callback patches, replace the incoming authored snapshot. */
function reconcileDynamicProps(
  previous: readonly DynamicChildEntry[],
  next: readonly DynamicChildEntry[],
  get: (ref: string) => Record<string, unknown> | undefined,
  put: (ref: string, props: Record<string, unknown>) => void,
  retire: (ref: string) => void
) {
  const before = dynamicRefs(previous),
    after = dynamicRefs(next);
  for (const [ref, old] of before) if (after.get(ref)?.identity !== old.identity) retire(ref);
  for (const [ref, current] of after) {
    if (current.node.kind !== 'proto') continue;
    const old = before.get(ref);
    const retained = old?.identity === current.identity && old.node.kind === 'proto';
    const props = retained ? { ...(get(ref) ?? {}) } : {};
    if (retained && old.node.kind === 'proto')
      for (const key of Object.keys(old.node.props ?? {}))
        if (!Object.hasOwn(current.node.props ?? {}, key)) delete props[key];
    Object.assign(props, current.node.props ?? {});
    put(ref, props);
  }
}

async function renderDemoReact(
  opt: DemoRenderOptions,
  lease: HostMountLease
): Promise<DemoRenderResult> {
  const { host, demo } = opt;
  const associations = createDemoAssociationScope();
  const dynamic = createDynamicChildrenModel(demo);
  for (const prototypeId of dynamic.prototypeIds) getPrototype(prototypeId);
  const owner = `demo-${++nextDemoOwner}`;
  const renderedSlots = new Map<string, readonly DynamicChildEntry[]>();
  let dynamicQueue: ReturnType<typeof createDynamicCommitQueue> | undefined;
  const refs: Record<string, HTMLElement> = Object.create(null);
  let stopRefObservation: (() => void) | undefined;

  // Non-WC modules join the graph only when this runtime is selected. A
  // superseded owner must not proceed to CDN loading after that import boundary.
  const [{ createReactAdapter }, { loadReact }] = await reactModules();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const { React, ReactDOM } = await loadReact();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const adapter = createReactAdapter({
    ...React,
    createPortal: ReactDOM.createPortal,
  } as unknown as ReactRuntime);

  const componentRefs = new Map<string, DemoInstance>();
  const propsMap = new Map<string, Record<string, unknown>>();
  const surfaceStyles = new Map<string, DemoSurfaceStyle>();
  // DemoBoxAttrs are native string attributes, not React boolean/style props.
  // Keep presence values and native CSS declaration strings in the initial
  // commit before Demo setup. Native style preserves order and !important;
  // the Prototype surfaceStyle map converter intentionally cannot carry priority.
  const nativeStringAttributes = new Set(['hidden', 'inert', 'itemscope', 'style']);
  const boxAttributeRefs = new WeakMap<object, (element: HTMLElement | null) => void>();

  function initProps(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'box') {
      const nativeAttributes = Object.entries(node.attrs ?? {}).filter(([name]) =>
        nativeStringAttributes.has(name.toLowerCase())
      );
      if (nativeAttributes.length) {
        // A stable ref runs on mount, not on every prototype props update:
        // setup may subsequently own native state/style, as Copy does.
        boxAttributeRefs.set(node, (element) => {
          if (element)
            for (const [name, value] of nativeAttributes) element.setAttribute(name, value);
        });
      }
    }
    if (node.kind === 'proto' && node.ref) {
      propsMap.set(node.ref, { ...(node.props ?? {}) });
    }
    for (const child of node.children ?? []) initProps(child);
  }
  initProps(demo.root);
  const dynamicNativeAttrs = new WeakMap<HTMLElement, Set<string>>();
  function initDynamicBoxRefs(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'box') {
      const attrs = Object.entries(node.attrs ?? {}).filter(([name]) =>
        nativeStringAttributes.has(name.toLowerCase())
      );
      boxAttributeRefs.set(node, (element) => {
        if (!element || !ownsLease(opt, lease)) return;
        const names = new Set(attrs.map(([name]) => name));
        for (const old of dynamicNativeAttrs.get(element) ?? [])
          if (!names.has(old)) element.removeAttribute(old);
        for (const [name, value] of attrs) element.setAttribute(name, value);
        dynamicNativeAttrs.set(element, names);
      });
    }
    for (const child of node.children ?? []) initDynamicBoxRefs(child);
  }

  function childNodes(node: Exclude<DemoNode, { kind: 'text' }>): any[] {
    if (node.kind === 'box' && node.dynamicChildren && node.ref)
      return (renderedSlots.get(node.ref) ?? []).map((entry) =>
        renderNode(entry.node, entry.identity)
      );
    return (node.children ?? []).map((child, index) =>
      renderNode(
        child,
        typeof child !== 'string' && child.kind !== 'text' ? (child.ref ?? index) : index
      )
    );
  }
  function renderNode(node: DemoChild, key?: string | number): any {
    if (typeof node === 'string') return node;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'box') {
      const kids = childNodes(node);
      return React.createElement(
        node.tag ?? 'div',
        {
          ...Object.fromEntries(
            Object.entries(node.attrs ?? {}).filter(
              ([name]) => !nativeStringAttributes.has(name.toLowerCase())
            )
          ),
          key,
          className: node.className,
          'data-demo-ref': node.ref,
          'data-demo-owner': owner,
          ref: boxAttributeRefs.get(node),
        },
        ...kids
      );
    }

    const proto = getPrototype(node.prototypeId);
    const scopedCache = getScopedComponentCache(reactComponentCache, adapter);
    const componentKey = `${node.prototypeId}:${node.rootTag ?? 'div'}`;
    let Component = scopedCache.get(componentKey);
    if (!Component) {
      Component = adapter(proto as Prototype<PropsBaseType>, {
        rootTag: node.rootTag,
        createVisualSink: createPreviewMaterialSink,
        residentMotion: { palette: createCanonicalMotionPalette },
      });
      scopedCache.set(componentKey, Component);
    }
    const kids = childNodes(node);
    // Refs are initialized with all authored props once. Reapplying node.props
    // here would resurrect a key explicitly withdrawn through removeProps.
    const mergedProps: Record<string, unknown> = {
      ...(node.ref ? (propsMap.get(node.ref) ?? {}) : (node.props ?? {})),
    };
    if (node.ref) {
      mergedProps['data-demo-ref'] = node.ref;
      mergedProps.ref = (instance: unknown) => {
        if (!ownsLease(opt, lease)) return;
        if (instance) componentRefs.set(node.ref!, instance as DemoInstance);
        else componentRefs.delete(node.ref!);
      };
    }
    mergedProps.hostClassName = demoOwnerHostClass(mergedProps.hostClassName, owner);
    mergedProps.key = key;
    mergedProps.instanceAssociations = associations.resolve(node.associations);
    if (node.className) mergedProps.surfaceClassName = node.className;
    const surfaceStyle = (node.ref ? surfaceStyles.get(node.ref) : undefined) ?? node.surfaceStyle;
    if (surfaceStyle) {
      mergedProps.surfaceStyle = normalizeReactSurfaceStyle(surfaceStyle, host.ownerDocument);
    }
    return React.createElement(Component, mergedProps as Record<string, unknown>, ...kids);
  }

  const root = (
    ReactDOM as {
      createRoot(el: HTMLElement): { render: (el: unknown) => void; unmount: () => void };
    }
  ).createRoot(host);
  let cleanup: void | (() => void);
  const pendingRefreshFrames = new Set<number>();
  if (
    !lease.commit(() => {
      for (const frame of pendingRefreshFrames) cancelAnimationFrame(frame);
      pendingRefreshFrames.clear();
      stopRefObservation?.();
      dynamicQueue?.dispose();
      dynamic.dispose();
      const currentCleanup = cleanup;
      cleanup = undefined;
      runCleanupSteps([
        () => {
          if (typeof currentCleanup === 'function') currentCleanup();
        },
        () => root.unmount(),
        () => {
          propsMap.clear();
          surfaceStyles.clear();
          componentRefs.clear();
          renderedSlots.clear();
          for (const ref of Object.keys(refs)) delete refs[ref];
        },
        () => associations.dispose(),
      ]);
    })
  ) {
    return EMPTY_DEMO_RENDER;
  }

  const flushSync = (ReactDOM as { flushSync?: <R>(callback: () => R) => R }).flushSync;
  const flushReact = <T>(fn: () => T): T =>
    typeof flushSync === 'function' ? flushSync(fn) : fn();

  function renderTree() {
    return renderNode(demo.root);
  }

  // Demo setup reads DOM refs and Proto exposes immediately after initial
  // mount. A fixed number of animation frames is not a readiness guarantee
  // when Demo Matrix mounts many React roots concurrently.
  flushReact(() => root.render(renderTree()));

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  publishDemoRefs(refs, ownedDemoRefs(host, owner));

  const api: DemoRuntimeApi = {
    setChildren: (ref, children) => dynamicQueue!.setChildren(ref, children),
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease) || !propsMap.has(ref)) return;
      surfaceStyles.set(ref, next);
      api.setProps(ref, {});
    },
    call(ref, path, ...args) {
      if (!ownsLease(opt, lease)) return;
      const inst = componentRefs.get(ref);
      if (!inst) return;
      const exposes = inst.getExposes?.() ?? {};
      const fn = resolvePath(exposes, path);
      if (typeof fn !== 'function') return;
      let result: unknown;
      flushReact(() => {
        result = callInScope(inst, () => fn(...args));
        inst.update?.();
      });
      return result;
    },
    getExposes(ref) {
      if (!ownsLease(opt, lease)) return;
      const inst = componentRefs.get(ref);
      return inst?.getExposes?.();
    },
    removeProps(ref, names) {
      if (!ownsLease(opt, lease)) return;
      const current = propsMap.get(ref);
      if (!current) return;
      const keys = [...names];
      if (!ownsLease(opt, lease)) return;
      for (const name of keys) delete current[name];
      api.setProps(ref, {});
    },
    setProps(ref, next) {
      if (!ownsLease(opt, lease)) return;
      const current = propsMap.get(ref);
      if (!current) return;
      Object.assign(current, next);
      flushReact(() => root.render(renderTree()));
      // An owner refresh can close its event gate until React commits the
      // resulting effects. Finish that commit before a materializer may
      // expose this generation, just as public calls above already do.
      flushReact(() => componentRefs.get(ref)?.update?.());
      if (typeof flushSync !== 'function') {
        // Older renderers without a synchronous commit still need the retained
        // owner refreshed after props delivery. This frame belongs to the lease.
        const frame = requestAnimationFrame(() => {
          pendingRefreshFrames.delete(frame);
          if (ownsLease(opt, lease)) componentRefs.get(ref)?.update?.();
        });
        pendingRefreshFrames.add(frame);
      }
    },
  };

  dynamicQueue = createDynamicCommitQueue(
    dynamic,
    () => ownsLease(opt, lease),
    async (tx, current) => {
      if (!current()) return;
      try {
        reconcileDynamicProps(
          renderedSlots.get(tx.slotRef) ?? [],
          tx.entries,
          (ref) => propsMap.get(ref),
          (ref, props) => {
            propsMap.set(ref, props);
          },
          (ref) => {
            propsMap.delete(ref);
            surfaceStyles.delete(ref);
            componentRefs.delete(ref);
          }
        );
        for (const entry of tx.entries) initDynamicBoxRefs(entry.node);
        renderedSlots.set(tx.slotRef, tx.entries);
        if (!current()) return;
        if (typeof flushSync !== 'function')
          throw new Error('[PrototypePreviewer] dynamic React children require public flushSync');
        flushReact(() => root.render(renderTree()));
        if (!current()) return;
        publishDemoRefs(refs, ownedDemoRefs(host, owner));
        if (!current()) return;
      } catch (error) {
        // A framework commit may have partially mutated its host. Fail closed:
        // never leave a partially committed tree claiming a healthy model.
        revokeFailedDemoRender(lease, error);
      }
    },
    () => {
      if (!ownsLease(opt, lease)) return;
      try {
        associations.reconcile(
          associationKeys(
            dynamic.root,
            dynamic.slotRefs.map((ref) => dynamic.getCommitted(ref))
          )
        );
      } catch (error) {
        revokeFailedDemoRender(lease, error);
      }
    }
  );

  stopRefObservation = dynamic.slotRefs.length
    ? observeOwnedDemoRefs(host, owner, refs, () => ownsLease(opt, lease))
    : () => {};
  cleanup = demo.setup?.({ host, refs, api });

  return {
    destroy: () => {
      lease.release();
    },
  };
}

async function renderDemoVue(
  opt: DemoRenderOptions,
  lease: HostMountLease
): Promise<DemoRenderResult> {
  const { host, demo } = opt;
  const associations = createDemoAssociationScope();
  const dynamic = createDynamicChildrenModel(demo);
  for (const prototypeId of dynamic.prototypeIds) getPrototype(prototypeId);
  const owner = `demo-${++nextDemoOwner}`;
  const renderedSlots = new Map<string, readonly DynamicChildEntry[]>();
  let dynamicQueue: ReturnType<typeof createDynamicCommitQueue> | undefined;
  const refs: Record<string, HTMLElement> = Object.create(null);
  let stopRefObservation: (() => void) | undefined;

  const [{ createVueAdapter }, { loadVue }] = await vueModules();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const Vue = await loadVue();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const adapter = createVueAdapter(Vue as unknown as AdapterVueRuntime);

  const componentRefs = new Map<string, DemoInstance>();
  const propsMap = Vue.reactive<Record<string, Record<string, unknown>>>(Object.create(null));
  const surfaceStyles = Vue.reactive<Record<string, DemoSurfaceStyle>>(Object.create(null));

  function initProps(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto' && node.ref) {
      propsMap[node.ref] = { ...(node.props ?? {}) };
    }
    for (const child of node.children ?? []) initProps(child);
  }
  initProps(demo.root);

  const slotEpoch = Vue.reactive({ value: 0 });
  function childNodes(node: Exclude<DemoNode, { kind: 'text' }>): any[] {
    void slotEpoch.value;
    if (node.kind === 'box' && node.dynamicChildren && node.ref)
      return (renderedSlots.get(node.ref) ?? []).map((entry) =>
        renderNode(entry.node, entry.identity)
      );
    return (node.children ?? []).map((child, index) =>
      renderNode(
        child,
        typeof child !== 'string' && child.kind !== 'text' ? (child.ref ?? index) : index
      )
    );
  }
  function renderNode(node: DemoChild, key?: string | number): any {
    if (typeof node === 'string') return node;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'box') {
      const kids = childNodes(node);
      return Vue.h(
        node.tag ?? 'div',
        {
          ...node.attrs,
          key,
          class: node.className,
          'data-demo-ref': node.ref,
          'data-demo-owner': owner,
          ref: node.ref
            ? (el: unknown) => {
                if (!ownsLease(opt, lease)) return;
                if (el) componentRefs.set(node.ref!, el as DemoInstance);
                else componentRefs.delete(node.ref!);
              }
            : undefined,
        },
        kids
      );
    }

    const proto = getPrototype(node.prototypeId);
    const scopedCache = getScopedComponentCache(vueComponentCache, adapter);
    const componentKey = `${node.prototypeId}:${node.rootTag ?? 'div'}`;
    let Component = scopedCache.get(componentKey);
    if (!Component) {
      Component = adapter(proto as Prototype<PropsBaseType>, {
        rootTag: node.rootTag,
        createVisualSink: createPreviewMaterialSink,
        residentMotion: { palette: createCanonicalMotionPalette },
      });
      scopedCache.set(componentKey, Component);
    }
    const kids = childNodes(node);
    // Refs are initialized with all authored props once. Reapplying node.props
    // here would resurrect a key explicitly withdrawn through removeProps.
    const mergedProps: Record<string, unknown> = {
      ...(node.ref ? (propsMap[node.ref] ?? {}) : (node.props ?? {})),
    };
    if (node.ref) {
      mergedProps['data-demo-ref'] = node.ref;
      mergedProps.ref = (el: unknown) => {
        if (!ownsLease(opt, lease)) return;
        if (el) componentRefs.set(node.ref!, el as DemoInstance);
        else componentRefs.delete(node.ref!);
      };
    }
    mergedProps.hostClass = [mergedProps.hostClass, `pui-owner-${owner}`];
    mergedProps.key = key;
    mergedProps.instanceAssociations = associations.resolve(node.associations);
    if (node.className) mergedProps.surfaceClass = node.className;
    const surfaceStyle = (node.ref ? surfaceStyles[node.ref] : undefined) ?? node.surfaceStyle;
    if (surfaceStyle) mergedProps.surfaceStyle = surfaceStyle;
    return Vue.h(Component, mergedProps, () => kids);
  }

  const app = Vue.createApp({
    setup() {
      return () => renderNode(demo.root);
    },
  });

  app.mount(host);
  let cleanup: void | (() => void);
  if (
    !lease.commit(() => {
      stopRefObservation?.();
      dynamicQueue?.dispose();
      dynamic.dispose();
      const currentCleanup = cleanup;
      cleanup = undefined;
      runCleanupSteps([
        () => {
          if (typeof currentCleanup === 'function') currentCleanup();
        },
        () => app.unmount(),
        () => {
          for (const ref of Object.keys(propsMap)) delete propsMap[ref];
          for (const ref of Object.keys(surfaceStyles)) delete surfaceStyles[ref];
          componentRefs.clear();
          renderedSlots.clear();
          for (const ref of Object.keys(refs)) delete refs[ref];
        },
        () => associations.dispose(),
      ]);
    })
  ) {
    return EMPTY_DEMO_RENDER;
  }

  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  publishDemoRefs(refs, ownedDemoRefs(host, owner));

  const api: DemoRuntimeApi = {
    setChildren: (ref, children) => dynamicQueue!.setChildren(ref, children),
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease) || !propsMap[ref]) return;
      surfaceStyles[ref] = next;
    },
    call(ref, path, ...args) {
      if (!ownsLease(opt, lease)) return;
      const inst = componentRefs.get(ref);
      if (!inst) return;
      const exposes = inst.getExposes?.() ?? {};
      const fn = resolvePath(exposes, path);
      if (typeof fn !== 'function') return;
      const result = callInScope(inst, () => fn(...args));
      inst.update?.();
      return result;
    },
    getExposes(ref) {
      if (!ownsLease(opt, lease)) return;
      const inst = componentRefs.get(ref);
      return inst?.getExposes?.();
    },
    removeProps(ref, names) {
      if (!ownsLease(opt, lease) || !Object.hasOwn(propsMap, ref)) return;
      const keys = [...names];
      if (!ownsLease(opt, lease)) return;
      for (const name of keys) delete propsMap[ref][name];
      // Vue owns the reactive deletion commit just as it owns setProps.
    },
    setProps(ref, next) {
      if (!ownsLease(opt, lease)) return;
      if (propsMap[ref]) {
        Object.assign(propsMap[ref], next);
      }
      // The actual Vue adapter reconciles changed host props after its commit.
      // An additional controller update can replace that pending feedback
      // commit with an unchanged one and lose a later controlled prop's paint.
    },
  };

  dynamicQueue = createDynamicCommitQueue(
    dynamic,
    () => ownsLease(opt, lease),
    async (tx, current) => {
      if (!current()) return;
      try {
        reconcileDynamicProps(
          renderedSlots.get(tx.slotRef) ?? [],
          tx.entries,
          (ref) => propsMap[ref],
          (ref, props) => {
            propsMap[ref] = props;
          },
          (ref) => {
            delete propsMap[ref];
            delete surfaceStyles[ref];
            componentRefs.delete(ref);
          }
        );

        renderedSlots.set(tx.slotRef, tx.entries);
        if (!current()) return;
        slotEpoch.value++;
        await Vue.nextTick();
        if (!current()) return;
        publishDemoRefs(refs, ownedDemoRefs(host, owner));
        if (!current()) return;
      } catch (error) {
        // A framework commit may have partially mutated its host. Fail closed:
        // never leave a partially committed tree claiming a healthy model.
        revokeFailedDemoRender(lease, error);
      }
    },
    () => {
      if (!ownsLease(opt, lease)) return;
      try {
        associations.reconcile(
          associationKeys(
            dynamic.root,
            dynamic.slotRefs.map((ref) => dynamic.getCommitted(ref))
          )
        );
      } catch (error) {
        revokeFailedDemoRender(lease, error);
      }
    }
  );

  stopRefObservation = dynamic.slotRefs.length
    ? observeOwnedDemoRefs(host, owner, refs, () => ownsLease(opt, lease))
    : () => {};
  cleanup = demo.setup?.({ host, refs, api });

  return {
    destroy: () => {
      lease.release();
    },
  };
}

async function renderDemoVue2(
  opt: DemoRenderOptions,
  lease: HostMountLease
): Promise<DemoRenderResult> {
  const { host, demo } = opt;
  const associations = createDemoAssociationScope();
  const dynamic = createDynamicChildrenModel(demo);
  for (const prototypeId of dynamic.prototypeIds) getPrototype(prototypeId);
  const owner = `demo-${++nextDemoOwner}`;
  const renderedSlots = new Map<string, readonly DynamicChildEntry[]>();
  let dynamicQueue: ReturnType<typeof createDynamicCommitQueue> | undefined;
  const refs: Record<string, HTMLElement> = Object.create(null);
  let stopRefObservation: (() => void) | undefined;

  const [{ createVue2Adapter }, { loadVue2, toVue2ComponentData, toVue2Runtime }] =
    await vue2Modules();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const Vue = await loadVue2();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const adapter = createVue2Adapter(toVue2Runtime(Vue));

  const componentRefs = new Map<string, DemoInstance>();
  const componentRefNames = new Set<string>();
  const surfaceStyles = new Map<string, DemoSurfaceStyle>();
  const propsMap = (
    (Vue as any).observable ? (Vue as any).observable(Object.create(null)) : Object.create(null)
  ) as Record<string, Record<string, unknown>>;

  function setReactive(target: Record<string, unknown>, key: string, value: unknown) {
    if (typeof Vue.set === 'function') Vue.set(target, key, value);
    else target[key] = value;
  }

  function initProps(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto' && node.ref) {
      setReactive(propsMap, node.ref, { ...(node.props ?? {}) });
    }
    for (const child of node.children ?? []) initProps(child);
  }
  initProps(demo.root);

  function childNodes(node: Exclude<DemoNode, { kind: 'text' }>, h: any): any[] {
    if (node.kind === 'box' && node.dynamicChildren && node.ref)
      return (renderedSlots.get(node.ref) ?? []).map((entry) =>
        renderNode(entry.node, h, entry.identity)
      );
    return (node.children ?? []).map((child, index) =>
      renderNode(
        child,
        h,
        typeof child !== 'string' && child.kind !== 'text' ? (child.ref ?? index) : index
      )
    );
  }
  function renderNode(node: DemoChild, h: any, key?: string | number): any {
    if (typeof node === 'string') return node;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'box') {
      const kids = childNodes(node, h);
      return h(
        node.tag ?? 'div',
        {
          key,
          class: node.className,
          attrs: {
            ...node.attrs,
            'data-demo-ref': node.ref,
            'data-demo-owner': owner,
          },
        },
        kids
      );
    }

    const proto = getPrototype(node.prototypeId);
    const scopedCache = getScopedComponentCache(vueComponentCache, adapter);
    const componentKey = `${node.prototypeId}:${node.rootTag ?? 'div'}`;
    let Component = scopedCache.get(componentKey);
    if (!Component) {
      Component = adapter(proto as Prototype<PropsBaseType>, {
        rootTag: node.rootTag,
        createVisualSink: createPreviewMaterialSink,
        residentMotion: { palette: createCanonicalMotionPalette },
      });
      scopedCache.set(componentKey, Component);
    }
    const kids = childNodes(node, h);
    // Refs are initialized with all authored props once. Reapplying node.props
    // here would resurrect a key explicitly withdrawn through removeProps.
    const mergedProps: Record<string, unknown> = {
      ...(node.ref ? (propsMap[node.ref] ?? {}) : (node.props ?? {})),
    };
    if (node.ref) {
      componentRefNames.add(node.ref);
      mergedProps['data-demo-ref'] = node.ref;
    }
    mergedProps.hostClass = [mergedProps.hostClass, `pui-owner-${owner}`];
    mergedProps.instanceAssociations = associations.resolve(node.associations);
    if (node.className) mergedProps.surfaceClass = node.className;
    const surfaceStyle = (node.ref ? surfaceStyles.get(node.ref) : undefined) ?? node.surfaceStyle;
    if (surfaceStyle) mergedProps.surfaceStyle = surfaceStyle;

    const data = { ...toVue2ComponentData(mergedProps), key };
    if (node.ref) data.ref = node.ref;
    return h(Component, data, kids);
  }

  function refreshComponentRefs(rootVm: any) {
    for (const ref of componentRefNames) {
      const value = rootVm.$refs?.[ref];
      const inst = Array.isArray(value) ? value[0] : value;
      if (inst) componentRefs.set(ref, inst as DemoInstance);
      else componentRefs.delete(ref);
    }
  }

  const Root = Vue.extend({
    render(h: any) {
      return renderNode(demo.root, h);
    },
  });

  // Vue2 runs descendant mounted hooks inside $mount. Attach its replacement
  // point first so first-commit host capabilities see the actual owner ancestry.
  // Vue2 replaces this point with the authored root; no extra wrapper remains.
  const mountPoint = host.ownerDocument.createElement('div');
  host.appendChild(mountPoint);
  const app = new Root().$mount(mountPoint);
  let cleanup: void | (() => void);
  if (
    !lease.commit(() => {
      stopRefObservation?.();
      dynamicQueue?.dispose();
      dynamic.dispose();
      const currentCleanup = cleanup;
      cleanup = undefined;
      runCleanupSteps([
        () => {
          if (typeof currentCleanup === 'function') currentCleanup();
        },
        () => app.$destroy(),
        () => {
          for (const ref of Object.keys(propsMap)) delete propsMap[ref];
          surfaceStyles.clear();
          componentRefNames.clear();
          componentRefs.clear();
          renderedSlots.clear();
          for (const ref of Object.keys(refs)) delete refs[ref];
        },
        () => associations.dispose(),
      ]);
    })
  ) {
    return EMPTY_DEMO_RENDER;
  }

  await nextVue2(Vue);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  refreshComponentRefs(app);
  publishDemoRefs(refs, ownedDemoRefs(host, owner));

  const api: DemoRuntimeApi = {
    setChildren: (ref, children) => dynamicQueue!.setChildren(ref, children),
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease) || !propsMap[ref]) return;
      surfaceStyles.set(ref, next);
      app.$forceUpdate?.();
    },
    call(ref, path, ...args) {
      if (!ownsLease(opt, lease)) return;
      refreshComponentRefs(app);
      const inst = componentRefs.get(ref);
      if (!inst) return;
      const exposes = inst.getExposes?.() ?? {};
      const fn = resolvePath(exposes, path);
      if (typeof fn !== 'function') return;
      const result = callInScope(inst, () => fn(...args));
      inst.update?.();
      return result;
    },
    getExposes(ref) {
      if (!ownsLease(opt, lease)) return;
      refreshComponentRefs(app);
      const inst = componentRefs.get(ref);
      return inst?.getExposes?.();
    },
    removeProps(ref, names) {
      if (!ownsLease(opt, lease) || !Object.hasOwn(propsMap, ref)) return;
      const keys = [...names];
      if (!ownsLease(opt, lease)) return;
      for (const name of keys) {
        if (typeof Vue.delete === 'function') Vue.delete(propsMap[ref], name);
        else delete propsMap[ref][name];
      }
      app.$forceUpdate?.();
    },
    setProps(ref, next) {
      if (!ownsLease(opt, lease)) return;
      if (!Object.hasOwn(propsMap, ref)) return;
      for (const [key, value] of Object.entries(next)) {
        setReactive(propsMap[ref], key, value);
      }
      app.$forceUpdate?.();
      // Vue2's adapter owns host-prop notification and the resulting update.
      // Public call/getExposes refresh component refs when they are consumed.
    },
  };

  dynamicQueue = createDynamicCommitQueue(
    dynamic,
    () => ownsLease(opt, lease),
    async (tx, current) => {
      if (!current()) return;
      try {
        reconcileDynamicProps(
          renderedSlots.get(tx.slotRef) ?? [],
          tx.entries,
          (ref) => propsMap[ref],
          (ref, props) => {
            setReactive(propsMap, ref, props);
          },
          (ref) => {
            if (typeof Vue.delete === 'function') Vue.delete(propsMap, ref);
            else delete propsMap[ref];
            surfaceStyles.delete(ref);
            componentRefNames.delete(ref);
            componentRefs.delete(ref);
          }
        );

        renderedSlots.set(tx.slotRef, tx.entries);
        if (!current()) return;
        app.$forceUpdate();
        await nextVue2(Vue);
        if (current()) refreshComponentRefs(app);
        if (!current()) return;
        publishDemoRefs(refs, ownedDemoRefs(host, owner));
        if (!current()) return;
      } catch (error) {
        // A framework commit may have partially mutated its host. Fail closed:
        // never leave a partially committed tree claiming a healthy model.
        revokeFailedDemoRender(lease, error);
      }
    },
    () => {
      if (!ownsLease(opt, lease)) return;
      try {
        associations.reconcile(
          associationKeys(
            dynamic.root,
            dynamic.slotRefs.map((ref) => dynamic.getCommitted(ref))
          )
        );
      } catch (error) {
        revokeFailedDemoRender(lease, error);
      }
    }
  );

  stopRefObservation = dynamic.slotRefs.length
    ? observeOwnedDemoRefs(host, owner, refs, () => ownsLease(opt, lease))
    : () => {};
  cleanup = demo.setup?.({ host, refs, api });

  return {
    destroy: () => {
      lease.release();
    },
  };
}

function nextVue2(Vue: { nextTick: (fn?: () => void) => Promise<void> | void }) {
  return new Promise<void>((resolve) => {
    const maybePromise = Vue.nextTick(resolve);
    if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
      void (maybePromise as Promise<void>).then(resolve);
    }
  });
}

function hasLiquidSurface(node: DemoChild): boolean {
  return (
    typeof node !== 'string' &&
    node.kind !== 'text' &&
    ((node.kind === 'proto' && node.prototypeId.startsWith('liquid-glass-')) ||
      (node.children ?? []).some(hasLiquidSurface))
  );
}
export async function renderDemo(opt: DemoRenderOptions): Promise<DemoRenderResult> {
  if (opt.isCurrent?.() === false) return EMPTY_DEMO_RENDER;
  let lease = claimHostMount(opt.host);
  let scene: ReturnType<
    typeof import('./preview-material-scene').createPreviewMaterialScene
  > | null = null;
  if (hasLiquidSurface(opt.demo.root) && !findPreviewMaterialProvider(opt.host)) {
    const { createPreviewMaterialScene } = await import('./preview-material-scene');
    if (!ownsLease(opt, lease)) return abandonLease(lease);
    scene = createPreviewMaterialScene(opt.host);
    const original = lease;
    lease = {
      ...original,
      commit(cleanup) {
        return original.commit(() => {
          try {
            cleanup();
          } finally {
            scene?.dispose();
          }
        });
      },
    };
    const retiringScene = scene;
    original.commit(() => retiringScene.dispose());
    opt = { ...opt, host: scene.mount };
  }
  try {
    switch (opt.runtime) {
      case 'wc':
        return await renderDemoWc(opt, lease);
      case 'react':
        return await renderDemoReact(opt, lease);
      case 'vue':
        return await renderDemoVue(opt, lease);
      case 'vue2':
        return await renderDemoVue2(opt, lease);
      default:
        lease.release();
        throw unsupportedRuntime(opt.runtime);
    }
  } catch (error) {
    try {
      runCleanupSteps([
        () => scene?.dispose(),
        () => {
          lease.release();
        },
      ]);
    } catch {
      // A secondary teardown failure must not replace the initiating error,
      // including a falsy thrown value from demo setup or instance creation.
    }
    throw error;
  }
}
