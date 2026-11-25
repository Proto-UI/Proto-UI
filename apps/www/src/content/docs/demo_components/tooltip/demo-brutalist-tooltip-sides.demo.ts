const triggerClass =
  'inline-flex items-center justify-center rounded-base border-2 border-foreground bg-main px-4 py-2 font-sans text-sm font-medium text-main-foreground cursor-pointer';

const sides = [
  ['left', 'Left'],
  ['top', 'Top'],
  ['bottom', 'Bottom'],
  ['right', 'Right'],
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex items-center justify-center p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tooltip-group',
        props: { openDelay: 0, closeDelay: 100, skipDelay: 300 },
        className: 'flex flex-wrap items-center justify-center gap-3',
        children: sides.map(([side, label]) => ({
          kind: 'proto' as const,
          prototypeId: 'brutalist-tooltip-root',
          children: [
            {
              kind: 'proto' as const,
              prototypeId: 'brutalist-tooltip-trigger',
              ref: `brutalistSideTrigger-${side}`,
              className: triggerClass,
              children: [label],
            },
            {
              kind: 'proto' as const,
              prototypeId: 'brutalist-tooltip-content',
              ref: `brutalistSideContent-${side}`,
              previewTheme: 'portal' as const,
              props: { side, align: 'center' },
              children: ['Add to library'],
            },
          ],
        })),
      },
    ],
  },
};
