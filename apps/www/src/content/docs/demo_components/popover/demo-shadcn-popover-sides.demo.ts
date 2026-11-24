import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SIDES = [
  { side: 'top', label: 'Top' },
  { side: 'right', label: 'Right' },
  { side: 'bottom', label: 'Bottom' },
  { side: 'left', label: 'Left' },
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-3 p-6',
    children: SIDES.map(({ side, label }) => ({
      kind: 'proto' as const,
      prototypeId: 'shadcn-popover-root',
      props: { a11yLabel: `${label} placement` },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-popover-trigger',
          children: [label],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-popover-content',
          className: 'w-56',
          props: { side, sideOffset: 8 },
          children: [
            {
              kind: 'box' as const,
              className: 'grid gap-1',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'shadcn-popover-title',
                  children: [`Side: ${side}`],
                },
                {
                  kind: 'proto' as const,
                  prototypeId: 'shadcn-popover-description',
                  children: ['Automatically flips when space is constrained.'],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec);
