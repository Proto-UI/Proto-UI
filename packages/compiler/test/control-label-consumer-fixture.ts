import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import Vue2, { type ComponentOptions as Vue2Options } from '../../adapters/vue2/node_modules/vue';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import {
  AdaptToWebComponent,
  setElementAssociations,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import type { InstanceAssociations, Prototype } from '@proto.ui/core';
import button from '../../prototypes/base/src/button';
import toggle from '../../prototypes/base/src/toggle';
import label from '../../prototypes/base/src/label';
import { compileFile, writeCompilation, type Compilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

export const CONTROL_LABEL_PROFILES = {
  react: 'react-dom-source-v1',
  vue: 'vue-source-v1',
  vue2: 'vue2-source-v1',
  wc: 'web-component-source-v1',
} as const;
export type WebTarget = keyof typeof CONTROL_LABEL_PROFILES;
export type TargetKind = 'button' | 'toggle';
export type ComponentKind = TargetKind | 'label';
export type ExecutionKind = 'compiled' | 'runtime';
export const CONTROL_LABEL_ENTRIES: Record<ComponentKind, string> = {
  button: 'packages/prototypes/base/src/button/button.proto.ts',
  toggle: 'packages/prototypes/base/src/toggle/toggle.proto.ts',
  label: 'packages/prototypes/base/src/label/root.proto.ts',
};
export const REPOSITORY = fileURLToPath(new NodeURL('../../../', import.meta.url));
const generatedParent = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'generated-modules'
);
const directories: string[] = [];
const generated = new Map<string, Promise<Record<string, unknown>>>();
const runtime = new Map<string, unknown>();
let sequence = 0;
const prototypes = {
  button,
  toggle,
  label,
};
const reactAdapter = createReactAdapter(React);
const vueAdapter = createVueAdapter(Vue);
const vue2Adapter = createVue2Adapter({
  // Bridge installed Vue constructor/options declarations to the injected host protocol.
  extend: Vue2.extend.bind(Vue2) as unknown as Parameters<typeof createVue2Adapter>[0]['extend'],
  nextTick: Vue2.nextTick.bind(Vue2),
  set: Vue2.set.bind(Vue2),
  delete: Vue2.delete.bind(Vue2),
});

export async function temporaryOutput(prefix: string): Promise<string> {
  await mkdir(generatedParent, { recursive: true });
  const directory = await mkdtemp(path.join(generatedParent, prefix));
  directories.push(directory);
  return directory;
}

export async function actualCompilation(
  target: WebTarget,
  kind: ComponentKind
): Promise<Compilation> {
  const result = await compileFile(CONTROL_LABEL_ENTRIES[kind], {
    root: REPOSITORY,
    profile: CONTROL_LABEL_PROFILES[target],
  });
  if (!result.ok)
    throw new Error(`${target}/${kind}: ${JSON.stringify(result.diagnostics, null, 2)}`);
  return result.value;
}

async function componentModule(target: WebTarget, kind: ComponentKind) {
  const key = `${target}/${kind}`;
  let pending = generated.get(key);
  if (!pending) {
    pending = (async () => {
      // Each independently emitted entry owns its own closed support graph. The
      // public ref must still authorize a pair across these distinct directories.
      const compilation = await actualCompilation(target, kind);
      const parent = await temporaryOutput(`control-label-${target}-${kind}-`);
      const directory = path.join(parent, 'published');
      const written = await writeCompilation(compilation, directory);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const filename = path.join(directory, generatedSourcePath(compilation.output.profile));
      return (await import(/* @vite-ignore */ filename)) as Record<string, unknown>;
    })();
    generated.set(key, pending);
  }
  return pending;
}

export function invoke(object: unknown, key: string, ...args: unknown[]): unknown {
  if (!object || (typeof object !== 'object' && typeof object !== 'function'))
    throw new Error(`Missing public receiver for ${key}`);
  const method: unknown = Reflect.get(object, key);
  if (typeof method !== 'function') throw new Error(`Missing public method ${key}`);
  return Reflect.apply(method, object, args);
}

export function state(handle: unknown, name: string): unknown {
  const exposes = invoke(handle, 'getExposes') as Record<string, unknown>;
  return invoke(exposes[name], 'get');
}

async function component(target: WebTarget, kind: ComponentKind, execution: ExecutionKind) {
  if (execution === 'compiled') {
    const module = await componentModule(target, kind);
    if (target === 'wc') {
      const key = `compiled/${target}/${kind}`;
      if (!runtime.has(key)) {
        const tag = `control-label-compiled-${kind}-${++sequence}`;
        invoke(module, 'register', tag);
        runtime.set(key, tag);
      }
      return runtime.get(key);
    }
    return target === 'react' ? module.CompiledComponent : module.default;
  }
  const key = `runtime/${target}/${kind}`;
  if (!runtime.has(key)) {
    const prototype = prototypes[kind] as Prototype<any, any>;
    if (target === 'wc') {
      const tag = `control-label-runtime-${kind}-${++sequence}`;
      AdaptToWebComponent(prototype, { registerAs: tag });
      runtime.set(key, tag);
    } else {
      runtime.set(
        key,
        target === 'react'
          ? reactAdapter(prototype)
          : target === 'vue'
            ? vueAdapter(prototype)
            : vue2Adapter(prototype)
      );
    }
  }
  return runtime.get(key);
}

export interface MountedControlLabelConsumer {
  readonly root: HTMLElement;
  readonly host: HTMLElement;
  readonly handle: unknown;
  readonly signals: unknown[];
  setProps(next: Record<string, unknown>): Promise<void>;
  setAssociations(next: InstanceAssociations): Promise<void>;
  flush(): Promise<void>;
  run(action: () => void): Promise<void>;
  close(): Promise<void>;
}
const mounted = new Set<MountedControlLabelConsumer>();

export async function settle(target: WebTarget) {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  if (target === 'vue') await Vue.nextTick();
  if (target === 'vue2') await Vue2.nextTick();
  // Association naming observes actual DOM detach/reparent mutations. Happy DOM
  // delivers MutationObserver callbacks after its own queued task, so await a
  // real observer checkpoint instead of assuming Promise microtasks delivered it.
  await new Promise<void>((resolve) => {
    const probe = document.createElement('span');
    const observer = new MutationObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(probe, { attributes: true });
    probe.setAttribute('data-observer-checkpoint', '');
  });
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

export async function mountControlLabelConsumer(
  target: WebTarget,
  kind: ComponentKind,
  execution: ExecutionKind,
  associations: InstanceAssociations,
  initialProps: Record<string, unknown> = {},
  text = kind === 'label' ? 'Visible control name' : ''
): Promise<MountedControlLabelConsumer> {
  const Component = await component(target, kind, execution);
  const host = document.createElement('div');
  document.body.append(host);
  const signals: unknown[] = [];
  let props = initialProps;
  let currentAssociations = associations;
  let handle: unknown;
  let update: () => Promise<void>;
  let unmount: () => Promise<void>;
  const signal = (value?: unknown) => signals.push(kind === 'button' ? 'click' : value);
  const eventProp = kind === 'button' ? 'onClick' : 'onActiveChange';
  const snapshot = () => ({
    ...props,
    instanceAssociations: currentAssociations,
    ...(target === 'vue2' ? {} : { [eventProp]: signal }),
  });
  const run = async (action: () => void) => {
    if (target === 'react')
      await React.act(async () => {
        action();
        await settle(target);
      });
    else {
      action();
      await settle(target);
    }
  };
  if (target === 'react') {
    const RootComponent = Component as React.ComponentType<Record<string, unknown>>;
    const ref = React.createRef<unknown>();
    const app = createRoot(host);
    update = () =>
      run(() => app.render(React.createElement(RootComponent, { ...snapshot(), ref }, text)));
    unmount = () => run(() => app.unmount());
    try {
      await update();
    } catch (error) {
      await unmount();
      host.remove();
      throw error;
    }
    handle = ref.current;
  } else if (target === 'vue') {
    const current = Vue.shallowRef(snapshot());
    const ref = Vue.shallowRef<unknown>();
    const app = Vue.createApp({
      render: () => Vue.h(Component as Vue.Component, { ...current.value, ref }, () => text),
    });
    app.mount(host);
    handle = ref.value;
    update = async () => {
      current.value = snapshot();
      await settle(target);
    };
    unmount = async () => {
      app.unmount();
      await settle(target);
    };
  } else if (target === 'vue2') {
    const app = new Vue2({
      render(h) {
        const input = snapshot();
        const { instanceAssociations, ...portable } = input;
        return h(
          Component as Vue2Options<Vue2>,
          {
            // Keep the opaque host input outside Vue2's deep observation. Its
            // __ob__ metadata is not an admitted InstanceAssociations key.
            props: execution === 'runtime' ? { instanceAssociations } : input,
            ...(execution === 'runtime' ? { attrs: portable } : {}),
            on: { click: () => signal(), activeChange: signal },
          },
          [text]
        );
      },
    }).$mount();
    host.append(app.$el);
    handle = app.$children[0];
    update = async () => {
      app.$forceUpdate();
      await settle(target);
    };
    unmount = async () => {
      app.$destroy();
      await settle(target);
    };
  } else {
    const element = document.createElement(Component as string);
    element.textContent = text;
    element.addEventListener(kind === 'button' ? 'click' : 'activeChange', (event) => {
      if (event instanceof CustomEvent) signal(event.detail);
    });
    update = async () => {
      if (execution === 'runtime') {
        setElementAssociations(element, currentAssociations);
        setElementProps(element, props);
      } else {
        Reflect.set(element, 'instanceAssociations', currentAssociations);
        invoke(element, 'setProps', props);
      }
      await settle(target);
    };
    await update();
    host.append(element);
    handle = element;
    unmount = async () => {
      element.remove();
      if (execution === 'compiled') invoke(element, 'dispose');
      await settle(target);
    };
  }
  await settle(target);
  let closed = false;
  const consumer: MountedControlLabelConsumer = {
    host,
    handle,
    signals,
    get root() {
      const root = host.querySelector('[data-pui-root]') ?? host.firstElementChild;
      if (!(root instanceof HTMLElement))
        throw new Error(`Missing ${target}/${kind} physical root`);
      return root;
    },
    async setProps(next) {
      props = next;
      await update();
    },
    async setAssociations(next) {
      currentAssociations = next;
      await update();
    },
    async flush() {
      await run(() => {});
    },
    run,
    async close() {
      if (closed) return;
      closed = true;
      mounted.delete(consumer);
      await unmount();
      host.remove();
    },
  };
  mounted.add(consumer);
  return consumer;
}

/** Synthetic input drives the host boundary; this is not trusted-browser/AT evidence. */
export function pointerClick(element: HTMLElement) {
  for (const type of ['pointerdown', 'pointerup'])
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        cancelable: true,
        pointerType: 'mouse',
        pointerId: 1,
        button: 0,
        clientX: 10,
        clientY: 10,
      })
    );
  element.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      composed: true,
      cancelable: true,
      button: 0,
      detail: 1,
    })
  );
}

export async function cleanupConsumers() {
  for (const consumer of [...mounted].reverse()) await consumer.close();
  document.body.replaceChildren();
}

export async function cleanupOutputs() {
  generated.clear();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
}
