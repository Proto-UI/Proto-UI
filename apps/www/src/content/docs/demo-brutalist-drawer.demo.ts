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
        ref: 'root',
        props: {
          a11yLabel: 'Confirm deployment',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-drawer-trigger',
            children: ['Open Drawer'],
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
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'box',
                className: 'mx-auto flex w-full max-w-sm flex-col gap-4',
                children: [
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-1.5 text-center',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-drawer-title',
                        children: ['Are you absolutely sure?'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-drawer-description',
                        children: ['Publish the latest build to the staging environment.'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-2 pt-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'brutalist-drawer-close',
                        children: ['Cancel'],
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
} as DemoSpec;
