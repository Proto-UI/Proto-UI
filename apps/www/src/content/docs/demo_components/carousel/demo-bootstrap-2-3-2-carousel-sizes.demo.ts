import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const items = [
  { num: '1', title: 'Thumbnail 1', tone: 'from-slate-700 to-slate-900' },
  { num: '2', title: 'Thumbnail 2', tone: 'from-sky-800 to-slate-900' },
  { num: '3', title: 'Thumbnail 3', tone: 'from-indigo-800 to-slate-900' },
  { num: '4', title: 'Thumbnail 4', tone: 'from-teal-800 to-slate-900' },
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
          a11yLabel: 'Multi-item slides',
          slidesPerView: 2,
          minSlideSize: 180,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-viewport',
            ref: 'viewport',
            children: items.map((item, index) => ({
              kind: 'proto' as const,
              prototypeId: 'bootstrap-2-3-2-carousel-slide',
              props: { index },
              className: 'px-1.5',
              children: [
                {
                  kind: 'box',
                  className: 'rounded border border-[#ddd] bg-white p-1 shadow-xs',
                  children: [
                    {
                      kind: 'box',
                      className: `flex h-36 items-center justify-center bg-gradient-to-br ${item.tone} text-white`,
                      children: [
                        {
                          kind: 'box',
                          tag: 'span',
                          className: 'text-3xl font-light',
                          children: [item.num],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'px-2 py-2 text-xs font-semibold text-[#333]',
                      children: [item.title],
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
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['‹'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-carousel-next',
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
