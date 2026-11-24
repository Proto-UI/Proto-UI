import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SIDES = [
  { side: 'top', label: 'Top', title: 'Top Drawer', description: 'Slides down from the top edge.' },
  { side: 'right', label: 'Right', title: 'Right Drawer', description: 'Slides in from the right edge.' },
  { side: 'bottom', label: 'Bottom', title: 'Bottom Drawer', description: 'Slides up from the bottom edge.' },
  { side: 'left', label: 'Left', title: 'Left Drawer', description: 'Slides in from the left edge.' },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-3 p-4',
    children: SIDES.map((item) => ({
      kind: 'proto' as const,
      prototypeId: 'brutalist-drawer-root',
      props: { a11yLabel: item.title },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'brutalist-drawer-trigger',
          children: [item.label],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'brutalist-drawer-mask',
        },
        {
          kind: 'proto' as const,
          prototypeId: 'brutalist-drawer-content',
          previewTheme: 'portal',
          props: { side: item.side },
          children: [
            {
              kind: 'proto' as const,
              prototypeId: 'brutalist-drawer-handle',
              props: { a11yLabel: `Resize ${item.side} drawer` },
            },
            {
              kind: 'box' as const,
              className: 'flex flex-col gap-1.5',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'brutalist-drawer-title',
                  children: [item.title],
                },
                {
                  kind: 'proto' as const,
                  prototypeId: 'brutalist-drawer-description',
                  children: [item.description],
                },
              ],
            },
            {
              kind: 'box' as const,
              className: 'flex-1 text-sm',
              children: [`Configured with side="${item.side}".`],
            },
            {
              kind: 'box' as const,
              className: 'mt-[auto] flex flex-col gap-2 pt-2',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'brutalist-drawer-close',
                  children: ['Close'],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec;
