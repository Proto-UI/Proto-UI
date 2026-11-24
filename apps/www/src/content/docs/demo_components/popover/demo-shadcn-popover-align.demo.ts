import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-6 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-popover-root',
        props: { a11yLabel: 'Aligned to start' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-trigger',
            children: ['Start'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-content',
            className: 'w-44',
            props: { align: 'start' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-popover-description',
                children: ['Aligned to start.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-popover-root',
        props: { a11yLabel: 'Aligned to center' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-trigger',
            children: ['Center'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-content',
            className: 'w-44',
            props: { align: 'center' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-popover-description',
                children: ['Aligned to center.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-popover-root',
        props: { a11yLabel: 'Aligned to end' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-trigger',
            children: ['End'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-popover-content',
            className: 'w-44',
            props: { align: 'end' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-popover-description',
                children: ['Aligned to end.'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
