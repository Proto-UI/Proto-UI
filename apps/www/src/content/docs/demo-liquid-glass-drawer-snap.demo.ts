import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const ROUTE_STOPS = [
  { place: 'Downtown Transit Hub', eta: '6 min' },
  { place: 'Waterfront Park', eta: '14 min' },
  { place: 'Observatory Overlook', eta: '22 min' },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 w-full flex-wrap items-center justify-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-drawer-root',
        ref: 'root',
        props: {
          a11yLabel: 'Route overview',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-trigger',
            children: ['Open Snap Drawer'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-content',
            ref: 'panel',
            props: {
              side: 'bottom',
              snapPoints: [0.5, 1],
              defaultSnapPoint: 0.5,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-drawer-handle',
                props: { a11yLabel: 'Resize sheet height' },
              },
              {
                kind: 'box',
                className: 'mx-auto flex w-full max-w-sm flex-1 flex-col',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-drawer-title',
                        children: ['Route Stops'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-drawer-description',
                        children: [
                          'Drag the grabber or press Arrow Up / Down to expand the sheet.',
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex-1 overflow-y-auto px-4 py-2 space-y-2',
                    children: ROUTE_STOPS.map((stop) => ({
                      kind: 'box' as const,
                      className:
                        'flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm',
                      children: [
                        { kind: 'box' as const, className: 'font-medium', children: [stop.place] },
                        {
                          kind: 'box' as const,
                          className: 'text-muted-foreground',
                          children: [stop.eta],
                        },
                      ],
                    })),
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-footer',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-drawer-close',
                        props: { variant: 'prominent' },
                        children: ['Done'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
