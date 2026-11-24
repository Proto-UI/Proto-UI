import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SIDES = [
  { side: 'top', label: 'Top', title: 'Top Sheet', description: 'Slides down from the top edge.' },
  { side: 'right', label: 'Right', title: 'Right Sheet', description: 'Slides in from the right edge.' },
  { side: 'bottom', label: 'Bottom', title: 'Bottom Sheet', description: 'Slides up from the bottom edge.' },
  { side: 'left', label: 'Left', title: 'Left Sheet', description: 'Slides in from the left edge.' },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex min-w-0 w-full flex-wrap items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: SIDES.map((item) => ({
      kind: 'proto' as const,
      prototypeId: 'liquid-glass-drawer-root',
      props: { a11yLabel: item.title },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'liquid-glass-drawer-trigger',
          children: [item.label],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'liquid-glass-drawer-mask',
        },
        {
          kind: 'proto' as const,
          prototypeId: 'liquid-glass-drawer-content',
          props: { side: item.side },
          children: [
            {
              kind: 'proto' as const,
              prototypeId: 'liquid-glass-drawer-handle',
              props: { a11yLabel: `Resize ${item.side} drawer` },
            },
            {
              kind: 'proto' as const,
              prototypeId: 'liquid-glass-drawer-header',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'liquid-glass-drawer-title',
                  children: [item.title],
                },
                {
                  kind: 'proto' as const,
                  prototypeId: 'liquid-glass-drawer-description',
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
              prototypeId: 'liquid-glass-drawer-footer',
              children: [
                {
                  kind: 'proto' as const,
                  prototypeId: 'liquid-glass-drawer-close',
                  props: { variant: 'prominent' },
                  children: ['Done'],
                },
              ],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec;
