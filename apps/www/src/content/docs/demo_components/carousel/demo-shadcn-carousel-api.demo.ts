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
        kind: 'box',
        className: 'mx-auto w-full max-w-xs',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-carousel-root',
            ref: 'carousel',
            className: 'w-full',
            props: {
              a11yLabel: 'Tracked carousel',
              defaultIndex: 0,
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
          {
            kind: 'box',
            ref: 'status',
            attrs: { role: 'status', 'aria-live': 'polite' },
            className: 'py-2 text-center text-sm text-muted-foreground',
            children: [`Slide 1 of ${slideNumbers.length}`],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    const updateStatus = (index: number) => {
      const status = refs.status;
      if (status) status.textContent = `Slide ${index + 1} of ${slideNumbers.length}`;
    };
    api.setProps('carousel', {
      onIndexChange: (payload: unknown) => {
        const record = payload as { index?: number; detail?: { index?: number } } | null;
        const next =
          typeof record?.index === 'number'
            ? record.index
            : typeof record?.detail?.index === 'number'
              ? record.detail.index
              : undefined;
        if (next !== undefined) updateStatus(next);
      },
    });
    return () => {
      api.setProps('carousel', { onIndexChange: null });
    };
  },
} satisfies DemoSpec);
