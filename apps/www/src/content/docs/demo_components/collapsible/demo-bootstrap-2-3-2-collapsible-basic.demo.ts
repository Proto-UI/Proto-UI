import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'mx-auto w-full max-w-md p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-collapsible-root',
        props: { defaultOpen: false },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-trigger',
            children: ['Order #4189 — Product details'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-collapsible-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-3',
                children: [
                  {
                    kind: 'box',
                    children: [
                      'Status: Shipped · 100 Market St, San Francisco · 2x Studio Headphones.',
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-button',
                    props: { variant: 'primary' },
                    children: ['View invoice'],
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
