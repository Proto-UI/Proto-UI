import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { isRuntimeId, type RuntimeId } from './PrototypePreviewer/runtimes/ids';
import { createProjectionScopeController } from './PrototypePreviewer/projection-scope';
import { watchProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';
import { resolveSiteLibraryFamily } from './site-library-family';
import { siteTypographyParticipant } from './site-typography';

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
    return committed === 'shadcn' || committed === 'brutalist'
      ? committed
      : resolveSiteLibraryFamily(view.location.pathname);
  };
  const controller = createProjectionScopeController({
    initialSelection: { runtimeId: runtime, projectionFamilyId: family() },
    async materialize(request) {
      const selectedFamily = request.selection.projectionFamilyId;
      if (selectedFamily !== 'shadcn' && selectedFamily !== 'brutalist')
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
  const refresh = () => {
    if (!alive) return;
    const snapshot = controller.getSnapshot();
    if (snapshot.phase === 'preparing' || snapshot.phase === 'destroyed') return;
    if (snapshot.phase === 'idle') {
      void observe(controller.start());
      return;
    }
    const selection = { runtimeId: runtime, projectionFamilyId: family() };
    if (
      participant.needsRefresh() ||
      snapshot.selection.runtimeId !== runtime ||
      snapshot.selection.projectionFamilyId !== selection.projectionFamilyId
    )
      void observe(controller.request(selection, { force: participant.needsRefresh() }));
  };
  const preference = (event: Event) => {
    const next = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (!alive || !isRuntimeId(next)) return;
    runtime = next;
    // Supersede preparation as well as ready generations; the scope owns races.
    const selection = { runtimeId: runtime, projectionFamilyId: family() };
    void observe(
      controller.getSnapshot().phase === 'idle'
        ? controller.start().then(() => controller.request(selection))
        : controller.request(selection)
    );
  };
  const observer = new view.MutationObserver((records) => {
    if (!root.isConnected) void handle.destroy();
    else if (records.some((record) => root.contains(record.target))) refresh();
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
