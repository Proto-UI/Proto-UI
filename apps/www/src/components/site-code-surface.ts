import { createHiddenFirstActivation } from './hidden-first-activation';
import { surfacePrototypeId } from './surface-recipes';
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
  return initPassiveSurface(root, 'code');
}

/** Notes and code share the same passive projection lifetime. Neither creates
 * a semantic owner or moves authored source nodes into a framework renderer. */
export function initNoteSurface(root: HTMLElement): CodeSurfaceHandle {
  return initPassiveSurface(root, 'note');
}

function initPassiveSurface(root: HTMLElement, purpose: 'code' | 'note'): CodeSurfaceHandle {
  const prior = handles.get(root);
  if (prior) return prior;
  const doc = root.ownerDocument;
  const view = doc.defaultView!;
  const coordinates =
    purpose === 'note'
      ? ['noteSurfaceRuntime', 'noteSurfaceFamily', 'noteSurfaceView']
      : ['codeSurfaceRuntime', 'codeSurfaceFamily', 'codeSurfaceView'];
  const title =
    purpose === 'note' ? root.querySelector<HTMLElement>('.starlight-aside__title') : null;
  const originalTitleRole = title?.getAttribute('data-site-typography') ?? null;
  if (title) title.dataset.siteTypography = 'label';
  const logicalOwner = `website-${purpose}-surface-${++nextOwner}`;
  const mount = doc.createElement('div');
  mount.className = `site-${purpose}-surface-mount`;
  mount.setAttribute('aria-hidden', 'true');
  // Native note rhythm includes :first-child paragraph rules. Keep its title
  // first rather than letting a decorative, positioned plane change that fact.
  if (purpose === 'note') root.append(mount);
  else root.prepend(mount);
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
              id: `website-${purpose}-surface`,
              rootPrototypeId: surfacePrototypeId(family),
              prototypeIds: [surfacePrototypeId(family)],
            },
            demo: {
              type: 'demo',
              root: {
                kind: 'proto',
                prototypeId: surfacePrototypeId(family),
                className: `site-${purpose}-surface-paint`,
                surfaceStyle: {
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                },
                props: {
                  variant:
                    purpose === 'note'
                      ? 'outline'
                      : root.dataset.siteCodeSurface === 'toolbar'
                        ? 'transparent'
                        : family === 'shadcn'
                          ? 'muted'
                          : 'outline',
                  radius:
                    purpose === 'note' && family === 'shadcn'
                      ? 'lg'
                      : root.dataset.siteCodeSurface === 'toolbar'
                        ? 'none'
                        : 'default',
                  border: root.dataset.siteCodeSurface === 'toolbar' ? 'bottom' : 'all',
                  elevation: 'none',
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
            root.dataset[coordinates[0]!] = commit.selection.runtimeId;
            root.dataset[coordinates[1]!] = commit.selection.projectionFamilyId;
            root.dataset[coordinates[2]!] = 'ready';
          },
          rollback() {
            if (!isCurrentOwner()) return;
            for (const key of coordinates) {
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
      root.dataset[coordinates[2]!] = current.getSnapshot().generation ? 'retained' : 'unavailable';
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
        for (const key of coordinates) delete root.dataset[key];
        if (title?.dataset.siteTypography === 'label') {
          if (originalTitleRole === null) delete title.dataset.siteTypography;
          else title.dataset.siteTypography = originalTitleRole;
        }
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
  const activation = createHiddenFirstActivation(doc, (root) => {
    if (!roots.has(root))
      roots.set(
        root,
        root.matches('.starlight-aside--note') ? initNoteSurface(root) : initCodeSurface(root)
      );
  });
  const remove = (root: HTMLElement) => {
    const handle = roots.get(root);
    roots.delete(root);
    void handle?.destroy().catch((error) => console.error('[CodeSurface] Cleanup failed.', error));
  };
  const scan = () => {
    for (const root of roots.keys()) if (!root.isConnected) remove(root);
    for (const root of doc.querySelectorAll<HTMLElement>(
      '[data-site-code-surface], .starlight-aside--note'
    )) {
      if (!roots.has(root)) activation.add(root);
    }
  };
  const observer = new doc.defaultView!.MutationObserver(scan);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    activation.dispose();
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
