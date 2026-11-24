import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-popover-root',
        props: { a11yLabel: 'Popover title' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-trigger',
            children: ['Open Popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-popover-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-title',
                children: ['Popover title'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-popover-description',
                children: ['And here is some helpful contextual information anchored to the right.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
