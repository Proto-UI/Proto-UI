import type { RuntimeId } from './runtimes/ids';
import type { ProjectionComponentId, ProjectionFamilyId } from './projection-families';
import { PREVIEW_ERROR_MARKER } from './preview-error-surface';
type PreviewerRoot = HTMLElement & { __previewer__?: { destroy(): unknown } };
type Client = typeof import('./previewer-client');
type Matrix = HTMLElement & {
  warmDemoModules?: () => Promise<{ delivered: number; registered: number } | null>;
};
type PendingPreview = {
  ready: boolean;
  owner: AbortController;
  observedAt?: number;
};
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
  // Only roots observed leaving the light DOM need this fallback. A later
  // host removal cannot expose a closed shadow subtree to a document walker.
  const nonDocumentRoots = new Set<PreviewerRoot>();
  let disposed = false;
  let matrix: Matrix | null = null;
  let intersection: IntersectionObserver | undefined;
  // One eager init per macrotask. A background postTask per matrix cell never
  // drains inside the Shadow split budgets, and running every init in one turn
  // starves the settings controls those tests actually exercise.
  let eagerTurn: Promise<void> = Promise.resolve();
  const waitEagerTurn = (signal: AbortSignal) => {
    signal.throwIfAborted();
    const turn = eagerTurn.then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
          }, 0);
          signal.addEventListener('abort', abort, { once: true });
        })
    );
    eagerTurn = turn.then(
      () => undefined,
      () => undefined
    );
    return turn;
  };
  const stopObserving = (root: PreviewerRoot, entry: PendingPreview) => {
    if (entry.observedAt === undefined) return;
    intersection?.unobserve(root);
    entry.observedAt = undefined;
  };
  const release = (root: PreviewerRoot) => {
    nonDocumentRoots.delete(root);
    const entry = pending.get(root);
    if (!entry) return;
    entry.owner.abort();
    stopObserving(root, entry);
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
      !entry ||
      entry.owner.signal.aborted ||
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
      if (root.dataset.lazy !== 'true') await waitEagerTurn(entry.owner.signal);
      if (
        disposed ||
        entry.owner.signal.aborted ||
        pending.get(root) !== entry ||
        !root.isConnected ||
        !panelVisible(root)
      )
        return;
      stopObserving(root, entry);
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
      if (disposed || entry.owner.signal.aborted || !root.isConnected) return;
      const fallback = root.querySelector<HTMLElement>('.proto-previewer__skeleton');
      if (fallback)
        fallback.textContent =
          PREVIEW_ERROR_MARKER + ' ' + (error instanceof Error ? error.message : String(error));
      console.error(error);
    } finally {
      if (pending.get(root) === entry) delete root.dataset.mounting;
    }
  };
  const onIntersection: IntersectionObserverCallback = (records, observer) => {
    if (observer !== intersection) return;
    const readiness = new Map<PreviewerRoot, boolean>();
    for (const record of records) {
      const root = record.target as PreviewerRoot;
      const observedAt = pending.get(root)?.observedAt;
      // A detached target can be observed again before its old records arrive.
      if (observedAt === undefined || record.time < observedAt) continue;
      readiness.set(root, record.isIntersecting || readiness.get(root) === true);
    }
    for (const [root, ready] of readiness) {
      const entry = pending.get(root);
      if (entry?.observedAt === undefined) continue;
      entry.ready = ready;
      if (ready) void mount(root);
    }
  };
  const scan = () => {
    if (disposed) return;
    const nextMatrix = document.querySelector<Matrix>('[data-demo-matrix]');
    if (matrix !== nextMatrix) {
      if (matrix) delete matrix.warmDemoModules;
      matrix = nextMatrix;
      if (nextMatrix) {
        // The Matrix asks the existing Previewer client to deliver its modules
        // before initialization is measured.
        nextMatrix.warmDemoModules = async () => {
          if (matrix !== nextMatrix || !nextMatrix.isConnected) return null;
          const { demoModuleCount, warmDemoModules } = await import('./previewer-client');
          if (matrix !== nextMatrix || !nextMatrix.isConnected) return null;
          return { delivered: await warmDemoModules(), registered: demoModuleCount() };
        };
      }
    }
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
        owner: new AbortController(),
        ready: root.dataset.lazy !== 'true' || typeof view.IntersectionObserver === 'undefined',
      };
      pending.set(root, entry);
      if (entry.ready) {
        void mount(root);
      } else {
        root.dataset.lazyObserved = '1';
        intersection ??= new view.IntersectionObserver(onIntersection, { rootMargin: '360px 0px' });
        entry.observedAt = view.performance.now();
        intersection.observe(root);
      }
    }
  };
  // Observe only panel attributes, not every runtime's internal style updates.
  const visibility = new view.MutationObserver(() => {
    for (const root of pending.keys()) void mount(root);
  });
  const clear = () => {
    if (matrix) delete matrix.warmDemoModules;
    matrix = null;
    visibility.disconnect();
    intersection?.disconnect();
    intersection = undefined;
    for (const root of pending.keys()) release(root);
  };
  const removal = new view.MutationObserver((records) => {
    if (!records.some((record) => record.removedNodes.length > 0)) {
      // A move back from a shadow root appears here only as an addition.
      // Stop tracking that exception before the next unrelated removal.
      for (const root of nonDocumentRoots)
        if (root.getRootNode() === document) nonDocumentRoots.delete(root);
      return;
    }
    // Runtime child/status removal must not rescan every Matrix previewer.
    // Use tracked identity rather than attributes, which may change after scan.
    const removedRoots = new Set<PreviewerRoot>();
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1) continue;
        const root = node as PreviewerRoot;
        if (pending.has(root)) removedRoots.add(root);
        if (!node.hasChildNodes()) continue;
        const descendants = document.createTreeWalker(node, view.NodeFilter.SHOW_ELEMENT);
        for (let child = descendants.nextNode(); child; child = descendants.nextNode()) {
          if (pending.has(child as PreviewerRoot)) removedRoots.add(child as PreviewerRoot);
        }
      }
    }
    // Collect before destroy mutates detached subtrees. Reinserted/moved roots
    // retain their owners, including moves recorded earlier in this delivery.
    for (const root of nonDocumentRoots) removedRoots.add(root);
    for (const root of removedRoots) {
      if (!root.isConnected) release(root);
      else if (root.getRootNode() !== document) nonDocumentRoots.add(root);
      else nonDocumentRoots.delete(root);
    }
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
