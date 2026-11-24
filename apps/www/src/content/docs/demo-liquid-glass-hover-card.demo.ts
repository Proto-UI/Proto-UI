import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-hover-card-root',
        props: { openDelay: 150, closeDelay: 200 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-trigger',
            children: ['@proto-ui'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-content',
            props: { side: 'bottom', align: 'center', sideOffset: 8 },
            children: [
              {
                kind: 'box',
                className: 'flex items-start gap-3',
                children: [
                  {
                    kind: 'box',
                    className:
                      'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground',
                    children: ['PU'],
                  },
                  {
                    kind: 'box',
                    className: 'flex flex-col gap-1',
                    children: [
                      {
                        kind: 'box',
                        className: 'text-sm font-semibold leading-none',
                        children: ['@proto-ui'],
                      },
                      {
                        kind: 'box',
                        className: 'text-sm text-muted-foreground',
                        children: [
                          'Host-neutral interaction protocols layered over translucent Liquid Glass surfaces.',
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground',
                children: ['Joined December 2024 · 4 framework adapters'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
