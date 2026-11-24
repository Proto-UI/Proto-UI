import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto w-full max-w-sm p-1',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'box',
            className:
              'flex items-center justify-between gap-3 rounded-base border-2 border-border bg-background px-4 py-2',
            children: [
              {
                kind: 'box',
                className: 'text-sm font-heading font-bold text-foreground',
                children: ['@peduarte starred 3 repositories'],
              },
              {
                kind: 'proto',
                prototypeId: 'brutalist-collapsible-trigger',
                props: { variant: 'noShadow' },
                children: ['Toggle'],
              },
            ],
          },
          {
            kind: 'box',
            className:
              'rounded-base border-2 border-border bg-background px-4 py-3 font-mono text-sm text-foreground',
            children: ['@radix-ui/primitives'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-collapsible-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-2 font-mono text-sm',
                children: [
                  {
                    kind: 'box',
                    className:
                      'rounded-base border-2 border-border bg-background px-4 py-3 text-foreground',
                    children: ['@radix-ui/colors'],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-base border-2 border-border bg-background px-4 py-3 text-foreground',
                    children: ['@stitches/react'],
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
