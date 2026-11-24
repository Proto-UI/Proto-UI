import { withShadcnRheaDemo } from './shadcn-demo-style';
import { bindDrawerCommandDisabled } from './drawer-command-disabled.shared';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const CHANGELOG_ITEMS = [
  {
    title: 'Keyboard navigation',
    body: 'Arrow keys and Home/End step between explicit snap points while Escape closes the sheet.',
  },
  {
    title: 'Edge attachment',
    body: 'Place drawers on top, right, bottom, or left with axis-aware motion and safe available-space limits.',
  },
  {
    title: 'Focus restoration',
    body: 'Focus moves inside the drawer when opened and returns cleanly to the trigger once dismissed.',
  },
  {
    title: 'Scroll cooperation',
    body: 'Wrap the body in a flex-1 overflow-y-auto container so header and footer controls remain visible.',
  },
  {
    title: 'Custom extent caps',
    body: 'Declare minExtent and maxExtent with neutral layout units without overriding host CSS widths.',
  },
  {
    title: 'Controlled refusal',
    body: 'Controlled roots stay authoritative; rejected close gestures settle smoothly back into place.',
  },
  {
    title: 'Reduced motion',
    body: 'Presentation transitions respect prefers-reduced-motion and complete immediately when requested.',
  },
  {
    title: 'Theme profiles',
    body: 'Switch between Rhea, Nova, Vega, Maia, Lyra, Mira, Luma, Sera, and New York v4 without changing behavior.',
  },
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
          a11yLabel: 'Release notes',
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
                props: { variant: 'outline', wrap: true, disabled: true },
                children: ['Scrollable Content'],
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
              maxExtent: { unit: 'logical', value: 420 },
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-drawer-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-title',
                    children: ['Release Highlights'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-description',
                    children: ['Scroll through the notes while keeping header and footer anchored.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex-1 overflow-y-auto px-4 py-2 space-y-3',
                children: CHANGELOG_ITEMS.map((item) => ({
                  kind: 'box' as const,
                  className: 'rounded-lg border border-border p-3 space-y-1',
                  children: [
                    {
                      kind: 'box' as const,
                      className: 'text-sm font-medium',
                      children: [item.title],
                    },
                    {
                      kind: 'box' as const,
                      className: 'text-xs text-muted-foreground',
                      children: [item.body],
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
  setup({ api }) {
    return bindDrawerCommandDisabled(api);
  },
} satisfies DemoSpec);
