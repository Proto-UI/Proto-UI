import runtimeUrls from 'virtual:proto-ui/runtime-retry-urls';
import { retryableModule } from './retryable-module';
import type { RuntimeAPI } from './ids';
import type { VueRuntime as AdapterVueRuntime } from '@proto.ui/adapter-vue';
import { claimHostMount, releaseHostMount } from './host-mount';

const vueModule = retryableModule(() => import('vue'), runtimeUrls.vue);

// Deliver the existing locked Vue 3 dependency through lazy same-origin assets.
// The reader runtime must not depend on an external CDN being reachable.
export async function loadVue(): Promise<VueRuntimeModule> {
  return (await vueModule()) as unknown as VueRuntimeModule;
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
      const [Vue, { createVueAdapter }] = await Promise.all([
        load(),
        import('@proto.ui/adapter-vue'),
      ]);
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
