import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

const ACTIVITY_FEED = [
  ['Design Tokens', 'Concentric radius alignment synced across modal sheets and cards'],
  ['Spatial Audio', 'Updated ambient focus cue volume curve for desktop sessions'],
  ['Typography', 'Optical weight tuning for compact sidebar labels at 13px'],
  ['Accessibility', 'Verified reduced-transparency fallback contrast across dark surfaces'],
  ['Scroll Chrome', 'Overlay pill thumb adapts cleanly when content stops overflowing'],
  ['Motion Guard', 'Instant opacity transitions when reduced motion is requested'],
  ['Keyboard Nav', 'Viewport enters tab sequence only when overflow exists'],
  ['Hit Targets', 'Pointer drag lease tracks thumb travel smoothly on both axes'],
  ['Color Vibrancy', 'Subtle rim preserves indicator legibility over bright photography'],
  ['System Fallback', 'Native host scrollbars remain intact where composed chrome is off'],
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-96',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-scroll-area-root',
        ref: 'root',
        className: 'h-56 w-full rounded-xl border border-border/60 bg-background/90 shadow-sm',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                ref: 'scrollContent',
                className: 'flex w-[480px] flex-col p-4 text-sm',
                children: [
                  {
                    kind: 'box',
                    className: 'mb-3 text-sm font-semibold',
                    children: ['Release Highlights'],
                  },
                  ...ACTIVITY_FEED.flatMap(([topic, summary], index) => [
                    {
                      kind: 'box' as const,
                      className: 'flex items-baseline gap-3 whitespace-nowrap',
                      children: [
                        {
                          kind: 'box' as const,
                          tag: 'span' as const,
                          className: 'w-28 shrink-0 text-xs font-semibold text-primary',
                          children: [topic],
                        },
                        {
                          kind: 'box' as const,
                          tag: 'span' as const,
                          className: 'text-xs text-muted-foreground',
                          children: [summary],
                        },
                      ],
                    },
                    ...(index < ACTIVITY_FEED.length - 1
                      ? [{ kind: 'box' as const, className: 'my-2 h-px w-full bg-border/60' }]
                      : []),
                  ]),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
