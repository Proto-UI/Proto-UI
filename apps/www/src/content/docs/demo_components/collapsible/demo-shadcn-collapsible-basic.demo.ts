import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xs',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'box',
            className: 'flex items-center justify-between gap-4 px-1',
            children: [
              {
                kind: 'box',
                className: 'text-sm font-semibold text-foreground',
                children: ['Order #4189'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-collapsible-trigger',
                props: { variant: 'ghost', size: 'icon' },
                children: ['↕'],
              },
            ],
          },
          {
            kind: 'box',
            className:
              'flex items-center justify-between rounded-lg border border-border bg-background px-3.5 py-2 text-sm',
            children: [
              {
                kind: 'box',
                className: 'text-muted-foreground',
                children: ['Status'],
              },
              {
                kind: 'box',
                className: 'font-medium text-foreground',
                children: ['Shipped'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-collapsible-content',
            props: { variant: 'plain' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-2',
                children: [
                  {
                    kind: 'box',
                    className: 'rounded-lg border border-border bg-background px-3.5 py-2 text-sm',
                    children: [
                      {
                        kind: 'box',
                        className: 'font-medium text-foreground',
                        children: ['Shipping address'],
                      },
                      {
                        kind: 'box',
                        className: 'text-muted-foreground',
                        children: ['100 Market St, San Francisco'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'rounded-lg border border-border bg-background px-3.5 py-2 text-sm',
                    children: [
                      {
                        kind: 'box',
                        className: 'font-medium text-foreground',
                        children: ['Items'],
                      },
                      {
                        kind: 'box',
                        className: 'text-muted-foreground',
                        children: ['2x Studio Headphones'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
