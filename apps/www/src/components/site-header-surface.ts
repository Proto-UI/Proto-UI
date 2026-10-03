import { contentsCommandParticipant } from './site-contents-command';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { isRuntimeId, type RuntimeId } from './PrototypePreviewer/runtimes/registry';
import {
  createProjectionScopeController,
  type ProjectionScopeCommit,
  type ProjectionScopeMaterializeRequest,
} from './PrototypePreviewer/projection-scope';
import {
  materializeProjectionCandidate,
  type MaterializedProjectionCandidate,
} from './PrototypePreviewer/projection-materializer';
import { watchProjectionThemeSurfaceStyle } from './PrototypePreviewer/projection-theme';
import { resolveSiteLibraryFamily } from './site-library-family';

const controls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};
let serial = 0;

/** The app retains one native navigation subtree. The passive Prototype owns
 * its actual slotted visual surface; it never owns disclosure or activation. */
export function headerSurfaceParticipant(header: HTMLElement) {
  const panel = header.querySelector<HTMLElement>('[data-site-header-panel]');
  const mount = panel?.querySelector<HTMLElement>('[data-site-header-surface-mount]');
  const content = panel?.querySelector<HTMLElement>('[data-site-header-panel-content]');
  if (!panel || !mount || !content) return null;
  const root = panel;
  const document = header.ownerDocument;
  const owner = `site-header-surface-${++serial}`;
  const slots = new Map<number, HTMLElement>();
  const names = [
    'data-header-surface-runtime',
    'data-header-surface-family',
    'data-header-surface-generation',
  ];
  const moveContent = (parent: HTMLElement, before: ChildNode | null = null) => {
    const focused = document.activeElement as HTMLElement | null;
    const restoreFocus = !!focused && content.contains(focused);
    // The same native subtree, link destinations and control state survive.
    parent.insertBefore(content, before);
    if (restoreFocus && focused?.isConnected && !focused.closest('[hidden], [inert]'))
      focused.focus();
  };
  return {
    root,
    mount,
    async materialize(
      request: ProjectionScopeMaterializeRequest
    ): Promise<MaterializedProjectionCandidate> {
      const family = request.selection.projectionFamilyId;
      if (family !== 'shadcn' && family !== 'brutalist')
        throw new Error('Header surface family is unavailable');
      let ownedSlot: HTMLElement | undefined;
      const candidate = await materializeProjectionCandidate(request, {
        mount,
        ownerId: owner,
        componentId: 'button',
        controls,
        controlIds: [],
        content: {
          recipe: {
            id: owner,
            prototypeIds: ['site-preview-surface'],
            rootPrototypeId: 'site-preview-surface',
          },
          demo: {
            type: 'demo',
            root: {
              kind: 'proto',
              prototypeId: 'site-preview-surface',
              ref: 'header-surface',
              className: 'site-header-popup-surface',
              props: { family, emphasis: 'plain', appearance: 'popup' },
              children: [
                { kind: 'box', ref: 'header-native-slot', className: 'site-header-native-slot' },
              ],
            },
            setup(context) {
              const slot = context.refs['header-native-slot'];
              if (!slot) throw new Error('Header surface native slot is missing');
              ownedSlot = slot;
              slots.set(request.generation, slot);
              return () => {
                if (slots.get(request.generation) === slot) slots.delete(request.generation);
              };
            },
          },
        },
      });
      const dispose = candidate.dispose.bind(candidate);
      return {
        ...candidate,
        async dispose() {
          const slot = ownedSlot;
          // Detach app content before its retired renderer tears down. A stale
          // generation never moves content already owned by its successor.
          if (slot?.contains(content)) moveContent(root, mount);
          await dispose();
        },
      };
    },
    prepareCommit(commit: ProjectionScopeCommit) {
      const slot = slots.get(commit.generation);
      if (!slot) throw new Error('Header surface has no prepared native slot');
      const previousParent = content.parentElement!;
      const previousNext = content.nextSibling;
      const previous = names.map((name) => [name, root.getAttribute(name)] as const);
      return {
        publish() {
          moveContent(slot);
          root.dataset.headerSurfaceRuntime = commit.selection.runtimeId;
          root.dataset.headerSurfaceFamily = commit.selection.projectionFamilyId;
          root.dataset.headerSurfaceGeneration = String(commit.generation);
        },
        rollback() {
          if (slot.contains(content)) moveContent(previousParent, previousNext);
          for (const [name, value] of previous) {
            if (value === null) root.removeAttribute(name);
            else root.setAttribute(name, value);
          }
        },
      };
    },
  };
}

