import {
  surfacePrototypeId,
  transitionPrototypeId,
  panelSurfaceProps,
  panelSurfaceLayout,
} from './surface-recipes';
import {
  bindSiteHeaderTransition,
  getSiteHeaderDisclosure,
  type SiteHeaderTransition,
  type SiteHeaderTransitionPhase,
} from './site-header-disclosure';
import { contentsCommandParticipant } from './site-contents-command';
import { contentsPanelParticipant } from './site-contents-panel';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import { isRuntimeId, type RuntimeId } from './PrototypePreviewer/runtimes/ids';
import type { DemoRuntimeApi } from './PrototypePreviewer/demo-types';
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
import { reserveDocsHeaderPreparation } from './docs-header-preparation';

type HeaderTransitionFact<Value> = {
  get(): Value;
  subscribe(
    listener: (event: { type: 'next'; next: Value } | { type: 'disconnect' }) => void
  ): () => void;
};

const HEADER_TRANSITION_TIMING = {
  shadcn: Object.freeze({ enterDuration: 180, leaveDuration: 140 }),
  brutalist: Object.freeze({ enterDuration: 130, leaveDuration: 100 }),
  'bootstrap-2-3-2': Object.freeze({ enterDuration: 150, leaveDuration: 150 }),
} as const;

const controls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};
let serial = 0;

/** The app retains one native navigation subtree. The passive Prototype owns
 * its actual slotted visual surface and asTransition phase clock; it never owns
 * disclosure or activation. */
