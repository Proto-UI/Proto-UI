import { withShadcnRheaDemo } from '../shadcn-demo-style';
import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const stages = ['First: plan the work', 'Second: build the component', 'Third: verify the result'];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    // Carousel navigation sits outside its root; keep it inside the preview on narrow screens.
    className: 'w-full min-w-0 px-12',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-carousel-root',
        ref: 'carousel',
        className: 'mx-auto w-full max-w-lg',
        props: {
          a11yLabel: 'Project stages',
          slidesPerView: 2,
          minSlideSize: 180,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-carousel-viewport',
            ref: 'viewport',
            children: stages.map((stage, index) => ({
              kind: 'proto' as const,
              prototypeId: 'shadcn-carousel-slide',
              props: { index },
              // Leave room for the Card's ring and shadow within the scroll surface.
              className: 'px-2 py-1',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'shadcn-card-root',
                  ref: `card-${index}`,
                  children: [
                    {
                      kind: 'proto' as const,
                      prototypeId: 'shadcn-card-content',
                      className:
                        'flex min-h-36 flex-col items-center justify-center gap-3 text-center',
                      children: [
                        {
                          kind: 'proto' as const,
                          prototypeId: 'shadcn-text-root',
                          props: { size: '3xl', weight: 'semibold', tone: 'inherit' },
                          children: [String(index + 1)],
                        },
                        {
                          kind: 'proto' as const,
                          prototypeId: 'shadcn-text-root',
                          props: { size: 'sm', tone: 'muted' },
                          children: [stage],
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
            ref: 'previous',
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-chevron-left-icon',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Previous slide'] },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-carousel-next',
            ref: 'next',
            children: [
              {
                kind: 'proto',
                prototypeId: 'lucide-chevron-right-icon',
                props: { size: 16 },
              },
              { kind: 'box', tag: 'span', className: 'sr-only', children: ['Next slide'] },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
