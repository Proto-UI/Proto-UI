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
export function createSiteSearchComposition(options: {
  family: 'shadcn' | 'brutalist';
  shadcnStyle: 'rhea' | 'new-york-v4';
  session: SiteSearchSession;
  copy: SiteSearchCopy;
  isCurrent(): boolean;
  onFailure(error: unknown): void;
}): { demo: DemoSpec; activate(): void } {
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
  let activateView: (() => void) | undefined;
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
        proto('command-dialog-content', {
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
      type HintRequest = { target: HTMLElement; visible: boolean };
      let committedHint: HintRequest | undefined;
      let pendingHint: HintRequest | undefined;
      let binding: ReturnType<typeof bindInputShellControl> | undefined;
      const current = () => live && options.isCurrent();
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
        if (!current() || !open) {
          // Late author-slot completions from a closed generation cannot certify
          // a later reopen, even if its retained DOM box identity is unchanged.
          pendingHint = undefined;
          committedHint = undefined;
          api.setProps('dialog', { open: false });
          return;
        }
        // Opening is independent of whether a closed host has instantiated its
        // Command subtree. Otherwise a lazy Dialog could wait forever for the
        // very identity that opening must create. Latest authored default is
        // available before that first creation; retained controls are seeded below.
        if (!api.getPublicInstance?.('command'))
          api.setProps('command', { defaultInputValue: snapshot.query });
        api.setProps('dialog', { open: true });
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
        family === 'shadcn' ? ['command', 'query-shell', 'query'] : ['command'],
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
        }
      );
      activateView = requestPaint;
      const off = session.subscribe(requestPaint);
      requestPaint();
      return () => {
        live = false;
        activateView = undefined;
        paintEpoch++;
        pendingHint = undefined;
        committedHint = undefined;
        const errors: unknown[] = [];
        for (const stop of [off, offInstances, () => binding?.dispose()]) {
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
    activate() {
      activateView?.();
    },
  };
}
