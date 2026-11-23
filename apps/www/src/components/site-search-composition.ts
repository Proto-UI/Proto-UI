import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import type {
  DemoSpec,
  DemoNode,
  DemoKeyedChild,
  DemoPublicInstance,
  DemoChildrenCommit,
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
  retainsOpenWhileLocked?(): boolean;
  onFailure(error: unknown): void;
  /**
   * Pending bounded focus restore for the generation being opened.  The scope
   * replaces it on every swap, so a superseded swap can never restore into a
   * later generation.
   */
  takeFocusRestore(): SiteSearchFocusRestore | null;
  /** The scope's current focus epoch, used to detect newer focus intent. */
  focusEpoch(): number;
}): {
  demo: DemoSpec;
  activate(prepareOpenerReturn?: PrepareOpenerReturn): void;
  restoreFocus(request: SiteSearchFocusRestore): void;
} {
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
  const keyboardHint: DemoNode = {
    kind: 'box',
    tag: 'div',
    ref: 'keyboard-hint',
    // Hints may wrap at enlarged text sizes. They share the outer scrollport
    // with status/actions so the fixed dismissal cannot consume the result view.
    className:
      family === 'shadcn'
        ? 'flex shrink-0 min-w-0 items-center gap-2 p-2 text-xs text-muted-foreground'
        : 'flex shrink-0 min-w-0 items-center gap-2 p-2',
    dynamicChildren: { prototypeIds: [] },
    children: [],
  };
  const footer: DemoNode = {
    kind: 'box',
    ref: 'dismissal',
    tag: 'div',
    className:
      family === 'shadcn'
        ? 'flex min-h-11 shrink-0 min-w-0 items-center justify-end border-t border-border bg-muted/50 px-4 text-xs text-muted-foreground'
        : 'flex shrink-0 min-w-0 items-center justify-end p-2',
    children: [
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
  let restoreViewFocus: ((request: SiteSearchFocusRestore) => void) | undefined;
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
                  // This middle region contains status/actions overflow. Cap the
                  // list at its viewport instead of shrinking it behind a wrapped
                  // status block; dismissal stays outside this outer scrollport.
                  className:
                    family === 'shadcn'
                      ? 'flex flex-col min-h-0 min-w-0 flex-1 basis-80 overflow-y-auto px-2 pb-2'
                      : 'flex flex-col min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-2',
                  // Side and bottom gutters expose the outer scrollport to both
                  // wheel input and touch gestures while the inner list scrolls.
                  // Preferred menu list height yields to the bounded Dialog on
                  // short/enlarged viewports; it is not a mandatory clipping min.
                  children: [
                    proto('command-content', {
                      props: style,
                      ref: 'list',
                      surfaceStyle: { flex: '0 0 auto', minHeight: '0', maxHeight: '100%' },
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
                    keyboardHint,
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
      let failureFocusOpening: { epoch: number } | undefined;
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
      let openerReturnArmed = false;
      let offPanelTransition: (() => void) | null = null;
      let panelTransitionOwner: unknown = null;
      type HintRequest = { target: HTMLElement; visible: boolean };
      let committedHint: HintRequest | undefined;
      let pendingHint: HintRequest | undefined;
      type InputBinding = {
        shell: DemoPublicInstance;
        control: DemoPublicInstance;
        binding?: ReturnType<typeof bindInputShellControl>;
        retired: boolean;
      };
      let inputBinding: InputBinding | undefined;
      const current = () => live && options.isCurrent();
      let dialogProjection: { owner: DemoPublicInstance | undefined; open: boolean } | undefined;
      const setDialogOpen = (open: boolean) => {
        const owner = api.getPublicInstance?.('dialog');
        if (owner && dialogProjection?.owner === owner && dialogProjection.open === open) return;
        // Reserve before the synchronous public write, which may publish a new
        // instance or a newer controlled open/close request reentrantly.
        const request = { owner, open };
        dialogProjection = request;
        try {
          api.setProps('dialog', { open });
        } catch (error) {
          if (dialogProjection === request) dialogProjection = undefined;
          throw error;
        }
        if (
          dialogProjection === request &&
          (!live || !owner || api.getPublicInstance?.('dialog') !== owner)
        )
          dialogProjection = undefined;
      };
      type AuthorSlot = 'results' | 'actions';
      type Publication = {
        command: DemoPublicInstance;
        target: HTMLElement | undefined;
        content: string;
        promise: Promise<DemoChildrenCommit>;
      };
      const publications: Partial<Record<AuthorSlot, Publication>> = {};
      let actionBinding:
        | {
            owner: DemoPublicInstance | undefined;
            action: 'retry' | 'more';
          }
        | undefined;
      const clearPublications = () => {
        delete publications.results;
        delete publications.actions;
        actionBinding = undefined;
      };
      const publicationIsCurrent = (slot: AuthorSlot, request: Publication) =>
        publications[slot] === request &&
        api.getPublicInstance?.('command') === request.command &&
        refs[slot] === request.target &&
        publications[slot] === request;
      const publishChildren = (
        slot: AuthorSlot,
        children: readonly DemoKeyedChild[],
        command: DemoPublicInstance
      ): Publication => {
        // These two recipe-owned trees contain only JSON-like authored data.
        // Compare values: Session deliberately publishes fresh row snapshots.
        const content = JSON.stringify(children);
        const target = refs[slot];
        const previous = publications[slot];
        if (
          target &&
          previous?.target === target &&
          previous.command === command &&
          previous.content === content
        )
          return previous;
        let resolve!: (outcome: DemoChildrenCommit) => void;
        let reject!: (error: unknown) => void;
        const promise = new Promise<DemoChildrenCommit>((yes, no) => {
          resolve = yes;
          reject = no;
        });
        const request: Publication = { command, target, content, promise };
        // One latest publication replaces both old pending and acknowledged
        // content. In particular A -> pending B -> A must overwrite B.
        publications[slot] = request;
        const fail = (error: unknown) => {
          if (publications[slot] === request) delete publications[slot];
          reject(error);
        };
        try {
          void api.setChildren!(slot, children).then((outcome) => {
            if (publications[slot] !== request) return resolve('superseded');
            if (
              !current() ||
              !session.read().open ||
              api.getPublicInstance?.('command') !== command ||
              publications[slot] !== request
            ) {
              if (publications[slot] === request) delete publications[slot];
              return resolve('superseded');
            }
            // A fresh successful host/ref commit certifies the current author
            // box, which may replace a preparing ref during framework commit.
            // Reuse and paint continuations stay pinned to this acknowledged
            // identity; an old acknowledgement cannot admit a later box.
            if (outcome === 'committed') request.target = refs[slot];
            else delete publications[slot];
            resolve(outcome);
          }, fail);
        } catch (error) {
          fail(error);
        }
        return request;
      };
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
      const paint = async (epoch: number) => {
        const { open, snapshot, retrying, navigation } = session.read();
        if (!live) return;
        const active = current();
        // A retained Homepage view can be locked during both preparation and
        // rollback. Its native editor and selection still belong to this view.
        if (!active && open && options.retainsOpenWhileLocked?.()) return;
        if (!active || !open) {
          failureFocusOpening = undefined;
          focusedFailureAction = undefined;
          // Late author-slot completions from a closed generation cannot certify
          // a later reopen, even if its retained DOM box identity is unchanged.
          pendingHint = undefined;
          committedHint = undefined;
          clearPublications();
          let finish: (() => void) | undefined;
          if (!open) {
            // Each accepted opening owns one handback. Closed-state repaints
            // cannot repeat it, and a later opening gets a fresh request.
            const restore =
              active && openerReturnArmed ? prepareOpenerReturn?.(refs.panel) : undefined;
            openerReturnArmed = false;
            if (restore) finish = watchOpenerReturn(restore);
            // A closed generation hands the entry policy back and drops its
            // pending restore, so a later open of this generation is a normal
            // fresh open that auto-enters the query again.
            pendingFocusRestore = null;
            releaseEntryPolicy();
          }
          setDialogOpen(false);
          finish?.();
          return;
        }
        openerReturnArmed = true;
        cancelOpenerReturn?.();
        // Capture before automatic Dialog entry, not when a late error arrives.
        // Keep this opening's identity across both author-slot commits below.
        if (!failureFocusOpening) failureFocusOpening = { epoch: options.focusEpoch() };
        const failureFocus = failureFocusOpening;
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
        setDialogOpen(true);
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
        const resultsPublication = publishChildren('results', rows, command);
        const committed = await resultsPublication.promise;
        if (
          !current() ||
          !session.read().open ||
          epoch !== paintEpoch ||
          committed !== 'committed' ||
          !publicationIsCurrent('results', resultsPublication)
        )
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
        if (
          !current() ||
          epoch !== paintEpoch ||
          !publicationIsCurrent('results', resultsPublication)
        )
          return;
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
                    variant:
                      family === 'shadcn'
                        ? 'secondary'
                        : family === 'brutalist'
                          ? 'surface'
                          : 'default',
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
        const actionsPublication = publishChildren('actions', actions, command);
        const actionCommit = await actionsPublication.promise;
        if (
          !current() ||
          !session.read().open ||
          epoch !== paintEpoch ||
          actionCommit !== 'committed' ||
          !publicationIsCurrent('actions', actionsPublication)
        )
          return;
        if (!action) {
          actionBinding = undefined;
          return;
        }
        const currentAction = api.getPublicInstance?.('search-page-action');
        if (action === 'retry' && !retrying && !snapshot.query.trim()) {
          const focusEpoch = options.focusEpoch();
          // Only the first automatic editor entry may advance this opening's
          // epoch. Any later focus choice wins, even if it subsequently blurs.
          const entryFocusUnchanged =
            focusEpoch === failureFocus.epoch ||
            (focusEpoch === failureFocus.epoch + 1 && targetHoldsFocus('query'));
          if (
            failureFocusOpening === failureFocus &&
            !entryPolicyManual &&
            entryFocusUnchanged &&
            currentAction &&
            currentAction !== focusedFailureAction
          ) {
            focusedFailureAction = currentAction;
            api.call('search-page-action', 'focusSelf');
          }
        }
        if (
          !current() ||
          !session.read().open ||
          epoch !== paintEpoch ||
          api.getPublicInstance?.('search-page-action') !== currentAction ||
          !publicationIsCurrent('actions', actionsPublication)
        )
          return;
        if (
          currentAction &&
          actionBinding?.owner === currentAction &&
          actionBinding.action === action
        )
          return;
        const actionRequest: NonNullable<typeof actionBinding> = { owner: currentAction, action };
        actionBinding = actionRequest;
        try {
          api.setProps('search-page-action', {
            onClick: () => {
              if (
                !current() ||
                !session.read().open ||
                actionBinding !== actionRequest ||
                api.getPublicInstance?.('search-page-action') !== actionRequest.owner
              )
                return;
              if (action === 'retry') session.retry();
              else session.loadMore();
              // The invoked action may disappear after a successful retry/final page.
              // Return editing focus through the real public control, not DOM queries.
              queueMicrotask(() => {
                if (current() && session.read().open) api.call('query', 'focusSelf');
              });
            },
          });
        } catch (error) {
          if (actionBinding === actionRequest) actionBinding = undefined;
          throw error;
        }
        if (
          actionBinding === actionRequest &&
          (!live || api.getPublicInstance?.('search-page-action') !== currentAction)
        )
          actionBinding = undefined;
      };
      const requestPaint = () => {
        const epoch = ++paintEpoch;
        void paint(epoch).catch((error) => {
          // Several paints can await one author commit. Only the current paint
          // reports its failure; an older continuation cannot fail newer work.
          if (live && epoch === paintEpoch) options.onFailure(error);
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
          const shell = instances['query-shell'];
          const control = instances.query;
          if (
            family === 'shadcn' &&
            (inputBinding?.shell !== shell || inputBinding?.control !== control)
          ) {
            const previous = inputBinding;
            inputBinding = undefined;
            previous?.binding?.dispose();
            // Disposing old facts can synchronously publish a newer pair.
            if (
              live &&
              !inputBinding &&
              shell &&
              control &&
              api.getPublicInstance?.('query-shell') === shell &&
              api.getPublicInstance?.('query') === control
            ) {
              const request: InputBinding = { shell, control, retired: false };
              inputBinding = request;
              try {
                const binding = bindInputShellControl(
                  {
                    isCurrent: () => live && inputBinding === request,
                    onDispose(dispose) {
                      disposers.add(dispose);
                      return () => {
                        disposers.delete(dispose);
                        // Keep a terminal pair as a tombstone: an unrelated panel
                        // notification must not read or revive disconnected facts.
                        request.retired = true;
                      };
                    },
                  },
                  {
                    instance: shell,
                    setFacts(facts) {
                      if (
                        live &&
                        inputBinding === request &&
                        api.getPublicInstance?.('query-shell') === shell &&
                        api.getPublicInstance?.('query') === control &&
                        inputBinding === request
                      )
                        api.setProps('query-shell', facts);
                    },
                  },
                  control
                );
                if (live && inputBinding === request && !request.retired) request.binding = binding;
                else binding.dispose();
              } catch (error) {
                if (inputBinding === request) inputBinding = undefined;
                throw error;
              }
            }
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
      restoreViewFocus = (request) => {
        if (!current() || !session.read().open) return;
        pendingFocusRestore = request;
        try {
          restoreRequestedFocus();
        } catch (error) {
          pendingFocusRestore = null;
          console.error('[SiteSearch] Failed to restore retained Dialog focus.', error);
        }
      };
      const off = session.subscribe(requestPaint);
      requestPaint();
      return () => {
        live = false;
        activateView = undefined;
        restoreViewFocus = undefined;
        prepareOpenerReturn = undefined;
        openerReturnArmed = false;
        cancelOpenerReturn?.();
        paintEpoch++;
        pendingHint = undefined;
        committedHint = undefined;
        clearPublications();
        dialogProjection = undefined;
        failureFocusOpening = undefined;
        pendingFocusRestore = null;
        const errors: unknown[] = [];
        for (const stop of [
          off,
          offInstances,
          () => inputBinding?.binding?.dispose(),
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
    restoreFocus(request) {
      restoreViewFocus?.(request);
    },
  };
}
