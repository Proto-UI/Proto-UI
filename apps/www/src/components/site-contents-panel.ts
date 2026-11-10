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
import { headerIconButtonLayout } from './site-header-control-recipes';

const controls = {
  runtime: { label: 'Runtime', options: [], onValueChange() {} },
  family: { label: 'Family', options: [], onValueChange() {} },
  component: { label: 'Component', options: [], onValueChange() {} },
};
let serial = 0;

/** Website composition only: public Popover owns nonmodal behavior and family
 * paint. The application lends one existing native navigation subtree, never
 * regenerates links/details or installs a second focus/scroll state machine. */
export function contentsPanelParticipant(header: HTMLElement) {
  const document = header.ownerDocument;
  const command = header.querySelector<HTMLElement>('[data-site-contents-command]');
  const mount = command?.querySelector<HTMLElement>('[data-site-contents-mount]');
  const fallback = command?.querySelector<HTMLButtonElement>('[data-site-contents-fallback]');
  const tree = document.querySelector<HTMLElement>('nav.docs-sidebar');
  const navigation = siteContentsNavigation(document);
  if (!command || !mount || !fallback || !tree || !navigation || !tree.parentElement) return null;
  const view = document.defaultView!;
  const home = tree.parentElement;
  const nextSibling = tree.nextSibling;
  const owner = `site-contents-panel-${++serial}`;
  const title = tree.getAttribute('aria-label') || 'Documentation navigation';
  const label = command.dataset.contentsLabel || fallback.getAttribute('aria-label') || title;
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
  let commandOwner: SiteContentsPresentation | undefined;
  let focusEpoch = 0;
  const onFocus = () => {
    focusEpoch++;
  };
  document.addEventListener('focusin', onFocus, true);
  const rememberedFocus = new Map<number, { origin: Element; epoch: number }>();
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
    // Ordinary close has unwound the public FocusScope before this handback.
    // Fatal retirement instead waits for the renderer's terminal disposal.
    withNativeContentLease(tree, () => {
      home.insertBefore(tree, nextSibling?.parentNode === home ? nextSibling : null);
      tree.removeAttribute('data-site-contents-popover-tree');
    });
    restoreHomeScroll();
  };

  return {
    root: command,
    mount,
    revoke() {
      if (!alive) return;
      alive = false;
      rememberedFocus.clear();
      document.removeEventListener('focusin', onFocus, true);
      navigation.destroy();
    },
    async materialize(request: ProjectionScopeMaterializeRequest, namespace = 'docs') {
      const family = request.selection.projectionFamilyId;
      if (family !== 'shadcn' && family !== 'brutalist')
        throw new Error('Contents Popover family is unavailable');
      const lease: NativeTreeLease = { close: () => closePublicView() };
      const slotId = `${owner}-${namespace}-${request.generation}`;
      const style = family === 'shadcn' ? { styleProfile: 'rhea' } : {};
      const navigationStyle = family === 'shadcn' ? { styleProfile: 'new-york-v4' } : {};
      const origin = document.activeElement;
      rememberedFocus.clear();
      if (origin && command.contains(origin))
        rememberedFocus.set(request.generation, { origin, epoch: focusEpoch });
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
      let trigger: HTMLElement | undefined;
      let headerClearance: number | undefined;
      const syncHeaderClearance = () => {
        if (!trigger?.isConnected || !api) return;
        const headerBox = header.getBoundingClientRect();
        const triggerBox = trigger.getBoundingClientRect();
        if (headerBox.width <= 0 || triggerBox.width <= 0) return;
        const next = Math.max(4, headerBox.bottom - triggerBox.bottom + 4);
        if (next === headerClearance) return;
        headerClearance = next;
        // Website layout supplies clearance below its complete Header through
        // public Content props. Popover still computes every physical offset.
        api.setProps('contents-panel', { sideOffset: next });
      };
      const headerGeometry =
        typeof view.ResizeObserver === 'function'
          ? new view.ResizeObserver(syncHeaderClearance)
          : undefined;
      let live = true;
      let published = false;
      let requestedOpen = false;
      let openFact: ExposedStateHandle<boolean> | undefined;
      let presentFact: ExposedStateHandle<boolean> | undefined;
      let transitionFact: ExposedStateHandle<string> | undefined;
      let releaseFacts: (() => void) | undefined;
      let releaseInstances: (() => void) | undefined;
      let closeBarrier: Promise<void> | undefined;
      let releaseClose: (() => void) | undefined;
      let closeReturnReady = false;
      let finishQueued = false;
      let retirementQueued = false;
      let retirementFailure: Error | undefined;
      let rendererDisposal: Promise<void> | undefined;
      let retirement: Promise<void> | undefined;
      const disposeRenderer = () =>
        (rendererDisposal ??= (async () => {
          await candidate!.dispose();
        })());
      const retireNativeLease = (failure?: Error) => {
        retirementFailure ??= failure;
        if (retirementQueued) return;
        retirementQueued = true;
        live = false;
        requestedOpen = false;
        observer.disconnect();
        headerGeometry?.disconnect();
        // Missing public identity is not terminal completion. Join this
        // candidate's real renderer disposal before returning its native tree.
        retirement = disposeRenderer()
          .catch((error: unknown) => {
            retirementFailure ??= error instanceof Error ? error : new Error(String(error));
          })
          .then(() => {
            restoreTree(lease);
            if (activeLease === lease) activeLease = undefined;
            settleCloseBarrier();
            releasePresentation?.();
            releasePresentation = undefined;
            published = false;
            if (commandOwner === presentation) {
              commandOwner = undefined;
              fallback.hidden = false;
              fallback.inert = false;
              for (const name of names) mount.removeAttribute(name);
              for (const name of [
                'data-contents-runtime',
                'data-contents-family',
                'data-contents-generation',
              ])
                command.removeAttribute(name);
            }
            if (retirementFailure)
              console.error(
                '[Contents] Public Popover retired before close completion.',
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
        if (
          requestedOpen ||
          openFact?.get() !== false ||
          presentFact?.get() !== false ||
          transitionFact?.get() !== 'closed'
        )
          return;
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
        if (retirement) return retirement;
        if (activeLease !== lease && treeOwner !== lease) {
          api?.setProps('contents-popover', { open: false });
          restoreHomeScroll();
          return Promise.resolve();
        }
        if (!closeBarrier) {
          const { promise, resolve } = Promise.withResolvers<void>();
          closeBarrier = promise;
          releaseClose = resolve;
        }
        const closing = closeBarrier;
        // A framework prop commit may be asynchronous. Public open/presence,
        // not setProps returning or a guessed animation timeout, releases the tree.
        api?.setProps('contents-popover', { open: false });
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
        // WC's actual Popover role/ID lives inside a shadow surface, not on this
        // light-DOM ancestry. Native placement must not guess that boundary.
        if (tree.parentElement !== slot) {
          if (!treeOwner && !homeScroll)
            homeScroll = { root: tree.scrollTop, pane: pane?.scrollTop ?? 0 };
          withNativeContentLease(tree, () => {
            tree.setAttribute('data-site-contents-popover-tree', '');
            slot.append(tree);
          });
          treeOwner = lease;
        }
        navigation.refresh();
      };
      // This observes physical slot readiness only. Public Content owns
      // positioning, entry focus, nonmodal dismissal and presence.
      const observer = new view.MutationObserver(placeTree);
      const openPublicView = () => {
        if (!isCurrent() || !requestedOpen) return;
        if (activeLease && activeLease !== lease) {
          // Serialize only the retained native-tree lease. Each public Popover
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
        syncHeaderClearance();
        api?.setProps('contents-popover', { open: true });
        placeTree();
      };
      const presentation: SiteContentsPresentation = {
        available: () => alive && live && published,
        // The fallback controls the retained nav. The public Trigger keeps its
        // own Content relationship, expansion, command and anchor anatomy.
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
        componentId: 'popover',
        controls,
        controlIds: [],
        content: {
          recipe: {
            id: 'website-contents-popover',
            rootPrototypeId: `${family}-popover-root`,
            prototypeIds: [
              ...['root', 'trigger', 'content', 'title'].map((part) => `${family}-popover-${part}`),
              'lucide-list-icon',
            ],
          },
          demo: {
            type: 'demo',
            root: proto('popover-root', {
              ref: 'contents-popover',
              props: { ...style, open: false, a11yLabel: title },
              children: [
                proto('popover-trigger', {
                  ref: 'contents-trigger',
                  props: { presentation: 'navigation' },
                  surfaceStyle: headerIconButtonLayout(),
                  children: [
                    {
                      kind: 'box',
                      attrs: { 'aria-hidden': 'true' },
                      children: [
                        { kind: 'proto', prototypeId: 'lucide-list-icon', props: { size: 18 } },
                      ],
                    },
                    { kind: 'box', className: 'sr-only', children: [label] },
                  ],
                }),
                proto('popover-content', {
                  ref: 'contents-panel',
                  previewTheme: 'portal',
                  props: {
                    ...navigationStyle,
                    presentation: 'navigation',
                    side: 'bottom',
                    align: 'start',
                  },
                  children: [
                    proto('popover-title', { className: 'sr-only', children: [title] }),
                    {
                      kind: 'box',
                      attrs: { 'data-site-contents-slot': slotId },
                      className: 'min-w-0 min-h-0 p-4',
                    },
                  ],
                }),
              ],
            }),
            setup(context) {
              api = context.api;
              trigger = context.refs['contents-trigger'];
              if (!trigger) throw new Error('Contents Popover public Trigger is unavailable');
              trigger.dataset.siteContentsButton = '';
              trigger.dataset.siteControlFamily = family;
              trigger.title = label;
              headerGeometry?.observe(header);
              headerGeometry?.observe(trigger);
              syncHeaderClearance();
              const unbindTrigger = navigation.bindButton(
                trigger,
                () => isCurrent() && !candidate!.host.inert,
                () => {
                  api?.call('contents-trigger', 'focusSelf');
                },
                { publicRelationships: true }
              );
              api.setProps('contents-popover', {
                onOpenChange(detail: { open: boolean; reason?: string }) {
                  if (!isCurrent()) return;
                  if (detail.reason === 'trigger.press' && candidate!.host.inert) return;
                  navigation.setOpen(detail.open);
                },
              });
              if (!api.subscribePublicInstances)
                throw new Error('Contents Popover requires public instance subscriptions');
              releaseInstances = api.subscribePublicInstances(['contents-panel'], (snapshot) => {
                releaseFacts?.();
                releaseFacts = undefined;
                openFact = undefined;
                presentFact = undefined;
                transitionFact = undefined;
                const exposes = snapshot['contents-panel']?.getExposes();
                const open = exposes?.open as ExposedStateHandle<boolean> | undefined;
                const present = exposes?.isPresent as ExposedStateHandle<boolean> | undefined;
                const transition = exposes?.transitionState as
                  | ExposedStateHandle<string>
                  | undefined;
                if (
                  !open?.get ||
                  !open.subscribe ||
                  !present?.get ||
                  !present.subscribe ||
                  !transition?.get ||
                  !transition.subscribe
                ) {
                  if (activeLease === lease || treeOwner === lease)
                    retireNativeLease(
                      new Error(
                        'Contents Popover public instance disappeared while owning the navigation'
                      )
                    );
                  return;
                }
                openFact = open;
                presentFact = present;
                transitionFact = transition;
                const offOpen = open.subscribe(afterPublicUpdate);
                const offTransition = transition.subscribe(afterPublicUpdate);
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
                  offTransition();
                };
                afterPublicUpdate();
              });
              return () => {
                observer.disconnect();
                headerGeometry?.disconnect();
                unbindTrigger();
                releaseInstances?.();
                releaseFacts?.();
                // Ordinary disposal already completed the public close barrier.
                // Failed renderer teardown must still return the unique native
                // tree after unmount instead of leaving a pending close forever.
                if (activeLease === lease || treeOwner === lease)
                  retireNativeLease(
                    new Error('Contents Popover renderer ended before navigation handback')
                  );
                api = undefined;
              };
            },
          },
        },
      });
      if (!openFact || !presentFact || !transitionFact) {
        await candidate.dispose();
        throw new Error('Contents Popover public open/presence/transition facts are unavailable');
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
        setLocked(locked: boolean) {
          materialized.setLocked?.(locked);
          if (!locked) navigation.refresh();
        },
        async dispose() {
          live = false;
          await closePublicView();
          releasePresentation?.();
          releasePresentation = undefined;
          if (views.get(request.generation)?.presentation === presentation)
            views.delete(request.generation);
          await disposeRenderer();
          if (retirementFailure) throw retirementFailure;
        },
      };
    },
    prepareCommit(commit: ProjectionScopeCommit) {
      const candidate = views.get(commit.generation);
      if (!candidate) throw new Error('Contents Popover has no prepared view');
      const previous = names.map((name) => [name, mount.getAttribute(name)] as const);
      const commandNames = [
        'data-contents-runtime',
        'data-contents-family',
        'data-contents-generation',
      ];
      const previousCommand = commandNames.map(
        (name) => [name, command.getAttribute(name)] as const
      );
      const wasHidden = fallback.hidden;
      const wasInert = fallback.inert;
      const previousOwner = commandOwner;
      let published = false;
      let rollbackView: (() => void) | undefined;
      return {
        publish() {
          commandOwner = candidate.presentation;
          rollbackView = candidate.publish();
          fallback.hidden = true;
          fallback.inert = true;
          command.dataset.contentsRuntime = commit.selection.runtimeId;
          command.dataset.contentsFamily = commit.selection.projectionFamilyId;
          command.dataset.contentsGeneration = String(commit.generation);
          mount.dataset.contentsPanelRuntime = commit.selection.runtimeId;
          mount.dataset.contentsPanelFamily = commit.selection.projectionFamilyId;
          mount.dataset.contentsPanelGeneration = String(commit.generation);
          published = true;
          const target = rememberedFocus.get(commit.generation);
          rememberedFocus.delete(commit.generation);
          queueMicrotask(() => {
            if (!alive || !published) return;
            navigation.refresh();
            if (
              target &&
              target.epoch === focusEpoch &&
              (document.activeElement === target.origin || document.activeElement === document.body)
            )
              navigation.focus();
          });
        },
        rollback() {
          published = false;
          rememberedFocus.delete(commit.generation);
          rollbackView?.();
          rollbackView = undefined;
          if (commandOwner !== candidate.presentation) return;
          commandOwner = previousOwner?.available() ? previousOwner : undefined;
          fallback.hidden = wasHidden;
          fallback.inert = wasInert;
          for (const [name, value] of previousCommand) {
            if (value === null) command.removeAttribute(name);
            else command.setAttribute(name, value);
          }
          for (const [name, value] of previous) {
            if (value === null) mount.removeAttribute(name);
            else mount.setAttribute(name, value);
          }
        },
      };
    },
    dispose() {
      alive = false;
      commandOwner = undefined;
      rememberedFocus.clear();
      document.removeEventListener('focusin', onFocus, true);
      for (const { presentation } of views.values()) presentation.setOpen(false);
      views.clear();
      fallback.hidden = false;
      fallback.inert = false;
      for (const name of [
        'data-contents-runtime',
        'data-contents-family',
        'data-contents-generation',
      ])
        command.removeAttribute(name);
      for (const name of names) mount.removeAttribute(name);
    },
  };
}
