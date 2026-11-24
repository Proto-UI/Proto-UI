import { withShadcnRheaDemo } from '../shadcn-demo-style';

const RELEASE_ENTRIES = [
  ['v1.2.0-beta.50', 'Refine keyboard focus ring and viewport scroll inertia'],
  ['v1.2.0-beta.49', 'Polish horizontal artwork gallery spacing and snap alignment'],
  ['v1.2.0-beta.48', 'Update high-contrast outline tokens for forced-colors hosts'],
  ['v1.2.0-beta.47', 'Improve touch trackpad momentum on nested sidebars'],
  ['v1.2.0-beta.46', 'Add RTL direction support for tag lists and panels'],
  ['v1.2.0-beta.45', 'Normalize thumb drag ratio when viewport resizes dynamically'],
  ['v1.2.0-beta.44', 'Reduce repaint churn during continuous wheel scrolling'],
  ['v1.2.0-beta.43', 'Synchronize dark theme border contrast across card frames'],
  ['v1.2.0-beta.42', 'Guard transition rules when reduced motion is preferred'],
  ['v1.2.0-beta.41', 'Release dual-axis corner inset when opposite bar unmounts'],
  ['v1.2.0-beta.40', 'Align radius inheritance between root frame and viewport'],
  ['v1.2.0-beta.39', 'Stabilize pointer capture teardown on rapid unmount'],
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-80',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-scroll-area-root',
        className: 'h-72 w-full rounded-md border bg-background',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-[440px] flex-col p-4 text-sm',
                children: [
                  {
                    kind: 'box',
                    className: 'mb-3 text-sm leading-none font-medium',
                    children: ['Tags'],
                  },
                  ...RELEASE_ENTRIES.flatMap(([tag, note], index) => [
                    {
                      kind: 'box' as const,
                      className: 'flex items-baseline justify-between gap-4 whitespace-nowrap',
                      children: [
                        {
                          kind: 'box' as const,
                          tag: 'span' as const,
                          className: 'font-mono text-xs font-medium',
                          children: [tag],
                        },
                        {
                          kind: 'box' as const,
                          tag: 'span' as const,
                          className: 'text-xs text-muted-foreground',
                          children: [note],
                        },
                      ],
                    },
                    ...(index < RELEASE_ENTRIES.length - 1
                      ? [{ kind: 'box' as const, className: 'my-2 h-px w-full bg-border' }]
                      : []),
                  ]),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
});
