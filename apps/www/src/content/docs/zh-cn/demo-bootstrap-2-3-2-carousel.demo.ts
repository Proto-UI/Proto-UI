import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const slides = [
  {
    badge: '01',
    title: 'First slide label',
    caption: 'Classic 2.3.2 banner layout with dark translucent caption bar.',
    surface: 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900',
  },
  {
    badge: '02',
    title: 'Second slide label',
    caption: 'Drag, scroll, or activate the flanking ‹ / › controls to step.',
    surface: 'bg-gradient-to-br from-sky-800 via-slate-800 to-indigo-900',
  },
  {
    badge: '03',
    title: 'Third slide label',
    caption: 'Responsive equal-width snapping backed by Base Carousel.',
    surface: 'bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900',
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
        prototypeId: 'bootstrap-2-3-2-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-lg',
        props: {
          a11yLabel: 'Featured slides',
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
                  className: `relative flex h-56 flex-col justify-between overflow-hidden ${slide.surface} text-white`,
                  children: [
                    {
                      kind: 'box',
                      className: 'flex flex-1 items-center justify-center',
                      children: [
                        {
                          kind: 'box',
                          tag: 'span',
                          className: 'text-5xl font-light tracking-tight text-white/80',
                          children: [slide.badge],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'bg-black/75 px-4 py-3 text-left',
                      children: [
                        {
                          kind: 'box',
                          className: 'text-sm font-bold text-white',
                          children: [slide.title],
                        },
                        {
                          kind: 'box',
                          className: 'mt-0.5 text-xs text-white/85',
                          children: [slide.caption],
                        },
                      ],
                    },
                  ],
                },
              ],
            })),
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-previous',
            ref: 'previous',
            children: [
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['‹'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-next',
            ref: 'next',
            children: [
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['›'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
