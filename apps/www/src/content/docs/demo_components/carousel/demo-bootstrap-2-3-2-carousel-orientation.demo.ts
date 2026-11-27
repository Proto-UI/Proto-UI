import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const slides = [
  { num: '1', title: 'Vertical Slide 1', tone: 'from-slate-700 to-slate-900' },
  { num: '2', title: 'Vertical Slide 2', tone: 'from-sky-800 to-slate-900' },
  { num: '3', title: 'Vertical Slide 3', tone: 'from-emerald-800 to-slate-900' },
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
        className: 'mx-auto w-full max-w-md',
        props: {
          a11yLabel: 'Vertical bootstrap carousel',
          orientation: 'vertical',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-viewport',
            ref: 'viewport',
            className: 'h-56',
            children: slides.map((slide, index) => ({
              kind: 'proto' as const,
              prototypeId: 'bootstrap-2-3-2-carousel-slide',
              props: { index },
              className: 'h-full',
              children: [
                {
                  kind: 'box',
                  className: `flex h-full flex-col justify-between bg-gradient-to-br ${slide.tone} text-white`,
                  children: [
                    {
                      kind: 'box',
                      className: 'flex flex-1 items-center justify-center',
                      children: [
                        {
                          kind: 'box',
                          tag: 'span',
                          className: 'text-4xl font-light',
                          children: [slide.num],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'bg-black/75 px-4 py-2 text-xs font-bold',
                      children: [slide.title],
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
              { kind: 'proto', prototypeId: 'lucide-chevron-up-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-next',
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
