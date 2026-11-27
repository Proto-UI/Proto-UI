import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const slideNumbers = [1, 2, 3, 4, 5];

export default {
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
            prototypeId: 'brutalist-carousel-root',
            ref: 'carousel',
            className: 'w-full',
            props: {
              a11yLabel: 'Tracked brutalist carousel',
              defaultIndex: 0,
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
                        'flex aspect-square items-center justify-center rounded-[5px] border-2 border-black bg-[#05e17a] p-6 text-black shadow-[4px_4px_0_0_#000]',
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
          {
            kind: 'box',
            ref: 'status',
            attrs: { role: 'status', 'aria-live': 'polite' },
            className: 'py-2 text-center text-sm font-medium',
            children: [`Slide 1 of ${slideNumbers.length}`],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('carousel', {
      onIndexChange: (payload: unknown) => {
        const record = payload as { index?: number; detail?: { index?: number } } | null;
        const next =
          typeof record?.index === 'number'
            ? record.index
            : typeof record?.detail?.index === 'number'
              ? record.detail.index
              : undefined;
        if (next !== undefined && refs.status) {
          refs.status.textContent = `Slide ${next + 1} of ${slideNumbers.length}`;
        }
      },
    });
    return () => {
      api.setProps('carousel', { onIndexChange: null });
    };
  },
} satisfies DemoSpec;
