import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { deferUntilDocsHeaderPrepared } from './docs-header-preparation';
import { isRuntimeId, type RuntimeId } from './PrototypePreviewer/runtimes/ids';
import { createProjectionScopeController } from './PrototypePreviewer/projection-scope';
import { watchProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';
import { resolveSiteLibraryFamily } from './site-library-family';
import { isPrivateTypographyMutation, siteTypographyParticipant } from './site-typography';

type DocumentationTypographyHandle = { destroy(): Promise<void>; ready: Promise<unknown> };
const documents = new WeakMap<
  Document,
  { root: HTMLElement; handle: DocumentationTypographyHandle }
>();
/** Documentation has one explicit typography scope, shared global runtime
 * preference, no competing picker and no coupling to each individual demo. */
export function initDocumentationTypography(doc: Document = document) {
  if (doc.querySelector('[data-homepage-runtime]')) return;
  const view = doc.defaultView!;
  const root = doc.querySelector<HTMLElement>('[data-site-family-scope]') ?? doc.body;
  const existing = documents.get(doc);
  if (existing?.root === root && root.isConnected) return existing.handle;
  // A route can replace its owner and call init before MutationObserver runs.
  // Revoke the old registration synchronously; its async teardown owns only
  // its detached source/batch and cannot remove the next registration.
  if (existing) void existing.handle.destroy();
  const participant = siteTypographyParticipant(root, {
    docsOnly: true,
    ownerId: 'documentation-typography',
  });
  let runtime: RuntimeId = 'wc';
  try {
    const saved = view.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    if (isRuntimeId(saved)) runtime = saved;
  } catch {
    /* Optional preference. */
  }
  let alive = true;
  const family = () => {
    const committed = root.dataset.siteLibraryFamily;
    return committed === 'shadcn' ||
      committed === 'brutalist' ||
      committed === 'bootstrap-2-3-2'
      ? committed
      : resolveSiteLibraryFamily(view.location.pathname);
  };
  const controller = createProjectionScopeController({
    initialSelection: { runtimeId: runtime, projectionFamilyId: family() },
    async materialize(request) {
      const selectedFamily = request.selection.projectionFamilyId;
      if (
        selectedFamily !== 'shadcn' &&
        selectedFamily !== 'brutalist' &&
        selectedFamily !== 'bootstrap-2-3-2'
      )
        throw new Error('[SiteTypography] Unsupported documentation typography family.');
      const candidate = await participant.materialize(request);
      let stop: () => void;
      try {
        stop = watchProjectionThemeSurfaceStyle(
          selectedFamily,
          root,
          candidate.setThemeSurfaceStyle
        );
      } catch (error) {
        await candidate.dispose();
        throw error;
      }
      return {
        ...candidate,
        async dispose() {
          stop();
          await candidate.dispose();
        },
      };
    },
  });
  const observe = (pending: Promise<unknown>) =>
    pending
      .then(() => {
        // A source mutation may arrive while preparation suppresses observers.
        // Reconcile once the transaction settles rather than waiting for another
        // unrelated mutation to notice an unprojected source node.
        if (alive) refresh();
      })
      .catch((error) => {
        if (alive)
          console.error(
            '[SiteTypography] Retained native documentation text after projection failure.',
            error
          );
      });
  let preferencePending = false;
  const deferredPreparation = deferUntilDocsHeaderPrepared(root, () => {
    if (!alive || !root.isConnected || root.ownerDocument !== doc) return;
    const supersede = preferencePending;
    preferencePending = false;
    const snapshot = controller.getSnapshot();
    if ((!supersede && snapshot.phase === 'preparing') || snapshot.phase === 'destroyed') return;
    const selection = { runtimeId: runtime, projectionFamilyId: family() };
    if (snapshot.phase === 'idle') {
      void observe(
        supersede
          ? controller.start().then(() => {
              if (
                alive &&
                root.isConnected &&
                root.ownerDocument === doc &&
                runtime === selection.runtimeId
              )
                return controller.request(selection);
            })
          : controller.start()
      );
      return;
    }
    const sourceChanged = snapshot.phase === 'ready' && participant.needsRefresh();
    if (
      supersede ||
      sourceChanged ||
      snapshot.selection.runtimeId !== runtime ||
      snapshot.selection.projectionFamilyId !== selection.projectionFamilyId
    )
      void observe(controller.request(selection, { force: sourceChanged }));
  });
  let refreshTask: number | undefined;
  const refresh = () => {
    if (!alive || refreshTask !== undefined) return;
    // Framework commits can deliver many observer batches before the next
    // browser task. Reconcile the current source inventory once for that burst,
    // rather than walking the whole documentation subtree for every delivery.
    refreshTask = view.setTimeout(() => {
      refreshTask = undefined;
      void deferredPreparation.prepare();
    }, 0);
  };
  const preference = (event: Event) => {
    const next = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (!alive || !isRuntimeId(next)) return;
    runtime = next;
    preferencePending = true;
    // Read the latest preference and native source inventory when critical
    // Header/Search preparation permits this independent scope to start.
    void deferredPreparation.prepare();
  };
  const observer = new view.MutationObserver((records) => {
    if (!root.isConnected) void handle.destroy();
    else if (
      // A queued reconciliation inventories both sides of any source move at
      // execution time. Preparation also reconciles when its transaction settles.
      // Neither case needs to rescan private owners for each intervening record.
      refreshTask === undefined &&
      controller.getSnapshot().phase !== 'preparing' &&
      records.some(
        (record) =>
          root.contains(record.target) &&
          (record.attributeName === 'data-site-library-family' ||
            !isPrivateTypographyMutation(record))
      )
    ) {
      // Private component updates do not change the native source inventory.
      // The shared ownership check retains moved source and native-label cases.
      refresh();
    }
  });
  // Watching only root cannot observe root's own removal from its parent.
  // Document remains stable across owner/body replacements and view swaps.
  observer.observe(doc, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-site-typography', 'data-site-library-family'],
  });
  const compact = view.matchMedia('(max-width: 47.999rem)');
  compact.addEventListener('change', refresh);
  doc.addEventListener(PREFERRED_ADAPTER_EVENT, preference);
  const onSwap = () => {
    void handle.destroy();
  };
  doc.addEventListener('astro:before-swap', onSwap);
  let destruction: Promise<void> | undefined;
  const handle = {
    ready: observe(controller.start()),
    destroy() {
      return (destruction ??= (async () => {
        alive = false;
        deferredPreparation.cancel();
        if (refreshTask !== undefined) {
          view.clearTimeout(refreshTask);
          refreshTask = undefined;
        }
        observer.disconnect();
        compact.removeEventListener('change', refresh);
        doc.removeEventListener(PREFERRED_ADAPTER_EVENT, preference);
        doc.removeEventListener('astro:before-swap', onSwap);
        participant.destroy();
        if (documents.get(doc)?.handle === handle) documents.delete(doc);
        await controller.destroy();
      })());
    },
  };
  documents.set(doc, { root, handle });
  return handle;
}
