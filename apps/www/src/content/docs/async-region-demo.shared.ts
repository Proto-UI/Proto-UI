import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

// ExposeState may arrive as a handle ({get}) or as { kind:'state', state }.
const exposeGet = (handle: unknown): unknown => {
  const h = handle as { get?: () => unknown; state?: { get?: () => unknown } } | undefined;
  return h?.get ? h.get() : h?.state?.get?.();
};

/**
 * Async Region is a semantic-only projection in every family here: Base owns the
 * governed busy fact and preserves authored content; no family adds a spinner,
 * focus path or announcement channel. The demo therefore exercises only the
 * lawful public surface: the busy prop and the exposed busy state.
 */
export function createAsyncRegionDemo(family: string): DemoSpec {
  const button = (ref: string, label: string): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    children: [label],
  });
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 max-w-full gap-4 p-4',
      children: [
        {
          kind: 'box',
          className: 'rounded-md border border-border',
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-async-region-root`,
              ref: 'region',
              props: { busy: false },
              children: [
                {
                  kind: 'box',
                  ref: 'payload',
                  className: 'min-w-0 px-4 py-3 text-sm',
                  children: ['Authored results stay mounted while busy toggles · 忙碌切换时作者内容保持挂载'],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('markBusy', 'Set busy: true · 标记忙碌'),
            button('markReady', 'Set busy: false · 标记就绪'),
          ],
        },
        {
          kind: 'box',
          className: 'flex items-center gap-2 font-mono text-xs text-muted-foreground',
          children: ['exposes.busy =', { kind: 'box', ref: 'busyState', children: ['false'] }],
        },
      ],
    },
    setup({ host, refs, api }) {
      const render = () => {
        if (refs.busyState)
          refs.busyState.textContent = String(exposeGet(api.getExposes('region')?.busy) ?? false);
      };
      // The real projection surfaces as aria-busy on the region element.
      const mo = new MutationObserver(render);
      mo.observe(host, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
      const setBusy = (busy: boolean) => () => {
        api.setProps('region', { busy });
        requestAnimationFrame(render);
      };
      api.setProps('markBusy', { onClick: setBusy(true) });
      api.setProps('markReady', { onClick: setBusy(false) });
      render();
      return () => mo.disconnect();
    },
  };
}
