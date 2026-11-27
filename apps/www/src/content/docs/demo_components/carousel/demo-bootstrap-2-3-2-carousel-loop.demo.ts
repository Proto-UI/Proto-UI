import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const slides = [
  { num: '1', label: 'Loop slide 1', tone: 'from-slate-700 to-slate-900' },
  { num: '2', label: 'Loop slide 2', tone: 'from-blue-800 to-slate-900' },
  { num: '3', label: 'Loop slide 3', tone: 'from-teal-800 to-slate-900' },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full min-w-0',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-lg',
        props: {
          a11yLabel: 'Looping bootstrap carousel',
          loop: true,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-viewport',
            ref: 'viewport',
            children: slides.map((slide, index) => ({
              kind: 'proto' as const,
              prototypeId: 'bootstrap-2-3-2-carousel-slide',
              props: { index },
              children: [
                {
                  kind: 'box',
                  className: `flex h-48 flex-col justify-between bg-gradient-to-br ${slide.tone} text-white`,
                  children: [
                    {
                      kind: 'box',
                      className: 'flex flex-1 items-center justify-center text-4xl font-light',
                      children: [slide.num],
                    },
                    {
                      kind: 'box',
                      className: 'bg-black/75 px-4 py-2 text-xs font-bold',
                      children: [slide.label],
                    },
                  ],
                },
              ],
            })),
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-previous',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-left-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-next',
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