export function headerSurfaceParticipant(header: HTMLElement) {
  const panel = header.querySelector<HTMLElement>('[data-site-header-panel]');
  const mount = panel?.querySelector<HTMLElement>('[data-site-header-surface-mount]');
  const content = panel?.querySelector<HTMLElement>('[data-site-header-panel-content]');
  if (!panel || !mount || !content) return null;
  const root = panel;
  const document = header.ownerDocument;
  const owner = `site-header-surface-${++serial}`;
  const views = new Map<number, { slot: HTMLElement; publish(): () => void }>();
  const names = [
    'data-header-surface-runtime',
    'data-header-surface-family',
    'data-header-surface-generation',
  ];
  const moveContent = (
    parent: HTMLElement,
    before: ChildNode | null = null,
    fallbackFocus: HTMLElement | null = null
  ) => {
    if (content.parentNode === parent && content.nextSibling === before) return;
    const focused = document.activeElement as HTMLElement | null;
    const targetFocus =
      focused && content.contains(focused)
        ? focused
        : fallbackFocus &&
            content.contains(fallbackFocus) &&
            (!focused || focused === document.body || focused === document.documentElement)
          ? fallbackFocus
          : null;
    // The same native subtree, link destinations and control state survive.
    const move = (
      parent as HTMLElement & { moveBefore?: (node: Node, before: Node | null) => void }
    ).moveBefore;
    if (typeof move === 'function' && content.isConnected && parent.isConnected)
      move.call(parent, content, before);
    else parent.insertBefore(content, before);
    if (
      targetFocus &&
      document.activeElement !== targetFocus &&
      targetFocus.isConnected &&
      !targetFocus.closest('[hidden], [inert]')
    )
      targetFocus.focus();
  };
  return {
    root,
    mount,
    async materialize(
      request: ProjectionScopeMaterializeRequest
    ): Promise<MaterializedProjectionCandidate> {
      const family = request.selection.projectionFamilyId;
      if (family !== 'shadcn' && family !== 'brutalist' && family !== 'bootstrap-2-3-2')
        throw new Error('Header surface family is unavailable');
      const timing = HEADER_TRANSITION_TIMING[family];
      const existingDisclosure = getSiteHeaderDisclosure(header);
      const disclosureEnhanced =
        !!existingDisclosure && header.hasAttribute('data-site-menu-ready');
      const initialOpen = existingDisclosure ? existingDisclosure.isOpen() : false;
      const initialSurfaceState: 'closed' | 'entered' =
        !disclosureEnhanced || initialOpen ? 'entered' : 'closed';
      const popupSurfaceStyle = (durationMs: number) => ({
        ...panelSurfaceLayout,
        padding: 'var(--site-header-popup-padding, 1rem)',
        display: 'flex',
        flexDirection: 'column',
        '--pui-surface-transition-duration': `${durationMs}ms`,
      });
      let ownedSlot: HTMLElement | undefined;
      let api: DemoRuntimeApi | undefined;
      let transitionFact: HeaderTransitionFact<SiteHeaderTransitionPhase> | undefined;
      let presentFact: HeaderTransitionFact<boolean> | undefined;
      let releaseInstances: (() => void) | undefined;
      let releaseFacts: (() => void) | undefined;
      let unbindTransition: (() => void) | undefined;
      let live = true;
      let published = false;
      let settleTarget: boolean | null = null;
      let lastSurfacePhase: 'closed' | 'entering' | 'entered' | 'leaving' = initialSurfaceState;
      let lastSurfaceDuration = timing.enterDuration;
      const listeners = new Set<() => void>();
      const syncSurface = (phase: SiteHeaderTransitionPhase) => {
        if (!live || !api || (!published && !getSiteHeaderDisclosure(header))) return;
        const duration = phase === 'leaving' ? timing.leaveDuration : timing.enterDuration;
        if (duration !== lastSurfaceDuration) {
          lastSurfaceDuration = duration;
          api.setSurfaceStyle?.('header-surface', popupSurfaceStyle(duration));
        }
        const surfacePhase: 'closed' | 'entering' | 'entered' | 'leaving' =
          phase === 'preparing' ? 'closed' : phase;
        if (surfacePhase === lastSurfacePhase) return;
        lastSurfacePhase = surfacePhase;
        api.setProps('header-surface', { transitionState: surfacePhase });
      };
      const notify = () => {
        if (!live || !transitionFact) return;
        const phase = transitionFact.get();
        if (settleTarget !== null) {
          if ((settleTarget && phase === 'entering') || (!settleTarget && phase === 'leaving')) {
            settleTarget = null;
            api?.call('header-transition', 'complete');
            return;
          }
          if ((settleTarget && phase === 'entered') || (!settleTarget && phase === 'closed'))
            settleTarget = null;
        }
        syncSurface(phase);
        for (const listener of [...listeners]) listener();
      };
      const transition: SiteHeaderTransition = {
        available: () => live && published && !!transitionFact && !!presentFact,
        phase: () => transitionFact?.get() ?? 'closed',
        isPresent: () => presentFact?.get() ?? false,
        timing,
        setOpen(open, immediate = false) {
          if (!live || !api || !transitionFact) return;
          const current = transitionFact.get();
          if (immediate) {
            if ((open && current === 'entered') || (!open && current === 'closed')) {
              settleTarget = null;
              syncSurface(current);
              return;
            }
            settleTarget = open;
            api.call('header-transition', open ? 'enter' : 'leave');
            const after = transitionFact.get();
            if ((open && after === 'entering') || (!open && after === 'leaving')) {
              settleTarget = null;
              api.call('header-transition', 'complete');
            }
            return;
          }
          settleTarget = null;
          api.call('header-transition', open ? 'enter' : 'leave');
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
      const candidate = await materializeProjectionCandidate(request, {
        mount,
        ownerId: owner,
        componentId: 'button',
        controls,
        controlIds: [],
        content: {
          recipe: {
            id: owner,
            prototypeIds: [surfacePrototypeId(family), transitionPrototypeId(family)],
            rootPrototypeId: surfacePrototypeId(family),
          },
          demo: {
            type: 'demo',
            root: {
              kind: 'box',
              className: 'site-header-surface-shell',
              children: [
                {
                  kind: 'box',
                  className: 'site-header-transition-host',
                  attrs: { 'aria-hidden': 'true', hidden: '' },
                  children: [
                    {
                      kind: 'proto',
                      prototypeId: transitionPrototypeId(family),
                      ref: 'header-transition',
                      props: {
                        defaultOpen: initialOpen,
                        appear: false,
                        enterDuration: timing.enterDuration,
                        leaveDuration: timing.leaveDuration,
                        interrupt: 'reverse',
                      },
                    },
                  ],
                },
                {
                  kind: 'proto',
                  prototypeId: surfacePrototypeId(family),
                  ref: 'header-surface',
                  className: 'site-header-popup-surface',
                  props: {
                    ...panelSurfaceProps('popup'),
                    fade: true,
                    transitionState: initialSurfaceState,
                  },
                  surfaceStyle: popupSurfaceStyle(timing.enterDuration),
                  children: [
                    {
                      kind: 'box',
                      ref: 'header-native-slot',
                      className: 'site-header-native-slot',
                    },
                  ],
                },
              ],
            },
            setup(context) {
              api = context.api;
              const slot = context.refs['header-native-slot'];
              if (!slot) throw new Error('Header surface native slot is missing');
              ownedSlot = slot;
              if (!api.subscribePublicInstances)
                throw new Error('Header surface transition requires public instance subscriptions');
              let viewRetained = false;
              releaseInstances = api.subscribePublicInstances(['header-transition'], (snapshot) => {
                releaseFacts?.();
                releaseFacts = undefined;
                transitionFact = undefined;
                presentFact = undefined;
                const exposes = snapshot['header-transition']?.getExposes();
                const phase = exposes?.transitionState as
                  | HeaderTransitionFact<SiteHeaderTransitionPhase>
                  | undefined;
                const present = exposes?.isPresent as HeaderTransitionFact<boolean> | undefined;
                if (!phase?.get || !phase.subscribe || !present?.get || !present.subscribe) return;
                transitionFact = phase;
                presentFact = present;
                const offPhase = phase.subscribe(() => notify());
                const offPresent = present.subscribe(() => notify());
                releaseFacts = () => {
                  offPhase();
                  offPresent();
                };
                if (!viewRetained) {
                  viewRetained = true;
                  api?.call('header-transition', 'retainClosedView', true);
                }
                if (published) notify();
              });
              const view = {
                slot,
                publish() {
                  published = true;
                  unbindTransition = bindSiteHeaderTransition(header, transition);
                  return () => {
                    published = false;
                    unbindTransition?.();
                    unbindTransition = undefined;
                  };
                },
              };
              views.set(request.generation, view);
              return () => {
                releaseInstances?.();
                releaseInstances = undefined;
                releaseFacts?.();
                releaseFacts = undefined;
                transitionFact = undefined;
                presentFact = undefined;
                api = undefined;
                if (views.get(request.generation) === view) views.delete(request.generation);
              };
            },
          },
        },
      });
      if (!transitionFact || !presentFact) {
        await candidate.dispose();
        throw new Error('Header surface asTransition exposes are unavailable');
      }
      const dispose = candidate.dispose.bind(candidate);
      return {
        ...candidate,
        // Passive surface owns no interactive controls; do not mark the slotted
        // native navigation/preferences subtree inert while the next generation prepares.
        setLocked() {},
        async dispose() {
          live = false;
          published = false;
          unbindTransition?.();
          unbindTransition = undefined;
          listeners.clear();
          const slot = ownedSlot;
          // Detach app content before its retired renderer tears down. A stale
          // generation never moves content already owned by its successor.
          if (slot?.contains(content)) moveContent(root, mount);
          await dispose();
        },
      };
    },
    prepareCommit(commit: ProjectionScopeCommit) {
      const view = views.get(commit.generation);
      if (!view) throw new Error('Header surface has no prepared native slot');
      const { slot } = view;
      const previousParent = content.parentElement!;
      const previousNext = content.nextSibling;
      const previous = names.map((name) => [name, root.getAttribute(name)] as const);
      const active = document.activeElement as HTMLElement | null;
      const capturedFocus = active && content.contains(active) ? active : null;
      let releaseTransition: (() => void) | undefined;
      return {
        publish() {
          moveContent(slot, null, capturedFocus);
          root.dataset.headerSurfaceRuntime = commit.selection.runtimeId;
          root.dataset.headerSurfaceFamily = commit.selection.projectionFamilyId;
          root.dataset.headerSurfaceGeneration = String(commit.generation);
          releaseTransition = view.publish();
        },
        rollback() {
          releaseTransition?.();
          releaseTransition = undefined;
          if (slot.contains(content)) moveContent(previousParent, previousNext, capturedFocus);
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
  const contentsPanel = contentsPanelParticipant(header);
  const contents = contentsPanel ? null : contentsCommandParticipant(header);
  type PreferencePreparation = {
    event: Event;
    runtime: RuntimeId;
    started: boolean;
    release(): void;
    scheduled?: boolean;
  };
  let preferencePreparation: PreferencePreparation | undefined;
  const releasePreparation = (preparation: PreferencePreparation) => {
    if (preferencePreparation === preparation) preferencePreparation = undefined;
    preparation.release();
  };
  const releasePreparationAfterTask = (preparation: PreferencePreparation | undefined) => {
    if (!preparation || preparation.scheduled) return;
    preparation.scheduled = true;
    if (document.defaultView)
      document.defaultView.setTimeout(() => releasePreparation(preparation), 0);
    else releasePreparation(preparation);
  };
  let attempt = 0;
  const create = () => {
    const participant = headerSurfaceParticipant(header)!;
    const namespace = `docs-${++attempt}`;
    const preparations = new Map<number, PreferencePreparation>();
    return createProjectionScopeController({
      initialSelection: { runtimeId: runtime, projectionFamilyId: family },
      async materialize(request) {
        const preparation =
          preferencePreparation?.started &&
          preferencePreparation.runtime === request.selection.runtimeId
            ? preferencePreparation
            : undefined;
        const outcomes = await Promise.allSettled([
          participant.materialize(request),
          ...(contents ? [contents.materialize(request, namespace)] : []),
          ...(contentsPanel ? [contentsPanel.materialize(request, namespace)] : []),
        ]);
        const candidates = outcomes.flatMap((outcome) =>
          outcome.status === 'fulfilled' ? [outcome.value] : []
        );
        const failure = outcomes.find((outcome) => outcome.status === 'rejected');
        if (failure?.status === 'rejected') {
          await Promise.allSettled(candidates.map((candidate) => candidate.dispose()));
          throw failure.reason;
        }
        const panelOutcome = contentsPanel ? outcomes.at(-1) : undefined;
        const panelCandidate =
          panelOutcome?.status === 'fulfilled' ? panelOutcome.value : undefined;
        let stop: () => void;
        try {
          stop = watchProjectionThemeSurfaceStyle(family, header, (theme) =>
            candidates.forEach((candidate) => candidate.setThemeSurfaceStyle(theme))
          );
        } catch (error) {
          await Promise.allSettled(candidates.map((candidate) => candidate.dispose()));
          throw error;
        }
        if (preparation) preparations.set(request.generation, preparation);
        return {
          activate() {
            candidates.forEach((candidate) => candidate.activate());
          },
          setLocked(locked: boolean) {
            candidates.forEach((candidate) => candidate.setLocked?.(locked));
          },
          async dispose() {
            preparations.delete(request.generation);
            stop();
            // Keep the actual public Trigger alive until Popover close and
            // native-tree handback finish; framework teardown must not win that race.
            const panelResults = await Promise.allSettled(
              panelCandidate ? [panelCandidate.dispose()] : []
            );
            const results = [
              ...panelResults,
              ...(await Promise.allSettled(
                candidates
                  .filter((candidate) => candidate !== panelCandidate)
                  .map((candidate) => candidate.dispose())
              )),
            ];
            const failure = results.find((result) => result.status === 'rejected');
            if (failure?.status === 'rejected') throw failure.reason;
          },
        };
      },
      prepareCommit(commit) {
        const preparation = preparations.get(commit.generation);
        preparations.delete(commit.generation);
        const publications = [participant.prepareCommit(commit)];
        try {
          if (contents) publications.push(contents.prepareCommit(commit));
          if (contentsPanel) publications.push(contentsPanel.prepareCommit(commit));
        } catch (error) {
          for (const publication of publications.reverse()) publication.rollback();
          throw error;
        }
        return {
          publish() {
            publications.forEach((publication) => publication.publish());
            releasePreparationAfterTask(preparation);
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
  const reservePreference = (event: Event) => {
    const next = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (
      !alive ||
      !header.isConnected ||
      document.querySelector('[data-docs-site-header]') !== header ||
      !isRuntimeId(next)
    )
      return;
    const snapshot = controller.getSnapshot();
    if (snapshot.phase === 'ready' && snapshot.selection.runtimeId === next) return;
    const preparation: PreferencePreparation = {
      event,
      runtime: next,
      started: false,
      release: reserveDocsHeaderPreparation(document),
    };
    if (preferencePreparation) releasePreparation(preferencePreparation);
    preferencePreparation = preparation;
    // Another listener may stop the dispatch before our normal handler.
    queueMicrotask(() => {
      if (!preparation.started) releasePreparation(preparation);
    });
  };
  const onPreference = (event: Event) => {
    const next = (event as CustomEvent<{ adapter?: unknown }>).detail?.adapter;
    if (!alive || !isRuntimeId(next)) return;
    const preparation = preferencePreparation?.event === event ? preferencePreparation : undefined;
    if (preparation) preparation.started = true;
    runtime = next;
    let pending: Promise<unknown>;
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
      pending = controller.start();
    } else pending = controller.request({ runtimeId: runtime, projectionFamilyId: family });
    if (preparation)
      void pending.then(
        () => releasePreparationAfterTask(preparation),
        () => releasePreparationAfterTask(preparation)
      );
    observe(pending);
  };
  const observer = new MutationObserver(() => {
    if (!header.isConnected) void handle.destroy();
  });
  let destroyPromise: Promise<void> | undefined;
  const handle = {
    destroy() {
      return (destroyPromise ??= (async () => {
        alive = false;
        contentsPanel?.revoke();
        contents?.revoke();
        observer.disconnect();
        document.removeEventListener(PREFERRED_ADAPTER_EVENT, reservePreference, true);
        document.removeEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
        document.removeEventListener('astro:before-swap', onSwap);
        if (preferencePreparation) releasePreparation(preferencePreparation);
        try {
          await controller.destroy();
          await Promise.allSettled([...retired]);
        } finally {
          if (documentationOwners.get(header) === handle) {
            documentationOwners.delete(header);
            contentsPanel?.dispose();
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
  document.addEventListener(PREFERRED_ADAPTER_EVENT, reservePreference, true);
  document.addEventListener(PREFERRED_ADAPTER_EVENT, onPreference);
  document.addEventListener('astro:before-swap', onSwap);
  observe(controller.start());
  return handle;
}
