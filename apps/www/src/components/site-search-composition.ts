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
  const style = family === 'shadcn' ? { styleProfile: shadcnStyle } : {};
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
          children: [proto('input-shell', { ref: 'query-shell', props: style, children: [input] })],
        })
      : input;
  const footer: DemoNode = {
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
                editor,
                proto('command-content', {
                  props: style,
                  surfaceStyle: { flex: '1 1 auto' },
                  children: [
                    {
                      kind: 'box',
                      tag: 'div',
                      ref: 'results',
                      dynamicChildren: {
                        prototypeIds: [`${family}-command-item`, `${family}-command-empty`],
                      },
                      children: [],
                    },
                  ],
                }),
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
        const { open, snapshot, retrying } = session.read();
        if (!live) return;
        if (!current() || !open) {
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
        const rows: DemoKeyedChild[] =
          snapshot.phase === 'empty'
            ? [
                {
                  key: 'empty-state',
                  node: proto('command-empty', { props: style, children: [copy.empty] }),
                },
              ]
            : snapshot.rows.map((row) => ({
                key: row.id,
                node: proto('command-item', {
                  props: { ...style, value: row.id, textValue: row.title },
                  children: [
                    {
                      kind: 'box',
                      className: 'flex min-w-0 flex-col',
                      children: [
                        row.title,
                        {
                          kind: 'box',
                          attrs: { 'data-search-result-url': '' },
                          className: 'text-xs opacity-70 break-words',
                          children: [row.href],
                        },
                      ],
                    },
                  ],
                }),
              }));
        const committed = await api.setChildren!('results', rows);
        if (!current() || !session.read().open || epoch !== paintEpoch || committed !== 'committed')
          return;
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
