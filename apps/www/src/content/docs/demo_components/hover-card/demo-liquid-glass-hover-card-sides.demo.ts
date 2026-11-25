import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const HOVER_CARD_SIDES = ['left', 'top', 'bottom', 'right'] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4',
    children: HOVER_CARD_SIDES.map((side) => ({
      kind: 'proto' as const,
      prototypeId: 'liquid-glass-hover-card-root',
      props: { openDelay: 100, closeDelay: 150 },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'liquid-glass-hover-card-trigger',
          className: 'capitalize',
          children: [side],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'liquid-glass-hover-card-content',
          props: { side, align: 'center', sideOffset: 8 },
          children: [
            {
              kind: 'box',
              className: 'flex flex-col gap-1',
              children: [
                { kind: 'box', className: 'text-sm font-semibold', children: ['Hover Card'] },
                {
                  kind: 'box',
                  className: 'text-sm text-muted-foreground',
                  children: [`Floats on the ${side} side of the trigger.`],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec;
