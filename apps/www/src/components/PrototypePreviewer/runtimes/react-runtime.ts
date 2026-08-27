import type { RuntimeAPI } from './registry';
import { createReactAdapter } from '@proto.ui/adapter-react';
import type * as ReactTypes from 'react';
import { claimHostMount, releaseHostMount } from './host-mount';

// 我们不直接 import React，而是用 esm.sh 的 ESM 版本懒加载
// 也可以替换成本地的 "react" / "react-dom/client"（若打包策略允许）
const REACT_SOURCE = 'https://esm.sh/react@18';
const REACT_DOM_SOURCE = 'https://esm.sh/react-dom@18';

// 异步加载 React 与 ReactDOM
// 注意：只从 react-dom 单入口导入，避免 esm.sh 因多入口产生重复的 React 实例
export async function loadReact(): Promise<{
  React: typeof ReactTypes;
  ReactDOM: any;
}> {
  const [React, ReactDOM] = await Promise.all([
    import(/* @vite-ignore */ REACT_SOURCE) as Promise<typeof ReactTypes>,
    import(/* @vite-ignore */ REACT_DOM_SOURCE) as Promise<any>,
  ]);
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
      const { React, ReactDOM } = await load();
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
