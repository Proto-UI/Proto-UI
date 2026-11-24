import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { bindDrawerCommandDisabled } from '../../drawer-command-disabled.shared';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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
        props: { a11yLabel: 'Custom sized drawer' },
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
                children: ['Custom Size & Locked Drag'],
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
              side: 'right',
              maxExtent: { unit: 'logical', value: 420 },
              dragDismissible: false,
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-title',
                    children: ['Inspector Panel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-description',
                    children: [
                      'Capped at 420px via maxExtent with dragDismissible={false} to prevent accidental swipe dismissal.',
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
                    className: 'rounded-lg border border-border p-3',
                    children: ['maxExtent: { unit: "logical", value: 420 }'],
                  },
                  {
                    kind: 'box',
                    className: 'rounded-lg border border-border p-3',
                    children: ['dragDismissible: false (Close, Escape, and backdrop stay active)'],
                  },
                ],
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
  setup({ api }) {
    return bindDrawerCommandDisabled(api);
  },
} satisfies DemoSpec);
