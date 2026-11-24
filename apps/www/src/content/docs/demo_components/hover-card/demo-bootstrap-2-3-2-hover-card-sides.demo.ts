import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const HOVER_CARD_SIDES = ['left', 'top', 'bottom', 'right'] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-4 p-6',
    children: HOVER_CARD_SIDES.map((side) => ({
      kind: 'proto' as const,
      prototypeId: 'bootstrap-2-3-2-hover-card-root',
      props: { openDelay: 100, closeDelay: 150 },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'bootstrap-2-3-2-hover-card-trigger',
          className: 'capitalize',
          children: [side],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'bootstrap-2-3-2-hover-card-content',
          props: { side, align: 'center', sideOffset: 6 },
          children: [
            {
              kind: 'box',
              className: 'flex flex-col gap-1',
              children: [
                { kind: 'box', className: 'font-bold text-sm', children: ['Hover Card'] },
                {
                  kind: 'box',
                  className: 'text-sm',
                  children: [`Opens on the ${side} side of the link trigger.`],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec;
