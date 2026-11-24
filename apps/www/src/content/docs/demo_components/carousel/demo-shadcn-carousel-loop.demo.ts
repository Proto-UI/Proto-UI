import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const slideNumbers = [1, 2, 3, 4, 5];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full min-w-0 px-12',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-xs',
        props: {
          a11yLabel: 'Looping carousel',
          loop: true,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-carousel-viewport',
            ref: 'viewport',
            children: slideNumbers.map((num, index) => ({
              kind: 'proto' as const,
              prototypeId: 'shadcn-carousel-slide',
              props: { index },
              className: 'py-1',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'shadcn-card-root',
                  children: [
                    {
                      kind: 'proto' as const,
                      prototypeId: 'shadcn-card-content',
                      className: 'flex aspect-square items-center justify-center p-6',
                      children: [
                        {
                          kind: 'proto' as const,
                          prototypeId: 'shadcn-text-root',
                          props: { size: '4xl', weight: 'semibold', tone: 'inherit' },
                          children: [String(num)],
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
            prototypeId: 'shadcn-carousel-previous',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-left-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-carousel-next',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-right-icon', props: { size: 16 } },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
