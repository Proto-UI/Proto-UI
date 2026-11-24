import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SNAP_METRICS = [
  { label: 'Compact stop', value: '50%' },
  { label: 'Expanded stop', value: '100%' },
  { label: 'Keyboard control', value: 'Arrow Up / Down' },
];

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-drawer-root',
        ref: 'root',
        props: {
          a11yLabel: 'Snap points drawer',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-trigger',
            children: ['Open Snap Drawer'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-content',
            ref: 'panel',
            previewTheme: 'portal',
            props: {
              side: 'bottom',
              snapPoints: [0.5, 1],
              defaultSnapPoint: 0.5,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-drawer-handle',
                props: { a11yLabel: 'Resize drawer height' },
              },
              {
                kind: 'box',
                className: 'mx-auto flex w-full max-w-sm flex-1 flex-col gap-4',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-1 text-center',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-drawer-title',
                        children: ['Snap Points'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-drawer-description',
                        children: ['Drag the handle or use Arrow Up / Down to change height.'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex-1 overflow-y-auto space-y-2',
                    children: SNAP_METRICS.map((item) => ({
                      kind: 'box' as const,
                      className:
                        'flex items-center justify-between rounded-base border-2 border-black bg-secondary-background px-3 py-2 text-sm',
                      children: [
                        { kind: 'box' as const, children: [item.label] },
                        { kind: 'box' as const, className: 'font-bold', children: [item.value] },
                      ],
                    })),
                  },
                  {
                    kind: 'box',
                    className: 'mt-[auto] flex flex-col gap-2 pt-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-drawer-close',
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
    ],
  },
} satisfies DemoSpec;
