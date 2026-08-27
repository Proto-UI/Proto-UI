import type { RuntimeAPI } from './registry';
import { createVueAdapter, type VueRuntime as AdapterVueRuntime } from '@proto.ui/adapter-vue';
import { claimHostMount, releaseHostMount } from './host-mount';

// 使用 esm.sh 的 ESM 版本懒加载 Vue
// 也可以替换成本地的 "vue"
const VUE_SOURCE = 'https://esm.sh/vue@3';

// 异步加载 Vue
export async function loadVue(): Promise<VueRuntimeModule> {
  const Vue = (await import(/* @vite-ignore */ VUE_SOURCE)) as VueRuntimeModule;
  return Vue;
}

type VueApp = {
  mount: (host: HTMLElement) => unknown;
  unmount: () => void;
};

type VueRuntimeModule = AdapterVueRuntime & {
  createApp: (component: unknown, props?: Record<string, unknown>) => VueApp;
  reactive: <T extends object>(target: T) => T;
};

/**
 * Vue 运行时实现：
 * - 懒加载 Vue 依赖
 * - 使用 Proto UI 的 createVueAdapter() 适配 Prototype
 * - 维护宿主 app 的 mount / unmount 生命周期
 */
export function createVueRuntime(load = loadVue): RuntimeAPI {
  return {
    id: 'vue',
    label: 'Vue',

    async mount(host, prototype, options) {
      const lease = claimHostMount(host);
      const Vue = await load();
      if (!lease.isCurrent()) return;

      const Component = createVueAdapter(Vue as unknown as AdapterVueRuntime)(prototype);
      const app = Vue.createApp(Component, options?.props ?? {}) as VueApp;
      if (!lease.commit(() => app.unmount())) return;

      app.mount(host);
    },

    unmount(host) {
      releaseHostMount(host);
    },
  };
}

export const runtime = createVueRuntime();
