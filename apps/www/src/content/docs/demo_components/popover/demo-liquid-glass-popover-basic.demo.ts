import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex min-w-0 items-center justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-popover-root',
        props: { a11yLabel: 'Dimensions' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-trigger',
            children: ['Open Popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-popover-content',
            props: { align: 'start' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-popover-description',
                    children: ['Set the dimensions for the layer.'],
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
