import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const PLAYLIST = [
  ['01', 'Morning Light', '3:42'],
  ['02', 'Glass Horizon', '4:15'],
  ['03', 'Pacific Drift', '2:58'],
  ['04', 'Quiet Reflection', '5:04'],
  ['05', 'Blue Hour Transit', '3:51'],
  ['06', 'Evening Tide', '4:27'],
  ['07', 'Distant Chimes', '3:19'],
  ['08', 'Starlight Window', '4:48'],
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'relative w-full max-w-96 rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/25 p-5',
    children: [
      {
        kind: 'box',
        className:
          'relative overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-sm',
        children: [
          {
            kind: 'box',
            className:
              'flex items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-3 py-2.5 backdrop-blur-xs',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                props: { variant: 'regular', material: 'auto' },
                children: ['Library'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-button',
                props: { variant: 'prominent', material: 'auto' },
                children: ['Play All'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-scroll-area-root',
            className: 'h-48 w-full',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-scroll-area-viewport',
                ref: 'scrollViewport',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col p-3.5 text-sm',
                    children: PLAYLIST.flatMap(([track, title, duration], index) => [
                      {
                        kind: 'box' as const,
                        className: 'flex items-center justify-between gap-3 py-1',
                        children: [
                          {
                            kind: 'box' as const,
                            className: 'flex items-center gap-3',
                            children: [
                              {
                                kind: 'box' as const,
                                tag: 'span' as const,
                                className: 'font-mono text-xs text-muted-foreground',
                                children: [track],
                              },
                              {
                                kind: 'box' as const,
                                tag: 'span' as const,
                                className: 'font-medium',
                                children: [title],
                              },
                            ],
                          },
                          {
                            kind: 'box' as const,
                            tag: 'span' as const,
                            className: 'font-mono text-xs text-muted-foreground',
                            children: [duration],
                          },
                        ],
                      },
                      ...(index < PLAYLIST.length - 1
                        ? [{ kind: 'box' as const, className: 'my-1 h-px w-full bg-border/60' }]
                        : []),
                    ]),
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
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
