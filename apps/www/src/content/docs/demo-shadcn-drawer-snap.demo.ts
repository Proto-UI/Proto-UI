import { withShadcnRheaDemo } from './shadcn-demo-style';
import { bindDrawerCommandDisabled } from './drawer-command-disabled.shared';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SUMMARY_ROWS = [
  { label: 'Active workspace', value: 'Design System' },
  { label: 'Sync schedule', value: 'Every 15 minutes' },
  { label: 'Release channel', value: 'Preview' },
];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-drawer-root',
        ref: 'root',
        props: {
          a11yLabel: 'Snap points drawer',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-drawer-trigger',
            ref: 'trigger',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                ref: 'trigger-action',
                props: { variant: 'outline', disabled: true },
                children: ['Open Snap Drawer'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-drawer-content',
            ref: 'panel',
            props: {
              side: 'bottom',
              snapPoints: [0.5, 1],
              defaultSnapPoint: 0.5,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-drawer-handle',
                props: { a11yLabel: 'Resize drawer height' },
              },
              {
                kind: 'box',
                className: 'mx-auto flex w-full max-w-sm flex-1 flex-col',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-drawer-title',
                        children: ['Snap Points'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-drawer-description',
                        children: [
                          'Drag the handle or press Arrow Up / Down to switch between 50% and full height.',
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex-1 overflow-y-auto px-4 py-2 space-y-2',
                    children: SUMMARY_ROWS.map((row) => ({
                      kind: 'box' as const,
                      className:
                        'flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm',
                      children: [
                        {
                          kind: 'box' as const,
                          className: 'text-muted-foreground',
                          children: [row.label],
                        },
                        {
                          kind: 'box' as const,
                          className: 'font-medium',
                          children: [row.value],
                        },
                      ],
                    })),
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-footer',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-drawer-close',
                        ref: 'close',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-button',
                            ref: 'close-action',
                            props: { variant: 'outline', disabled: true },
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
    ],
  },
  setup({ api }) {
    return bindDrawerCommandDisabled(api);
  },
} satisfies DemoSpec);
