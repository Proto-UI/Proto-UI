import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const slides = [
  { num: '1', bg: 'bg-[#5294ff]' },
  { num: '2', bg: 'bg-[#facc00]' },
  { num: '3', bg: 'bg-[#05e17a]' },
  { num: '4', bg: 'bg-[#7a83ff]' },
  { num: '5', bg: 'bg-[#ff4d50]' },
];

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
        className: 'mx-auto w-full max-w-md',
        props: {
          a11yLabel: 'Multi-item brutalist cards',
          slidesPerView: 3,
          minSlideSize: 120,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-carousel-viewport',
            ref: 'viewport',
            children: slides.map((slide, index) => ({
              kind: 'proto' as const,
              prototypeId: 'brutalist-carousel-slide',
              props: { index },
              className: 'py-2',
              children: [
                {
                  kind: 'box',
                  className: `flex aspect-square items-center justify-center rounded-[5px] border-2 border-black ${slide.bg} p-4 text-black shadow-[4px_4px_0_0_#000]`,
                  children: [
                    {
                      kind: 'box',
                      tag: 'span',
                      className: 'text-3xl font-bold',
                      children: [slide.num],
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
              { kind: 'proto', prototypeId: 'lucide-arrow-left-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-carousel-next',
            children: [
              { kind: 'proto', prototypeId: 'lucide-arrow-right-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
