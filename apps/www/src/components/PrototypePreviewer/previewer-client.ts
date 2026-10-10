import { createRuntimeTabs, type RuntimeTabsFocusLease } from './runtime-tabs';
// src/next-www/src/components/PrototypePreviewer/previewer-client.ts
import { loadPrototype, loadPrototypes } from './prototype-modules';
import { loadDemo } from './demo-modules';
import { renderDemo } from './demo-renderer';
import { collectPrototypeIds, type DemoSpec } from './demo-types';
import { createRuntimePreviewSurface, runtimePreviewFamily } from './runtime-preview-surface';
import {
  resolveProjectionThemeSurfaceStyle,
  watchProjectionThemeSurfaceStyle,
} from './projection-theme';
import { releaseHostMount } from './runtimes/host-mount';
import type { RuntimeId } from './runtimes/ids';
import { refreshCodePanel } from './code-panel-client';
import {
  initSiteShadcnControls,
  selectValue,
  setSiteSelectDisabled,
  setSelectValue,
  type SiteSelectRoot,
} from '../site-shadcn-controls';
import { initProjectedPreviewer } from './projected-previewer-client';
import type { ProjectionComponentId, ProjectionFamilyId } from './projection-families';

const PREFERRED_ADAPTER_KEY = 'preferred-prototypes-adapter';
// Bind our one public preference event to its initiating logical request. A
// synchronous newer request can invalidate the remaining outer event delivery.
const runtimeBroadcastRequests = new WeakMap<
  Event,
  Readonly<{ source: HTMLElement; isCurrent(): boolean }>
>();

interface PreviewerOptions {
  root: HTMLElement;
  prototypeId?: string;
  demoId?: string;
  initialRuntime: RuntimeId;
  demoProps: Record<string, unknown>;
  runtimeList: RuntimeId[];
  projectionFamilyId?: ProjectionFamilyId;
  projectionComponentId?: ProjectionComponentId;
  projectionToolbar?: boolean;
}

