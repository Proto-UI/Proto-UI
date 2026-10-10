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
  associations: ReturnType<typeof createDemoAssociationScope>
) {
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
    for (const child of kids) renderDemoNodeWc(child, el, instances, associations);
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
  setElementAssociations(el, associations.resolve(node.associations) ?? {});
  setElementProps(el, {
    ...(node.props ?? {}),
    ...surfaceProps,
  });

  // Materialize authored children before connecting the custom element so the
  // Web Component adapter can project slots or reject contentless children.
  const kids = node.children ?? [];
  for (const child of kids) renderDemoNodeWc(child, el, instances, associations);
  parent.appendChild(el);
}

function collectDemoRefs(host: HTMLElement): Record<string, HTMLElement> {
  const refs: Record<string, HTMLElement> = {};
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

async function renderDemoWc(
  opt: DemoRenderOptions,
  lease: HostMountLease
): Promise<DemoRenderResult> {
  const { host, demo } = opt;
  const associations = createDemoAssociationScope();
  const instances: HTMLElement[] = [];
  renderDemoNodeWc(demo.root, host, instances, associations);

  const refs = collectDemoRefs(host);
  const api: DemoRuntimeApi = {
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease)) return;
      const el = refs[ref];
      const surface = el && wcSurfaceProps.get(el);
      if (!surface) return;
      surface.surfaceStyle = next;
      api.setProps(ref, {});
    },
    call(ref, path, ...args) {
      const el = refs[ref] as DemoInstance & HTMLElement;
      if (!el) return;
      const exposes = el.getExposes?.() ?? {};
      const fn = resolvePath(exposes, path);
      if (typeof fn !== 'function') return;
      return fn(...args);
    },
    getExposes(ref) {
      const el = refs[ref] as DemoInstance & HTMLElement;
      return el?.getExposes?.();
    },
    setProps(ref, next) {
      const el = refs[ref] as DemoInstance &
        HTMLElement & { setProps?(v: Record<string, unknown>): void; update?(): void };
      if (!el) return;
      el.setProps?.({ ...next, ...(wcSurfaceProps.get(el) ?? {}) });
      el.update?.();
    },
  };

  let cleanup = demo.setup?.({ host, refs, api });

  if (
    !lease.commit(() => {
      const currentCleanup = cleanup;
      cleanup = undefined;
      const cleanupSteps: Array<() => void> = [
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
      runCleanupSteps(cleanupSteps);
    })
  ) {
    return EMPTY_DEMO_RENDER;
  }

  return {
    destroy: () => {
      lease.release();
    },
  };
}