const documentationOwners = new WeakMap<HTMLElement, { destroy(): Promise<void> }>();
/** Docs expose a bounded Header-surface scope; the homepage uses its page transaction. */
export function initDocumentationHeaderSurface(header: HTMLElement) {
  const existing = documentationOwners.get(header);
  if (existing) return existing;
  if (header.hasAttribute('data-homepage-runtime'))
    throw new Error('Homepage Header requires its page transaction');
  if (!header.querySelector('[data-site-header-surface-mount]')) return;
  const document = header.ownerDocument;
  let runtime: RuntimeId = 'wc';
  try {
    const saved = document.defaultView?.localStorage.getItem(PREFERRED_ADAPTER_KEY);
    if (isRuntimeId(saved)) runtime = saved;
  } catch {
    /* Optional preference. */
  }
  const family = resolveSiteLibraryFamily(document.defaultView?.location.pathname ?? '/');
  let alive = true;
  const retired = new Set<Promise<void>>();
  const contents = contentsCommandParticipant(header);
  let attempt = 0;
  const create = () => {
    const participant = headerSurfaceParticipant(header)!;
    const namespace = `docs-${++attempt}`;
    return createProjectionScopeController({
      initialSelection: { runtimeId: runtime, projectionFamilyId: family },
      async materialize(request) {
        const outcomes = await Promise.allSettled([
          participant.materialize(request),
          ...(contents ? [contents.materialize(request, namespace)] : []),
        ]);
        const candidates = outcomes.flatMap((outcome) =>
          outcome.status === 'fulfilled' ? [outcome.value] : []
        );
        const failure = outcomes.find((outcome) => outcome.status === 'rejected');
        if (failure?.status === 'rejected') {
          await Promise.allSettled(candidates.map((candidate) => candidate.dispose()));
          throw failure.reason;
        }
        let stop: () => void;
        try {
          stop = watchProjectionThemeSurfaceStyle(family, header, (theme) =>
            candidates.forEach((candidate) => candidate.setThemeSurfaceStyle(theme))
          );
        } catch (error) {
          await Promise.allSettled(candidates.map((candidate) => candidate.dispose()));
          throw error;
        }
        return {
          activate() {
            candidates.forEach((candidate) => candidate.activate());
          },
          setLocked(locked: boolean) {
            candidates.forEach((candidate) => candidate.setLocked?.(locked));
          },
          async dispose() {
            stop();
            const results = await Promise.allSettled(
              candidates.map((candidate) => candidate.dispose())
            );
            const failure = results.find((result) => result.status === 'rejected');
            if (failure?.status === 'rejected') throw failure.reason;
          },
        };
      },
      prepareCommit(commit) {
        const publications = [participant.prepareCommit(commit)];
        try {
          if (contents) publications.push(contents.prepareCommit(commit));
        } catch (error) {
          for (const publication of publications.reverse()) publication.rollback();
          throw error;
        }
        return {
          publish() {
            publications.forEach((publication) => publication.publish());
          },
          rollback() {
            [...publications].reverse().forEach((publication) => publication.rollback());
          },
        };
      },
    });
  };
  let controller = create();
  const observe = (pending: Promise<unknown>, owner = controller) =>
    void pending.catch((error) => {
      if (alive && owner === controller)
        console.error(
          '[SiteHeader] Retained native navigation after surface projection failure.',
          error
        );
    });
  const onPreference = (event: Event) => {
    const next = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (!alive || !isRuntimeId(next)) return;
    runtime = next;
    if (controller.getSnapshot().generation === 0 && controller.getSnapshot().phase === 'idle') {
      const previous = controller;
      controller = create();
      const cleanup = previous.destroy();
      retired.add(cleanup);
      void cleanup.then(
        () => retired.delete(cleanup),
        (error) => {
          retired.delete(cleanup);
          console.error('[SiteHeader] Retired projection cleanup failed.', error);
        }
      );
      observe(controller.start());
    } else observe(controller.request({ runtimeId: runtime, projectionFamilyId: family }));
  };
  const observer = new MutationObserver(() => {
    if (!header.isConnected) void handle.destroy();
  });
  let destroyPromise: Promise<void> | undefined;
  const handle = {
    destroy() {
      return (destroyPromise ??= (async () => {
        alive = false;
        contents?.revoke();
        observer.disconnect();
        document.removeEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
        document.removeEventListener('astro:before-swap', onSwap);
        try {
          await controller.destroy();
          await Promise.allSettled([...retired]);
        } finally {
          if (documentationOwners.get(header) === handle) {
            documentationOwners.delete(header);
            contents?.dispose();
            const panel = header.querySelector('[data-site-header-panel]');
            for (const name of [
              'data-header-surface-runtime',
              'data-header-surface-family',
              'data-header-surface-generation',
            ])
              panel?.removeAttribute(name);
          }
        }
      })());
    },
  };
  const onSwap = () => {
    void handle.destroy();
  };
  documentationOwners.set(header, handle);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
  document.addEventListener('astro:before-swap', onSwap);
  observe(controller.start());
  return handle;
}