export function initPreviewer(options: PreviewerOptions) {
  if (options.projectionFamilyId || options.projectionComponentId) {
    if (!options.demoId || !options.projectionFamilyId || !options.projectionComponentId) {
      throw new Error(
        '[PrototypePreviewer] fixed-family projection requires demoId, projectionFamilyId, and projectionComponentId.'
      );
    }
    return initProjectedPreviewer({
      root: options.root,
      initialRuntime: options.initialRuntime,
      runtimeList: options.runtimeList,
      projectionFamilyId: options.projectionFamilyId,
      componentId: options.projectionComponentId,
      toolbar: options.projectionToolbar !== false,
    });
  }

  const { root, prototypeId, demoId, initialRuntime, demoProps, runtimeList } = options;

  // 防重复初始化
  if (root.dataset.inited === '1') {
    console.warn('[PrototypePreviewer] already initialized:', root.dataset.previewerId);
    return;
  }
  root.dataset.inited = '1';

  const host = root.querySelector('.host') as HTMLElement;
  // The renderer owns host children, including clearing them before asynchronous
  // preparation. Keep the initial status in its application shell until publish.
  const startupStatus = host.querySelector<HTMLElement>('.proto-previewer__skeleton');
  const startupShell = host.parentElement;
  const hostWasInert = host.inert;
  let startupPending = Boolean(startupStatus && startupShell);
  if (startupStatus && startupShell) {
    startupShell.insertBefore(startupStatus, host);
    startupShell.setAttribute('data-previewer-startup-shell', '');
    host.setAttribute('data-previewer-startup-pending', '');
    host.inert = true;
  }
  const finishStartup = () => {
    if (!startupPending) return;
    startupPending = false;
    startupStatus!.remove();
    startupShell?.removeAttribute('data-previewer-startup-shell');
    host.removeAttribute('data-previewer-startup-pending');
    host.inert = hostWasInert;
  };
  const selectRoot = root.querySelector<SiteSelectRoot>(
    '[data-adapter-select-root], wc-shadcn-select-root'
  );
  const nativeSelect = root.querySelector<HTMLSelectElement>('select');

  const readSelectValue = () =>
    selectRoot ? selectValue(selectRoot) : (nativeSelect?.value ?? initialRuntime);
  const writeSelectValue = (value: string) => {
    if (selectRoot) setSelectValue(selectRoot, value);
    else if (nativeSelect) nativeSelect.value = value;
  };
  const setPreviewerSelectDisabled = (disabled: boolean) => {
    runtimeTabs?.setDisabled(disabled);
    if (selectRoot) setSiteSelectDisabled(selectRoot, disabled);
    else if (nativeSelect) nativeSelect.disabled = disabled;
  };

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
  const tabsMount = root.querySelector<HTMLElement>('[data-runtime-tabs-mount]');
  const previewPanel = root.querySelector<HTMLElement>('[data-panel="preview"]');
  const runtimeTabs =
    tabsMount && previewPanel
      ? createRuntimeTabs({
          mount: tabsMount,
          panel: previewPanel,
          family: runtimePreviewFamily(root),
          runtimes: runtimeList,
          value: selectedInitialRuntime,
          onValueChange(value) {
            // Only this local activation owns focus return. The document broadcast
            // still synchronizes other previews, without granting them a lease.
            const requestVersion = version + 1;
            void switchTo(value, { focusLease: runtimeTabs?.captureFocusLease(value) });
            const isCurrent = () =>
              !destroyed && version === requestVersion && requestedRuntime === value;
            // destroy() can synchronously request a newer runtime before the
            // async switch returns. That winner also owns storage/broadcast.
            if (!isCurrent()) return;
            try {
              localStorage.setItem(PREFERRED_ADAPTER_KEY, value);
            } catch {
              /* optional storage */
            }
            if (!isCurrent()) return;
            const event = new CustomEvent('proto-adapter:change', { detail: { adapter: value } });
            runtimeBroadcastRequests.set(event, { source: root, isCurrent });
            document.dispatchEvent(event);
          },
        })
      : null;
  const nativeSelectUsesPagePreference = Boolean(nativeSelect?.closest('[data-adapter-select]'));

  let currentDemo: { id: string; destroy: () => Promise<void> | void } | null = null;
  let requestedRuntime: RuntimeId | null = null;
  let version = 0;
  let destroyed = false;
  let mounted = false;
  let stopThemeWatcher: (() => void) | null = null;
  let activeSurface: ReturnType<typeof createRuntimePreviewSurface> | null = null;
  let stopFamilyObserver: (() => void) | null = null;
  let destroyPromise: Promise<void> | null = null;
  let activeFocusLease: RuntimeTabsFocusLease | null = null;

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

  // Populate the shared Shadcn Select composition while retaining a native
  // fallback for the isolated unit-test harness and third-party embeds.
  if (selectRoot) {
    const content = selectRoot.querySelector<HTMLElement>('wc-shadcn-select-content');
    content?.replaceChildren();
    for (const id of runtimeList) {
      const item = document.createElement('wc-shadcn-select-item');
      item.dataset.value = id;
      item.dataset.textValue =
        (
          {
            wc: 'Web Components',
            react: 'React',
            vue: 'Vue',
            vue2: 'Vue 2',
          } as Record<string, string>
        )[id] || id;
      item.textContent = item.dataset.textValue;
      content?.appendChild(item);
    }
    initSiteShadcnControls(selectRoot);
    // AdapterSelect has an SSR `wc` seed. The preference-adjusted runtime is
    // authoritative for both the first mount and the visible selector.
    writeSelectValue(selectedInitialRuntime);
  } else if (nativeSelect) {
    nativeSelect.innerHTML = '';
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
      nativeSelect.appendChild(opt);
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

  async function switchTo(
    id: string,
    options: { force?: boolean; focusLease?: RuntimeTabsFocusLease | null } = {}
  ) {
    if (destroyed) {
      options.focusLease?.cancel();
      return;
    }
    const runtime = id as RuntimeId;
    const activeRuntime = currentDemo?.id ?? null;
    if (
      !options.force &&
      (requestedRuntime === runtime || (requestedRuntime === null && activeRuntime === runtime))
    ) {
      options.focusLease?.cancel();
      writeSelectValue(runtime);
      return;
    }
    activeFocusLease?.cancel();
    const focusLease = options.focusLease ?? null;
    activeFocusLease = focusLease;
    let committed = false;
    requestedRuntime = runtime;
    const myVersion = ++version;
    // Invalidate a runtime that is still awaiting its loader before this
    // switch reaches the next runtime's mount() call.
    releaseHostMount(host);
    setPreviewerSelectDisabled(true);

    try {
      stopThemeWatcher?.();
      stopThemeWatcher = null;
      stopFamilyObserver?.();
      stopFamilyObserver = null;
      activeSurface = null;
      const previous = currentDemo;
      currentDemo = null;
      if (previous) await previous.destroy();
      else host.replaceChildren();
      if (destroyed || myVersion !== version) return;
      runtimeTabs?.select(runtime);

      let demo: DemoSpec;
      if (demoId) {
        demo = await loadDemo(demoId);
      } else {
        if (!prototypeId) throw new Error('[PrototypePreviewer] missing prototypeId');
        await ensurePrototypeLoaded();
        demo = { type: 'demo', root: { kind: 'proto', prototypeId, props: { ...demoProps } } };
      }
      if (destroyed || myVersion !== version) return;
      let family = runtimePreviewFamily(root);
      const surface = createRuntimePreviewSurface(
        demo,
        family,
        resolveProjectionThemeSurfaceStyle(family, root),
        runtime
      );
      const ids = new Set<string>();
      collectPrototypeIds(surface.demo.root, ids);
      // The direct Prototype was already loaded above, including a caller's
      // custom loader. Only newly composed parts require this module table.
      if (!demoId && prototypeId) ids.delete(prototypeId);
      await loadPrototypes(Array.from(ids));
      if (destroyed || myVersion !== version) return;
      const result = await renderDemo({
        runtime,
        demo: surface.demo,
        host,
        isCurrent: () => !destroyed && myVersion === version,
      });
      try {
        await surface.ready;
        if (!destroyed && myVersion === version) {
          // The renderer already owns a framework root and setup resources.
          // Keep all unpublished shell preparation inside its cleanup boundary.
          family = runtimePreviewFamily(root);
          await surface.setAppearance(family, resolveProjectionThemeSurfaceStyle(family, root));
        }
      } catch (error) {
        await result.destroy();
        throw error;
      }
      if (destroyed || myVersion !== version) {
        await result.destroy();
        return;
      }
      finishStartup();
      currentDemo = { id, destroy: result.destroy };
      activeSurface = surface;
      const watchTheme = () =>
        watchProjectionThemeSurfaceStyle(family, root, (theme) => {
          if (!destroyed && myVersion === version && activeSurface === surface) {
            void surface
              .setAppearance(family, theme)
              .catch((error) => console.error('[RuntimeBox] Shell family update failed.', error));
          }
        });
      stopThemeWatcher = watchTheme();
      const familyObserver = new MutationObserver(() => {
        if (destroyed || myVersion !== version || activeSurface !== surface) return;
        const nextFamily = runtimePreviewFamily(root);
        if (nextFamily === family) return;
        family = nextFamily;
        stopThemeWatcher?.();
        stopThemeWatcher = watchTheme();
      });
      for (let scope: HTMLElement | null = root; scope; scope = scope.parentElement) {
        familyObserver.observe(scope, {
          attributes: true,
          attributeFilter: ['data-site-library-family', 'data-projection-family', 'class'],
        });
      }
      stopFamilyObserver = () => familyObserver.disconnect();
      updateCodePanel(runtime);
      dispatch('runtime:changed', { id: runtime });
      if (!mounted) {
        mounted = true;
        dispatch('previewer:mounted', { runtime });
      }
      committed = true;
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
      host.appendChild(pre);
      finishStartup();
      console.error(err);
      dispatch('error', { error: err });
    } finally {
      if (myVersion === version && !destroyed) {
        requestedRuntime = null;
        setPreviewerSelectDisabled(false);
        if (activeFocusLease === focusLease) activeFocusLease = null;
        if (committed) focusLease?.restore();
        else focusLease?.cancel();
      } else {
        focusLease?.cancel();
      }
    }
  }

  // 首次挂载（统一走 runtime 生命周期，避免 WC 单走一套）
  void switchTo(selectedInitialRuntime);

  // AdapterSelect synchronizes all selector instances and broadcasts the selected
  // runtime. Listen on document so the page-level selector also remounts every
  // compatible previewer; previewer-local selector changes use the same path.
  const onSelectChange = (event: Event) => {
    const detail = (event as CustomEvent<{ value?: unknown }>).detail;
    const id = typeof detail?.value === 'string' ? detail.value : readSelectValue();
    if (!runtimeList.includes(id as RuntimeId)) return;
    writeSelectValue(id);
    void switchTo(id);
  };
  // AdapterSelect already broadcasts a single document-level preference event
  // for its valueChange. Listening to that root as well would remount twice;
  // retain the local path only for isolated custom-select embeddings that do
  // not participate in the shared adapter preference bridge.
  const usesSharedAdapterSelect = selectRoot?.hasAttribute('data-adapter-select-root') ?? false;
  if (selectRoot && !usesSharedAdapterSelect) {
    selectRoot.addEventListener('valueChange', onSelectChange);
  } else if (nativeSelect && !nativeSelectUsesPagePreference) {
    nativeSelect.addEventListener('change', onSelectChange);
  }

  const onAdapterChange = (event: Event) => {
    const request = runtimeBroadcastRequests.get(event);
    if (request && !request.isCurrent()) return;
    const id = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (typeof id !== 'string' || !runtimeList.includes(id as RuntimeId)) return;
    const receivingVersion = version;
    writeSelectValue(id);
    if (version !== receivingVersion || (request && !request.isCurrent())) return;
    // The source already started this exact request; peers enter once here.
    if (request?.source === root) return;
    void switchTo(id);
  };
  document.addEventListener('proto-adapter:change', onAdapterChange);

  // 对外控制（调试/父组件可用）
  (root as any).__previewer__ = {
    switchRuntime: (id: string) => switchTo(id),
    reload: () => {
      if (currentDemo) return switchTo(currentDemo.id, { force: true });
      return null;
    },
    getCurrentRuntime: () => currentDemo?.id ?? null,
    setProps: (nextProps: Record<string, unknown>) => {
      if (demoId) {
        console.warn('[PrototypePreviewer] setProps is not supported in demo mode.');
        return;
      }
      Object.assign(demoProps, nextProps || {});
      if (currentDemo) switchTo(currentDemo.id, { force: true });
    },
    destroy: () => {
      if (destroyPromise) return destroyPromise;
      destroyed = true;
      version++;
      activeFocusLease?.cancel();
      activeFocusLease = null;
      stopThemeWatcher?.();
      stopFamilyObserver?.();
      stopThemeWatcher = null;
      stopFamilyObserver = null;
      activeSurface = null;
      ro.disconnect();
      releaseHostMount(host);
      document.removeEventListener('proto-adapter:change', onAdapterChange);
      if (selectRoot && !usesSharedAdapterSelect) {
        selectRoot.removeEventListener('valueChange', onSelectChange);
      } else if (nativeSelect && !nativeSelectUsesPagePreference) {
        nativeSelect.removeEventListener('change', onSelectChange);
      }
      const previous = currentDemo;
      currentDemo = null;
      destroyPromise = (async () => {
        try {
          await previous?.destroy();
        } finally {
          host.replaceChildren();
          finishStartup();
          runtimeTabs?.dispose();
        }
      })();
      return destroyPromise;
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
