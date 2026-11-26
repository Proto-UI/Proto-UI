import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-popover-root',
        props: { a11yLabel: 'Dimensions' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-popover-trigger',
            children: ['Open Popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-popover-content',
            ref: 'basic-content',
            previewTheme: 'portal',
            props: { align: 'start' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-popover-description',
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
