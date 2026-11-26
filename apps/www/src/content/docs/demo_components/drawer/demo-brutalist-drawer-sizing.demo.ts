import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-drawer-root',
        props: { a11yLabel: 'Custom sized drawer' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-trigger',
            children: ['Custom Size & Locked Drag'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-content',
            ref: 'sizing-content',
            previewTheme: 'portal',
            props: {
              side: 'right',
              maxExtent: { unit: 'logical', value: 420 },
              dragDismissible: false,
            },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-drawer-title',
                    children: ['Inspector Panel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'brutalist-drawer-description',
                    children: [
                      'Capped at 420px with dragDismissible={false}. Close with the button, Escape, or backdrop click.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 space-y-2 text-sm',
                children: [
                  {
                    kind: 'box',
                    className: 'rounded-base border-2 border-black bg-secondary-background p-3',
                    children: ['maxExtent: { unit: "logical", value: 420 }'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded-base border-2 border-black bg-secondary-background p-3',
                    children: ['dragDismissible: false'],
                  },
                ],
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
