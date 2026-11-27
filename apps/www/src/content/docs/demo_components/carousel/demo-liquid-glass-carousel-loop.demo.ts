import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const cards = [
  { num: '1', label: 'Regular & Prominent', gradient: 'from-cyan-500 to-blue-600' },
  { num: '2', label: 'Continuous Loop', gradient: 'from-violet-500 to-indigo-600' },
  { num: '3', label: 'Floating Chrome', gradient: 'from-fuchsia-500 to-rose-600' },
  { num: '4', label: 'Opaque Fallback', gradient: 'from-emerald-500 to-teal-600' },
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
        className: 'mx-auto w-full max-w-md',
        props: {
          a11yLabel: 'Looping glass carousel',
          loop: true,
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
                  className: `flex aspect-[16/10] flex-col items-center justify-center gap-1 rounded-lg bg-gradient-to-br ${card.gradient} p-6 text-white shadow-sm`,
                  children: [
                    {
                      kind: 'box',
                      tag: 'span',
                      className: 'text-4xl font-semibold',
                      children: [card.num],
                    },
                    {
                      kind: 'box',
                      tag: 'span',
                      className: 'text-xs font-medium text-white/90',
                      children: [card.label],
                    },
                  ],
                },
              ],
            })),
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-carousel-previous',
            props: { variant: 'regular' },
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-left-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-carousel-next',
            props: { variant: 'prominent' },
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
