import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const HOVER_CARD_SIDES = ['left', 'top', 'bottom', 'right'] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center justify-center gap-3 p-6',
    children: HOVER_CARD_SIDES.map((side) => ({
      kind: 'proto' as const,
      prototypeId: 'brutalist-hover-card-root',
      props: { openDelay: 100, closeDelay: 150 },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'brutalist-hover-card-trigger',
          className: 'capitalize',
          children: [side],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'brutalist-hover-card-content',
          props: { side, align: 'center', sideOffset: 8 },
          children: [
            {
              kind: 'box',
              className: 'flex flex-col gap-1',
              children: [
                {
                  kind: 'box',
                  className: 'font-heading text-sm font-bold',
                  children: ['Hover Card'],
                },
                {
                  kind: 'box',
                  className: 'text-sm',
                  children: [`This preview panel opens on the ${side} side of the trigger.`],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec;