async function renderDemoReact(
  opt: DemoRenderOptions,
  lease: HostMountLease
): Promise<DemoRenderResult> {
  const { host, demo } = opt;
  const associations = createDemoAssociationScope();

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
  // DemoBoxAttrs are native string attributes, not React boolean props. Keep
  // global presence attributes (including hidden="until-found") byte-exact in
  // the initial commit, before setup or the first animation-frame boundary.
  const presenceAttributes = new Set(['hidden', 'inert', 'itemscope']);
  const boxAttributeRefs = new WeakMap<object, (element: HTMLElement | null) => void>();

  function initProps(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'box') {
      const presence = Object.entries(node.attrs ?? {}).filter(([name]) =>
        presenceAttributes.has(name.toLowerCase())
      );
      if (presence.length) {
        // A stable ref runs on mount, not on every prototype props update:
        // setup may subsequently own hidden/inert state, as Copy does.
        boxAttributeRefs.set(node, (element) => {
          if (element) for (const [name, value] of presence) element.setAttribute(name, value);
        });
      }
    }
    if (node.kind === 'proto' && node.ref) {
      propsMap.set(node.ref, { ...(node.props ?? {}) });
    }
    for (const child of node.children ?? []) initProps(child);
  }
  initProps(demo.root);

  function renderNode(node: DemoChild): any {
    if (typeof node === 'string') return node;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'box') {
      const kids = (node.children ?? []).map((child) => renderNode(child));
      return React.createElement(
        node.tag ?? 'div',
        {
          ...Object.fromEntries(
            Object.entries(node.attrs ?? {}).filter(
              ([name]) => !presenceAttributes.has(name.toLowerCase())
            )
          ),
          className: node.className,
          'data-demo-ref': node.ref,
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
      });
      scopedCache.set(componentKey, Component);
    }
    const kids = (node.children ?? []).map((child) => renderNode(child));
    const mergedProps: Record<string, unknown> = { ...(node.props ?? {}) };
    if (node.ref) {
      mergedProps['data-demo-ref'] = node.ref;
      Object.assign(mergedProps, propsMap.get(node.ref) ?? {});
      mergedProps.ref = (instance: unknown) => {
        if (instance) componentRefs.set(node.ref!, instance as DemoInstance);
        else componentRefs.delete(node.ref!);
      };
    }
    mergedProps.instanceAssociations = associations.resolve(node.associations);
    if (node.className) mergedProps.surfaceClassName = node.className;
    const surfaceStyle = (node.ref && surfaceStyles.get(node.ref)) || node.surfaceStyle;
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
      const currentCleanup = cleanup;
      cleanup = undefined;
      runCleanupSteps([
        () => {
          if (typeof currentCleanup === 'function') currentCleanup();
        },
        () => root.unmount(),
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
  const refs = collectDemoRefs(host);

  const api: DemoRuntimeApi = {
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease) || !propsMap.has(ref)) return;
      surfaceStyles.set(ref, next);
      api.setProps(ref, {});
    },
    call(ref, path, ...args) {
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
      const inst = componentRefs.get(ref);
      return inst?.getExposes?.();
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

  const [{ createVueAdapter }, { loadVue }] = await vueModules();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const Vue = await loadVue();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const adapter = createVueAdapter(Vue as unknown as AdapterVueRuntime);

  const componentRefs = new Map<string, DemoInstance>();
  const propsMap = Vue.reactive<Record<string, Record<string, unknown>>>({});
  const surfaceStyles = Vue.reactive<Record<string, DemoSurfaceStyle>>({});

  function initProps(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto' && node.ref) {
      propsMap[node.ref] = { ...(node.props ?? {}) };
    }
    for (const child of node.children ?? []) initProps(child);
  }
  initProps(demo.root);

  function renderNode(node: DemoChild): any {
    if (typeof node === 'string') return node;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'box') {
      const kids = (node.children ?? []).map((child) => renderNode(child));
      return Vue.h(
        node.tag ?? 'div',
        {
          ...node.attrs,
          class: node.className,
          'data-demo-ref': node.ref,
          ref: node.ref
            ? (el: unknown) => {
                if (el) componentRefs.set(node.ref!, el as DemoInstance);
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
      });
      scopedCache.set(componentKey, Component);
    }
    const kids = (node.children ?? []).map((child) => renderNode(child));
    const mergedProps: Record<string, unknown> = { ...(node.props ?? {}) };
    if (node.ref) {
      mergedProps['data-demo-ref'] = node.ref;
      Object.assign(mergedProps, propsMap[node.ref] ?? {});
      mergedProps.ref = (el: unknown) => {
        if (el) componentRefs.set(node.ref!, el as DemoInstance);
      };
    }
    mergedProps.instanceAssociations = associations.resolve(node.associations);
    if (node.className) mergedProps.surfaceClass = node.className;
    const surfaceStyle = (node.ref && surfaceStyles[node.ref]) || node.surfaceStyle;
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
      const currentCleanup = cleanup;
      cleanup = undefined;
      runCleanupSteps([
        () => {
          if (typeof currentCleanup === 'function') currentCleanup();
        },
        () => app.unmount(),
        () => associations.dispose(),
      ]);
    })
  ) {
    return EMPTY_DEMO_RENDER;
  }

  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const refs = collectDemoRefs(host);

  const api: DemoRuntimeApi = {
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease) || !propsMap[ref]) return;
      surfaceStyles[ref] = next;
    },
    call(ref, path, ...args) {
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
      const inst = componentRefs.get(ref);
      return inst?.getExposes?.();
    },
    setProps(ref, next) {
      if (propsMap[ref]) {
        Object.assign(propsMap[ref], next);
      }
      // The actual Vue adapter reconciles changed host props after its commit.
      // An additional controller update can replace that pending feedback
      // commit with an unchanged one and lose a later controlled prop's paint.
    },
  };

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

  const [{ createVue2Adapter }, { loadVue2, toVue2ComponentData, toVue2Runtime }] =
    await vue2Modules();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const Vue = await loadVue2();
  if (!ownsLease(opt, lease)) return abandonLease(lease);
  const adapter = createVue2Adapter(toVue2Runtime(Vue));

  const componentRefs = new Map<string, DemoInstance>();
  const componentRefNames = new Set<string>();
  const surfaceStyles = new Map<string, DemoSurfaceStyle>();
  const propsMap = ((Vue as any).observable ? (Vue as any).observable({}) : {}) as Record<
    string,
    Record<string, unknown>
  >;

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

  function renderNode(node: DemoChild, h: any): any {
    if (typeof node === 'string') return node;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'box') {
      const kids = (node.children ?? []).map((child) => renderNode(child, h));
      return h(
        node.tag ?? 'div',
        {
          class: node.className,
          attrs: {
            ...node.attrs,
            'data-demo-ref': node.ref,
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
      });
      scopedCache.set(componentKey, Component);
    }
    const kids = (node.children ?? []).map((child) => renderNode(child, h));
    const mergedProps: Record<string, unknown> = { ...(node.props ?? {}) };
    if (node.ref) {
      componentRefNames.add(node.ref);
      Object.assign(mergedProps, propsMap[node.ref] ?? {});
      mergedProps['data-demo-ref'] = node.ref;
    }
    mergedProps.instanceAssociations = associations.resolve(node.associations);
    if (node.className) mergedProps.surfaceClass = node.className;
    const surfaceStyle = (node.ref && surfaceStyles.get(node.ref)) || node.surfaceStyle;
    if (surfaceStyle) mergedProps.surfaceStyle = surfaceStyle;

    const data = toVue2ComponentData(mergedProps);
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
      const currentCleanup = cleanup;
      cleanup = undefined;
      runCleanupSteps([
        () => {
          if (typeof currentCleanup === 'function') currentCleanup();
        },
        () => app.$destroy(),
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
  const refs = collectDemoRefs(host);

  const api: DemoRuntimeApi = {
    setSurfaceStyle(ref, next) {
      if (!ownsLease(opt, lease) || !propsMap[ref]) return;
      surfaceStyles.set(ref, next);
      app.$forceUpdate?.();
    },
    call(ref, path, ...args) {
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
      refreshComponentRefs(app);
      const inst = componentRefs.get(ref);
      return inst?.getExposes?.();
    },
    setProps(ref, next) {
      if (!propsMap[ref]) setReactive(propsMap, ref, {});
      for (const [key, value] of Object.entries(next)) {
        setReactive(propsMap[ref], key, value);
      }
      app.$forceUpdate?.();
      // Vue2's adapter owns host-prop notification and the resulting update.
      // Public call/getExposes refresh component refs when they are consumed.
    },
  };

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
    scene?.dispose();
    lease.release();
    throw error;
  }
}
