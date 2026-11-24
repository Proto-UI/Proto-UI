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
        props: { openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-trigger',
            children: ['Active link'],
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
                  { kind: 'box', className: 'font-semibold', children: ['Enabled Card'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Hovering or focusing this trigger opens the preview card.'],
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
        props: { disabled: true, openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-trigger',
            children: ['Disabled preview'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-hover-card-content',
            props: { side: 'bottom', align: 'center' },
            children: ['Disabled cards stay closed on hover and focus.'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
