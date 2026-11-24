import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SNAP_STOPS = [
  { stop: 'Half height (50%)', note: 'Quick glance at current status and key actions.' },
  { stop: 'Full height (100%)', note: 'Expand via drag or Arrow Up for full details.' },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-drawer-root',
        ref: 'root',
        props: {
          a11yLabel: 'Snap points drawer',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-trigger',
            children: ['Open Snap Drawer'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-content',
            ref: 'panel',
            props: {
              side: 'bottom',
              snapPoints: [0.5, 1],
              defaultSnapPoint: 0.5,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-handle',
                props: { a11yLabel: 'Resize drawer height' },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-title',
                    children: ['Snap Points'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-description',
                    children: ['Drag the handle or use Arrow Up / Down to switch between stops.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 overflow-y-auto p-[15px] space-y-3',
                children: SNAP_STOPS.map((item) => ({
                  kind: 'box' as const,
                  className: 'rounded-[4px] border border-border p-3 space-y-1',
                  children: [
                    { kind: 'box' as const, className: 'font-bold text-sm', children: [item.stop] },
                    {
                      kind: 'box' as const,
                      className: 'text-sm text-muted-foreground',
                      children: [item.note],
                    },
                  ],
                })),
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-close',
                    children: ['Close'],
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
