import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import type {
  DemoSpec,
  DemoNode,
  DemoKeyedChild,
  DemoPublicInstance,
} from './PrototypePreviewer/demo-types';
import type { SiteSearchSession } from './site-search-session';

export interface SiteSearchCopy {
  title: string;
  description: string;
  placeholder: string;
  hint: string;
  loading: string;
  empty: string;
  error: string;
  retry: string;
  more: string;
  close: string;
  pages?: string;
  results?: string;
  goToPage?: string;
  count(count: number): string;
}

/** Public, reusable Dialog + Command composition. No DOM keyboard/dialog implementation. */
export interface SiteSearchFocusRestore {
  /**
   * The Dialog content's public ref that owned focus before the generation
   * swap.  The equivalent control in the new generation carries the same ref.
   */
  ref: string;
  /** The element that held focus when the swap began. */
  origin: Element | null;
  /**
   * Focus epoch captured when the swap began.  The scope advances it on every
   * focus change, so focus that moved after the swap began wins over the
   * restore even when it later fell back to the document.
   */
  epoch: number;
}

type PrepareOpenerReturn = (panel: HTMLElement | undefined) => (() => void) | undefined;

export function createSiteSearchComposition(options: {
  family: 'shadcn' | 'brutalist' | 'bootstrap-2-3-2';
  shadcnStyle: 'rhea' | 'new-york-v4';
  session: SiteSearchSession;
  copy: SiteSearchCopy;
  isCurrent(): boolean;
  onFailure(error: unknown): void;
  /**
   * Pending bounded focus restore for the generation being opened.  The scope
   * replaces it on every swap, so a superseded swap can never restore into a
   * later generation.
   */
  takeFocusRestore(): SiteSearchFocusRestore | null;
  /** The scope's current focus epoch, used to detect newer focus intent. */
  focusEpoch(): number;
}): { demo: DemoSpec; activate(prepareOpenerReturn?: PrepareOpenerReturn): void } {
  const { family, shadcnStyle, session, copy } = options;
  const initial = session.read();
  const style = family === 'shadcn' ? { styleProfile: shadcnStyle, presentation: 'menu' } : {};
  const shellStyle = family === 'shadcn' ? { styleProfile: shadcnStyle } : {};
  const duration = family === 'shadcn' && shadcnStyle === 'rhea' ? 100 : 200;
  const proto = (
    name: string,
    extra: Partial<Extract<DemoNode, { kind: 'proto' }>> = {}
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${name}`,
    ...extra,
  });
  const input = proto('command-input', {
    ref: 'query',
    props: { ...style, placeholder: copy.placeholder, a11yLabel: copy.title },
  });
  const editor =
    family === 'shadcn'
      ? proto('command-input-wrapper', {
          props: style,
          children: [
            {
              kind: 'box',
              tag: 'span',
              ref: 'query-decoration',
              attrs: { 'aria-hidden': 'true' },
              className: 'shrink-0 text-muted-foreground pointer-events-none',
              children: [{ kind: 'proto', prototypeId: 'lucide-search-icon', props: { size: 16 } }],
            },
            proto('input-shell', { ref: 'query-shell', props: shellStyle, children: [input] }),
          ],
        })
      : input;
  const statusAndActions: DemoNode = {
    kind: 'box',
    tag: 'div',
    className: 'flex shrink-0 min-w-0 flex-wrap items-center gap-2 p-2',
    children: [
      {
        kind: 'box',
        tag: 'div',
        ref: 'status',
        className: 'min-w-0 grow',
        attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
        children: [copy.hint],
      },
      {
        kind: 'box',
        tag: 'div',
        ref: 'actions',
        dynamicChildren: {
          prototypeIds: [`${family}-button`],
        },
        children: [],
      },
    ],
  };
  const footer: DemoNode = {
    kind: 'box',
    ref: 'dismissal',
    tag: 'div',
    className:
      family === 'shadcn'
        ? 'flex min-h-11 shrink-0 min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/50 px-4 text-xs text-muted-foreground'
        : 'flex shrink-0 min-w-0 items-center justify-end p-2',
    children: [
      {
        kind: 'box',
        tag: 'div',
        ref: 'keyboard-hint',
        className: 'flex min-w-0 items-center gap-2',
        dynamicChildren: { prototypeIds: [] },
        children: [],
      },
      proto('dialog-close', {
        ref: 'close',
        surfaceStyle: {
          minHeight: '2.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingInline: '0.75rem',
        },
        children: [copy.close],
      }),
    ],
  };
  let activateView: ((prepareOpenerReturn?: PrepareOpenerReturn) => void) | undefined;
  const demo: DemoSpec = {
    type: 'demo',
    root: proto('dialog-root', {
      ref: 'dialog',
      props: { open: false, a11yLabel: copy.title },
      children: [
        // Search's transparent Shadcn mask retains Base modal semantics. It is
        // a public Command part, not an override of ordinary Dialog paint.
        proto(family === 'shadcn' ? 'command-dialog-mask' : 'dialog-mask', {
          ref: 'mask',
          previewTheme: 'portal',
          props: { enterDuration: duration, leaveDuration: duration },
        }),
        proto(family === 'bootstrap-2-3-2' ? 'dialog-content' : 'command-dialog-content', {
          ref: 'panel',
          // One bounded inner Command shell; title/description are out of flow.
          surfaceStyle: { gridTemplateRows: 'minmax(0, 1fr)' },
          previewTheme: 'portal',
          props: { ...style, enterDuration: duration, leaveDuration: duration },
          children: [
            proto('dialog-title', { className: 'sr-only', children: [copy.title] }),
            proto('dialog-description', { className: 'sr-only', children: [copy.description] }),
            proto('command-root', {
              ref: 'command',
              props: {
                ...style,
                filter: false,
                defaultInputValue: initial.snapshot.query,
                a11yLabel: copy.title,
              },
              children: [
                {
                  kind: 'box',
                  tag: 'div',
                  className: family === 'shadcn' ? 'shrink-0 p-2' : '',
                  children: [editor],
                },
                {
                  kind: 'box',
                  tag: 'div',
                  ref: 'scroll-body',
                  // Error/loading text and actions may wrap at enlarged text sizes.
                  // This middle region contains status/actions overflow; the family list
                  // retains its own scrolling limit. Dismissal remains outside both.
                  className:
                    family === 'shadcn'
                      ? 'min-h-0 min-w-0 flex-1 basis-80 overflow-y-auto px-2 pb-2'
                      : 'min-h-0 min-w-0 flex-1 overflow-y-auto',
                  // Preferred menu list height yields to the bounded Dialog on
                  // short/enlarged viewports; it is not a mandatory clipping min.
                  children: [
                    proto('command-content', {
                      props: style,
                      ref: 'list',
                      children: [
                        {
                          kind: 'box',
                          tag: 'div',
                          ref: 'results',
                          attrs: { role: 'group', 'aria-label': copy.pages ?? copy.title },
                          dynamicChildren: {
                            prototypeIds: [
                              `${family}-command-item`,
                              `${family}-command-empty`,
                              'lucide-arrow-right-icon',
                            ],
                          },
                          children: [],
                        },
                      ],
                    }),
                    statusAndActions,
                  ],
                },
                footer,
              ],
            }),
          ],
        }),
      ],
    }),
    setup({ api, refs }) {
      if (!api.setChildren) throw new Error('Search requires declared public dynamic children');
      let live = true;
      let paintEpoch = 0;
      let seedingQuery = false;
      let seededCommand: DemoPublicInstance | undefined;
      let focusedFailureAction: DemoPublicInstance | undefined;
      // A generation swap replaces the focused control with an equivalent one in
      // the new generation.  The Dialog content's own automatic entry focus
      // must not win that race, so this generation's content runs with
      // focusEntry 'manual' and the requested control is focused afterwards.
      //
      // The content reads focusEntry at each activation, and the content may
      // still be detached when the open transition is published (its own
      // activation then runs on mount).  The policy is therefore held for the
      // whole open period of this generation and handed back when the Dialog
      // closes, so every later open of this generation is a normal fresh open
      // that auto-enters the query again.
      let pendingFocusRestore: SiteSearchFocusRestore | null = null;
      let focusRestoreArmed = false;
      let entryPolicyManual = false;
      let prepareOpenerReturn: PrepareOpenerReturn | undefined;
      let cancelOpenerReturn: (() => void) | undefined;
      let offPanelTransition: (() => void) | null = null;
      let panelTransitionOwner: unknown = null;
      type HintRequest = { target: HTMLElement; visible: boolean };
      let committedHint: HintRequest | undefined;
      let pendingHint: HintRequest | undefined;
      let binding: ReturnType<typeof bindInputShellControl> | undefined;
      const current = () => live && options.isCurrent();
      /**
       * Focus the control the user held across a generation swap.
       *
       * The request stays pending until this generation actually owns a
       * focusable target, so a target that publishes after the open transition
       * is not lost.  It is cancelled when the focus the user held is no longer
       * the current focus (user intent wins) or when the Dialog closes.
       */
      /**
       * Hand the entry policy back to 'auto'.
       *
       * The policy is held for the whole open period this generation was
       * swapped into, and is released only when the Dialog actually closes.
       * Releasing it earlier — on a cancelled or completed restore — could
       * happen before this content's own scope activation, and that later
       * activation would then auto-enter and take the focus the user holds.
       */
      const releaseEntryPolicy = () => {
        if (!entryPolicyManual) return;
        entryPolicyManual = false;
        api.setProps('panel', { focusEntry: 'auto' });
      };
      /**
       * The Dialog content's own presentation signal.  It reports that the
       * content has presented its view.  It is a presentation fact, not a
       * mount, layout or focusability guarantee; it only narrows when the
       * public focus call is attempted, so the call is not made before the
       * content is up.  Whether the focus actually landed is proven by the
       * control's own focus state.
       */
      const panelPresented = () => {
        const exposes = api.getPublicInstance?.('panel')?.getExposes();
        const isPresent = exposes?.isPresent as { get(): boolean } | undefined;
        if (isPresent?.get() === true) return true;
        const transitionState = exposes?.transitionState as { get(): string } | undefined;
        return transitionState?.get() === 'entered';
      };
      /**
       * The control's own public focus fact.  The public instance lookup
       * proves the control's identity; its exposed focus state is what proves
       * that the focus actually landed on it.
       */
      const targetHoldsFocus = (ref: string) => {
        const focused = api.getExposes(ref)?.focused as { get(): boolean } | undefined;
        return focused?.get() === true;
      };
      const restoreRequestedFocus = () => {
        const request = pendingFocusRestore;
        if (!request) return;
        if (!live || !current()) return;
        // The target must be this generation's own control.
        if (!api.getPublicInstance?.(request.ref)) return;
        // The call is attempted once the content has presented its view.
        // This only narrows the attempt: the presentation signal does not
        // establish native readiness, so the focus module can still retain a
        // request for a target that cannot yet take focus.  The composition
        // cannot withdraw such a retained request, and a later epoch change
        // does not withdraw it either.  That boundary is an open dependency,
        // not something this guard prevents.
        if (!panelPresented()) return;
        // Newer focus intent wins: any focus change since the swap began is
        // the user's, even when the focus later fell back to the document.
        if (options.focusEpoch() !== request.epoch) {
          // Newer focus intent wins.  The entry policy is still held: the
          // content's own activation may not have happened yet, and releasing
          // it now would let that activation auto-enter and steal the focus
          // the user just moved.
          pendingFocusRestore = null;
          return;
        }
        // The focus the user held must still be the current focus, or focus
        // must have fallen back to the document because the replaced
        // generation's element was retired.  Any other focus is user intent.
        const doc = request.origin?.ownerDocument ?? null;
        const active = doc?.activeElement ?? null;
        if (
          active &&
          active !== request.origin &&
          active !== doc?.body &&
          active !== doc?.documentElement
        ) {
          pendingFocusRestore = null;
          return;
        }
        // The public focus request is only complete once the control itself
        // reports that it holds focus.  A request the active scope refuses
        // leaves the request pending, so it is retried rather than lost.
        api.call(request.ref, 'focusSelf');
        if (!targetHoldsFocus(request.ref)) return;
        pendingFocusRestore = null;
      };
      const watchOpenerReturn = (restore: () => void) => {
        const present = api.getPublicInstance?.('panel')?.getExposes()?.isPresent as
          | {
              get(): boolean;
              subscribe(cb: (event: { type?: string; next: boolean }) => void): () => void;
            }
          | undefined;
        if (!present?.subscribe) return;
        const finish = () => {
          if (present.get()) return;
          // Let the presence callback finish detaching before focusing outside.
          queueMicrotask(() => {
            if (cancelOpenerReturn !== cancel || present.get()) return;
            cancel();
            if (current() && !session.read().open) restore();
          });
        };
        const off = present.subscribe((event) => {
          if (event.type === 'next' && !event.next) finish();
        });
        const cancel = () => {
          cancelOpenerReturn = undefined;
          off();
        };
        cancelOpenerReturn = cancel;
        return finish;
      };
      /** Re-check the pending restore whenever the content's own transition completes. */
      const watchPanelTransition = () => {
        const instance = api.getPublicInstance?.('panel');
        if (!instance || instance === panelTransitionOwner) return;
        // A replaced panel is a new content with its own transition.
        offPanelTransition?.();
        offPanelTransition = null;
        panelTransitionOwner = instance;
        const transition = instance.getExposes()?.transitionState as
          | {
              get(): string;
              subscribe(cb: (event: { type?: string; next: string }) => void): () => void;
            }
          | undefined;
        if (!transition?.subscribe) return;
        offPanelTransition = transition.subscribe((event) => {
          // The content's transition is a retry trigger: its own scope becomes
          // active when the content mounts, which is when a public focus
          // request for this generation's control can be accepted.
          if (event.type !== 'next') return;
          restoreRequestedFocus();
        });
      };
      const disposers = new Set<() => void>();
      const inputValueChange = (detail: { value: string; composing: boolean }) => {
        if (current() && !seedingQuery) session.input(detail.value, detail.composing);
      };
      const execute = (detail: { value: string }) => {
        if (current()) session.execute(detail.value);
      };
      api.setProps('command', { onInputValueChange: inputValueChange, onExecute: execute });
      api.setProps('dialog', {
        onOpenChange: (detail: { open: boolean }) => {
          if (current()) session.setOpen(detail.open);
        },
      });
      const paint = async () => {
        const epoch = ++paintEpoch;
        const { open, snapshot, retrying, navigation } = session.read();
        if (!live) return;
        const active = current();
        if (!active || !open) {
          // Late author-slot completions from a closed generation cannot certify
          // a later reopen, even if its retained DOM box identity is unchanged.
          pendingHint = undefined;
          committedHint = undefined;
          let finish: (() => void) | undefined;
          if (!open) {
            const prepare = prepareOpenerReturn;
            prepareOpenerReturn = undefined;
            const restore = active && prepare?.(refs.panel);
            if (restore) finish = watchOpenerReturn(restore);
            // A closed generation hands the entry policy back and drops its
            // pending restore, so a later open of this generation is a normal
            // fresh open that auto-enters the query again.
            pendingFocusRestore = null;
            releaseEntryPolicy();
          }
          api.setProps('dialog', { open: false });
          finish?.();
          return;
        }
        cancelOpenerReturn?.();
        // Opening is independent of whether a closed host has instantiated its
        // Command subtree. Otherwise a lazy Dialog could wait forever for the
        // very identity that opening must create. Latest authored default is
        // available before that first creation; retained controls are seeded below.
        if (!api.getPublicInstance?.('command'))
          api.setProps('command', { defaultInputValue: snapshot.query });
        // A generation swap that replaced the focused control arms this
        // generation's entry policy before the Dialog opens, so the content's
        // own automatic entry focus cannot claim focus for the new generation.
        if (!focusRestoreArmed) {
          focusRestoreArmed = true;
          const request = options.takeFocusRestore();
          if (request) {
            pendingFocusRestore = request;
            entryPolicyManual = true;
            api.setProps('panel', { focusEntry: 'manual' });
          }
        }
        api.setProps('dialog', { open: true });
        // The content may still be detached, so its activation can happen
        // after this paint.  The restore waits for the content's own presented
        // boundary and for the target this generation owns.
        watchPanelTransition();
        restoreRequestedFocus();
        if (!current() || epoch !== paintEpoch) return;
        const command = api.getPublicInstance?.('command');
        if (!command) return;
        // A prepared generation may outlive a query change before activation.
        // Seed each actual Command instance once, not on async result updates.
        if (command !== seededCommand) {
          seedingQuery = true;
          try {
            api.call('command', 'setInputValue', snapshot.query, false);
            seededCommand = command;
          } finally {
            seedingQuery = false;
          }
        }
        if (!current() || epoch !== paintEpoch) return;
        // Never rewrite the static editor or its inputValue during result updates:
        // Command owns the real edit/IME/selection state throughout this generation.
        const isNavigation = !snapshot.query.trim() && navigation.length > 0;
        const visibleRows = isNavigation ? navigation : snapshot.rows;
        const groupLabel = isNavigation ? (copy.pages ?? copy.title) : (copy.results ?? copy.title);
        const rows: DemoKeyedChild[] =
          !isNavigation && snapshot.phase === 'empty'
            ? [
                {
                  key: 'empty-state',
                  node: proto('command-empty', { props: style, children: [copy.empty] }),
                },
              ]
            : visibleRows.map((row) => ({
                key: row.id,
                node: proto('command-item', {
                  props: { ...style, value: row.id, textValue: row.title },
                  children: [
                    {
                      kind: 'box',
                      tag: 'span',
                      attrs: { 'aria-hidden': 'true' },
                      className: 'shrink-0',
                      children: [
                        {
                          kind: 'proto',
                          prototypeId: 'lucide-arrow-right-icon',
                          props: { size: 16 },
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'flex min-w-0 flex-col',
                      children: [
                        row.title,
                        ...(!isNavigation
                          ? [
                              {
                                kind: 'box' as const,
                                attrs: { 'data-search-result-url': '' },
                                className: 'text-xs opacity-70 break-words',
                                children: [row.href],
                              },
                            ]
                          : []),
                      ],
                    },
                  ],
                }),
              }));
        if (visibleRows.length)
          rows.unshift({
            key: 'group-heading',
            node: {
              kind: 'box',
              tag: 'div',
              className: 'px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground',
              attrs: { 'aria-hidden': 'true' },
              children: [groupLabel],
            },
          });
        // This noninteractive hint is independent of result mounting. Retain its
        // subtree while visibility/copy and the actual author-box identity are
        // unchanged; query characters must not enqueue another transaction.
        // With authored page navigation this is a stable keyboard instruction,
        // not a live enabled action/status. Keep it across query-loading phases.
        const showHint = navigation.length > 0 || visibleRows.length > 0;
        const syncHint = (target: HTMLElement) => {
          const matches = (request: HintRequest | undefined) =>
            !!request && request.target === target && request.visible === showHint;
          // A different pending write may invalidate an older committed fact;
          // supersede it rather than trusting that earlier cache entry.
          if (!matches(pendingHint) && (pendingHint || !matches(committedHint))) {
            const request: HintRequest = { target, visible: showHint };
            pendingHint = request;
            void (async () => {
              try {
                const outcome = await api.setChildren!(
                  'keyboard-hint',
                  showHint
                    ? [
                        {
                          key: 'enter',
                          node: {
                            kind: 'box',
                            tag: 'span',
                            className: 'rounded border bg-background px-1 font-sans text-xs',
                            attrs: { 'aria-label': 'Enter' },
                            children: ['↵'],
                          },
                        },
                        { key: 'instruction', node: copy.goToPage ?? copy.hint },
                      ]
                    : []
                );
                if (pendingHint !== request) return;
                pendingHint = undefined;
                if (!current() || !session.read().open || refs['keyboard-hint'] !== target) return;
                committedHint = outcome === 'committed' ? request : undefined;
                // Non-commit is eligible for the next real paint; never spin/retry.
              } catch (error) {
                if (pendingHint !== request) return;
                pendingHint = undefined;
                committedHint = undefined;
                if (current()) options.onFailure(error);
              }
            })();
          }
        };
        // A public instance may exist before its physical author box. Do not
        // submit or cache an undefined target during that preparation window.
        const preparedHintTarget = refs['keyboard-hint'];
        if (preparedHintTarget) syncHint(preparedHintTarget);
        const committed = await api.setChildren!('results', rows);
        if (!current() || !session.read().open || epoch !== paintEpoch || committed !== 'committed')
          return;
        // Public Prototype identity can publish before all author-box refs.
        // Only the current committed author-slot transaction admits DOM attributes;
        // a closed/superseded generation above is not a missing-ready-box error.
        const resultsTarget = refs.results;
        if (!resultsTarget)
          throw new Error('Search committed results without its current author box');
        const committedHintTarget = refs['keyboard-hint'];
        if (!committedHintTarget)
          throw new Error('Search committed results without its current keyboard hint author box');
        // The committed transaction also admits author refs that published after
        // the public instance. This independent hint transaction never gates results.
        if (committedHintTarget !== preparedHintTarget) syncHint(committedHintTarget);
        resultsTarget.setAttribute('aria-label', groupLabel);
        refs.status.textContent =
          snapshot.phase === 'loading'
            ? copy.loading
            : snapshot.phase === 'error' || snapshot.moreError
              ? copy.error
              : snapshot.phase === 'empty'
                ? copy.count(0)
                : snapshot.phase === 'ready'
                  ? copy.count(snapshot.resultCount)
                  : copy.hint;
        const action =
          retrying || snapshot.phase === 'error' || snapshot.moreError
            ? 'retry'
            : snapshot.hasMore
              ? 'more'
              : null;
        const actions: DemoKeyedChild[] = action
          ? [
              {
                key: action,
                node: proto('button', {
                  ref: 'search-page-action',
                  props: {
                    variant: family === 'shadcn' ? 'secondary' : 'surface',
                    wrap: true,
                    disabled: snapshot.loadingMore || retrying,
                  },
                  children: [
                    snapshot.loadingMore || retrying
                      ? copy.loading
                      : action === 'retry'
                        ? copy.retry
                        : copy.more,
                  ],
                }),
              },
            ]
          : [];
        const actionCommit = await api.setChildren!('actions', actions);
        if (
          !current() ||
          !session.read().open ||
          epoch !== paintEpoch ||
          actionCommit !== 'committed' ||
          !action
        )
          return;
        if (action === 'retry' && !retrying && !snapshot.query.trim()) {
          const currentAction = api.getPublicInstance?.('search-page-action');
          if (currentAction && currentAction !== focusedFailureAction) {
            focusedFailureAction = currentAction;
            api.call('search-page-action', 'focusSelf');
          }
        }
        api.setProps('search-page-action', {
          onClick: () => {
            if (!current()) return;
            if (action === 'retry') session.retry();
            else session.loadMore();
            // The invoked action may disappear after a successful retry/final page.
            // Return editing focus through the real public control, not DOM queries.
            queueMicrotask(() => {
              if (current() && session.read().open) api.call('query', 'focusSelf');
            });
          },
        });
      };
      const requestPaint = () => {
        void paint().catch((error) => {
          if (live) options.onFailure(error);
        });
      };
      if (!api.subscribePublicInstances)
        throw new Error('Search requires committed public instance identity subscriptions');
      const offInstances = api.subscribePublicInstances(
        // 'panel' and 'close' are observed so the pending focus restore can
        // wait for the content's presented boundary and for the target this
        // generation actually owns.
        family === 'shadcn'
          ? ['command', 'query-shell', 'query', 'panel', 'close']
          : ['command', 'panel', 'close'],
        (instances) => {
          // A portal/ref replacement retires its old facts binding first.
          binding?.dispose();
          binding = undefined;
          if (family === 'shadcn' && instances['query-shell'] && instances.query) {
            binding = bindInputShellControl(
              {
                isCurrent: () => live,
                onDispose(dispose) {
                  disposers.add(dispose);
                  return () => {
                    disposers.delete(dispose);
                  };
                },
              },
              {
                instance: instances['query-shell'],
                setFacts(facts) {
                  if (live) api.setProps('query-shell', facts);
                },
              },
              instances.query
            );
          }
          if (current()) requestPaint();
          // The target may publish after the open transition, so the pending
          // restore is re-checked whenever this generation's instances change.
          watchPanelTransition();
          restoreRequestedFocus();
        }
      );
      activateView = (prepare) => {
        if (prepare) prepareOpenerReturn = prepare;
        requestPaint();
      };
      const off = session.subscribe(requestPaint);
      requestPaint();
      return () => {
        live = false;
        activateView = undefined;
        prepareOpenerReturn = undefined;
        cancelOpenerReturn?.();
        paintEpoch++;
        pendingHint = undefined;
        committedHint = undefined;
        pendingFocusRestore = null;
        const errors: unknown[] = [];
        for (const stop of [
          off,
          offInstances,
          () => binding?.dispose(),
          () => offPanelTransition?.(),
        ]) {
          try {
            stop();
          } catch (error) {
            errors.push(error);
          }
        }
        for (const dispose of disposers) {
          try {
            dispose();
          } catch (error) {
            errors.push(error);
          }
        }
        disposers.clear();
        if (errors.length) throw new AggregateError(errors, 'Search composition cleanup failed');
      };
    },
  };
  return {
    demo,
    activate(prepareOpenerReturn) {
      activateView?.(prepareOpenerReturn);
    },
  };
}
