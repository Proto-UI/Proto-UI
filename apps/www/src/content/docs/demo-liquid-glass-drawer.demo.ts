import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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
          a11yLabel: 'Audio output settings',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-trigger',
            props: { variant: 'prominent' },
            children: ['Open Drawer'],
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
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'box',
                className: 'mx-auto w-full max-w-sm',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-drawer-title',
                        children: ['Spatial Audio'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'liquid-glass-drawer-description',
                        children: ['Adaptive head tracking and studio clarity for nearby devices.'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'px-4 py-2 space-y-2 text-sm',
                    children: [
                      {
                        kind: 'box',
                        className:
                          'flex items-center justify-between rounded-xl border border-border px-3 py-2',
                        children: [
                          { kind: 'box', children: ['Studio Speakers'] },
                          {
                            kind: 'box',
                            className: 'text-muted-foreground',
                            children: ['Connected'],
                          },
                        ],
                      },
                      {
                        kind: 'box',
                        className:
                          'flex items-center justify-between rounded-xl border border-border px-3 py-2',
                        children: [
                          { kind: 'box', children: ['Noise Cancellation'] },
                          {
                            kind: 'box',
                            className: 'text-muted-foreground',
                            children: ['Adaptive'],
                          },
                        ],
                      },
                    ],
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
