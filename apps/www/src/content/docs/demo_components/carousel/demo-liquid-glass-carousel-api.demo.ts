import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const cards = [
  { num: '1', gradient: 'from-sky-500 to-cyan-500' },
  { num: '2', gradient: 'from-indigo-500 to-purple-500' },
  { num: '3', gradient: 'from-rose-500 to-amber-500' },
  { num: '4', gradient: 'from-emerald-500 to-teal-500' },
  { num: '5', gradient: 'from-blue-600 to-fuchsia-600' },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full min-w-0',
    children: [
      {
        kind: 'box',
        className: 'mx-auto w-full max-w-md',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-carousel-root',
            ref: 'carousel',
            className: 'w-full',
            props: {
              a11yLabel: 'Tracked glass carousel',
              defaultIndex: 0,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-carousel-viewport',
                ref: 'viewport',
                children: cards.map((card, index) => ({
                  kind: 'proto' as const,
                  prototypeId: 'liquid-glass-carousel-slide',
                  props: { index },
                  className: 'p-1',
                  children: [
                    {
                      kind: 'box',
                      className: `flex aspect-[16/10] items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} p-6 text-white shadow-sm`,
                      children: [
                        {
                          kind: 'box',
                          tag: 'span',
                          className: 'text-4xl font-semibold',
                          children: [card.num],
                        },
                      ],
                    },
                  ],
                })),
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-carousel-previous',
                children: [
                  { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['‹'] },
                  { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-carousel-next',
                children: [
                  { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['›'] },
                  { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
                ],
              },
            ],
          },
          {
            kind: 'box',
            ref: 'status',
            attrs: { role: 'status', 'aria-live': 'polite' },
            className: 'mt-3 text-center text-sm font-medium text-foreground',
            children: [`Slide 1 of ${cards.length}`],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('carousel', {
      onIndexChange: (payload: unknown) => {
        const record = payload as { index?: number; detail?: { index?: number } } | null;
        const next =
          typeof record?.index === 'number'
            ? record.index
            : typeof record?.detail?.index === 'number'
              ? record.detail.index
              : undefined;
        if (next !== undefined && refs.status) {
          refs.status.textContent = `Slide ${next + 1} of ${cards.length}`;
        }
      },
    });
    return () => {
      api.setProps('carousel', { onIndexChange: null });
    };
  },
} satisfies DemoSpec;
