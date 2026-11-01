import type { ExposedStateHandle } from '@proto.ui/core';
import {
  materializeProjectionCandidate,
  type MaterializedProjectionCandidate,
} from './PrototypePreviewer/projection-materializer';
import type { DemoNode, DemoRuntimeApi } from './PrototypePreviewer/demo-types';
import type {
  ProjectionScopeCommit,
  ProjectionScopeMaterializeRequest,
} from './PrototypePreviewer/projection-scope';
import { withNativeContentLease } from './PrototypePreviewer/native-content-lease';
import { siteContentsNavigation, type SiteContentsPresentation } from './site-header-disclosure';

const controls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};
let serial = 0;

/** Website composition only: public Dialog owns modal behavior and family
 * paint. The application lends one existing native navigation subtree, never
 * regenerates links/details or installs a second focus/scroll state machine. */
export function contentsPanelParticipant(header: HTMLElement) {
  const document = header.ownerDocument;
  const mount = document.querySelector<HTMLElement>('[data-site-contents-panel-mount]');
  const tree = document.querySelector<HTMLElement>('nav.docs-sidebar');
  const navigation = siteContentsNavigation(document);
  if (!mount || !tree || !navigation || !tree.parentElement) return null;
  const view = document.defaultView!;
  const home = tree.parentElement;
  const nextSibling = tree.nextSibling;
  const owner = `site-contents-panel-${++serial}`;
  const title = mount.dataset.contentsTitle || 'Documentation navigation';
  const closeLabel = mount.dataset.contentsClose || 'Close navigation';
  const names = [
    'data-contents-panel-runtime',
    'data-contents-panel-family',
    'data-contents-panel-generation',
  ];
  const views = new Map<
    number,
    { presentation: SiteContentsPresentation; publish(): () => void }
  >();
  let alive = true;
  type NativeTreeLease = { close(): Promise<void> };
  let treeOwner: NativeTreeLease | undefined;
  let activeLease: NativeTreeLease | undefined;
  let homeScroll: { root: number; pane: number } | undefined;
  const pane = tree.querySelector<HTMLElement>('#starlight__sidebar');
  const restoreHomeScroll = () => {
    if (
      homeScroll &&
      tree.parentElement === home &&
      view.matchMedia('(min-width: 64rem)').matches
    ) {
      tree.scrollTop = homeScroll.root;
      if (pane) pane.scrollTop = homeScroll.pane;
      homeScroll = undefined;
    }
  };

  const restoreTree = (lease: NativeTreeLease) => {
    if (treeOwner !== lease) return;
    treeOwner = undefined;
    // Invoked only after the public Dialog has closed. Its focus owner has
    // already returned focus; the shared move lease preserves native Selection.
    withNativeContentLease(tree, () => {
      home.insertBefore(tree, nextSibling?.parentNode === home ? nextSibling : null);
      tree.removeAttribute('data-site-contents-dialog-tree');
    });
    restoreHomeScroll();
  };

  return {
    root: mount,
    mount,
    async materialize(request: ProjectionScopeMaterializeRequest, namespace = 'docs') {
      const family = request.selection.projectionFamilyId;
      if (family !== 'shadcn' && family !== 'brutalist')
        throw new Error('Contents Dialog family is unavailable');
      const lease: NativeTreeLease = { close: () => closePublicView() };
      const slotId = `${owner}-${namespace}-${request.generation}`;
      const style = family === 'shadcn' ? { styleProfile: 'rhea' } : {};
      const proto = (
        name: string,
        extra: Partial<Extract<DemoNode, { kind: 'proto' }>> = {}
      ): DemoNode => ({
        kind: 'proto',
        prototypeId: `${family}-${name}`,
        ...extra,
      });
      let candidate: MaterializedProjectionCandidate | undefined;
      let api: DemoRuntimeApi | undefined;
      let live = true;
      let published = false;
      let requestedOpen = false;
      let openFact: ExposedStateHandle<boolean> | undefined;
      let presentFact: ExposedStateHandle<boolean> | undefined;
      let releaseFacts: (() => void) | undefined;
      let releaseInstances: (() => void) | undefined;
      let closeBarrier: Promise<void> | undefined;
      let releaseClose: (() => void) | undefined;
      let closeReturnReady = false;
      let finishQueued = false;
      let retirementQueued = false;
      let retirementFailure: Error | undefined;
      const retireNativeLease = (failure?: Error) => {
        retirementFailure ??= failure;
        if (retirementQueued) return;
        retirementQueued = true;
        live = false;
        requestedOpen = false;
        observer.disconnect();
        // Built-in renderer retirement publishes undefined before invoking
        // setup cleanup and unmount, all in one teardown stack. Reclaim only
        // after that stack, never while the old public modal can still own focus.
        queueMicrotask(() => {
          restoreTree(lease);
          if (activeLease === lease) activeLease = undefined;
          settleCloseBarrier();
          releasePresentation?.();
          releasePresentation = undefined;
          published = false;
          if (retirementFailure)
            console.error(
              '[Contents] Public Dialog retired before close completion.',
              retirementFailure
            );
        });
      };
      const settleCloseBarrier = () => {
        const release = releaseClose;
        releaseClose = undefined;
        closeBarrier = undefined;
        release?.();
      };
      const finishClosed = () => {
        if (requestedOpen || openFact?.get() !== false || presentFact?.get() !== false) return;
        restoreTree(lease);
        if (activeLease === lease) activeLease = undefined;
        restoreHomeScroll();
        settleCloseBarrier();
      };
      const afterPublicUpdate = () => {
        if (finishQueued) return;
        finishQueued = true;
        queueMicrotask(() => {
          finishQueued = false;
          // Content publishes open before it deactivates its FocusScope. Never
          // reparent from that state callback while the public close is on stack.
          closeReturnReady = openFact?.get() === false;
          finishClosed();
        });
      };
      const closePublicView = (): Promise<void> => {
        requestedOpen = false;
        observer.disconnect();
        observing = false;
        if (activeLease !== lease && treeOwner !== lease) {
          api?.setProps('contents-dialog', { open: false });
          restoreHomeScroll();
          return Promise.resolve();
        }
        closeBarrier ??= new Promise<void>((resolve) => {
          releaseClose = resolve;
        });
        const closing = closeBarrier;
        // A framework prop commit may be asynchronous. Public open/presence,
        // not setProps returning or a guessed animation timeout, releases the tree.
        api?.setProps('contents-dialog', { open: false });
        afterPublicUpdate();
        return closing;
      };
      let releasePresentation: (() => void) | undefined;
      let observing = false;
      const isCurrent = () =>
        alive &&
        live &&
        published &&
        !!candidate &&
        candidate.host.dataset.projectionGenerationState === 'active';
      const placeTree = () => {
        if (!isCurrent() || !requestedOpen) return;
        const slot = document.querySelector<HTMLElement>(`[data-site-contents-slot="${slotId}"]`);
        if (!slot?.isConnected) return;
        // The authored box is a website-owned native slot in all four hosts.
        // WC's actual Dialog role/ID lives inside a shadow surface, not on this
        // light-DOM ancestry. Native placement must not guess that boundary.
        if (tree.parentElement !== slot) {
          if (!treeOwner && !homeScroll)
            homeScroll = { root: tree.scrollTop, pane: pane?.scrollTop ?? 0 };
          withNativeContentLease(tree, () => {
            tree.setAttribute('data-site-contents-dialog-tree', '');
            slot.append(tree);
          });
          treeOwner = lease;
        }
        navigation.refresh();
      };
      // This observes physical slot readiness only. Dialog owns presence,
      // focus, keyboard dismissal, modal hit blocking and scroll locking.
      const observer = new view.MutationObserver(placeTree);
      const openPublicView = () => {
        if (!isCurrent() || !requestedOpen) return;
        if (activeLease && activeLease !== lease) {
          // Serialize only the retained native-tree lease. Each public Dialog
          // remains the sole owner of its own presence, focus and scroll effects.
          void activeLease.close().then(() => openPublicView());
          return;
        }
        activeLease = lease;
        closeReturnReady = false;
        settleCloseBarrier(); // A same-view reopen interrupts an ordinary close.
        if (!observing) {
          observer.observe(document.body, { childList: true, subtree: true });
          observing = true;
        }
        api?.setProps('contents-dialog', { open: true });
        placeTree();
      };
      const presentation: SiteContentsPresentation = {
        available: () => alive && live && published,
        // This command controls the one stable navigation, not an adapter's
        // private host/surface ID. The Dialog owns its own role/name relations.
        controlsId: () => pane?.id || null,
        setOpen(open) {
          requestedOpen = open && isCurrent();
          if (requestedOpen) openPublicView();
          else void closePublicView();
        },
      };
      candidate = await materializeProjectionCandidate(request, {
        mount,
        ownerId: `${owner}-${namespace}`,
        componentId: 'dialog',
        controls,
        controlIds: [],
        content: {
          recipe: {
            id: 'website-contents-dialog',
            rootPrototypeId: `${family}-dialog-root`,
            prototypeIds: ['root', 'mask', 'content', 'title', 'close'].map(
              (part) => `${family}-dialog-${part}`
            ),
          },
          demo: {
            type: 'demo',
            root: proto('dialog-root', {
              ref: 'contents-dialog',
              props: { ...style, open: false, a11yLabel: title },
              children: [
                proto('dialog-mask', { ref: 'contents-mask', previewTheme: 'portal' }),
                proto('dialog-content', {
                  ref: 'contents-panel',
                  previewTheme: 'portal',
                  children: [
                    proto('dialog-title', { children: [title] }),
                    {
                      kind: 'box',
                      attrs: { 'data-site-contents-slot': slotId },
                      className: 'min-w-0 min-h-0',
                    },
                    proto('dialog-close', {
                      surfaceStyle: {
                        minHeight: '2.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingInline: '0.75rem',
                      },
                      children: [closeLabel],
                    }),
                  ],
                }),
              ],
            }),
            setup(context) {
              api = context.api;
              api.setProps('contents-dialog', {
                onOpenChange(detail: { open: boolean }) {
                  if (isCurrent() && !detail.open) navigation.close();
                },
              });
              if (!api.subscribePublicInstances)
                throw new Error('Contents Dialog requires public instance subscriptions');
              releaseInstances = api.subscribePublicInstances(['contents-panel'], (snapshot) => {
                releaseFacts?.();
                releaseFacts = undefined;
                openFact = undefined;
                presentFact = undefined;
                const exposes = snapshot['contents-panel']?.getExposes();
                const open = exposes?.open as ExposedStateHandle<boolean> | undefined;
                const present = exposes?.isPresent as ExposedStateHandle<boolean> | undefined;
                if (!open?.get || !open.subscribe || !present?.get || !present.subscribe) {
                  if (activeLease === lease || treeOwner === lease)
                    retireNativeLease(
                      new Error(
                        'Contents Dialog public instance disappeared while owning the navigation'
                      )
                    );
                  return;
                }
                openFact = open;
                presentFact = present;
                const offOpen = open.subscribe(afterPublicUpdate);
                const offPresent = present.subscribe((event) => {
                  // Family public boundary exposes isPresent, not Base's private
                  // afterLeave/transition controls. False is projected before
                  // renderer detach; return the borrowed tree within that signal
                  // only when public open's callback has already unwound.
                  if (event.type === 'next' && !event.next && closeReturnReady) finishClosed();
                  else afterPublicUpdate();
                });
                releaseFacts = () => {
                  offOpen();
                  offPresent();
                };
                afterPublicUpdate();
              });
              return () => {
                observer.disconnect();
                releaseInstances?.();
                releaseFacts?.();
                // Ordinary disposal already completed the public close barrier.
                // Failed renderer teardown must still return the unique native
                // tree after unmount instead of leaving a pending close forever.
                if (activeLease === lease || treeOwner === lease)
                  retireNativeLease(
                    new Error('Contents Dialog renderer ended before navigation handback')
                  );
                api = undefined;
              };
            },
          },
        },
      });
      if (!openFact || !presentFact) {
        await candidate.dispose();
        throw new Error('Contents Dialog public open/presence facts are unavailable');
      }
      views.set(request.generation, {
        presentation,
        publish() {
          published = true;
          releasePresentation = navigation.bindPresentation(presentation);
          return () => {
            published = false;
            releasePresentation?.();
            releasePresentation = undefined;
          };
        },
      });
      const materialized = candidate;
      return {
        ...materialized,
        async dispose() {
          live = false;
          await closePublicView();
          releasePresentation?.();
          releasePresentation = undefined;
          if (views.get(request.generation)?.presentation === presentation)
            views.delete(request.generation);
          await materialized.dispose();
          if (retirementFailure) throw retirementFailure;
        },
      };
    },
    prepareCommit(commit: ProjectionScopeCommit) {
      const candidate = views.get(commit.generation);
      if (!candidate) throw new Error('Contents Dialog has no prepared view');
      const previous = names.map((name) => [name, mount.getAttribute(name)] as const);
      let rollbackView: (() => void) | undefined;
      return {
        publish() {
          rollbackView = candidate.publish();
          mount.dataset.contentsPanelRuntime = commit.selection.runtimeId;
          mount.dataset.contentsPanelFamily = commit.selection.projectionFamilyId;
          mount.dataset.contentsPanelGeneration = String(commit.generation);
        },
        rollback() {
          rollbackView?.();
          rollbackView = undefined;
          for (const [name, value] of previous) {
            if (value === null) mount.removeAttribute(name);
            else mount.setAttribute(name, value);
          }
        },
      };
    },
    dispose() {
      if (!alive) return;
      alive = false;
      for (const { presentation } of views.values()) presentation.setOpen(false);
      views.clear();
      for (const name of names) mount.removeAttribute(name);
    },
  };
}
