import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-drawer-root',
        props: { a11yLabel: 'Custom sized drawer' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-trigger',
            children: ['Custom Size & Locked Drag'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-content',
            props: {
              side: 'right',
              maxExtent: { unit: 'logical', value: 420 },
              dragDismissible: false,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-title',
                    children: ['Inspector Panel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-description',
                    children: ['Capped at 420px with dragDismissible={false}.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 p-[15px] space-y-2 text-sm',
                children: [
                  { kind: 'box', children: ['maxExtent: { unit: "logical", value: 420 }'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Use the Close button, Escape key, or backdrop click to dismiss.'],
                  },
                ],
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
