import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-popover-root',
        props: { a11yLabel: 'Dimensions' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-trigger',
            children: ['Open Popover'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-content',
            props: { align: 'start' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-title',
                    children: ['Dimensions'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-popover-description',
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
} satisfies DemoSpec);
