import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const HOVER_CARD_SIDES = ['left', 'top', 'bottom', 'right'] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3 p-6',
    children: HOVER_CARD_SIDES.map((side) => ({
      kind: 'proto' as const,
      prototypeId: 'shadcn-hover-card-root',
      props: { openDelay: 100, closeDelay: 100 },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-hover-card-trigger',
          className:
            'rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium capitalize shadow-xs hover:bg-muted',
          children: [side],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-hover-card-content',
          props: { side, align: 'center', sideOffset: 6 },
          children: [
            {
              kind: 'box',
              className: 'flex flex-col gap-1',
              children: [
                {
                  kind: 'box',
                  className: 'text-sm font-semibold',
                  children: ['Hover Card'],
                },
                {
                  kind: 'box',
                  className: 'text-sm text-muted-foreground',
                  children: [`This hover card opens on the ${side} side of the trigger.`],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec);
