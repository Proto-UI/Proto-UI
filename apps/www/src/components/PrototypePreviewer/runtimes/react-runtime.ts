import runtimeUrls from 'virtual:proto-ui/runtime-retry-urls';
import { retryableModule } from './retryable-module';
import type { RuntimeAPI } from './ids';
import type * as ReactTypes from 'react';
import { claimHostMount, releaseHostMount } from './host-mount';

const importReact = retryableModule(() => import('react'), runtimeUrls.react);
const reactDomModule = retryableModule(() => import('react-dom'), runtimeUrls.reactDom);
const reactDomClientModule = retryableModule(
  () => import('react-dom/client'),
  runtimeUrls.reactDomClient
);

// Keep the React 18 reader runtime, but deliver the pinned pair through
// the application's lazy assets. ReactDOM's peer resolves the same React
// instance; no external CDN is required for a reader's mount.

export async function loadReact(): Promise<{
  React: typeof ReactTypes;
  ReactDOM: any;
}> {
  const [reactModule, reactDOMModule, reactDOMClient] = await Promise.all([
    importReact(),
    reactDomModule(),
    reactDomClientModule(),
  ]);
  const React = (reactModule.default ?? reactModule) as unknown as typeof ReactTypes;
  // Client roots do not export commit/portal APIs. Keep the public DOM APIs
  // used by composed demos, with client createRoot/hydrateRoot entry points.
  const ReactDOM = {
    ...(reactDOMModule.default ?? reactDOMModule),
    ...(reactDOMClient.default ?? reactDOMClient),
  };
  return { React, ReactDOM };
}

type ReactRoot = {
  unmount: () => void;
  render: (element: React.ReactElement) => void;
};

/**
 * React 运行时实现：
 * - 懒加载 React 依赖
 * - 使用 Proto UI 的 createReactAdapter() 适配 Prototype
 * - 维护宿主 root 的 mount / unmount 生命周期
 */
export function createReactRuntime(load = loadReact): RuntimeAPI {
  return {
    id: 'react',
    label: 'React',

    async mount(host, prototype, options) {
      const lease = claimHostMount(host);
      const [{ React, ReactDOM }, { createReactAdapter }] = await Promise.all([
        load(),
        import('@proto.ui/adapter-react'),
      ]);
      if (!lease.isCurrent()) return;

      const adapter = createReactAdapter(React as any);
      const Component = adapter(prototype);
      const root = ReactDOM.createRoot(host) as ReactRoot;
      if (!lease.commit(() => root.unmount())) return;

      // 不使用 StrictMode，避免开发模式双重渲染。
      root.render(React.createElement(Component, options?.props ?? {}));
    },

    unmount(host) {
      releaseHostMount(host);
    },
  };
}

export const runtime = createReactRuntime();
