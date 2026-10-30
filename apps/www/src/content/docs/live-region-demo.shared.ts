import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

/**
 * Live Region is semantic-only in these families: Base owns role/aria-live/
 * aria-atomic and the authored slot is the announcement payload. The demo only
 * sets the public politeness/atomic props and mutates authored child content;
 * it never simulates an announcement engine or adds interaction.
 */
export function createLiveRegionDemo(family: string): DemoSpec {
  const region = (
    ref: string,
    payloadRef: string,
    props: Record<string, unknown>,
    initial: string
  ): DemoNode => ({
    kind: 'box',
    className: 'rounded-md border border-border',
    children: [
      {
        kind: 'proto',
        prototypeId: `${family}-live-region-root`,
        ref,
        props,
        children: [
          {
            kind: 'box',
            ref: payloadRef,
            className: 'min-w-0 px-4 py-3 text-sm',
            children: [initial],
          },
        ],
      },
    ],
  });
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
        region('polite', 'politePayload', { politeness: 'polite', atomic: true }, '0 new notifications · 0 条新通知'),
        region('assertive', 'assertivePayload', { politeness: 'assertive', atomic: true }, 'Service normal · 服务正常'),
        {
          kind: 'box',
          className: 'flex flex-wrap gap-2',
          children: [
            button('announcePolite', 'Push polite update · 推送 polite 更新'),
            button('announceAssertive', 'Push assertive update · 推送 assertive 更新'),
          ],
        },
        {
          kind: 'box',
          className: 'text-xs text-muted-foreground',
          children: [
            'Content updates are authored-slot mutations; the region itself has no event or command channel.',
          ],
        },
      ],
    },
    setup({ refs, api }) {
      let politeCount = 0;
      let assertiveCount = 0;
      api.setProps('announcePolite', {
        onClick: () => {
          politeCount += 1;
          if (refs.politePayload)
            refs.politePayload.textContent = `${politeCount} new notification${politeCount === 1 ? '' : 's'} · ${politeCount} 条新通知`;
        },
      });
      api.setProps('announceAssertive', {
        onClick: () => {
          assertiveCount += 1;
          if (refs.assertivePayload)
            refs.assertivePayload.textContent =
              assertiveCount % 2 === 1 ? 'Service degraded · 服务降级' : 'Service normal · 服务正常';
        },
      });
    },
  };
}
