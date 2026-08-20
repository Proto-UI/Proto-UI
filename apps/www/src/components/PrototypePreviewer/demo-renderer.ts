import { setElementProps } from '@proto.ui/adapter-web-component';
import { createReactAdapter, type ReactRuntime } from '@proto.ui/adapter-react';
import { createVueAdapter, type VueRuntime as AdapterVueRuntime } from '@proto.ui/adapter-vue';
import type { Prototype } from '@proto.ui/core';
import { getPrototype } from './registry';
import { loadReact } from './runtimes/react-runtime';
import { loadVue } from './runtimes/vue-runtime';
import type { DemoChild, DemoRenderOptions, DemoRenderResult, DemoRuntimeApi } from './demo-types';
import { ensurePreviewWcRegistered } from './wc-registry';

type PropsBaseType = Record<string, unknown>;

const reactRoots = new WeakMap<
  HTMLElement,
  { unmount: () => void; render: (el: unknown) => void }
>();
const reactComponentCache = new WeakMap<object, Map<string, any>>();
const vueComponentCache = new WeakMap<object, Map<string, any>>();
const wcSurfaceProps = new WeakMap<HTMLElement, Record<string, unknown>>();

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

function renderDemoNodeWc(node: DemoChild, parent: HTMLElement, instances: HTMLElement[]) {
  if (typeof node === 'string') {
    parent.appendChild(document.createTextNode(node));
    return;
  }
  if (node.kind === 'text') {
    parent.appendChild(document.createTextNode(node.text));
    return;
  }
  if (node.kind === 'box') {
    const el = document.createElement('div');
    if (node.className) el.className = node.className;
    if (node.ref) el.setAttribute('data-demo-ref', node.ref);
    parent.appendChild(el);
    const kids = node.children ?? [];
    for (const child of kids) renderDemoNodeWc(child, el, instances);
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
  setElementProps(el, {
    ...(node.props ?? {}),
    ...surfaceProps,
  });
  parent.appendChild(el);

  const kids = node.children ?? [];
  for (const child of kids) renderDemoNodeWc(child, el, instances);
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

async function renderDemoWc(opt: DemoRenderOptions): Promise<DemoRenderResult> {
  const { host, demo } = opt;
  host.innerHTML = '';
  const instances: HTMLElement[] = [];
  renderDemoNodeWc(demo.root, host, instances);

  const refs = collectDemoRefs(host);
  const api: DemoRuntimeApi = {
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

  const cleanup = demo.setup?.({ host, refs, api });

  return {
    destroy: () => {
      if (typeof cleanup === 'function') cleanup();
      // A globally mounted overlay is no longer a physical descendant of the
      // preview host. Remove every rendered instance explicitly so portaled
      // parts disconnect and dispose together with their logical demo tree.
      for (let index = instances.length - 1; index >= 0; index -= 1) {
        instances[index]?.remove();
      }
      host.innerHTML = '';
    },
  };
}

async function renderDemoReact(opt: DemoRenderOptions): Promise<DemoRenderResult> {
  const { host, demo } = opt;

  const { React, ReactDOM } = await loadReact();
  const adapter = createReactAdapter({
    ...React,
    createPortal: ReactDOM.createPortal,
  } as unknown as ReactRuntime);

  const existingRoot = reactRoots.get(host);
  if (existingRoot) {
    existingRoot.unmount();
    reactRoots.delete(host);
  }
  host.innerHTML = '';

  const componentRefs = new Map<string, DemoInstance>();
  const propsMap = new Map<string, Record<string, unknown>>();

  function initProps(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto' && node.ref && node.props) {
      propsMap.set(node.ref, { ...node.props });
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
        'div',
        { className: node.className, 'data-demo-ref': node.ref },
        ...kids
      );
    }

    const proto = getPrototype(node.prototypeId);
    const scopedCache = getScopedComponentCache(reactComponentCache, adapter);
    let Component = scopedCache.get(node.prototypeId);
    if (!Component) {
      Component = adapter(proto as Prototype<PropsBaseType>);
      scopedCache.set(node.prototypeId, Component);
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
    if (node.className) mergedProps.surfaceClassName = node.className;
    if (node.surfaceStyle) mergedProps.surfaceStyle = node.surfaceStyle;
    return React.createElement(Component, mergedProps as Record<string, unknown>, ...kids);
  }

  const root = (
    ReactDOM as {
      createRoot(el: HTMLElement): { render: (el: unknown) => void; unmount: () => void };
    }
  ).createRoot(host);
  reactRoots.set(host, root);

  const flushReact = <T>(fn: () => T): T => {
    const flushSync = (ReactDOM as { flushSync?: <R>(callback: () => R) => R }).flushSync;
    return typeof flushSync === 'function' ? flushSync(fn) : fn();
  };

  function renderTree() {
    return renderNode(demo.root);
  }

  // Demo setup reads DOM refs and Proto exposes immediately after initial
  // mount. A fixed number of animation frames is not a readiness guarantee
  // when Demo Matrix mounts many React roots concurrently.
  flushReact(() => root.render(renderTree()));

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const refs = collectDemoRefs(host);

  const api: DemoRuntimeApi = {
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
      const current = propsMap.get(ref);
      if (!current) return;
      Object.assign(current, next);
      flushReact(() => root.render(renderTree()));
      componentRefs.get(ref)?.update?.();
      // React root rendering may commit asynchronously. Refresh the retained
      // Proto owner only after the adapter has received the new props.
      requestAnimationFrame(() => componentRefs.get(ref)?.update?.());
    },
  };

  const cleanup = demo.setup?.({ host, refs, api });

  return {
    destroy: () => {
      if (typeof cleanup === 'function') cleanup();
      const r = reactRoots.get(host);
      if (r) {
        r.unmount();
        reactRoots.delete(host);
      }
      host.innerHTML = '';
    },
  };
}

const vueApps = new WeakMap<HTMLElement, { unmount: () => void }>();

async function renderDemoVue(opt: DemoRenderOptions): Promise<DemoRenderResult> {
  const { host, demo } = opt;

  const Vue = await loadVue();
  const adapter = createVueAdapter(Vue as unknown as AdapterVueRuntime);

  const existingApp = vueApps.get(host);
  if (existingApp) {
    existingApp.unmount();
    vueApps.delete(host);
  }
  host.innerHTML = '';

  const componentRefs = new Map<string, DemoInstance>();
  const propsMap = Vue.reactive<Record<string, Record<string, unknown>>>({});

  function initProps(node: DemoChild) {
    if (typeof node === 'string' || node.kind === 'text') return;
    if (node.kind === 'proto' && node.ref && node.props) {
      propsMap[node.ref] = { ...node.props };
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
        'div',
        {
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
    let Component = scopedCache.get(node.prototypeId);
    if (!Component) {
      Component = adapter(proto as Prototype<PropsBaseType>);
      scopedCache.set(node.prototypeId, Component);
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
    if (node.className) mergedProps.surfaceClass = node.className;
    if (node.surfaceStyle) mergedProps.surfaceStyle = node.surfaceStyle;
    return Vue.h(Component, mergedProps, () => kids);
  }

  const app = Vue.createApp({
    setup() {
      return () => renderNode(demo.root);
    },
  });

  app.mount(host);
  vueApps.set(host, app);

  await new Promise((resolve) => requestAnimationFrame(resolve));
  const refs = collectDemoRefs(host);

  const api: DemoRuntimeApi = {
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
      // Wait until reactive props/attrs have reached the adapter. Calling the
      // controller in the same stack would re-read the previous attrs value.
      void Vue.nextTick(() => componentRefs.get(ref)?.update?.());
    },
  };

  const cleanup = demo.setup?.({ host, refs, api });

  return {
    destroy: () => {
      if (typeof cleanup === 'function') cleanup();
      const a = vueApps.get(host);
      if (a) {
        a.unmount();
        vueApps.delete(host);
      }
      host.innerHTML = '';
    },
  };
}

export async function renderDemo(opt: DemoRenderOptions): Promise<DemoRenderResult> {
  if (opt.runtime === 'react') return renderDemoReact(opt);
  if (opt.runtime === 'vue') return renderDemoVue(opt);
  return renderDemoWc(opt);
}
