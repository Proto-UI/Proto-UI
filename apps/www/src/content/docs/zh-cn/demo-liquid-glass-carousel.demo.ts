import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const cards = [
  {
    num: '1',
    label: 'Coastal Morning',
    gradient: 'from-sky-500 via-cyan-500 to-teal-500',
  },
  {
    num: '2',
    label: 'Alpine Dusk',
    gradient: 'from-indigo-500 via-violet-500 to-purple-500',
  },
  {
    num: '3',
    label: 'Sunset Horizon',
    gradient: 'from-rose-500 via-pink-500 to-amber-500',
  },
  {
    num: '4',
    label: 'Forest Mist',
    gradient: 'from-emerald-500 via-teal-500 to-sky-500',
  },
  {
    num: '5',
    label: 'Midnight Glow',
    gradient: 'from-blue-600 via-indigo-600 to-fuchsia-600',
  },
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
          a11yLabel: 'Media gallery',
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
                      className: 'text-4xl font-semibold tracking-tight',
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
            ref: 'previous',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-left-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-carousel-next',
            ref: 'next',
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
