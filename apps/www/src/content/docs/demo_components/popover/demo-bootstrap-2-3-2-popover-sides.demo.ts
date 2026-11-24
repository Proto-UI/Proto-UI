import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const SIDES = [
  { side: 'top', label: 'Popover on top' },
  { side: 'right', label: 'Popover on right' },
  { side: 'bottom', label: 'Popover on bottom' },
  { side: 'left', label: 'Popover on left' },
] as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-3 p-6',
    children: SIDES.map(({ side, label }) => ({
      kind: 'proto' as const,
      prototypeId: 'bootstrap-2-3-2-popover-root',
      props: { a11yLabel: label },
      children: [
        {
          kind: 'proto' as const,
          prototypeId: 'bootstrap-2-3-2-popover-trigger',
          children: [label],
        },
        {
          kind: 'proto' as const,
          prototypeId: 'bootstrap-2-3-2-popover-content',
          props: { side },
          children: [
            {
              kind: 'proto' as const,
              prototypeId: 'bootstrap-2-3-2-popover-title',
              children: [label],
            },
            {
              kind: 'proto' as const,
              prototypeId: 'bootstrap-2-3-2-popover-description',
              children: [`Anchored to the ${side} edge with a 150ms linear fade.`],
            },
          ],
        },
      ],
    })),
  },
} satisfies DemoSpec;
