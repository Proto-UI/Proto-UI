import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const cards = [
  { num: '1', gradient: 'from-sky-500 to-indigo-500' },
  { num: '2', gradient: 'from-violet-500 to-fuchsia-500' },
  { num: '3', gradient: 'from-rose-500 to-orange-500' },
  { num: '4', gradient: 'from-emerald-500 to-cyan-500' },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full min-w-0',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-sm',
        props: {
          a11yLabel: 'Vertical glass carousel',
          orientation: 'vertical',
          slidesPerView: 2,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-carousel-viewport',
            ref: 'viewport',
            className: 'h-64',
            children: cards.map((card, index) => ({
              kind: 'proto' as const,
              prototypeId: 'liquid-glass-carousel-slide',
              props: { index },
              className: 'px-1',
              children: [
                {
                  kind: 'box',
                  className: `flex h-full items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} p-4 text-white shadow-sm`,
                  children: [
                    {
                      kind: 'box',
                      tag: 'span',
                      className: 'text-3xl font-semibold',
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
              { kind: 'proto', prototypeId: 'lucide-chevron-up-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-carousel-next',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
