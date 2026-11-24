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
        ref: 'root',
        props: {
          a11yLabel: 'Workspace preferences',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-drawer-trigger',
            children: ['Open Drawer'],
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
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-title',
                    children: ['Workspace Preferences'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-drawer-description',
                    children: ['Review default notification and digest rules for this project.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'p-[15px] space-y-2 text-sm',
                children: [
                  {
                    kind: 'box',
                    children: ['Daily digest: Enabled at 09:00 UTC'],
                  },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Drag the top handle downward or choose Close to dismiss.'],
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
