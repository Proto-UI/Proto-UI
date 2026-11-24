import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-6 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-hover-card-root',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-trigger',
            children: ['Instant (0ms / 100ms)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-content',
            props: { side: 'bottom', align: 'center' },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-semibold', children: ['Quick Preview'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Opens immediately on hover and closes 100ms after leaving.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-hover-card-root',
        props: { openDelay: 400, closeDelay: 300 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-trigger',
            children: ['Delayed (400ms / 300ms)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-content',
            props: { side: 'bottom', align: 'center' },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-semibold', children: ['Intentional Preview'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Waits 400ms before opening to avoid accidental triggers.'],
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
