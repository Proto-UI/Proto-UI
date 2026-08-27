import type { RuntimeAPI } from './registry';
import { createVue2Adapter, type Vue2Runtime as AdapterVue2Runtime } from '@proto.ui/adapter-vue2';
import { claimHostMount, releaseHostMount } from './host-mount';

const VUE2_SOURCE = 'https://esm.sh/vue@2.6.14';

type Vue2Constructor = {
  extend: (options: Record<string, unknown>) => any;
  nextTick: (fn?: () => void) => Promise<void> | void;
  set?: (target: object, key: string, value: unknown) => void;
  delete?: (target: object, key: string) => void;
};

export async function loadVue2(): Promise<Vue2Constructor> {
  const mod = (await import(/* @vite-ignore */ VUE2_SOURCE)) as any;
  return (mod.default ?? mod) as Vue2Constructor;
}

export function toVue2Runtime(Vue: Vue2Constructor): AdapterVue2Runtime {
  return {
    extend: Vue.extend.bind(Vue),
    nextTick: Vue.nextTick.bind(Vue),
    set: Vue.set?.bind(Vue),
    delete: Vue.delete?.bind(Vue),
  };
}

type Vue2ComponentData = {
  ref?: string;
  props: Record<string, unknown>;
  attrs: Record<string, unknown>;
  on: Record<string, (...args: unknown[]) => void>;
  class?: unknown;
  style?: unknown;
};

const DECLARED_HOST_PROPS = new Set(['hostClass', 'surfaceClass', 'hostStyle', 'surfaceStyle']);

export function toVue2ComponentData(input: Record<string, unknown> = {}): Vue2ComponentData {
  const props: Record<string, unknown> = {};
  const attrs: Record<string, unknown> = {};
  const on: Record<string, (...args: unknown[]) => void> = {};
  let classValue: unknown;
  let styleValue: unknown;

  for (const [key, value] of Object.entries(input)) {
    if (key === 'class') {
      classValue = value;
      continue;
    }
    if (key === 'style') {
      styleValue = value;
      continue;
    }
    if (DECLARED_HOST_PROPS.has(key)) {
      props[key] = value;
      continue;
    }
    if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      const eventName = key.slice(2, 3).toLowerCase() + key.slice(3);
      on[eventName] = value as (...args: unknown[]) => void;
      continue;
    }
    attrs[key] = value;
  }

  return {
    props,
    attrs,
    on,
    class: classValue,
    style: styleValue,
  };
}

type Vue2Vm = {
  $destroy(): void;
  $mount(): Vue2Vm;
  $el: Element;
};

export function createVue2Runtime(load = loadVue2): RuntimeAPI {
  return {
    id: 'vue2',
    label: 'Vue 2',

    async mount(host, prototype, options) {
      const lease = claimHostMount(host);
      const Vue = await load();
      if (!lease.isCurrent()) return;

      const Component = createVue2Adapter(toVue2Runtime(Vue))(prototype);
      const Root = Vue.extend({
        render(h: any) {
          return h(Component, toVue2ComponentData(options?.props ?? {}));
        },
      });

      const vm = new Root().$mount() as Vue2Vm;
      if (!lease.commit(() => vm.$destroy())) return;
      host.appendChild(vm.$el);
    },

    unmount(host) {
      releaseHostMount(host);
    },
  };
}

export const runtime = createVue2Runtime();
