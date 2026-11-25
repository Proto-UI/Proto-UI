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
        props: { a11yLabel: 'Inspector panel' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-trigger',
            children: ['Opaque & Locked Drag'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-drawer-content',
            props: {
              side: 'right',
              maxExtent: { unit: 'logical', value: 420 },
              dragDismissible: false,
              material: 'opaque',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-title',
                    children: ['Inspector Panel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-drawer-description',
                    children: [
                      'Opt out of translucency with material="opaque", cap width at 420px, and disable swipe dismissal.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 px-4 py-2 space-y-2 text-sm',
                children: [
                  {
                    kind: 'box',
                    className: 'rounded-xl border border-border px-3 py-2',
                    children: ['material: "opaque"'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded-xl border border-border px-3 py-2',
                    children: ['maxExtent: { unit: "logical", value: 420 }'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded-xl border border-border px-3 py-2',
                    children: ['dragDismissible: false'],
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
