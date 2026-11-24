import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto w-full max-w-sm rounded-base border-2 border-border bg-secondary-background p-4 shadow-[4px_4px_0_0_#000]',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-collapsible-trigger',
            children: ['Product details'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-collapsible-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-3',
                children: [
                  {
                    kind: 'box',
                    className: 'text-sm text-foreground',
                    children: [
                      'This panel expands and collapses to reveal additional product specifications.',
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-button',
                    props: { variant: 'neutral', size: 'sm' },
                    children: ['Learn More'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
