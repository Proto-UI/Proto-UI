import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const slideNumbers = [1, 2, 3, 4, 5];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full min-w-0 py-12',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-xs',
        props: {
          a11yLabel: 'Vertical brutalist carousel',
          orientation: 'vertical',
          slidesPerView: 2,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-carousel-viewport',
            ref: 'viewport',
            className: 'h-64',
            children: slideNumbers.map((num, index) => ({
              kind: 'proto' as const,
              prototypeId: 'brutalist-carousel-slide',
              props: { index },
              className: 'px-2',
              children: [
                {
                  kind: 'box',
                  className:
                    'flex h-full items-center justify-center rounded-[5px] border-2 border-black bg-[#5294ff] p-4 text-black shadow-[4px_4px_0_0_#000]',
                  children: [
                    {
                      kind: 'box',
                      tag: 'span',
                      className: 'text-3xl font-bold',
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
              { kind: 'proto', prototypeId: 'lucide-arrow-up-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-carousel-next',
            children: [
              { kind: 'proto', prototypeId: 'lucide-arrow-down-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
