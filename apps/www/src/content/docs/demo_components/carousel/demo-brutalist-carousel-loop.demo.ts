import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const slideNumbers = [1, 2, 3, 4, 5];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full min-w-0 px-12',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-xs',
        props: {
          a11yLabel: 'Looping brutalist carousel',
          loop: true,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-carousel-viewport',
            ref: 'viewport',
            children: slideNumbers.map((num, index) => ({
              kind: 'proto' as const,
              prototypeId: 'brutalist-carousel-slide',
              props: { index },
              className: 'py-2',
              children: [
                {
                  kind: 'box',
                  className:
                    'flex aspect-square items-center justify-center rounded-[5px] border-2 border-black bg-[#facc00] p-6 text-black shadow-[4px_4px_0_0_#000]',
                  children: [
                    {
                      kind: 'box',
                      tag: 'span',
                      className: 'text-4xl font-bold',
                      children: [String(num)],
                    },
                  ],
                },
              ],
            })),
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-carousel-previous',
            children: [
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['←'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-carousel-next',
            children: [
              { kind: 'box', tag: 'span', attrs: { 'aria-hidden': 'true' }, children: ['→'] },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
