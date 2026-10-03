import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { isRuntimeId, type RuntimeId } from './PrototypePreviewer/runtimes/registry';
import { runtimePreviewFamily } from './PrototypePreviewer/runtime-preview-surface';
import {
  createProjectionScopeController,
  type ProjectionScopeController,
  type ProjectionScopeSelection,
} from './PrototypePreviewer/projection-scope';
import { materializeProjectionCandidate } from './PrototypePreviewer/projection-materializer';
import { watchProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';
import type { ProjectionCompositionControls } from './PrototypePreviewer/projection-composition';

const NO_CONTROLS: ProjectionCompositionControls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};
const handles = new WeakMap<HTMLElement, CodeSurfaceHandle>();
let nextOwner = 0;
type Previewer = HTMLElement & { __previewer__?: { getCurrentRuntime(): unknown } };
export type CodeSurfaceHandle = {
  ready: Promise<unknown>;
  refresh(): void;
  destroy(): Promise<void>;
};

/** The projection is decoration behind stable native content, never a substitute
 * command skin. No source node is moved, cloned, replaced or made inert. */
export function initCodeSurface(root: HTMLElement): CodeSurfaceHandle {
  const prior = handles.get(root);
  if (prior) return prior;
  const doc = root.ownerDocument;
  const view = doc.defaultView!;
  const logicalOwner = `website-code-surface-${++nextOwner}`;
  const mount = doc.createElement('div');
  mount.className = 'site-code-surface-mount';
  mount.setAttribute('aria-hidden', 'true');
  root.prepend(mount);
  const previewer = root.closest<Previewer>('[data-previewer-id]');
  let preferred: RuntimeId = 'wc';
  try {
    const stored = view.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    if (isRuntimeId(stored)) preferred = stored;
  } catch {
    /* An in-document preference does not require storage. */
  }
  let alive = true;
  let handle: CodeSurfaceHandle;
  const ownsRoot = () => handles.get(root) === handle;
  const isCurrentOwner = () => alive && ownsRoot();
  let attempt = 0;
  const retired = new Set<Promise<void>>();
  const selection = (): ProjectionScopeSelection => {
    const committed = previewer?.__previewer__?.getCurrentRuntime();
    return {
      runtimeId: isRuntimeId(committed) ? committed : previewer ? 'wc' : preferred,
      projectionFamilyId: runtimePreviewFamily(root),
    };
  };
  const createController = (initialSelection: ProjectionScopeSelection) => {
    const ownerId = `${logicalOwner}-attempt-${++attempt}`;
    return createProjectionScopeController({
      initialSelection,
      async materialize(request) {
        const family =
          request.selection.projectionFamilyId === 'brutalist' ? 'brutalist' : 'shadcn';
        const candidate = await materializeProjectionCandidate(request, {
          mount,
          ownerId,
          componentId: 'button',
          controls: NO_CONTROLS,
          controlIds: [],
          content: {
            recipe: {
              id: 'website-code-surface',
              rootPrototypeId: 'site-code-surface',
              prototypeIds: ['site-code-surface'],
            },
            demo: {
              type: 'demo',
              root: {
                kind: 'proto',
                prototypeId: 'site-code-surface',
                className: 'site-code-surface-paint',
                props: {
                  family,
                  part: root.dataset.siteCodeSurface === 'toolbar' ? 'toolbar' : 'frame',
                },
              },
            },
          },
        });
        // A removed root can already have a new handle. The old controller
        // disposes this late candidate in its own detached mount; it must not
        // acquire a new theme watcher or publish into the reacquired root.
        if (!isCurrentOwner()) return candidate;
        let stopTheme: () => void;
        try {
          stopTheme = watchProjectionThemeSurfaceStyle(family, root, (theme) =>
            candidate.setThemeSurfaceStyle(theme)
          );
        } catch (error) {
          await candidate.dispose();
          throw error;
        }
        return {
          activate: () => candidate.activate(),
          setLocked: (locked: boolean) => candidate.setLocked?.(locked),
          async dispose() {
            stopTheme();
            await candidate.dispose();
          },
        };
      },
      prepareCommit(commit) {
        const old = { ...root.dataset };
        return {
          publish() {
            if (!isCurrentOwner()) return;
            root.dataset.codeSurfaceRuntime = commit.selection.runtimeId;
            root.dataset.codeSurfaceFamily = commit.selection.projectionFamilyId;
            root.dataset.codeSurfaceView = 'ready';
          },
          rollback() {
            if (!isCurrentOwner()) return;
            for (const key of ['codeSurfaceRuntime', 'codeSurfaceFamily', 'codeSurfaceView']) {
              if (old[key] === undefined) delete root.dataset[key];
              else root.dataset[key] = old[key];
            }
          },
        };
      },
    });
  };
  let controller = createController(selection());
  const observe = (promise: Promise<unknown>, current: ProjectionScopeController) =>
    promise.catch((error) => {
      if (!isCurrentOwner() || current !== controller) return;
      root.dataset.codeSurfaceView = current.getSnapshot().generation ? 'retained' : 'unavailable';
      console.error(
        '[CodeSurface] Passive projection failed; native source remains available.',
        error
      );
    });
  const refresh = () => {
    if (!isCurrentOwner()) return;
    const next = selection();
    const snapshot = controller.getSnapshot();
    if (snapshot.generation === 0 && snapshot.phase === 'idle') {
      const cleanup = controller.destroy();
      retired.add(cleanup);
      void cleanup
        .finally(() => retired.delete(cleanup))
        .catch((error) => console.error('[CodeSurface] Retired projection cleanup failed.', error));
      controller = createController(next);
      void observe(controller.start(), controller);
    } else void observe(controller.request(next), controller);
  };
  const preference = (event: Event) => {
    const adapter = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (!isRuntimeId(adapter)) return;
    preferred = adapter;
    if (!previewer) refresh();
  };
  doc.addEventListener(PREFERRED_ADAPTER_EVENT, preference);
  previewer?.addEventListener('runtime:changed', refresh);
  const observer = new view.MutationObserver(refresh);
  for (let ancestor: HTMLElement | null = root; ancestor; ancestor = ancestor.parentElement) {
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: [
        'data-site-library-family',
        'data-projection-family',
        'data-projection-runtime',
        'data-runner-runtime',
      ],
    });
  }
  handle = {
    refresh,
    ready: observe(controller.start(), controller),
    async destroy() {
      if (!alive) return;
      alive = false;
      observer.disconnect();
      doc.removeEventListener(PREFERRED_ADAPTER_EVENT, preference);
      previewer?.removeEventListener('runtime:changed', refresh);
      // Revoke shared coordinates and visible DOM synchronously, before a
      // document scan can give this same native source root a fresh handle.
      // Async cleanup owns only this instance's detached mount thereafter.
      if (ownsRoot()) {
        handles.delete(root);
        delete root.dataset.codeSurfaceRuntime;
        delete root.dataset.codeSurfaceFamily;
        delete root.dataset.codeSurfaceView;
      }
      mount.remove();
      try {
        await controller.destroy();
      } finally {
        await Promise.allSettled([...retired]);
        mount.remove();
      }
    },
  };
  handles.set(root, handle);
  return handle;
}

const documents = new WeakMap<Document, { scan(): void; dispose(): void }>();
export function initSiteCodeSurfaces(doc: Document = document): () => void {
  const existing = documents.get(doc);
  if (existing) {
    existing.scan();
    return existing.dispose;
  }
  const roots = new Map<HTMLElement, CodeSurfaceHandle>();
  const remove = (root: HTMLElement) => {
    const handle = roots.get(root);
    roots.delete(root);
    void handle?.destroy().catch((error) => console.error('[CodeSurface] Cleanup failed.', error));
  };
  const scan = () => {
    for (const root of roots.keys()) if (!root.isConnected) remove(root);
    for (const root of doc.querySelectorAll<HTMLElement>('[data-site-code-surface]')) {
      if (!roots.has(root)) roots.set(root, initCodeSurface(root));
    }
  };
  const observer = new doc.defaultView!.MutationObserver(scan);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    doc.removeEventListener('astro:before-swap', dispose);
    for (const root of roots.keys()) remove(root);
    documents.delete(doc);
  };
  documents.set(doc, { scan, dispose });
  observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('astro:before-swap', dispose);
  scan();
  return dispose;
}
