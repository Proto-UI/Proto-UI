import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'mx-auto w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-5',
    children: [
      {
        kind: 'box',
        className: 'rounded-2xl p-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-collapsible-root',
            props: { defaultOpen: false },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-collapsible-trigger',
                children: ['Order #4189 — Product details'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-collapsible-content',
                children: [
                  {
                    kind: 'box',
                    className: 'grid gap-3',
                    children: [
                      {
                        kind: 'box',
                        children: [
                          'Status: Shipped · 100 Market St, San Francisco · 2x Studio Headphones. Content stays opaque for crisp legibility without stacking glass on glass.',
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-button',
                        props: { variant: 'prominent' },
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
    ],
  },
} satisfies DemoSpec;
