import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const row = (
  prominence: 'regular' | 'prominent' | 'destructive',
  label: string,
  value: number
): DemoNode => ({
  kind: 'proto',
  prototypeId: 'liquid-glass-progress-root',
  props: { prominence, value, min: 0, max: 100, valueText: `${value}%` },
  children: [
    { kind: 'proto', prototypeId: 'liquid-glass-progress-label', children: [label] },
    { kind: 'proto', prototypeId: 'liquid-glass-progress-value' },
    {
      kind: 'proto',
      prototypeId: 'liquid-glass-progress-track',
      children: [{ kind: 'proto', prototypeId: 'liquid-glass-progress-indicator' }],
    },
  ],
});

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'flex w-full max-w-md min-w-0 flex-col gap-5',
        children: [
          row('regular', 'Syncing photo library', 56),
          row('prominent', 'Downloading system update', 74),
          row('destructive', 'Cloud storage quota', 92),
        ],
      },
    ],
  },
} satisfies DemoSpec;
