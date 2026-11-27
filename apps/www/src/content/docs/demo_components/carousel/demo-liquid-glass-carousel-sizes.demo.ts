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
        kind: 'proto',
        prototypeId: 'liquid-glass-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-lg',
        props: {
          a11yLabel: 'Multi-item glass carousel',
          slidesPerView: 2,
          minSlideSize: 180,
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
              className: 'py-1',
              children: [
                {
                  kind: 'box',
                  className: `flex aspect-[4/3] items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} p-6 text-white shadow-sm`,
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
              { kind: 'proto', prototypeId: 'lucide-chevron-left-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-carousel-next',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-right-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
