import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SIDES = [
  { side: 'top', label: 'Top', title: 'Top Drawer', description: 'Slides down from the top edge.' },
  { side: 'right', label: 'Right', title: 'Right Drawer', description: 'Slides in from the right edge.' },
  { side: 'bottom', label: 'Bottom', title: 'Bottom Drawer', description: 'Slides up from the bottom edge.' },
  { side: 'left', label: 'Left', title: 'Left Drawer', description: 'Slides in from the left edge.' },
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-3 p-4',
    children: SIDES.map((item) => ({
      kind: 'proto' as const,
      prototypeId: 'shadcn-drawer-root',
      props: { a11yLabel: item.title },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-drawer-trigger',
          children: [
            {
              kind: 'proto' as const,
              prototypeId: 'shadcn-button',
              props: { variant: 'outline' },
              children: [item.label],
            },
          ],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-drawer-mask',
        },
        {
          kind: 'proto' as const,
          prototypeId: 'shadcn-drawer-content',
          props: { side: item.side },
          children: [
            {
              kind: 'proto' as const,
              prototypeId: 'shadcn-drawer-handle',
              props: { a11yLabel: `Resize ${item.side} drawer` },
            },
            {
              kind: 'proto' as const,
              prototypeId: 'shadcn-drawer-header',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'shadcn-drawer-title',
                  children: [item.title],
                },
                {
                  kind: 'proto' as const,
                  prototypeId: 'shadcn-drawer-description',
                  children: [item.description],
                },
              ],
            },
            {
              kind: 'box' as const,
              className: 'flex-1 px-4 py-2 text-sm text-muted-foreground',
              children: [`Configured with side="${item.side}".`],
            },
            {
              kind: 'proto' as const,
              prototypeId: 'shadcn-drawer-footer',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'shadcn-drawer-close',
                  children: [
                    {
                      kind: 'proto' as const,
                      prototypeId: 'shadcn-button',
                      props: { variant: 'outline' },
                      children: ['Close'],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec);
