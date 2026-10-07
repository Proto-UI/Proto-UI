import type { RuntimeId } from './runtimes/ids';
import type { ProjectionComponentId, ProjectionFamilyId } from './projection-families';

type PreviewerRoot = HTMLElement & { __previewer__?: { destroy(): unknown } };
type Client = typeof import('./previewer-client');
type PendingPreview = { active: boolean; ready: boolean; observer?: IntersectionObserver };
const documents = new WeakMap<Document, () => void>();

/** One page bootstrap owns pending lazy/import work. The previewer continues
 * to own its runtime generations; removal and Astro swaps revoke both scopes. */
export function initPreviewerBootstrap(
  document: Document,
  loadClient: () => Promise<Pick<Client, 'initPreviewer'>> = () => import('./previewer-client')
): () => void {
  const existing = documents.get(document);
  if (existing) return existing;
  const view = document.defaultView;
  if (!view) return () => {};
  const pending = new Map<PreviewerRoot, PendingPreview>();
  let disposed = false;
  const release = (root: PreviewerRoot) => {
    const entry = pending.get(root);
    if (!entry) return;
    entry.active = false;
    entry.observer?.disconnect();
    pending.delete(root);
    delete root.dataset.mounting;
    delete root.dataset.lazyObserved;
    void root.__previewer__?.destroy();
  };
  // Adapter panels keep mounted runtime state when hidden. Only first activation
  // waits for the panel script to project the current preference into visibility.
  const panelVisible = (root: PreviewerRoot) => {
    let panel = root.closest<HTMLElement>('[data-adapter-panel]');
    while (panel) {
      if (panel.hidden || view.getComputedStyle(panel).display === 'none') return false;
      panel = panel.parentElement?.closest<HTMLElement>('[data-adapter-panel]') ?? null;
    }
    return true;
  };
  const mount = async (root: PreviewerRoot) => {
    const entry = pending.get(root);
    if (
      !entry?.active ||
      !entry.ready ||
      !root.isConnected ||
      root.dataset.inited === '1' ||
      root.dataset.mounting === '1' ||
      !panelVisible(root)
    )
      return;
    root.dataset.mounting = '1';
    try {
      const { initPreviewer } = await loadClient();
      if (
        disposed ||
        !entry.active ||
        pending.get(root) !== entry ||
        !root.isConnected ||
        !panelVisible(root)
      )
        return;
      entry.observer?.disconnect();
      entry.observer = undefined;
      // Read at activation time, after the lazy/import boundary. initPreviewer
      // resolves the current page preference rather than an SSR/runtime snapshot.
      initPreviewer({
        root,
        prototypeId: root.dataset.prototypeId || '',
        demoId: root.dataset.demoId || '',
        initialRuntime: (root.dataset.initialRuntime || 'wc') as RuntimeId,
        demoProps: root.dataset.props ? JSON.parse(root.dataset.props) : {},
        runtimeList: root.dataset.runtimes
          ? JSON.parse(root.dataset.runtimes)
          : ['wc', 'react', 'vue', 'vue2'],
        projectionFamilyId: (root.dataset.projectionFamily || undefined) as
          | ProjectionFamilyId
          | undefined,
        projectionComponentId: (root.dataset.projectionComponent || undefined) as
          | ProjectionComponentId
          | undefined,
        projectionToolbar: root.dataset.projectionToolbar !== 'false',
      });
    } catch (error) {
      if (disposed || !entry.active || !root.isConnected) return;
      const fallback = root.querySelector<HTMLElement>('.proto-previewer__skeleton');
      if (fallback)
        fallback.textContent =
          '[Preview Error] ' + (error instanceof Error ? error.message : String(error));
      console.error(error);
    } finally {
      if (pending.get(root) === entry) delete root.dataset.mounting;
    }
  };
  const scan = () => {
    if (disposed) return;
    for (const panel of document.querySelectorAll('[data-adapter-panel]')) {
      visibility.observe(panel, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
      });
    }
    for (const root of document.querySelectorAll<PreviewerRoot>(
      '.proto-previewer[data-previewer-id]'
    )) {
      if (pending.has(root) || root.dataset.inited === '1') continue;
      const entry: PendingPreview = {
        active: true,
        ready: root.dataset.lazy !== 'true' || typeof view.IntersectionObserver === 'undefined',
      };
      pending.set(root, entry);
      if (entry.ready) {
        void mount(root);
      } else {
        root.dataset.lazyObserved = '1';
        entry.observer = new view.IntersectionObserver(
          (entries) => {
            entry.ready = entries.some((item) => item.isIntersecting);
            if (entry.ready) void mount(root);
          },
          { rootMargin: '360px 0px' }
        );
        entry.observer.observe(root);
      }
    }
  };
  // Observe only panel attributes, not every runtime's internal style updates.
  const visibility = new view.MutationObserver(() => {
    for (const root of pending.keys()) void mount(root);
  });
  const clear = () => {
    visibility.disconnect();
    for (const root of pending.keys()) release(root);
  };
  const removal = new view.MutationObserver(() => {
    for (const root of pending.keys()) if (!root.isConnected) release(root);
  });
  removal.observe(document.documentElement, { childList: true, subtree: true });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    removal.disconnect();
    document.removeEventListener('DOMContentLoaded', scan);
    document.removeEventListener('astro:page-load', scan);
    document.removeEventListener('astro:before-swap', clear);
    clear();
    documents.delete(document);
  };
  documents.set(document, dispose);
  document.addEventListener('astro:page-load', scan);
  document.addEventListener('astro:before-swap', clear);
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
  return dispose;
}
