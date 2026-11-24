import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const ACTIVITY_ITEMS = [
  { title: 'Theme tokens synced', detail: 'Updated 5px radius and DM Sans font scale.' },
  { title: 'Shadow grammar applied', detail: '4px hard shadow on raised triggers and panels.' },
  { title: 'Keyboard controls verified', detail: 'Escape and focus restoration remain active.' },
  { title: 'Edge placement ready', detail: 'Top, right, bottom, and left directions supported.' },
  { title: 'Snap points configured', detail: 'Drag or press arrow keys to resize smoothly.' },
  { title: 'Dark mode palette active', detail: 'Semantic foreground handles maintain contrast.' },
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
          a11yLabel: 'Activity log',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-trigger',
            children: ['Scrollable Content'],
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
              maxExtent: { unit: 'logical', value: 400 },
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'box',
                className: 'flex flex-col gap-1 text-center',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-drawer-title',
                    children: ['Activity Log'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-drawer-description',
                    children: ['Scroll within the body while keeping actions pinned below.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 overflow-y-auto space-y-2 pr-1',
                children: ACTIVITY_ITEMS.map((item) => ({
                  kind: 'box' as const,
                  className: 'rounded-base border-2 border-black bg-secondary-background p-3',
                  children: [
                    {
                      kind: 'box' as const,
                      className: 'text-sm font-bold',
                      children: [item.title],
                    },
                    {
                      kind: 'box' as const,
                      className: 'text-xs text-muted-foreground',
                      children: [item.detail],
                    },
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
} satisfies DemoSpec;
