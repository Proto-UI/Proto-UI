// src/next-www/src/components/PrototypePreviewer/previewer-client.ts
import { runtimeLoaders } from './runtimes/registry';
import { getPrototype } from './registry';
import { loadPrototype, loadPrototypes } from './prototype-modules';
import { loadDemo } from './demo-modules';
import { renderDemo } from './demo-renderer';
import { collectPrototypeIds } from './demo-types';
import { releaseHostMount } from './runtimes/host-mount';
import type { RuntimeId } from './runtimes/registry';
import { refreshCodePanel } from './code-panel-client';

const PREFERRED_ADAPTER_KEY = 'preferred-prototypes-adapter';

interface PreviewerOptions {
  root: HTMLElement;
  prototypeId?: string;
  demoId?: string;
  initialRuntime: RuntimeId;
  demoProps: Record<string, unknown>;
  runtimeList: RuntimeId[];
  loader?: string; // 动态导入路径
}

export function initPreviewer(options: PreviewerOptions) {
  const { root, prototypeId, demoId, initialRuntime, demoProps, runtimeList, loader } = options;

  // 防重复初始化
  if (root.dataset.inited === '1') {
    console.warn('[PrototypePreviewer] already initialized:', root.dataset.previewerId);
    return;
  }
  root.dataset.inited = '1';

  const host = root.querySelector('.host') as HTMLElement;
  const select = root.querySelector('select') as HTMLSelectElement | null;

  function preferredRuntime(): RuntimeId {
    try {
      const preferred = localStorage.getItem(PREFERRED_ADAPTER_KEY) as RuntimeId | null;
      if (preferred && runtimeList.includes(preferred)) return preferred;
    } catch {
      // localStorage is optional (for example, in privacy-restricted embeds).
    }
    return initialRuntime;
  }

  const selectedInitialRuntime = preferredRuntime();

  let current: { id: string; api: any } | null = null;
  let currentDemo: { id: string; destroy: () => Promise<void> | void } | null = null;
  let version = 0;
  let destroyed = false;

  const codeHighlights: Record<string, string> = root.dataset.codeHighlights
    ? JSON.parse(root.dataset.codeHighlights)
    : {};

  function updateCodePanel(runtime: RuntimeId) {
    const codeContent = root.querySelector('[data-code-content]') as HTMLElement | null;
    if (!codeContent) return;
    const html = codeHighlights[runtime];
    if (!html) return;
    codeContent.innerHTML = html;
    const shell = codeContent.closest<HTMLElement>('[data-code-shell]');
    if (shell) refreshCodePanel(shell, { reset: true });
  }

  // 初始化下拉
  if (select) {
    select.innerHTML = '';
    for (const id of runtimeList) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent =
        (
          {
            wc: 'Web Components',
            react: 'React',
            vue: 'Vue',
            vue2: 'Vue 2',
          } as Record<string, string>
        )[id] || id;
      if (id === selectedInitialRuntime) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function dispatch(name: string, detail: any) {
    root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  // 动态加载原型模块
  let loaderPromise: Promise<void> | null = null;
  async function ensurePrototypeLoaded() {
    if (loaderPromise) return loaderPromise; // 已在加载中

    loaderPromise = (async () => {
      try {
        // 方式1：使用自定义 loader（废弃的旧方式，保留兼容）
        if (loader) {
          const baseUrl = import.meta.url.replace(/\/[^/]+$/, '/');
          const modulePath = new URL(loader, baseUrl).href;
          await import(/* @vite-ignore */ modulePath);
          return;
        }

        // 方式2：自动按需加载（推荐）
        if (!prototypeId) {
          throw new Error('[PrototypePreviewer] missing prototypeId');
        }
        await loadPrototype(prototypeId);
      } catch (err) {
        console.error('[PrototypePreviewer] 加载原型模块失败:', prototypeId, err);
        throw err;
      }
    })();

    return loaderPromise;
  }

  async function switchTo(id: string) {
    if (destroyed) return;
    const myVersion = ++version;
    // Invalidate a runtime that is still awaiting its loader before this
    // switch reaches the next runtime's mount() call.
    releaseHostMount(host);
    if (select) select.disabled = true;

    try {
      // 卸载旧 runtime / demo
      if (currentDemo) {
        await currentDemo.destroy();
        currentDemo = null;
      }
      if (current?.api?.unmount) await current.api.unmount(host);
      else host.innerHTML = '';

      if (demoId) {
        const demo = await loadDemo(demoId);
        const ids = new Set<string>();
        collectPrototypeIds(demo.root, ids);
        await loadPrototypes(Array.from(ids));

        const { destroy } = await renderDemo({
          runtime: id as RuntimeId,
          demo,
          host,
          isCurrent: () => !destroyed && myVersion === version,
        });
        if (destroyed || myVersion !== version) return;
        currentDemo = { id, destroy };
        updateCodePanel(id as RuntimeId);
        dispatch('runtime:changed', { id });
        return;
      }

      if (!prototypeId) {
        throw new Error('[PrototypePreviewer] missing prototypeId');
      }

      // 确保原型已加载（如果有 loader）
      await ensurePrototypeLoaded();

      // 并行加载：运行时 API + 原型对象引用
      const [api, proto] = await Promise.all([
        runtimeLoaders[id as RuntimeId](),
        Promise.resolve().then(() => getPrototype(prototypeId)),
      ]);

      // 竞态保护
      if (myVersion !== version || destroyed) return;

      await api.mount(host, proto, { props: demoProps });
      if (destroyed || myVersion !== version) return;
      current = { id, api };
      updateCodePanel(id as RuntimeId);
      dispatch('runtime:changed', { id });
    } catch (err) {
      if (destroyed || myVersion !== version) return;
      // 如果是原型未找到的错误，不需要重试（动态加载应该已经处理了）
      // 旧的重试逻辑已被更可靠的动态加载机制取代

      // 显示错误信息
      host.innerHTML = '';
      const pre = document.createElement('pre');
      pre.textContent =
        '[Preview Error]\n' + (err && ((err as any).stack || (err as any).message || String(err)));
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.color = 'crimson';
      host.appendChild(pre);
      console.error(err);
      dispatch('error', { error: err });
    } finally {
      if (myVersion === version && !destroyed && select) select.disabled = false;
    }
  }

  // 首次挂载（统一走 runtime 生命周期，避免 WC 单走一套）
  switchTo(selectedInitialRuntime).then(() =>
    dispatch('previewer:mounted', { runtime: selectedInitialRuntime })
  );

  // AdapterSelect synchronizes all selector instances and broadcasts the selected
  // runtime. Listen on document so the page-level selector also remounts every
  // compatible previewer; previewer-local selector changes use the same path.
  const onAdapterChange = (event: Event) => {
    const id = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (typeof id !== 'string' || !runtimeList.includes(id as RuntimeId)) return;
    if (select) select.value = id;
    void switchTo(id);
  };
  document.addEventListener('proto-adapter:change', onAdapterChange);

  // 对外控制（调试/父组件可用）
  (root as any).__previewer__ = {
    switchRuntime: (id: string) => switchTo(id),
    reload: () => {
      if (current) return switchTo(current.id);
      if (currentDemo) return switchTo(currentDemo.id);
      return null;
    },
    getCurrentRuntime: () => current?.id ?? currentDemo?.id ?? null,
    setProps: (nextProps: Record<string, unknown>) => {
      if (demoId) {
        console.warn('[PrototypePreviewer] setProps is not supported in demo mode.');
        return;
      }
      Object.assign(demoProps, nextProps || {});
      if (current) switchTo(current.id);
    },
    destroy: async () => {
      destroyed = true;
      version++;
      releaseHostMount(host);
      document.removeEventListener('proto-adapter:change', onAdapterChange);
      if (currentDemo) await currentDemo.destroy();
      if (current?.api?.unmount) await current.api.unmount(host);
      host.innerHTML = '';
      current = null;
      currentDemo = null;
    },
  };

  // 组件卸载守护（如果父层会移除节点）
  const ro = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      (root as any).__previewer__?.destroy?.();
      ro.disconnect();
    }
  });
  ro.observe(document.body, { childList: true, subtree: true });
}
