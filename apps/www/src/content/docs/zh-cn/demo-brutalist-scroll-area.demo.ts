import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const CHANGELOG_ROWS = [
  ['#142', 'Shipped high-contrast focus ring tokens for dark surfaces'],
  ['#141', 'Updated button press displacement to 4px instant snap'],
  ['#140', 'Added keyboard roving support across horizontal tab strips'],
  ['#139', 'Balanced DM Sans heading weights across dialog headers'],
  ['#138', 'Refined dual-axis corner geometry for nested scroll panes'],
  ['#137', 'Added forced-colors thumb outline for Windows High Contrast'],
  ['#136', 'Unified 5px rounded-base border tokens across form fields'],
  ['#135', 'Verified responsive 320px phone viewport containment'],
  ['#134', 'Tightened select item hover contrast on main blue fill'],
  ['#133', 'Documented shadow-free scroll chrome grammar in design contract'],
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-80',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-scroll-area-root',
        className: 'h-48 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-[460px] flex-col gap-2 p-3 text-sm',
                children: [
                  {
                    kind: 'box',
                    className: 'font-heading font-bold',
                    children: ['Issue Feed — Brutalist Kit'],
                  },
                  ...CHANGELOG_ROWS.map(([id, summary]) => ({
                    kind: 'box' as const,
                    className: 'flex items-baseline gap-2 whitespace-nowrap',
                    children: [
                      {
                        kind: 'box' as const,
                        tag: 'span' as const,
                        className: 'font-mono text-xs font-bold',
                        children: [id],
                      },
                      {
                        kind: 'box' as const,
                        tag: 'span' as const,
                        children: [summary],
                      },
                    ],
                  })),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-scrollbar',
            ref: 'scrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-scroll-area-thumb',
                ref: 'thumb',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-scroll-area-scrollbar',
            ref: 'scrollbarHorizontal',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-scroll-area-thumb',
                ref: 'thumbHorizontal',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
